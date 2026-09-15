import { describe, expect, it } from "vitest";
import { rangeStart, summarise } from "@/lib/crm/summary";
import type { ConversationRow } from "@/lib/crm/types";

/**
 * The figures the page shows, checked without a database.
 *
 * Every number on the report comes out of `summarise`, so this is where a wrong one is caught
 * — not in a React tree, and not by looking at a chart and thinking it seems about right.
 */

function conv(id: string, at: string, reached: Partial<ConversationRow> = {}): ConversationRow {
  return {
    id, started_at: at, last_event_at: at, product: "lifeprotect",
    source: "organic", ad_id: null, ref: null,
    priced_at: null, form_sent_at: null, form_done_at: null,
    agent_replied_at: null, stalled_at: null, handover_at: null,
    messages: 1, ...reached,
  };
}

const D1 = "2026-09-14T03:00:00.000Z";
const D2 = "2026-09-15T04:00:00.000Z";
const NOW = new Date(D2);

describe("counting what happened", () => {
  it("counts nothing without pretending there is something", () => {
    const s = summarise([], "7d", NOW);
    expect(s.counts).toEqual({
      arrived: 0, told: 0, priced: 0, interested: 0, formDone: 0, stalled: 0, agentReplied: 0,
    });
    expect(s.byDay).toHaveLength(7);
    expect(s.byDay.every((d) => d.arrived === 0)).toBe(true);
  });

  it("counts an arrival for every conversation", () => {
    expect(summarise([conv("a", D2), conv("b", D2)], "7d", NOW).counts.arrived).toBe(2);
  });

  it("counts a quotation only where one was stamped", () => {
    const s = summarise([conv("a", D2, { priced_at: D2 }), conv("b", D2)], "7d", NOW);
    expect(s.counts.priced).toBe(1);
  });

  it("counts someone who asked to apply by the milestone, not by the lead", () => {
    expect(summarise([conv("a", D2, { handover_at: D2 })], "7d", NOW).counts.interested).toBe(1);
  });

  it("counts a conversation that reached the form all the way through", () => {
    const rows = [conv("a", D2, { priced_at: D2, form_sent_at: D2, form_done_at: D2, handover_at: D2 })];
    expect(summarise(rows, "7d", NOW).counts).toMatchObject({
      arrived: 1, priced: 1, interested: 1, formDone: 1,
    });
  });

  it("counts a person the bot answered but never priced as told, not priced", () => {
    const s = summarise([conv("a", D2, { messages: 4 })], "7d", NOW);
    expect(s.counts.told).toBe(1);
    expect(s.counts.priced).toBe(0);
  });

  it("does not count someone who wrote once and was never answered as told", () => {
    expect(summarise([conv("a", D2, { messages: 1 })], "7d", NOW).counts.told).toBe(0);
  });

  it("counts the silence after the last follow-up, and the agent stepping in", () => {
    const rows = [conv("a", D2, { stalled_at: D2 }), conv("b", D2, { agent_replied_at: D2 })];
    const s = summarise(rows, "7d", NOW);
    expect(s.counts.stalled).toBe(1);
    expect(s.counts.agentReplied).toBe(1);
  });
});

describe("splitting by plan", () => {
  it("keeps each plan's figures apart", () => {
    const rows = [
      conv("a", D2, { product: "lifeprotect", priced_at: D2 }),
      conv("b", D2, { product: "ihealthy" }),
      conv("c", D2, { product: "ihealthy", priced_at: D2, handover_at: D2 }),
    ];
    const s = summarise(rows, "7d", NOW);
    expect(s.byProduct.find((p) => p.product === "lifeprotect")!.counts)
      .toMatchObject({ arrived: 1, priced: 1, interested: 0 });
    expect(s.byProduct.find((p) => p.product === "ihealthy")!.counts)
      .toMatchObject({ arrived: 2, priced: 1, interested: 1 });
  });

  it("gives a conversation with no plan chosen a bucket rather than dropping it", () => {
    const s = summarise([conv("a", D2, { product: null })], "7d", NOW);
    expect(s.counts.arrived).toBe(1);
    expect(s.byProduct.reduce((n, p) => n + p.counts.arrived, 0)).toBe(1);
    expect(s.byProduct[0].product).toBe("undecided");
  });

  it("puts the busiest plan first", () => {
    const rows = [
      conv("a", D2, { product: "ihealthy" }),
      conv("b", D2, { product: "lifeprotect" }),
      conv("c", D2, { product: "lifeprotect" }),
    ];
    expect(summarise(rows, "7d", NOW).byProduct[0].product).toBe("lifeprotect");
  });
});

describe("laying the days out", () => {
  it("gives every day in the range a slot, including the ones nobody wrote on", () => {
    const s = summarise([conv("a", D1), conv("b", D2), conv("c", D2)], "7d", NOW);
    expect(s.byDay).toHaveLength(7);
    expect(s.byDay.at(-1)).toMatchObject({ arrived: 2 });
    expect(s.byDay.at(-2)).toMatchObject({ arrived: 1 });
    expect(s.byDay.slice(0, 5).every((d) => d.arrived === 0)).toBe(true);
  });

  it("leaves out what happened before the range began", () => {
    const s = summarise([conv("a", "2026-08-01T00:00:00.000Z"), conv("b", D2)], "7d", NOW);
    expect(s.counts.arrived).toBe(1);
  });

  it("gives all twenty-four hours a slot", () => {
    const s = summarise([conv("a", D2)], "7d", NOW);
    expect(s.byHour).toHaveLength(24);
    expect(s.byHour.reduce((n, h) => n + h.arrived, 0)).toBe(1);
  });

  it("counts a day's quotations and applications alongside its arrivals", () => {
    const rows = [conv("a", D2, { priced_at: D2, handover_at: D2 }), conv("b", D2)];
    expect(summarise(rows, "7d", NOW).byDay.at(-1))
      .toMatchObject({ arrived: 2, priced: 1, interested: 1 });
  });
});

describe("which advertisement brought them", () => {
  it("groups by ad and puts the busiest first", () => {
    const rows = [
      conv("a", D2, { ad_id: "ad-1" }),
      conv("b", D2, { ad_id: "ad-1", handover_at: D2 }),
      conv("c", D2, { ad_id: "ad-2" }),
    ];
    const s = summarise(rows, "7d", NOW);
    expect(s.byAd[0]).toEqual({ adId: "ad-1", arrived: 2, interested: 1 });
    expect(s.byAd[1]).toEqual({ adId: "ad-2", arrived: 1, interested: 0 });
  });

  it("leaves out those who arrived by no advertisement at all", () => {
    expect(summarise([conv("a", D2)], "7d", NOW).byAd).toHaveLength(0);
  });
});

describe("where a range begins", () => {
  it("starts today at this morning, not twenty-four hours ago", () => {
    const now = new Date("2026-09-15T16:30:00.000Z");
    const start = rangeStart("today", now);
    expect(start.getTime()).toBeLessThan(now.getTime());
    expect(now.getTime() - start.getTime()).toBeLessThan(24 * 3600_000);
  });

  it("counts seven days back for the week and thirty for the month", () => {
    const week = NOW.getTime() - rangeStart("7d", NOW).getTime();
    const month = NOW.getTime() - rangeStart("30d", NOW).getTime();
    expect(Math.round(week / 86_400_000)).toBeGreaterThanOrEqual(6);
    expect(Math.round(month / 86_400_000)).toBeGreaterThanOrEqual(29);
  });
});
