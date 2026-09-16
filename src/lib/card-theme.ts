import type { CardInput } from "@/lib/card-link";

/**
 * The palette a quote card is drawn in.
 *
 * A card is the sales page torn off and handed over, so it has to be the page's colours: a
 * customer who has just read /ishield in copper and then receives a charcoal-and-gold picture
 * has been sent something from somewhere else. One palette per sales theme, picked by the plan
 * the card is drawing.
 *
 * Two slots change which end of the scale they sit at between a dark theme and a light one, so
 * they are named for their job rather than their colour: `figure` is whatever the premium is
 * set in — the brightest thing on the charcoal, the darkest on the ivory — and `ink` is the
 * body text. Anything named for a colour would have to lie in half the palettes.
 */
export interface CardPalette {
  /** the two ends of the card's background wash */
  ground: string;
  groundDeep: string;
  /** the plan's name, and anything else the eye should reach before the body text */
  accent: string;
  /** the premium itself, and the break-even marker: the loudest thing on the card */
  figure: string;
  /** body text */
  ink: string;
  /** labels, small print, axis numbers */
  mute: string;
  /** the hairline above a section */
  hair: string;
  /** the plainer rule: chart axes, the line above the notes */
  rule: string;
  /** the wash behind the quoted column of the value table */
  glow: string;
  /** every other row of the value table */
  stripe: string;
  /** the value table's gridlines */
  grid: string;
  /** the tint marking the quoted row */
  tint: string;
  /** the three series of the cash-value drawing */
  line: { cash: string; premium: string; cover: string };
}

/**
 * The original: charcoal and gold, worn by /lifeprotect and /lifetreasure, and by anything
 * whose plan has not been given a palette of its own. Kept to the exact values the card was
 * drawn in before there was more than one theme, so those two cards are unchanged.
 */
const CHARCOAL_GOLD: CardPalette = {
  ground: "#26272a",
  groundDeep: "#1c1d1f",
  accent: "#c9a26f",
  figure: "#f2e0bb",
  ink: "#f5f5f5",
  mute: "rgba(245,245,245,0.72)",
  hair: "rgba(201,162,111,0.24)",
  rule: "rgba(255,255,255,0.12)",
  glow: "rgba(201,162,111,0.14)",
  stripe: "rgba(255,255,255,0.035)",
  grid: "rgba(201,162,111,0.22)",
  tint: "rgba(201,162,111,0.11)",
  line: { cash: "#c9a26f", premium: "rgba(245,245,245,0.5)", cover: "rgba(245,245,245,0.34)" },
};

/** /ishield: copper on warm cream. */
const COPPER_IVORY: CardPalette = {
  ground: "#f8f4ee",
  groundDeep: "#efe6d9",
  accent: "#85512f",
  figure: "#6b3b22",
  ink: "#3b2418",
  mute: "#6b5647",
  hair: "#b3a08b",
  rule: "#a08a72",
  glow: "rgba(169,113,75,0.10)",
  stripe: "rgba(107,59,34,0.035)",
  grid: "rgba(160,138,114,0.35)",
  tint: "rgba(169,113,75,0.10)",
  line: { cash: "#85512f", premium: "#8a8075", cover: "#9c8f82" },
};

/** /plb and /legacy: terracotta and silver on blush ivory. */
const SATIN_ROSE: CardPalette = {
  ground: "#f8f3f0",
  groundDeep: "#ece4df",
  accent: "#8c4a3f",
  figure: "#5e2f28",
  ink: "#36211f",
  mute: "#635553",
  hair: "#ab9c9a",
  rule: "#9c8e8c",
  glow: "rgba(160,90,76,0.10)",
  stripe: "rgba(54,33,31,0.035)",
  grid: "rgba(156,142,140,0.35)",
  tint: "rgba(160,90,76,0.10)",
  line: { cash: "#8c4a3f", premium: "#857a78", cover: "#948886" },
};

/**
 * /ihealthy-ultra: the rose satin, because that is what the page wears now.
 *
 * Drawn by its own route rather than this one, and exported for it — the palettes belong
 * together even when the drawing does not.
 *
 * Everything is SATIN_ROSE's except the grey. This card fades some cells to 85% — the ceiling
 * row, whose figures sit in a column the age cannot buy but which are real figures all the
 * same — and the satin's own #635553 comes out of that fade at 4.5:1 on the lightest ground
 * and 4.1:1 at the deep end of the wash, which is under the bar on a picture the reader
 * cannot zoom out of. At this value the faded cells hold 5.5:1 and 5.0:1. The difference is
 * invisible at full strength and is the whole point at 85%.
 */
export const IHEALTHY_SATIN: CardPalette = {
  ...SATIN_ROSE,
  mute: "#524645",
};

/**
 * Which theme a plan is sold under. Keyed by the code the card link already carries, so a page
 * says nothing about its colours — adding a `theme=` parameter would let a link ask for a
 * palette the plan is not sold in.
 */
const BY_CODE: Record<string, CardPalette> = {
  ISHIELD: COPPER_IVORY,
  PLB: SATIN_ROSE,
  LEGACY_FAMILY: SATIN_ROSE,
  LIFEPROTECT: CHARCOAL_GOLD,
  LIFETREASURE: CHARCOAL_GOLD,
};

/**
 * The palette to draw this card in. An unknown code falls back to the charcoal rather than
 * failing: a card in the wrong colours is a blemish, a card that does not draw is a customer
 * left without an answer.
 */
export function cardPaletteFor(input: CardInput): CardPalette {
  const code = input.kind === "bundle" ? input.bundleCode : input.planCode;
  return BY_CODE[code] ?? CHARCOAL_GOLD;
}

/**
 * A short fingerprint of a palette's colours, written into every card link.
 *
 * A card is cached by its address — an hour in the browser, a day at the edge — and the
 * palette is not part of the address, so re-colouring a plan leaves every card already
 * fetched serving the old colours until its cache expires. An agent who sent a quote
 * yesterday would keep getting yesterday's palette for a day after the change went out.
 *
 * Deriving it from the colours rather than bumping a number by hand means the cache clears
 * itself whenever the palette actually changes, and stays put when it does not. The route
 * ignores the parameter: it is an address, not an instruction, and a card asked for under
 * any `v` is drawn in the palette the plan is currently sold under.
 *
 * It covers the colours only, which is what it is named for. Changing the drawing's *shape* —
 * a band's height, a new row — still serves stale pictures for up to a day.
 */
export function cardPaletteVersion(palette: CardPalette): string {
  const canonical = [
    palette.ground, palette.groundDeep, palette.accent, palette.figure, palette.ink,
    palette.mute, palette.hair, palette.rule, palette.glow, palette.stripe,
    palette.grid, palette.tint, palette.line.cash, palette.line.premium, palette.line.cover,
  ].join("|");
  // FNV-1a: a few lines, no dependency, and the same answer in the browser and on the server —
  // the link is written in both. Math.imul keeps the multiply in 32 bits.
  let h = 0x811c9dc5;
  for (let i = 0; i < canonical.length; i += 1) {
    h ^= canonical.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

/** The fingerprint of the palette this card will be drawn in. */
export function cardVersionFor(input: CardInput): string {
  return cardPaletteVersion(cardPaletteFor(input));
}
