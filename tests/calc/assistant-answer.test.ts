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
  beforeEach(() => { routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 }; });

  it("says exactly what the sales page would say", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    const table = lifeProtectTable();
    const term = termAt(table, "WLF99H");
    // the customer asked for a million reaching the family; before sixty that is a sum of half
    const SUM = 500_000;
    const expected = lifeProtectQuoteText({
      sumAssured: SUM,
      termLabel: term.label,
      age: 35,
      sex: "M",
      modes: lifeProtectModes(table, term, { sex: "M", age: 35, sumAssured: SUM })!,
      death: deathBenefitOf(table, 35, SUM),
      cash: cashAt(term, "M", 35, SUM, table.ageMin),
    });
    expect(answer.messages[0].text).toContain(expected);
    expect(answer.priced).toBe(true);
  });

  it("asks a model to read the message, never to word the price", async () => {
    await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(chat).toHaveBeenCalledOnce();
    expect(chat.mock.calls[0][0].task).toBe("route");
  });

  it("sends a card of the same arrangement", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.messages[0].card).toBe("/api/card?plan=LIFEPROTECT&variant=WLF99H&age=35&sex=M&sum=500000");
  });

  it("offers the two terms it did not quote", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.messages[0].text).toContain("จ่าย 9 ปี");
    expect(answer.messages[0].text).toContain("จ่าย 19 ปี");
  });

  it("quotes the term the customer named", async () => {
    const answer = await answerQuestion(said("จ่าย 19 ปีเท่าไหร่"), { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 });
    expect(answer.messages[0].text).toContain("จ่าย 19 ปี");
    expect(answer.messages[0].card).toContain("variant=WLF19H");
  });

  it("keeps the age and sum from the turn before", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(said("จ่าย 9 ปีล่ะ"), { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 });
    expect(answer.messages[0].card).toContain("variant=WLF09H");
    expect(answer.priced).toBe(true);
  });

  it("asks for what it is missing instead of guessing", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(said("ขอราคาหน่อย"), null);
    expect(answer.messages[0].text).toContain("อายุ");
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
  });

  it("repeats the sum the advert's button named, and asks only for what is missing", async () => {
    routed = { intent: "quote", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("สนใจประกันมรดก ทุน 1,000,000"), null);
    expect(answer.messages[0].text).toContain("ครอบครัวได้รับ 1,000,000 บาท");
    expect(answer.messages[0].text).toContain("เพศ");
    expect(answer.messages[0].text).toContain("อายุ");
    expect(answer.messages[0].text).not.toContain("ทุนประกันที่สนใจ");
    expect(answer.messages[0].card).toBeUndefined();
  });

  it("asks for the one field left when the rest is known", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(said("ชาย"), { intent: "quote", sex: "M", coverWanted: 1_000_000 });
    expect(answer.messages[0].text).toContain("อายุ");
    expect(answer.messages[0].text).not.toContain("เพศ");
  });

  it("says no price at all for an age the plan does not issue to", async () => {
    routed = { intent: "quote", age: 95, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("อายุ 95 ทุนล้าน"), null);
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
    expect(answer.messages[0].text).toContain("อายุ");
  });

  it("states the floor as what the family would receive, not as a sum assured", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 50_000 };
    const answer = await answerQuestion(said("ทุน 5 หมื่น"), null);
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
    expect(answer.messages[0].text).toContain("300,000");
  });

  it("reads the customer's number as what the family receives, not as the sum assured", async () => {
    routed = { intent: "quote", age: 45, sex: "F", coverWanted: 3_000_000 };
    const answer = await answerQuestion(said("ทุน3ล้าน"), null);
    expect(answer.messages[0].text).toContain("ทุน 1,500,000 บาท เพิ่มเป็น 3,000,000");
    expect(answer.messages[0].card).toContain("sum=1500000");
  });

  it("does not halve for an insured the plan no longer doubles for", async () => {
    routed = { intent: "quote", age: 65, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("อายุ 65 ทุนล้าน"), null);
    expect(answer.messages[0].card).toContain("sum=1000000");
  });

  it("turns down a package this chat does not sell, rather than quoting another one", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("แบบ x 1.5 จ่าย 9 ปี"), null);
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
    expect(answer.messages[0].text).toContain("x 2");
  });
});

