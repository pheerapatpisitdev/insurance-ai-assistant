import { describe, expect, it } from "vitest";
import { contentBaht } from "@/lib/content/store";

describe("contentBaht", () => {
  it("counts only what the content tasks cost, so the cap cannot be spent by the bot", () => {
    expect(contentBaht([
      { model: "claude-sonnet-5", task: "content", calls: 3, baht: 2.5 },
      { model: "gemini-3.1-flash-lite", task: "content-proofread", calls: 3, baht: 0.1 },
      { model: "gemini-3.1-flash-lite", task: "route", calls: 700, baht: 8 },
      { model: null, task: null, calls: 1, baht: 1 },
    ])).toBeCloseTo(2.6);
  });
});
