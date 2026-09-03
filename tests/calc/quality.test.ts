import { describe, it, expect } from "vitest";
import { assessText } from "@/lib/knowledge/quality";

const realThai = `เงื่อนไขทั่วไปของกรมธรรม์ประกันภัย
ผู้เอาประกันภัยมีสิทธิ์ยกเลิกกรมธรรม์ภายในสิบห้าวันนับแต่วันที่ได้รับกรมธรรม์
บริษัทจะคืนเบี้ยประกันภัยที่ชำระมาแล้วทั้งหมดโดยหักค่าตรวจสุขภาพตามที่จ่ายจริง
ระยะเวลาที่ไม่คุ้มครองการฆ่าตัวตายคือหนึ่งปีนับแต่วันเริ่มมีผลคุ้มครอง
การแถลงข้อความอันเป็นเท็จในใบคำขอเอาประกันภัย บริษัทมีสิทธิ์บอกล้างสัญญาได้ภายในสองปี`;

describe("PDF text quality", () => {
  it("accepts real Thai policy text", () => {
    const q = assessText(realThai);
    expect(q.ok).toBe(true);
    expect(q.length).toBeGreaterThan(200);
  });

  it("rejects a broken font map that repeats one character", () => {
    const q = assessText("เ".repeat(400));
    expect(q.ok).toBe(false);
    expect(q.reason).toContain("ตารางแปลงอักขระ");
    expect(q.topCharShare).toBe(1);
  });

  it("rejects the mixed garbage a bad subset produces", () => {
    const q = assessText("เเเเเเเเเเเเเเเเเเเเเเเเเ ".repeat(10) + "ผผผผผผผผผผผผผผผผผผผผ ".repeat(10));
    expect(q.ok).toBe(false);
  });

  it("rejects a scanned page with almost no text", () => {
    const q = assessText("หน้า 3\n\n12");
    expect(q.ok).toBe(false);
    expect(q.reason).toContain("สแกนเป็นภาพ");
  });

  it("accepts English text too", () => {
    const q = assessText("This policy shall not cover death by suicide within one year. ".repeat(6));
    expect(q.ok).toBe(true);
  });

  it("counts characters after removing whitespace", () => {
    expect(assessText(realThai).length).toBe(realThai.replace(/\s/g, "").length);
  });
});
