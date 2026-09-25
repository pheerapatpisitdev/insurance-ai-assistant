import { describe, expect, it, vi } from "vitest";

// a white 1×1 PNG stands in for the blacked-out paper in storage
const PIXEL = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==";
const stored = vi.fn(async (_path: string): Promise<string | null> => PIXEL);
vi.mock("@/lib/content/store", () => ({ backgroundDataUri: (p: string) => stored(p) }));

const { drawPoster } = await import("@/lib/content/poster-draw");
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
