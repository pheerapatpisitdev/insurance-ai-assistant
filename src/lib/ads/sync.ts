import { supabaseAdmin } from "@/lib/supabase/admin";
import { adAccountToken, adAccounts } from "@/lib/facebook/ads-connection";
import { INSIGHT_FIELDS, dailyRowFromInsight, isExpiredToken, type Insight } from "./insights";
import type { DailyRow } from "./types";

/**
 * Pulls the last few days of every connected ad account into `ins_ad_daily`.
 *
 * Three days rather than one, every time: Meta keeps revising a day's figures for a while
 * after it ends (late conversions, removed clicks), so yesterday fetched once is yesterday
 * slightly wrong. Fetching a short window and writing over the same rows is what keeps the
 * table honest, and the window is short enough that the daily run costs a handful of calls.
 *
 * One account's failure is reported and the next account is still fetched. The likeliest
 * failure is the token expiring — Meta's error 190 — and the message for it says what to do.
 */

const GRAPH = "https://graph.facebook.com/v23.0";
const EXPIRED = "token หมดอายุ กดเชื่อมบัญชีโฆษณาใหม่";

export interface SyncResult {
  accounts: number;
  rows: number;
  errors: { actId: string; name: string; message: string }[];
}

/** A calendar day as `YYYY-MM-DD` in UTC — Meta reads `time_range` as dates, not instants. */
function day(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function* insights(actId: string, token: string, since: string, until: string, fetchFn: typeof fetch): AsyncGenerator<Insight> {
  const params = new URLSearchParams({
    level: "ad",
    time_increment: "1",
    time_range: JSON.stringify({ since, until }),
    fields: INSIGHT_FIELDS.join(","),
    limit: "500",
  });
  let url: string | undefined = `${GRAPH}/${actId}/insights?${params}`;
  while (url) {
    const res = await fetchFn(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store" });
    const body = (await res.json()) as { data?: Insight[]; paging?: { next?: string }; error?: { code?: number; message?: string } };
    if (!res.ok || body.error) {
      if (isExpiredToken(body.error)) throw new Error(EXPIRED);
      throw new Error(body.error?.message ?? `insights ${res.status}`);
    }
    for (const i of body.data ?? []) yield i;
    url = body.paging?.next;
  }
}

export async function syncAds(opts: { days?: number; now?: Date; fetchFn?: typeof fetch } = {}): Promise<SyncResult> {
  const days = opts.days ?? 3;
  const now = opts.now ?? new Date();
  const fetchFn = opts.fetchFn ?? fetch;
  const fetchedAt = now.toISOString();
  const until = day(now);
  const since = day(new Date(now.getTime() - (days - 1) * 86_400_000));

  const accounts = await adAccounts();
  const result: SyncResult = { accounts: accounts.length, rows: 0, errors: [] };

  for (const account of accounts) {
    try {
      const token = await adAccountToken(account.id);
      if (!token) throw new Error(EXPIRED);
      const rows: DailyRow[] = [];
      for await (const i of insights(account.id, token, since, until, fetchFn)) {
        rows.push(dailyRowFromInsight(i, fetchedAt, account.id));
      }
      if (rows.length > 0) {
        const { error } = await supabaseAdmin().from("ins_ad_daily").upsert(rows, { onConflict: "date,ad_id" });
        if (error) throw new Error(error.message);
      }
      result.rows += rows.length;
    } catch (e) {
      result.errors.push({ actId: account.id, name: account.name, message: e instanceof Error ? e.message : String(e) });
    }
  }
  return result;
}
