import { describe, expect, it } from "vitest";
import { PLAN_INFO_SYSTEM, SMALL_TALK_SYSTEM } from "@/lib/assistant/prompts";

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

  it("still names what a person must answer", () => {
    expect(PLAN_INFO_SYSTEM).toContain("การเคลม");
    expect(PLAN_INFO_SYSTEM).toContain("การพิจารณาสุขภาพ");
  });

  for (const [name, prompt] of [["plan info", PLAN_INFO_SYSTEM], ["small talk", SMALL_TALK_SYSTEM]] as const) {
    it(`keeps ${name} away from the company, an invented identity and a figure of its own`, () => {
      expect(prompt).toContain("ห้ามยืนยันหรือปฏิเสธชื่อบริษัทที่ลูกค้าเอ่ยถึง");
      expect(prompt).toContain("ห้ามอ้างว่าตัวเองเป็นตัวแทน");
      expect(prompt).toContain("ห้ามบอกว่าตัวเองเป็นคน");
    });
  }
});
