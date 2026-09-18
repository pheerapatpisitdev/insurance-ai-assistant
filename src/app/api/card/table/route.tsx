import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { cardInputFrom, valueTableCard, type ValueTableCard, type ValueTableRow } from "@/lib/quote-card";
import { cardPaletteFor, type CardPalette } from "@/lib/card-theme";
import { SIGNATURE_HEIGHT, SIGNATURE_TEXT, markDataUri } from "@/lib/card-signature";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** Six columns twice over; 1400 left the seven-figure ones touching their rules. */
const WIDTH = 1600;
/**
 * And wider again for the plans that hand money back, which need a seventh column. The extra
 * room is spent on the column rather than taken from the others: this is an image, where
 * width costs nothing, and squeezing "1,662,000" into a narrower cell costs legibility.
 */
const WIDTH_WITH_PAYOUT = 1900;
const PAD = 52;
/** the space between the two halves the years are dealt into */
const GUTTER = 48;
const halfOf = (width: number) => (width - PAD * 2 - GUTTER) / 2;
const HALF = halfOf(WIDTH);

/**
 * How many years a table can hold before it is dealt into two halves.
 *
 * The halving is for the sixty-row contracts, which in one file make a picture three times
 * taller than it is wide. A five-year term does not have that problem, and splitting it into
 * three rows and two leaves the reader crossing a gutter to find year four — a table
 * pretending to be long.
 *
 * Sixteen, so that the plan whose terms are five, ten, twelve and fifteen years draws all
 * four the same way: a customer comparing two of its terms should not be handed two tables
 * shaped differently. At fifteen rows the picture is still taller than it is wide by less
 * than half again, which is a page rather than a sliver.
 */
const SINGLE_MAX = 16;
const splitsInTwo = (card: ValueTableCard) => card.rows.length > SINGLE_MAX;

/**
 * Every band of the card, in pixels. As on the quote card, the drawing library lays a fixed
 * canvas out in one pass and will squeeze one line on top of another rather than grow the
 * page, so each band is given a height here and the canvas is the sum of the bands.
 */
const H = {
  plan: 42,
  insured: 40,
  premium: 46,
  gap: 30,
  hairline: 1,
  afterHairline: 22,
  caption: 40,
  head: 44,
  row: 36,
  note: 30,
};

const CAPTION = "มูลค่าทุกปี ตั้งแต่ปีแรกจนครบสัญญา";
/** A plan with no surrender column is not showing a value, it is showing a term. */
const COVER_CAPTION = "ความคุ้มครองทุกปี ตั้งแต่ปีแรกจนครบสัญญา";

/**
 * The five columns, and how each sits in its own half.
 *
 * The year and the age read as labels and sit left; the three amounts are read against each
 * other down the column, so they sit right.
 */
const COLS = [
  { w: 60, align: "flex-start" as const },
  { w: 60, align: "flex-start" as const },
  { w: 136, align: "flex-end" as const },
  { w: 152, align: "flex-end" as const },
  { w: 152, align: "flex-end" as const },
  { w: HALF - 60 - 60 - 136 - 152 - 152, align: "flex-end" as const },
];

/**
 * And the layout for a plan with no surrender column, which is one narrower.
 *
 * The room the missing column frees goes to the two money columns rather than to the margin:
 * a five-column table stretched across the same canvas would be mostly rule and air.
 */
const COVER_COLS = [
  { w: 66, align: "flex-start" as const },
  { w: 66, align: "flex-start" as const },
  { w: 176, align: "flex-end" as const },
  { w: 200, align: "flex-end" as const },
  { w: HALF - 66 - 66 - 176 - 200, align: "flex-end" as const },
];

