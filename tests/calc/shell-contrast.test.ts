import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { menuGroups } from "@/lib/shell/menu";

/**
 * The menu has to be legible on every skin the site wears, and that is checked by arithmetic
 * rather than by looking.
 *
 * This project has been caught by the opposite before — `HomeButton` carries the note, and
 * the memory of it: a colour picked to look right on the dark sales pages was invisible on
 * the cream ones. The sales pages run from near-black to warm cream under one class name, so
 * a menu that reaches for a literal is a menu that disappears on two pages out of six.
 *
 * The rule here is that the menu never names a colour. It declares `--shell-*` and each theme
 * points those at its own tokens, so the arithmetic below is really a check that every theme
 * remembered to point them somewhere legible.
 */

const css = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

/** the last value wins, as the cascade would take it within one block */
function tokensIn(text: string, selector: string): Record<string, string> {
  const start = text.indexOf(selector);
  if (start === -1) return {};
  const open = text.indexOf("{", start);
  const close = text.indexOf("}", open);
  const body = text.slice(open + 1, close);
  const out: Record<string, string> = {};
  for (const m of body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function channel(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function rgb(value: string): [number, number, number] {
  const hex = value.match(/#([0-9a-f]{3,8})/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex.slice(0, 6);
    return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)) as [number, number, number];
  }
  const parts = value.match(/rgba?\(([^)]+)\)/)?.[1].split(",").map((n) => Number(n.trim()));
  if (!parts) throw new Error(`cannot read colour: ${value}`);
  return [parts[0], parts[1], parts[2]];
}

/** a translucent colour laid over its ground, which is what the eye is given */
function over(value: string, ground: [number, number, number]): [number, number, number] {
  const a = Number(value.match(/rgba\([^)]*,\s*([\d.]+)\s*\)/)?.[1] ?? 1);
  const [r, g, b] = rgb(value);
  return [0, 1, 2].map((i) => [r, g, b][i] * a + ground[i] * (1 - a)) as [number, number, number];
}

function ratio(fg: [number, number, number], bg: [number, number, number]): number {
  const l = (c: [number, number, number]) =>
    0.2126 * channel(c[0]) + 0.7152 * channel(c[1]) + 0.0722 * channel(c[2]);
  const [a, b] = [l(fg), l(bg)].sort((x, y) => y - x);
  return (a + 0.05) / (b + 0.05);
}

/** Every skin the menu has to sit on, and where its tokens are declared. */
const THEMES: [name: string, file: string, selector: string][] = [
  ["หน้าขายสีดำ", "src/app/globals.css", ":root {"],
  ["หน้าขายสีโรส", "src/app/satin-rose.css", ".satin-rose .theme-legacy {"],
  ["หน้าขายสีครีม", "src/app/ishield/theme.css", ".ishield-scope .theme-legacy {"],
];

describe("the menu can be read on every skin the site wears", () => {
  for (const [name, file, selector] of THEMES) {
    it(`${name}: the labels and the lit one both stand off the ground`, () => {
      const t = tokensIn(css(file), selector);
      const ground = rgb(t["--lg-ground"]);
      // the sidebar sits on the plan's own panel colour, which on the dark skin is a
      // translucent white and has to be composited before it means anything
      const bg = over(t["--lg-panel"], ground);

      // an ordinary label, the lit one, and the quieter group heading
      expect(ratio(over(t["--lg-white"], bg), bg), `${name} ตัวอักษร`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(over(t["--lg-gold"], bg), bg), `${name} เมนูที่เลือก`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(over(t["--lg-mute"], bg), bg), `${name} หัวข้อกลุ่ม`).toBeGreaterThanOrEqual(4.5);
    });

    /**
     * The rule between groups is decoration and is held to a decoration's bar.
     *
     * It was written at 1.5 first, which the dark skin misses at 1.45 — and the right answer
     * was not to raise `--lg-panel-line`, which every panel on every sales page is drawn with,
     * to satisfy a number invented here. It was to stop the rule carrying meaning. The groups
     * are named, those names clear 4.5 on all three skins, and somebody who cannot make out
     * the hairline has lost nothing they needed.
     */
    it(`${name}: the rule between groups is visible as decoration`, () => {
      const t = tokensIn(css(file), selector);
      const bg = over(t["--lg-panel"], rgb(t["--lg-ground"]));
      expect(ratio(over(t["--lg-panel-line"], bg), bg), `${name} เส้นคั่น`).toBeGreaterThan(1.2);
    });
  }
});

/**
 * The chips.
 *
 * A hue is the one colour the menu writes down, and it is allowed to because it never lands
 * on the page's ground — it fills a chip, and the chip carries its own white drawing. So what
 * has to hold is the thing inside the chip, on every skin at once, because the chip is the
 * same colour on all of them. The drawing is decoration with a word beside it, which is the
 * 3:1 bar rather than the 4.5:1 one.
 */
describe("the colours the menu wears itself", () => {
  it("draws every icon clearly on its own chip", () => {
    for (const group of menuGroups(true)) {
      for (const link of group.links) {
        // the chip is a gradient from the hue to a darker mix of it; the lit half is the
        // hard case for white, so that is the one checked
        expect(ratio([255, 255, 255], rgb(link.hue)), `${link.label} ${link.hue}`).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it("gives no two links in a group the same colour", () => {
    // two orange chips side by side is one chip twice: the point of them is to be reached
    // for without reading, and that only works while they differ from their neighbours
    for (const group of menuGroups(true)) {
      const hues = group.links.map((l) => l.hue);
      expect(new Set(hues).size, group.title ?? "ภาพรวม").toBe(hues.length);
    }
  });
});
