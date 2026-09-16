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
const { POST: MCP } = await import("@/app/api/v1/mcp/route");
const { POST: MCP_PATH } = await import("@/app/api/v1/mcp/[key]/route");
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

  it("carries both pictures, for every plan that can draw them", async () => {
    /**
     * The card and the table travel together or the answer is half an answer: the card says
     * what it costs, the table says what it is worth in the year the customer is thinking
     * about. This used to ask `coverTopUp`, which is the rule for a surrender schedule and
     * not the rule for a table — so PLB, which draws a cover table on the sales page every
     * day, reported no table at all through the API.
     */
    for (const body of [
      QUOTE,
      { plan: "LIFETREASURE", variant: "H99F06A", age: 40, sex: "M", sumAssured: 10_000_000 },
      { plan: "ISMART", variant: "W80F06", age: 40, sex: "M", sumAssured: 1_000_000 },
      { plan: "ISHIELD", variant: "WLCI10", age: 35, sex: "F", sumAssured: 1_000_000 },
    ]) {
      const out = await (await ask(body)).json();
      expect(out.images.quote, JSON.stringify(body)).toMatch(/^https?:\/\/\S+\/api\/card\?/);
      expect(out.images.valueTable, JSON.stringify(body)).toMatch(/^https?:\/\/\S+\/api\/card\/table\?/);
    }
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

  it("warns that iShield is normally asked the other way round, but still prices it", async () => {
    const body = await (await plans()).json();
    const shield = body.plans.find((p: { code: string }) => p.code === "ISHIELD");
    // the sales page asks for a premium and answers with a sum assured, which is worth saying
    expect(shield.premiumBasis).toBe(true);
    // but the engine prices it sum-assured-first perfectly well, and the catalogue used to
    // claim otherwise — a model that believed it refused a quotation it could have given
    expect(shield.quotable).toBe(true);
    expect((await ask({ plan: "ISHIELD", variant: "WLCI10", age: 35, sex: "F", sumAssured: 1_000_000 })).status).toBe(200);
  });

  it("marks a package it cannot price, and says which tool can", async () => {
    const body = await (await plans()).json();
    const lp = body.plans.find((p: { code: string }) => p.code === "LIFEPROTECT");
    const health = lp.packages.find((v: { variant: string }) => v.variant === "WLF99HX");
    const plain = lp.packages.find((v: { variant: string }) => v.variant === "WLF09H");

    expect(plain.quotable).toBe(true);
    expect(plain.useInstead).toBeUndefined();
    // health cover is a rider on a life contract and needs a plan chosen; this door has
    // nowhere to put one, so it must say so rather than let the attempt fail at the engine
    expect(health.quotable).toBe(false);
    expect(health.useInstead).toBe("quote_health");
  });

  it("turns a health package away with the way forward, not with the engine's words", async () => {
    const r = await ask({ plan: "LIFEPROTECT", variant: "WLF99HX", age: 35, sex: "M", sumAssured: 50_000 });
    expect(r.status).toBe(400);
    const out = await r.json();
    expect(out.message).toContain("quote_health");
    // the old answer was "กรุณาเลือกแผน iHealthy Ultra": true, unanswerable here, and the
    // point at which a model stopped asking and invented an explanation for the customer
    expect(out.message).not.toContain("กรุณาเลือกแผน");
  });

  it("reports the earliest expiry of all the tables it spans", async () => {
    const body = await (await plans()).json();
    expect(body.expiresOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.disclaimer).toBe(DISCLAIMER);
  });
});

