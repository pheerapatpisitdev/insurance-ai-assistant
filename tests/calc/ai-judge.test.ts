import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * TypeSafe answers in probabilities, not prose, so it lives beside the chat providers rather
 * than among them. These tests hold three things in place: the request is the one the
 * provider documents, the ledger is charged on input only (output is free there), and the
 * key test tells a missing key from a dead endpoint.
 */

let keyRows: { provider: string; api_key: string }[] = [{ provider: "typesafe", api_key: "ts-secret-key-1234" }];
let switches: { provider: string; enabled: boolean }[] = [];
const inserted: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async () => ({ data: keyRows, error: null }),
    from: (table: string) => ({
      select: () => {
        if (table === "model_configs") return Promise.resolve({ data: [] });
        if (table === "ins_model_prefs") return Promise.resolve({ data: [] });
        if (table === "ins_api_keys") return Promise.resolve({ data: switches });
        if (table === "ins_ai_settings") return { maybeSingle: async () => ({ data: { small_model: null, large_model: null, monthly_budget_thb: null } }) };
        return { gte: async () => ({ data: [] }) };
      },
      insert: async (v: Record<string, unknown>) => { inserted.push(v); return { error: null }; },
    }),
  }),
}));

const { judge, testProviders, clearAiConfigCache } = await import("@/lib/ai/client");

const REPLY = {
  model: "jev-1.13.0",
  answers: {
    intent: { type: "choice", choice: "quote", probabilities: { quote: 0.9, plan_info: 0.1 }, confidence: 0.85 },
  },
  usage: { input_tokens: 1_000_000, output_tokens: 20 },
};

const fetchMock = vi.fn();

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "secret";
  keyRows = [{ provider: "typesafe", api_key: "ts-secret-key-1234" }];
  switches = [];
  inserted.length = 0;
  clearAiConfigCache();
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, json: async () => REPLY });
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

const ask = () => judge({
  task: "route-trial",
  state: "สนใจประกันมรดก ทุน 1,000,000",
  questions: { intent: { type: "choice", instructions: "ลูกค้าต้องการอะไร", criteria: { quote: "ขอเบี้ย", plan_info: "ถามความคุ้มครอง" } } },
});

describe("asking the judge", () => {
  it("sends the documented request to the documented endpoint", async () => {
    await ask();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.typesafe.ai/v1/systemone");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer ts-secret-key-1234");
    const body = JSON.parse(String(init.body));
    expect(body.model).toBe("jev-latest");
    expect(body.state).toBe("สนใจประกันมรดก ทุน 1,000,000");
    expect(body.questions.intent.type).toBe("choice");
  });

  it("returns the answers and the version that gave them", async () => {
    const r = await ask();
    expect(r.answers.intent).toMatchObject({ type: "choice", choice: "quote", confidence: 0.85 });
    expect(r.model).toBe("jev-1.13.0");
  });

  it("charges the ledger on input only, at the provider's price, under the version that answered", async () => {
    const r = await ask();
    // a million input tokens at $0.042, at 36 baht to the dollar; the 20 output tokens are free
    expect(r.costThb).toBeCloseTo(0.042 * 36, 6);
    expect(inserted).toHaveLength(1);
    expect(inserted[0]).toMatchObject({ model: "jev-1.13.0", task: "route-trial", input_tokens: 1_000_000, output_tokens: 20 });
    expect(Number(inserted[0].cost_thb)).toBeCloseTo(0.042 * 36, 6);
  });

  it("refuses when the owner has switched the provider off, without spending a call", async () => {
    switches = [{ provider: "typesafe", enabled: false }];
    await expect(ask()).rejects.toThrow(/ปิดอยู่/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("passes the caller's own timeout through to the request", async () => {
    const signal = AbortSignal.timeout(60_000);
    await judge({ task: "t", state: "x", questions: { q: { type: "noul", instructions: "?" } }, signal });
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal).toBe(signal);
  });

  it("refuses in words when there is no key rather than calling with none", async () => {
    keyRows = [];
    await expect(ask()).rejects.toThrow(/TypeSafe/);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("the key test", () => {
  it("asks the judge one yes/no and reports the version, writing nothing to the ledger", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ model: "jev-1.13.0", answers: { alive: { type: "noul", noul: 0.9 } }, usage: { input_tokens: 5, output_tokens: 1 } }) });
    const [check] = await testProviders(["typesafe"]);
    expect(check).toMatchObject({ provider: "typesafe", state: "ok", model: "jev-1.13.0" });
    expect(inserted).toHaveLength(0);
  });

  it("says no-key without asking anyone when the key is not set", async () => {
    keyRows = [];
    const [check] = await testProviders(["typesafe"]);
    expect(check.state).toBe("no-key");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carries the provider's own refusal back, with anything key-shaped taken out", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 401, text: async () => "invalid api key ts-secret-key-1234-abcdefghijklmnopqrstuvwxyz" });
    const [check] = await testProviders(["typesafe"]);
    expect(check.state).toBe("failed");
    expect(check.error).toMatch(/401/);
    expect(check.error).not.toMatch(/abcdefghijklmnopqrstuvwxyz/);
  });
});
