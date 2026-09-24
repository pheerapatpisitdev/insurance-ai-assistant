import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * What the models have cost since a moment, summed in the database.
 *
 * It used to be summed here, from rows, and the client library returns at most a thousand rows
 * of any select without saying so. On 2026-09-22 the spend card read exactly 1,000 calls at
 * ฿29.68 against a table holding 1,180 at ฿34.54 — and the budget guard, reading the same way,
 * was comparing the owner's ceiling to a figure that had stopped rising. Past a thousand
 * calls a month, which this system reached in three weeks, the budget protected nothing.
 *
 * So the sum is asked for as a sum. One line per model and task is enough for every reader:
 * the guard wants the total, the card wants who was paid and for what.
 */

/** one model, one task, everything it cost since the moment asked about */
export interface SpendLine {
  model: string | null;
  task: string | null;
  calls: number;
  baht: number;
}

export interface MonthSpend {
  calls: number;
  baht: number;
  lines: SpendLine[];
}

/** Thailand keeps UTC+7 all year; the same constant as src/lib/content/calendar.ts */
const BKK_MS = 7 * 60 * 60_000;

/**
 * The first instant of the current calendar month in Thailand.
 *
 * It was the server's clock, and the server runs in UTC: from 00:00 to 07:00 on the 1st the
 * owner's new month was still the old one here, and the ceilings they set by the Thai month
 * reset seven hours late.
 */
export function monthStart(now = new Date()): Date {
  const bkk = new Date(now.getTime() + BKK_MS);
  return new Date(Date.UTC(bkk.getUTCFullYear(), bkk.getUTCMonth(), 1) - BKK_MS);
}

/** PostgREST's code for a function it cannot find; the one error worth reading past */
const FUNCTION_MISSING = "PGRST202";

/** rows per page when paging; well under the library's own cap so a page is never clipped */
const PAGE = 500;

export async function monthSpend(since: Date): Promise<MonthSpend> {
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.rpc("ins_month_spend", { p_since: since.toISOString() });
  if (error && error.code === FUNCTION_MISSING) {
    console.error("ins_month_spend is not in the database yet; paging the ledger instead");
    return total(await paged(since));
  }
  if (error) throw new Error(`อ่านค่าใช้จ่าย AI ไม่ได้: ${error.message}`);
  const rows = (data ?? []) as { model: string | null; task: string | null; calls: number | string; cost_thb: number | string | null }[];
  return total(rows.map((r) => ({ model: r.model, task: r.task, calls: Number(r.calls), baht: Number(r.cost_thb ?? 0) })));
}

function total(lines: SpendLine[]): MonthSpend {
  return {
    calls: lines.reduce((n, l) => n + l.calls, 0),
    baht: lines.reduce((s, l) => s + l.baht, 0),
    lines,
  };
}

/**
 * The same figures without the function: every row, a page at a time, summed here.
 *
 * The function arrives by a migration and this code by a deploy, and nothing orders the two.
 * Slower, and exact, which is the only property that matters for a budget.
 */
async function paged(since: Date): Promise<SpendLine[]> {
  const supabase = supabaseAdmin();
  const acc = new Map<string, SpendLine>();
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("ins_usage_ledger")
      .select("model, task, cost_thb")
      .gte("created_at", since.toISOString())
      .order("created_at")
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`อ่านค่าใช้จ่าย AI ไม่ได้: ${error.message}`);
    const rows = (data ?? []) as { model: string | null; task: string | null; cost_thb: number | null }[];
    for (const r of rows) {
      const key = `${r.model ?? ""}${r.task ?? ""}`;
      const line = acc.get(key) ?? { model: r.model, task: r.task, calls: 0, baht: 0 };
      line.calls += 1;
      line.baht += Number(r.cost_thb ?? 0);
      acc.set(key, line);
    }
    if (rows.length < PAGE) break;
  }
  return [...acc.values()];
}