/** The same layout with the payout column, in the wider canvas that makes room for it. */
const PAYOUT_HALF = halfOf(WIDTH_WITH_PAYOUT);
const PAYOUT_COLS = [
  { w: 60, align: "flex-start" as const },
  { w: 60, align: "flex-start" as const },
  { w: 150, align: "flex-end" as const },
  { w: 168, align: "flex-end" as const },
  { w: 150, align: "flex-end" as const },
  { w: 168, align: "flex-end" as const },
  { w: PAYOUT_HALF - 60 - 60 - 150 - 168 - 150 - 168, align: "flex-end" as const },
];

/** Which layout a card is drawn in, decided by the columns it carries. */
function layoutFor(card: ValueTableCard) {
  if (card.columns.length > 6) return { cols: PAYOUT_COLS, half: PAYOUT_HALF, width: WIDTH_WITH_PAYOUT };
  if (card.columns.length < 6) return { cols: COVER_COLS, half: HALF, width: WIDTH };
  return { cols: COLS, half: HALF, width: WIDTH };
}

/** Air either side of a figure, so no column ever touches the rule beside it. */
const CELL_PAD = 11;

/**
 * One cell of the table, ruled off from the one before it.
 *
 * The rule is drawn by the cell rather than by a line of its own so that it runs the whole
 * height of the row: a border on a box that is only as tall as its text leaves a dashed
 * ladder down the table instead of a column.
 */
function Cell(
  { i, cols, height, color, rule, children }:
  { i: number; cols: typeof COLS; height: number; color: string; rule: string; children: string },
) {
  return (
    <div
      style={{
        display: "flex",
        width: cols[i].w,
        height,
        alignItems: "center",
        justifyContent: cols[i].align,
        paddingLeft: CELL_PAD,
        paddingRight: CELL_PAD,
        ...(i > 0 ? { borderLeft: `1px solid ${rule}` } : {}),
        color,
      }}
    >
      {children}
    </div>
  );
}

const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

