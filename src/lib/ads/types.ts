/** One advertisement on one day, as `ins_ad_daily` keeps it. */
export interface DailyRow {
  date: string;
  ad_id: string;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  campaign_id: string | null;
  campaign_name: string | null;
  spend: number;
  impressions: number;
  reach: number;
  clicks: number;
  link_clicks: number;
  messaging_started: number;
  actions: unknown;
  currency: string | null;
  fetched_at: string;
}

/** What the CRM knows about a customer who came from an advertisement. */
export interface AdLead {
  ad_id: string;
}

export interface AdConversation {
  ad_id: string;
  priced_at: string | null;
  form_sent_at: string | null;
}

/** The figures every row of the table and its total share. */
export interface Tally {
  spend: number;
  reach: number;
  linkClicks: number;
  messagingStarted: number;
  leads: number;
  priced: number;
  formSent: number;
  /** baht per customer in the CRM; nothing when there were none */
  costPerLead: number | null;
}

export interface AdSummary extends Tally {
  adId: string;
  name: string;
}

export interface CampaignSummary extends Tally {
  campaignId: string;
  name: string;
  ads: AdSummary[];
}

export interface AdsSummary {
  total: Tally;
  campaigns: CampaignSummary[];
  currency: string | null;
}

/** The two windows the page offers. "today" is not one: Meta's figures for today are not settled. */
export type AdsRange = "7d" | "30d";
