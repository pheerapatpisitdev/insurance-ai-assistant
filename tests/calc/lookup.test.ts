import { describe, it, expect } from "vitest";
import { baseRate, riderRateByAgeClass, fixedPremiumByAgePlan } from "@/calc/lookup";
import plbJson from "../../data/rates/plb.json";
import type { PlanRates } from "@/calc/types";

const plb = plbJson as unknown as PlanRates;

describe("lookup", () => {
  it("baseRate finds rate per 1,000 or undefined", () => {
    expect(baseRate(plb, "PLB12", "M", 35)).toBe(6.47);
    expect(baseRate(plb, "PLB12", "F", 35)).toBe(3.67);
    expect(baseRate(plb, "PLB12", "M", 19)).toBeUndefined();
    expect(baseRate(plb, "PLB12", "M", 60)).toBeUndefined();
    expect(baseRate(plb, "NOPE", "M", 35)).toBeUndefined();
  });

  it("riderRateByAgeClass uses class 1..4 (1-based)", () => {
    expect(riderRateByAgeClass(plb, "AP", 35, 1)).toBe(3);
    expect(riderRateByAgeClass(plb, "AP", 35, 4)).toBe(6);
    expect(riderRateByAgeClass(plb, "AP", 61, 1)).toBeUndefined();
    expect(riderRateByAgeClass(plb, "ECARE", 15, 1)).toBeUndefined();
    expect(riderRateByAgeClass(plb, "ECARE", 16, 1)).toBe(6.5);
    expect(riderRateByAgeClass(plb, "MEB", 16, 1)).toBeUndefined(); // wrong kind
  });

  it("fixedPremiumByAgePlan finds the fixed premium or undefined", () => {
    expect(fixedPremiumByAgePlan(plb, "MEB", 6, 500)).toBe(475);
    expect(fixedPremiumByAgePlan(plb, "MEB", 74, 5000)).toBe(32100);
    expect(fixedPremiumByAgePlan(plb, "MEB", 6, 2000)).toBe(0); // 0 = not offered
    expect(fixedPremiumByAgePlan(plb, "MEB", 5, 500)).toBeUndefined();
    expect(fixedPremiumByAgePlan(plb, "MEB", 30, 999)).toBeUndefined();
    expect(fixedPremiumByAgePlan(plb, "AP", 30, 500)).toBeUndefined(); // wrong kind
  });
});
