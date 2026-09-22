import { describe, it, expect } from "vitest";
import {
  availablePensionAges, pensionTax, quotePension, PENSION_AGES,
  type PensionBasis, type PensionInput, type PensionPay,
} from "@/calc/pension/engine";
import mainOracle from "./pension/main-premiums.json";
import illustrationOracle from "./pension/illustration.json";

/**
 * บำนาญ สมาร์ท 95 against the company workbook.
 *
 * Both oracles are the source calculator's (Advisortool/pension-smart95/test/oracle): the
 * workbook recomputed in LibreOffice for each case. Its verify script is what these replace,
 * with the same tolerances.
 */

interface OracleCase {
  case: { age: number; gender: string; annuityAge: number; payOption: string; inputType: string; amount: number; mode?: string };
  rate: number;
  SA: number;
  mainMode: number;
}

const BASIS: Record<string, PensionBasis> = {
  "จำนวนเงินเอาประกันภัย": "sumAssured",
  "เบี้ยประกันภัย": "premium",
  "เงินบำนาญรายเดือน": "monthlyPension",
};

function inputOf(c: OracleCase["case"]): PensionInput {
  return {
    age: c.age,
    sex: c.gender === "ชาย" ? "M" : "F",
    annuityAge: c.annuityAge,
    pay: (c.payOption === "ชำระเบี้ย 6 ปี" ? "6" : "untilAnnuity") as PensionPay,
    mode: c.mode === "รายเดือน" ? "monthly" : "annual",
    basis: BASIS[c.inputType],
    amount: c.amount,
  };
}

describe("บำนาญ สมาร์ท 95 main premium, case by case against the workbook", () => {
  for (const o of Object.values(mainOracle as Record<string, OracleCase>)) {
    it(JSON.stringify(o.case), () => {
      const r = quotePension(inputOf(o.case));
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(Math.abs(r.quote.sumAssured - o.SA)).toBeLessThanOrEqual(2);
      expect(r.quote.rate).toBeCloseTo(o.rate, 2);
      expect(Math.abs(r.quote.modePremium - o.mainMode)).toBeLessThanOrEqual(0.02);
    });
  }
});

describe("the yearly table, man of 40, pension at 70, sum assured 100,000", () => {
  const r = quotePension({ age: 40, sex: "M", annuityAge: 70, pay: "untilAnnuity", mode: "annual", basis: "sumAssured", amount: 100_000 });
  if (!r.ok) throw new Error(r.error);
  const byAge = new Map(r.quote.illustration.map((y) => [y.age, y]));

  for (const o of illustrationOracle as Record<string, number>[]) {
    it(`age ${o.age}`, () => {
      const y = byAge.get(o.age)!;
      const death = o.age < 70 ? o.death : o.deathDuring;
      const pairs: [number, number | undefined][] = [
        [y.premium, o.prem], [y.cumPremium, o.cumPrem], [y.cashValue, o.cv], [y.pension, o.pension], [y.deathBenefit, death],
      ];
      for (const [got, want] of pairs) {
        if (want != null) expect(Math.abs(got - want)).toBeLessThanOrEqual(1.5);
      }
    });
  }

  it("pays 15% of the sum a year until 75 and 30% from 86", () => {
    expect(r.quote.bands).toEqual([
      { fromAge: 70, toAge: 75, percent: 0.15, annual: 15_000 },
      { fromAge: 76, toAge: 80, percent: 0.2, annual: 20_000 },
      { fromAge: 81, toAge: 85, percent: 0.25, annual: 25_000 },
      { fromAge: 86, toAge: 95, percent: 0.3, annual: 30_000 },
    ]);
    expect(r.quote.monthlyPension).toBe(1_270);
  });
});

describe("the tax sheet", () => {
  it("matches คำนวณภาษี F29 and F33", () => {
    const t = pensionTax({
      income: 100_000, retirementFunds: 10_000 + 123_123 + 456 + 123,
      lifePremiums: 50_000, annuityPremiums: 11_111, marginalRate: 0.1,
    });
    expect(t.maxPremium).toBeCloseTo(53_889, 2);
    expect(t.taxSaved).toBeCloseTo(5_388.9, 2);
  });
});

describe("what it refuses", () => {
  const base: PensionInput = { age: 40, sex: "M", annuityAge: 60, pay: "untilAnnuity", mode: "annual", basis: "sumAssured", amount: 1_000_000 };

  it("a pension age the person is already too old for", () => {
    const r = quotePension({ ...base, age: 50, annuityAge: 55 });
    expect(r.ok).toBe(false);
  });

  it("sums outside 75,000–20,000,000", () => {
    expect(quotePension({ ...base, amount: 50_000 }).ok).toBe(false);
    expect(quotePension({ ...base, amount: 25_000_000 }).ok).toBe(false);
  });

  it("prices every age each plan accepts, on both paying terms and every mode", () => {
    let priced = 0;
    for (const pay of ["6", "untilAnnuity"] as const) {
      for (let age = 20; age <= 65; age++) {
        for (const annuityAge of availablePensionAges(age, pay)) {
          for (const mode of ["annual", "monthly"] as const) {
            const r = quotePension({ ...base, age, pay, annuityAge, mode, amount: 100_000 });
            expect(r.ok, `${pay} ${age} ${annuityAge}`).toBe(true);
            if (r.ok) expect(r.quote.modePremium).toBeGreaterThan(0);
            priced++;
          }
        }
      }
    }
    expect(priced).toBeGreaterThan(300);
    expect(PENSION_AGES.every((a) => availablePensionAges(20, "6").includes(a))).toBe(true);
  });
});
