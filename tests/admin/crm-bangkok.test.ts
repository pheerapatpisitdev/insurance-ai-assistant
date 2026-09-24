import { describe, expect, it } from "vitest";
import { bangkokHour, rangeStart, summarise } from "@/lib/crm/summary";
import { monthStart } from "@/lib/ai/ledger";
import { intentName, planName } from "@/lib/crm/plans";
import { inboxLink } from "@/lib/crm/names";
import type { ConversationRow } from "@/lib/crm/types";

/**
 * Days and hours on the report are Bangkok's, whatever clock the server keeps.
 *
 * Vercel runs in UTC, so these are written to hold with TZ=UTC — the timezone the bug lived
 * in — and every instant is given in UTC so the test means the same thing on any laptop.
 * Bangkok is UTC+7 all year.
 */

function conv(id: string, at: string): ConversationRow {
  return {
    id, started_at: at, last_event_at: at, product: "lifeprotect",
    source: "organic", ad_id: null, ref: null,
    priced_at: null, form_sent_at: null, form_done_at: null,
    agent_replied_at: null, stalled_at: null, handover_at: null, messages: 1,
  };
}

// 2026-09-25 09:00 in Bangkok
const NOW = new Date("2026-09-25T02:00:00.000Z");

describe("hours of the Bangkok clock", () => {
  it("puts a message written at 20:00 in Bangkok under hour 20", () => {
    const s = summarise([conv("a", "2026-09-24T13:00:00.000Z")], "7d", NOW);
    expect(s.byHour[20].arrived).toBe(1);
    expect(s.byHour[13].arrived).toBe(0);
  });

  it("reads the hour past midnight UTC as the next Bangkok morning", () => {
    expect(bangkokHour(new Date("2026-09-24T23:30:00.000Z"))).toBe(6);
    expect(bangkokHour(new Date("2026-09-24T17:00:00.000Z"))).toBe(0);
  });
});

describe("where a Bangkok day begins", () => {
  it("starts today at midnight in Bangkok, which is 17:00 UTC the day before", () => {
    expect(rangeStart("today", NOW).toISOString()).toBe("2026-09-24T17:00:00.000Z");
  });

  it("counts a message at 06:30 Bangkok as today", () => {
    // 06:30 on the 25th in Bangkok is 23:30 on the 24th in UTC
    const s = summarise([conv("a", "2026-09-24T23:30:00.000Z")], "today", NOW);
    expect(s.counts.arrived).toBe(1);
    expect(s.byDay).toEqual([{ date: "2026-09-25", arrived: 1, priced: 0, interested: 0 }]);
  });

  it("leaves 23:30 Bangkok last night out of today", () => {
    const s = summarise([conv("a", "2026-09-24T16:30:00.000Z")], "today", NOW);
    expect(s.counts.arrived).toBe(0);
  });

  it("lays seven Bangkok days out, ending today, and files each message under its own", () => {
    const s = summarise([
      conv("a", "2026-09-24T23:30:00.000Z"), // 25th, 06:30
      conv("b", "2026-09-24T16:30:00.000Z"), // 24th, 23:30
    ], "7d", NOW);
    expect(s.byDay.map((d) => d.date)).toEqual([
      "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25",
    ]);
    expect(s.byDay.at(-1)!.arrived).toBe(1);
    expect(s.byDay.at(-2)!.arrived).toBe(1);
    expect(rangeStart("7d", NOW).toISOString()).toBe("2026-09-18T17:00:00.000Z");
  });

  it("is the same day at 23:59 and 00:00 UTC when both are the same Bangkok morning", () => {
    // 06:59 and 07:00 on the 25th in Bangkok — the hour the old code split into two days
    const s = summarise([conv("a", "2026-09-24T23:59:00.000Z"), conv("b", "2026-09-25T00:00:00.000Z")], "7d", NOW);
    expect(s.byDay.at(-1)!.arrived).toBe(2);
  });
});

describe("where the Thai month begins", () => {
  it("is 00:00 Bangkok on the 1st, which is 17:00 UTC on the last day before", () => {
    expect(monthStart(NOW).toISOString()).toBe("2026-08-31T17:00:00.000Z");
  });

  it("has already turned at 03:00 Bangkok on the 1st, while UTC is still on the old month", () => {
    const early = new Date("2026-09-30T20:00:00.000Z"); // 1 October, 03:00 in Bangkok
    expect(monthStart(early).toISOString()).toBe("2026-09-30T17:00:00.000Z");
  });
});

describe("plan and intent names", () => {
  it("names every plan the bot records, not only the first two", () => {
    expect(planName("lifeprotect")).toBe("Life Protect x 2");
    expect(planName("ihealthy")).toBe("iHealthy Ultra");
    expect(planName("ishield")).toBe("iShield");
    expect(planName("legacy")).toBe("Family Legacy");
    expect(planName("ci123")).toBe("CI 123");
  });

  it("calls an undecided or missing plan undecided, and nothing else", () => {
    expect(planName("undecided")).toBe("ยังไม่เลือกแผน");
    expect(planName(null)).toBe("ยังไม่เลือกแผน");
  });

  it("shows a key nobody has named as itself rather than as undecided", () => {
    expect(planName("somethingnew")).toBe("somethingnew");
  });

  it("says what the customer was after in Thai", () => {
    expect(intentName("other")).toBe("คำถามทั่วไป");
    expect(intentName("quote")).toBe("ถามเบี้ย");
    expect(intentName("mystery")).toBe("mystery");
  });
});

describe("the link to a customer's thread", () => {
  it("names the Page and the customer when both are known", () => {
    expect(inboxLink("105982528649026", "123")).toBe(
      "https://business.facebook.com/latest/inbox/all?asset_id=105982528649026&selected_item_id=123",
    );
  });

  it("falls back to the inbox when either is missing", () => {
    expect(inboxLink(null, "123")).toBe("https://business.facebook.com/latest/inbox/all");
    expect(inboxLink("", "123")).toBe("https://business.facebook.com/latest/inbox/all");
  });
});
