import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/**
 * Where a question about a company's staff actually goes.
 *
 * `group-knowledge.test.ts` proves the words exist; this proves something reads them. The two
 * were worth separating because the failure that started this was neither — the knowledge was
 * missing AND the route went to the wrong brain, and fixing one without the other changes
 * nothing a customer would notice.
 *
 * The model is stubbed, so what is asserted is which road the turn took and what was in the
 * prompt when it got there — not what a model then said, which is not this repository's to
 * decide.
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
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({ select: () => ({ eq: () => ({ limit: async () => ({ data: [], error: null }) }) }) }),
  }),
}));

const { answerAny } = await import("@/lib/assistant/dispatch");

const said = (content: string) => [{ role: "user" as const, content }];

/** The system prompt of whichever model call was made, which is where the knowledge rides. */
const promptOf = (call: number) => {
  const opts = chat.mock.calls[call]?.[0] as ChatOptions | undefined;
  const system = opts?.messages.find((m) => m.role === "system");
  return system?.content ?? "";
};

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("a company asking about cover for its staff", () => {
  /**
   * The regression this feature was built around.
   *
   * Before the guard, this message named the individual health plan — "ประกันสุขภาพ" is
   * inside it — and went to that brain, which asked for an age and a sex and quoted one
   * person's premium to a company. The test asserts the road, not the wording: it must not
   * be the health brain, and the answer must not be a demand for an age.
   */
  it("is no longer taken to the individual health plan", async () => {
    const answer = await answerAny(said("ประกันสุขภาพกลุ่มมีไหม"), null);
    expect(answer.slots.product).not.toBe("ihealthy");
    expect(answer.messages.map((m) => m.text).join("\n")).not.toContain("ขออายุกับเพศ");
  });

  it("is answered out of the library, with the group section in front of the model", async () => {
    const answer = await answerAny(said("ประกันกลุ่มสำหรับพนักงานมีไหม"), null);
    expect(answer.fromLibrary).toBe(true);
    expect(chat).toHaveBeenCalled();
    const prompt = promptOf(0);
    expect(prompt).toContain("ประกันภัยกลุ่ม (Group Insurance)");
    expect(prompt).toContain("/group-insurance");
    expect(prompt).toContain("คิดเบี้ยประกันกลุ่มให้ไม่ได้");
  });

  it("gets the benefit table when the question names which of the two it means", async () => {
    await answerAny(said("ประกันอุบัติเหตุกลุ่มคุ้มครองอะไรบ้าง"), null);
    expect(promptOf(0)).toContain("ประกันอุบัติเหตุกลุ่ม (Group PA) — วงเงินคุ้มครอง");
  });

  it("is not handed the tables for a question that did not ask for them", async () => {
    await answerAny(said("ประกันกลุ่มรับกี่คน"), null);
    expect(promptOf(0)).not.toContain("วงเงินคุ้มครอง (บาท) แผน 1 → แผน 6");
    // but it still knows they exist, so it offers rather than denying
    expect(promptOf(0)).toContain("ห้ามบอกว่าไม่มีในระบบ");
  });
});

describe("an individual customer, who must be unaffected", () => {
  it("still reaches the health brain by the plan's own name", async () => {
    const answer = await answerAny(said("ประกันสุขภาพมีไหม"), null);
    expect(answer.slots.product).toBe("ihealthy");
  });

  it("still reaches it by subject alone", async () => {
    const answer = await answerAny(said("ค่าห้องวันละเท่าไหร่"), null);
    expect(answer.slots.product).toBe("ihealthy");
  });

  /**
   * A conversation already settled on a plan is never handed to the library — the dispatcher
   * keeps it with its brain, which is right, because "ทุนเท่าไหร่" three turns in is about the
   * contract in hand. What makes that safe here is that the brain's own prompt carries the
   * whole library, group section included, so it can answer the aside without being wrong
   * about it.
   */
  it("carries the group facts into the health brain too, for the question asked mid-quote", async () => {
    routed = { intent: "plan_info" };
    await answerAny(said("แล้วแบบทำให้พนักงานทั้งบริษัทมีไหม"), {
      product: "ihealthy", intent: "plan_info", age: 35, sex: "M",
    });
    const prompts = chat.mock.calls.map((_, i) => promptOf(i));
    expect(prompts.some((p) => p.includes("ประกันภัยกลุ่ม (Group Insurance)"))).toBe(true);
  });
});