describe("who stands behind the policy", () => {
  it("names the insurer rather than agreeing with whatever the customer guessed", async () => {
    routed = { intent: "other" };
    worded = "ใช่ครับ ยินดีให้บริการครับ";
    const answer = await answerQuestion(said("กรุงไทยแอกซ่าใช่ไหม"), null);
    expect(answer.messages[0].text).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    expect(answer.messages[0].text).not.toContain("ยินดีให้บริการ");
  });

  it("corrects a rival's name instead of confirming it", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("เมืองไทยประกันชีวิตใช่ไหมครับ"), null);
    expect(answer.messages[0].text).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
  });

  it("names both licensed agents, and never their national ids", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("ของบริษัทอะไรครับ"), null);
    expect(answer.messages[0].text).toContain("6001028534");
    expect(answer.messages[0].text).toContain("6401024117");
    expect(answer.messages[0].text).toContain("คปภ.");
    // the question was answered; it does not then ask for details it may already have
    expect(answer.messages[0].text).not.toContain("บอกเพศกับอายุ");
    // the licences carry a national id beside the number; it must never reach a customer
    expect(answer.messages[0].text).not.toMatch(/\b1[0-9]{12}\b/);
  });

  it("names the insurer and leaves the licence to a person", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("มีใบอนุญาตตัวแทนไหม บริษัทน่าเชื่อถือหรือเปล่า"), null);
    expect(answer.messages[0].text).toContain("กรุงไทย-แอกซ่า ประกันชีวิต");
    expect(answer.messages[0].text).toContain("ใบอนุญาต");
  });

  it("never asks a model who the insurer is", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(said("ของบริษัทอะไรครับ"), null);
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route"]);
  });

  it("still prices a quote that merely mentions a rival by name", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.priced).toBe(true);
  });
});

describe("a couple in one message", () => {
  it("prices each of them, in the order they were named", async () => {
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("ผญ 32 ผช33ค่ะ"), null);
    expect(answer.messages).toHaveLength(2);
    expect(answer.messages[0].text).toContain("หญิง อายุ 32");
    expect(answer.messages[1].text).toContain("ชาย อายุ 33");
    expect(answer.messages[0].card).toContain("age=32&sex=F");
    expect(answer.messages[1].card).toContain("age=33&sex=M");
    expect(answer.priced).toBe(true);
  });

  it("offers the other terms once, under the last price", async () => {
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("42 ญ กับช 56"), null);
    expect(answer.messages[0].text).not.toContain("สนใจแบบ");
    expect(answer.messages[1].text).toContain("สนใจแบบ");
  });

  it("prices the one it can when the other is out of range", async () => {
    routed = { intent: "quote", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("ญ 37 กับ ช 95"), null);
    expect(answer.messages[0].card).toBeDefined();
    expect(answer.messages[1].card).toBeUndefined();
    expect(answer.messages[1].text).toContain("95");
  });
});

describe("a question asked alongside a price", () => {
  it("is answered after the quote, not instead of it", async () => {
    routed = { intent: "quote", age: 37, sex: "F", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("ญ 37 ลดหย่อนภาษีได้ไหม"), null);
    expect(answer.messages).toHaveLength(2);
    expect(answer.messages[0].card).toBeDefined();
    expect(answer.messages[1].text).toContain("100,000");
  });
});

describe("everything else", () => {
  it("answers a question about the plan in the model's words", async () => {
    routed = { intent: "plan_info" };
    worded = "คุ้มครองถึงอายุ 99 ปีครับ";
    const answer = await answerQuestion(said("คุ้มครองถึงกี่ขวบ"), null);
    expect(answer.messages[0].text).toBe("คุ้มครองถึงอายุ 99 ปีครับ");
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
    expect(answer.messages[0].text).toBe("สวัสดีครับ");
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
  });

  it("falls back to asking for the details when the model says nothing", async () => {
    routed = { intent: "other" };
    worded = "   ";
    const answer = await answerQuestion(said("..."), null);
    expect(answer.messages[0].text).toContain("อายุ");
  });
});
