import { describe, it, expect } from "vitest";
import golden from "../golden/lifeprotect-cash-values.json";
import { cashValueHighlights, cashValueSchedule, hasCashValues, maturityValue } from "@/calc/cash-value";

interface GoldenCase {
  age: number;
  sex: "M" | "F";
  variant: string;
  sumAssured: number;
  rows: { age: number; policyYear: number; cashValue: number }[];
}
const CASES = golden as GoldenCase[];

describe("cash surrender values against the company workbook", () => {
  it("covers every case the generator produced", () => {
    expect(CASES.length).toBeGreaterThanOrEqual(5);
  });

  for (const c of CASES) {
    const label = `${c.variant} ${c.sex}${c.age} ทุน ${c.sumAssured.toLocaleString("en-US")}`;

    it(`${label}: every policy year matches to the baht`, () => {
      const ours = cashValueSchedule("LIFEPROTECT", c.variant, c.sex, c.age, c.sumAssured);
      expect(ours.map((r) => [r.policyYear, r.age, r.amount]))
        .toEqual(c.rows.map((r) => [r.policyYear, r.age, r.cashValue]));
    });

    it(`${label}: cover runs out at age 99`, () => {
      const ours = cashValueSchedule("LIFEPROTECT", c.variant, c.sex, c.age, c.sumAssured);
      expect(maturityValue(ours)?.age).toBe(99);
      expect(maturityValue(ours)?.amount).toBe(c.rows[c.rows.length - 1].cashValue);
    });
  }
});

describe("choosing which years to show", () => {
  const rows = cashValueSchedule("LIFEPROTECT", "WLF99H", "M", 35, 1_000_000);

  it("shows about ten years, and never more than a phone screen holds", () => {
    const shown = cashValueHighlights(rows).length;
    expect(shown).toBeGreaterThanOrEqual(8);
    expect(shown).toBeLessThanOrEqual(12);
  });

  it("keeps a newborn's ninety-nine years down to the same handful", () => {
    const baby = cashValueSchedule("LIFEPROTECT", "WLF09L", "F", 0, 300_000);
    expect(cashValueHighlights(baby).length).toBeLessThanOrEqual(12);
  });

  it("lands on round ages", () => {
    for (const r of cashValueHighlights(rows)) expect(r.age % 5).toBe(0);
  });

  it("leaves out the early years that are worth nothing", () => {
    for (const r of cashValueHighlights(rows)) expect(r.amount).toBeGreaterThan(0);
  });

  it("leaves the final year to the maturity line instead of repeating it", () => {
    const highlights = cashValueHighlights(rows);
    expect(highlights.at(-1)?.policyYear).not.toBe(rows.at(-1)?.policyYear);
  });

  it("still returns rows for a policy bought late in life, when few years remain", () => {
    const late = cashValueSchedule("LIFEPROTECT", "WLF19L", "F", 80, 150_000);
    expect(cashValueHighlights(late).length).toBeGreaterThan(0);
  });
});

describe("plans without an extracted table", () => {
  it("says so rather than guessing", () => {
    expect(hasCashValues("PLB")).toBe(false);
    expect(cashValueSchedule("PLB", "PLB10", "M", 35, 1_000_000)).toEqual([]);
  });
});
