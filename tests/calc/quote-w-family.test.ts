import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import type { QuoteInput } from "@/calc/types";

const ismart: QuoteInput = {
  planCode: "ISMART", variant: "W80F06", age: 44, sex: "F", mode: "annual", sumAssured: 1_000_000, riders: [],
};
const by = (r: ReturnType<typeof quote>) => Object.fromEntries(r.items.map((i) => [i.code, i]));

describe("quote (ไอสมาร์ท 80/6)", () => {
  it("base only: 287 × 1,000 = 287,000.00", () => {
    const r = quote(ismart, new Date("2026-09-03"));
    expect(r.items[0]).toMatchObject({ code: "W80F06", annual: 28_700_000, modal: 28_700_000, eligible: true });
    expect(r.items[0].name).toBe("iSmart 80/6 — ชำระเบี้ย 6 ปี");
    expect(r.totalModal).toBe(28_700_000);
    expect(r.availability.map((a) => a.code)).toEqual(
      ["PB", "WP", "AP", "ECARE", "MEX", "MEB", "DCI", "PLS", "CPR", "HIC", "IHU", "RRSS", "CI123"],
    );
  });

  it("issue age comes from the package table", () => {
    expect(quote({ ...ismart, age: 24 }).warnings).toContainEqual(
      { level: "error", code: "BASE_AGE", message: "อายุรับประกัน 25 - 65 ปี" },
    );
    expect(quote({ ...ismart, age: 24 }).sumAssured).toBe(0);
    expect(quote({ ...ismart, age: 65 }).items[0].eligible).toBe(true);
  });

  it("WP is keyed on the insured and PB on the payer", () => {
    const wp = quote({ ...ismart, riders: [{ code: "WP", option: "FIT" }] });
    expect(by(wp).WP).toMatchObject({ annual: 22_960, eligible: true, amountLabel: "ยกเว้นเบี้ย 6 ปี" });
    const pb = quote({ ...ismart, payer: { age: 44, sex: "F" }, riders: [{ code: "PB", option: "BEYOND" }] });
    expect(by(pb).PB).toMatchObject({ annual: 450_590, eligible: true, amountLabel: "ผู้ชำระเบี้ย หญิง 44 ปี" });
  });

  it("PB and WP cannot be bought together", () => {
    const r = quote({ ...ismart, payer: { age: 44, sex: "F" }, riders: [{ code: "PB", option: "FIT" }, { code: "WP", option: "FIT" }] });
    expect(r.warnings).toContainEqual({ level: "error", code: "PB_WP", message: "กรุณาเลือก WP หรือ PB อย่างใดอย่างหนึ่ง" });
    expect(by(r).PB.eligible).toBe(false);
    expect(by(r).WP.eligible).toBe(false);
  });

  it("HIC needs CPR and conflicts with MEB", () => {
    const alone = quote({ ...ismart, riders: [{ code: "HIC", sumAssured: 3_000 }] });
    expect(by(alone).HIC.message).toBe("ต้องซื้อคู่กับ CPR");
    const withCpr = quote({ ...ismart, riders: [{ code: "CPR", sumAssured: 300_000 }, { code: "HIC", sumAssured: 3_000 }] });
    expect(by(withCpr).HIC.eligible).toBe(true);
    const clash = quote({ ...ismart, riders: [{ code: "CPR", sumAssured: 300_000 }, { code: "HIC", sumAssured: 3_000 }, { code: "MEB", plan: 500 }] });
    expect(by(clash).HIC.message).toBe("ไม่สามารถซื้อคู่กับ MEX, MEB หรือ iHealthy Ultra");
  });

  it("DCI blocks CPR but keeps its own premium (Excel B28/F27)", () => {
    const r = quote({ ...ismart, riders: [{ code: "DCI", sumAssured: 200_000 }, { code: "CPR", sumAssured: 300_000 }] });
    expect(by(r).CPR).toMatchObject({ eligible: false, modal: 0, message: "ไม่สามารถซื้อคู่กับ DCI ได้" });
    expect(by(r).DCI.eligible).toBe(true);
    expect(by(r).DCI.modal).toBeGreaterThan(0);
  });

  it("DCI and CPR together may not exceed 10,000,000", () => {
    const r = quote({ ...ismart, sumAssured: 5_000_000, riders: [{ code: "DCI", sumAssured: 8_000_000 }, { code: "CPR", sumAssured: 3_000_000 }] });
    expect(r.warnings.map((w) => w.code)).toContain("DCI_CPR");
  });

  it("CI 123 shows the main benefit plus three endorsement rows", () => {
    const r = quote({ ...ismart, riders: [{ code: "CI123", sumAssured: 5_000_000 }] });
    const rows = r.items.filter((i) => i.code.startsWith("CI123"));
    expect(rows).toHaveLength(6); // main + five further components
    expect(rows[0]).toMatchObject({ code: "CI123", annual: 3_585_000 });
    expect(r.totalAnnual).toBe(28_700_000 + 4_478_950);
  });

  it("CI 123 under its minimum premium is not covered", () => {
    const r = quote({ ...ismart, riders: [{ code: "CI123", sumAssured: 100_000 }] });
    expect(by(r).CI123).toMatchObject({ eligible: false, message: "ไม่คุ้มครอง" });
  });

  it("iHealthy Ultra takes plan and territory", () => {
    const r = quote({ ...ismart, riders: [{ code: "IHU", option: "PLATINUM", territory: "ประเทศไทย" }] });
    expect(by(r).IHU).toMatchObject({ annual: 19_320_000, eligible: true, amountLabel: "PLATINUM · ประเทศไทย" });
  });

});

