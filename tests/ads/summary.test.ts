import { describe, expect, it } from "vitest";
import { OTHER_CAMPAIGN, summariseAds } from "@/lib/ads/summary";
import type { AdConversation, AdLead, DailyRow } from "@/lib/ads/types";

/**
 * Every figure on /admin/ads comes out of here, with no database and no clock. A wrong
 * number is caught by a test rather than by the owner wondering why a campaign that cost
 * three thousand baht shows nobody.
 */

function row(ad: string, date: string, over: Partial<DailyRow> = {}): DailyRow {
  return {
    date, ad_id: ad, ad_name: `ad ${ad}`, adset_id: "s", adset_name: "set",
    campaign_id: "c1", campaign_name: "แคมเปญหนึ่ง",
    spend: 0, impressions: 0, reach: 0, clicks: 0, link_clicks: 0, messaging_started: 0,
    actions: [], currency: "THB", fetched_at: "2026-09-22T03:00:00.000Z", ...over,
  };
}
const lead = (ad: string): AdLead => ({ ad_id: ad });
const conv = (ad: string, over: Partial<AdConversation> = {}): AdConversation => ({ ad_id: ad, priced_at: null, form_sent_at: null, ...over });

describe("summing the advertising", () => {
  it("adds the days of one advertisement together, and the advertisements of one campaign", () => {
    const s = summariseAds(
      [
        row("a", "2026-09-20", { spend: 100, reach: 50, link_clicks: 5, messaging_started: 2 }),
        row("a", "2026-09-21", { spend: 150, reach: 70, link_clicks: 6, messaging_started: 3 }),
        row("b", "2026-09-21", { spend: 260, reach: 100, link_clicks: 10, messaging_started: 4 }),
      ],
      [lead("a"), lead("a"), lead("b")],
      [conv("a", { priced_at: "x" }), conv("a"), conv("b", { priced_at: "x", form_sent_at: "y" })],
    );
    expect(s.total).toEqual({ spend: 510, reach: 220, linkClicks: 21, messagingStarted: 9, leads: 3, priced: 2, formSent: 1, costPerLead: 510 / 3 });
    expect(s.campaigns).toHaveLength(1);
    const c = s.campaigns[0];
    expect(c.campaignId).toBe("c1");
    expect(c.name).toBe("แคมเปญหนึ่ง");
    expect(c.spend).toBe(510);
    expect(c.leads).toBe(3);
    expect(c.ads.map((a) => [a.adId, a.spend, a.leads, a.costPerLead])).toEqual([["b", 260, 1, 260], ["a", 250, 2, 125]]);
    expect(s.currency).toBe("THB");
  });

  it("orders campaigns by what they cost, most first", () => {
    const s = summariseAds(
      [row("a", "2026-09-21", { campaign_id: "c1", spend: 10 }), row("b", "2026-09-21", { campaign_id: "c2", campaign_name: "สอง", spend: 20 })],
      [], [],
    );
    expect(s.campaigns.map((c) => c.campaignId)).toEqual(["c2", "c1"]);
  });

  it("says nothing per customer when there were none", () => {
    const s = summariseAds([row("a", "2026-09-21", { spend: 99 })], [], []);
    expect(s.total.costPerLead).toBeNull();
    expect(s.campaigns[0].costPerLead).toBeNull();
  });

  it("keeps a customer whose advertisement has no figures in the window", () => {
    const s = summariseAds([row("a", "2026-09-21", { spend: 10 })], [lead("a"), lead("old")], [conv("old", { priced_at: "x" })]);
    const other = s.campaigns.find((c) => c.campaignId === OTHER_CAMPAIGN);
    expect(other).toBeDefined();
    expect(other!.leads).toBe(1);
    expect(other!.priced).toBe(1);
    expect(other!.spend).toBe(0);
    expect(other!.costPerLead).toBeNull();
    expect(other!.ads.map((a) => a.adId)).toEqual(["old"]);
    // and the total still counts them
    expect(s.total.leads).toBe(2);
    // the catch-all comes last however little the real campaigns cost
    expect(s.campaigns[s.campaigns.length - 1].campaignId).toBe(OTHER_CAMPAIGN);
  });

  it("files an advertisement Meta gave no campaign under its own id", () => {
    const s = summariseAds([row("a", "2026-09-21", { campaign_id: null, campaign_name: null, spend: 5 })], [], []);
    expect(s.campaigns[0].campaignId).toBe("a");
    expect(s.campaigns[0].name).toBe("ad a");
  });

  it("is empty without pretending otherwise", () => {
    const s = summariseAds([], [], []);
    expect(s.total.spend).toBe(0);
    expect(s.campaigns).toEqual([]);
    expect(s.currency).toBeNull();
  });
});
