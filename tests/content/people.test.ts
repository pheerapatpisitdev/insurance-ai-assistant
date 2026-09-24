import { describe, expect, it } from "vitest";
import { backgroundPrompt } from "@/lib/content/background";
import { MAX_PHOTOS, POSES, poseText } from "@/lib/content/people";

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
  it("keeps to what Gemini takes as character references", () => {
    expect(MAX_PHOTOS).toBe(4);
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
  it("says nothing of a person when there is none", () => {
    const p = backgroundPrompt(base);
    expect(p).not.toContain("reference photos");
    expect(p).not.toMatch(/doctor/i);
  });
});
