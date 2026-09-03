import { describe, it, expect } from "vitest";
import { ratePerThousandRiderPremium } from "@/calc/riders/rate-per-thousand";
import { fixedPlanRiderPremium } from "@/calc/riders/fixed-by-plan";
import plbJson from "../../data/rates/plb.json";
import type { PlanRates } from "@/calc/types";

const plb = plbJson as unknown as PlanRates;

describe("AP / ECARE (rate per 1,000, class 1)", () => {
  it("AP 1,000,000 age 35 annual = 3 * 1000 = 3000.00", () => {
    expect(ratePerThousandRiderPremium(plb, "AP", { age: 35, sumAssured: 1_000_000, mode: "annual" }))
      .toEqual({ rate: 3, annual: 300_000, modal: 300_000 });
  });
  it("ECARE 500,000 age 35 monthly = 3250.00 annual; *0.09 = 292.50", () => {
    expect(ratePerThousandRiderPremium(plb, "ECARE", { age: 35, sumAssured: 500_000, mode: "monthly" }))
      .toEqual({ rate: 6.5, annual: 325_000, modal: 29_250 });
  });
  it("modal is floored from the unrounded product", () => {
    expect(ratePerThousandRiderPremium(plb, "AP", { age: 20, sumAssured: 123_456, mode: "semi" }))
      .toEqual({ rate: 3, annual: 37_036, modal: 19_259 });
  });
  it("returns undefined outside the table", () => {
    expect(ratePerThousandRiderPremium(plb, "ECARE", { age: 15, sumAssured: 100_000, mode: "annual" })).toBeUndefined();
    expect(ratePerThousandRiderPremium(plb, "AP", { age: 61, sumAssured: 100_000, mode: "annual" })).toBeUndefined();
  });
});

describe("MEB (fixed premium by plan)", () => {
  it("age 35 plan 1000 annual", () => {
    const p = plb.riders.MEB.kind === "fixedByAgePlan" ? plb.riders.MEB.premiums["35"][1] : NaN;
    expect(p).toBeGreaterThan(0);
    expect(fixedPlanRiderPremium(plb, "MEB", { age: 35, plan: 1000, mode: "annual" })).toEqual({ annual: p * 100, modal: p * 100 });
  });
  it("age 74 plan 5000 semi = 32100 * 0.52 = 16692.00", () => {
    expect(fixedPlanRiderPremium(plb, "MEB", { age: 74, plan: 5000, mode: "semi" })).toEqual({ annual: 3_210_000, modal: 1_669_200 });
  });
  it("age 6 plan 500 monthly = 475 * 0.09 = 42.75", () => {
    expect(fixedPlanRiderPremium(plb, "MEB", { age: 6, plan: 500, mode: "monthly" })).toEqual({ annual: 47_500, modal: 4_275 });
  });
  it("returns undefined when table has 0 or no entry", () => {
    expect(fixedPlanRiderPremium(plb, "MEB", { age: 6, plan: 2000, mode: "annual" })).toBeUndefined();
    expect(fixedPlanRiderPremium(plb, "MEB", { age: 5, plan: 500, mode: "annual" })).toBeUndefined();
  });
});
