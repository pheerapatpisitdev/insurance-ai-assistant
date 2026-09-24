import { supabaseAdmin } from "@/lib/supabase/admin";
import { monthSpend } from "@/lib/ai/ledger";
import type { ConversationRow, UnansweredRow } from "./types";

/**
 * The reads `/admin` and `/admin/crm` share, so the two pages cannot tell different stories.
 *
 * They did. The front page counted its week as the last 168 hours, called an application
 * "ขอสมัคร" and meant the form going out; the customer page counted seven calendar days,
 * called it "สนใจสมัคร" and meant the customer asking. On the same morning one said 114, 35
 * and the other 107, 32, and the owner had no way to know which to believe. Both now read the
 * rows here and count them with `summarise`.
 *
 * Every read here throws on failure rather than returning nothing. The Supabase client hands
 * an error back in the result instead of raising it, and both pages used to read straight past
 * it — so a failed query drew as zero, with "ยังไม่มีข้อมูล" underneath, which is a false
 * statement about the business rather than an admission that the page could not look.
 */

/**
 * The ledger's model name for money held rather than spent — `RESERVATION_MODEL` in
 * src/lib/ai/ledger.ts, written out here so this file does not depend on the reservation code
 * landing in the same deploy.
 */
const RESERVATION = "reservation";

/** Rows per request, safely under the thousand PostgREST returns without saying it stopped. */
const PAGE = 500;

/** What a read that failed says, before the detail that only a developer needs. */
export const READ_FAILED = "อ่านข้อมูลไม่สำเร็จ";

const CONVERSATION_COLUMNS =
  "id, started_at, last_event_at, product, source, ad_id, ref, priced_at, form_sent_at," +
  " form_done_at, agent_replied_at, stalled_at, handover_at, messages";

/**
 * Every conversation that began at or after `since`, however many there are.
 *
 * Fetched a page at a time. A single select stops at a thousand rows and reports success, and
 * at the rate the page is growing a thirty-day view would have passed that within weeks — a
 * figure that stops rising while looking exactly like one that is rising.
 */
export async function conversationsSince(since: Date): Promise<ConversationRow[]> {
  const out: ConversationRow[] = [];
  const supabase = supabaseAdmin();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("ins_conversations")
      .select(CONVERSATION_COLUMNS)
      .gte("started_at", since.toISOString())
      // a stable order, or a row can fall between two pages when two share a timestamp
      .order("started_at", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`${READ_FAILED} (บทสนทนา): ${error.message}`);
    const rows = (data ?? []) as unknown as ConversationRow[];
    out.push(...rows);
    if (rows.length < PAGE) return out;
  }
}

/** Postgres's code for a column that is not there; PostgREST's for one missing from its cache. */
const COLUMN_MISSING = new Set(["42703", "PGRST204"]);

export interface OpenQuestions {
  /** the newest open questions, at most the limit asked for */
  rows: UnansweredRow[];
  /** how many are open altogether, counted by the database rather than by the rows sent */
  total: number;
  /**
   * Whether a question can be marked answered yet.
   *
   * The column arrives by a migration and this code by a deploy, and nothing orders the two.
   * Until the column is there every question is open — which is what was true before — and
   * the button that could not work is not drawn.
   */
  canMark: boolean;
}

/**
 * The questions the assistant could not answer and nobody has answered since.
 *
 * Not limited to the page's date range: this is a list of work waiting, not a statistic, and
 * a question asked eight days ago is no less waiting for having been asked last week. The
 * table empties itself after thirty days, which is the promise on the privacy page.
 */
export async function openQuestions(limit: number): Promise<OpenQuestions> {
  const supabase = supabaseAdmin();
  const read = (filtered: boolean) => {
    const q = supabase
      .from("ins_unanswered")
      .select("id, at, product, intent, question", { count: "exact" })
      .order("at", { ascending: false })
      .limit(limit);
    return filtered ? q.is("answered_at", null) : q;
  };

  let canMark = true;
  let res = await read(true);
  if (res.error && COLUMN_MISSING.has(res.error.code)) {
    console.error("ins_unanswered.answered_at is not in the database yet; showing every question");
    canMark = false;
    res = await read(false);
  }
  if (res.error) throw new Error(`${READ_FAILED} (คำถามที่ตอบไม่ได้): ${res.error.message}`);
  const rows = (res.data ?? []) as unknown as UnansweredRow[];
  return { rows, total: res.count ?? rows.length, canMark };
}

/**
 * Mark one question answered, so it leaves the list and the front page's count.
 *
 * Nothing is deleted: the owner has answered it, most likely by writing a note the assistant
 * now reads, and the question itself goes when its thirty days are up like every other.
 */
export async function markAnswered(id: number, now = new Date()): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("ins_unanswered")
    .update({ answered_at: now.toISOString() })
    .eq("id", id);
  if (error && COLUMN_MISSING.has(error.code)) {
    throw new Error("ระบบยังไม่พร้อมบันทึกว่าตอบแล้ว — ต้องอัปเดตฐานข้อมูลก่อน");
  }
  if (error) throw new Error(`บันทึกไม่สำเร็จ: ${error.message}`);
}

/**
 * What each advertisement is called, for the ids a page is about to show.
 *
 * The chart and the lead list printed the eighteen-digit id Meta assigns, which is not a thing
 * a person recognises. The daily ads pull keeps each advertisement's name beside its id, so
 * the name is looked up there; the newest day's name wins, because an advertisement can be
 * renamed. An id with no row — an advertisement from an account that is not connected — is
 * simply absent from the answer, and the caller shows the id.
 *
 * Never throws. A name is a courtesy; failing to fetch one must not take the figures with it.
 */
export async function adNames(ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const wanted = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  const names = new Map<string, string>();
  if (!wanted.length) return names;
  const { data, error } = await supabaseAdmin()
    .from("ins_ad_daily")
    .select("ad_id, ad_name, date")
    .in("ad_id", wanted)
    .not("ad_name", "is", null)
    .order("date", { ascending: false })
    .limit(PAGE * 2);
  if (error) {
    console.error("อ่านชื่อโฆษณาไม่สำเร็จ:", error.message);
    return names;
  }
  for (const r of (data ?? []) as { ad_id: string; ad_name: string | null }[]) {
    if (r.ad_name && !names.has(r.ad_id)) names.set(r.ad_id, r.ad_name);
  }
  return names;
}

/**
 * What the models have cost since `since`, in baht, reservations left out.
 *
 * `monthSpend` takes any starting moment despite its name, and every range on these pages
 * ends now, so it answers "since the start of the range" as readily as "since the first of
 * the month". A reservation is money held for a request still running, not money spent.
 */
export async function aiSpendSince(since: Date): Promise<number> {
  const spend = await monthSpend(since);
  return spend.lines
    .filter((l) => l.model !== RESERVATION)
    .reduce((s, l) => s + l.baht, 0);
}
