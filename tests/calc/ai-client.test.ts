import { beforeEach, describe, expect, it, vi } from "vitest";

/** What the shared reference table holds; one model is enough to show the order of things. */
const MODEL = {
  id: "m1", provider: "google", kind: "text", model_name: "gemini-3.1-flash-lite", enabled: true,
  price: { inputPerMTokUsd: 0.1, outputPerMTokUsd: 0.4 },
};

let keyRows: { provider: string; api_key: string }[] | null = [{ provider: "google", api_key: "k" }];
let switches: { provider: string; enabled: boolean }[] = [];
const inserted: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async () => ({ data: keyRows, error: keyRows ? null : { message: "boom" } }),
    from: (table: string) => ({
      select: () => {
        if (table === "model_configs") return Promise.resolve({ data: [MODEL] });
        if (table === "ins_model_prefs") return Promise.resolve({ data: [] });
        if (table === "ins_api_keys") return Promise.resolve({ data: switches });
        if (table === "ins_ai_settings") return { maybeSingle: async () => ({ data: { small_model: null, large_model: null, monthly_budget_thb: null } }) };
        return { gte: async () => ({ data: [] }) };
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
  switches = [];
  inserted.length = 0;
  call.mockClear();
  clearAiConfigCache();
});

describe("the switch beside a key", () => {
  it("takes a switched-off provider out of the chain as if its key were gone", async () => {
    switches = [{ provider: "google", enabled: false }];
    await expect(ask()).rejects.toThrow(/ไม่มีคีย์/);
    expect(call).not.toHaveBeenCalled();
  });

  it("changes nothing while the switch is on", async () => {
    switches = [{ provider: "google", enabled: true }];
    expect((await ask()).model).toBe("gemini-3.1-flash-lite");
  });
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

  it("does not keep a broken key list: the next customer is answered", async () => {
    keyRows = null;
    await expect(ask()).rejects.toThrow();
    keyRows = [{ provider: "google", api_key: "k" }];
    // a minute has not passed, so only a config that refused to be cached lets this through
    expect((await ask()).text).toBe("ok");
  });
});
