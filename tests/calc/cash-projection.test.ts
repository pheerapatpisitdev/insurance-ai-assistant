import { describe, expect, it } from "vitest";
import { cashProjection } from "@/lib/cash-projection";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { deathBenefitOf, lifeProtectModes, payYears, termAt } from "@/lib/lifeprotect-quote";

const table = lifeProtectTable(new Date("2026-09-05"));
const SUM = 1_000_000;

/** ชาย 35 · ทุน 1 ล้าน, on whichever payment term is asked for. */
function project(variant: string, withPrice = true) {
  const term = termAt(table, variant);
  const factors = term.schedule.M[35 - table.ageMin]!;
  const annualSatang = withPrice
    ? lifeProtectModes(table, term, { sex: "M", age: 35, sumAssured: SUM })!
        .find((m) => m.mode === "annual")!.total
    : null;
  return cashProjection({
    factors, age: 35, sumAssured: SUM, annualSatang,
    payYears: payYears(term, 35), death: deathBenefitOf(table, 35, SUM),
  });
}

describe("cashProjection · จ่าย 9 ปี", () => {
  const p = project("WLF09H");

  it("counts policy years, ages and surrender values off the company table", () => {
    expect(p.rows).toHaveLength(64);
    expect(p.maturityAge).toBe(99);
    expect(p.rows[0]).toEqual({
      policyYear: 1, age: 35, cover: 200_000_000,
      premiumDue: 5_460_000, premiumPaid: 5_460_000, cashValue: 0,
    });
    expect(p.rows[8]).toEqual({
      policyYear: 9, age: 43, cover: 200_000_000,
      premiumDue: 5_460_000, premiumPaid: 49_140_000, cashValue: 36_500_000,
    });
  });

  it("stops collecting premium once the paying term is over", () => {
    expect(p.rows[9]).toEqual({
      policyYear: 10, age: 44, cover: 200_000_000,
      premiumDue: 0, premiumPaid: 49_140_000, cashValue: 37_300_000,
    });
    expect(p.rows[p.rows.length - 1].premiumPaid).toBe(49_140_000);
  });

  it("drops the cover to the sum assured at 60", () => {
    expect(p.rows.find((r) => r.age === 59)!.cover).toBe(200_000_000);
    expect(p.rows.find((r) => r.age === 60)!.cover).toBe(100_000_000);
  });

  it("breaks even in policy year 25, at 59", () => {
    expect(p.breakEven).toMatchObject({ policyYear: 25, age: 59, cashValue: 49_200_000 });
  });

  it("is worth nothing for the first year only", () => {
    expect(p.zeroYears).toBe(1);
  });
});

describe("cashProjection · the other two terms", () => {
  it("จ่าย 19 ปี breaks even in year 30 and is worth nothing for three years", () => {
    const p = project("WLF19H");
    expect(p.zeroYears).toBe(3);
    expect(p.breakEven).toMatchObject({ policyYear: 30, age: 64 });
    expect(p.rows[p.rows.length - 1].premiumPaid).toBe(54_530_000);
  });

  it("ถึงอายุ 99 breaks even in the last year and is worth nothing for eight", () => {
    const p = project("WLF99H");
    expect(p.zeroYears).toBe(8);
    expect(p.rows[8].cashValue).toBe(1_100_000);
    expect(p.breakEven).toMatchObject({ policyYear: 64, age: 98, cashValue: 111_200_000 });
    expect(p.rows[p.rows.length - 1].premiumPaid).toBe(110_080_000);
  });
});

describe("cashProjection when no price may be shown", () => {
  const p = project("WLF99H", false);

  it("carries no premium and no break-even, but still the surrender values", () => {
    expect(p.rows.every((r) => r.premiumDue === null && r.premiumPaid === null)).toBe(true);
    expect(p.breakEven).toBeNull();
    expect(p.zeroYears).toBe(8);
    expect(p.rows[8].cashValue).toBe(1_100_000);
  });
});
