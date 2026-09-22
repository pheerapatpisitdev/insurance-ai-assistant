import { describe, expect, it } from "vitest";
import { dailyRowFromInsight, isExpiredToken, MESSAGING_STARTED } from "@/lib/ads/insights";

/**
 * Meta answers in strings and in a list of typed actions. The row the table keeps is numbers
 * in named columns, so what the page sums is what was fetched — not what a later reading of
 * a JSON blob decided the numbers must have been.
 */

const AT = "2026-09-22T03:00:00.000Z";

describe("an insight becomes a row", () => {
  it("reads every figure, and the chats started out of the actions", () => {
    const row = dailyRowFromInsight({
      date_start: "2026-09-21", date_stop: "2026-09-21",
      ad_id: "1", ad_name: "Life Protect", adset_id: "2", adset_name: "กว้าง", campaign_id: "3", campaign_name: "ก.ย.",
      spend: "123.45", impressions: "1000", reach: "800", clicks: "40", inline_link_clicks: "30",
      actions: [{ action_type: "link_click", value: "30" }, { action_type: MESSAGING_STARTED, value: "7" }],
      account_currency: "THB",
    }, AT, "act_1");
    expect(row).toEqual({
      date: "2026-09-21", ad_id: "1", account_id: "act_1", ad_name: "Life Protect", adset_id: "2", adset_name: "กว้าง",
      campaign_id: "3", campaign_name: "ก.ย.",
      spend: 123.45, impressions: 1000, reach: 800, clicks: 40, link_clicks: 30, messaging_started: 7,
      actions: [{ action_type: "link_click", value: "30" }, { action_type: MESSAGING_STARTED, value: "7" }],
      currency: "THB", fetched_at: AT,
    });
  });

  it("counts nothing for what Meta left out", () => {
    const row = dailyRowFromInsight({ date_start: "2026-09-21", date_stop: "2026-09-21", ad_id: "1" }, AT);
    // no account named is null rather than a guess — the rows written before the column
    // existed have none either, and the page must read the two the same way
    expect(row.account_id).toBeNull();
    expect(row.spend).toBe(0);
    expect(row.messaging_started).toBe(0);
    expect(row.link_clicks).toBe(0);
    expect(row.ad_name).toBeNull();
    expect(row.actions).toEqual([]);
  });
});

describe("a token that has run out", () => {
  it("is recognised by Meta's code, not by its wording", () => {
    expect(isExpiredToken({ code: 190, message: "Error validating access token" })).toBe(true);
    expect(isExpiredToken({ code: 100, message: "Unsupported get request" })).toBe(false);
    expect(isExpiredToken(undefined)).toBe(false);
  });
});
