import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactNode } from "react";
import satori from "satori";
import { Resvg, initWasm } from "@resvg/resvg-wasm";

/**
 * Draws a poster element to PNG with satori 0.33 and resvg — not with next/og.
 *
 * next/og was tried first and drew Thai wrongly: a tone mark over an upper vowel vanished or
 * sat inside it, so "เรื่อง" read "เรือง" and "ที่" read "ที". Stacking those marks is the font's
 * job and needs a shaping engine; the satori bundled inside next/og has none, while satori 0.33
 * shapes with HarfBuzz, which is why the owner's Maryjane project draws its posters this way.
 * Rendered side by side on 2026-09-23 with the same IBM Plex Sans Thai faces, 0.33 set every
 * mark correctly.
 *
 * The wasm handling is Maryjane's (src/lib/poster-png.ts), with its reasons kept:
 * - the wasm is read from a path built at runtime from process.cwd(), because a literal
 *   ".wasm" import or require.resolve is rewritten by the bundler and breaks in production;
 * - next.config.ts lists both packages as external and traces their .wasm files, or the
 *   deployed function fails with ENOENT on hb.wasm while working on a laptop;
 * - a failed load is forgotten rather than cached, and "Already initialized" (a dev reload
 *   re-running this module while the package keeps its own flag) counts as ready.
 */

const FONT_DIR = join(process.cwd(), "src/app/api/card");

let fonts: Promise<{ regular: Buffer; semibold: Buffer }> | null = null;
function loadFonts() {
  fonts ??= Promise.all([
    readFile(join(FONT_DIR, "IBMPlexSansThai-Regular.ttf")),
    readFile(join(FONT_DIR, "IBMPlexSansThai-SemiBold.ttf")),
  ]).then(([regular, semibold]) => ({ regular, semibold })).catch((e) => {
    fonts = null;
    throw e;
  });
  return fonts;
}

export function isAlreadyInitialized(e: unknown): boolean {
  return e instanceof Error && e.message.includes("Already initialized");
}

let wasm: Promise<void> | null = null;
function ensureWasm(): Promise<void> {
  const dir = join(process.cwd(), "node_modules", "@resvg", "resvg-wasm");
  wasm ??= initWasm(readFileSync(join(dir, "index_bg.wasm"))).catch((e) => {
    if (isAlreadyInitialized(e)) return;
    wasm = null;
    throw e;
  });
  return wasm;
}

export async function renderPng(element: ReactNode, size: { width: number; height: number }): Promise<Buffer> {
  const [f] = await Promise.all([loadFonts(), ensureWasm()]);
  const svg = await satori(element, {
    width: size.width,
    height: size.height,
    fonts: [
      { name: "Plex", data: f.regular, weight: 400, style: "normal" },
      { name: "Plex", data: f.semibold, weight: 600, style: "normal" },
    ],
  });
  return Buffer.from(new Resvg(svg, { fitTo: { mode: "width", value: size.width } }).render().asPng());
}
