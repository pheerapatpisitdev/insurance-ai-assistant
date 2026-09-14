import { describe, expect, it } from "vitest";
import { PLAN_INFO_SYSTEM, SMALL_TALK_SYSTEM } from "@/lib/assistant/lifeprotect/prompts";

/**
 * The prompts are the only place the model is allowed to speak from, so what they forbid is
 * worth holding still. Each of these was written after the bot did the opposite in a
 * rehearsal.
 */
describe("what the model is told", () => {
  it("forbids sending a premium question to the agent, because the engine answers those", () => {
    expect(PLAN_INFO_SYSTEM).toContain("ห้ามบอกให้ลูกค้าไปถามตัวแทนเรื่องเบี้ยประกัน");
    expect(PLAN_INFO_SYSTEM).toContain("ไม่ต้องปิดท้ายทุกข้อความด้วยการให้ไปถามตัวแทน");
  });

  it("tells the truth when asked outright whether it is a person", () => {
    expect(PLAN_INFO_SYSTEM).toContain("ถ้าลูกค้าถามตรงๆ ว่าเป็นคนหรือบอท");
    expect(PLAN_INFO_SYSTEM).toContain("ระบบช่วยตอบของเพจ");
  });

  it("lets a customer leave without being asked for anything", () => {
    expect(SMALL_TALK_SYSTEM).toContain("ขอคิดดูก่อน");
    expect(SMALL_TALK_SYSTEM).toContain("ห้ามขอข้อมูล ห้ามชวนคุยต่อ ห้ามขาย");
  });

  it("still names what a person must answer", () => {
    expect(PLAN_INFO_SYSTEM).toContain("การเคลม");
    expect(PLAN_INFO_SYSTEM).toContain("การพิจารณาสุขภาพ");
  });

  for (const [name, prompt] of [["plan info", PLAN_INFO_SYSTEM], ["small talk", SMALL_TALK_SYSTEM]] as const) {
    it(`forbids ${name} from promising to send something later`, () => {
      expect(prompt).toContain("ห้ามสัญญาว่าจะส่งอะไรให้ทีหลัง");
    });
  }

  for (const [name, prompt] of [["plan info", PLAN_INFO_SYSTEM], ["small talk", SMALL_TALK_SYSTEM]] as const) {
    it(`keeps ${name} away from the company, an invented identity and a figure of its own`, () => {
      expect(prompt).toContain("ห้ามยืนยันหรือปฏิเสธชื่อบริษัทที่ลูกค้าเอ่ยถึง");
      expect(prompt).toContain("ห้ามอ้างว่าเป็นตัวแทน");
      expect(prompt).toContain("ห้ามบอกว่าตัวเองเป็นคน");
    });
  }
});
