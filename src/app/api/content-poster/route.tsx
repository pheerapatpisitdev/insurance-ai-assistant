import type { NextRequest } from "next/server";
import { limiter } from "@/lib/assistant/rate-limit";
import { POSTER_THEMES, posterScrim } from "@/lib/card-theme";
import { INSURER_LINE } from "@/lib/content/output";
import { backgroundDataUri } from "@/lib/content/store";
import { decodePoster, isSizeId, SIZES, type Layout, type PosterSpec } from "@/lib/content/poster";
import { fitScale, fontSize, LINE_HEIGHT, metrics, withBreaks, type Canvas } from "@/lib/content/poster-layout";
import { renderPng } from "@/lib/content/poster-png";

export const runtime = "nodejs";

/**
 * A content piece's poster, drawn — Thai set by a real font rather than by an image model.
 *
 * The owner's Maryjane project draws its posters this way (satori and resvg) because image
 * models mangle Thai: vowels float off their consonants and tone marks land on the wrong
 * letter. The faces are the quote card's IBM Plex Sans Thai; the drawing is satori 0.33 rather
 * than next/og, for the reason poster-png.ts gives.
 *
 * Everything the poster says is in the URL, so the picture costs nothing but CPU, an <img>
 * can show it, and a link can download it. The same words are checked for figures and for
 * Facebook's rules on the page before anyone downloads anything.
 */

/** drawing is free but not nothing; a script asking a thousand times an hour is not a person */
const allow = limiter(400, 60 * 60_000);

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
      {photo && (
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
        }}
      >
        {INSURER_LINE}
      </div>
    </div>
  );
}

export async function GET(req: NextRequest) {
  const who = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!allow(`poster:${who}`)) return new Response("ขอรูปถี่เกินไป รอสักครู่นะครับ", { status: 429 });

  const q = req.nextUrl.searchParams;
  const spec = decodePoster(q.get("s") ?? "");
  if (!spec) return new Response("ข้อมูลโปสเตอร์ไม่ถูกต้อง", { status: 400 });
  const sizeId = isSizeId(q.get("size")) ? q.get("size") as keyof typeof SIZES : "square";
  const canvas = SIZES[sizeId];

  let png: Buffer;
  try {
    // a picture that has gone missing draws the plain theme rather than failing the poster
    const photo = spec.background ? await backgroundDataUri(spec.background) : null;
    png = await renderPng(<Poster spec={spec} canvas={canvas} photo={photo} />, canvas);
  } catch (e) {
    console.error("poster render failed:", e);
    return new Response("วาดรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ", { status: 500 });
  }
  return new Response(new Uint8Array(png), {
    headers: {
      "content-type": "image/png",
      // the picture is a pure function of its URL, so it can be kept as long as anyone likes
      "cache-control": "public, max-age=86400, immutable",
      ...(q.get("download") ? { "content-disposition": `attachment; filename="poster-${sizeId}.png"` } : {}),
    },
  });
}
