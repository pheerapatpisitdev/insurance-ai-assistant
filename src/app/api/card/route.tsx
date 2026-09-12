import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { cardInputFrom, quoteCard, type CardChart, type CardRow, type QuoteCard } from "@/lib/quote-card";

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
const HAIR = "rgba(201,162,111,0.24)";
const RULE = "rgba(255,255,255,0.12)";

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

/** cash in gold, premiums in grey, cover as the dashed line it is on the page. */
const LINE = { cash: GOLD, premium: "rgba(245,245,245,0.5)", cover: "rgba(245,245,245,0.34)" } as const;

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
    + H.gap + H.hairline + H.afterHairline + card.notes.length * H.note;
}

/** A band that keeps its height whatever else is on the card. */
const band = (height: number) => ({ display: "flex", height, flexShrink: 0 }) as const;
const spacer = (height: number, background?: string) => (
  { display: "flex", height, flexShrink: 0, ...(background ? { background } : {}) }
) as const;

function Rows({ title, rows }: { title: string; rows: CardRow[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={spacer(H.gap)} />
      <div style={spacer(H.hairline, HAIR)} />
      <div style={spacer(H.afterHairline)} />
      <div style={{ ...band(H.sectionTitle), fontSize: 26, color: MUTE }}>{title}</div>
      {rows.map((r) => (
        <div
          key={r.label}
          style={{ ...band(H.row), width: "100%", justifyContent: "space-between", alignItems: "center" }}
        >
          <div style={{ display: "flex", fontSize: 27, color: MUTE }}>{r.label}</div>
          <div style={{ display: "flex", fontFamily: "Trirong", fontSize: 34, color: WHITE }}>{r.amount} บาท</div>
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
function Chart({ chart }: { chart: CardChart }) {
  const { width: w, height: h } = chart;
  /** a label placed over the drawing; the SVG itself carries no text at all */
  const label = (style: React.CSSProperties) => ({
    position: "absolute" as const, display: "flex", fontSize: 22, color: MUTE, ...style,
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
      <div style={spacer(H.gap)} />
      <div style={spacer(H.hairline, HAIR)} />
      <div style={spacer(H.afterHairline)} />
      <div style={{ ...band(H.sectionTitle), fontSize: 26, color: MUTE }}>{chart.title}</div>
      <div style={{ display: "flex", position: "relative", width: w, height: h, flexShrink: 0 }}>
        <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
          <line x1={86} y1={h - 44} x2={w - 14} y2={h - 44} stroke={RULE} strokeWidth={2} />
          <line x1={86} y1={18} x2={86} y2={h - 44} stroke={RULE} strokeWidth={2} />
          {chart.grid && (
            <line x1={86} y1={chart.grid.y} x2={w - 14} y2={chart.grid.y} stroke={RULE} strokeWidth={2} />
          )}
          <polyline fill="none" stroke={LINE.cover} strokeWidth={4} strokeDasharray="10 7" points={chart.cover} />
          {chart.premium && (
            <polyline fill="none" stroke={LINE.premium} strokeWidth={4} points={chart.premium} />
          )}
          <polyline fill="none" stroke={LINE.cash} strokeWidth={5} points={chart.cash} />
          {chart.breakEven && (
            <circle cx={chart.breakEven.x} cy={chart.breakEven.y} r={9} fill={GOLD_LIT} />
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
                <div style={{ display: "flex", width: 11, height: 5, background: LINE.cover }} />
                <div style={{ display: "flex", width: 4, height: 5 }} />
                <div style={{ display: "flex", width: 11, height: 5, background: LINE.cover }} />
              </div>
            ) : (
              <div style={{ display: "flex", width: 26, height: 5, background: LINE[l.kind], marginRight: 12 }} />
            )}
            <div style={{ display: "flex", fontSize: 23, color: MUTE }}>{l.label}</div>
          </div>
        ))}
        {chart.breakEven && (
          <div style={{ display: "flex", alignItems: "center" }}>
            {/* a drawn dot rather than a bullet character — the Thai faces have no ● in them */}
            <div style={{ display: "flex", width: 14, height: 14, borderRadius: 7, background: GOLD_LIT, marginRight: 10 }} />
            <div style={{ display: "flex", fontSize: 23, color: GOLD_LIT }}>{chart.breakEven.label}</div>
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
  if (!card) return new Response("ไม่พบแบบประกันตามที่ระบุ", { status: 400 });

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
        <div style={{ ...band(H.plan), fontSize: 27, fontWeight: 600, color: GOLD }}>{card.planLine}</div>
        <div style={{ ...band(H.insured), fontSize: 27, color: MUTE }}>{card.insuredLine}</div>

        {card.premium ? (
          <div style={{ ...band(H.premium), alignItems: "baseline", paddingTop: 14 }}>
            <div style={{ display: "flex", fontFamily: "Trirong", fontSize: 86, lineHeight: 1, color: GOLD_LIT }}>
              {card.premium.amount}
            </div>
            <div style={{ display: "flex", fontSize: 30, color: MUTE, marginLeft: 16 }}>
              บาท {card.premium.per}
            </div>
          </div>
        ) : (
          <div style={{ ...band(H.noPrice), fontSize: 34, color: GOLD, alignItems: "center" }}>
            ขอราคาปัจจุบันได้ทางแชท
          </div>
        )}
        {card.perDay && <div style={{ ...band(H.perDay), fontSize: 26, color: MUTE }}>{card.perDay}</div>}
        {card.others.map((line) => (
          <div key={line} style={{ ...band(H.others), fontSize: 25, color: MUTE }}>{line}</div>
        ))}

        {card.sections.map((s) => <Rows key={s.title} title={s.title} rows={s.rows} />)}
        {card.chart && <Chart chart={card.chart} />}

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
