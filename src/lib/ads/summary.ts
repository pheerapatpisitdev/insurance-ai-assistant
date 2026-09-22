import type { AdConversation, AdLead, AdSummary, AdsSummary, CampaignSummary, DailyRow, Tally } from "./types";

/**
 * Every figure the ADS page shows, as a function of the rows behind it.
 *
 * No database, no clock, no React — the same rule as the CRM's summary, for the same reason:
 * a page whose purpose is saying where the advertising money went is a page whose numbers
 * have to be checkable without looking at it.
 *
 * Two sources meet here. Meta's rows say what each advertisement cost and how many people it
 * reached; the CRM's rows say who actually arrived, quoted and applied, keyed by the same
 * ad_id the referral carried in. A customer whose advertisement has no figures in the window
 * (an old advertisement, or one paused before the window began) is still a customer, and is
 * shown under a catch-all campaign rather than dropped.
 */

/** The campaign that holds customers whose advertisement has no figures in the window. */
export const OTHER_CAMPAIGN = "other";
const OTHER_NAME = "โฆษณาอื่น (ไม่มีตัวเลขค่าใช้จ่ายในช่วงนี้)";

function tally(): Tally {
  return { spend: 0, reach: 0, linkClicks: 0, messagingStarted: 0, leads: 0, priced: 0, formSent: 0, costPerLead: null };
}

function addRow(into: Tally, r: DailyRow): void {
  into.spend += r.spend;
  into.reach += r.reach;
  into.linkClicks += r.link_clicks;
  into.messagingStarted += r.messaging_started;
}

function addCrm(into: Tally, leads: number, priced: number, formSent: number): void {
  into.leads += leads;
  into.priced += priced;
  into.formSent += formSent;
}

function settle(t: Tally): void {
  t.costPerLead = t.leads > 0 && t.spend > 0 ? t.spend / t.leads : null;
}

function count<T>(items: T[], key: (t: T) => string, when: (t: T) => boolean = () => true): Map<string, number> {
  const m = new Map<string, number>();
  for (const it of items) if (when(it)) m.set(key(it), (m.get(key(it)) ?? 0) + 1);
  return m;
}

export function summariseAds(rows: DailyRow[], leads: AdLead[], conversations: AdConversation[]): AdsSummary {
  const leadsByAd = count(leads, (l) => l.ad_id);
  const pricedByAd = count(conversations, (c) => c.ad_id, (c) => Boolean(c.priced_at));
  const formByAd = count(conversations, (c) => c.ad_id, (c) => Boolean(c.form_sent_at));

  /** ad → its figures over the window, and the campaign it belongs to */
  const ads = new Map<string, { ad: AdSummary; campaignId: string; campaignName: string; accountId: string | null }>();
  for (const r of rows) {
    let entry = ads.get(r.ad_id);
    if (!entry) {
      entry = {
        ad: { adId: r.ad_id, name: r.ad_name ?? r.ad_id, ...tally() },
        // an advertisement without a campaign is its own campaign; Meta does not do this,
        // but a row written by hand might
        campaignId: r.campaign_id ?? r.ad_id,
        campaignName: r.campaign_name ?? r.ad_name ?? r.ad_id,
        accountId: r.account_id,
      };
      ads.set(r.ad_id, entry);
    }
    addRow(entry.ad, r);
  }

  const crmAdIds = new Set([...leadsByAd.keys(), ...pricedByAd.keys(), ...formByAd.keys()]);
  for (const adId of crmAdIds) {
    if (!ads.has(adId)) {
      ads.set(adId, { ad: { adId, name: adId, ...tally() }, campaignId: OTHER_CAMPAIGN, campaignName: OTHER_NAME, accountId: null });
    }
  }

  const campaigns = new Map<string, CampaignSummary>();
  const total = tally();
  for (const { ad, campaignId, campaignName, accountId } of ads.values()) {
    addCrm(ad, leadsByAd.get(ad.adId) ?? 0, pricedByAd.get(ad.adId) ?? 0, formByAd.get(ad.adId) ?? 0);
    settle(ad);

    let c = campaigns.get(campaignId);
    if (!c) {
      c = { campaignId, name: campaignName, accountId, ads: [], ...tally() };
      campaigns.set(campaignId, c);
    }
    c.ads.push(ad);
    c.spend += ad.spend; c.reach += ad.reach; c.linkClicks += ad.linkClicks; c.messagingStarted += ad.messagingStarted;
    addCrm(c, ad.leads, ad.priced, ad.formSent);

    total.spend += ad.spend; total.reach += ad.reach; total.linkClicks += ad.linkClicks; total.messagingStarted += ad.messagingStarted;
    addCrm(total, ad.leads, ad.priced, ad.formSent);
  }
  settle(total);

  const list = [...campaigns.values()];
  for (const c of list) {
    settle(c);
    c.ads.sort((a, b) => b.spend - a.spend);
  }
  list.sort((a, b) => {
    if (a.campaignId === OTHER_CAMPAIGN) return 1;
    if (b.campaignId === OTHER_CAMPAIGN) return -1;
    return b.spend - a.spend;
  });

  const currency = rows.find((r) => r.currency)?.currency ?? null;
  return { total, campaigns: list, currency };
}
