import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The judge in the shadow of the router: it watches, it writes one row, and it changes
 * nothing about what the customer gets. These hold the second half of that in place — the
 * bot's answer is the chat model's whether the judge agrees, disagrees, fails or is off.
 */

const reply = { text: "", model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0 };
const chat = vi.fn(async () => reply);
const judge = vi.fn();
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat, judge };
});

const inserted: Record<string, unknown>[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ insert: async (v: Record<string, unknown>) => { inserted.push(v); return { error: null }; } }),
  }),
}));

const { routeMessage } = await import("@/lib/assistant/lifeprotect/route");
const { routeHealth } = await import("@/lib/assistant/ihealthy/route");

const said = (content: string) => [{ role: "user" as const, content }];
const verdict = (choice: string, confidence: number) => ({
  answers: { intent: { type: "choice", choice, probabilities: {}, confidence } }, model: "jev-1.13.0", inputTokens: 1, costThb: 0,
});

beforeEach(() => {
  chat.mockClear(); judge.mockReset(); inserted.length = 0;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("the judge in the shadow of the router", () => {
  it("writes what both said and whether they agree, and the bot keeps the model's answer", async () => {
    reply.text = JSON.stringify({ intent: "other" });
    judge.mockResolvedValue(verdict("quote", 0.91));
    const out = await routeMessage(said("หญิง 40"));
    expect(out.intent).toBe("other");
    expect(inserted).toEqual([expect.objectContaining({
      product: "lifeprotect", model_intent: "other", final_intent: "other",
      jev_intent: "quote", jev_confidence: 0.91, agrees_model: false, agrees_final: false,
    })]);
  });

  it("compares against what the code settled on, not only what the model said", async () => {
    // the model calls it a question; the code's own rule reads a sum in a request for a price
    reply.text = JSON.stringify({ intent: "plan_info", coverWanted: 1000000 });
    judge.mockResolvedValue(verdict("quote", 0.7));
    const out = await routeMessage(said("สนใจประกันมรดก ทุน 1,000,000"));
    expect(out.intent).toBe("quote");
    expect(inserted[0]).toMatchObject({ model_intent: "plan_info", final_intent: "quote", agrees_model: false, agrees_final: true });
  });

  it("shows the judge the last exchange and asks under its own ledger name", async () => {
    reply.text = JSON.stringify({ intent: "quote" });
    judge.mockResolvedValue(verdict("quote", 0.8));
    await routeMessage([
      { role: "user", content: "ขอเบี้ย" }, { role: "assistant", content: "อายุเท่าไหร่ครับ" }, { role: "user", content: "35" },
    ]);
    const call = judge.mock.calls[0][0] as { task: string; state: string; signal?: AbortSignal };
    expect(call.task).toBe("route_shadow");
    expect(call.state).toBe("ลูกค้า: ขอเบี้ย\nบอท: อายุเท่าไหร่ครับ\nลูกค้า: 35");
    expect(call.signal).toBeInstanceOf(AbortSignal);
  });

  it("is silent when the judge fails, is off, or has no key — nothing written, nothing thrown", async () => {
    reply.text = JSON.stringify({ intent: "plan_info" });
    judge.mockRejectedValue(new Error("TypeSafe ปิดอยู่"));
    expect((await routeMessage(said("คุ้มครองอะไร"))).intent).toBe("plan_info");
    judge.mockRejectedValue(new Error("api.typesafe.ai 529: overloaded"));
    expect((await routeMessage(said("คุ้มครองอะไร"))).intent).toBe("plan_info");
    expect(inserted).toHaveLength(0);
  });

  it("watches the health router too, under its own product", async () => {
    reply.text = JSON.stringify({ intent: "other" });
    judge.mockResolvedValue(verdict("other", 0.6));
    await routeHealth(said("สวัสดี"), null);
    expect(inserted[0]).toMatchObject({ product: "ihealthy", model_intent: "other", jev_intent: "other", agrees_final: true });
  });
});
