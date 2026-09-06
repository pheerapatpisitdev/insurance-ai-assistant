import { describe, expect, it } from "vitest";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { getPlan } from "@/calc/plans/registry";

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

  it("carries cash-value factors only at the milestones still ahead of the insured", () => {
    const t = lifeProtectTable(WHILE_CURRENT);
    const term19 = t.terms[1];
    // ชาย 35: the company table gives 504 / 633 / 777 per thousand at 60 / 70 / 80, 1000 at 99
    expect(term19.cash.M[35]).toEqual({ 60: 504, 70: 633, 80: 777, 99: 1000 });
    // ชาย 70 has passed 60 and 70
    expect(Object.keys(term19.cash.M[70]!)).toEqual(["80", "99"]);
    // ชาย 80 has only the end left
    expect(Object.keys(term19.cash.M[80]!)).toEqual(["99"]);
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
