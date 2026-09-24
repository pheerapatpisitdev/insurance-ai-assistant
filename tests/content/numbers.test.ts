import { describe, expect, it } from "vitest";
import { anglesFor, NUMBERS_HREFS } from "@/lib/content/prompt";

describe("anglesFor", () => {
  it("offers ตัวเลขชัดๆ only for a post on a plan that has number cases", () => {
    expect(anglesFor("post", "/lifeprotect").some((a) => a.id === "numbers")).toBe(true);
    expect(anglesFor("ad", "/lifeprotect").some((a) => a.id === "numbers")).toBe(false);
    expect(anglesFor("script", "/lifeprotect").some((a) => a.id === "numbers")).toBe(false);
    expect(anglesFor("post", "/plb").some((a) => a.id === "numbers")).toBe(false);
  });
  it("keeps every other angle everywhere", () => {
    expect(anglesFor("ad", "/plb").map((a) => a.id)).toContain("family");
  });
  it("names Life Protect in phase 1", () => {
    expect(NUMBERS_HREFS).toEqual(["/lifeprotect"]);
  });
});
