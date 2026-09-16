import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { cardInputFrom, quoteCard, type CardChart, type CardRow, type QuoteCard } from "@/lib/quote-card";
import { cardPaletteFor, type CardPalette } from "@/lib/card-theme";
import { SIGNATURE_HEIGHT, SIGNATURE_TEXT, markDataUri } from "@/lib/card-signature";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;


const WIDTH = 1000;
const PAD = 56;

/**
 * Every band of the card, in pixels.
 *
 * The drawing library lays a fixed canvas out in one pass and will squeeze one line on top of
 * another rather than grow the page — the first draft did exactly that. So each band is given
 * a height here, every element is told not to shrink, and the canvas is the sum of the bands.
 * Layout and canvas can then never disagree, because they are the same numbers.
 */
const H = {
  plan: 44,
  insured: 44,
  premium: 132,
  noPrice: 62,
  perDay: 40,
  others: 38,
  /** the space above a divided section */
  gap: 36,
  hairline: 1,
  afterHairline: 26,
  sectionTitle: 42,
  row: 54,
  note: 32,
  /** the strip of colour keys under the drawing */
  legend: 46,
};


function sectionHeight(rows: CardRow[] | undefined): number {
  if (!rows?.length) return 0;
  return H.gap + H.hairline + H.afterHairline + H.sectionTitle + rows.length * H.row;
}

function chartHeight(chart: CardChart | undefined): number {
  if (!chart) return 0;
  return H.gap + H.hairline + H.afterHairline + H.sectionTitle + chart.height + H.legend;
}

function heightOf(card: QuoteCard): number {
  return PAD * 2
    + H.plan + H.insured
    + (card.premium ? H.premium : H.noPrice)
    + (card.perDay ? H.perDay : 0)
    + card.others.length * H.others
    + card.sections.reduce((h, s) => h + sectionHeight(s.rows), 0)
    + chartHeight(card.chart)
    + H.gap + H.hairline + H.afterHairline + card.notes.length * H.note
    + SIGNATURE_HEIGHT;
}

/** A band that keeps its height whatever else is on the card. */
const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

function Rows({ title, rows, p }: { title: string; rows: CardRow[]; p: CardPalette }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={spacer(H.gap)} />
      <div style={spacer(H.hairline, p.hair)} />
      <div style={spacer(H.afterHairline)} />
      <div style={{ ...band(H.sectionTitle), fontSize: 26, color: p.mute }}>{title}</div>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{ ...band(H.row), width: "100%", justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", fontSize: 27, color: p.mute }}>{r.label}</div>
          <div style={{ display: "flex", fontFamily: "Trirong", fontSize: 34, color: p.ink }}>{r.amount} บาท</div>
        </div>
      ))}
    </div>
  );
}

/**
 * The contract as three lines. The drawing library takes SVG elements but silently drops an
 * <img> holding an SVG data URI, which is how the first attempt at this came out blank — so
 * the shapes are written out here rather than handed over as a picture.
 */
