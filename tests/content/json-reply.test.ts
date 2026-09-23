import { describe, expect, it } from "vitest";
import { closeBrackets, escapeBareControls, parseJsonReply } from "@/lib/ai/client";

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

  it("puts back the brace Sonnet left off a poster, as in the Family Legacy post of 2026-09-23", () => {
    // the reply's ending was …]}]} where …]}}]} belonged: the poster object never closed
    const reply = '{"pieces":[{"body":"เบี้ยปีแรกเฉลี่ยวันละ 12 บาท","closing":"ทักมาครับ","hashtags":["#a"],"imagePrompt":"x",'
      + '"poster":{"layout":"bottom","blocks":[{"kind":"headline","text":"เตรียมเงินก้อน"},{"kind":"footer","text":"ทักแชท"}]}]}';
    const parsed = parseJsonReply<{ pieces: { body: string; poster: { blocks: unknown[] } }[] }>(reply);
    expect(parsed?.pieces[0].body).toBe("เบี้ยปีแรกเฉลี่ยวันละ 12 บาท");
    expect(parsed?.pieces[0].poster.blocks).toHaveLength(2);
  });

  it("closes what is still open at the end, and leaves brackets inside strings alone", () => {
    expect(closeBrackets('{"a":[1,2')).toBe('{"a":[1,2]}');
    expect(closeBrackets('{"a":"x]}"}')).toBe('{"a":"x]}"}');
    expect(closeBrackets('{"a":1}}')).toBe('{"a":1}');
  });

  it("returns a reply that was fine exactly as it came", () => {
    const ok = '{"pieces":[{"poster":{"blocks":[{"k":"v"}]}}]}';
    expect(closeBrackets(ok)).toBe(ok);
  });

  it("still refuses what is not JSON at all", () => {
    expect(parseJsonReply("ขอโทษครับ")).toBeNull();
  });
});
