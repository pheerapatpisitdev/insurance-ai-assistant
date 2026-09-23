import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { initWasm } from "@resvg/resvg-wasm";
import { isAlreadyInitialized, renderPng } from "@/lib/content/poster-png";

/**
 * The poster renderer run for real: fonts read, wasm started, a PNG out. Its failures are the
 * quiet kind — a missing .wasm, a moved font — and would otherwise first show up as a broken
 * picture on the page.
 */

const size = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

describe("renderPng", () => {
  it("draws a Thai headline to a PNG of the size asked for", async () => {
    const el = {
      type: "div",
      props: {
        style: { width: "100%", height: "100%", display: "flex", background: "#000", color: "#fff", fontFamily: "Plex", fontSize: 80 },
        children: "เรื่องที่ควรรู้ก่อนซื้อ",
      },
    };
    const png = await renderPng(el as never, { width: 1080, height: 1350 });
    expect(png.subarray(1, 4).toString()).toBe("PNG");
    expect(size(png)).toEqual({ width: 1080, height: 1350 });
  }, 30_000);

  it("recognises the package's own words for a second start, which counts as ready", async () => {
    await renderPng({ type: "div", props: { style: { display: "flex" }, children: "x" } } as never, { width: 10, height: 10 });
    const wasm = readFileSync(join(process.cwd(), "node_modules/@resvg/resvg-wasm/index_bg.wasm"));
    const e = await initWasm(wasm).then(() => null, (err) => err);
    // the day resvg rewords this, the test fails before a reloaded dev server does
    expect(isAlreadyInitialized(e)).toBe(true);
  }, 30_000);
});
