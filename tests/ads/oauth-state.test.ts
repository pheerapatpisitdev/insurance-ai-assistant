import { beforeAll, describe, expect, it } from "vitest";

/**
 * One login screen, two reasons to go through it. The reason rides in the signed state, so
 * the callback knows which store to write to without a second route Meta would have to be
 * told about.
 */

beforeAll(() => {
  process.env.ADMIN_SESSION_SECRET = "test-secret";
  process.env.FB_APP_ID = "1";
  process.env.FB_APP_SECRET = "s";
});

describe("the purpose in the state", () => {
  it("defaults to the Pages, as it always did", async () => {
    const { makeState, statePurpose, stateIsValid } = await import("@/lib/facebook/oauth");
    const s = makeState();
    expect(stateIsValid(s)).toBe(true);
    expect(statePurpose(s)).toBe("pages");
  });

  it("carries ads, signed", async () => {
    const { makeState, statePurpose, stateIsValid } = await import("@/lib/facebook/oauth");
    const s = makeState("ads");
    expect(stateIsValid(s)).toBe(true);
    expect(statePurpose(s)).toBe("ads");
    // change the purpose without re-signing and the state is dead
    const forged = s.replace(".ads.", ".pages.");
    expect(stateIsValid(forged)).toBe(false);
    expect(statePurpose(forged)).toBeUndefined();
  });

  it("asks Meta for ads_read when the purpose is ads", async () => {
    delete process.env.FB_LOGIN_CONFIG_ID;
    const { authorizeUrl, makeState } = await import("@/lib/facebook/oauth");
    const pages = new URL(authorizeUrl("https://x.test", makeState()));
    const ads = new URL(authorizeUrl("https://x.test", makeState("ads"), "ads"));
    expect(pages.searchParams.get("scope")).toBe("pages_show_list,pages_messaging,pages_manage_metadata");
    expect(ads.searchParams.get("scope")).toBe("ads_read");
  });
});
