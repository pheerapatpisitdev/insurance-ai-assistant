import { describe, expect, it } from "vitest";
import { recommend, type Pricer } from "@/lib/plan/recommend";
import type { PlanInput } from "@/lib/plan/needs";

const OWNER: PlanInput = {
  age: 35, sex: "M", income: 50_000, expense: 25_000, savings: 200_000, children: [5, 8],
  otherDependants: false, debts: 1_500_000, lifeCover: 500_000, ciCover: 0, healthNow: "public",
  healthRoom: 0, premiumsNow: 12_000, hospital: "private", lifeWant: "save", budget: 100_000,
};

/** satang a year: life 10 baht per 1,000; health 20,000 × tier index; CI 3,000 × tier; cancer 1,000 × tier */
const FAKE: Pricer = {
  life: (_variant, sum) => sum * 1,
  health: (plan) => (["SMART", "BRONZE", "SILVER", "GOLD"].indexOf(plan) + 1) * 2_000_000,
  ci: (tier) => tier * 300_000,
  cancer: (tier) => tier * 100_000,
  pension: (annual) => (annual >= 1_000_000 ? { annual, monthlyPension: annual / 10_000, from: 60 } : undefined),
};

const area = (r: ReturnType<typeof recommend>, key: string) => r.areas.find((a) => a.key === key)!;

describe("recommend", () => {
  it("gives every area in full when the budget allows, and the rest to the pension", () => {
    const r = recommend(OWNER, FAKE);
    expect(area(r, "life").status).toBe("fits");
    expect(area(r, "life").offer?.sum).toBe(4_000_000);
    expect(area(r, "life").offer?.cover).toBe(8_000_000);
    expect(area(r, "health").offer?.product).toContain("ซิลเวอร์");
    expect(area(r, "ci").offer?.sum).toBe(2_000_000);
    expect(area(r, "retire").status).toBe("fits");
    expect(r.usedAnnual).toBeLessThanOrEqual(OWNER.budget * 12 * 100);
  });

  it("steps life down to the largest sum the budget reaches", () => {
    const pr = { ...FAKE, life: (_v: string, sum: number) => sum / 100 };
    const r = recommend({ ...OWNER, budget: 25 }, pr); // 300 baht a year = 30,000 satang
    expect(area(r, "life").status).toBe("reduced");
    expect(area(r, "life").offer?.sum).toBe(3_000_000);
  });

  it("says short, with the smallest price, when nothing fits", () => {
    const r = recommend({ ...OWNER, budget: 0 }, FAKE);
    expect(area(r, "life").status).toBe("short");
    expect(area(r, "life").offer?.sum).toBe(500_000);
    expect(r.usedAnnual).toBe(0);
  });

  it("falls back to the cancer set when CI 123 does not fit", () => {
    const left: Pricer = { ...FAKE, life: () => 0, health: () => 0 };
    const r = recommend({ ...OWNER, budget: 200 }, left); // 240,000 satang a year
    expect(area(r, "ci").status).toBe("reduced");
    expect(area(r, "ci").offer?.product).toContain("มะเร็ง");
  });

  it("marks an area covered when nothing is missing", () => {
    const r = recommend({ ...OWNER, lifeCover: 50_000_000, healthNow: "private", healthRoom: 9_000, ciCover: 5_000_000 }, FAKE);
    expect(["life", "health", "ci"].map((k) => area(r, k).status)).toEqual(["covered", "covered", "covered"]);
  });

  it("marks an area unavailable when the plan will not take this age", () => {
    const r = recommend({ ...OWNER, age: 66 }, { ...FAKE, pension: () => undefined });
    expect(area(r, "retire").status).toBe("unavailable");
  });

  it("gives the save answer Life Protect paid 19 years, doubled before sixty", () => {
    const r = recommend(OWNER, FAKE);
    expect(area(r, "life").offer?.product).toContain("19 ปี");
    expect(area(r, "life").offer?.coverUntil).toBeUndefined();
  });

  it("gives the cover answer PLB 15 years, not doubled, capped at the PLB page's ceiling", () => {
    const r = recommend({ ...OWNER, lifeWant: "cover" }, FAKE);
    const life = area(r, "life");
    expect(life.offer?.product).toContain("PLB");
    expect(life.offer?.sum).toBe(5_000_000); // the need is about 7.7 million, PLB stops at 5
    expect(life.offer?.cover).toBe(5_000_000);
    expect(life.offer?.coverUntil).toBe(50);
    expect(life.status).toBe("reduced");
  });

  it("gives the cover answer Life Protect to 99 where PLB will not take the age", () => {
    const noPlb: Pricer = { ...FAKE, life: (v, sum) => (v.startsWith("PLB") ? undefined : sum) };
    const life = area(recommend({ ...OWNER, lifeWant: "cover" }, noPlb), "life");
    expect(life.offer?.product).toBe("Life Protect x 2");
    expect(life.offer?.cover).toBe(8_000_000);
  });

  it("estimates the tax the new premiums save", () => {
    expect(recommend(OWNER, FAKE).taxSaved).toBeGreaterThan(0);
  });
});
