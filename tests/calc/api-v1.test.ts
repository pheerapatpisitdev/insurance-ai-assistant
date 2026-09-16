import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The public API, and the three things it must never do.
 *
 * It must not answer without a key. It must not hand back a figure without the table it came
 * from and the sentence that has to be said beside it. And it must not answer a refusal with
 * a number — an arrangement the company will not write has to arrive as a refusal, because a
 * caller reading zero as a price is how somebody ends up advertising free insurance, and a
 * model reading it is worse: it will present the refusal as a bargain.
 */

/** what the database says about the key on this request */
let keyRow: { ok: boolean; reason?: string; client_name?: string; remaining?: number | null } = {
  ok: true, client_name: "ทดสอบ", remaining: 99,
};
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ rpc: async () => ({ data: [keyRow], error: null }) }),
}));

const { POST } = await import("@/app/api/v1/quote/route");
const { GET } = await import("@/app/api/v1/plans/route");
const { DISCLAIMER } = await import("@/lib/api/respond");

const KEY = "sk_ins_whatever";
const ask = (body: unknown, key: string | null = KEY) =>
  POST(new Request("https://x/api/v1/quote", {
    method: "POST",
    headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
    body: JSON.stringify(body),
  }));
const plans = (key: string | null = KEY) =>
  GET(new Request("https://x/api/v1/plans", { headers: key ? { authorization: `Bearer ${key}` } : {} }));

const QUOTE = { plan: "PLB", variant: "PLB10", age: 35, sex: "M", sumAssured: 1_000_000 };

beforeEach(() => { keyRow = { ok: true, client_name: "ทดสอบ", remaining: 99 }; });

describe("the key on the request", () => {
  it("is required, and says which way it failed", async () => {
    expect((await ask(QUOTE, null)).status).toBe(401);
    expect((await plans(null)).status).toBe(401);

    keyRow = { ok: false, reason: "unknown_key" };
    expect((await ask(QUOTE)).status).toBe(401);

    keyRow = { ok: false, reason: "disabled", client_name: "เก่า" };
    expect((await ask(QUOTE)).status).toBe(403);

    // a month used up is a decision somebody here made, and reads differently from a bad key
    keyRow = { ok: false, reason: "quota_exhausted", client_name: "ทดสอบ" };
    expect((await ask(QUOTE)).status).toBe(429);
  });

  it("is told what is left of its month, without having to read the body", async () => {
    const r = await ask(QUOTE);
    expect(r.headers.get("x-quota-remaining")).toBe("99");
    // and a key with no limit is told nothing rather than a misleading number
    keyRow = { ok: true, client_name: "เรา", remaining: null };
    expect((await ask(QUOTE)).headers.get("x-quota-remaining")).toBeNull();
  });
});

describe("a premium", () => {
  it("is the figure the sales page would print, in whole baht", async () => {
    const { quote } = await import("@/calc/quote");
    const engine = quote({ planCode: "PLB", variant: "PLB10", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: [] });

    const body = await (await ask(QUOTE)).json();
    expect(body.premium.annual).toBe(Math.round(engine.totalAnnual / 100));
    expect(body.sumAssured).toBe(1_000_000);
    expect(body.plan).toMatchObject({ code: "PLB", variant: "PLB10" });
  });

  it("never travels without the table it came from, or the sentence beside it", async () => {
    const body = await (await ask(QUOTE)).json();
    expect(body.version).toBeTruthy();
    expect(body.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.expired).toBe(false);
    expect(body.disclaimer).toBe(DISCLAIMER);
    // the one instruction that matters to a model reading this
    expect(body.disclaimer).toContain("ห้ามดัดแปลง ปัดเศษ หรือคำนวณต่อ");
  });

  it("marks an instalment the company will not accept, rather than hiding it", async () => {
    const body = await (await ask(QUOTE)).json();
    const monthly = body.premium.byMode.find((m: { mode: string }) => m.mode === "monthly");
    // a million of PLB comes to 462 a month, under the floor
    expect(monthly.belowMinimum).toBe(true);
  });

  it("carries the pictures, and only the ones that can be drawn", async () => {
    const plb = await (await ask(QUOTE)).json();
    expect(plb.images.quote).toMatch(/^https?:\/\/\S+\/api\/card\?/);
    // PLB has no surrender schedule, so there is no value table to offer
    expect(plb.images.valueTable).toBeUndefined();

    const lt = await (await ask({ plan: "LIFETREASURE", variant: "H99F06A", age: 40, sex: "M", sumAssured: 10_000_000 })).json();
    expect(lt.images.valueTable).toContain("/api/card/table?");
  });
});

describe("an arrangement the company will not write", () => {
  it("is a refusal with the reason, never a zero", async () => {
    for (const [body, reason] of [
      [{ ...QUOTE, age: 70 }, "อายุรับประกัน"],
      [{ plan: "LIFETREASURE", variant: "H99F06A", age: 40, sex: "M", sumAssured: 1_000_000 }, "ขั้นต่ำ"],
    ] as const) {
      const r = await ask(body);
      expect(r.status).toBe(422);
      const out = await r.json();
      expect(out.error).toBe("not_issuable");
      expect(out.reasons.join(" ")).toContain(reason);
      expect(JSON.stringify(out)).not.toMatch(/"premium"/);
    }
  });

  it("is told apart from a request that could not be read at all", async () => {
    // a plan with several packages and none named is the caller's mistake, not the company's
    const r = await ask({ plan: "PLB", age: 35, sex: "M", sumAssured: 1_000_000 });
    expect(r.status).toBe(400);
    expect((await r.json()).message).toContain("PLB05");
  });

  it("refuses the ages and sexes it cannot read, before reaching the engine", async () => {
    for (const bad of [{ ...QUOTE, age: 3.5 }, { ...QUOTE, age: 200 }, { ...QUOTE, sex: "X" }, { ...QUOTE, sumAssured: 0 }]) {
      expect((await ask(bad)).status, JSON.stringify(bad)).toBe(400);
    }
  });
});

describe("the list a caller reads first", () => {
  it("says enough to build a request without guessing", async () => {
    const body = await (await plans()).json();
    const plb = body.plans.find((p: { code: string }) => p.code === "PLB");
    expect(plb.packages.map((v: { variant: string }) => v.variant)).toEqual(["PLB05", "PLB10", "PLB12", "PLB15"]);
    expect(plb.packages[0]).toMatchObject({ sumAssuredMin: 300_000, sumAssuredFixed: false });
    expect(plb).toMatchObject({ ageMin: 20, ageMax: 59, quotable: true, premiumBasis: false });
  });

  it("warns that iShield is asked the other way round", async () => {
    const body = await (await plans()).json();
    const shield = body.plans.find((p: { code: string }) => p.code === "ISHIELD");
    expect(shield.premiumBasis).toBe(true);
    expect(shield.quotable).toBe(false);
  });

  it("reports the earliest expiry of all the tables it spans", async () => {
    const body = await (await plans()).json();
    expect(body.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.disclaimer).toBe(DISCLAIMER);
  });
});