function Chart({ chart, p }: { chart: CardChart; p: CardPalette }) {
  const { width: w, height: h } = chart;
  /** a label placed over the drawing; the SVG itself carries no text at all */
  const label = (style: React.CSSProperties) => ({
    position: "absolute" as const, display: "flex", fontSize: 22, color: p.mute, ...style,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={spacer(H.gap)} />
      <div style={spacer(H.hairline, p.hair)} />
      <div style={spacer(H.afterHairline)} />
      <div style={{ ...band(H.sectionTitle), fontSize: 26, color: p.mute }}>{chart.title}</div>
      <div style={{ display: "flex", position: "relative", width: w, height: h, flexShrink: 0 }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <line x1={86} y1={h - 44} x2={w - 14} y2={h - 44} stroke={p.rule} strokeWidth={2} />
          <line x1={86} y1={18} x2={86} y2={h - 44} stroke={p.rule} strokeWidth={2} />
          {chart.grid && (
            <line x1={86} y1={chart.grid.y} x2={w - 14} y2={chart.grid.y} stroke={p.rule} strokeWidth={2} />
          )}
          <polyline fill="none" stroke={p.line.cover} strokeWidth={4} strokeDasharray="10 7" points={chart.cover} />
          {chart.premium && (
            <polyline fill="none" stroke={p.line.premium} strokeWidth={4} points={chart.premium} />
          )}
          <polyline fill="none" stroke={p.line.cash} strokeWidth={5} points={chart.cash} />
          {chart.breakEven && (
            <circle cx={chart.breakEven.x} cy={chart.breakEven.y} r={9} fill={p.figure} />
          )}
        </svg>
        <div style={label({ right: w - 78, top: 6, justifyContent: "flex-end" })}>{chart.topLabel}</div>
        {chart.grid && (
          <div style={label({ right: w - 78, top: chart.grid.y - 14, justifyContent: "flex-end" })}>
            {chart.grid.label}
          </div>
        )}
        <div style={label({ right: w - 78, top: h - 58, justifyContent: "flex-end" })}>0</div>
        {chart.ticks.map((t) => (
          <div key={t.label} style={label({ left: t.x - 30, top: h - 30, width: 60, justifyContent: "center" })}>
            {t.label}
          </div>
        ))}
      </div>
      <div style={{ ...band(H.legend), alignItems: "center" }}>
        {chart.legend.map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", marginRight: 34 }}>
            {/* the cover's key is broken into two, because the line it stands for is dashed */}
            {l.kind === "cover" ? (
              <div style={{ display: "flex", alignItems: "center", marginRight: 12 }}>
                <div style={{ display: "flex", width: 11, height: 5, background: p.line.cover }} />
                <div style={{ display: "flex", width: 4, height: 5 }} />
                <div style={{ display: "flex", width: 11, height: 5, background: p.line.cover }} />
              </div>
            ) : (
              <div style={{ display: "flex", width: 26, height: 5, background: p.line[l.kind], marginRight: 12 }} />
            )}
            <div style={{ display: "flex", fontSize: 23, color: p.mute }}>{l.label}</div>
          </div>
        ))}
        {chart.breakEven && (
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* a drawn dot rather than a bullet character — the Thai faces have no ● in them */}
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: p.figure, marginRight: 10 }} />
            <div style={{ display: "flex", fontSize: 23, color: p.figure }}>{chart.breakEven.label}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The three faces, read off disk beside this file.
 *
 * They cannot be imported the way a component imports an image: what the bundler hands back
 * is a public asset path, which the drawing library cannot take and which the development
 * server does not serve to a route handler anyway. They are therefore read as files, and
 * next.config.ts lists them so they travel with the deployed function.
 *
 * Thai needs a font that has Thai in it — with none, every letter on the card would be a box.
 * Both faces are under the SIL Open Font License (see LICENSE.md beside them).
 */
const FONT_DIR = path.join(process.cwd(), "src/app/api/card");
const loadFont = (file: string) => readFile(path.join(FONT_DIR, file));

/**
 * A quote drawn as an image, so LINE can hand a customer the same card the sales page
 * shows — something to keep, and to show whoever else in the house has to agree to it.
 *
 * The arrangement is named in the query and priced here, never carried in it: the picture is
 * a rendering of the engine's answer, not of whatever the link happened to say.
 */
export async function GET(req: NextRequest) {
  const input = cardInputFrom(req.nextUrl.searchParams);
  const card = input ? quoteCard(input) : undefined;
  if (!input || !card) return new Response("ไม่พบแบบประกันตามที่ระบุ", { status: 400 });
  /** the theme the plan is sold under, so the card matches the page it was quoted from */
  const p = cardPaletteFor(input);

  const [regular, semibold, display, mark] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
    markDataUri(),
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
          background: `linear-gradient(160deg, ${p.ground} 0%, ${p.groundDeep} 82%)`,
          fontFamily: "Plex",
          color: p.ink,
        }}
      >
        <div style={{ ...band(H.plan), fontSize: 27, fontWeight: 600, color: p.accent }}>{card.planLine}</div>
        <div style={{ ...band(H.insured), fontSize: 27, color: p.mute }}>{card.insuredLine}</div>

        {card.premium ? (
          <div style={{ ...band(H.premium), alignItems: "baseline", paddingTop: 14 }}>
            <div style={{ display: "flex", fontFamily: "Trirong", fontSize: 86, lineHeight: 1, color: p.figure }}>
              {card.premium.amount}
            </div>
            <div style={{ display: "flex", fontSize: 30, color: p.mute, marginLeft: 16 }}>
              บาท {card.premium.per}
            </div>
          </div>
        ) : (
          <div style={{ ...band(H.noPrice), fontSize: 34, color: p.accent, alignItems: "center" }}>
            ขอราคาปัจจุบันได้ทางแชท
          </div>
        )}
        {card.perDay && <div style={{ ...band(H.perDay), fontSize: 26, color: p.mute }}>{card.perDay}</div>}
        {card.others.map((line) => (
          <div key={line} style={{ ...band(H.others), fontSize: 25, color: p.mute }}>{line}</div>
        ))}

        {card.sections.map((s) => <Rows key={s.title} title={s.title} rows={s.rows} p={p} />)}
        {card.chart && <Chart chart={card.chart} p={p} />}

        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={spacer(H.gap)} />
          <div style={spacer(H.hairline, p.rule)} />
          <div style={spacer(H.afterHairline)} />
          {/* where it came from, on the thing that travels furthest from here */}
          <div style={{ ...band(SIGNATURE_HEIGHT), alignItems: "flex-end", gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mark} width={30} height={30} alt="" style={{ borderRadius: 7 }} />
            <span style={{ fontSize: 21, color: p.mute }}>{SIGNATURE_TEXT}</span>
          </div>
          {card.notes.map((n) => (
            <div key={n} style={{ ...band(H.note), fontSize: 21, color: p.mute }}>{n}</div>
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
