import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { cardInputFrom, quoteCard, type CardRow, type QuoteCard } from "@/lib/quote-card";

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
};

function sectionHeight(rows: CardRow[] | undefined): number {
  if (!rows?.length) return 0;
  return H.gap + H.hairline + H.afterHairline + H.sectionTitle + rows.length * H.row;
}

function heightOf(card: QuoteCard): number {
  return PAD * 2
    + H.plan + H.insured
    + (card.premium ? H.premium : H.noPrice)
    + (card.perDay ? H.perDay : 0)
    + (card.others ? H.others : 0)
    + card.sections.reduce((h, s) => h + sectionHeight(s.rows), 0)
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
 * A quote drawn as an image, so LINE, Messenger and the web chat can hand a customer the
 * same card the sales page shows — something to keep, and to show whoever else in the house
 * has to agree to it.
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
        {card.others && <div style={{ ...band(H.others), fontSize: 25, color: MUTE }}>{card.others}</div>}

        {card.sections.map((s) => <Rows key={s.title} title={s.title} rows={s.rows} />)}

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
