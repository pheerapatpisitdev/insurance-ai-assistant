import { describe, expect, it } from "vitest";
import { faqAnswer } from "@/lib/assistant/faq";

/** The customers' own words, taken from the campaign's inbox. */
describe("the answers the agency writes by hand", () => {
  it("answers the tax question with the figure the agent quotes", () => {
    expect(faqAnswer("ลดหย่อนภาษีได้ไหมคะ")).toContain("100,000");
  });

  it("answers what a death claim covers, exclusions included", () => {
    const answer = faqAnswer("การเสียชีวิตทุกกรณีไหมคะ")!;
    expect(answer).toContain("ทุกกรณี");
    // an absolute would be wrong: every life policy carries the standard exclusions
    expect(answer).toContain("ฆ่าตัวตายภายใน 1 ปี");
  });

  it("explains how the monthly instalment is actually taken", () => {
    const answer = faqAnswer("จ่ายรายเดือนได้หรือไม่คะ")!;
    expect(answer).toContain("2 งวด");
    expect(answer).toContain("งวดที่ 3");
  });

  it("meets the pay-to-99 worry with the fixed premium and the shorter terms", () => {
    const answer = faqAnswer("กำลังคิดหากอายุยืน แต่อายุเยอะ แล้วจะหาเงินที่ไหนส่ง หากส่งยาวถึง99ปี")!;
    expect(answer).toContain("คงที่");
    expect(answer).toContain("9 ปี");
    expect(answer).toContain("19 ปี");
  });

  describe("a customer who names a condition", () => {
    const asked = "เพศหญิง อายุ 36 ปี มีโรคประจำตัว ไทรอยด์ฮาชิโมโต้ นัดตรวจเลือดทุก 3 เดือน";

    it("is never told the company will accept them", () => {
      const answer = faqAnswer(asked)!;
      expect(answer).toContain("แถลงข้อมูลสุขภาพ");
      expect(answer).toContain("พิจารณาเป็นรายบุคคล");
      expect(answer).not.toContain("ทำได้ครับ");
    });

    it("is asked not to send medical details into the chat", () => {
      expect(faqAnswer(asked)).toContain("ไม่ต้องส่งรายละเอียดสุขภาพ");
    });

    it("wins over every other written answer in the same message", () => {
      // mentions both a condition and the tax question
      expect(faqAnswer("เป็นเบาหวาน ลดหย่อนภาษีได้ไหม")).toContain("แถลงข้อมูลสุขภาพ");
    });
  });

  it("stays out of a message that asks none of them", () => {
    expect(faqAnswer("ชาย 35 ทุน 1 ล้าน")).toBeUndefined();
    expect(faqAnswer("ของบริษัทอะไรครับ")).toBeUndefined();
  });
});
