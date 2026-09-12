import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { coveragesFor, deathBenefitOf, iHealthyPricing, ihuKey, plansFor, territoriesFor } from "@/lib/ihealthy-quote";
import type { Sex } from "@/calc/types";

const WHILE_CURRENT = new Date("2026-09-12");
const table = iHealthyTable(WHILE_CURRENT);

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

const SUMS = [150_000, 500_000, 1_000_000, 2_000_000, 5_000_000];

describe("ihuKey", () => {
  it("builds the workbook's key", () => {
    expect(ihuKey(table, "PLATINUM", 35, "ประเทศไทย", "Full Coverage")).toBe("MHP6S");
    expect(ihuKey(table, "SMART", 8, "ประเทศไทย", "Full Coverage")).toBe("MHP1J");
    expect(ihuKey(table, "DIAMOND", 30, "เอเชีย", "Full Coverage")).toBe("MHP5SA");
    expect(ihuKey(table, "PLATINUM", 30, "ประเทศไทย", "Deductible")).toBe("MHPD6S");
  });
});

describe("the option filters", () => {
  it("offers a child two plans, Thailand only", () => {
    expect(plansFor(table, 8).map((p) => p.code)).toEqual(["SMART", "BRONZE"]);
    expect(territoriesFor(table, "SMART", 8)).toEqual(["ประเทศไทย"]);
  });

  it("offers an adult all six, but only the top two travel", () => {
    expect(plansFor(table, 35)).toHaveLength(6);
    expect(territoriesFor(table, "GOLD", 35)).toEqual(["ประเทศไทย"]);
    expect(territoriesFor(table, "PLATINUM", 35)).toEqual(["ประเทศไทย", "เอเชีย", "ทั่วโลก"]);
  });

  it("sells the deductible and the co-payment in Thailand only", () => {
    expect(coveragesFor(table, "ประเทศไทย")).toEqual(["Full Coverage", "Deductible", "Co-Payment"]);
    expect(coveragesFor(table, "เอเชีย")).toEqual(["Full Coverage"]);
  });

  it("offers exactly the arrangements the company has a rate for", () => {
    const offered = new Set<string>();
    for (let age = table.ageMin; age <= table.ageMax; age++) {
      for (const p of plansFor(table, age)) {
        for (const t of territoriesFor(table, p.code, age)) {
          for (const c of coveragesFor(table, t)) {
            const key = ihuKey(table, p.code, age, t, c);
            if (key && table.riderRates[key]?.M[age - table.ageMin] !== null) offered.add(key);
          }
        }
      }
    }
    expect([...offered].sort()).toEqual(Object.keys(table.riderRates).sort());
  });
});

describe("iHealthyPricing", () => {
  it("prices the workbook's own example — หญิง 45 บรอนซ์ ประเทศไทย", () => {
    const p = iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 45, sumAssured: 1_000_000,
      plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    expect(p.rider.find((m) => m.mode === "annual")!.total).toBe(2_670_000);
  });

  /**
   * The browser's arithmetic is the page's only source of prices for the base plan and the
   * health rider, so it has to be the engine's arithmetic.
   */
  it("agrees with the engine in every mode across random arrangements", () => {
    const next = rng(20260912);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)];
    let checked = 0;
    for (let i = 0; i < 200; i++) {
      const base = pick(table.bases);
      const sex: Sex = pick(["M", "F"] as const);
      const age = table.ageMin + Math.floor(next() * (table.ageMax - table.ageMin + 1));
      const plan = pick(plansFor(table, age));
      const territory = pick(territoriesFor(table, plan.code, age));
      const coverage = pick(coveragesFor(table, territory));
      const sumAssured = base.fixedSum ?? pick(SUMS);
      const choice = { base: base.variant, sex, age, sumAssured, plan: plan.code, territory, coverage };
      const priced = iHealthyPricing(table, choice);
      if (!priced) continue;
      checked++;
      for (const m of priced.total) {
        const q = quote({
          planCode: "LIFEPROTECT", variant: base.variant, age, sex, mode: m.mode,
          basis: "sumAssured", sumAssured,
          riders: [{ code: "IHU", option: plan.code, territory, coverage }],
        }, WHILE_CURRENT);
        const label = `${base.variant} ${plan.code} ${territory} ${coverage} ${sex} ${age} ${sumAssured} ${m.mode}`;
        expect(q.totalModal, label).toBe(m.total);
        expect(q.warnings.some((w) => w.code === "MIN_MONTHLY"), label).toBe(m.belowMinimum);
      }
    }
    expect(checked).toBeGreaterThan(150);
  });

  it("prices a child on the health package the way the engine does", () => {
    const p = iHealthyPricing(table, {
      base: "WLF99HX", sex: "M", age: 8, sumAssured: 50_000,
      plan: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    expect(p.base.find((m) => m.mode === "annual")!.total).toBe(38_000);
    expect(p.rider.find((m) => m.mode === "annual")!.total).toBe(3_860_000);
    expect(p.total.find((m) => m.mode === "annual")!.total).toBe(3_898_000);
  });

  it("has no price for a combination the company does not sell", () => {
    expect(iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 35, sumAssured: 1_000_000,
      plan: "GOLD", territory: "เอเชีย", coverage: "Full Coverage",
    })).toBeUndefined();
  });
});

describe("deathBenefitOf", () => {
  it("matches the engine on both sides of the booster age, on every base", () => {
    for (const base of table.bases) {
      const sumAssured = base.fixedSum ?? 1_000_000;
      for (const age of [35, 59, 60, 80]) {
        const q = quote({
          planCode: "LIFEPROTECT", variant: base.variant, age, sex: "F", mode: "annual",
          basis: "sumAssured", sumAssured,
          riders: [{ code: "IHU", option: "BRONZE", territory: "ประเทศไทย", coverage: "Full Coverage" }],
        }, WHILE_CURRENT);
        expect(deathBenefitOf(table, base.variant, age, sumAssured), `${base.variant} ${age}`)
          .toEqual(q.deathBenefit);
      }
    }
  });

  it("pays one and a half times on x 1.5 and double on x 2, and the sum alone from 60", () => {
    expect(deathBenefitOf(table, "WLF99L", 35, 1_000_000)).toEqual({
      beforeAge: 60, sumBefore: 1_500_000, sumFrom: 1_000_000, alreadyPastAge: false,
    });
    expect(deathBenefitOf(table, "WLF99H", 35, 1_000_000)).toEqual({
      beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false,
    });
    expect(deathBenefitOf(table, "WLF99H", 60, 1_000_000)).toEqual({
      beforeAge: 60, sumBefore: 1_000_000, sumFrom: 1_000_000, alreadyPastAge: true,
    });
  });
});