/** Half the years, headed by their own row of column names so each half is read on its own. */
function Half(
  { columns, rows, p, cols, half }:
  { columns: string[]; rows: ValueTableRow[]; p: CardPalette; cols: typeof COLS; half: number },
) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: half, flexShrink: 0 }}>
      <div style={{ ...band(H.head), width: half, fontSize: 21, borderBottom: `1px solid ${p.hair}` }}>
        {columns.map((c, i) => (
          <Cell key={c} i={i} cols={cols} height={H.head - 1} color={p.ink} rule={p.rule}>{c}</Cell>
        ))}
      </div>
      {rows.map((r, n) => {
        // the year the value first covers what has gone in is the one the customer looks for
        const ground = r.breakEven ? p.glow : n % 2 ? p.stripe : undefined;
        /**
         * One ink for the whole table.
         *
         * The opening years used to recede, and the year and age columns were grey the way a
         * label is. On a phone, zoomed in, that reads as text that has been switched off —
         * the owner's word for it was "why is it grey". The years worth nothing say so in
         * their own column, with a nought and a note underneath; they do not also need to be
         * hard to read.
         */
        const ink = r.breakEven ? p.figure : p.ink;
        /**
         * Built from the columns the row actually carries, so the three shapes of this table
         * — with a payout, with a surrender value, with neither — all draw from one path.
         */
        const cells = [
          String(r.year), String(r.age), r.due, r.paid ?? "—",
          ...(r.payout === undefined ? [] : [r.payout]),
          ...(r.cash === undefined ? [] : [r.cash]),
          r.cover,
        ];
        return (
          <div
            key={r.year}
            style={{ ...band(H.row), width: half, fontSize: 22, ...(ground ? { background: ground } : {}) }}
          >
            {cells.map((cell, i) => (
              <Cell key={columns[i]} i={i} cols={cols} height={H.row} color={ink} rule={p.rule}>{cell}</Cell>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function heightOf(card: ValueTableCard): number {
  const perHalf = splitsInTwo(card) ? Math.ceil(card.rows.length / 2) : card.rows.length;
  return PAD * 2
    + H.plan + H.insured + H.premium
    + H.gap + H.hairline + H.afterHairline
    + H.caption + H.head + perHalf * H.row
    + H.gap + H.hairline + H.afterHairline
    + card.notes.length * H.note
    + SIGNATURE_HEIGHT;
}

/**
 * The three faces, read off disk beside the quote card's own route — see the note there for
 * why they cannot simply be imported.
 */
const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

/**
 * The contract year by year, drawn as an image.
 *
 * The quote card answers what it costs; this one answers what it is worth, every year, to
 * the end — the table the sales page shows, in a form a chat can hand over and a customer
 * can show whoever else in the house has to agree to it.
 *
 * A long contract's years are dealt into two halves side by side rather than one long column:
 * sixty-odd rows in a single file makes a picture three times taller than it is wide, which a
 * phone shows as a sliver. A short one is not split at all — see SINGLE_MAX.
 */
export async function GET(req: NextRequest) {
  const input = cardInputFrom(req.nextUrl.searchParams);
  const card = input?.kind === "plan" ? valueTableCard(input) : undefined;
  if (!input || !card) return new Response("ไม่พบแบบประกันตามที่ระบุ", { status: 400 });
  /** the theme the plan is sold under, so the sheet matches the page it was quoted from */
  const p = cardPaletteFor(input);

  const [regular, semibold, display] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
  ]);

  const split = splitsInTwo(card);
  const cut = split ? Math.ceil(card.rows.length / 2) : card.rows.length;
  const { cols, half, width: wide } = layoutFor(card);
  // one column needs no gutter and no second half, so the canvas gives that room back
  const width = split ? wide : half + PAD * 2;
  const mark = await markDataUri();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: PAD,
          background: `linear-gradient(160deg, ${p.ground} 0%, ${p.groundDeep} 82%)`,
          fontFamily: "Plex",
          color: p.ink,
        }}
      >
        <div style={{ ...band(H.plan), fontSize: 27, fontWeight: 600, color: p.accent }}>{card.planLine}</div>
        <div style={{ ...band(H.insured), fontSize: 25, color: p.ink }}>{card.insuredLine}</div>
        <div style={{ ...band(H.premium), fontFamily: "Trirong", fontSize: 30, color: p.figure }}>
          {card.premiumLine}
        </div>

        <div style={spacer(H.gap)} />
        <div style={spacer(H.hairline, p.hair)} />
        <div style={spacer(H.afterHairline)} />
        <div style={{ ...band(H.caption), fontSize: 25, color: p.accent }}>
          {card.columns.includes("เวนคืนได้") ? CAPTION : COVER_CAPTION}
        </div>

        <div style={{ display: "flex", width: width - PAD * 2, flexShrink: 0 }}>
          <Half columns={card.columns} rows={card.rows.slice(0, cut)} p={p} cols={cols} half={half} />
          {split ? <div style={{ display: "flex", width: GUTTER, flexShrink: 0 }} /> : null}
          {split
            ? <Half columns={card.columns} rows={card.rows.slice(cut)} p={p} cols={cols} half={half} />
            : null}
        </div>

        <div style={spacer(H.gap)} />
        <div style={spacer(H.hairline, p.rule)} />
        <div style={spacer(H.afterHairline)} />
        {/* where it came from, on the thing that travels furthest from here */}
        <div style={{ ...band(SIGNATURE_HEIGHT), alignItems: "flex-end", gap: 12 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mark} height={34} alt="" />
          <span style={{ fontSize: 20, color: p.mute }}>{SIGNATURE_TEXT}</span>
        </div>
        {card.notes.map((n) => (
          <div key={n} style={{ ...band(H.note), fontSize: 20, color: p.ink }}>{n}</div>
        ))}
      </div>
    ),
    {
      width,
      height: heightOf(card),
      fonts: [
        { name: "Plex", data: regular, weight: 400, style: "normal" },
        { name: "Plex", data: semibold, weight: 600, style: "normal" },
        { name: "Trirong", data: display, weight: 600, style: "normal" },
      ],
      headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
    },
  );
}
