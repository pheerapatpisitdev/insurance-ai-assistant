import { describe, expect, it } from "vitest";
import { dayKey, repeats, weekDays, weekLabel, weekStart } from "@/lib/content/calendar";

describe("the calendar's week", () => {
  it("starts at Monday midnight in Thailand, whatever the moment's UTC date", () => {
    // Monday 00:30 in Bangkok is still Sunday in UTC
    const mondayEarly = new Date("2026-09-28T00:30:00+07:00");
    expect(weekStart(mondayEarly).toISOString()).toBe("2026-09-27T17:00:00.000Z");
    // Sunday late evening belongs to the week before
    const sundayLate = new Date("2026-09-27T23:30:00+07:00");
    expect(weekStart(sundayLate).toISOString()).toBe("2026-09-20T17:00:00.000Z");
  });

  it("lays out seven Thai days, Monday first", () => {
    const days = weekDays(weekStart(new Date("2026-09-25T12:00:00+07:00")));
    expect(days).toHaveLength(7);
    expect(days[0]).toMatchObject({ key: "2026-09-21", label: "จ. 21 ก.ย." });
    expect(days[6].label).toBe("อา. 27 ก.ย.");
    expect(weekLabel(days[0].from)).toBe("21 ก.ย. – 27 ก.ย.");
  });

  it("files a post at 23:30 Bangkok under that day, not UTC's next one", () => {
    expect(dayKey(new Date("2026-09-25T23:30:00+07:00"))).toBe("2026-09-25");
  });
});

describe("repeats", () => {
  it("flags a piece that follows one about the same plan", () => {
    const at = (h: number) => new Date(Date.UTC(2026, 8, 25, h));
    const flagged = repeats([
      { id: "c", planHref: "/cancer", at: at(9) },
      { id: "a", planHref: "/lifeprotect", at: at(1) },
      { id: "b", planHref: "/lifeprotect", at: at(5) },
    ]);
    expect([...flagged]).toEqual(["b"]);
  });
});
