import { describe, it, expect } from "vitest";
import { premiumBasedRiderPremium } from "@/calc/riders/premium-based";
import { fixedByKeyAgePremium, fixedRateKey } from "@/calc/riders/fixed-by-key-age";
import { compositeCIPremium } from "@/calc/riders/composite-ci";
import { variantRiderPremium } from "@/calc/riders/variant-rate";
import { basePremium } from "@/calc/base-premium";
import ismartJson from "../../data/rates/ismart.json";
import lifetreasureJson from "../../data/rates/lifetreasure.json";
import type { PlanRates } from "@/calc/types";

const ismart = ismartJson as unknown as PlanRates;
const lt = lifetreasureJson as unknown as PlanRates;

describe("base premium (W family)", () => {
  it("iSmart W80F06 female 44, SA 1,000,000, annual = 287 × 1000 = 287,000.00", () => {
    expect(basePremium(ismart, { variant: "W80F06", sex: "F", age: 44, sumAssured: 1_000_000, mode: "annual" }))
      .toEqual({ rate: 287, discount: 0, annual: 28_700_000, modal: 28_700_000 });
  });
  it("ไลฟ์เทรเชอร์ H99F18A male 30, SA 20,000,000: (26.8 − 1.5) × 20,000 = 506,000.00", () => {
    expect(basePremium(lt, { variant: "H99F18A", sex: "M", age: 30, sumAssured: 20_000_000, mode: "annual" }))
      .toEqual({ rate: 26.8, discount: 1.5, annual: 50_600_000, modal: 50_600_000 });
  });
});

describe("premium-based riders (PB, WP)", () => {
  const base = basePremium(ismart, { variant: "W80F06", sex: "F", age: 44, sumAssured: 1_000_000, mode: "annual" })!;

  it("WP is keyed on the insured and uses the pay term as the waive period", () => {
    const r = premiumBasedRiderPremium(ismart, "WP", {
      option: "FIT", insuredAge: 44, insuredSex: "F", payTerm: 6, baseAnnual: base.annual, mode: "annual",
    });
    // 0.08 × TRUNC(287,000/100, 3) = 0.08 × 2870 = 229.60
    expect(r).toEqual({ plancode: "WPTPD", period: 6, rate: 0.08, annual: 22_960, modal: 22_960 });
  });

  it("PB is keyed on the payer", () => {
    const r = premiumBasedRiderPremium(ismart, "PB", {
      option: "BEYOND", insuredAge: 44, insuredSex: "F", payer: { age: 44, sex: "F" }, payTerm: 6, baseAnnual: base.annual, mode: "annual",
    });
    expect(r?.plancode).toBe("PBSDDCI");
    expect(r?.rate).toBe(1.57);
    expect(r?.annual).toBe(450_590); // 1.57 × 2870 = 4,505.90
  });

  it("PB for a juvenile uses the parent table and a shortened waive period", () => {
    const b = basePremium(lt, { variant: "H99F18A", sex: "M", age: 10, sumAssured: 1_000_000, mode: "annual" })!;
    const r = premiumBasedRiderPremium(lt, "PB", {
      option: "FIT", insuredAge: 10, insuredSex: "M", payer: { age: 40, sex: "F" }, payTerm: 18, baseAnnual: b.annual, mode: "annual",
    });
    expect(r?.plancode).toBe("PBPDD");
    expect(r?.period).toBe(15); // MIN(18, 25 − 10)
  });

  it("monthly truncates from the rounded annual", () => {
    const r = premiumBasedRiderPremium(ismart, "WP", {
      option: "FIT", insuredAge: 44, insuredSex: "F", payTerm: 6, baseAnnual: base.annual, mode: "monthly",
    });
    expect(r?.modal).toBe(2_066); // TRUNC(229.60 × 0.09, 2) = 20.66
  });

  it("returns undefined outside the table", () => {
    expect(premiumBasedRiderPremium(ismart, "WP", {
      option: "FIT", insuredAge: 5, insuredSex: "F", payTerm: 6, baseAnnual: base.annual, mode: "annual",
    })).toBeUndefined();
  });
});

