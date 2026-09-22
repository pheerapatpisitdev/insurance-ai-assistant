import type { DailyRow } from "./types";

/**
 * Meta's insight for one advertisement on one day, as the Graph API returns it: every number
 * a string, and the conversions in a list keyed by type.
 */
export interface Insight {
  date_start: string;
  date_stop: string;
  ad_id: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  spend?: string;
  impressions?: string;
  reach?: string;
  clicks?: string;
  inline_link_clicks?: string;
  actions?: { action_type: string; value: string }[];
  account_currency?: string;
}

/**
 * The action Meta counts when somebody opens a Messenger thread from an advertisement.
 * The 7d suffix is Meta's attribution window, not ours: it is the name of the metric.
 */
export const MESSAGING_STARTED = "onsite_conversion.messaging_conversation_started_7d";

/** The fields the sync asks for. One list, so the request and the row cannot disagree. */
export const INSIGHT_FIELDS = [
  "ad_id", "ad_name", "adset_id", "adset_name", "campaign_id", "campaign_name",
  "spend", "impressions", "reach", "clicks", "inline_link_clicks", "actions", "account_currency",
];

function num(v: string | undefined): number {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export function dailyRowFromInsight(i: Insight, fetchedAt: string, accountId: string | null = null): DailyRow {
  const actions = i.actions ?? [];
  const started = actions.find((a) => a.action_type === MESSAGING_STARTED);
  return {
    date: i.date_start,
    ad_id: i.ad_id,
    account_id: accountId,
    ad_name: i.ad_name ?? null,
    adset_id: i.adset_id ?? null,
    adset_name: i.adset_name ?? null,
    campaign_id: i.campaign_id ?? null,
    campaign_name: i.campaign_name ?? null,
    spend: num(i.spend),
    impressions: num(i.impressions),
    reach: num(i.reach),
    clicks: num(i.clicks),
    link_clicks: num(i.inline_link_clicks),
    messaging_started: num(started?.value),
    actions,
    currency: i.account_currency ?? null,
    fetched_at: fetchedAt,
  };
}

/** Meta's error 190 is the token itself: expired, revoked, or the password changed. */
export function isExpiredToken(err: { code?: number; message?: string } | undefined): boolean {
  return err?.code === 190;
}
