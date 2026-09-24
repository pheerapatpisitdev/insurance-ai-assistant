import { POSTER_THEMES, posterScrim } from "@/lib/card-theme";
import { INSURER_LINE } from "./output";
import { backgroundDataUri } from "./store";
import { SIZES, type Layout, type PosterSpec, type SizeId } from "./poster";
import { fitScale, fontSize, LINE_HEIGHT, metrics, withBreaks, type Canvas } from "./poster-layout";
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

function Poster({ spec, canvas, photo }: { spec: PosterSpec; canvas: Canvas; photo: string | null }) {
  const c = POSTER_THEMES[spec.theme];
  // a square photograph drawn as "cover": a square as wide as the canvas's longer side, centred,
  // so 4:5 and 9:16 crop it rather than stretch it (Maryjane's coverSide)
  const cover = Math.max(canvas.width, canvas.height);
  const m = metrics(canvas);
  const scale = fitScale(spec, canvas);
  const ink = { badge: c.badgeInk, headline: c.headline, sub: c.sub, footer: c.footer } as const;

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
      {spec.blocks.map((b, i) => {
        const size = fontSize(b.kind, m, scale);
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
              fontWeight: b.kind === "headline" ? 600 : 400,
              color: ink[b.kind],
              ...(c.textShadow && b.kind !== "badge" ? { textShadow: c.textShadow } : {}),
              ...(b.kind === "badge"
                ? {
                    alignSelf: "flex-start",
                    backgroundColor: c.badgeBg,
                    borderRadius: 999,
                    padding: `${Math.round(size * 0.3)}px ${Math.round(size * 0.8)}px`,
                  }
                : {}),
            }}
          >
            {withBreaks(b.text)}
          </div>
        );
      })}
      {/* who insures it, small in the bottom margin, so a reshared picture still says */}
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
    </div>
  );
}

/** The poster drawn at a size; a background that has gone missing draws the plain theme. */
export async function drawPoster(spec: PosterSpec, size: SizeId = "square"): Promise<Buffer> {
  const canvas = SIZES[size];
  const photo = spec.background ? await backgroundDataUri(spec.background) : null;
  return renderPng(<Poster spec={spec} canvas={canvas} photo={photo} />, canvas);
}
