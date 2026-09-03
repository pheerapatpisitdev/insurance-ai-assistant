import { describe, it, expect } from "vitest";
import plb from "../../data/rates/plb.json";

describe("data/rates/plb.json", () => {
  it("has metadata", () => {
    expect(plb.planCode).toBe("PLB");
    expect(plb.version).toBe("A2026-1");
    expect(plb.expiresOn).toBe("2027-03-31");
    expect(plb.modeFactors).toEqual({ annual: 1, semi: 0.52, monthly: 0.09 });
  });

  it("has base rates for ages 20-59 for every variant/sex", () => {
    for (const v of ["PLB05", "PLB10", "PLB12", "PLB15"]) {
      for (const s of ["M", "F"]) {
        const table = (plb.base.rates as Record<string, Record<string, Record<string, number>>>)[v][s];
        expect(Object.keys(table)).toHaveLength(40);
        expect(table["20"]).toBeTypeOf("number");
        expect(table["59"]).toBeTypeOf("number");
        expect(table["19"]).toBeUndefined();
      }
    }
    expect(plb.base.rates.PLB12.M["35"]).toBe(6.47);
    expect(plb.base.rates.PLB12.F["35"]).toBe(3.67);
    expect(plb.base.rates.PLB12.M["59"]).toBe(31.78);
    expect(plb.base.rates.PLB05.M["55"]).toBe(17.2);
  });

  it("has discount tiers", () => {
    expect(plb.discount.thresholds).toEqual([350000, 500000, 700000, 1000000]);
    expect(plb.discount.byVariant.PLB12).toEqual([0, 0.5, 0.5, 1]);
    expect(plb.discount.byVariant.PLB05).toEqual([0, 0.5, 0.5, 1]);
  });

  it("has rider tables", () => {
    expect(plb.riders.AP.rates["0"]).toEqual([3, 4.05, 5.1, 6]);
    expect(plb.riders.AP.rates["60"]).toEqual([3, 4.05, 5.1, 6]);
    expect(Object.keys(plb.riders.AP.rates)).toHaveLength(61);
    expect(plb.riders.ECARE.rates["16"]).toEqual([6.5, 7.5, 8.5, 10.5]);
    expect(Object.keys(plb.riders.ECARE.rates)).toHaveLength(45);
    expect(plb.riders.MEB.plans).toEqual([500, 1000, 2000, 3000, 4000, 5000]);
    expect(plb.riders.MEB.premiums["6"]).toEqual([475, 950, 0, 0, 0, 0]);
    expect(plb.riders.MEB.premiums["74"]).toEqual([3210, 6420, 12840, 19260, 25680, 32100]);
    expect(Object.keys(plb.riders.MEB.premiums)).toHaveLength(69);
  });
});
