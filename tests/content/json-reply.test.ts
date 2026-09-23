import { describe, expect, it } from "vitest";
import { escapeBareControls, parseJsonReply } from "@/lib/ai/client";

describe("parseJsonReply", () => {
  it("reads a reply whose strings carry real line breaks, as Sonnet writes an ad's paragraphs", () => {
    // the shape of the ad that was lost on 2026-09-23: a newline inside "primaryText"
    const reply = '{"primaryText":"ถ้าพรุ่งนี้ไม่มีเรา\n\nวันละ 20 บาท","headline":"ดูแลคนข้างหลัง"}';
    expect(parseJsonReply<{ primaryText: string }>(reply)?.primaryText).toBe("ถ้าพรุ่งนี้ไม่มีเรา\n\nวันละ 20 บาท");
  });

  it("leaves line breaks between fields, and escaped ones inside strings, as they were", () => {
    const pretty = '{\n  "a": "x\\ny",\n  "b": "say \\"hi\\"\n"\n}';
    expect(escapeBareControls(pretty)).toBe('{\n  "a": "x\\ny",\n  "b": "say \\"hi\\"\\n"\n}');
    expect(parseJsonReply<{ a: string; b: string }>(pretty)).toEqual({ a: "x\ny", b: 'say "hi"\n' });
  });

  it("still refuses what is not JSON at all", () => {
    expect(parseJsonReply("ขอโทษครับ")).toBeNull();
  });
});
