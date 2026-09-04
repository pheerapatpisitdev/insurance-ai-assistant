import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { deathBenefitRows } from "@/lib/death-benefit";
import type { QuoteInput } from "@/calc/types";

/** ชาย 38 · มรดก 3 ล้าน — the arrangement the legacy bundle sells */
const LEGACY: QuoteInput = {
  planCode: "LIFEPROTECT", variant: "WLF99H", age: 38, sex: "M", mode: "annual",
  sumAssured: 150_000, riders: [{ code: "DCI", sumAssured: 2_850_000 }],
};

describe("death benefit when a rider's cover ends before the plan does", () => {
  /**
   * DCI is written to age 75. Everything after that is the base plan alone, and a legacy
   * quote that keeps promising the rider's sum for life overstates by an order of magnitude.
   */
  it("reports where the rider's cover stops and what is left after it", () => {
    const db = quote(LEGACY).deathBenefit!;
    expect(db.sumBefore).toBe(3_150_000);
    expect(db.sumFrom).toBe(3_000_000);
    expect(db.riderCoverEnds).toEqual({ age: 75, sum: 150_000 });
  });

  it("says nothing about an ending when no rider's cover ends early", () => {
    const db = quote({ ...LEGACY, riders: [] }).deathBenefit!;
    expect(db.sumFrom).toBe(150_000);
    expect(db.riderCoverEnds).toBeUndefined();
  });
});

describe("deathBenefitRows", () => {
  it("bands the legacy quote into three ages, the last one the smallest", () => {
    expect(deathBenefitRows(quote(LEGACY).deathBenefit!)).toEqual([
      { label: "เสียชีวิตก่อนอายุ 60 ปี", amount: 3_150_000 },
      { label: "อายุ 60–74 ปี", amount: 3_000_000 },
      { label: "อายุ 75 ปีขึ้นไป", amount: 150_000 },
    ]);
  });

  it("drops the booster band for an insured already past that age", () => {
    expect(deathBenefitRows(quote({ ...LEGACY, age: 62 }).deathBenefit!)).toEqual([
      { label: "จนถึงอายุ 74 ปี", amount: 3_000_000 },
      { label: "อายุ 75 ปีขึ้นไป", amount: 150_000 },
    ]);
  });

  it("keeps the two plain bands when nothing ends early", () => {
    expect(deathBenefitRows(quote({ ...LEGACY, riders: [] }).deathBenefit!)).toEqual([
      { label: "เสียชีวิตก่อนอายุ 60 ปี", amount: 300_000 },
      { label: "อายุ 60 ปีขึ้นไป", amount: 150_000 },
    ]);
  });

  it("says every age when there is only one figure to say", () => {
    expect(deathBenefitRows(quote({ ...LEGACY, age: 62, riders: [] }).deathBenefit!)).toEqual([
      { label: "ทุกช่วงอายุ", amount: 150_000 },
    ]);
  });
});
