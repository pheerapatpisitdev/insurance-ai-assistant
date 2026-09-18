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
const { CHOOSE_HEALTH, CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD } = await import("@/lib/assistant/choose");

const said = (content: string) => [{ role: "user" as const, content }];
beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("a customer who has not said what they came for", () => {
  it("is answered before being asked back, when the question was about the company", async () => {
    // a real first message: "ของอะไร" means which company, and got "สนใจแบบไหนครับ" back
    const answer = await answerAny(said("ของอะไร"), null);
    expect(answer.messages[0].text).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    // the question is still put, and the buttons still offered
    expect(answer.messages.at(-1)!.text).toContain("สนใจแบบไหน");
    expect(answer.replies).toEqual([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD, CHOOSE_HEALTH]);
    expect(chat).not.toHaveBeenCalled();
  });

  /**
   * Two real messages from the page, both answered with the menu they had already been past.
   *
   * "สนใจสมัคร" is the words the bot hands out and the title of the button under every
   * follow-up; "สนใจ" came from a customer the bot had just told to type it. Neither is a
   * question about which plan, and both are the one message the advertising is paid for.
   */
  it("sends the form to someone asking to apply, plan or no plan", async () => {
    const answer = await answerAny(said("สนใจสมัคร"), { product: "undecided" });
    expect(answer.messages.map((m) => m.text).join("\n")).toContain("ฟอร์ม");
    expect(answer.slots).toMatchObject({ product: "undecided", formSent: true });
    expect(chat).not.toHaveBeenCalled();
  });

  it("reads a bare yes as the form, but only where the form was just offered", async () => {
    const invited = [
      { role: "user" as const, content: "ตรวจสุขภาพมั้ย" },
      { role: "assistant" as const, content: 'ถ้าสนใจขั้นตอนการสมัคร พิมพ์ว่า สนใจสมัคร ได้เลยครับผม' },
      { role: "user" as const, content: "สนใจ" },
    ];
    const taken = await answerAny(invited, { product: "undecided" });
    expect(taken.messages.map((m) => m.text).join("\n")).toContain("ฟอร์ม");

    // the same word from someone who has been offered nothing is still someone to ask
    const cold = await answerAny(said("สนใจ"), null);
    expect(cold.messages.at(-1)!.text).toContain("สนใจแบบไหน");
  });

  /**
   * A man of sixty-eight, on the page this morning.
   *
   * He gave his age, was shown four arrangements, wrote "ขอดูทั้ง2แบบ" and was shown the same
   * four again. Two of them no company would have issued him, and the second telling was the
   * same dead end as the first.
   */
  it("offers only the arrangements that would take them, once an age is known", async () => {
    const answer = await answerAny(said("อายุ 68 ปีครับ"), null);
    const text = answer.messages.at(-1)!.text;
    expect(text).toContain("อายุ 68");
    expect(answer.replies).toEqual([CHOOSE_LIFE, CHOOSE_HEALTH]);
    expect(text).not.toContain("จ่ายสั้น 5–20 ปี");
  });

  it("shows all four when no age says otherwise", async () => {
    const answer = await answerAny(said("สนใจครับ"), null);
    expect(answer.replies).toEqual([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD, CHOOSE_HEALTH]);
  });

  it("does not put the same menu up twice; it offers a person instead", async () => {
    const first = await answerAny(said("อายุ 68 ปีครับ"), null);
    const again = await answerAny([
      { role: "user" as const, content: "อายุ 68 ปีครับ" },
      { role: "assistant" as const, content: first.messages.at(-1)!.text },
      { role: "user" as const, content: "ขอดูทั้ง2แบบ" },
    ], first.slots);
    expect(again.messages[0].text).not.toContain("สนใจแบบไหนครับ");
    expect(again.messages[0].text).toContain("ตัวแทน");
    // the buttons stay up, still only the two he can have
    expect(again.replies).toEqual([CHOOSE_LIFE, CHOOSE_HEALTH]);
  });

  it("stops offering anything at an age every arrangement refuses", async () => {
    const answer = await answerAny(said("อายุ 85 ปีครับ"), null);
    expect(answer.messages.at(-1)!.text).toContain("ตัวแทน");
    expect(answer.replies).toBeUndefined();
  });

  /** "คุ้มครองถึงอายุ 99 ไหม" is a question about the contract, not a customer of ninety-nine. */
  it("does not read the contract's own age as the customer's", async () => {
    const answer = await answerAny(said("คุ้มครองถึงอายุ 99 ไหมครับ"), null);
    expect(answer.slots).not.toMatchObject({ age: 99 });
  });

  it("keeps everyone the message named, not just the first", async () => {
    // a family of three, the message that lost two of them yesterday
    const answer = await answerAny(said("ช 23\nญ 25\nช 53"), null);
    expect(answer.slots).toMatchObject({
      product: "undecided",
      people: [{ age: 23, sex: "M" }, { age: 25, sex: "F" }, { age: 53, sex: "M" }],
    });
  });

  it("prices all of them when the cover finally arrives, whatever the model calls the turn", async () => {
    const asked = await answerAny(said("ญ 34 / ช 33 / ช54"), null);
    // tapping the button settles the plan; the model reads it as a question about the plan
    routed = { intent: "plan_info" };
    const chose = await answerAny(said("🛡️ Life Protect x 2"), asked.slots);
    // and now the one thing that was missing, which the model reads as nothing in particular
    routed = { intent: "other" };
    const answer = await answerAny(said("ทุน1ล้าน"), chose.slots);
    expect(answer.priced).toBe(true);
    expect(answer.messages).toHaveLength(3);
    expect(answer.messages[0].card).toContain("age=34&sex=F");
    expect(answer.messages[1].card).toContain("age=33&sex=M");
    expect(answer.messages[2].card).toContain("age=54&sex=M");
  });

  it("prices all of them once the plan is settled", async () => {
    const asked = await answerAny(said("ช 23\nญ 25\nช 53"), null);
    routed = { intent: "quote", coverWanted: 1_000_000 };
    const answer = await answerAny(said("ประกันมรดก ทุน 1 ล้าน"), asked.slots);
    expect(answer.messages).toHaveLength(3);
    expect(answer.messages[0].card).toContain("age=23&sex=M");
    expect(answer.messages[2].card).toContain("age=53&sex=M");
  });

  it("is asked, with the four buttons, and no model is paid", async () => {
    const answer = await answerAny(said("สนใจค่ะ"), null);
    expect(answer.replies).toEqual([CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD, CHOOSE_HEALTH]);
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
