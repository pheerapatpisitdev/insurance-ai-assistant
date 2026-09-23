import type { ReactNode } from "react";
import { highlighterUri } from "@/lib/highlighter";

/**
 * A figure with a yellow highlighter stroke behind it — the page's half of what the quote card
 * draws with `mark`. The stroke is the shared shape used as a mask over the palette's token,
 * so the colour stays in globals.css. The ink is navy whatever the surrounding text is, since
 * a light figure on yellow is unreadable.
 */
export function Highlighted({ children }: { children: ReactNode }) {
  const mask = highlighterUri("black");
  return (
    <span className="relative isolate inline-block px-1 text-[var(--bot-navy)]">
      <span
        aria-hidden
        className="absolute -inset-x-1.5 -inset-y-0.5 -z-10 bg-[var(--bot-highlighter)]"
        style={{
          maskImage: mask, WebkitMaskImage: mask,
          maskSize: "100% 100%", WebkitMaskSize: "100% 100%",
          maskRepeat: "no-repeat", WebkitMaskRepeat: "no-repeat",
        }}
      />
      {children}
    </span>
  );
}
