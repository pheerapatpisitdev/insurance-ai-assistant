import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { iHealthyCard, type CardCell, type IHealthyCard } from "@/lib/ihealthy-card";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** The sales page's palette, so a card dropped into a chat is recognisably the same agency. */
const GROUND = "#26272a";
const GROUND_DEEP = "#1c1d1f";
const GOLD = "#c9a26f";
const GOLD_LIT = "#f2e0bb";
const WHITE = "#f5f5f5";
const MUTE = "rgba(245,245,245,0.72)";
const RULE = "rgba(255,255,255,0.12)";
const GRID = "rgba(201,162,111,0.22)";
/** the chosen plan's column, laid over the ground rather than instead of it */
const TINT = "rgba(201,162,111,0.11)";

/**
 * The canvas, and the table drawn on it.
 *
 * Six plans of Thai and a column of row titles decide the width, not the other way round:
 * "ตามที่จ่ายจริง" is the longest thing any cell says, and a column too narrow for it would
 * have the drawing library wrap it onto a second line inside a row whose height is already
 * fixed — which is how a table quietly loses a word.
 */
const PAD = 45;
const TITLE_W = 330;
const COL_W = 170;
const COLUMNS = 6;
const WIDTH = PAD * 2 + TITLE_W + COL_W * COLUMNS;

/**
 * Every band of the card, in pixels.
 *
 * The drawing library lays a fixed canvas out in one pass and will squeeze one line on top of
 * another rather than grow the page. So each band is given a height here, every element is
 * told not to shrink, and the canvas is the sum of the bands — layout and canvas can then
 * never disagree, because they are the same numbers.
 */
const H = {
  plan: 46,
  insured: 42,
  premium: 126,
  noPrice: 60,
  line: 40,
  warn: 36,
  /** what the family receives, set apart from what the customer pays */
  death: 58,
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

function heightOf(card: IHealthyCard): number {
  const table = H.head + card.rows.length * H.row
    + (card.premiumRows.length > 0 ? H.section + card.premiumRows.length * H.row : 0);
  return PAD * 2
    + H.plan + H.insured
    + (card.premium ? H.premium : H.noPrice)
    + card.lines.length * H.line
    + (card.belowMinimum ? H.warn : 0)
    + H.death
    + H.gap + H.hairline + H.afterHairline + table
    + H.gap + H.hairline + H.afterHairline + card.notes.length * H.note;
}

/** A band that keeps its height whatever else is on the card. */
const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

/** One of the card's own figures: what it is on the left, what it costs on the right. */
function Line({ label, amount }: { label: string; amount: string }) {
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
function Cell(
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
function Row(
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
 * The health quote drawn as one picture: the card, and the benefit table under it.
 *
 * The page hands this quote over three other ways, and each of them needs something of the
 * reader — the page itself, a printer, a chat that keeps its formatting. A picture needs
 * none, so it is the one that survives being forwarded to whoever else in the house has to
 * agree to it.
 *
 * The arrangement is named in the query and priced here, never carried in it: what is drawn
 * is a rendering of the engine's answer, not of whatever the link happened to say.
 */
export async function GET(req: NextRequest) {
  const card = iHealthyCard(req.nextUrl.searchParams);
  const selected = card.columns.findIndex((c) => c.selected);

  const [regular, semibold, display] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
  ]);

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
        <div style={{ ...band(H.plan), fontSize: 30, fontWeight: 600, color: GOLD }}>{card.planLine}</div>
        <div style={{ ...band(H.insured), fontSize: 25, color: MUTE }}>{card.insuredLine}</div>

        {card.premium ? (
          <div style={{ ...band(H.premium), alignItems: "baseline", paddingTop: 12 }}>
            <div style={{ display: "flex", fontFamily: "Trirong", fontSize: 82, lineHeight: 1, color: GOLD_LIT }}>
              {card.premium.amount}
            </div>
            <div style={{ display: "flex", fontSize: 29, color: MUTE, marginLeft: 16 }}>
              บาท {card.premium.per}
            </div>
          </div>
        ) : (
          <div style={{ ...band(H.noPrice), fontSize: 32, color: GOLD, alignItems: "center" }}>
            ขอราคาปัจจุบันได้ทางแชท
          </div>
        )}
        {card.lines.map((l) => <Line key={l.label} label={l.label} amount={l.amount} />)}
        {card.belowMinimum && (
          <div style={{ ...band(H.warn), fontSize: 22, color: GOLD }}>{card.belowMinimum}</div>
        )}
        {/* the rider covers the illness; this is the one thing the base plan under it is for */}
        <div style={{ ...band(H.death), fontSize: 24, color: GOLD, alignItems: "flex-end" }}>
          {card.death}
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={spacer(H.gap)} />
          <div style={spacer(H.hairline, RULE)} />
          <div style={spacer(H.afterHairline)} />

          {/* The plan names, and with them the one statement of why a column is dashes at a
              child age — said once here rather than on every row under it. */}
          <div style={{ display: "flex", height: H.head, flexShrink: 0 }}>
            <Cell width={TITLE_W} height={H.head} align="flex-start" size={21} color={MUTE} weight={500}>
              ผลประโยชน์
            </Cell>
            {card.columns.map((c, i) => (
              <div
                key={c.name}
                style={{
                  display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center",
                  width: COL_W, minWidth: COL_W, maxWidth: COL_W, height: H.head,
                  boxSizing: "border-box", flexShrink: 0, padding: "0 8px",
                  borderRight: `1px solid ${GRID}`,
                  background: i === selected ? TINT : "transparent",
                }}
              >
                <div style={{ display: "flex", fontSize: 23, fontWeight: 600, color: i === selected ? GOLD_LIT : MUTE }}>
                  {c.name}
                </div>
                {!c.sold && (
                  <div style={{ display: "flex", fontSize: 15, color: MUTE, marginTop: 2 }}>ไม่ขายที่อายุนี้</div>
                )}
              </div>
            ))}
          </div>

          {card.rows.map((r) =>
            r.span === undefined ? (
              <Row key={r.label} label={r.label} cells={r.cells} selected={selected} />
            ) : (
              // One answer across every plan, because it is the same cover whichever is bought
              <div key={r.label} style={{ display: "flex", height: H.row, flexShrink: 0, borderTop: `1px solid ${GRID}` }}>
                <Cell width={TITLE_W} height={H.row} align="flex-start" size={21} color={WHITE} weight={500}>
                  {r.label}
                </Cell>
                <Cell width={COL_W * COLUMNS} height={H.row} size={20} color={WHITE}>{r.span}</Cell>
              </div>
            ),
          )}

          {card.premiumRows.length > 0 && (
            <div
              style={{
                display: "flex", height: H.section, flexShrink: 0, alignItems: "center",
                paddingLeft: 12, borderTop: `1px solid ${GRID}`, background: GROUND_DEEP,
                fontSize: 21, fontWeight: 600, color: GOLD,
              }}
            >
              เบี้ยประกัน
            </div>
          )}
          {card.premiumRows.map((r) => (
            <Row key={r.label} label={r.label} cells={r.cells} selected={selected} weight={600} color={WHITE} />
          ))}
          {/* the table's own bottom edge; every row above draws only its top */}
          <div style={spacer(H.hairline, GRID)} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={spacer(H.gap)} />
          <div style={spacer(H.hairline, RULE)} />
          <div style={spacer(H.afterHairline)} />
          {card.notes.map((n) => (
            <div key={n} style={{ ...band(H.note), fontSize: 21, color: MUTE }}>{n}</div>
          ))}
        </div>
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
