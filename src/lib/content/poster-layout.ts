import type { BlockKind, PosterSpec } from "./poster";

/**
 * The poster's geometry, ported from Maryjane's poster-render.tsx with its lessons kept:
 *
 * - The drawing library reads a Thai sentence as one unbreakable word — there are no spaces to
 *   break at — and a long headline is silently cropped. withBreaks() puts a zero-width space
 *   between the words Intl.Segmenter finds, which draws as nothing and lets lines wrap.
 * - It also never says when text overflows the canvas; the last lines simply vanish. So the
 *   height is estimated first and the whole poster scaled down until it fits (fitScale).
 * - Every measure is tuned at 1080 wide and scaled by k for other canvases.
 */

export const BASE_WIDTH = 1080;
const PADDING = 90;
export const LINE_HEIGHT = 1.3;
/** a Thai glyph's width against its font size, measured roughly on IBM Plex Sans Thai */
const GLYPH = 0.55;

export const FONT_SIZE: Record<BlockKind, number> = { badge: 34, headline: 84, sub: 44, footer: 32 };

export interface Canvas {
  width: number;
  height: number;
}

export interface Metrics {
  k: number;
  padX: number;
  padTop: number;
  padBottom: number;
  gap: number;
  usableWidth: number;
  usableHeight: number;
}

/**
 * A story is 9:16 and Facebook lays its own name and buttons over the top and bottom of one,
 * so a tall canvas keeps its words out of those bands — Maryjane's SAFE_INSETS for stories.
 */
export function metrics(c: Canvas): Metrics {
  const k = c.width / BASE_WIDTH;
  const tall = c.height / c.width > 1.5;
  const padX = Math.round(PADDING * k);
  const padTop = tall ? Math.round(c.height * 0.14) : padX;
  const padBottom = tall ? Math.round(c.height * 0.2) : padX;
  return {
    k, padX, padTop, padBottom,
    gap: Math.round(22 * k),
    usableWidth: c.width - 2 * padX,
    usableHeight: c.height - padTop - padBottom,
  };
}

const segmenter = typeof Intl !== "undefined" && "Segmenter" in Intl
  ? new Intl.Segmenter("th", { granularity: "word" })
  : null;

export function withBreaks(text: string): string {
  if (!segmenter) return text;
  return Array.from(segmenter.segment(text), (s) => s.segment).join("​");
}

export function fontSize(kind: BlockKind, m: Metrics, scale: number): number {
  return Math.max(14, Math.round(FONT_SIZE[kind] * m.k * scale));
}

function estimateHeight(p: PosterSpec, m: Metrics, scale: number): number {
  return p.blocks.reduce((sum, b, i) => {
    const size = fontSize(b.kind, m, scale);
    const perLine = Math.max(1, Math.floor(m.usableWidth / (size * GLYPH)));
    const lines = Math.max(1, Math.ceil([...b.text].length / perLine));
    // a badge sits in a pill, which adds its own padding above and below
    const pill = b.kind === "badge" ? size * 0.6 : 0;
    return sum + size * LINE_HEIGHT * lines + pill + (i === 0 ? 0 : m.gap);
  }, 0);
}

/** 1 when the poster fits as designed; otherwise the factor, stepped down, that makes it fit. */
export function fitScale(p: PosterSpec, c: Canvas): number {
  const m = metrics(c);
  let scale = 1;
  // stepped rather than solved: shrinking changes how many lines each block wraps to
  for (let i = 0; i < 20 && estimateHeight(p, m, scale) > m.usableHeight; i++) scale *= 0.9;
  return scale;
}
