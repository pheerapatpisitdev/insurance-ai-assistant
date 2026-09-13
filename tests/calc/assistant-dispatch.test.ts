import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify(routed) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerAny } = await import("@/lib/assistant/dispatch");
const { CHOOSE_HEALTH, CHOOSE_LIFE } = await import("@/lib/assistant/choose");

const said = (content: string) => [{ role: "user" as const, content }];
beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("a customer who has not said what they came for", () => {
  it("is asked, with two buttons, and no model is paid", async () => {
    const answer = await answerAny(said("สนใจค่ะ"), null);
    expect(answer.replies).toEqual([CHOOSE_HEALTH, CHOOSE_LIFE]);
    expect(answer.slots).toMatchObject({ product: "undecided" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("is remembered by age and sex while it asks", async () => {
    const answer = await answerAny(said("หญิง 35"), null);
    expect(answer.slots).toMatchObject({ product: "undecided", age: 35, sex: "F" });
  });

  it("goes straight on once the button is tapped, without asking again", async () => {
    routed = { intent: "quote" };
    const answer = await answerAny(said(CHOOSE_HEALTH), { product: "undecided", age: 35, sex: "F" });
    expect(answer.slots).toMatchObject({ product: "ihealthy", age: 35, sex: "F" });
    expect(answer.messages[0].card).toContain("/api/ihealthy-card/table?");
  });
});

describe("a customer whose message says what they came for", () => {
  it("is answered in the same turn, with no button in the way", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerAny(said("สนใจประกันมรดก ทุน 1,000,000"), null);
    expect(answer.slots).toMatchObject({ product: "lifeprotect" });
    expect(answer.priced).toBe(true);
  });

  it("is heard from the subject alone when no plan is named", async () => {
    routed = { intent: "quote", age: 35, sex: "F" };
    const answer = await answerAny(said("ค่าห้องวันละเท่าไหร่ หญิง 35"), null);
    expect(answer.slots.product).toBe("ihealthy");
  });
});

describe("a conversation already under way", () => {
  it("treats a session from before this existed as the life plan", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerAny(said("ชาย 35 ล้านนึง"), { intent: "quote" } as never);
    expect(answer.slots.product).toBe("lifeprotect");
  });

  it("switches when the other plan is named, carrying only the person", async () => {
    routed = { intent: "other" };
    const answer = await answerAny(said("แล้ว Life Protect ล่ะ"), {
      product: "ihealthy", intent: "quote", age: 35, sex: "F", plan: "GOLD", territory: "เอเชีย",
    });
    expect(answer.slots).toMatchObject({ product: "lifeprotect", age: 35, sex: "F" });
    expect(JSON.stringify(answer.slots)).not.toContain("GOLD");
    expect(JSON.stringify(answer.slots)).not.toContain("เอเชีย");
  });

  it("does not switch on a health declaration asked of a life customer", async () => {
    routed = { intent: "plan_info" };
    const answer = await answerAny(said("ต้องตรวจสุขภาพไหม"), {
      product: "lifeprotect", intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000,
    });
    expect(answer.slots.product).toBe("lifeprotect");
  });

  it("does not switch on a subject when a plan is already settled", async () => {
    routed = { intent: "plan_info" };
    const answer = await answerAny(said("ทุนเท่าไหร่"), {
      product: "ihealthy", intent: "quote", age: 35, sex: "F", plan: "GOLD",
    });
    expect(answer.slots.product).toBe("ihealthy");
  });
});
