import { describe, it, expect } from "vitest";
import ismart from "../../data/rates/ismart.json";
import lifetreasure from "../../data/rates/lifetreasure.json";
import lifeprotect from "../../data/rates/lifeprotect.json";
import type { PlanRates } from "@/calc/types";

const plans = { ismart, lifetreasure, lifeprotect } as unknown as Record<string, PlanRates>;

describe("W-family rate files", () => {
  it("share the same metadata shape", () => {
    for (const [name, d] of Object.entries(plans)) {
      expect(d.version, name).toBe("A2026-1");
      expect(d.expiresOn, name).toBe("2027-03-31");
      expect(d.modeFactors, name).toEqual({ annual: 1, semi: 0.52, monthly: 0.09 });
      expect(d.base.variants.length, name).toBeGreaterThan(0);
      expect(Object.keys(d.riders).sort(), name).toEqual(
        ["AP", "CI123", "CPR", "DCI", "ECARE", "HIC", "IHU", "MEB", "MEX", "PB", "PLS", "RRSS", "WP"],
      );
    }
  });

  it("iSmart base rates and packages match the workbook", () => {
    const d = plans.ismart;
    expect(d.planCode).toBe("ISMART");
    expect(d.planName).toBe("ไอสมาร์ท 80/6 (ไม่มีเงินปันผล)");
    expect(d.base.variants).toEqual(["W80F06"]);
    expect(d.base.payTerm!.W80F06).toBe(6);
    expect(d.base.rates.W80F06.F["44"]).toBe(287);
    expect(d.base.rates.W80F06.M["44"]).toBe(302);
    expect(d.base.rates.W80F06.M["24"]).toBeUndefined(); // issue age starts at 25
    expect(d.discount.byVariant.W80F06).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it("ไลฟ์เทรเชอร์ has three packages with their own discount ladders", () => {
    const d = plans.lifetreasure;
    expect(d.base.variants).toEqual(["H99F06A", "H99F12A", "H99F18A"]);
    expect(d.base.rates.H99F18A.M["30"]).toBe(26.8);
    expect(d.discount.byVariant.H99F18A).toEqual([0.5, 0.5, 0.5, 1, 1.5, 1.5]);
    expect(d.discount.thresholds).toEqual([300000, 500000, 700000, 1000000, 3000000, 5000000]);
  });

  it("ไลฟ์ โพรเทค+ has eight packages", () => {
    const d = plans.lifeprotect;
    expect(d.base.variants).toHaveLength(8);
    expect(d.base.rates.WLF19H.F["45"]).toBe(32);
    expect(d.base.packages!.find((p) => p.code === "WLF99HX")!.name).toBe("Health Ultra Package");
  });

  it("rider tables match the workbook", () => {
    const d = plans.ismart;
    const r = d.riders;
    expect(r.AP).toEqual({ kind: "flatRateByClass", rates: [3, 4.05, 5.1, 6] });
    expect(r.ECARE).toEqual({ kind: "flatRateByClass", rates: [6.5, 7.5, 8.5, 10.5] });
    if (r.MEB.kind !== "fixedByAgePlan") throw new Error("MEB kind");
    expect(r.MEB.premiums["44"]).toEqual([750, 1500, 3000, 4500, 6000, 7500]);
    if (r.PB.kind !== "premiumBased" || r.WP.kind !== "premiumBased") throw new Error("PB/WP kind");
    expect(r.PB.by).toBe("payer");
    expect(r.WP.by).toBe("insured");
    expect(r.PB.rates.PBSDDCI.F["44"]["6"]).toBe(1.57);
    expect(r.WP.rates.WPTPD.F["44"]["6"]).toBe(0.08);
    if (r.MEX.kind !== "fixedByKeyAge" || r.IHU.kind !== "fixedByKeyAge" || r.RRSS.kind !== "fixedByKeyAge") throw new Error("fixed kind");
    expect(r.MEX.plans).toEqual(["1200", "2200", "3200", "4200", "6200"]);
    expect(r.MEX.rates["1200"].F["44"]).toBe(9498);
    expect(r.IHU.rates.MHP6S.F["44"]).toBe(193200);
    expect(r.IHU.planNo).toEqual({ SMART: 1, BRONZE: 2, SILVER: 3, GOLD: 4, DIAMOND: 5, PLATINUM: 6 });
    expect(r.RRSS.rates.MCI4.F["44"]).toBe(19424);
    if (r.DCI.kind !== "ratePerThousandByVariantAgeSex" || r.HIC.kind !== "ratePerThousandByVariantAgeSex") throw new Error("kind");
    expect(r.DCI.rates.DCI.F["44"]).toBe(5.8);
    expect(r.HIC.rates.HIC.F["44"]).toBe(41.77);
    expect(r.HIC.rounding).toBe("round");
    if (r.CI123.kind !== "compositeCI") throw new Error("CI123 kind");
    expect(r.CI123.minAnnual).toBe(1000);
    expect(r.CI123.components.map((c) => c.key)).toEqual([
      "major ci", "critical care benefit", "juvenile ci", "pre-early ci", "early to intermediate ci", "special conditions",
    ]);
    expect(r.CI123.rates["major ci"].F["44"]).toBe(7.17);
  });

  it("ไลฟ์เทรเชอร์ rider values match the workbook", () => {
    const r = plans.lifetreasure.riders;
    if (r.WP.kind !== "premiumBased" || r.MEX.kind !== "fixedByKeyAge" || r.IHU.kind !== "fixedByKeyAge" || r.RRSS.kind !== "fixedByKeyAge") throw new Error("kind");
    expect(r.WP.rates.WPTPD.M["30"]["18"]).toBe(0.35);
    expect(r.MEX.rates["1200"].M["30"]).toBe(5499);
    expect(r.IHU.rates.MHPD6S.M["30"]).toBe(98000); // Platinum, deductible, Thailand
    expect(r.RRSS.rates.MCI1.M["30"]).toBe(1588);
  });
});
