import { describe, expect, it } from "vitest";
import { backgroundPrompt, stripThai } from "@/lib/content/background";
import { parsePoster } from "@/lib/content/poster";

describe("backgroundPrompt", () => {
  const base = { scene: "A Thai father reading to his daughter at bedtime", layout: "bottom" as const, theme: "navy" as const };

  it("forbids any lettering and keeps the text's side of the frame calm", () => {
    const p = backgroundPrompt(base);
    expect(p).toContain("NO text, letters, numbers or words");
    expect(p).toContain("bottom half of the frame calm");
    expect(backgroundPrompt({ ...base, layout: "top" })).toContain("top half of the frame calm");
  });

  it("never hands the model a Thai word, which it would try to draw", () => {
    const p = backgroundPrompt({ ...base, scene: "A family at home ครอบครัว", request: "ขอแสงเช้า morning light" });
    expect(p).not.toMatch(/[฀-๿]/);
    expect(p).toContain("morning light");
  });

  it("keeps an insurance advertisement away from fear and money", () => {
    const p = backgroundPrompt(base);
    expect(p).toContain("coffins");
    expect(p).toContain("piles of cash");
  });

  it("has a scene even when the piece has none", () => {
    expect(backgroundPrompt({ ...base, scene: "ภาพครอบครัว" })).toContain("Thai family at home");
  });

  it("strips Thai and tidies the spaces it leaves", () => {
    expect(stripThai("a ครอบครัว b")).toBe("a b");
  });
});

describe("a poster's background", () => {
  const headline = [{ kind: "headline", text: "วันละ 20 บาท" }];

  it("keeps a picture the bucket could have written", () => {
    const bg = "3f2504e0-4f89-11d3-9a0c-0305e82c3301/9b2c1d4e-0000-4000-8000-000000000001.png";
    expect(parsePoster({ blocks: headline, background: bg })!.background).toBe(bg);
  });

  it("drops any other path, so the drawing route reads only its own bucket's files", () => {
    for (const bad of ["../../etc/passwd", "https://evil.example/x.png", "a/b/c.png", "x.png"]) {
      expect(parsePoster({ blocks: headline, background: bad })!.background, bad).toBeUndefined();
    }
  });
});
