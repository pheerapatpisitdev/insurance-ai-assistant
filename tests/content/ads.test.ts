import { describe, expect, it } from "vitest";
import { AD_LIMITS, ANGLE_BANK, adCopyMessages, fallbackMatrix, matrixCells, parseAdCopy, parseMatrix } from "@/lib/content/ads";

describe("parseMatrix", () => {
  it("reads the model's angles and tones", () => {
    const reply = JSON.stringify({
      angles: [{ key: "Family First", label: "ครอบครัวมาก่อน", promise: "p" }, { key: "cheap", label: "เริ่มถูก", promise: "q" }],
      tones: [{ key: "warm", label: "อบอุ่น", instruction: "i" }, { key: "direct", label: "ตรง", instruction: "j" }],
    });
    const m = parseMatrix(reply, 2, 2);
    expect(m.angles.map((a) => a.key)).toEqual(["family_first", "cheap"]);
    expect(m.tones.map((t) => t.label)).toEqual(["อบอุ่น", "ตรง"]);
  });

  it("fills a short or failed matrix from the banks, never with a repeat", () => {
    const one = parseMatrix(JSON.stringify({ angles: [{ key: "family", label: "ครอบครัว" }], tones: [] }), 3, 2);
    expect(one.angles).toHaveLength(3);
    expect(new Set(one.angles.map((a) => a.key)).size).toBe(3);
    expect(one.tones).toHaveLength(2);
    expect(parseMatrix("ขอโทษครับ", 2, 2)).toEqual(fallbackMatrix(2, 2));
  });

  it("drops an angle with no label and a duplicate key", () => {
    const reply = JSON.stringify({ angles: [{ key: "a", label: "" }, { key: "b", label: "บี" }, { key: "b", label: "บีซ้ำ" }] });
    expect(parseMatrix(reply, 1, 1).angles).toEqual([{ key: "b", label: "บี", promise: "" }]);
  });
});

describe("matrixCells", () => {
  it("is every angle in every tone, one angle to a row", () => {
    const cells = matrixCells(fallbackMatrix(3, 2));
    expect(cells).toHaveLength(6);
    expect(cells.slice(0, 2).map((c) => c.angle.key)).toEqual([ANGLE_BANK[0].key, ANGLE_BANK[0].key]);
  });
});

describe("parseAdCopy", () => {
  it("keeps a headline whole even past Facebook's 27 — a clipped figure is a false claim", () => {
    // cutting once turned "…คุ้มครองสูงสุด 2 ล้าน" into "…คุ้มครองสูงสุด 2"
    const ad = parseAdCopy(JSON.stringify({ primaryText: "ข้อความหลัก", headline: "ทุน 1 ล้าน คุ้มครองสูงสุด 2 ล้าน", description: "ทักแชทได้เลยครับ" }))!;
    expect(ad.headline).toBe("ทุน 1 ล้าน คุ้มครองสูงสุด 2 ล้าน");
    expect([...ad.headline].length).toBeGreaterThan(AD_LIMITS.headline);
  });

  it("refuses a reply with no primary text or no headline", () => {
    expect(parseAdCopy(JSON.stringify({ primaryText: "x" }))).toBeNull();
    expect(parseAdCopy(JSON.stringify({ headline: "x" }))).toBeNull();
  });
});

describe("adCopyMessages", () => {
  it("carries the rules, the fold and the cell's angle and tone", () => {
    const m = fallbackMatrix(1, 1);
    const [system, user] = adCopyMessages("brief", { angle: m.angles[0], tone: m.tones[0] });
    expect(system.content).toContain("ห้ามคำนวณ");
    expect(system.content).toContain("กฎโฆษณาของ Facebook");
    expect(system.content).toContain(`${AD_LIMITS.fold} ตัวอักษรแรก`);
    expect(user.content).toContain(ANGLE_BANK[0].label);
  });
});
