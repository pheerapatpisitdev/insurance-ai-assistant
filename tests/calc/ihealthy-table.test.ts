import { describe, expect, it } from "vitest";
import { iHealthyTable } from "@/lib/ihealthy-table";

const WHILE_CURRENT = new Date("2026-09-12");
const table = iHealthyTable(WHILE_CURRENT);

describe("iHealthyTable", () => {
  it("offers the three bases the spec keeps, in order", () => {
    expect(table.bases.map((b) => b.variant)).toEqual(["WLF99L", "WLF99H", "WLF99HX"]);
    expect(table.bases.map((b) => b.booster)).toEqual([0.5, 1, 1]);
    expect(table.bases[2].fixedSum).toBe(50_000);
    expect(table.bases[0].fixedSum).toBeUndefined();
    expect(table.bases[0].saMin).toBe(150_000);
  });

  it("takes the age range from the health rider, not the base plan", () => {
    expect(table.ageMin).toBe(6);
    expect(table.ageMax).toBe(80);
  });

  it("carries the six plans with their annual maximum", () => {
    expect(table.plans.map((p) => p.code)).toEqual(["SMART", "BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"]);
    expect(table.plans[5].annualMax).toBe(100_000_000);
  });

  it("holds a rate for every key the workbook has and nothing else", () => {
    expect(Object.keys(table.riderRates)).toHaveLength(28);
    expect(table.riderRates.MHP6S.F[35 - table.ageMin]).toBe(170_500);
    expect(table.riderRates.MHP2S.F[45 - table.ageMin]).toBe(26_700);
    expect(table.riderRates.MHP1J.M[6 - table.ageMin]).toBe(46_700);
    expect(table.riderRates.MHP6S.F[8 - table.ageMin]).toBeNull();
    expect(table.riderRates.MHP4SA).toBeUndefined();
    expect(table.riderRates.MHP3J).toBeUndefined();
  });

  it("carries the base rate per thousand for each variant", () => {
    expect(table.bases[1].rates.F[35 - table.ageMin]).toBeGreaterThan(0);
    expect(table.bases[2].rates.F[35 - table.ageMin]).toBeGreaterThan(0);
  });

  it("names the riders the health package refuses and the one it forces", () => {
    expect(table.bases[2].requiredRiders).toEqual(["IHU"]);
    expect(table.bases[2].disabledRiders).toContain("PB");
    expect(table.bases[0].disabledRiders).toEqual([]);
  });

  it("passes the rate version and the expiry through", () => {
    expect(table.rateVersion).toBe("A2026-1");
    expect(table.expired).toBe(false);
    expect(iHealthyTable(new Date("2027-04-01")).expired).toBe(true);
  });
});
