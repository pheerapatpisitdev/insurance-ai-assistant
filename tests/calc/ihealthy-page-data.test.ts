import { describe, expect, it } from "vitest";
import { getPlan } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";
import { formatBaht } from "@/calc/money";
import type { PayMode, Sex } from "@/calc/types";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { coveragesFor, iHealthyPricing, plansFor } from "@/lib/ihealthy-quote";
import {
  IHEALTHY_OPENING, baseFor, resolveArrangement, sumFor, sumsFor,
} from "@/lib/ihealthy-choice";
import { shownAt } from "@/components/IHealthyCalculator";

const WHILE_CURRENT = new Date("2026-09-12");
const table = iHealthyTable(WHILE_CURRENT);
const rules = getPlan("LIFEPROTECT")!.rules;

/** What the page prices for one whole arrangement, in the baht the card prints. */
function baht(choice: {
  sex: Sex; age: number; base: string; sumAssured: number;
  plan: string; territory: string; coverage: string; mode: PayMode;
}) {
  const priced = iHealthyPricing(table, { ...choice, base: baseFor(table, choice.base).variant });
  const shown = shownAt(priced, choice.mode);
  return shown && {
    base: formatBaht(shown.base), rider: formatBaht(shown.rider), total: formatBaht(shown.total),
  };
}

const THAI = "ประเทศไทย";
const FULL = "Full Coverage";

describe("the sums the form offers", () => {
  /**
   * The engine zeroes an arrangement written under the base's floor, so a picker that could
   * reach a smaller sum would price something the company would refuse to issue. The floor
   * is read from the rules the engine itself checks against, not from a second copy of it.
   */
  it("never goes under the floor the engine enforces", () => {
    for (const base of table.bases) {
      const limits = baseSumAssuredLimits(rules, base.variant);
      expect(sumsFor(base).every((s) => s >= limits.min)).toBe(true);
      if (limits.exact) expect(sumsFor(base)).toEqual([limits.min]);
    }
  });

  it("prices every one of them", () => {
    for (const base of table.bases) {
      for (const sumAssured of sumsFor(base)) {
        const priced = iHealthyPricing(table, {
          base: base.variant, sex: "F", age: 35, sumAssured, plan: "GOLD", territory: THAI, coverage: FULL,
        });
        expect(priced?.total[0].total).toBeGreaterThan(0);
      }
    }
  });

  /**
   * The package pins fifty thousand, which is a third of what the other two are issued for.
   * Switching to it and back must not carry that figure over — the engine would void the
   * whole quote, and the picker would be showing an amount that is not among its options.
   */
  it("does not carry the package's pinned sum over to a base that is not sold for it", () => {
    const pkg = table.bases.find((b) => b.fixedSum !== undefined)!;
    const open = table.bases.find((b) => b.fixedSum === undefined)!;
    expect(sumFor(pkg, 1_000_000)).toBe(pkg.fixedSum);
    expect(sumsFor(open)).toContain(sumFor(open, pkg.fixedSum!));
  });

  it("keeps the customer's own sum when the base does sell it", () => {
    const open = table.bases.find((b) => b.fixedSum === undefined)!;
    expect(sumFor(open, 2_000_000)).toBe(2_000_000);
  });
});

describe("baseFor", () => {
  it("hands back a base the engine can price, whatever the link asked for", () => {
    expect(baseFor(table, "WLF99L").variant).toBe("WLF99L");
    // iHealthyPricing throws on a variant the table has never heard of
    expect(baseFor(table, "WLF09H").variant).toBe(table.bases[0].variant);
    expect(() => iHealthyPricing(table, {
      base: baseFor(table, "nonsense").variant, sex: "F", age: 35, sumAssured: 150_000,
      plan: "GOLD", territory: THAI, coverage: FULL,
    })).not.toThrow();
  });
});

