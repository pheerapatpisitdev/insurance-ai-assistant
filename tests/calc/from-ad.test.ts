import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/**
 * A customer who pressed "ส่งข้อความ" under an advertisement has already said what they came
 * for. Being asked "สนใจแบบไหนครับ" in the first reply spends their patience on a question
 * the advertisement answered, and spends the click that was paid for.
 */

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify(routed) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

/** the advertisement figures Meta sends back, where an advertisement carries its own name */
let adRows: { ad_name?: string; adset_name?: string; campaign_name?: string }[] = [];
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({ order: () => ({ limit: async () => ({ data: adRows, error: null }) }) }),
        limit: async () => ({ data: [], error: null }),
      }),
    }),
  }),
}));

const { productFromAd } = await import("@/lib/facebook/from-ad");
const { answerAny } = await import("@/lib/assistant/dispatch");
const said = (content: string) => [{ role: "user" as const, content }];

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; adRows = []; });

describe("what the advertisement was selling", () => {
  it("is read from the link's own ref, which the agency writes", async () => {
    expect(await productFromAd({ ref: "lifeprotect" }, undefined))
      .toEqual({ product: "lifeprotect", from: "ref" });
    expect(await productFromAd({ ref: "ihealthy-jan" }, undefined))
      .toEqual({ product: "ihealthy", from: "ref" });
  });

  it("is read from the button the customer pressed, when they came that way", async () => {
    expect(await productFromAd(undefined, "ประกันสุขภาพ"))
      .toEqual({ product: "ihealthy", from: "payload" });
  });

  it("is read from the advertisement's own name, with no list to keep in step", async () => {
    adRows = [{ ad_name: "ไลฟ์ โพรเทค x2 — มีนาคม", campaign_name: "Q1" }];
    expect(await productFromAd({ ad_id: "123" }, undefined))
      .toEqual({ product: "lifeprotect", from: "ad_name" });
  });

  it("says nothing rather than guessing, when the advertisement names two plans or none", async () => {
    adRows = [{ ad_name: "ประกันชีวิต + ประกันสุขภาพ รวมกัน" }];
    expect(await productFromAd({ ad_id: "123" }, undefined)).toBeUndefined();
    adRows = [{ ad_name: "โปรโมชั่นเดือนนี้" }];
    expect(await productFromAd({ ad_id: "123" }, undefined)).toBeUndefined();
    expect(await productFromAd({ ref: "summer-sale" }, undefined)).toBeUndefined();
  });

  it("does not break the conversation when the figures cannot be read", async () => {
    // an unknown advertisement is a conversation that opens by asking which plan, which is
    // exactly where it opened before any of this existed
    expect(await productFromAd({ ad_id: "nope" }, undefined)).toBeUndefined();
  });
});

describe("the first reply to someone who came from an advertisement", () => {
  it("starts on the plan the advertisement was about, instead of asking which", async () => {
    const asked = await answerAny(said("สวัสดีครับ"), null, "facebook");
    expect(asked.messages.at(-1)!.text).toContain("สนใจแบบไหน");

    const knowing = await answerAny(said("สวัสดีครับ"), null, "facebook", "lifeprotect");
    expect(knowing.messages.at(-1)!.text).not.toContain("สนใจแบบไหน");
    expect(knowing.slots.product).toBe("lifeprotect");
  });

  it("still lets the customer's own words outrank what they clicked", async () => {
    // they pressed a life advertisement and opened with a health question; the question wins
    const a = await answerAny(said("ค่าห้องเท่าไหร่"), null, "facebook", "lifeprotect");
    expect(a.slots.product).toBe("ihealthy");
  });

  it("does not disturb a conversation already under way", async () => {
    // they came back through the advertisement mid-quotation; the quotation continues
    const a = await answerAny(said("ทุน 1 ล้าน"), { product: "ihealthy" } as never, "facebook", "lifeprotect");
    expect(a.slots.product).toBe("ihealthy");
  });
});
