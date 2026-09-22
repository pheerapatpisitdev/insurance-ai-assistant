"use server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rangeStart, summarise } from "@/lib/crm/summary";
import { profileOf } from "@/lib/facebook/profile";
import type { ConversationRow, LeadRow, Range, Summary, UnansweredRow } from "@/lib/crm/types";

/** Everything `/admin/crm` shows, read once. */

/** How many leads a page shows at once; enough to work through, few enough to fetch names for. */
const LEAD_LIMIT = 50;
const UNANSWERED_LIMIT = 50;

export interface LeadView extends LeadRow {
  /** borrowed from Meta for this render; absent when Meta would not say or the id is gone */
  name?: string;
  picture?: string;
  /** whether this person can still be written to at all */
  reachable: boolean;
  /**
   * The bot has stopped in this thread because the form went out.
   *
   * Read for the screen rather than stored on the lead: the silence belongs to the chat
   * session, and a lead is a report of what happened rather than the switch that did it.
   */
  botStopped: boolean;
}

export interface CrmPage {
  range: Range;
  summary: Summary;
  leads: LeadView[];
  unanswered: UnansweredRow[];
  /** what the models have cost since the first of the month, in baht */
  aiCostThisMonth: number;
}

export async function loadCrm(range: Range = "7d"): Promise<CrmPage> {

  const supabase = supabaseAdmin();
  const since = rangeStart(range).toISOString();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

  const [conversations, leads, unanswered, spend] = await Promise.all([
    supabase
      .from("ins_conversations")
      .select(
        "id, started_at, last_event_at, product, source, ad_id, ref, priced_at, form_sent_at," +
        " form_done_at, agent_replied_at, stalled_at, handover_at, messages",
      )
      .gte("started_at", since),
    // the cipher itself has no business travelling to a React tree; the page only ever asks
    // whether this person can still be written to
    supabase
      .from("ins_leads")
      .select(
        "id, conversation_id, stage, product, last_quote, ad_id, created_at, updated_at," +
        " psid_cipher, channel, user_hash",
      )
      .gte("created_at", since)
      .order("updated_at", { ascending: false })
      .limit(LEAD_LIMIT),
    supabase
      .from("ins_unanswered")
      .select("id, at, product, intent, question")
      .gte("at", since)
      .order("at", { ascending: false })
      .limit(UNANSWERED_LIMIT),
    supabase.from("ins_usage_ledger").select("cost_thb").gte("created_at", monthStart),
  ]);

  // the select list is long enough that the client infers an error shape rather than the row
  const rows = (conversations.data ?? []) as unknown as ConversationRow[];
  type RawLead = Omit<LeadRow, "has_psid"> & { psid_cipher: unknown; channel: string; user_hash: string };
  const raw = (leads.data ?? []) as unknown as RawLead[];

  /**
   * Which of these threads the bot has stopped in.
   *
   * One query for the whole page rather than one per row, and the hashes themselves stay on
   * this side: what the screen is told is a yes or a no.
   */
  const stopped = await stoppedThreads(raw);
  const leadRows = raw.map(({ psid_cipher, channel, user_hash, ...rest }) => ({
    ...rest,
    has_psid: psid_cipher !== null,
    botStopped: stopped.has(`${channel}:${user_hash}`),
  }));

  return {
    range,
    summary: summarise(rows, range),
    leads: await withNames(leadRows),
    unanswered: (unanswered.data ?? []) as unknown as UnansweredRow[],
    aiCostThisMonth: (spend.data ?? []).reduce((sum, r) => sum + Number(r.cost_thb ?? 0), 0),
  };
}

/**
 * Put a face to each lead, where Meta will still say who they are.
 *
 * Fetched one render at a time and stored nowhere. A lead whose id has been pruned is past
 * being written to anyway, so it is shown by its figures and its date and left at that.
 */
async function withNames(rows: (LeadRow & { botStopped: boolean; psid?: string })[]): Promise<LeadView[]> {
  return Promise.all(rows.map(async (lead) => {
    if (!lead.has_psid) return { ...lead, reachable: false };
    const psid = await psidFor(lead.id);
    if (!psid) return { ...lead, reachable: false };
    const profile = await profileOf(psid);
    return {
      ...lead,
      reachable: true,
      ...(profile?.name ? { name: profile.name } : {}),
      ...(profile?.picture ? { picture: profile.picture } : {}),
    };
  }));
}

/** The page-scoped id behind one lead, decrypted for this render only. */
async function psidFor(leadId: string): Promise<string | null> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  try {
    const { data, error } = await supabaseAdmin()
      .rpc("ins_get_lead_psid", { p_lead: leadId, p_passphrase: secret });
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  } catch (e) {
    console.error("อ่านรหัสลูกค้าไม่สำเร็จ:", e);
    return null;
  }
}

/**
 * The threads on this page the bot has been stopped in, as `channel:user_hash`.
 *
 * `handed_over_at` is stamped when the application form goes out and read past the session's
 * own staleness, so it is the one thing that says whether the bot is still answering — a lead
 * at stage form_sent whose column has since been cleared is a thread the bot has back.
 */
async function stoppedThreads(
  leads: { channel: string; user_hash: string }[],
): Promise<Set<string>> {
  const hashes = [...new Set(leads.map((l) => l.user_hash))];
  if (!hashes.length) return new Set();
  const { data, error } = await supabaseAdmin()
    .from("ins_chat_sessions")
    .select("channel, user_hash, handed_over_at")
    .in("user_hash", hashes)
    .not("handed_over_at", "is", null);
  if (error) {
    console.error("อ่านสถานะบอทไม่สำเร็จ:", error.message);
    return new Set();
  }
  return new Set(((data ?? []) as { channel: string; user_hash: string }[])
    .map((r) => `${r.channel}:${r.user_hash}`));
}

/**
 * Give one thread back to the bot.
 *
 * The silence after an application form does not expire on its own, on purpose: it ends when
 * somebody who knows the application is over says so. This is that button, and it is the only
 * thing that clears the stamp.
 *
 * The lead is named rather than the customer: the hash never leaves this side, and the row
 * being pointed at is one the screen was already showing.
 */
export async function letBotResume(leadId: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = supabaseAdmin();

  const { data, error } = await supabase
    .from("ins_leads")
    .select("channel, user_hash")
    .eq("id", leadId)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  const lead = data as { channel: string; user_hash: string } | null;
  if (!lead) return { ok: false, error: "ไม่พบลูกค้ารายนี้" };

  const cleared = await supabase
    .from("ins_chat_sessions")
    .update({ handed_over_at: null })
    .eq("channel", lead.channel)
    .eq("user_hash", lead.user_hash);
  if (cleared.error) return { ok: false, error: cleared.error.message };
  return { ok: true };
}
