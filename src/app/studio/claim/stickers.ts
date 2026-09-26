import { POSTER_THEMES } from "@/lib/card-theme";
import type { Box } from "@/lib/content/claim";

/**
 * What covers a name on a claim paper (owner, 2026-09-25: "สติ๊กเกอร์น่ารัก" in place of black
 * bars). Each is an opaque pastel pill with a face and a word, taking turns down the paper.
 *
 * Still a cover first: the pill is laid a little wider and taller than the box, by enough that
 * its rounded corners reach past the box's own corners, so nothing under it shows at the edge.
 * The page shows the same pill the canvas burns in, from the same numbers.
 */

/** the pastel poster tones; their colours live in card-theme.ts with every other drawn colour */
const TONES = ["blush", "sunny", "sky", "mint", "lavender"] as const;

const FACES = [
  { face: "🙈", word: "ความลับนะ" },
  { face: "⭐", word: "ส่วนตัวจ้า" },
  { face: "💖", word: "ปิดไว้ก่อน" },
  { face: "🔒", word: "ข้อมูลส่วนตัว" },
  { face: "🌸", word: "ขอเก็บไว้นะ" },
] as const;

export interface Sticker {
  fill: string;
  ink: string;
  edge: string;
  face: string;
  word: string;
}

/** the i-th sticker on a paper: tones and faces step at different paces, so neighbours differ in both */
export function stickerAt(i: number): Sticker {
  const t = POSTER_THEMES[TONES[i % TONES.length]];
  const f = FACES[(i * 2) % FACES.length];
  return { fill: t.from, ink: t.headline, edge: t.to, face: f.face, word: f.word };
}

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  radius: number;
}

/**
 * A box as the pill drawn over it, in pixels of a W×H paper. The corner radius is a third of
 * the box's short side; a quarter-circle corner falls short of the square corner by 0.29 of
 * its radius, so each side reaches out by 0.3 of that radius, and a pixel more.
 */
export function stickerRect(b: Box, W: number, H: number): Rect {
  const x0 = Math.floor(b.x * W);
  const y0 = Math.floor(b.y * H);
  const x1 = Math.ceil((b.x + b.w) * W);
  const y1 = Math.ceil((b.y + b.h) * H);
  const radius = Math.max(2, Math.min(x1 - x0, y1 - y0) / 3);
  // the corner falls short by (1 − 1/√2)·radius ≈ 0.293·radius of the radius it is drawn with
  const pad = Math.ceil(radius * 0.3) + 1;
  return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad, radius };
}

/** The pill burnt into a canvas. `font` is the page's own family, so Thai draws as the page shows it. */
export function drawSticker(g: CanvasRenderingContext2D, b: Box, i: number, W: number, H: number, font: string) {
  const s = stickerAt(i);
  const r = stickerRect(b, W, H);
  g.save();
  g.beginPath();
  g.roundRect(r.x, r.y, r.w, r.h, r.radius);
  g.fillStyle = s.fill;
  g.fill();
  g.lineWidth = Math.max(1.5, r.h * 0.06);
  g.strokeStyle = s.edge;
  g.stroke();

  // the face and the word, then two faces, then one: the first that fits at a readable size
  const fits = (label: string, size: number) => {
    g.font = `600 ${size}px ${font}`;
    return g.measureText(label).width <= r.w * 0.86;
  };
  const full = r.h * 0.56;
  let label: string = s.face;
  let size = Math.min(full, r.w * 0.6);
  for (const option of [`${s.face} ${s.word}`, `${s.face}${s.face}`]) {
    let at = full;
    while (at > full * 0.7 && !fits(option, at)) at *= 0.94;
    if (fits(option, at)) { label = option; size = at; break; }
  }
  g.font = `600 ${size}px ${font}`;
  g.fillStyle = s.ink;
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(label, r.x + r.w / 2, r.y + r.h / 2 + size * 0.04);
  g.restore();
}
