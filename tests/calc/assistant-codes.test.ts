import { describe, it, expect } from "vitest";
import { containsInternalCode, replaceCodes } from "@/lib/assistant/codes";
import { allPlanFacts, planCatalogue, planFacts } from "@/lib/assistant/catalogue";
import { getPlan, listPlans } from "@/calc/plans/registry";

describe("swapping internal codes for names", () => {
  it("names an iShield package the way the picker does", () => {
    expect(replaceCodes("แบบ WLCI05 รับอายุ 0-52 ปี")).toBe("แบบ iShield 05 (ชำระเบี้ย 5 ปี) รับอายุ 0-52 ปี");
  });

  it("replaces the longer package code before the shorter one hiding inside it", () => {
    expect(replaceCodes("WLF99HX#7")).toBe(getPlan("LIFEPROTECT")!.variantLabels["WLF99HX#7"]);
  });

  it("replaces a plan code as well as a package code", () => {
    expect(replaceCodes("ISHIELD")).toBe("iShield");
  });

  it("drops a parenthesised code aside rather than translating it in place", () => {
    expect(replaceCodes("ไอสมาร์ท (รหัส W80F06)")).toBe("ไอสมาร์ท");
  });

  it("leaves a plan's own public name alone, code-shaped though it looks", () => {
    // the company sells this as "โพรเทคชั่นไลฟ์ (PLB)", so PLB is the name, not a code
    expect(replaceCodes("Protection Life (PLB) รับอายุ 0-70 ปี")).toBe("Protection Life (PLB) รับอายุ 0-70 ปี");
  });

  it("leaves ordinary Thai text alone", () => {
    const text = "เบี้ยรายปี 17,200 บาท กรณีเสียชีวิตรับ 1,000,000 บาท";
    expect(replaceCodes(text)).toBe(text);
  });
});

describe("no code reaches the customer", () => {
  it("finds none in the labels the picker shows", () => {
    for (const { code } of listPlans()) {
      for (const label of Object.values(getPlan(code)!.variantLabels)) {
        expect(containsInternalCode(label), `${code} label "${label}"`).toBe(false);
      }
    }
  });

  it("finds none in the facts handed to the model", () => {
    for (const { code } of listPlans()) {
      expect(containsInternalCode(planFacts(code)!), code).toBe(false);
    }
    expect(containsInternalCode(allPlanFacts())).toBe(false);
  });

  it("still gives the router the codes it picks from, because that never reaches anyone", () => {
    expect(containsInternalCode(planCatalogue())).toBe(true);
  });
});
