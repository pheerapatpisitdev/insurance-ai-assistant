import { describe, it, expect } from "vitest";
import { allPlanFacts, planFacts } from "@/lib/assistant/catalogue";

/**
 * The whole campaign for ไลฟ์ โพรเทค+ is built on one sentence: the family receives twice the
 * sum assured while the insured is under 60. Someone who clicks that advert and asks the
 * assistant "จริงไหม" has to be told yes, with the figure — so the multiple has to reach the
 * model as a fact, not be left for it to infer from "ผลประโยชน์เปลี่ยนเมื่ออายุ 60".
 */
describe("the death benefit in the facts the assistant answers from", () => {
  const facts = planFacts("LIFEPROTECT")!;

  it("says the x2 product pays double before 60", () => {
    expect(facts).toContain("Life Protect x 2 · ชำระเบี้ยครบอายุ 99 ปี");
    expect(facts).toMatch(/เสียชีวิตก่อนอายุ 60 ปี จ่าย 2 เท่าของทุนประกัน/);
  });

  it("says the x1.5 product pays one and a half, so the two are not confused", () => {
    expect(facts).toMatch(/เสียชีวิตก่อนอายุ 60 ปี จ่าย 1.5 เท่าของทุนประกัน/);
  });

  it("gives the multiple as an amount too, which is how the advert words it", () => {
    expect(facts).toContain("ทุน 1,000,000 บาท ครอบครัวได้รับ 2,000,000 บาท");
  });

  it("says the cover carries on at the full sum, and to what age", () => {
    expect(facts).toMatch(/ตั้งแต่อายุ 60 ปีขึ้นไป จ่ายเต็มทุนประกัน คุ้มครองถึงอายุ 99 ปี/);
  });

  it("carries the Thai name the adverts and the sales page use", () => {
    expect(facts).toContain("ไลฟ์ โพรเทค+ 100");
  });

  it("no longer needs the vague line that only said something changes at 60", () => {
    expect(facts).not.toContain("ผลประโยชน์กรณีเสียชีวิตจะเปลี่ยนเมื่ออายุครบ 60 ปี");
  });

  it("reaches the answer for a question that names no plan", () => {
    expect(allPlanFacts()).toMatch(/เสียชีวิตก่อนอายุ 60 ปี จ่าย 2 เท่าของทุนประกัน/);
  });
});

describe("plans with no such benefit", () => {
  it("says nothing about a multiple where the plan has none", () => {
    for (const code of ["PLB", "ISHIELD", "ISMART", "LIFETREASURE"]) {
      expect(planFacts(code)).not.toMatch(/เท่าของทุนประกัน/);
    }
  });
});
