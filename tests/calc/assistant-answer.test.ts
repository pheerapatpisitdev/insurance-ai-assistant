import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/** What the stubbed model returns: strict JSON to the router, prose to everything else. */
let routed: Record<string, unknown> = { intent: "other" };
let worded = "ยินดีครับ";

const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task === "route" ? JSON.stringify(routed) : worded,
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerQuestion } = await import("@/lib/assistant/answer");
const { lifeProtectTable } = await import("@/lib/lifeprotect-table");
const { lifeProtectQuoteText } = await import("@/lib/lifeprotect-cta");
const { cashAt, deathBenefitOf, lifeProtectModes, termAt } = await import("@/lib/lifeprotect-quote");

const said = (content: string) => [{ role: "user" as const, content }];

beforeEach(() => {
  chat.mockClear();
  routed = { intent: "other" };
  worded = "ยินดีครับ";
});

describe("a quote", () => {
  beforeEach(() => { routed = { intent: "quote", age: 35, sex: "M", sumAssured: 1_000_000 }; });

  it("says exactly what the sales page would say", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    const table = lifeProtectTable();
    const term = termAt(table, "WLF99H");
    const expected = lifeProtectQuoteText({
      sumAssured: 1_000_000,
      termLabel: term.label,
      age: 35,
      sex: "M",
      modes: lifeProtectModes(table, term, { sex: "M", age: 35, sumAssured: 1_000_000 })!,
      death: deathBenefitOf(table, 35, 1_000_000),
      cash: cashAt(term, "M", 35, 1_000_000, table.ageMin),
    });
    expect(answer.reply).toContain(expected);
    expect(answer.priced).toBe(true);
  });

  it("asks a model to read the message, never to word the price", async () => {
    await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(chat).toHaveBeenCalledOnce();
    expect(chat.mock.calls[0][0].task).toBe("route");
  });

  it("sends a card of the same arrangement", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.card).toBe("/api/card?plan=LIFEPROTECT&variant=WLF99H&age=35&sex=M&sum=1000000");
  });

  it("offers the two terms it did not quote", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.reply).toContain("จ่าย 9 ปี");
    expect(answer.reply).toContain("จ่าย 19 ปี");
  });

  it("quotes the term the customer named", async () => {
    const answer = await answerQuestion(said("จ่าย 19 ปีเท่าไหร่"), { intent: "quote", age: 35, sex: "M", sumAssured: 1_000_000 });
    expect(answer.reply).toContain("จ่าย 19 ปี");
    expect(answer.card).toContain("variant=WLF19H");
  });

  it("keeps the age and sum from the turn before", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(said("จ่าย 9 ปีล่ะ"), { intent: "quote", age: 35, sex: "M", sumAssured: 1_000_000 });
    expect(answer.card).toContain("variant=WLF09H");
    expect(answer.priced).toBe(true);
  });

  it("asks for what it is missing instead of guessing", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(said("ขอราคาหน่อย"), null);
    expect(answer.reply).toContain("อายุ");
    expect(answer.card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
  });

  it("repeats the sum the advert's button named, and asks only for what is missing", async () => {
    routed = { intent: "quote", sumAssured: 1_000_000 };
    const answer = await answerQuestion(said("สนใจประกันมรดก ทุน 1,000,000"), null);
    expect(answer.reply).toContain("1,000,000");
    expect(answer.reply).toContain("เพศ");
    expect(answer.reply).toContain("อายุ");
    expect(answer.reply).not.toContain("ทุนประกันที่สนใจ");
    expect(answer.card).toBeUndefined();
  });

  it("asks for the one field left when the rest is known", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(said("ชาย"), { intent: "quote", sex: "M", sumAssured: 1_000_000 });
    expect(answer.reply).toContain("อายุ");
    expect(answer.reply).not.toContain("เพศ");
  });

  it("says no price at all for an age the plan does not issue to", async () => {
    routed = { intent: "quote", age: 95, sex: "M", sumAssured: 1_000_000 };
    const answer = await answerQuestion(said("อายุ 95 ทุนล้าน"), null);
    expect(answer.card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
    expect(answer.reply).toContain("อายุ");
  });

  it("says no price at all for a sum under the plan's floor", async () => {
    routed = { intent: "quote", age: 35, sex: "M", sumAssured: 50_000 };
    const answer = await answerQuestion(said("ทุน 5 หมื่น"), null);
    expect(answer.card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
    expect(answer.reply).toContain("ขั้นต่ำ");
  });

  it("turns down a package this chat does not sell, rather than quoting another one", async () => {
    routed = { intent: "quote", age: 35, sex: "M", sumAssured: 1_000_000 };
    const answer = await answerQuestion(said("แบบ x 1.5 จ่าย 9 ปี"), null);
    expect(answer.card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
    expect(answer.reply).toContain("x 2");
  });
});

describe("who stands behind the policy", () => {
  it("names the insurer rather than agreeing with whatever the customer guessed", async () => {
    routed = { intent: "other" };
    worded = "ใช่ครับ ยินดีให้บริการครับ";
    const answer = await answerQuestion(said("กรุงไทยแอกซ่าใช่ไหม"), null);
    expect(answer.reply).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    expect(answer.reply).not.toContain("ยินดีให้บริการ");
  });

  it("corrects a rival's name instead of confirming it", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("เมืองไทยประกันชีวิตใช่ไหมครับ"), null);
    expect(answer.reply).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
  });

  it("names the insurer and leaves the licence to a person", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("มีใบอนุญาตตัวแทนไหม บริษัทน่าเชื่อถือหรือเปล่า"), null);
    expect(answer.reply).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    expect(answer.reply).toContain("ใบอนุญาต");
  });

  it("never asks a model who the insurer is", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(said("ของบริษัทอะไรครับ"), null);
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route"]);
  });

  it("still prices a quote that merely mentions a rival by name", async () => {
    routed = { intent: "quote", age: 35, sex: "M", sumAssured: 1_000_000 };
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.priced).toBe(true);
  });
});

describe("everything else", () => {
  it("answers a question about the plan in the model's words", async () => {
    routed = { intent: "plan_info" };
    worded = "คุ้มครองถึงอายุ 99 ปีครับ";
    const answer = await answerQuestion(said("คุ้มครองถึงกี่ขวบ"), null);
    expect(answer.reply).toBe("คุ้มครองถึงอายุ 99 ปีครับ");
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route", "plan_info"]);
  });

  it("hands the plan's own figures to the model rather than letting it recall them", async () => {
    routed = { intent: "plan_info" };
    await answerQuestion(said("คุ้มครองถึงกี่ขวบ"), null);
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).toContain("Life Protect+ 100");
    expect(system).toContain("ห้ามคิดตัวเลขเอง");
  });

  it("greets without pricing anything", async () => {
    routed = { intent: "other" };
    worded = "สวัสดีครับ";
    const answer = await answerQuestion(said("สวัสดี"), null);
    expect(answer.reply).toBe("สวัสดีครับ");
    expect(answer.card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
  });

  it("falls back to asking for the details when the model says nothing", async () => {
    routed = { intent: "other" };
    worded = "   ";
    const answer = await answerQuestion(said("..."), null);
    expect(answer.reply).toContain("อายุ");
  });
});
