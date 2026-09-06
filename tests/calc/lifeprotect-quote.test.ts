import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { cashValueSchedule, maturityValue } from "@/calc/cash-value";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { cashAt, deathBenefitOf, lifeProtectModes, payYears, termAt, totalPaid } from "@/lib/lifeprotect-quote";
import type { Sex } from "@/calc/types";

const WHILE_CURRENT = new Date("2026-09-05");
const table = lifeProtectTable(WHILE_CURRENT);

/** A small seeded generator, so a failing case can be re-run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUMS = Array.from({ length: 20 }, (_, i) => 500_000 * (i + 1));

describe("lifeProtectModes", () => {
  it("prices ชาย 35 · 1 ล้าน · จ่าย 19 ปี as the workbook does", () => {
    const modes = lifeProtectModes(table, termAt(table, "WLF19H"), { sex: "M", age: 35, sumAssured: 1_000_000 })!;
    // 28.70 per thousand: 28,700 a year, 14,924 a half-year, 2,583 a month
    expect(modes).toEqual([
      { mode: "annual", total: 2_870_000, belowMinimum: false },
      { mode: "semi", total: 1_492_400, belowMinimum: false },
      { mode: "monthly", total: 258_300, belowMinimum: false },
    ]);
  });

  /**
   * The browser's arithmetic is the page's only source of prices, so it has to be the
   * engine's arithmetic. Two hundred random arrangements across every term, sex, age and
   * sum are priced both ways and must agree to the satang.
   */
  it("agrees with the engine in every mode across random arrangements", () => {
    const next = rng(20260906);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)];
    for (let i = 0; i < 200; i++) {
      const term = pick(table.terms);
      const sex = pick(["M", "F"] as const);
      const age = table.ageMin + Math.floor(next() * (table.ageMax - table.ageMin + 1));
      const sumAssured = pick(SUMS);
      const modes = lifeProtectModes(table, term, { sex, age, sumAssured })!;
      for (const m of modes) {
        const q = quote({
          planCode: "LIFEPROTECT", variant: term.variant, age, sex, mode: m.mode, sumAssured, riders: [],
        }, WHILE_CURRENT);
        const label = `${term.variant} ${sex} ${age} ${sumAssured} ${m.mode}`;
        expect(q.totalModal, label).toBe(m.total);
        expect(q.warnings.some((w) => w.code === "MIN_MONTHLY"), label).toBe(m.belowMinimum);
      }
    }
  });

  it("flags the monthly instalment the company will not take", () => {
    // แรกเกิด · 1 ล้าน · ถึง 99: 540 a month, under the 1,000 baht floor
    const modes = lifeProtectModes(table, termAt(table, "WLF99H"), { sex: "M", age: 0, sumAssured: 1_000_000 })!;
    expect(modes.find((m) => m.mode === "monthly")).toEqual({ mode: "monthly", total: 54_000, belowMinimum: true });
  });
});

describe("payYears and totalPaid", () => {
  it("counts a fixed term as itself and a to-age term from the insured's age", () => {
    expect(payYears(termAt(table, "WLF09H"), 35)).toBe(9);
    expect(payYears(termAt(table, "WLF99H"), 35)).toBe(64);
    expect(payYears(termAt(table, "WLF99H"), 80)).toBe(19);
  });

  it("adds the level premium up over the term", () => {
    // 28,700 × 19 = 545,300 baht
    expect(totalPaid(2_870_000, 19)).toBe(54_530_000);
  });
});

describe("deathBenefitOf", () => {
  it("matches the engine on both sides of the booster age", () => {
    for (const [age, sum] of [[35, 1_000_000], [59, 500_000], [60, 2_500_000], [80, 10_000_000]] as const) {
      const q = quote({
        planCode: "LIFEPROTECT", variant: "WLF19H", age, sex: "F", mode: "annual", sumAssured: sum, riders: [],
      }, WHILE_CURRENT);
      expect(deathBenefitOf(table, age, sum)).toEqual(q.deathBenefit);
    }
  });

  it("pays double before 60 and the sum from then on", () => {
    expect(deathBenefitOf(table, 35, 1_000_000)).toMatchObject({
      beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false,
    });
  });
});

describe("cashAt", () => {
  it("matches the company's schedule at the milestone ages and at the end", () => {
    for (const [variant, sex, age, sum] of [
      ["WLF19H", "M", 35, 1_000_000], ["WLF09H", "F", 0, 500_000], ["WLF99H", "M", 72, 3_000_000],
    ] as [string, Sex, number, number][]) {
      const rows = cashValueSchedule("LIFEPROTECT", variant, sex, age, sum);
      const expected = [60, 70, 80]
        .filter((at) => at > age)
        .map((at) => ({ age: at, amount: rows.find((r) => r.age === at)!.amount }))
        .concat([{ age: maturityValue(rows)!.age, amount: maturityValue(rows)!.amount }])
        .filter((r) => r.amount > 0);
      expect(cashAt(termAt(table, variant), sex, age, sum, table.ageMin)).toEqual(expected);
    }
  });

  it("reads ชาย 35 · 1 ล้าน · จ่าย 19 ปี as 504,000 at 60 and 1,000,000 at 99", () => {
    expect(cashAt(termAt(table, "WLF19H"), "M", 35, 1_000_000, table.ageMin)).toEqual([
      { age: 60, amount: 504_000 }, { age: 70, amount: 633_000 }, { age: 80, amount: 777_000 }, { age: 99, amount: 1_000_000 },
    ]);
  });
});
