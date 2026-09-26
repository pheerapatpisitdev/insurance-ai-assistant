import { describe, expect, it, vi } from "vitest";

// a white 1×1 PNG stands in for the blacked-out paper in storage
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const stored = vi.fn(async (_path: string): Promise<string | null> => PIXEL);
vi.mock("@/lib/content/store", () => ({ backgroundDataUri: (p: string) => stored(p) }));

const { drawPoster, paperGrid } = await import("@/lib/content/poster-draw");
const { claimPoster, cleanFacts } = await import("@/lib/content/claim");

const PATH = "0b7d3f4e-1c2a-4b5d-8e9f-0a1b2c3d4e5f/9a8b7c6d-5e4f-4a3b-2c1d-0e9f8a7b6c5d.jpg";
const size = (png: Buffer) => ({ width: png.readUInt32BE(16), height: png.readUInt32BE(20) });

describe("a รีวิวเคลม poster, drawn for real", () => {
  const facts = cleanFacts({ kind: "ipd", illness: "ไข้เลือดออก", paid: "48,250" });
  const spec = { ...claimPoster({ headline: "นอนโรงพยาบาล 3 คืน ไม่ต้องสำรองจ่าย" }, facts, "hook"), documents: [{ path: PATH, ratio: 0.72 }] };

  it("draws the paper at every size", async () => {
    for (const [id, want] of [["square", { width: 1080, height: 1080 }], ["portrait", { width: 1080, height: 1350 }], ["story", { width: 1080, height: 1920 }]] as const) {
      const png = await drawPoster(spec, id);
      expect(png.subarray(1, 4).toString()).toBe("PNG");
      expect(size(png)).toEqual(want);
    }
    expect(stored).toHaveBeenCalledWith(PATH);
  }, 60_000);

  it("draws a pile of three, portrait or landscape, over a photograph", async () => {
    const portrait = { ...spec, background: PATH, documents: [0.72, 0.7, 0.8].map((ratio) => ({ path: PATH, ratio })) };
    const landscape = { ...spec, documents: [4.5, 3, 2].map((ratio) => ({ path: PATH, ratio })) };
    for (const s of [portrait, landscape]) expect(size(await drawPoster(s, "portrait"))).toEqual({ width: 1080, height: 1350 });
  }, 60_000);

  it("draws the plain poster when the paper has gone from storage", async () => {
    stored.mockResolvedValueOnce(null);
    const png = await drawPoster(spec, "square");
    expect(size(png)).toEqual({ width: 1080, height: 1080 });
  }, 30_000);
});

describe("the papers on a claim poster (owner, 2026-09-26: too small, one over another)", () => {
  const overlap = (a: { left: number; top: number; w: number; h: number }, b: typeof a, frame: number) =>
    a.left < b.left + b.w + 2 * frame && b.left < a.left + a.w + 2 * frame && a.top < b.top + b.h + 2 * frame && b.top < a.top + a.h + 2 * frame;

  it("never lays one paper over another, and keeps every card inside the area", () => {
    for (const ratios of [[1.45, 1.45], [0.72, 0.7, 0.8], [4.5, 3, 2], [0.72, 4.5], [1]]) {
      for (const [w, h] of [[936, 420], [936, 640], [936, 1100]]) {
        const boxes = paperGrid(ratios, w, h, 24, 14);
        expect(boxes).toHaveLength(ratios.length);
        boxes.forEach((a, i) => {
          expect(a.left).toBeGreaterThanOrEqual(0);
          expect(a.top).toBeGreaterThanOrEqual(0);
          expect(a.left + a.w + 28).toBeLessThanOrEqual(w + 1);
          expect(a.top + a.h + 28).toBeLessThanOrEqual(h + 1);
          boxes.slice(i + 1).forEach((b) => expect(overlap(a, b, 14)).toBe(false));
        });
      }
    }
  });

  it("puts two landscape papers side by side on a square, each wider than the old pile's", () => {
    const [a, b] = paperGrid([1.45, 1.45], 936, 420, 24, 14);
    expect(a.top).toBe(b.top);
    expect(a.w).toBeGreaterThan(380);
  });

  it("stacks long claims-table screenshots one above the next", () => {
    const [a, b] = paperGrid([4.5, 4.5], 936, 640, 24, 14);
    expect(a.left).toBe(b.left);
    expect(b.top).toBeGreaterThan(a.top + a.h);
  });
});
