import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CardCell } from "@/lib/ihealthy-card";

/**
 * The ink both health pictures are drawn with: the palette, the bands, and the three
 * primitives that put a table on a fixed canvas.
 *
 * It is a module rather than a second copy because the quote card and the comparison table
 * are the same table under two different headings — and a palette that drifted between them
 * would have the agency send two pictures that do not look like each other.
 */

/** The sales page's palette, so a card dropped into a chat is recognisably the same agency. */
export const GROUND = "#26272a";
export const GROUND_DEEP = "#1c1d1f";
export const GOLD = "#c9a26f";
export const GOLD_LIT = "#f2e0bb";
export const WHITE = "#f5f5f5";
export const MUTE = "rgba(245,245,245,0.72)";
export const RULE = "rgba(255,255,255,0.12)";
export const GRID = "rgba(201,162,111,0.22)";
/** the chosen plan's column, laid over the ground rather than instead of it */
export const TINT = "rgba(201,162,111,0.11)";

/**
 * The canvas, and the table drawn on it.
 *
 * Six plans of Thai and a column of row titles decide the width, not the other way round:
 * "ตามที่จ่ายจริง" is the longest thing any cell says, and a column too narrow for it would
 * have the drawing library wrap it onto a second line inside a row whose height is already
 * fixed — which is how a table quietly loses a word.
 */
export const PAD = 45;
export const TITLE_W = 330;
export const COL_W = 170;

/**
 * Every band of the card, in pixels.
 *
 * The drawing library lays a fixed canvas out in one pass and will squeeze one line on top of
 * another rather than grow the page. So each band is given a height here, every element is
 * told not to shrink, and the canvas is the sum of the bands — layout and canvas can then
 * never disagree, because they are the same numbers.
 */
export const H = {
  plan: 46,
  insured: 42,
  premium: 126,
  noPrice: 60,
  line: 40,
  warn: 36,
  /** one band of what the family receives, set apart from what the customer pays */
  death: 40,
  /** the space above the first of them */
  beforeDeath: 18,
  /** the space above a divided section */
  gap: 30,
  hairline: 1,
  afterHairline: 22,
  head: 62,
  row: 54,
  /** the strip that says everything below it is price and not cover */
  section: 44,
  note: 34,
};

/** A band that keeps its height whatever else is on the card. */
export const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
export const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

/** One of the card's own figures: what it is on the left, what it costs on the right. */
export function Line({ label, amount }: { label: string; amount: string }) {
  return (
    <div style={{ ...band(H.line), alignItems: "baseline", justifyContent: "space-between" }}>
      <div style={{ display: "flex", fontSize: 25, color: MUTE }}>{label}</div>
      <div style={{ display: "flex", fontSize: 25, color: WHITE }}>{amount}</div>
    </div>
  );
}

/**
 * A cell of the table.
 *
 * Sized rather than spaced: the width is the column's and the height is the row's, and the
 * text is centred inside it. A cell that could grow would move every column to its right.
 */
export function Cell(
  { children, width, height, tint, dim, align = "center", weight = 400, size = 20, color = MUTE }: {
    children: string; width: number; height: number;
    tint?: boolean; dim?: boolean; align?: "center" | "flex-start";
    weight?: number; size?: number; color?: string;
  },
) {
  return (
    <div
      style={{
        display: "flex", width, minWidth: width, maxWidth: width, height,
        boxSizing: "border-box", flexShrink: 0,
        alignItems: "center", justifyContent: align,
        padding: align === "center" ? "0 8px" : "0 12px",
        borderRight: `1px solid ${GRID}`,
        background: tint ? TINT : "transparent",
        fontSize: size, fontWeight: weight, color,
        // Faded, not illegible. The screen table refuses to fade this text for the same
        // reason: the ceiling row carries real figures in a column the age cannot buy, and
        // 0.6 took them under 4:1 on this ground — in an image a reader cannot zoom out of.
        ...(dim ? { opacity: 0.85 } : {}),
      }}
    >
      {children}
    </div>
  );
}

/** One line of the table: a title, then a figure under each plan. */
export function Row(
  { label, cells, selected, height = H.row, weight = 400, color = MUTE }: {
    label: string; cells: CardCell[]; selected: number; height?: number;
    weight?: number; color?: string;
  },
) {
  return (
    <div style={{ display: "flex", height, flexShrink: 0, borderTop: `1px solid ${GRID}` }}>
      <Cell width={TITLE_W} height={height} align="flex-start" size={21} color={WHITE} weight={500}>
        {label}
      </Cell>
      {cells.map((c, i) => (
        <Cell
          key={i} width={COL_W} height={height} tint={i === selected} dim={c.dim}
          weight={weight} color={i === selected ? GOLD_LIT : color}
        >
          {c.text}
        </Cell>
      ))}
    </div>
  );
}

/**
 * Where the font files are, and why they are listed in next.config.ts.
 *
 * The same two faces the other card draws with, read from where that route keeps them rather
 * than copied: Thai needs a font that has Thai in it — with none, every letter would be a
 * box. Both are under the SIL Open Font License (see LICENSE.md beside them).
 */
const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

/**
 * How wide a canvas with this many plan columns has to be.
 *
 * It was a constant for six. A phone gets three, and a canvas still sized for six would
 * print them against half a page of empty ground — which in a chat is a picture the reader
 * has to pinch to read the small half of.
 */
export function widthOf(columns: number): number {
  return PAD * 2 + TITLE_W + COL_W * columns;
}

/** The three faces, loaded once per request, in the shape `ImageResponse` wants them. */
export async function loadFonts() {
  const [regular, semibold, display] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
  ]);
  return [
    { name: "Plex", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Plex", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Trirong", data: display, weight: 600 as const, style: "normal" as const },
  ];
}

/** One day at the edge, an hour in a browser — the same as every other card here. */
export const CARD_HEADERS = {
  "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
};
