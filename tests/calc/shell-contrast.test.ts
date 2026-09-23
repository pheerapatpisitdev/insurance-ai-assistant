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
 * the cream ones.
 *
 * There is one skin now rather than three, which removes the failure this file was written
 * for and leaves a different one in its place. Every token is a `var(--bot-*)` pointing at a
 * palette declared once, so the way it breaks now is a token pointed at the wrong end of that
 * palette — muted ink where the ground should be, and nobody notices until a customer opens
 * it. So the arithmetic stays, and it resolves the indirection rather than reading literals.
 */

const css = (p: string) => readFileSync(path.join(process.cwd(), p), "utf8");

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

/** Every `:root` block in a file, merged the way the cascade would merge them. */
function rootTokens(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let at = 0;
  for (;;) {
    const start = text.indexOf(":root {", at);
    if (start === -1) break;
    const open = text.indexOf("{", start);
    const close = text.indexOf("}", open);
    for (const m of text.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) {
      out[m[1]] = m[2].trim();
    }
    at = close + 1;
  }
  return out;
}

/**
 * Follow `var(--x)` until a colour falls out.
 *
 * Every sales token is one of these now, and a test that read the literal would be reading
 * the string "var(--bot-navy)" and passing on it. The depth limit is a cycle guard: a token
 * pointed at itself would otherwise hang the suite rather than fail it.
 */
function resolve(value: string, tokens: Record<string, string>, depth = 0): string {
  const ref = value.match(/^var\((--[\w-]+)\)$/);
  if (!ref) return value;
  if (depth > 8) throw new Error(`${value} does not resolve to a colour`);
  const next = tokens[ref[1]];
  if (!next) throw new Error(`${ref[1]} is not declared`);
  return resolve(next, tokens, depth + 1);
}

/**
 * The one skin, and where its tokens are declared.
 *
 * Kept as a list because the shape of this file is the argument: if a second skin is ever
 * added, it is added here and every assertion below runs against it too.
 */
const THEMES: [name: string, file: string][] = [["หน้าขาย", "src/app/globals.css"]];

describe("the menu can be read on every skin the site wears", () => {
  for (const [name, file] of THEMES) {
    const tokensFor = () => {
      const t = rootTokens(css(file));
      const read = (n: string) => resolve(t[n], t);
      return { read };
    };

    it(`${name}: the labels and the lit one both stand off the ground`, () => {
      const { read } = tokensFor();
      const ground = rgb(read("--lg-ground"));
      // the sidebar sits on the page's own panel colour
      const bg = over(read("--lg-panel"), ground);

      // an ordinary label, the lit one, and the quieter group heading
      expect(ratio(over(read("--lg-white"), bg), bg), `${name} ตัวอักษร`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(over(read("--lg-gold"), bg), bg), `${name} เมนูที่เลือก`).toBeGreaterThanOrEqual(4.5);
      expect(ratio(over(read("--lg-mute"), bg), bg), `${name} หัวข้อกลุ่ม`).toBeGreaterThanOrEqual(4.5);
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
      const { read } = tokensFor();
      const bg = over(read("--lg-panel"), rgb(read("--lg-ground")));
      expect(ratio(over(read("--lg-panel-line"), bg), bg), `${name} เส้นคั่น`).toBeGreaterThan(1.2);
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
    for (const group of [...menuGroups(true), ...menuGroups(false)]) {
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
    for (const group of [...menuGroups(true), ...menuGroups(false)]) {
      const hues = group.links.map((l) => l.hue);
      expect(new Set(hues).size, group.title ?? "ภาพรวม").toBe(hues.length);
    }
  });
});
