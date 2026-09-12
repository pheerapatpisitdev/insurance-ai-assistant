import { describe, expect, it } from "vitest";
import { JUVENILE_BELOW_AGE } from "@/calc/riders/fixed-by-key-age";
import { benefitValue, iHealthyFacts, isHeading, type BenefitRow } from "@/lib/ihealthy-facts";
import sheet from "../../data/riders/ihealthy-ultra.json";

const facts = iHealthyFacts();
// find() hands back the whole union, so the predicate says what !isHeading already proved
const row = (no: number) => facts.rows.find((r): r is BenefitRow => !isHeading(r) && r.no === no)!;

describe("iHealthyFacts", () => {
  it("keeps the sheet's order, headings and all", () => {
    expect(isHeading(facts.rows[0])).toBe(true);
    expect(facts.rows).toHaveLength(41);
    expect(facts.rows.filter(isHeading)).toHaveLength(5);
  });

  it("splits the contract from the endorsement", () => {
    expect(row(13).endorsement).toBe(false);
    expect(row(14).endorsement).toBe(true);
  });

  it("takes the juvenile boundary from the engine, not from a second copy", () => {
    // the value alone would still pass if someone typed 11 in here, so pin the provenance
    expect(facts.juvenileBelowAge).toBe(JUVENILE_BELOW_AGE);
    expect(facts.juvenileBelowAge).toBe(11);
  });

  it("passes the contract terms straight through", () => {
    // the paragraphs themselves are the JSON test's business; this pins that none is rebuilt
    expect(facts.terms).toBe(sheet.terms);
  });

  it("says the annual maximum in the company's own sentence", () => {
    expect(facts.plans[0].annualMaxNote).toContain("3,000,000 ต่อรอบปีกรมธรรม์ประกันภัย");
  });

  it("leaves the workbook it was cut from on the server", () => {
    expect(Object.keys(facts)).not.toContain("source");
    expect(Object.keys(facts)).not.toContain("code");
  });

  it("cannot be reordered out from under a later render", () => {
    expect(Object.isFrozen(facts.rows)).toBe(true);
    expect(() => facts.rows.reverse()).toThrow(TypeError);
  });
});

describe("benefitValue", () => {
  const doctorFee = row(3);
  const roomRate = row(1);

  it("reads the adult column from age 11", () => {
    expect(benefitValue(doctorFee, "SMART", 11)).toBe("ตามที่จ่ายจริง");
  });

  it("swaps to the child column below 11 where the sheet has one", () => {
    expect(benefitValue(doctorFee, "SMART", 10)).toBe("1,000 ต่อวัน*/ ตามที่จ่ายจริง");
    expect(benefitValue(doctorFee, "BRONZE", 6)).toBe("3,000 ต่อวัน*/ ตามที่จ่ายจริง");
  });

  it("falls back to the adult column for rows with no child variant", () => {
    expect(benefitValue(roomRate, "SMART", 8)).toBe("1,500 ต่อวัน");
  });

  it("does not decide who may buy what — that is the rate table's answer", () => {
    expect(benefitValue(doctorFee, "PLATINUM", 8)).toBe("ตามที่จ่ายจริง");
  });
});
