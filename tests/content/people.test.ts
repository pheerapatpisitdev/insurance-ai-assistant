import { describe, expect, it } from "vitest";
import { backgroundPrompt } from "@/lib/content/background";
import { MAX_PHOTOS, MAX_REFERENCES, pickReferences, POSES, poseText } from "@/lib/content/people";

describe("poses", () => {
  it("offers ให้ AI เลือก first, then five poses, each said in Thai and English", () => {
    expect(POSES[0].id).toBe("auto");
    expect(POSES).toHaveLength(6);
    for (const p of POSES) {
      expect(p.label).toMatch(/[ก-๙]/);
      expect(p.en).toMatch(/[a-z]/);
    }
  });
  it("reads an unknown pose as ให้ AI เลือก", () => {
    expect(poseText("nonsense")).toBe(poseText("auto"));
    expect(poseText("auto")).toMatch(/choose/i);
  });
  it("keeps ten in the library, and sends Gemini the four it takes as character references", () => {
    expect(MAX_PHOTOS).toBe(10);
    expect(MAX_REFERENCES).toBe(4);
  });
  it("draws from the first photo always, and three others picked at random", () => {
    const ten = Array.from({ length: 10 }, (_, i) => i);
    for (const r of [0, 0.5, 0.99]) {
      const got = pickReferences(ten, () => r);
      expect(got).toHaveLength(4);
      expect(got[0]).toBe(0);
      expect(new Set(got).size).toBe(4);
    }
    expect(pickReferences([7, 8, 9])).toEqual([7, 8, 9]);
  });
});

describe("a person in the picture", () => {
  const base = { scene: "a family at home", layout: "bottom" as const, theme: "navy" as const };
  it("asks for the reference person, the pose, and the side away from the words", () => {
    const p = backgroundPrompt({ ...base, person: { pose: "arms" } });
    expect(p).toContain("reference photos");
    expect(p).toContain(POSES.find((x) => x.id === "arms")!.en);
    expect(p).toMatch(/never .*doctor/i);
    expect(p).toMatch(/upper half/i);
  });
  it("puts the person below words that sit at the top", () => {
    expect(backgroundPrompt({ ...base, layout: "top", person: { pose: "auto" } })).toMatch(/lower half/i);
  });
  it("stands the person right of a claim poster's papers", () => {
    const p = backgroundPrompt({ ...base, layout: "top", person: { pose: "auto", aside: true } });
    expect(p).toMatch(/right third/i);
    expect(p).not.toMatch(/lower half of the frame, clear/i);
  });
  it("says nothing of a person when there is none", () => {
    const p = backgroundPrompt(base);
    expect(p).not.toContain("reference photos");
    expect(p).not.toMatch(/doctor/i);
  });
});
