import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { iHealthyTableCard, type IHealthyTableCard } from "@/lib/ihealthy-card";
import {
  band, CARD_HEADERS, GOLD, GROUND, GROUND_DEEP, H, loadFonts, MUTE, PAD, PlanTable, RULE,
  spacer, WHITE, widthOf,
} from "../draw";
import { SIGNATURE_HEIGHT, SIGNATURE_TEXT, markDataUri } from "@/lib/card-signature";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** Heading, table, notes — and the bands between them, as on the card. */
function heightOf(card: IHealthyTableCard): number {
  const table = H.head + card.rows.length * H.row
    + (card.premiumRows.length > 0 ? H.section + card.premiumRows.length * H.row : 0);
  return PAD * 2
    + H.plan + H.insured
    + H.gap + H.hairline + H.afterHairline + table
    + H.gap + H.hairline + H.afterHairline + card.notes.length * H.note
    + SIGNATURE_HEIGHT;
}

/**
 * The plans side by side, before the customer has picked one.
 *
 * The bot sends it the moment it knows an age and a sex: a menu of plans as six lines of Thai
 * in a chat is something nobody reads, and the same plans as a table is something they
 * compare. `fit=phone` narrows it to the three the adverts sell.
 *
 * Nothing is highlighted, because nothing has been chosen — which is the only way this differs
 * from the table under a quote card, and the reason both draw the same component.
 */
export async function GET(req: NextRequest) {
  const card = iHealthyTableCard(req.nextUrl.searchParams);

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
          background: `linear-gradient(160deg, ${GROUND} 0%, ${GROUND_DEEP} 82%)`,
          fontFamily: "Plex",
          color: WHITE,
        }}
      >
        <div style={{ ...band(H.plan), fontSize: 30, fontWeight: 600, color: GOLD }}>{card.headLine}</div>
        <div style={{ ...band(H.insured), fontSize: 25, color: MUTE }}>{card.insuredLine}</div>

        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={spacer(H.gap)} />
          <div style={spacer(H.hairline, RULE)} />
          <div style={spacer(H.afterHairline)} />
          <PlanTable card={card} selected={-1} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={spacer(H.gap)} />
          <div style={spacer(H.hairline, RULE)} />
          <div style={spacer(H.afterHairline)} />
          {/* where it came from, on the thing that travels furthest from here */}
          <div style={{ ...band(SIGNATURE_HEIGHT), alignItems: "flex-end", gap: 12 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={mark} height={34} alt="" />
            <span style={{ fontSize: 21, color: MUTE }}>{SIGNATURE_TEXT}</span>
          </div>
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
