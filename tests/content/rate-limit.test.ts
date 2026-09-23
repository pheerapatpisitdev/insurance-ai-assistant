import { describe, expect, it } from "vitest";
import { limiter } from "@/lib/assistant/rate-limit";

describe("limiter", () => {
  it("allows `max` in a window, refuses the next, and forgets once the window has passed", () => {
    const allow = limiter(2, 1_000);
    expect(allow("a", 0)).toBe(true);
    expect(allow("a", 10)).toBe(true);
    expect(allow("a", 20)).toBe(false);
    expect(allow("b", 20)).toBe(true); // callers are counted apart
    expect(allow("a", 1_011)).toBe(true);
  });

  it("keeps each limiter's count its own", () => {
    const one = limiter(1, 1_000);
    const two = limiter(1, 1_000);
    expect(one("a", 0)).toBe(true);
    expect(two("a", 0)).toBe(true);
  });
});
