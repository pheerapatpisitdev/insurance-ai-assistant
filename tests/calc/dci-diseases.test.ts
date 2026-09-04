import { describe, it, expect } from "vitest";
import { riderDiseases } from "@/calc/riders/diseases";
import { allPlanFacts } from "@/lib/assistant/catalogue";

describe("the illnesses DCI names", () => {
  const dci = riderDiseases("DCI")!;

  it("carries the thirty-one the company's benefit sheet lists", () => {
    expect(dci.diseases).toHaveLength(31);
  });

  it("keeps the company's own wording, numbering stripped", () => {
    expect(dci.diseases[0]).toBe("โรคสมองเสื่อมชนิดอัลไซเมอร์");
    expect(dci.diseases[30]).toBe("การทุพพลภาพถาวรสิ้นเชิง");
    for (const d of dci.diseases) expect(d, d).not.toMatch(/^\d/);
  });

  it("names no illness twice", () => {
    expect(new Set(dci.diseases).size).toBe(dci.diseases.length);
  });

  it("says the payment covers death as well, which the list alone would not", () => {
    expect(dci.note).toContain("เสียชีวิต");
  });

  it("was read from every plan that sells the rider", () => {
    expect(riderDiseases("DCI")).toBeDefined();
    expect(riderDiseases("MEB")).toBeUndefined();
  });

  it("reaches the assistant, so a customer can be told what is covered", () => {
    const facts = allPlanFacts();
    expect(facts).toContain("คุ้มครอง 31 โรค");
    expect(facts).toContain("โรคมะเร็งระยะลุกลาม");
  });
});
