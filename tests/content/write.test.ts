import { describe, expect, it } from "vitest";
import { DISCLAIMER, TAX_LINE, fullText, parseOutput } from "@/lib/content/write";
import { buildMessages } from "@/lib/content/prompt";

const reply = JSON.stringify({
  hooks: ["ถ้าพรุ่งนี้ไม่มีเรา ครอบครัวจะอยู่ยังไง?", "วันละไม่ถึง 5 บาท", "พ่อบ้านวัย 35 คนหนึ่ง…", "เกินมา"],
  body: "บรรทัดหนึ่ง\nบรรทัดสอง",
  closing: "ทักแชทมาได้เลยครับ",
  hashtags: ["ประกันชีวิต", "#วางแผนการเงิน"],
  imagePrompt: "a Thai family at breakfast, warm light, no text",
});

describe("parseOutput", () => {
  it("reads the model's JSON, keeps three hooks, and marks every hashtag", () => {
    const out = parseOutput("```json\n" + reply + "\n```", "family")!;
    expect(out.hooks).toHaveLength(3);
    expect(out.hashtags).toEqual(["#ประกันชีวิต", "#วางแผนการเงิน"]);
    expect(out.imagePrompt).toContain("no text");
  });

  it("puts the regulator's line on every piece, written by code and not by the model", () => {
    expect(parseOutput(reply, "family")!.disclaimer).toBe(DISCLAIMER);
    expect(parseOutput(reply, "tax")!.disclaimer).toBe(`${DISCLAIMER}\n${TAX_LINE}`);
  });

  it("refuses a reply with no hook or no body rather than showing half a post", () => {
    expect(parseOutput("ขอโทษครับ ตอบไม่ได้", "family")).toBeNull();
    expect(parseOutput(JSON.stringify({ hooks: [], body: "x", closing: "" }), "family")).toBeNull();
    expect(parseOutput(JSON.stringify({ hooks: ["a"], body: " ", closing: "" }), "family")).toBeNull();
  });
});

describe("fullText", () => {
  it("is the chosen hook, the body, the closing, the tags and the disclaimer, in that order", () => {
    const out = parseOutput(reply, "family")!;
    const text = fullText(out, 1);
    expect(text.startsWith("วันละไม่ถึง 5 บาท\n\nบรรทัดหนึ่ง")).toBe(true);
    expect(text.indexOf("ทักแชท")).toBeLessThan(text.indexOf("#ประกันชีวิต"));
    expect(text.endsWith(DISCLAIMER)).toBe(true);
  });
});

describe("buildMessages", () => {
  const brief = "## Life Protect x 2\n- ทุน 100,000 บาท";

  it("hands the model the brief and forbids it every number it was not given", () => {
    const [system, user] = buildMessages({ brief, format: "post", angle: "family", custom: "", length: null });
    expect(system.role).toBe("system");
    expect(system.content).toContain("ห้ามคำนวณ");
    expect(user.content).toContain(brief);
    expect(user.content).toContain("โพสต์เฟซบุ๊ก");
  });

  it("speaks as the site does, with ครับ", () => {
    // the first live post ended "นะคะ"; every other word this system says ends ครับ
    const [system] = buildMessages({ brief, format: "post", angle: "", custom: "", length: null });
    expect(system.content).toContain("ใช้คำลงท้าย “ครับ” เท่านั้น");
  });

  it("asks a script for its length and its time markers", () => {
    const [, user] = buildMessages({ brief, format: "script", angle: "tax", custom: "", length: "60" });
    expect(user.content).toContain("60 วินาที");
    expect(user.content).toContain("ลดหย่อนภาษี");
  });

  it("uses the owner's own angle when they typed one", () => {
    const [, user] = buildMessages({ brief, format: "post", angle: "custom", custom: "คนทำงานฟรีแลนซ์", length: null });
    expect(user.content).toContain("คนทำงานฟรีแลนซ์");
  });
});
