import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The route is reachable from the internet and runs the sync, so it is the one place a
 * stranger could make this app spend its Meta rate limit. The bearer Vercel sends its cron
 * requests with is the whole gate.
 */

const calls: unknown[] = [];
vi.mock("@/lib/ads/sync", () => ({
  syncAds: async (opts: unknown) => { calls.push(opts); return { accounts: 1, rows: 2, errors: [] }; },
}));

const { GET } = await import("@/app/api/facebook/ads/sync/route");
const req = (auth?: string) => new Request("https://x.test/api/facebook/ads/sync", { headers: auth ? { authorization: auth } : {} });

afterEach(() => { calls.length = 0; delete process.env.CRON_SECRET; });

describe("the sync route", () => {
  it("refuses everyone when no secret is set", async () => {
    const res = await GET(req("Bearer anything"));
    expect(res.status).toBe(503);
    expect(calls).toHaveLength(0);
  });

  it("refuses the wrong bearer", async () => {
    process.env.CRON_SECRET = "s3";
    const res = await GET(req("Bearer nope"));
    expect(res.status).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("runs the sync for the right one and says what it did", async () => {
    process.env.CRON_SECRET = "s3";
    const res = await GET(req("Bearer s3"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ accounts: 1, rows: 2, errors: [] });
    expect(calls).toHaveLength(1);
  });
});