describe("quote (ไลฟ์เทรเชอร์)", () => {
  const lt: QuoteInput = {
    planCode: "LIFETREASURE", variant: "H99F18A", age: 30, sex: "M", mode: "annual", sumAssured: 20_000_000, riders: [],
  };
  it("applies the package's own high sum-assured discount", () => {
    const r = quote(lt, new Date("2026-09-03"));
    expect(r.items[0]).toMatchObject({ annual: 50_600_000, modal: 50_600_000, eligible: true });
  });
  it("AP for a juvenile is capped at 2× the base, up to 3,000,000 (this family's cap)", () => {
    const r = quote({ ...lt, age: 10, sumAssured: 10_000_000 });
    expect(r.items[0].eligible).toBe(true);
    expect(r.availability.find((a) => a.code === "AP")!.saMax).toBe(3_000_000);
  });
  it("a sum assured below the 10,000,000 minimum voids the quote (Excel F19/H19)", () => {
    const r = quote({ ...lt, sumAssured: 1_000_000, riders: [{ code: "AP", sumAssured: 300_000 }] });
    expect(r.warnings).toContainEqual(
      { level: "error", code: "BASE_SA_MIN", message: "จำนวนเงินเอาประกันภัยขั้นต่ำ 10,000,000 บาท" },
    );
    expect(r.sumAssured).toBe(0);
    expect(r.items[0]).toMatchObject({ eligible: false, message: "ไม่คุ้มครอง" });
    expect(r.totalModal).toBe(0);
  });
});

