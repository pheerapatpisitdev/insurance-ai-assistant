import { describe, expect, it } from "vitest";
import {
  RECRUIT_NAME, RECRUIT_TONES, RECRUIT_TOPICS, parseRecruitPiece, recruitMessages, recruitSystem, recruitTones, topicOf,
} from "@/lib/content/recruit";
import { strayNumbers } from "@/lib/content/check";

const side = topicOf("side", "")!;

const reply = (extra: Record<string, unknown> = {}) => JSON.stringify({
  hook: "เวลาว่างหลังเลิกงาน ทำอะไรได้อีก",
  body: "ทีมเราสอนตั้งแต่ศูนย์\nรายได้ขึ้นกับผลงาน",
  closing: "ทักแชทพิมพ์ว่า “สนใจร่วมทีม”",
  hashtags: ["ร่วมทีม", "#ตัวแทนประกัน"],
  imagePrompt: "A Thai woman working on a laptop at a cafe",
  poster: { theme: "navy", headline: "งานเสริมที่เติบโตไปกับคุณ", footer: "" },
  ...extra,
});

describe("RECRUIT_TOPICS", () => {
  it("has the eight topics, each with a brief the writer is held to", () => {
    expect(RECRUIT_TOPICS).toHaveLength(8);
    expect(new Set(RECRUIT_TOPICS.map((t) => t.id)).size).toBe(8);
    for (const t of RECRUIT_TOPICS) {
      expect(t.label).toBeTruthy();
      expect(t.brief.length).toBeGreaterThan(20);
    }
  });

  it("no topic brief carries an income figure", () => {
    for (const t of RECRUIT_TOPICS) expect(t.brief).not.toMatch(/\d{2,}[,\d]*\s*บาท|หลักหมื่น|หลักแสน/);
  });

  it("an own topic is kept in the owner's words, trimmed", () => {
    expect(topicOf("custom", "  ทำไมตัวแทนต้องสอบ  ")).toEqual({ id: "custom", label: "ทำไมตัวแทนต้องสอบ", brief: "ทำไมตัวแทนต้องสอบ" });
    expect(topicOf("custom", "  ")).toBeNull();
    expect(topicOf("nope", "")).toBeNull();
  });
});

describe("recruitTones", () => {
  it("left to the AI, a round of three takes three different tones", () => {
    const t = recruitTones("", 3);
    expect(new Set(t.map((x) => x.label)).size).toBe(3);
  });

  it("a picked tone is kept by every piece, each opening differently", () => {
    const t = recruitTones(RECRUIT_TONES[1].id, 3);
    expect(t.every((x) => x.label === RECRUIT_TONES[1].label)).toBe(true);
    expect(new Set(t.map((x) => x.say)).size).toBe(3);
  });
});

describe("recruitSystem", () => {
  it("carries the recruiting rules every format is held to", () => {
    for (const f of ["post", "ad", "script"] as const) {
      const s = recruitSystem(f);
      expect(s).toContain("ห้ามใส่ตัวเลขรายได้");
      expect(s).toContain("ห้ามกำหนดอายุ เพศ");
      expect(s).toContain("คปภ.");
      expect(s).toContain("ห้ามสัญญาว่าสอบผ่าน");
      expect(s).toContain("ห้ามใช้คำว่า “การันตี”");
      expect(s).toContain("ครับ");
      expect(s).toContain("JSON");
    }
  });

  it("asks for a work scene behind a poster, and none for a script", () => {
    expect(recruitSystem("post")).toContain("imagePrompt");
    expect(recruitSystem("script")).not.toContain("imagePrompt");
  });
});

describe("recruitMessages", () => {
  it("gives the writer the topic's brief, the tone and the reader", () => {
    const [, user] = recruitMessages(side, { say: "เล่าชีวิตจริง" }, "แม่บ้าน/คนอยากทำงานที่บ้าน");
    expect(user.content).toContain(side.brief);
    expect(user.content).toContain("เล่าชีวิตจริง");
    expect(user.content).toContain("แม่บ้าน/คนอยากทำงานที่บ้าน");
  });
});

describe("parseRecruitPiece", () => {
  it("makes a post with a ร่วมทีม poster and the brief kept for later checks", () => {
    const o = parseRecruitPiece(reply(), side, "เล่าชีวิตจริง", "post")!;
    expect(o.angle).toBe(`${RECRUIT_NAME} · ${side.label} · เล่าชีวิตจริง`);
    expect(o.hashtags).toEqual(["#ร่วมทีม", "#ตัวแทนประกัน"]);
    expect(o.poster?.blocks[0]).toEqual({ kind: "badge", text: "ร่วมทีม" });
    expect(o.poster?.blocks.find((b) => b.kind === "footer")?.text).toBe("ทักแชท “สนใจร่วมทีม”");
    expect(o.fact).toBe(side.brief);
    expect(o.imagePrompt).toContain("laptop");
  });

  it("an ad has no tags and is labelled หาทีม; a script has no poster", () => {
    const ad = parseRecruitPiece(reply(), side, "ชวนตรงๆ", "ad")!;
    expect(ad.hashtags).toEqual([]);
    expect(ad.ad?.tone).toBe(RECRUIT_NAME);
    const script = parseRecruitPiece(reply(), side, "ชวนตรงๆ", "script")!;
    expect(script.poster).toBeUndefined();
    expect(script.imagePrompt).toBe("");
  });

  it("refuses a reply with no hook or no body", () => {
    expect(parseRecruitPiece(reply({ hook: "" }), side, "x")).toBeNull();
    expect(parseRecruitPiece("not json", side, "x")).toBeNull();
  });

  it("an income figure the brief does not have is caught by the number check", () => {
    expect(strayNumbers("รายได้เดือนละ 50,000 บาท", side.brief).join(" ")).toContain("50,000");
  });
});
