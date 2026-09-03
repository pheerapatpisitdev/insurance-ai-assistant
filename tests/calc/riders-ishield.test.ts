import { describe, it, expect } from "vitest";
import { ratePerThousandRiderPremium } from "@/calc/riders/rate-per-thousand";
import { variantRiderPremium } from "@/calc/riders/variant-rate";
import { payorBenefitPremium } from "@/calc/riders/payor-benefit";
import { basePremium } from "@/calc/base-premium";
import { toHundredths, floorDiv } from "@/calc/money";
import json from "../../data/rates/ishield.json";
import type { PlanRates } from "@/calc/types";

const d = json as unknown as PlanRates;

describe("AP / ECARE flat rate by class (iShield)", () => {
  it("AP ignores age: 3 per 1,000", () => {
    expect(ratePerThousandRiderPremium(d, "AP", { age: 3, sumAssured: 200_000, mode: "annual" })).toEqual({ rate: 3, annual: 60_000, modal: 60_000 });
    expect(ratePerThousandRiderPremium(d, "AP", { age: 59, sumAssured: 200_000, mode: "monthly" })).toEqual({ rate: 3, annual: 60_000, modal: 5_400 });
  });
  it("ECARE 6.5 per 1,000", () => {
    expect(ratePerThousandRiderPremium(d, "ECARE", { age: 30, sumAssured: 1_000_000, mode: "semi" })).toEqual({ rate: 6.5, annual: 650_000, modal: 338_000 });
  });
});

describe("PLS (rate by variant, age, sex with own discount)", () => {
  it("PLS10 M 35 SA 1,000,000 annual: (5.13 - 1) * 1000 = 4130.00", () => {
    expect(variantRiderPremium(d, "PLS", { variant: "PLS10", sex: "M", age: 35, sumAssured: 1_000_000, mode: "annual" }))
      .toEqual({ rate: 5.13, discount: 1, annual: 413_000, modal: 413_000 });
  });
  it("semi applies 0.52 to unrounded product", () => {
    expect(variantRiderPremium(d, "PLS", { variant: "PLS10", sex: "M", age: 35, sumAssured: 1_000_000, mode: "semi" })?.modal).toBe(214_760);
  });
  it("PLS10 F 35 SA 400,000 monthly: 2.53 * 400 = 1012.00; * 0.09 = 91.08", () => {
    expect(variantRiderPremium(d, "PLS", { variant: "PLS10", sex: "F", age: 35, sumAssured: 400_000, mode: "monthly" }))
      .toEqual({ rate: 2.53, discount: 0, annual: 101_200, modal: 9_108 });
  });
  it("discount 0.5 at 500,000", () => {
    expect(variantRiderPremium(d, "PLS", { variant: "PLS05", sex: "M", age: 40, sumAssured: 500_000, mode: "annual" })?.discount).toBe(0.5);
    expect(variantRiderPremium(d, "PLS", { variant: "PLS05", sex: "M", age: 40, sumAssured: 499_999, mode: "annual" })?.discount).toBe(0);
  });
  it("undefined outside table / unknown variant", () => {
    expect(variantRiderPremium(d, "PLS", { variant: "PLS10", sex: "M", age: 19, sumAssured: 300_000, mode: "annual" })).toBeUndefined();
    expect(variantRiderPremium(d, "PLS", { variant: "PLS99", sex: "M", age: 30, sumAssured: 300_000, mode: "annual" })).toBeUndefined();
  });
});

describe("PB payor benefit", () => {
  const base = basePremium(d, { variant: "WLCI10", sex: "M", age: 11, sumAssured: 500_000, mode: "annual" })!;
  it("base for the example is 22,105.00", () => {
    expect(base.annual).toBe(2_210_500);
  });
  it("parent: insured 11, iShield 10, payer M 35, FIT → PBPDDM35 period 10 rate 1.63 → 360.31", () => {
    const r = payorBenefitPremium(d, "PB", { option: "FIT", insuredAge: 11, payer: { age: 35, sex: "M" }, payTerm: 10, baseAnnual: base.annual, mode: "annual" });
    expect(r).toEqual({ plancode: "PBPDD", period: 10, rate: 1.63, annual: 36_031, modal: 36_031 });
  });
  it("monthly is TRUNC from the rounded annual: 360.31 * 0.09 = 32.4279 → 32.42", () => {
    const r = payorBenefitPremium(d, "PB", { option: "FIT", insuredAge: 11, payer: { age: 35, sex: "M" }, payTerm: 10, baseAnnual: base.annual, mode: "monthly" });
    expect(r?.modal).toBe(3_242);
  });
  it("parent period = MIN(payTerm, 25 - insuredAge)", () => {
    const r = payorBenefitPremium(d, "PB", { option: "FIT", insuredAge: 15, payer: { age: 35, sex: "M" }, payTerm: 20, baseAnnual: base.annual, mode: "annual" });
    expect(r?.period).toBe(10);
  });
  it("spouse: insured 35, iShield 20, payer F 40, BEYOND → PBSDDCI F 40 period 20", () => {
    const rider = d.riders.PB;
    const rate = rider.kind === "payorBenefit" ? rider.rates.PBSDDCI.F["40"]["20"] : NaN;
    const b = 1_000_000; // 10,000.00 baht base annual
    const r = payorBenefitPremium(d, "PB", { option: "BEYOND", insuredAge: 35, payer: { age: 40, sex: "F" }, payTerm: 20, baseAnnual: b, mode: "annual" });
    expect(r?.plancode).toBe("PBSDDCI");
    expect(r?.period).toBe(20);
    expect(r?.annual).toBe(floorDiv(toHundredths(rate) * floorDiv(b, 10), 1000));
  });
  it("undefined when payer age not in table or option unknown", () => {
    expect(payorBenefitPremium(d, "PB", { option: "FIT", insuredAge: 11, payer: { age: 19, sex: "M" }, payTerm: 10, baseAnnual: base.annual, mode: "annual" })).toBeUndefined();
    expect(payorBenefitPremium(d, "PB", { option: "GOLD", insuredAge: 11, payer: { age: 35, sex: "M" }, payTerm: 10, baseAnnual: base.annual, mode: "annual" })).toBeUndefined();
  });
});
