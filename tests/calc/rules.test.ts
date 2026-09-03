import { describe, it, expect } from "vitest";
import { riderAvailability, checkRiderInput, checkCombined, checkMonthlyMinimum } from "@/calc/rules";
import rulesJson from "../../data/rules/plb.json";
import ratesJson from "../../data/rates/plb.json";
import type { PlanRules, PlanRates } from "@/calc/types";

const rules = rulesJson as unknown as PlanRules;
const rates = ratesJson as unknown as PlanRates;

describe("riderAvailability", () => {
  it("AP: eligible at 35 with SA min/max from base", () => {
    const a = riderAvailability(rules, rates, "AP", { age: 35, baseSumAssured: 1_000_000 });
    expect(a).toMatchObject({ code: "AP", eligible: true, ageRange: "0 - 60 ปี", saMin: 100_000, saMax: 5_000_000 });
  });
  it("AP: cap at 10,000,000", () => {
    expect(riderAvailability(rules, rates, "AP", { age: 35, baseSumAssured: 3_000_000 }).saMax).toBe(10_000_000);
  });
  it("ECARE: not eligible under 16", () => {
    const a = riderAvailability(rules, rates, "ECARE", { age: 15, baseSumAssured: 1_000_000 });
    expect(a.eligible).toBe(false);
    expect(a.reason).toBe("ไม่สามารถซื้อได้");
    expect(a.ageRange).toBe("16 - 60 ปี");
  });
  it("MEB: plans allowed by age", () => {
    expect(riderAvailability(rules, rates, "MEB", { age: 8, baseSumAssured: 300_000 }).plans).toEqual([500]);
    expect(riderAvailability(rules, rates, "MEB", { age: 12, baseSumAssured: 300_000 }).plans).toEqual([500, 1000]);
    expect(riderAvailability(rules, rates, "MEB", { age: 40, baseSumAssured: 300_000 }).plans).toEqual([500, 1000, 2000, 3000, 4000, 5000]);
    expect(riderAvailability(rules, rates, "MEB", { age: 66, baseSumAssured: 300_000 }).eligible).toBe(false);
  });
});

describe("checkRiderInput", () => {
  const ctx = { age: 35, baseSumAssured: 300_000 };
  it("AP over max → message", () => {
    expect(checkRiderInput(rules, rates, "AP", ctx, { code: "AP", sumAssured: 2_000_000 })).toBe("AP เกินกว่าที่กำหนด");
  });
  it("AP under min → message", () => {
    expect(checkRiderInput(rules, rates, "AP", ctx, { code: "AP", sumAssured: 50_000 })).toBe("AP ต่ำกว่าขั้นต่ำ 100,000");
  });
  it("AP within range → undefined", () => {
    expect(checkRiderInput(rules, rates, "AP", ctx, { code: "AP", sumAssured: 1_000_000 })).toBeUndefined();
  });
  it("MEB plan over max for age → message", () => {
    expect(checkRiderInput(rules, rates, "MEB", { age: 12, baseSumAssured: 300_000 }, { code: "MEB", plan: 2000 })).toBe("MEB เกินกว่าที่กำหนด");
  });
  it("ineligible age → message", () => {
    expect(checkRiderInput(rules, rates, "ECARE", { age: 15, baseSumAssured: 300_000 }, { code: "ECARE", sumAssured: 100_000 })).toBe("ไม่สามารถซื้อได้");
  });
});

describe("checkCombined", () => {
  it("AP+ECARE over 5x base → both codes flagged", () => {
    const r = checkCombined(rules, 300_000, [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 600_000 }]);
    expect(r).toEqual([{ code: "AP_ECARE_5X", codes: ["AP", "ECARE"], message: "AP+ECARE เกิน 5 เท่าของสัญญาหลัก" }]);
  });
  it("exactly 5x is fine", () => {
    expect(checkCombined(rules, 300_000, [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 500_000 }])).toEqual([]);
  });
  it("cap 10,000,000 applies", () => {
    expect(checkCombined(rules, 5_000_000, [{ code: "AP", sumAssured: 10_000_000 }, { code: "ECARE", sumAssured: 100_000 }])).toHaveLength(1);
  });
});

describe("checkMonthlyMinimum", () => {
  it("monthly total under 1000 baht → warning", () => {
    expect(checkMonthlyMinimum(rules, "monthly", 99_900)).toEqual({ level: "error", code: "MIN_MONTHLY", message: "เบี้ยประกันภัยรายเดือนต่ำกว่า 1,000 บาท" });
  });
  it("annual never warns", () => {
    expect(checkMonthlyMinimum(rules, "annual", 99_900)).toBeUndefined();
  });
  it("monthly at exactly 1000 is fine", () => {
    expect(checkMonthlyMinimum(rules, "monthly", 100_000)).toBeUndefined();
  });
});
