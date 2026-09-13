import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { cardInputFrom } from "@/lib/quote-card";
import { valueTableCard, type ValueTableCard, type ValueTableRow } from "@/lib/quote-card";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** The sales page's palette, so a table dropped into a chat is recognisably the same agency. */
const GROUND = "#26272a";
const GROUND_DEEP = "#1c1d1f";
const GOLD = "#c9a26f";
const GOLD_LIT = "#f2e0bb";
const GOLD_GLOW = "rgba(201,162,111,0.14)";
const WHITE = "#f5f5f5";
const MUTE = "rgba(245,245,245,0.72)";
const FAINT = "rgba(245,245,245,0.42)";
const HAIR = "rgba(201,162,111,0.24)";
const RULE = "rgba(255,255,255,0.12)";
const STRIPE = "rgba(255,255,255,0.035)";

const WIDTH = 1400;
const PAD = 52;
/** the space between the two halves the years are dealt into */
const GUTTER = 48;
const HALF = (WIDTH - PAD * 2 - GUTTER) / 2;

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

/**
 * The five columns, and how each sits in its own half.
 *
 * The year and the age read as labels and sit left; the three amounts are read against each
 * other down the column, so they sit right.
 */
const COLS = [
  { w: 64, align: "flex-start" as const },
  { w: 64, align: "flex-start" as const },
  { w: 166, align: "flex-end" as const },
  { w: 166, align: "flex-end" as const },
  { w: HALF - 64 - 64 - 166 - 166, align: "flex-end" as const },
];

const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

/** Half the years, headed by their own row of column names so each half is read on its own. */
function Half({ columns, rows }: { columns: string[]; rows: ValueTableRow[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", width: HALF, flexShrink: 0 }}>
      <div style={{ ...band(H.head), width: HALF, alignItems: "center", borderBottom: `1px solid ${HAIR}` }}>
        {columns.map((c, i) => (
          <div
            key={c}
            style={{ display: "flex", width: COLS[i].w, justifyContent: COLS[i].align, fontSize: 21, color: MUTE }}
          >
            {c}
          </div>
        ))}
      </div>
      {rows.map((r, n) => {
        // the year the value first covers what has gone in is the one the customer looks for
        const ground = r.breakEven ? GOLD_GLOW : n % 2 ? STRIPE : undefined;
        const ink = r.breakEven ? GOLD_LIT : r.empty ? FAINT : WHITE;
        const cells = [String(r.year), String(r.age), r.paid ?? "—", r.cash, r.cover];
        return (
          <div
            key={r.year}
            style={{
              ...band(H.row), width: HALF, alignItems: "center",
              ...(ground ? { background: ground } : {}),
            }}
          >
            {cells.map((cell, i) => (
              <div
                key={columns[i]}
                style={{
                  display: "flex", width: COLS[i].w, justifyContent: COLS[i].align, fontSize: 22,
                  color: i < 2 ? (r.breakEven ? GOLD_LIT : MUTE) : ink,
                }}
              >
                {cell}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function heightOf(card: ValueTableCard): number {
  const perHalf = Math.ceil(card.rows.length / 2);
  return PAD * 2
    + H.plan + H.insured + H.premium
    + H.gap + H.hairline + H.afterHairline
    + H.caption + H.head + perHalf * H.row
    + H.gap + H.hairline + H.afterHairline
    + card.notes.length * H.note;
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
 * The years are dealt into two halves side by side rather than one long column: sixty-odd
 * rows in a single file makes a picture three times taller than it is wide, which a phone
 * shows as a sliver.
 */
export async function GET(req: NextRequest) {
  const input = cardInputFrom(req.nextUrl.searchParams);
  const card = input?.kind === "plan" ? valueTableCard(input) : undefined;
  if (!card) return new Response("ไม่พบแบบประกันตามที่ระบุ", { status: 400 });

  const [regular, semibold, display] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
  ]);

  const cut = Math.ceil(card.rows.length / 2);
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: PAD,
          background: `linear-gradient(160deg, ${GROUND} 0%, ${GROUND_DEEP} 82%)`,
          fontFamily: "Plex",
          color: WHITE,
        }}
      >
        <div style={{ ...band(H.plan), fontSize: 27, fontWeight: 600, color: GOLD }}>{card.planLine}</div>
        <div style={{ ...band(H.insured), fontSize: 25, color: MUTE }}>{card.insuredLine}</div>
        <div style={{ ...band(H.premium), fontFamily: "Trirong", fontSize: 30, color: GOLD_LIT }}>
          {card.premiumLine}
        </div>

        <div style={spacer(H.gap)} />
        <div style={spacer(H.hairline, HAIR)} />
        <div style={spacer(H.afterHairline)} />
        <div style={{ ...band(H.caption), fontSize: 25, color: GOLD }}>{CAPTION}</div>

        <div style={{ display: "flex", width: WIDTH - PAD * 2, flexShrink: 0 }}>
          <Half columns={card.columns} rows={card.rows.slice(0, cut)} />
          <div style={{ display: "flex", width: GUTTER, flexShrink: 0 }} />
          <Half columns={card.columns} rows={card.rows.slice(cut)} />
        </div>

        <div style={spacer(H.gap)} />
        <div style={spacer(H.hairline, RULE)} />
        <div style={spacer(H.afterHairline)} />
        {card.notes.map((n) => (
          <div key={n} style={{ ...band(H.note), fontSize: 20, color: MUTE }}>{n}</div>
        ))}
      </div>
    ),
    {
      width: WIDTH,
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
