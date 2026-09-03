import { describe, it, expect } from "vitest";
import d from "../../data/rates/ishield.json";

describe("data/rates/ishield.json", () => {
  it("metadata", () => {
    expect(d.planCode).toBe("ISHIELD");
    expect(d.planName).toBe("iShield");
    expect(d.version).toBe("A2026-1");
    expect(d.expiresOn).toBe("2027-03-31");
    expect(d.modeFactors).toEqual({ annual: 1, semi: 0.52, monthly: 0.09 });
    expect(d.base.variants).toEqual(["WLCI05", "WLCI10", "WLCI15", "WLCI20"]);
    expect(d.base.payTerm).toEqual({ WLCI05: 5, WLCI10: 10, WLCI15: 15, WLCI20: 20 });
  });
  it("base rates ages 0-56", () => {
    expect(Object.keys(d.base.rates.WLCI10.M)).toHaveLength(57);
    expect(d.base.rates.WLCI10.M["35"]).toBe(66.98);
    expect(d.base.rates.WLCI05.M["0"]).toBe(75.46);
    expect(d.base.rates.WLCI20.F["0"]).toBe(18.97);
    expect(d.base.rates.WLCI20.F["57"]).toBeUndefined();
  });
  it("discount all zero", () => {
    expect(d.discount.thresholds).toEqual([350000, 500000, 700000, 1000000, 3000000, 5000000]);
    expect(d.discount.byVariant.WLCI10.every((x: number) => x === 0)).toBe(true);
  });
  it("riders", () => {
    expect(d.riders.AP).toEqual({ kind: "flatRateByClass", rates: [3, 4.05, 5.1, 6] });
    expect(d.riders.ECARE).toEqual({ kind: "flatRateByClass", rates: [6.5, 7.5, 8.5, 10.5] });
    expect(d.riders.MEB.premiums["6"]).toEqual([475, 950, 0, 0, 0, 0]);
    expect(Object.keys(d.riders.MEB.premiums)).toHaveLength(69);
    expect(d.riders.PLS.kind).toBe("ratePerThousandByVariantAgeSex");
    expect(d.riders.PLS.variants).toEqual(["PLS05", "PLS10", "PLS12", "PLS15"]);
    expect(d.riders.PLS.rates.PLS10.M["35"]).toBe(5.13);
    expect(d.riders.PLS.rates.PLS10.F["35"]).toBe(2.53);
    expect(Object.keys(d.riders.PLS.rates.PLS15.F)).toHaveLength(40);
    expect(d.riders.PLS.discountThresholds).toEqual([500000, 1000000]);
    expect(d.riders.PLS.discountValues).toEqual([0.5, 1]);
    expect(d.riders.PB.kind).toBe("payorBenefit");
    expect(d.riders.PB.rates.PBPDD.M["20"]["3"]).toBe(0.21);
    expect(d.riders.PB.rates.PBPDD.M["35"]["10"]).toBe(1.63);
    expect(d.riders.PB.rates.PBSDD.M["40"]["20"]).toBe(5.95);
    expect(d.riders.PB.rates.PBSDD.M["40"]["19"]).toBe(5.48);
    expect((d.riders.PB.rates.PBPDD.M as Record<string, unknown>)["19"]).toBeUndefined();
    expect(Object.keys(d.riders.PB.rates.PBSDDCI.F)).toHaveLength(51);
    expect(Object.keys(d.riders.PB.rates.PBPDDCI.M)).toHaveLength(51);
    expect(Object.keys(d.riders.PB.rates.PBPDD.M["35"])).toHaveLength(18); // periods 3..20
    expect(d.riders.PB.options).toEqual({
      FIT: { name: "สัญญาเพิ่มเติมพีบี ฟิต", parent: "PBPDD", spouse: "PBSDD" },
      BEYOND: { name: "สัญญาเพิ่มเติมพีบี บียอนด์", parent: "PBPDDCI", spouse: "PBSDDCI" },
    });
  });
});