describe("quote (ไลฟ์ โพรเทค+)", () => {
  const lpp: QuoteInput = {
    planCode: "LIFEPROTECT", variant: "WLF19H", age: 45, sex: "F", mode: "annual", sumAssured: 500_000, riders: [],
  };
  it("names the row after the package's own product, not the workbook header", () => {
    const plus50 = quote({ ...lpp, variant: "WLF99L", age: 35, sex: "M", sumAssured: 1_000_000 });
    expect(plus50.items[0].name).toBe("Life Protect x 1.5 — ชำระเบี้ยครบอายุ 99 ปี");
    expect(plus50.items[0].annual).toBe(1_530_000); // 15.3 per 1,000
    const plus100 = quote({ ...lpp, variant: "WLF99H", age: 35, sex: "M", sumAssured: 1_000_000 });
    expect(plus100.items[0].name).toBe("Life Protect x 2 — ชำระเบี้ยครบอายุ 99 ปี");
    expect(plus100.items[0].annual).toBe(1_720_000); // 17.2 per 1,000
  });

  it("base 32 × 500 = 16,000.00", () => {
    expect(quote(lpp, new Date("2026-09-03")).items[0]).toMatchObject({ annual: 1_600_000, eligible: true });
  });
  it("the health packages take exactly 50,000 and force iHealthy Ultra", () => {
    const r = quote({ ...lpp, variant: "WLF99HX", sumAssured: 100_000 });
    expect(r.warnings).toContainEqual(
      { level: "error", code: "BASE_SA_EXACT", message: "จำนวนเงินเอาประกันภัยต้องเป็น 50,000 บาทเท่านั้น" },
    );
    expect(r.warnings.map((w) => w.message)).toContain("กรุณาเลือกแผน iHealthy Ultra");
    expect(r.totalModal).toBe(0);
  });
  it("the health package does not sell PB, WP, ECARE, PLS, CPR or HIC", () => {
    const r = quote({ ...lpp, variant: "WLF99HX", sumAssured: 50_000, riders: [{ code: "IHU", option: "PLATINUM" }] });
    const av = Object.fromEntries(r.availability.map((a) => [a.code, a]));
    for (const code of ["PB", "WP", "ECARE", "PLS", "CPR", "HIC"]) {
      expect(av[code].eligible, code).toBe(false);
      expect(av[code].reason, code).toBe("ไม่ขายกับ package นี้");
    }
    expect(r.totalModal).toBeGreaterThan(0);
  });
});

describe("death benefit (ไลฟ์ โพรเทค+)", () => {
  const lpp = {
    planCode: "LIFEPROTECT", age: 35, sex: "M" as const, mode: "annual" as const, sumAssured: 1_000_000, riders: [],
  };

  it("+100 pays double before 60 and the sum assured from 60 (Excel K7/K8)", () => {
    const r = quote({ ...lpp, variant: "WLF99H" });
    expect(r.deathBenefit).toEqual({ beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false });
  });

  it("+50 adds half the sum assured before 60", () => {
    const r = quote({ ...lpp, variant: "WLF99L" });
    expect(r.deathBenefit).toEqual({ beforeAge: 60, sumBefore: 1_500_000, sumFrom: 1_000_000, alreadyPastAge: false });
  });

  it("an insured already 60 or older gets the sum assured only", () => {
    const r = quote({ ...lpp, variant: "WLF99H", age: 60 });
    expect(r.deathBenefit).toEqual({ beforeAge: 60, sumBefore: 1_000_000, sumFrom: 1_000_000, alreadyPastAge: true });
  });

  it("matches the shipped workbook: age 45, +100, sum assured 500,000", () => {
    const r = quote({ ...lpp, variant: "WLF19H", age: 45, sex: "F", sumAssured: 500_000 });
    expect(r.deathBenefit).toMatchObject({ sumBefore: 1_000_000, sumFrom: 500_000 });
  });

  it("counts a DCI sum assured, which pays on death as well", () => {
    const r = quote({ ...lpp, variant: "WLF99H", sumAssured: 200_000, riders: [{ code: "DCI", sumAssured: 2_800_000 }] });
    // the +100 booster doubles the base only; DCI is added on top of both figures
    expect(r.deathBenefit).toEqual({ beforeAge: 60, sumBefore: 3_200_000, sumFrom: 3_000_000, alreadyPastAge: false });
  });

  it("leaves out a rider the insured is too old to buy", () => {
    // DCI stops at 65 while the plan issues to 80, so there is no DCI cover to add
    const r = quote({ ...lpp, variant: "WLF99H", age: 70, sumAssured: 200_000, riders: [{ code: "DCI", sumAssured: 2_800_000 }] });
    expect(r.deathBenefit).toEqual({ beforeAge: 60, sumBefore: 200_000, sumFrom: 200_000, alreadyPastAge: true });
  });

  it("plans without a stepped death benefit report none", () => {
    expect(quote({ planCode: "PLB", variant: "PLB12", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: [] }).deathBenefit)
      .toBeUndefined();
    expect(quote({ planCode: "ISMART", variant: "W80F06", age: 44, sex: "F", mode: "annual", sumAssured: 1_000_000, riders: [] }).deathBenefit)
      .toBeUndefined();
  });
});