describe("the same answers, offered to a model", () => {
  /**
   * MCP is the third door onto the two questions the other two ask. What matters here is not
   * the protocol — three methods and a JSON body — but that a model is handed the same figure
   * and the same warnings as everybody else, and that a refusal reaches it as a refusal.
   */
  const rpc = (method: string, params?: unknown, key: string | null = KEY) =>
    MCP(new Request("https://x/api/v1/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", ...(key ? { authorization: `Bearer ${key}` } : {}) },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    }));
  const toolText = async (r: Response) => {
    const body = await r.json();
    return { isError: Boolean(body.result?.isError), payload: JSON.parse(body.result.content[0].text) };
  };

  it("asks for a key before it speaks the protocol at all", async () => {
    expect((await rpc("initialize", {}, null)).status).toBe(401);
    keyRow = { ok: false, reason: "quota_exhausted", client_name: "x" };
    expect((await rpc("initialize")).status).toBe(429);
  });

  it("offers exactly the four tools, and tells the model what not to do with them", async () => {
    const { result } = await (await rpc("tools/list")).json();
    expect(result.tools.map((t: { name: string }) => t.name))
      .toEqual(["list_plans", "quote_premium", "quote_health", "list_health_plans"]);
    const quoteTool = result.tools.find((t: { name: string }) => t.name === "quote_premium");
    expect(quoteTool.description).toContain("ห้ามปัดเศษ");
    expect(quoteTool.description).toContain("disclaimer");
    expect(quoteTool.inputSchema.required).toEqual(["plan", "age", "sex", "sumAssured"]);

    // the health tool has to send the model away from the other one by name, because the
    // two are told apart by what the customer asked for and not by anything in the arguments
    const healthTool = result.tools.find((t: { name: string }) => t.name === "quote_health");
    expect(healthTool.description).toContain("ห้ามใช้ quote_premium");
    expect(healthTool.inputSchema.required).toEqual(["age", "sex", "plan"]);
  });

  it("prices health as the whole arrangement, and says what is in the price", async () => {
    const { payload, isError } = await toolText(await rpc("tools/call", {
      name: "quote_health",
      arguments: { age: 35, sex: "M", plan: "GOLD" },
    }));
    expect(isError).toBe(false);
    expect(payload.premium.annual).toBeGreaterThan(0);
    // a total handed over without its parts is read as the price of health cover alone
    expect(payload.partsOfPremium.health).toBeGreaterThan(0);
    expect(payload.partsOfPremium.lifeBase).toBeGreaterThan(0);
    expect(payload.arrangement.sumAssured).toBe(50_000);
    expect(payload.disclaimer).toBe(DISCLAIMER);
  });

  it("hands back the plans on sale rather than letting a plan code be guessed", async () => {
    const { payload } = await toolText(await rpc("tools/call", {
      name: "list_health_plans", arguments: { age: 35 },
    }));
    expect(payload.plans.map((p: { code: string }) => p.code)).toContain("GOLD");

    const { isError, payload: bad } = await toolText(await rpc("tools/call", {
      name: "quote_health", arguments: { age: 35, sex: "M", plan: "PLATINUM_DELUXE" },
    }));
    expect(isError).toBe(true);
    expect(bad.message).toContain("GOLD");
  });

  it("hands back the engine's figure, with the table and the warning inside the payload", async () => {
    const { isError, payload } = await toolText(await rpc("tools/call", {
      name: "quote_premium",
      arguments: { plan: "PLB", variant: "PLB10", age: 35, sex: "M", sumAssured: 1_000_000 },
    }));
    const rest = await (await ask(QUOTE)).json();
    expect(isError).toBe(false);
    // the same number the REST door gives, because both ask the same function
    expect(payload.premium.annual).toBe(rest.premium.annual);
    expect(payload.version).toBe(rest.version);
    expect(payload.disclaimer).toBe(DISCLAIMER);
  });

  it("marks a refusal as an error, so a model cannot read it as a quotation", async () => {
    const { isError, payload } = await toolText(await rpc("tools/call", {
      name: "quote_premium",
      arguments: { plan: "PLB", variant: "PLB10", age: 70, sex: "M", sumAssured: 1_000_000 },
    }));
    expect(isError).toBe(true);
    expect(payload.error).toBe("not_issuable");
    expect(payload.reasons[0]).toContain("อายุรับประกัน");
    expect(JSON.stringify(payload)).not.toMatch(/"premium"/);
  });

  it("says so plainly when asked for something it does not have", async () => {
    const { isError, payload } = await toolText(await rpc("tools/call", { name: "delete_everything", arguments: {} }));
    expect(isError).toBe(true);
    expect(payload.error).toBe("unknown_tool");

    const { error } = await (await rpc("resources/list")).json();
    expect(error.code).toBe(-32601);
  });
});

describe("the key in the path, for a client that cannot send a header", () => {
  /**
   * Claude's connector settings take a URL and nothing else: it tries OAuth with dynamic
   * client registration and stops when the server cannot do that. So the key travels in the
   * path for that one client — the same handler, the same refusals, the same counting.
   */
  const viaPath = (key: string) =>
    MCP_PATH(
      new Request("https://x/api/v1/mcp/" + key, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 9, method: "tools/list" }),
      }),
      { params: Promise.resolve({ key }) },
    );

  it("works without any header at all", async () => {
    const { result } = await (await viaPath(KEY)).json();
    expect(result.tools.map((t: { name: string }) => t.name))
      .toEqual(["list_plans", "quote_premium", "quote_health", "list_health_plans"]);
  });

  it("is refused exactly as a header key would be", async () => {
    keyRow = { ok: false, reason: "disabled", client_name: "เก่า" };
    expect((await viaPath(KEY)).status).toBe(403);
    keyRow = { ok: false, reason: "quota_exhausted", client_name: "x" };
    expect((await viaPath(KEY)).status).toBe(429);
  });
});
