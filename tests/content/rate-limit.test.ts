import { describe, expect, it } from "vitest";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";

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

describe("clientIp", () => {
  const h = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null });
  it("takes the platform's x-real-ip over anything the caller wrote", () => {
    expect(clientIp(h({ "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1, 9.9.9.9" }))).toBe("9.9.9.9");
  });
  it("falls back to the first x-forwarded-for entry, then to unknown", () => {
    expect(clientIp(h({ "x-forwarded-for": " 2.2.2.2 , 3.3.3.3" }))).toBe("2.2.2.2");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
