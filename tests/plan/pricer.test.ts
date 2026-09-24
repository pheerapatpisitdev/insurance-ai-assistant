import { describe, expect, it } from "vitest";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { getBundle } from "@/calc/bundles/registry";
import { realPricer } from "@/lib/plan/pricer";
import { recommend } from "@/lib/plan/recommend";
import { CANCER_TIERS, CI_TIERS, HEALTH_TIERS, LIFE_DOUBLE_BEFORE_AGE } from "@/lib/plan/assumptions";

describe("assumptions match the rate tables", () => {
  it("doubles before the table's own age", () => {
    expect(lifeProtectTable().boosterBeforeAge).toBe(LIFE_DOUBLE_BEFORE_AGE);
  });
  it("lists iHealthy's plans in the table's order", () => {
    expect(iHealthyTable().plans.map((p) => p.code)).toEqual(HEALTH_TIERS.map((t) => t.code));
  });
  it("lists the CI 123 and cancer tiers the bundles hold", () => {
    const sums = (code: string, rider: string) =>
      getBundle(code)!.tiers.map((t) => ({ no: t.no, sum: t.riders.find((r) => r.code === rider)!.sumAssured }));
    expect(sums("CI123_SET", "CI123")).toEqual(CI_TIERS);
    expect(sums("CANCER_SET", "CPR")).toEqual(CANCER_TIERS);
  });
});

describe("realPricer", () => {
  const pr = realPricer(35, "M");
  it("prices Life Protect in proportion to the sum", () => {
    expect(pr.life("WLF99H", 4_000_000)).toBe(4 * pr.life("WLF99H", 1_000_000)!);
  });
  it("prices both life answers off the tables the calculator uses", () => {
    expect(pr.life("PLB15", 1_000_000)).toBe(580_000);
    expect(pr.life("WLF19H", 1_000_000)).toBe(2_870_000);
    expect(realPricer(60, "M").life("PLB15", 1_000_000)).toBeUndefined();
  });
  it("prices every area for a 35-year-old", () => {
    expect(pr.health("SILVER")).toBeGreaterThan(0);
    expect(pr.ci(2)).toBeGreaterThan(0);
    expect(pr.cancer(1)).toBeGreaterThan(0);
    expect(pr.pension(60, { premium: 3_000_000 })?.from).toBe(60);
  });
  it("prices the pension from the wanted start age, by premium or by monthly pension", () => {
    expect(pr.pension(55, { premium: 3_000_000 })?.from).toBe(55);
    const m = pr.pension(60, { monthly: 10_000 });
    expect(m?.monthlyPension).toBeGreaterThanOrEqual(9_900);
    expect(m?.monthlyPension).toBeLessThanOrEqual(10_100);
  });
  it("refuses ages a plan does not take", () => {
    expect(realPricer(70, "M").cancer(1)).toBeUndefined();
    expect(realPricer(66, "M").pension(60, { premium: 3_000_000 })).toBeUndefined();
  });
  it("plans the owner's example with a generous budget", () => {
    const r = recommend({
      age: 35, sex: "M", income: 50_000, expense: 25_000, savings: 200_000, children: [5, 8],
      otherDependants: false, debts: 1_500_000, lifeCover: 500_000, ciCover: 0, healthNow: "public",
      healthRoom: 0, premiumsNow: 12_000, hospital: "private", lifeWant: "save",
  retireAge: 60, retireMonthly: 17_500, pensionHave: 0, retireLump: 0, budget: 30_000,
    }, pr);
    expect(r.areas[0].offer?.sum).toBe(4_000_000);
    expect(r.areas[0].status).toBe("fits");
    expect(r.usedAnnual).toBeLessThanOrEqual(30_000 * 12 * 100);
  });
});
