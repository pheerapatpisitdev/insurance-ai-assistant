import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import { toHundredths, floorDiv } from "@/calc/money";
import type { PlanRates, QuoteInput } from "@/calc/types";
import json from "../../data/rates/ishield.json";

const d = json as unknown as PlanRates;
const base: QuoteInput = { planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", mode: "annual", sumAssured: 500_000, riders: [] };
const by = (r: ReturnType<typeof quote>) => Object.fromEntries(r.items.map((i) => [i.code, i]));

describe("quote (iShield)", () => {
  it("base only: 66.98 * 500 = 33,490.00", () => {
    const r = quote(base, new Date("2026-09-03"));
    expect(r.items).toHaveLength(1);
    expect(r.items[0]).toMatchObject({ code: "WLCI10", amount: 500_000, annual: 3_349_000, modal: 3_349_000, eligible: true });
    expect(r.totalModal).toBe(3_349_000);
    expect(r.sumAssured).toBe(500_000);
    expect(r.warnings).toEqual([]);
    expect(r.availability.map((a) => a.code)).toEqual(["PB", "AP", "ECARE", "MEB", "PLS"]);
    const pb = r.availability.find((a) => a.code === "PB")!;
    expect(pb.needsPayer).toBe(true);
    expect(pb.options).toEqual([{ code: "FIT", name: "สัญญาเพิ่มเติมพีบี ฟิต" }, { code: "BEYOND", name: "สัญญาเพิ่มเติมพีบี บียอนด์" }]);
    expect(r.availability.find((a) => a.code === "PLS")!.options!.map((o) => o.code)).toEqual(["PLS05", "PLS10", "PLS12", "PLS15"]);
  });

  it("PB FIT with payer F 40: spouse table, period = pay term 10", () => {
    const r = quote({ ...base, payer: { age: 40, sex: "F" }, riders: [{ code: "PB", option: "FIT" }] });
    const rider = d.riders.PB;
    const rate = rider.kind === "payorBenefit" ? rider.rates.PBSDD.F["40"]["10"] : NaN;
    const expected = floorDiv(toHundredths(rate) * floorDiv(3_349_000, 10), 1000);
    expect(by(r).PB).toMatchObject({ name: "สัญญาเพิ่มเติมพีบี ฟิต", annual: expected, modal: expected, eligible: true });
    expect(by(r).PB.amountLabel).toBe("ผู้ชำระเบี้ย หญิง 40 ปี");
    expect(r.totalModal).toBe(3_349_000 + expected);
  });

  it("PB validation messages", () => {
    expect(by(quote({ ...base, riders: [{ code: "PB", option: "FIT" }] })).PB.message).toBe("กรอกอายุผู้ชำระเบี้ย");
    expect(by(quote({ ...base, payer: { age: 75, sex: "M" }, riders: [{ code: "PB", option: "FIT" }] })).PB.message).toBe("อายุผู้ชำระเบี้ยไม่อยู่ในเกณฑ์");
    expect(by(quote({ ...base, payer: { age: 40, sex: "M" }, riders: [{ code: "PB" }] })).PB.message).toBe("กรุณาเลือกแบบ");
    expect(by(quote({ ...base, age: 71, variant: "WLCI15", payer: { age: 40, sex: "M" }, riders: [{ code: "PB", option: "FIT" }] })).PB.message).toBe("ไม่สามารถซื้อได้");
  });

  it("AP juvenile max = MIN(1,000,000, 2 * base)", () => {
    const over = quote({ ...base, age: 10, sumAssured: 300_000, riders: [{ code: "AP", sumAssured: 700_000 }] });
    expect(by(over).AP).toMatchObject({ eligible: false, message: "AP เกินกว่าที่กำหนด" });
    const ok = quote({ ...base, age: 10, sumAssured: 300_000, riders: [{ code: "AP", sumAssured: 600_000 }] });
    expect(by(ok).AP).toMatchObject({ eligible: true, annual: 180_000 });
    expect(ok.availability.find((a) => a.code === "AP")!.saMax).toBe(600_000);
  });

  it("AP+ECARE combined uses this plan's message", () => {
    const r = quote({ ...base, sumAssured: 300_000, riders: [{ code: "AP", sumAssured: 1_000_000 }, { code: "ECARE", sumAssured: 600_000 }] });
    expect(r.warnings).toContainEqual({ level: "error", code: "AP_ECARE_5X", message: "AP+ECARE เกินกว่าที่กำหนด" });
    expect(by(r).ECARE.message).toBe("AP+ECARE เกินกว่าที่กำหนด");
  });

  it("PLS10 1,000,000 → 4130.00; over 5x base → message with variant; under 20 → cannot buy", () => {
    expect(by(quote({ ...base, riders: [{ code: "PLS", option: "PLS10", sumAssured: 1_000_000 }] })).PLS)
      .toMatchObject({ name: "สัญญาเพิ่มเติม PLS (PLS10)", annual: 413_000, eligible: true });
    expect(by(quote({ ...base, riders: [{ code: "PLS", option: "PLS10", sumAssured: 3_000_000 }] })).PLS.message).toBe("PLS10 เกินกว่าที่กำหนด");
    expect(by(quote({ ...base, age: 19, riders: [{ code: "PLS", option: "PLS10", sumAssured: 300_000 }] })).PLS.message).toBe("ไม่สามารถซื้อได้");
    expect(by(quote({ ...base, riders: [{ code: "PLS", sumAssured: 300_000 }] })).PLS.message).toBe("กรุณาเลือกแบบ");
  });

  it("premium basis: semi 52,000 → SA 1,492,983, modal 52,000.00", () => {
    const r = quote({ ...base, mode: "semi", basis: "premium", targetPremium: 52_000 });
    expect(r.sumAssured).toBe(1_492_983);
    expect(r.items[0]).toMatchObject({ amount: 1_492_983, annual: 10_000_000, modal: 5_200_000 });
    expect(r.warnings).toEqual([]);
  });

  it("premium basis below min / above max → SA 0, base not covered, total 0", () => {
    const low = quote({ ...base, mode: "monthly", basis: "premium", targetPremium: 500 });
    expect(low.sumAssured).toBe(0);
    expect(low.items[0]).toMatchObject({ eligible: false, message: "ไม่คุ้มครอง" });
    expect(low.totalModal).toBe(0);
    expect(low.warnings).toContainEqual({ level: "error", code: "BASE_SA_MIN", message: "จำนวนเงินเอาประกันภัยขั้นต่ำ 100,000 บาท" });
    const high = quote({ ...base, basis: "premium", targetPremium: 400_000 });
    expect(high.warnings).toContainEqual({ level: "error", code: "BASE_SA_MAX", message: "จำนวนเงินเอาประกันภัยสูงสุด 5 ล้านบาท" });
  });

  it("sum-assured basis above max warns but still calculates", () => {
    const r = quote({ ...base, sumAssured: 6_000_000 });
    expect(r.items[0].modal).toBeGreaterThan(0);
    expect(r.warnings).toContainEqual({ level: "error", code: "BASE_SA_MAX", message: "จำนวนเงินเอาประกันภัยสูงสุด 5 ล้านบาท" });
  });

  it("age limit depends on variant", () => {
    const r10 = quote({ ...base, age: 52 });
    expect(r10.items[0].eligible).toBe(false);
    expect(r10.warnings).toContainEqual({ level: "error", code: "BASE_AGE", message: "อายุรับประกัน 0 - 51 ปี" });
    expect(quote({ ...base, variant: "WLCI15", age: 52 }).items[0].eligible).toBe(true);
  });
});
