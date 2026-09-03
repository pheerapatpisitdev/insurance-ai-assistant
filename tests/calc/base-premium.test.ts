import { describe, it, expect } from "vitest";
import { basePremium } from "@/calc/base-premium";
import plbJson from "../../data/rates/plb.json";
import type { PlanRates } from "@/calc/types";

const plb = plbJson as unknown as PlanRates;

describe("basePremium", () => {
  it("PLB12 male 35, SA 1,000,000, annual: (6.47-1)*1000 = 5470.00", () => {
    const r = basePremium(plb, { variant: "PLB12", sex: "M", age: 35, sumAssured: 1_000_000, mode: "annual" });
    expect(r).toEqual({ rate: 6.47, discount: 1, annual: 547_000, modal: 547_000 });
  });
  it("semi-annual applies 0.52 to the unrounded product", () => {
    const r = basePremium(plb, { variant: "PLB12", sex: "M", age: 35, sumAssured: 1_000_000, mode: "semi" });
    expect(r?.modal).toBe(284_440);
  });
  it("monthly applies 0.09", () => {
    const r = basePremium(plb, { variant: "PLB12", sex: "F", age: 35, sumAssured: 300_000, mode: "monthly" });
    expect(r).toEqual({ rate: 3.67, discount: 0, annual: 110_100, modal: 9_909 });
  });
  it("returns undefined when the age has no rate", () => {
    expect(basePremium(plb, { variant: "PLB12", sex: "M", age: 60, sumAssured: 300_000, mode: "annual" })).toBeUndefined();
  });
});
