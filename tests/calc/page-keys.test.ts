import { describe, expect, it } from "vitest";
import { LEGACY_KEY, keyFor, pageIdInKey } from "@/lib/facebook/keys";

/**
 * Which row in the channel table belongs to which Page.
 *
 * Until now there was one row, under the key "facebook", and every part of the system that
 * wanted a token asked for that one. Connecting a second Page would have written over the
 * first without a word — the agency's live inbox, replaced by whichever Page was picked next,
 * with nothing on screen to say it had happened.
 *
 * The keys are pure string work and they are tested here rather than reasoned about, because
 * the failure they guard is silent: a wrong key does not throw, it reads as "no Page is
 * connected" and the bot simply stops answering.
 */

describe("the key a Page's row is kept under", () => {
  it("carries the Page's own id, so two Pages cannot collide", () => {
    expect(keyFor("111")).not.toBe(keyFor("222"));
    expect(keyFor("111")).toContain("111");
  });

  it("is read back to the same id", () => {
    expect(pageIdInKey(keyFor("1234567890"))).toBe("1234567890");
  });

  /**
   * The row that is live right now sits under the bare "facebook" key, written before any of
   * this existed. It has to keep working: the bot is answering a real Page from it today, and
   * a deploy that stopped recognising it would take the agency's inbox down until somebody
   * noticed and reconnected.
   */
  it("still recognises the single row written before Pages were told apart", () => {
    expect(LEGACY_KEY).toBe("facebook");
    expect(pageIdInKey(LEGACY_KEY)).toBeUndefined();
  });

  it("does not mistake the pending-login row for a Page", () => {
    expect(pageIdInKey("facebook_pending")).toBeUndefined();
  });

  it("is stable, because a key that changes shape orphans every row written under the old one", () => {
    expect(keyFor("987")).toBe("facebook:987");
  });
});
