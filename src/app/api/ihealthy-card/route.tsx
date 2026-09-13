import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { iHealthyCard, type IHealthyCard } from "@/lib/ihealthy-card";
import {
  band, Cell, CARD_HEADERS, COL_W, GOLD, GOLD_LIT, GRID, GROUND, GROUND_DEEP, H, Line, loadFonts,
  MUTE, PAD, Row, RULE, spacer, TINT, TITLE_W, WHITE, widthOf,
} from "./draw";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;







function heightOf(card: IHealthyCard): number {
  const table = H.head + card.rows.length * H.row
    + (card.premiumRows.length > 0 ? H.section + card.premiumRows.length * H.row : 0);
  return PAD * 2
    + H.plan + H.insured
    + (card.premium ? H.premium : H.noPrice)
    + card.lines.length * H.line
    + (card.belowMinimum ? H.warn : 0)
    + H.beforeDeath + card.death.length * H.death
    + H.gap + H.hairline + H.afterHairline + table
    + H.gap + H.hairline + H.afterHairline + card.notes.length * H.note;
}



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
        <div style={spacer(H.beforeDeath)} />
        {card.death.map((row) => (
          <div
            key={row.label}
            style={{ ...band(H.death), fontSize: 23, color: GOLD, alignItems: "center", justifyContent: "space-between" }}
          >
            <div style={{ display: "flex" }}>{row.label}</div>
            <div style={{ display: "flex" }}>{row.amount.toLocaleString("en-US")} บาท</div>
          </div>
        ))}

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
                <Cell width={COL_W * card.columns.length} height={H.row} size={20} color={WHITE}>{r.span}</Cell>
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
      width: widthOf(card.columns.length),
      height: heightOf(card),
      fonts: await loadFonts(),
      headers: CARD_HEADERS,
    },
  );
}
