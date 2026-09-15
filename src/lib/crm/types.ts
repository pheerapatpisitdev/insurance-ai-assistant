/**
 * The rows the report reads, and the figures it turns them into.
 *
 * These mirror the columns of `ins_conversations`, `ins_leads` and `ins_unanswered` rather
 * than inventing a shape of their own, so that what the page asks the database for and what
 * it does with the answer can be read side by side.
 */

/** One conversation, as the page needs it. */
export interface ConversationRow {
  id: string;
  started_at: string;
  last_event_at: string | null;
  product: string | null;
  source: string | null;
  ad_id: string | null;
  ref: string | null;
  priced_at: string | null;
  form_sent_at: string | null;
  form_done_at: string | null;
  agent_replied_at: string | null;
  stalled_at: string | null;
  handover_at: string | null;
  messages: number | null;
}

/**
 * One lead, as the page needs it.
 *
 * `has_psid` and not the cipher: the page asks whether this person can still be written to,
 * and the encrypted id itself has no business travelling to a React tree to answer that.
 */
export interface LeadRow {
  id: string;
  conversation_id: string;
  stage: string;
  product: string | null;
  last_quote: Record<string, unknown> | null;
  ad_id: string | null;
  created_at: string;
  updated_at: string;
  has_psid: boolean;
}

/** A question the bot had no written answer for, as the model rewrote it. */
export interface UnansweredRow {
  id: number;
  at: string;
  product: string | null;
  intent: string | null;
  question: string;
}

/** How far back the page is looking. */
export type Range = "today" | "7d" | "30d";

/** The plan a conversation settled on, or the bucket for one that never did. */
export const UNDECIDED = "undecided";

export interface Counts {
  /** conversations that began */
  arrived: number;
  /** conversations the bot answered more than once in — it got somewhere */
  told: number;
  /** conversations a premium was named in */
  priced: number;
  /** conversations where the customer asked to apply */
  interested: number;
  /** conversations where the form came back */
  formDone: number;
  /** conversations that went silent after the last follow-up */
  stalled: number;
  /** conversations an agent answered by hand */
  agentReplied: number;
}

export interface Summary {
  counts: Counts;
  /** the same figures again, one entry per plan, busiest first */
  byProduct: { product: string; counts: Counts }[];
  /** one entry per day of the range, zero-filled, oldest first */
  byDay: { date: string; arrived: number; priced: number; interested: number }[];
  /** twenty-four entries, midnight to midnight */
  byHour: { hour: number; arrived: number }[];
  /** the advertisements that brought anyone, busiest first */
  byAd: { adId: string; arrived: number; interested: number }[];
}
