import { describe, expect, it } from "vitest";
import { POSTER_THEMES, posterScrim } from "@/lib/card-theme";
import { backgroundPrompt } from "@/lib/content/background";
import { parsePoster, THEME_LABEL, THEMES } from "@/lib/content/poster";

/** WCAG relative luminance and contrast, from "#rrggbb" */
const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe("the poster's colour themes (owner, 2026-09-24)", () => {
  it("offers twenty tones and ภาพล้วน, the three brand ones first", () => {
    expect(THEMES).toHaveLength(21);
    expect(THEMES).toContain("photo");
    expect(THEMES.slice(0, 3)).toEqual(["navy", "sand", "white"]);
  });
  for (const t of THEMES) {
    describe(t, () => {
      const c = POSTER_THEMES[t];
      it("has a Thai name, colours and a scrim", () => {
        expect(THEME_LABEL[t]).toBeTruthy();
        expect(c).toBeDefined();
        // ภาพล้วน lays nothing over the photo; every other theme washes the side the words sit
        if (t === "photo") expect(posterScrim(t, "bottom")).toBe("none");
        else expect(posterScrim(t, "bottom")).toContain("rgba(");
      });
      it("keeps its words readable on both ends of its ground", () => {
        for (const ground of [c.from, c.to]) {
          expect(contrast(c.headline, ground)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(c.sub, ground)).toBeGreaterThanOrEqual(3);
        }
        expect(contrast(c.badgeInk, c.badgeBg)).toBeGreaterThanOrEqual(4.5);
      });
      it("tells the picture model its palette", () => {
        expect(backgroundPrompt({ scene: "x", layout: "bottom", theme: t })).toMatch(/Colour palette: \w/);
      });
      it("survives a round trip through a poster", () => {
        expect(parsePoster({ theme: t, blocks: [{ kind: "headline", text: "ก" }] })?.theme).toBe(t);
      });
    });
  }
});

import { POSTER_RULES } from "@/lib/content/prompt";
import { THEME_MOOD } from "@/lib/content/poster";
import { parseHeadlines } from "@/lib/content/numbers";

describe("ให้ AI เลือก — the writer picks the theme (owner, 2026-09-25)", () => {
  it("tells the writers every theme and what it suits", () => {
    for (const t of THEMES) {
      expect(THEME_MOOD[t]).toBeTruthy();
      expect(POSTER_RULES).toContain(t);
    }
  });
  it("takes the headline model's theme for a numbers post, and only a real one", () => {
    const reply = JSON.stringify({ pieces: [
      { headline: "ก", imagePrompt: "x", theme: "emerald" },
      { headline: "ข", imagePrompt: "x", theme: "purple-ish" },
    ] });
    const [a, b] = parseHeadlines(reply, 2);
    expect(a.theme).toBe("emerald");
    expect(b.theme).toBeUndefined();
  });
});

describe("ภาพล้วน — the photo and the words, no tint (owner, 2026-09-25)", () => {
  it("shadows its words, since nothing is laid under them", () => {
    expect(POSTER_THEMES.photo.textShadow).toMatch(/rgba\(0, 0, 0/);
  });
  it("asks the picture model for the scene's own colours", () => {
    expect(backgroundPrompt({ scene: "x", layout: "bottom", theme: "photo" })).toMatch(/natural colours/i);
  });
});