describe("resolveArrangement", () => {
  it("leaves an arrangement the company sells alone", () => {
    const r = resolveArrangement(table, 35, IHEALTHY_OPENING);
    expect([r.plan?.code, r.territory, r.coverage]).toEqual(["GOLD", THAI, FULL]);
  });

  it("walks a child down to a plan and a territory a child may have", () => {
    const r = resolveArrangement(table, 8, { plan: "PLATINUM", territory: "ทั่วโลก", coverage: FULL });
    expect(r.plans.map((p) => p.code)).toEqual(["SMART", "BRONZE"]);
    expect([r.plan?.code, r.territory]).toEqual(["SMART", THAI]);
  });

  it("drops a way of sharing the bill that the territory does not sell", () => {
    const r = resolveArrangement(table, 35, { plan: "PLATINUM", territory: "ทั่วโลก", coverage: "Co-Payment" });
    expect(r.coverages).toEqual([FULL]);
    expect(r.coverage).toBe(FULL);
  });

  /**
   * The panel prices what the pickers are showing. Every age the page offers, against a
   * preference that is legal at some ages and not at others, has to end somewhere the engine
   * can price and inside the three lists the form is drawing.
   */
  it("settles on something priced at every age the page offers", () => {
    const wanted = { plan: "PLATINUM", territory: "ทั่วโลก", coverage: "Co-Payment" };
    for (let age = table.ageMin; age <= table.ageMax; age++) {
      for (const sex of ["M", "F"] as Sex[]) {
        for (const base of table.bases) {
          const r = resolveArrangement(table, age, wanted);
          expect(r.plan, `age ${age}`).toBeDefined();
          expect(r.plans).toContain(r.plan);
          expect(r.territories).toContain(r.territory);
          expect(r.coverages).toContain(r.coverage);
          const priced = iHealthyPricing(table, {
            base: base.variant, sex, age, sumAssured: sumFor(base, IHEALTHY_OPENING.sumAssured),
            plan: r.plan!.code, territory: r.territory!, coverage: r.coverage!,
          });
          expect(priced, `${base.variant} ${sex} ${age}`).toBeDefined();
        }
      }
    }
  });
});

describe("shownAt", () => {
  it("has nothing to show without a price", () => {
    expect(shownAt(undefined, "annual")).toBeUndefined();
  });

  it("carries the other two instalments with the one on screen", () => {
    const priced = iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 35, sumAssured: 150_000, plan: "GOLD", territory: THAI, coverage: FULL,
    });
    const shown = shownAt(priced, "semi")!;
    expect(shown.others.map((o) => o.mode)).toEqual(["annual", "monthly"]);
    expect(shown.base + shown.rider).toBe(shown.total);
  });

  /**
   * The line under the total that names the company's monthly floor is not decoration: the
   * cheapest arrangement the pickers can reach — the package, สมาร์ท with the deductible, on
   * a man of eighteen — is 945 a month against a floor of a thousand, so a customer can land
   * on a total the company will not take an instalment of.
   */
  it("flags the cheapest instalment the pickers can reach", () => {
    const pkg = table.bases.find((b) => b.fixedSum !== undefined)!;
    let cheapest: { total: number; belowMinimum: boolean } | undefined;
    for (let age = table.ageMin; age <= table.ageMax; age++) {
      for (const plan of plansFor(table, age)) {
        for (const coverage of coveragesFor(table, THAI, age)) {
          const shown = shownAt(iHealthyPricing(table, {
            base: pkg.variant, sex: "M", age, sumAssured: pkg.fixedSum!,
            plan: plan.code, territory: THAI, coverage,
          }), "monthly")!;
          if (cheapest === undefined || shown.total < cheapest.total) cheapest = shown;
        }
      }
    }
    expect(cheapest!.total).toBeLessThan(table.minMonthly * 100);
    expect(cheapest!.belowMinimum).toBe(true);
    // and the arrangement the page opens on is nowhere near it
    expect(shownAt(iHealthyPricing(table, { ...IHEALTHY_OPENING, base: "WLF99H" }), "monthly")!.belowMinimum)
      .toBe(false);
  });
});

/**
 * The four arrangements the page is read back against by hand. Two are the workbook's own
 * examples; all four are here so a rate revision moves a test rather than a sales page.
 */
describe("what the card shows", () => {
  it("prices the arrangement the page opens on", () => {
    expect(baht({ ...IHEALTHY_OPENING, base: "WLF99H" }))
      .toEqual({ base: "2,130", rider: "43,800", total: "45,930" });
  });

  it("prices บรอนซ์ for a woman of 45", () => {
    expect(baht({ ...IHEALTHY_OPENING, age: 45, plan: "BRONZE" })?.rider).toBe("26,700");
  });

  it("prices the package for a boy of 8", () => {
    const pkg = table.bases.find((b) => b.fixedSum !== undefined)!;
    expect(baht({
      ...IHEALTHY_OPENING, sex: "M", age: 8, base: pkg.variant, sumAssured: pkg.fixedSum!, plan: "BRONZE",
    })).toEqual({ base: "380", rider: "38,600", total: "38,980" });
  });

  it("prices แพลทินั่ม anywhere in the world", () => {
    expect(baht({ ...IHEALTHY_OPENING, plan: "PLATINUM", territory: "ทั่วโลก" })?.rider).toBe("563,500");
  });
});
