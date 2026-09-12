import { describe, expect, it } from "vitest";
import benefits from "../../data/riders/ihealthy-ultra.json";

// The JSON holds two kinds of row — a bare section heading and a benefit — so TypeScript reads
// benefits.rows as a union in which "adult" may be missing. The lookup is by section number,
// which only a benefit row has, so the cast says what the find already guarantees.
type BenefitRow = {
  no: number | null;
  title: string;
  endorsement: boolean;
  adult: Record<string, string>;
  child?: Record<string, string>;
};
const row = (no: number) => benefits.rows.find((r) => "no" in r && r.no === no)! as unknown as BenefitRow;

describe("ไอเฮลท์ตี้ อัลตร้า benefit data", () => {
  it("carries the six plans with the company's annual maximum", () => {
    expect(benefits.plans.map((p) => [p.code, p.annualMax])).toEqual([
      ["SMART", 3_000_000],
      ["BRONZE", 10_000_000],
      ["SILVER", 15_000_000],
      ["GOLD", 25_000_000],
      ["DIAMOND", 70_000_000],
      ["PLATINUM", 100_000_000],
    ]);
  });

  it("ties the deductible to the plan the way the workbook's I4 does", () => {
    expect(benefits.plans.map((p) => p.deductible)).toEqual([30_000, 30_000, 50_000, 50_000, 100_000, 100_000]);
    expect(benefits.copayPercent).toBe(20);
  });

  it("reads the room rate of หมวด 1", () => {
    expect(row(1).adult).toMatchObject({
      SMART: "1,500 ต่อวัน", BRONZE: "3,000 ต่อวัน", SILVER: "5,500 ต่อวัน",
      GOLD: "9,000 ต่อวัน", DIAMOND: "15,000 ต่อวัน", PLATINUM: "21,000 ต่อวัน",
    });
  });

  it("keeps the child column only where it differs from the adult one", () => {
    expect(row(3).child).toEqual({
      SMART: "1,000 ต่อวัน*/ ตามที่จ่ายจริง",
      BRONZE: "3,000 ต่อวัน*/ ตามที่จ่ายจริง",
    });
    expect(row(1).child).toBeUndefined();
  });

  it("resolves the merged OPD cell that หมวด 18 and 19 share", () => {
    expect(row(18).adult).toMatchObject({ SILVER: "6000", GOLD: "12000", DIAMOND: "60000", PLATINUM: "ตามที่จ่ายจริง" });
    expect(row(19).adult).toEqual(row(18).adult);
  });

  it("reads the benefits only แพลทินั่ม has", () => {
    expect(row(24).adult.PLATINUM).toBe("400000");
    expect(row(28).adult.PLATINUM).toBe("1000000");
    expect(row(24).adult.DIAMOND).toBe("-");
  });

  it("marks หมวด 8 as covered by nobody", () => {
    expect(Object.values(row(8).adult).every((v) => v === "ไม่คุ้มครอง")).toBe(true);
  });

  it("splits the contract into the sections the page shows", () => {
    expect(benefits.rows.filter((r) => "no" in r && r.endorsement).map((r) => r.no))
      .toEqual([14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28]);
  });

  it("carries the waiting periods and the renewal rules as text", () => {
    expect(benefits.terms.renewalToAge).toBe(98);
    expect(benefits.terms.waitingDays).toBe(30);
    expect(benefits.terms.specialWaitingDays).toBe(120);
    expect(benefits.terms.specialWaitingDiseases).toHaveLength(8);
    expect(benefits.terms.noClaimDiscountPercent).toBe(10);
    expect(benefits.terms.outOfTerritoryDays).toBe(90);
    expect(benefits.disclaimer).toContain("เอกสารประกอบการเสนอขาย");
  });
});
