
/**
 * The palette a quote card is drawn in.
 *
 * A card is the sales page torn off and handed over, so it has to be the page's colours. There
 * used to be four of these, one per sales theme, because there used to be four sales themes.
 * There is one now, so there is one here.
 *
 * Two slots are named for their job rather than their colour, and the names are kept even
 * though nothing swaps ends any more: `figure` is whatever the premium is set in, and `ink` is
 * the body text. They read correctly whatever a later palette does to them.
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
 * Navy and sand on white — the one palette, taken from the same Bank of Thailand deck the
 * application's own pages are drawn from, so a card and the page it was quoted on are plainly
 * the same business.
 *
 * The ground is flat white rather than a wash. A card travels as an image and is read beside
 * chat bubbles and printed on office paper; a gradient is the first thing to band in a JPEG
 * and the first thing to come out grey on a laser printer.
 *
 * Two values are the card's own rather than the page's, and both are here because a card is a
 * picture the reader cannot zoom into:
 *
 * `mute` is darker than the page's muted ink. This drawing fades some cells to 85% — the
 * ceiling row, whose figures sit in a column the age cannot buy but which are real figures all
 * the same — and the page's #5b6472 comes out of that fade at 4.26:1. At this value the faded
 * cells hold 5.1:1 and the difference at full strength is invisible.
 *
 * `accent` is the olive rather than the deck's display olive, for the same reason: a plan name
 * on a card is set small.
 */
export const CARD_PALETTE: CardPalette = {
  ground: "#ffffff",
  groundDeep: "#ffffff",
  /* the plan's name — the deck's second headline line, which is the olive one */
  accent: "#736c42",
  /* the premium — the deck answers its own question in navy, and so does this */
  figure: "#022162",
  ink: "#15181d",
  mute: "#4d5563",
  hair: "#c3c6cd",
  rule: "#7d8490",
  /* the sand wash, which is the deck's one way of saying "this is the block you came for" */
  glow: "rgba(198,188,153,0.28)",
  stripe: "rgba(2,33,98,0.035)",
  grid: "#c3c6cd",
  tint: "rgba(198,188,153,0.35)",
  /* The deck ranks its series navy, grey, sand, every time: the answer leads and the two
     supporting quantities follow it in that order. */
  line: { cash: "#022162", premium: "#7f7f7f", cover: "#c6bc99" },
};

/**
 * The palette to draw this card in.
 *
 * A function rather than the constant itself, because this used to choose by plan code and
 * could again — a plan sold under a second brand would come back through here, and every
 * caller already asks rather than reaching for a value.
 */
export function cardPaletteFor(): CardPalette {
  return CARD_PALETTE;
}

/**
 * A short fingerprint of a card's palette and drawing revision, written into every card link.
 *
 * A card is cached by its address — an hour in the browser, a day at the edge — and the
 * palette is not part of the address, so re-colouring a plan leaves every card already
 * fetched serving the old colours until its cache expires. An agent who sent a quote
 * yesterday would keep getting yesterday's palette for a day after the change went out.
 *
 * Deriving the palette part from the colours keeps it current whenever the palette changes;
 * DRAWING_REVISION is bumped when the card's contents or layout change. The route
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

/** Bump when a card gains or removes visible content without changing its palette. */
const DRAWING_REVISION = "6";

/** The fingerprint of the palette and layout this card will be drawn in. */
export function cardVersionFor(): string {
  return `${cardPaletteVersion(cardPaletteFor())}-${DRAWING_REVISION}`;
}
