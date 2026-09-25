import { CARD_PALETTE, POSTER_THEMES, posterScrim } from "@/lib/card-theme";
import { INSURER_LINE } from "./output";
import { backgroundDataUri } from "./store";
import { SIZES, type Layout, type PosterDocument, type PosterSpec, type SizeId } from "./poster";
import { fitScale, fontSize, LINE_HEIGHT, metrics, withBreaks, type Canvas, type Metrics } from "./poster-layout";
import { renderPng } from "./poster-png";

/**
 * A content piece's poster as PNG bytes — what /api/content-poster serves, and what is
 * uploaded when a piece is posted to a Page. One drawing for both, so the picture that goes up
 * is the one the owner looked at.
 */

const JUSTIFY: Record<Layout, "flex-start" | "center" | "flex-end"> = {
  top: "flex-start",
  center: "center",
  bottom: "flex-end",
};

/**
 * The poster's lines, one under another; `marked` draws the sub line on the highlighter.
 * Called as a function, not used as a component: satori takes an array of children, but not
 * one returned by a component, and lays a fragment out as a row of its own.
 */
function lines(spec: PosterSpec, m: Metrics, scale: number, marked = false) {
  const c = POSTER_THEMES[spec.theme];
  const ink = { badge: c.badgeInk, headline: c.headline, sub: c.sub, footer: c.footer } as const;
  return spec.blocks.map((b, i) => {
    const size = fontSize(b.kind, m, scale);
    const pill = b.kind === "badge" || (marked && b.kind === "sub");
    return (
      <div
        key={i}
        style={{
          // no display:flex on a line of text: a flex item cannot shrink below its
          // min-content, and a Thai sentence has no spaces, so it overflows to the right
          maxWidth: "100%",
          marginTop: i === 0 ? 0 : m.gap,
          fontSize: size,
          lineHeight: LINE_HEIGHT,
          fontWeight: b.kind === "headline" || (marked && b.kind === "sub") ? 600 : 400,
          color: marked && b.kind === "sub" ? CARD_PALETTE.ink : ink[b.kind],
          ...(c.textShadow && !pill ? { textShadow: c.textShadow } : {}),
          ...(pill
            ? {
                alignSelf: "flex-start",
                backgroundColor: b.kind === "badge" ? c.badgeBg : CARD_PALETTE.highlighter,
                borderRadius: b.kind === "badge" ? 999 : Math.round(size * 0.18),
                padding: `${Math.round(size * 0.3)}px ${Math.round(size * (b.kind === "badge" ? 0.8 : 0.45))}px`,
              }
            : {}),
        }}
      >
        {withBreaks(b.text)}
      </div>
    );
  });
}

/** who insures it, small in the bottom margin, so a reshared picture still says */
function InsurerLine({ spec, canvas, m }: { spec: PosterSpec; canvas: Canvas; m: Metrics }) {
  const c = POSTER_THEMES[spec.theme];
  return (
    <div
      style={{
        position: "absolute",
        left: m.padX,
        // a story's bottom is under the reply bar, so the line sits higher there
        bottom: canvas.height / canvas.width > 1.5 ? Math.round(m.padBottom * 0.55) : Math.round(m.padX * 0.33),
        fontSize: Math.round(19 * m.k),
        lineHeight: 1.3,
        color: c.footer,
        opacity: 0.85,
        ...(c.textShadow ? { textShadow: c.textShadow } : {}),
      }}
    >
      {INSURER_LINE}
    </div>
  );
}

function Poster({ spec, canvas, photo }: { spec: PosterSpec; canvas: Canvas; photo: string | null }) {
  const c = POSTER_THEMES[spec.theme];
  // a square photograph drawn as "cover": a square as wide as the canvas's longer side, centred,
  // so 4:5 and 9:16 crop it rather than stretch it (Maryjane's coverSide)
  const cover = Math.max(canvas.width, canvas.height);
  const m = metrics(canvas);
  const scale = fitScale(spec, canvas);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: JUSTIFY[spec.layout],
        padding: `${m.padTop}px ${m.padX}px ${m.padBottom}px`,
        backgroundImage: photo ? `url(${photo})` : `linear-gradient(160deg, ${c.from}, ${c.to})`,
        ...(photo ? { backgroundSize: `${cover}px ${cover}px`, backgroundPosition: "center" } : {}),
        fontFamily: "Plex",
        position: "relative",
      }}
    >
      {photo && c.scrim !== null && (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", backgroundImage: posterScrim(spec.theme, spec.layout) }} />
      )}
      {lines(spec, m, scale)}
      <InsurerLine spec={spec} canvas={canvas} m={m} />
    </div>
  );
}

/** the words' share of a claim poster's height; the paper takes the rest */
const WORDS_SHARE = 0.44;

/**
 * รีวิวเคลม: the words at the top, the owner's blacked-out paper below them as a white card
 * tilted a little, and the amount paid on the highlighter. Themes and sizes as any poster.
 */
function DocumentPoster({ spec, canvas, paper, doc }: { spec: PosterSpec; canvas: Canvas; paper: string; doc: PosterDocument }) {
  const c = POSTER_THEMES[spec.theme];
  const m = metrics(canvas);
  const room = canvas.height - m.padTop - m.padBottom;
  const wordsH = Math.round(room * WORDS_SHARE);
  // the words fitted to their share alone: a canvas whose usable height is that share
  const scale = fitScale(spec, { width: canvas.width, height: wordsH + 2 * m.padX });
  const frame = Math.round(14 * m.k);
  const areaW = m.usableWidth * 0.9;
  const areaH = room - wordsH - m.gap * 2 - frame * 2;
  const w = Math.max(1, Math.round(Math.min(areaW, areaH * doc.ratio)));
  const h = Math.max(1, Math.round(w / doc.ratio));

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: `${m.padTop}px ${m.padX}px ${m.padBottom}px`,
        backgroundImage: `linear-gradient(160deg, ${c.from}, ${c.to})`,
        fontFamily: "Plex",
        position: "relative",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", height: wordsH }}>
        {lines(spec, m, scale, true)}
      </div>
      <div style={{ display: "flex", flexGrow: 1, alignItems: "center", justifyContent: "center", marginTop: m.gap }}>
        <div
          style={{
            display: "flex",
            padding: frame,
            backgroundColor: CARD_PALETTE.ground,
            borderRadius: Math.round(10 * m.k),
            boxShadow: "0 18px 40px rgba(0, 0, 0, 0.35)",
            transform: "rotate(-2.5deg)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- drawn by satori, not a page */}
          <img src={paper} width={w} height={h} style={{ width: w, height: h }} alt="" />
        </div>
      </div>
      <InsurerLine spec={spec} canvas={canvas} m={m} />
    </div>
  );
}

/** The poster drawn at a size; a background that has gone missing draws the plain theme. */
export async function drawPoster(spec: PosterSpec, size: SizeId = "square"): Promise<Buffer> {
  const canvas = SIZES[size];
  // a paper gone missing draws the plain poster, as a missing background does
  const paper = spec.document ? await backgroundDataUri(spec.document.path) : null;
  if (spec.document && paper) return renderPng(<DocumentPoster spec={spec} canvas={canvas} paper={paper} doc={spec.document} />, canvas);
  const photo = spec.background ? await backgroundDataUri(spec.background) : null;
  return renderPng(<Poster spec={spec} canvas={canvas} photo={photo} />, canvas);
}
