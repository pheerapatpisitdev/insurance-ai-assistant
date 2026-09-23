import { afterEach, describe, expect, it, vi } from "vitest";
import { CALLERS, openAiReasoning } from "@/lib/ai/providers";

describe("openAiReasoning", () => {
  it("keeps GPT-5 models from spending their whole allowance thinking", () => {
    // default effort on gpt-5-mini: 200 of 200 tokens reasoning, empty reply (probed 2026-09-23)
    expect(openAiReasoning("gpt-5-mini")).toEqual({ reasoning_effort: "minimal" });
    expect(openAiReasoning("gpt-5")).toEqual({ reasoning_effort: "minimal" });
  });

  it("passes a caller's own effort through, and says nothing to other models", () => {
    expect(openAiReasoning("gpt-5", "low")).toEqual({ reasoning_effort: "low" });
    expect(openAiReasoning("gpt-4o-mini")).toEqual({});
  });
});

describe("the OpenAI call", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("sends the reasoning effort with the request", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }], usage: {} })));
    vi.stubGlobal("fetch", fetchMock);
    await CALLERS.openai({ apiKey: "k", model: "gpt-5-mini", messages: [{ role: "user", content: "x" }], maxTokens: 200 });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.reasoning_effort).toBe("minimal");
    expect(body.max_completion_tokens).toBe(200);
  });
});
