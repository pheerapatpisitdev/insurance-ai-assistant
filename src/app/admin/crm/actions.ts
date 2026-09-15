"use server";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { rangeStart, summarise } from "@/lib/crm/summary";
import { profileOf } from "@/lib/facebook/profile";
import type { ConversationRow, LeadRow, Range, Summary, UnansweredRow } from "@/lib/crm/types";

/**
 * Everything `/admin/crm` shows, read once.
 *
 * `requireAdmin()` is called here and not only in the layout. A server action is a network
 * entry point of its own, and the guard on a layout protects the page's HTML rather than the
 * function anyone can invoke — which is exactly the shape of the finding filed against
 * `loadAiPage()`, and not one to copy twice.
 */

/** How many leads a page shows at once; enough to work through, few enough to fetch names for. */
const LEAD_LIMIT = 50;
const UNANSWERED_LIMIT = 50;

export interface LeadView extends LeadRow {
  /** borrowed from Meta for this render; absent when Meta would not say or the id is gone */
  name?: string;
  picture?: string;
  /** whether this person can still be written to at all */
  reachable: boolean;
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
  await requireAdmin();

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
      .select("id, conversation_id, stage, product, last_quote, ad_id, created_at, updated_at, psid_cipher")
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
  const leadRows = ((leads.data ?? []) as unknown as (Omit<LeadRow, "has_psid"> & { psid_cipher: unknown })[])
    .map(({ psid_cipher, ...rest }) => ({ ...rest, has_psid: psid_cipher !== null }));

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
async function withNames(rows: (LeadRow & { psid?: string })[]): Promise<LeadView[]> {
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
