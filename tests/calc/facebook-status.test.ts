import { describe, expect, it } from "vitest";
import { classify } from "@/lib/facebook/status";

/**
 * What a Graph error code means for the back office.
 *
 * This is tested rather than reasoned about because the screen got it wrong twice in
 * production, both times in the same direction: a Page that could not answer a single
 * customer was shown as connected and working. Meta says so with code 190, which reads like
 * the permission codes around it and is not one — a missing scope hides a row on a screen,
 * 190 takes the agency's inbox off the air.
 */

describe("what Meta's error code means here", () => {
  it("calls 190 a revoked Page, the one that stops the bot answering", () => {
    expect(classify(190)).toBe("revoked");
  });

  it("does not call a missing scope revoked — those reads are optional", () => {
    for (const code of [3, 10, 100, 200, 294, 299]) {
      expect(classify(code)).toBe("permission");
    }
  });

  it("calls a rate limit what it is, so a busy minute is not read as a broken Page", () => {
    for (const code of [4, 17, 32, 613]) {
      expect(classify(code)).toBe("rate-limit");
    }
  });

  it("leaves anything unrecognised as an error worth showing", () => {
    expect(classify(1)).toBe("other");
    expect(classify(500)).toBe("other");
  });
});
