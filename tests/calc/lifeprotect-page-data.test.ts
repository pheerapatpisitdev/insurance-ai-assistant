import { describe, expect, it } from "vitest";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { getPlan } from "@/calc/plans/registry";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { cashAt } from "@/lib/lifeprotect-quote";

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");

describe("lifeProtectTable", () => {
  it("carries the three payment terms in the order the page shows them", () => {
    const t = lifeProtectTable(WHILE_CURRENT);
    expect(t).toMatchObject({
      ageMin: 0, ageMax: 80, expired: false, rateVersion: "A2026-1", minMonthly: 1000,
      boosterBeforeAge: 60, booster: 1, coverToAge: 99,
      modeFactors: { annual: 1, semi: 0.52, monthly: 0.09 },
    });
    expect(t.terms.map((x) => [x.variant, x.label, x.payTerm, x.payToAge])).toEqual([
      ["WLF09H", "จ่าย 9 ปี", 9, undefined],
      ["WLF19H", "จ่าย 19 ปี", 19, undefined],
      ["WLF99H", "จ่ายถึงอายุ 99", undefined, 99],
    ]);
  });

  it("has a rate for every age and sex in every term", () => {
    const t = lifeProtectTable(WHILE_CURRENT);
    const rates = getPlan("LIFEPROTECT")!.rates;
    for (const term of t.terms) {
      for (const sex of ["M", "F"] as const) {
        expect(term.rates[sex]).toHaveLength(81);
        expect(term.rates[sex].every((r) => typeof r === "number")).toBe(true);
        // ชาย 35 · จ่าย 19 ปี is 28.70 per thousand in the workbook
        expect(term.rates[sex][35]).toBe(rates.base.rates[term.variant][sex]["35"]);
      }
    }
  });

  it("carries the whole cash-value schedule, one factor per policy year", () => {
    const t = lifeProtectTable(WHILE_CURRENT);
    const term19 = t.terms[1];
    // ชาย 35 runs from 35 to 98 in the company table — 64 policy years
    expect(term19.schedule.M[35]).toHaveLength(64);
    // policy year 26 is the one that opens at 60, and the last value is the maturity money
    expect(term19.schedule.M[35]![25]).toBe(504);
    expect(term19.schedule.M[35]![63]).toBe(1000);
    expect(term19.schedule.M[80]).toHaveLength(19);
  });

  it("still reads the same four milestones the card has always shown", () => {
    const t = lifeProtectTable(WHILE_CURRENT);
    expect(cashAt(t.terms[1], "M", 35, 1_000_000, t.ageMin)).toEqual([
      { age: 60, amount: 504_000 }, { age: 70, amount: 633_000 },
      { age: 80, amount: 777_000 }, { age: 99, amount: 1_000_000 },
    ]);
    expect(cashAt(t.terms[1], "M", 70, 1_000_000, t.ageMin).map((r) => r.age)).toEqual([80, 99]);
    expect(cashAt(t.terms[1], "M", 80, 1_000_000, t.ageMin).map((r) => r.age)).toEqual([99]);
  });
});

/** Same defence as legacyTable: a warm cache must not keep telling customers the table is current. */
describe("once the rate table has lapsed", () => {
  const AFTER = new Date("2027-04-01");

  it("the table says so, even to a process that started while it was current", () => {
    lifeProtectTable(WHILE_CURRENT);
    expect(lifeProtectTable(AFTER).expired).toBe(true);
    expect(lifeProtectTable(WHILE_CURRENT).expired).toBe(false);
  });
});

describe("lifeProtectFacts", () => {
  it("takes the sales copy's figures from the engine", () => {
    const f = lifeProtectFacts(WHILE_CURRENT);
    expect(f).toMatchObject({
      expired: false, rateVersion: "A2026-1", ageMin: 0, ageMax: 80, boosterBeforeAge: 60, coverToAge: 99,
      // หญิง 35 · ทุน 500,000 · ถึง 99: 7,100 บาท/ปี ÷ 365 = 19.5 → 20
      fromAge: 35, fromSum: "500,000", fromDouble: "1,000,000", fromPerDay: 20,
      // ลูกชายแรกเกิด · 1 ล้าน · จ่าย 19 ปี: 14.00 per thousand → 1,260 a month
      newborn: { sum: "1,000,000", double: "2,000,000", termLabel: "จ่าย 19 ปี", years: 19, premium: "1,260", per: "/เดือน" },
      double: { sum: "1,000,000", before: "2,000,000", sumShort: "1 ล้าน", beforeShort: "2 ล้าน" },
      cash60: "504,000",
    });
  });

  it("compares the three terms for ชาย 35 · 1 ล้าน", () => {
    const f = lifeProtectFacts(WHILE_CURRENT);
    expect(f.example).toMatchObject({ age: 35, sum: "1,000,000" });
    expect(f.example.terms).toEqual([
      { label: "จ่าย 9 ปี", years: 9, premium: "4,914", per: "/เดือน", total: "491,400" },
      { label: "จ่าย 19 ปี", years: 19, premium: "2,583", per: "/เดือน", total: "545,300" },
      { label: "จ่ายถึงอายุ 99", years: 64, premium: "1,548", per: "/เดือน", total: "1,100,800" },
    ]);
  });

  it("stops quoting a premium once the rate table has lapsed, but still states the benefits", () => {
    const f = lifeProtectFacts(new Date("2027-04-01"));
    expect(f.expired).toBe(true);
    expect(f.fromPerDay).toBeNull();
    expect(f.newborn.premium).toBeNull();
    expect(f.example.terms.every((t) => t.premium === null && t.total === null)).toBe(true);
    expect(f.example.terms.map((t) => t.years)).toEqual([9, 19, 64]);
    expect(f.double.before).toBe("2,000,000");
    expect(f.cash60).toBe("504,000");
  });
});