describe("fixed-by-key riders (MEX, iHealthy Ultra, Roke Rai So Shield)", () => {
  it("builds the workbook's rate keys", () => {
    expect(fixedRateKey(ismart, "MEX", 44, { option: "2200" })).toBe("2200");
    expect(fixedRateKey(ismart, "RRSS", 44, { option: "แผน XL" })).toBe("MCI4");
    expect(fixedRateKey(ismart, "IHU", 44, { option: "PLATINUM" })).toBe("MHP6S");
    expect(fixedRateKey(ismart, "IHU", 8, { option: "SMART" })).toBe("MHP1J");
    expect(fixedRateKey(ismart, "IHU", 30, { option: "DIAMOND", territory: "เอเชีย" })).toBe("MHP5SA");
    expect(fixedRateKey(ismart, "IHU", 30, { option: "PLATINUM", territory: "ทั่วโลก" })).toBe("MHP6SW");
    expect(fixedRateKey(lt, "IHU", 30, { option: "PLATINUM", coverage: "Deductible" })).toBe("MHPD6S");
  });

  it("MEX female 44 plan 1200 = 9,498 per year", () => {
    expect(fixedByKeyAgePremium(ismart, "MEX", { age: 44, sex: "F", mode: "annual", selection: { option: "1200" } }))
      .toEqual({ key: "1200", annual: 949_800, modal: 949_800 });
  });

  it("iHealthy Ultra Platinum Thailand female 44 = 193,200 per year", () => {
    expect(fixedByKeyAgePremium(ismart, "IHU", { age: 44, sex: "F", mode: "semi", selection: { option: "PLATINUM" } }))
      .toEqual({ key: "MHP6S", annual: 19_320_000, modal: 10_046_400 });
  });

  it("Roke Rai So Shield แผน XL female 44 = 19,424 per year", () => {
    expect(fixedByKeyAgePremium(ismart, "RRSS", { age: 44, sex: "F", mode: "annual", selection: { option: "แผน XL" } }))
      .toEqual({ key: "MCI4", annual: 1_942_400, modal: 1_942_400 });
  });

  it("returns undefined for a key with no rate", () => {
    expect(fixedByKeyAgePremium(ismart, "IHU", { age: 3, sex: "F", mode: "annual", selection: { option: "PLATINUM" } })).toBeUndefined();
  });
});

describe("HIC rounds half-up, the other key riders round down", () => {
  it("HIC female 44 SA 3,000 = ROUND(41.77 × 3, 2)", () => {
    expect(variantRiderPremium(ismart, "HIC", { variant: "HIC", sex: "F", age: 44, sumAssured: 3_000, mode: "annual" }))
      .toMatchObject({ rate: 41.77, annual: Math.round((4177 * 3_000) / 1000) });
  });
  it("DCI female 44 SA 200,000 = 5.8 × 200 = 1,160.00", () => {
    expect(variantRiderPremium(ismart, "DCI", { variant: "DCI", sex: "F", age: 44, sumAssured: 200_000, mode: "annual" }))
      .toEqual({ rate: 5.8, discount: 0, annual: 116_000, modal: 116_000 });
  });
});

describe("CI 123 composite", () => {
  it("splits one sum assured across six components (Excel AI28:AN33)", () => {
    const r = compositeCIPremium(ismart, "CI123", { age: 44, sex: "F", sumAssured: 5_000_000, mode: "annual" })!;
    const by = Object.fromEntries(r.components.map((c) => [c.key, c]));
    expect(by["major ci"]).toMatchObject({ sumAssured: 5_000_000, rate: 7.17, annual: 3_585_000 });
    expect(by["critical care benefit"]).toMatchObject({ sumAssured: 1_250_000, rate: 1.44, annual: 180_000 });
    expect(by["juvenile ci"]).toMatchObject({ sumAssured: 1_250_000, annual: 0 });
    expect(by["pre-early ci"]).toMatchObject({ sumAssured: 100_000, rate: 1.32, annual: 13_200 });
    expect(by["early to intermediate ci"]).toMatchObject({ sumAssured: 1_250_000, rate: 4.07, annual: 508_750 });
    expect(by["special conditions"]).toMatchObject({ sumAssured: 500_000, rate: 3.84, annual: 192_000 });
    expect(r.annual).toBe(4_478_950); // 44,789.50 baht
    expect(r.belowMinimum).toBe(false);
  });

  it("flags a block below the 1,000 baht minimum", () => {
    const r = compositeCIPremium(ismart, "CI123", { age: 44, sex: "F", sumAssured: 100_000, mode: "annual" })!;
    expect(r.belowMinimum).toBe(true);
  });
});
