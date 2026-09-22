import { describe, expect, it, vi } from "vitest";
import { ADS_PENDING_KEY, adAccountIdInKey, adsKeyFor, isAdsKey, keyFor, pageIdInKey } from "@/lib/facebook/keys";

/**
 * Ad accounts and Pages share one table of encrypted tokens. The rows must not be mistaken
 * for one another: a Page listing that showed an ad account would offer to "refresh the
 * subscription" of something that has no inbox.
 */

describe("the shape of an ad-account key", () => {
  it("is told apart from a Page key", () => {
    expect(adsKeyFor("act_123")).toBe("facebook_ads:act_123");
    expect(isAdsKey("facebook_ads:act_123")).toBe(true);
    expect(isAdsKey(ADS_PENDING_KEY)).toBe(true);
    expect(isAdsKey(keyFor("123"))).toBe(false);
    expect(isAdsKey("facebook")).toBe(false);
  });

  it("gives the account id back, and no Page id", () => {
    expect(adAccountIdInKey("facebook_ads:act_123")).toBe("act_123");
    expect(adAccountIdInKey("facebook:123")).toBeUndefined();
    expect(pageIdInKey("facebook_ads:act_123")).toBeUndefined();
  });
});

describe("the Page listing", () => {
  it("does not list an ad account as a Page", async () => {
    vi.doMock("@/lib/supabase/admin", () => ({
      supabaseAdmin: () => ({
        from: () => ({
          select: () => ({
            order: async () => ({
              data: [
                { key: "facebook:1", page_id: "1", page_name: "เพจ", scopes: [], fields: [], updated_at: "2026-09-22T00:00:00Z" },
                { key: "facebook_ads:act_9", page_id: "act_9", page_name: "บัญชีโฆษณา", scopes: ["ads_read"], fields: [], updated_at: "2026-09-22T00:00:00Z" },
              ],
              error: null,
            }),
          }),
        }),
      }),
    }));
    const { pageConnections } = await import("@/lib/facebook/connection");
    const pages = await pageConnections();
    expect(pages.map((p) => p.pageId)).toEqual(["1"]);
  });
});
