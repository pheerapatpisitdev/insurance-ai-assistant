import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Attribution } from "@/lib/facebook/events";
import type { Channel } from "./session";

/**
 * What the bot remembers about a conversation, written after the customer has been answered
 * and never in the way of answering them.
 *
 * The session store keeps the last six turns for a day so the bot can follow a thread. This
 * keeps the story of the conversation for longer, and keeps it without the words: which
 * advert it came from, that a premium was given and what it was, that the form went out,
 * that the agent stepped in. The customer's identity sits on the conversation row alone and
 * is taken off it after ninety days; the events never carry it.
 *
 * Every function here swallows its own failure. A record that cannot be written is logged,
 * and the customer, who has already been answered, is none the wiser.
 */

/** The kinds of thing that happen in a conversation, as the record names them. */
export type EventKind =
  | "started" | "referral" | "message"
  | "routed" | "quoted" | "no_price" | "value_table" | "cheaper" | "offer_taken" | "pay_term"
  | "company" | "faq" | "plan_info" | "small_talk" | "handover" | "form_sent" | "form_done" | "stalled"
  | "menu" | "other_plans" | "full_table" | "territory" | "asked_which"
  | "agent_replied" | "rate_limited" | "budget_exceeded" | "error";

export interface CollectedEvent {
  kind: EventKind;
  /** kinds and figures only, never a word the customer typed */
  data?: Record<string, unknown>;
}

/** A question the bot had no written answer for, as the model's stand-alone rewrite. */
export interface Unanswered {
  intent: string;
  route: "model" | "handover";
  question: string;
}

/** How far a lead has got, as far as the bot can tell; the agent takes it from here. */
export type LeadStage = "interested" | "form_sent" | "form_done";

/** The same passphrase that seals the page token, so one secret guards every cipher in the tables. */
function passphrase(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

/**
 * A new conversation, carrying where it came from. Returns its id, or null when the database
 * would not take it — in which case this turn goes unrecorded and the customer is answered
 * all the same.
 */
export async function openConversation(c: {
  channel: Channel;
  userHash: string;
  pageId?: string;
  referral?: Attribution;
  /** the text of the button that opened the thread, which is the advert's words and not the customer's */
  entryPayload?: string;
}): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin().rpc("ins_open_conversation", {
      p_channel: c.channel,
      p_page_id: c.pageId ?? null,
      p_user_hash: c.userHash,
      p_source: c.referral?.source ?? "organic",
      p_ad_id: c.referral?.adId ?? null,
      p_ref: c.referral?.ref ?? null,
      p_referral: c.referral?.raw ?? null,
      p_entry_payload: c.entryPayload ?? null,
    });
    if (error) throw new Error(error.message);
    return typeof data === "string" ? data : null;
  } catch (e) {
    console.error("collect: could not open a conversation:", e);
    return null;
  }
}

/**
 * A referral arriving on a conversation already under way: the customer tapped another
 * advert, or the advert's referral event landed after the message it came with. The first
 * source a conversation has stays its source; one that started with none takes this one.
 */
export async function attribute(conversationId: string, referral: Attribution): Promise<void> {
  try {
    const { error } = await supabaseAdmin().rpc("ins_attribute", {
      p_conversation: conversationId,
      p_source: referral.source,
      p_ad_id: referral.adId ?? null,
      p_ref: referral.ref ?? null,
      p_referral: referral.raw,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("collect: could not attribute a conversation:", e);
  }
}

/** One turn's events, and any question the bot had no written answer for, in one round trip. */
export async function record(
  conversationId: string, events: CollectedEvent[], product: string | null, unanswered: Unanswered[] = [],
): Promise<void> {
  if (events.length === 0 && unanswered.length === 0) return;
  try {
    const { error } = await supabaseAdmin().rpc("ins_record", {
      p_conversation: conversationId,
      p_events: events,
      p_product: product,
      p_unanswered: unanswered,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("collect: could not record the turn:", e);
  }
}

/**
 * The customer has asked to apply, or to talk to a person: they are a lead, and the agent
 * needs to find them. The thread id is stored encrypted, on this row alone, so the back
 * office can reopen the chat; the last premium the bot gave is copied from the record so the
 * agent sees what was offered. Opening a lead twice moves it forward, never back.
 */
export async function openLead(l: {
  conversationId: string;
  psid: string;
  stage: LeadStage;
  product: string | null;
  formRef?: string;
}): Promise<void> {
  try {
    const { error } = await supabaseAdmin().rpc("ins_open_lead", {
      p_conversation: l.conversationId,
      p_psid: l.psid,
      p_passphrase: passphrase(),
      p_stage: l.stage,
      p_product: l.product,
      p_form_ref: l.formRef ?? null,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("collect: could not open a lead:", e);
  }
}

/**
 * The short code that rides on the application form link, so a filled-in form can be
 * matched back to the conversation it came from. Ten hex characters of the conversation id:
 * enough that two conversations will not share one, short enough to survive a link.
 */
export function formRefOf(conversationId: string): string {
  return conversationId.replace(/-/g, "").slice(0, 10);
}
