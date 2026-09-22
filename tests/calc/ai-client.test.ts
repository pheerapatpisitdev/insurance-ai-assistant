import { beforeEach, describe, expect, it, vi } from "vitest";

/** What the shared reference table holds; one model is enough to show the order of things. */
const MODEL = {
  id: "m1", provider: "google", kind: "text", model_name: "gemini-3.1-flash-lite", enabled: true,
  price: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.4 },
};

let keyRows: { provider: string; api_key: string }[] | null = [{ provider: "google", api_key: "k" }];
const inserted: Record<string, unknown>[] = [];
/** the month so far: what the ledger holds, and what the owner set as the ceiling */
let ledger: { model: string; task: string; cost_thb: number }[] = [];
let budget: number | null = null;
/** what the client library does to any select: the first thousand rows, silently */
const CAP = 1000;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (name: string) => {
      if (name === "ins_month_spend") {
        const acc = new Map<string, { model: string; task: string; calls: number; cost_thb: number }>();
        for (const r of ledger) {
          const at = acc.get(`${r.model}|${r.task}`) ?? { model: r.model, task: r.task, calls: 0, cost_thb: 0 };
          at.calls += 1;
          at.cost_thb += r.cost_thb;
          acc.set(`${r.model}|${r.task}`, at);
        }
        return { data: [...acc.values()], error: null };
      }
      return { data: keyRows, error: keyRows ? null : { message: "boom" } };
    },
    from: (table: string) => ({
      select: () => {
        if (table === "model_configs") return Promise.resolve({ data: [MODEL] });
        if (table === "ins_model_prefs") return Promise.resolve({ data: [] });
        if (table === "ins_ai_settings") return { maybeSingle: async () => ({ data: { small_model: null, large_model: null, monthly_budget_thb: budget } }) };
        const q = {
          order: () => q,
          range: async (from: number, to: number) => ({ data: ledger.slice(from, Math.min(to + 1, from + CAP)), error: null }),
          then: (ok: (v: unknown) => unknown) => Promise.resolve({ data: ledger.slice(0, CAP), error: null }).then(ok),
        };
        return { gte: () => q };
      },
      insert: async (v: Record<string, unknown>) => { inserted.push(v); return { error: null }; },
    }),
  }),
}));

const call = vi.fn(async () => ({ text: "ok", inputTokens: 10, outputTokens: 5 }));
vi.mock("@/lib/ai/providers", () => ({ CALLERS: { google: (...a: unknown[]) => call(...(a as [])) }, EMBEDDERS: {} }));

const { chat, clearAiConfigCache } = await import("@/lib/ai/client");

const ask = () => chat({ tier: "small", task: "t", messages: [{ role: "user", content: "hi" }] });

beforeEach(() => {
  process.env.ADMIN_SESSION_SECRET = "secret";
  keyRows = [{ provider: "google", api_key: "k" }];
  inserted.length = 0;
  ledger = [];
  budget = null;
  call.mockClear();
  clearAiConfigCache();
});

describe("reaching a model", () => {
  it("answers through the first provider that has a key", async () => {
    const r = await ask();
    expect(r.text).toBe("ok");
    expect(r.model).toBe("gemini-3.1-flash-lite");
  });

  it("says which models it tried when every one of them fails", async () => {
    call.mockRejectedValueOnce(new Error("429 quota"));
    await expect(ask()).rejects.toThrow(/gemini-3.1-flash-lite: .*429/);
  });

  it("names the missing keys rather than blaming the models when the key table cannot be read", async () => {
    keyRows = null;
    await expect(ask()).rejects.toThrow(/คีย์/);
  });

  /**
   * 1,180 calls at three satang is ฿35.40. Read as rows, the client stops at a thousand and
   * the guard sees ฿30.00 — under a ฿32 budget that the month has in fact already passed.
   */
  it("shuts off at the budget even when the month has more calls than one read returns", async () => {
    ledger = Array.from({ length: 1180 }, () => ({ model: "gemini-3.1-flash-lite", task: "route", cost_thb: 0.03 }));
    budget = 32;
    await expect(ask()).rejects.toThrow(/งบ/);
    expect(call).not.toHaveBeenCalled();
  });

  it("answers while the month is still under budget", async () => {
    ledger = Array.from({ length: 1180 }, () => ({ model: "gemini-3.1-flash-lite", task: "route", cost_thb: 0.03 }));
    budget = 36;
    expect((await ask()).text).toBe("ok");
  });

  it("does not keep a broken key list: the next customer is answered", async () => {
    keyRows = null;
    await expect(ask()).rejects.toThrow();
    keyRows = [{ provider: "google", api_key: "k" }];
    // a minute has not passed, so only a config that refused to be cached lets this through
    expect((await ask()).text).toBe("ok");
  });
});
