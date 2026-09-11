import { afterEach, describe, expect, it, vi } from "vitest";
import { legacyChannels } from "@/lib/legacy-channels";

const KEYS = [
  "LINE_CHANNEL_ACCESS_TOKEN", "NEXT_PUBLIC_LINE_OA_ID",
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "ADMIN_SESSION_SECRET",
] as const;

function env(values: Partial<Record<(typeof KEYS)[number], string>>) {
  for (const k of KEYS) vi.stubEnv(k, values[k] ?? "");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("legacyChannels", () => {
  it("offers no channel when nothing is set up", async () => {
    env({});
    await expect(legacyChannels()).resolves.toEqual({ lineOaId: null });
  });

  it("asks LINE for the account's own ID rather than being told it", async () => {
    env({ LINE_CHANNEL_ACCESS_TOKEN: "tok" });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ basicId: "@006crkvq", displayName: "advisortool.app" })),
    );
    const channels = await legacyChannels();
    expect(channels.lineOaId).toBe("@006crkvq");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.line.me/v2/bot/info");
  });

  /**
   * A revoked or mistyped token must cost its own button and nothing else — the page still
   * has to render for the customer standing in front of it.
   */
  it("drops the LINE button when LINE refuses the token", async () => {
    env({ LINE_CHANNEL_ACCESS_TOKEN: "stale" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("unauthorized", { status: 401 }));
    await expect(legacyChannels()).resolves.toMatchObject({ lineOaId: null });
  });

  it("survives LINE being unreachable", async () => {
    env({ LINE_CHANNEL_ACCESS_TOKEN: "tok" });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("network down"));
    await expect(legacyChannels()).resolves.toMatchObject({ lineOaId: null });
  });

  /**
   * A deployment that cannot read the account's own ID falls back to whatever was configured
   * by hand rather than losing the button.
   */
  it("falls back to the configured value when the live one cannot be read", async () => {
    env({ NEXT_PUBLIC_LINE_OA_ID: "@byhand" });
    await expect(legacyChannels()).resolves.toEqual({ lineOaId: "@byhand" });
  });
});
