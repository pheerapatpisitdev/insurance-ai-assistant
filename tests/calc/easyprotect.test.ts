import { describe, it, expect } from "vitest";
import rates from "../../data/rates/easyprotect.json";
import rules from "../../data/rules/easyprotect.json";
import { quote } from "@/calc/quote";
import { cashValueSchedule, hasCashValues, maturityValue } from "@/calc/cash-value";
import { getPlan, listPlans } from "@/calc/plans/registry";
import type { PlanRates, QuoteInput } from "@/calc/types";

const d = rates as unknown as PlanRates;
const base: QuoteInput = {
  planCode: "EASYPROTECT", variant: "W99F06A", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: [],
};
const by = (r: ReturnType<typeof quote>) => Object.fromEntries(r.items.map((i) => [i.code, i]));

/**
 * อีซี่ โพรเทค 6 comes from the agency's own calculator rather than from a workbook on this
 * machine, so these are the figures that tool prints, recomputed here. The arithmetic it does
 * is this engine's: ROUNDDOWN(rate × ทุน ÷ 1000, 2), then the mode factor, rounded down again.
 */
describe("อีซี่ โพรเทค 6 rate file", () => {
  it("carries the A2026-1 metadata the rest of the library is on", () => {
    expect(d.planCode).toBe("EASYPROTECT");
    expect(d.planName).toBe("อีซี่ โพรเทค 6");
    expect(d.version).toBe("A2026-1");
    expect(d.expiresOn).toBe("2027-03-31");
    expect(d.modeFactors).toEqual({ annual: 1, semi: 0.52, monthly: 0.09 });
  });

  it("is one package: six years of premium, one issue-age range, no discount ladder", () => {
    expect(d.base.variants).toEqual(["W99F06A"]);
    expect(d.base.payTerm!.W99F06A).toBe(6);
    expect(d.base.packages).toEqual([{
      code: "W99F06A", plancode: "W99F06A", name: "ชำระเบี้ย 6 ปี",
      ageMin: 0, ageMax: 80, seq: 1, payTerm: 6, rateKey: "06",
    }]);
    expect(d.discount).toEqual({ thresholds: [], byVariant: { W99F06A: [] } });
  });

  it("holds every issue age 0-80 for both sexes", () => {
    for (const sex of ["M", "F"] as const) {
      const ages = Object.keys(d.base.rates.W99F06A[sex]).map(Number).sort((a, b) => a - b);
      expect(ages[0], sex).toBe(0);
      expect(ages.at(-1), sex).toBe(80);
      expect(ages.length, sex).toBe(81);
    }
    expect(d.base.rates.W99F06A.M["35"]).toBe(68);
    expect(d.base.rates.W99F06A.F["35"]).toBe(61.9);
  });

  it("sells only the seven riders the plan's own calculator sells", () => {
    expect(Object.keys(d.riders).sort()).toEqual(["CI123", "DCI", "IHU", "MEB", "PB", "PLS", "WP"]);
    expect(Object.keys(rules.riders).sort()).toEqual(["CI123", "DCI", "IHU", "MEB", "PB", "PLS", "WP"]);
    expect(getPlan("EASYPROTECT")!.riderOrder).toEqual(["PB", "WP", "MEB", "DCI", "PLS", "IHU", "CI123"]);
  });

  it("stands in the plan picker under its own name", () => {
    expect(listPlans().map((p) => p.code)).toContain("EASYPROTECT");
    expect(listPlans().find((p) => p.code === "EASYPROTECT")!.name).toBe("อีซี่ โพรเทค 6");
  });
});

describe("quote (อีซี่ โพรเทค 6)", () => {
  it("base only: 68 × 1,000 = 68,000.00 a year, 6,120.00 a month", () => {
    const r = quote(base, new Date("2026-09-03"));
    expect(r.items[0]).toMatchObject({ code: "W99F06A", annual: 6_800_000, modal: 6_800_000, eligible: true });
    expect(r.items[0].name).toBe("อีซี่ โพรเทค 6 — ชำระเบี้ย 6 ปี");
    expect(quote({ ...base, mode: "monthly" }).items[0].modal).toBe(612_000);
    expect(quote({ ...base, mode: "semi" }).items[0].modal).toBe(3_536_000);
  });

  it("a woman of 35 pays the women's rate, 61.90", () => {
    expect(quote({ ...base, sex: "F" }).items[0].annual).toBe(6_190_000);
  });

  it("is issued from 0 to 80 and from five hundred thousand up", () => {
    expect(quote({ ...base, age: 80 }).items[0].eligible).toBe(true);
    expect(quote({ ...base, age: 81 }).warnings).toContainEqual(
      { level: "error", code: "BASE_AGE", message: "อายุรับประกัน 0 - 80 ปี" },
    );
    expect(quote({ ...base, sumAssured: 400_000 }).warnings.map((w) => w.code)).toContain("BASE_SA_MIN");
    expect(quote({ ...base, sumAssured: 500_000 }).items[0].eligible).toBe(true);
  });

  it("offers the seven riders and refuses PB together with WP", () => {
    const r = quote({ ...base, payer: { age: 40, sex: "F" }, riders: [{ code: "PB", option: "FIT" }, { code: "WP", option: "FIT" }] });
    expect(r.availability.map((a) => a.code)).toEqual(["PB", "WP", "MEB", "DCI", "PLS", "IHU", "CI123"]);
    expect(r.warnings).toContainEqual(
      { level: "error", code: "PB_WP", message: "กรุณาเลือก WP หรือ PB อย่างใดอย่างหนึ่ง" },
    );
    expect(by(r).PB.eligible).toBe(false);
  });

  it("pays the whole sum assured to somebody who reaches 99", () => {
    expect(quote(base).maturityBenefit).toEqual({ age: 99, amount: 1_000_000 });
  });
});

describe("อีซี่ โพรเทค 6 surrender table", () => {
  it("runs from policy year 1 to the year the insured turns 98", () => {
    expect(hasCashValues("EASYPROTECT")).toBe(true);
    const rows = cashValueSchedule("EASYPROTECT", "W99F06A", "M", 35, 1_000_000);
    expect(rows.length).toBe(64);
    expect(rows[0]).toEqual({ age: 35, policyYear: 1, amount: 0 });
    expect(rows.at(-1)!.age).toBe(98);
  });

  it("is worth the sum assured itself at the end of the contract", () => {
    for (const age of [0, 35, 60, 80]) {
      const rows = cashValueSchedule("EASYPROTECT", "W99F06A", "F", age, 1_000_000);
      expect(maturityValue(rows)!.age, `issued at ${age}`).toBe(99);
      expect(maturityValue(rows)!.amount, `issued at ${age}`).toBeGreaterThanOrEqual(1_000_000);
    }
  });
});
