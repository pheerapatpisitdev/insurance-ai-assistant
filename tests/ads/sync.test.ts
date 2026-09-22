import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The sync talks to two things it does not own — Meta and the database — so both are stood
 * in for here, and what is checked is the shape of what it sends each of them.
 */

const upserts: unknown[][] = [];
const accounts = [
  { id: "act_1", name: "หนึ่ง", currency: "THB", connectedAt: "2026-09-22T00:00:00Z" },
  { id: "act_2", name: "สอง", currency: "THB", connectedAt: "2026-09-22T00:00:00Z" },
];
const tokens: Record<string, string | null> = { act_1: "tok1", act_2: "tok2" };

vi.mock("@/lib/facebook/ads-connection", () => ({
  adAccounts: async () => accounts,
  adAccountToken: async (id: string) => tokens[id] ?? null,
}));

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      upsert: async (rows: unknown[], opts: { onConflict: string }) => {
        expect(table).toBe("ins_ad_daily");
        expect(opts.onConflict).toBe("date,ad_id");
        upserts.push(rows);
        return { error: null };
      },
    }),
  }),
}));

type Reply = { status: number; body: unknown };
function fetchOf(replies: Record<string, Reply>): typeof fetch {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    const key = Object.keys(replies).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected fetch ${url}`);
    const r = replies[key];
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
}

const insight = (ad: string, date: string) => ({
  date_start: date, date_stop: date, ad_id: ad, ad_name: `ad ${ad}`, spend: "10", account_currency: "THB",
});

const { syncAds } = await import("@/lib/ads/sync");
const NOW = new Date("2026-09-22T03:00:00.000Z");

beforeEach(() => { upserts.length = 0; });

describe("syncing the ad figures", () => {
  it("asks for the last three days at ad level, follows the pages, and writes every row", async () => {
    const seen: string[] = [];
    const fetchFn: typeof fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      seen.push(url);
      if (url.includes("act_1/insights") && !url.includes("after=")) {
        return Response.json({ data: [insight("a", "2026-09-20")], paging: { next: "https://graph.facebook.com/v23.0/act_1/insights?after=cursor" } });
      }
      if (url.includes("after=cursor")) return Response.json({ data: [insight("a", "2026-09-21")] });
      if (url.includes("act_2/insights")) return Response.json({ data: [insight("b", "2026-09-21")] });
      throw new Error(`unexpected fetch ${url}`);
    }) as typeof fetch;

    const result = await syncAds({ days: 3, now: NOW, fetchFn });

    const first = new URL(seen[0]);
    expect(first.pathname).toBe("/v23.0/act_1/insights");
    expect(first.searchParams.get("level")).toBe("ad");
    expect(first.searchParams.get("time_increment")).toBe("1");
    expect(JSON.parse(first.searchParams.get("time_range")!)).toEqual({ since: "2026-09-20", until: "2026-09-22" });
    expect(first.searchParams.get("fields")).toContain("inline_link_clicks");
    expect(first.searchParams.get("access_token")).toBeNull();

    expect(result).toEqual({ accounts: 2, rows: 3, errors: [] });
    const written = upserts.flat() as { ad_id: string; date: string }[];
    expect(written.map((r) => `${r.ad_id}@${r.date}`)).toEqual(["a@2026-09-20", "a@2026-09-21", "b@2026-09-21"]);
  });

  it("lets one account fail without stopping the other", async () => {
    const fetchFn = fetchOf({
      "act_1/insights": { status: 400, body: { error: { code: 190, message: "Error validating access token" } } },
      "act_2/insights": { status: 200, body: { data: [insight("b", "2026-09-21")] } },
    });
    const result = await syncAds({ days: 3, now: NOW, fetchFn });
    expect(result.rows).toBe(1);
    expect(result.errors).toEqual([{ actId: "act_1", name: "หนึ่ง", message: "token หมดอายุ กดเชื่อมบัญชีโฆษณาใหม่" }]);
  });

  it("reports an account with no token instead of asking Meta with nothing", async () => {
    tokens.act_2 = null;
    const fetchFn = fetchOf({ "act_1/insights": { status: 200, body: { data: [] } } });
    const result = await syncAds({ days: 3, now: NOW, fetchFn });
    expect(result.errors.map((e) => e.actId)).toEqual(["act_2"]);
    tokens.act_2 = "tok2";
  });

  it("does nothing, quietly, with no account connected", async () => {
    accounts.length = 0;
    const result = await syncAds({ days: 3, now: NOW, fetchFn: fetchOf({}) });
    expect(result).toEqual({ accounts: 0, rows: 0, errors: [] });
  });
});
