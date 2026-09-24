import { describe, expect, it } from "vitest";
import { currentPeriod, usedThisMonth } from "@/app/admin/api/period";

/**
 * The counter is reset lazily, on a key's first call of a new month, so an idle key still
 * carries last month's number. The table must not print it as this month's.
 */
describe("ใช้เดือนนี้", () => {
  const now = new Date("2026-09-25T03:00:00Z");

  it("is the stored count when it belongs to this month", () => {
    expect(currentPeriod(now)).toBe("2026-09");
    expect(usedThisMonth(42, "2026-09", now)).toBe(42);
  });

  it("is 0 when the count is left over from an earlier month", () => {
    expect(usedThisMonth(4999, "2026-08", now)).toBe(0);
  });

  it("follows the database's UTC month, not Bangkok's, at the turn of the month", () => {
    // 1 Oct 03:00 in Bangkok is still 30 Sep in UTC, where the quota is still counting
    const turn = new Date("2026-09-30T20:00:00Z");
    expect(usedThisMonth(10, "2026-09", turn)).toBe(10);
  });
});
