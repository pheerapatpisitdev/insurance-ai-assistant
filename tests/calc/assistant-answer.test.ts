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

const { answerQuestion } = await import("@/lib/assistant/lifeprotect/answer");
const { asksValueTable, lifeProtectVariantIn } = await import("@/lib/assistant/lifeprotect/route");
const { wantsToBuy } = await import("@/lib/assistant/common");
const { lifeProtectTable } = await import("@/lib/lifeprotect-table");
const { lifeProtectQuoteText } = await import("@/lib/lifeprotect-cta");
const { cashAt, deathBenefitOf, lifeProtectModes, termAt } = await import("@/lib/lifeprotect-quote");
const { formatBaht } = await import("@/calc/money");

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
    // two million reaching the family; before sixty that is a sum assured of one
    const SUM = 1_000_000;
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
    expect(answer.messages[0].card).toBe("/api/card?plan=LIFEPROTECT&variant=WLF99H&age=35&sex=M&sum=1000000");
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
    expect(answer.messages[0].text).toContain("ทุน 1,000,000 บาท");
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

  it("reads the advert's own million as a sum assured, the way its artwork does", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("สนใจประกันมรดก ทุน 1,000,000 ชาย 35"), null);
    expect(answer.messages[0].text).toContain("ทุน 1,000,000 บาท เพิ่มเป็น 2,000,000");
    expect(answer.messages[0].card).toContain("sum=1000000");
  });

  it("reads the customer's number as what the family receives, not as the sum assured", async () => {
    routed = { intent: "quote", age: 45, sex: "F", coverWanted: 3_000_000 };
    const answer = await answerQuestion(said("ทุน3ล้าน"), null);
    expect(answer.messages[0].text).toContain("ทุน 1,500,000 บาท เพิ่มเป็น 3,000,000");
    expect(answer.messages[0].card).toContain("sum=1500000");
  });

  it("does not halve for an insured the plan no longer doubles for", async () => {
    // past the booster age the cover is the sum assured, so there is nothing to divide by
    routed = { intent: "quote", age: 65, sex: "M", coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("อายุ 65 อยากให้ครอบครัวได้ 2 ล้าน"), null);
    expect(answer.messages[0].card).toContain("sum=2000000");
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

describe("asking how long the premium runs", () => {
  it("answers with the term on the table, not the quotation again", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(
      said("ต้องจ่ายถึงกี่ปี"),
      { intent: "quote", age: 30, sex: "F", coverWanted: 2_000_000, variant: "WLF09H" },
    );
    expect(answer.messages).toHaveLength(1);
    expect(answer.messages[0].text).toContain("จ่าย 9 ปี");
    expect(answer.messages[0].card).toBeUndefined();
    expect(answer.messages[0].text).not.toContain("มูลค่าเงินสดสะสม");
  });

  it("names all three when no term has been chosen", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("ต้องจ่ายกี่ปี"), null);
    expect(answer.messages[0].text).toContain("จ่าย 9 ปี");
    expect(answer.messages[0].text).toContain("จ่าย 19 ปี");
    expect(answer.messages[0].text).toContain("จ่ายถึงอายุ 99");
  });

  it("says the to-99 term keeps running, and offers the shorter ones", async () => {
    routed = { intent: "quote" };
    const answer = await answerQuestion(
      said("ต้องจ่ายนานแค่ไหน"),
      { intent: "quote", age: 30, sex: "F", coverWanted: 2_000_000, variant: "WLF99H" },
    );
    expect(answer.messages[0].text).toContain("จ่ายถึงอายุ 99");
    expect(answer.messages[0].text).toContain("9 ปี");
  });

  it("still prices a term the customer names outright", async () => {
    routed = { intent: "quote", age: 30, sex: "F", coverWanted: 2_000_000, variant: "WLF19H" };
    const answer = await answerQuestion(said("จ่าย 19 ปีเท่าไหร่"), null);
    expect(answer.priced).toBe(true);
    expect(answer.messages[0].card).toContain("variant=WLF19H");
  });
});

describe("leaving to think it over", () => {
  it("leaves the door open by name once a quotation is in hand, and asks nothing", async () => {
    chat.mockClear();
    const answer = await answerQuestion(said("เดี๋ยวคิดดูก่อนนะคะ"), { intent: "quote", age: 38, sex: "M", coverWanted: 2_000_000 });
    expect(answer.messages).toHaveLength(1);
    expect(answer.messages[0].text).toBe("ได้เลยครับ ถ้าตัดสินใจแล้วหรืออยากได้ใบเสนออย่างเป็นทางการ ทักมาได้เลยนะครับ");
    expect(chat).not.toHaveBeenCalled();
    expect(answer.slots.coverWanted).toBe(2_000_000);
  });

  it("just says come back when nothing has been priced", async () => {
    chat.mockClear();
    const answer = await answerQuestion(said("ไว้จะติดต่อกลับค่ะ"), null);
    expect(answer.messages[0].text).toBe("ได้เลยครับ สะดวกเมื่อไหร่ทักมาได้เลยนะครับ");
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("what the model is told about the plan", () => {
  it("carries no example premium that could be handed to a customer as their own", async () => {
    routed = { intent: "plan_info" };
    await answerQuestion(said("คุ้มครองยังไง"), null);
    const system = chat.mock.calls.at(-1)![0].messages[0].content as string;
    expect(system).toContain("Life Protect+ 100");
    expect(system).not.toContain("ตัวอย่าง");
    expect(system).not.toMatch(/\d,\d{3} ?บาท\/เดือน|เดือนละ \d/);
  });
});

describe("a couple written one to a line", () => {
  it("is priced even when the model could not read the turn", async () => {
    // the router's own fallback: no age, no sex, no people — the code reads them instead
    routed = { intent: "other" };
    const known = { intent: "quote" as const, coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("ญ40\nช49"), known);
    expect(answer.priced).toBe(true);
    expect(answer.messages).toHaveLength(2);
    expect(answer.messages[0].card).toContain("age=40&sex=F");
    expect(answer.messages[1].card).toContain("age=49&sex=M");
  });
});

describe("the buttons under a cheaper arrangement", () => {
  const known = { intent: "quote" as const, age: 35, sex: "M" as const, coverWanted: 2_000_000 };

  it("offer the smaller arrangement and the table", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไป"), known);
    expect(answer.replies).toEqual(["เอาแบบนี้", "ขอตารางมูลค่า"]);
  });

  it("take the offer when tapped, rather than hearing the title as a new complaint", async () => {
    routed = { intent: "other" };
    const offered = await answerQuestion(said("แพงไป"), known);
    const taken = await answerQuestion(said(offered.replies![0]), offered.slots);
    expect(taken.priced).toBe(true);
    expect(taken.messages[0].card).toContain("sum=500000");
  });
});

describe("the buttons under a quotation", () => {
  beforeEach(() => { routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 }; });

  it("offers the table, the terms not taken, and the way on", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    expect(answer.replies).toEqual(["ขอตารางมูลค่า", "จ่าย 9 ปี", "จ่าย 19 ปี", "สนใจสมัคร"]);
  });

  it("never offers the term the customer is already looking at", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000, variant: "WLF19H" };
    const answer = await answerQuestion(said("จ่าย 19 ปีเท่าไหร่"), null);
    expect(answer.replies).not.toContain("จ่าย 19 ปี");
    expect(answer.replies).toContain("จ่ายถึงอายุ 99");
  });

  it("says only what the bot can read back: a tap arrives as its own title", async () => {
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    for (const title of answer.replies!) {
      expect(title.length, title).toBeLessThanOrEqual(20);
      const heard = asksValueTable(title) || lifeProtectVariantIn(title) !== undefined || wantsToBuy(title, true);
      expect(heard, title).toBe(true);
    }
  });

  it("offers none when there was no price to put them under", async () => {
    routed = { intent: "quote", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("ขอเบี้ยหน่อย"), null);
    expect(answer.replies).toBeUndefined();
  });
});

describe("the value table", () => {
  const known = { intent: "quote" as const, age: 35, sex: "M" as const, coverWanted: 2_000_000 };

  it("is sent as a picture of the same contract the quotation priced", async () => {
    const answer = await answerQuestion(said("ขอตารางมูลค่าหน่อยครับ"), known);
    // the router reads the turn, but no model writes the words or the figures
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route"]);
    expect(answer.messages).toHaveLength(1);
    expect(answer.messages[0].card).toBe("/api/card/table?plan=LIFEPROTECT&variant=WLF99H&age=35&sex=M&sum=1000000");
    expect(answer.messages[0].text).toContain("ตารางมูลค่าทุกปี");
  });

  it("follows the term the customer is looking at", async () => {
    const answer = await answerQuestion(said("ขอตารางมูลค่า"), { ...known, variant: "WLF19H" });
    expect(answer.messages[0].card).toContain("variant=WLF19H");
  });

  it("keeps the halved offer's own sum once it has been taken", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    const taken = (await answerQuestion(said("เอา"), offered)).slots;
    const answer = await answerQuestion(said("ขอตารางมูลค่า"), taken);
    expect(answer.messages[0].card).toContain("sum=500000");
  });

  it("asks for what it is missing rather than drawing a table of nothing", async () => {
    const answer = await answerQuestion(said("ขอตารางมูลค่า"), null);
    expect(answer.messages[0].card).toBeUndefined();
  });
});

describe("deciding to buy", () => {
  const FORM = "https://ktaxaform.vercel.app/?ref=sa-9f3a";
  const quoted = { intent: "quote" as const, age: 38, sex: "M" as const, coverWanted: 2_000_000 };

  it("hands over the application form, in the agency's own words, without a model", async () => {
    const answer = await answerQuestion(said("เอาแผนนี้ครับ"), quoted);
    expect(chat).not.toHaveBeenCalled();
    expect(answer.messages.map((m) => m.text)).toEqual([
      "ยินดีครับ 😊 รบกวนกรอกข้อมูลตามฟอร์มนี้ได้เลยครับ",
      FORM,
      "กรอกเสร็จแล้วแจ้งในแชทนี้ได้เลย เดี๋ยวตัวแทนติดต่อกลับไปดูแลขั้นตอนต่อให้ครับ",
    ]);
    expect(answer.slots.formSent).toBe(true);
    expect(answer.slots.coverWanted).toBe(2_000_000);
  });

  it("does the same for someone asking what to do next", async () => {
    const answer = await answerQuestion(said("ต้องทำยังไงต่อ"), quoted);
    expect(chat).not.toHaveBeenCalled();
    expect(answer.messages[1].text).toBe(FORM);
  });

  it("reads ตกลง after a quotation as a decision", async () => {
    const answer = await answerQuestion(said("ตกลงค่ะ"), quoted);
    expect(chat).not.toHaveBeenCalled();
    expect(answer.messages[1].text).toBe(FORM);
  });

  it("still lets a pending cheaper offer be taken by ตกลง first", async () => {
    const offered = (await answerQuestion(said("แพงไป"), quoted)).slots;
    const taken = await answerQuestion(said("ตกลง"), offered);
    expect(taken.priced).toBe(true);
    expect(taken.slots.formSent).toBeUndefined();
  });

  it("offers the premium too when nothing has been priced yet", async () => {
    const answer = await answerQuestion(said("สมัครยังไงคะ"), null);
    expect(chat).not.toHaveBeenCalled();
    expect(answer.messages[1].text).toBe(FORM);
    expect(answer.messages[2].text).toBe("กรอกเสร็จแล้วแจ้งในแชทนี้ได้เลย เดี๋ยวตัวแทนติดต่อกลับไปดูแลขั้นตอนต่อให้ครับ ถ้าอยากทราบเบี้ยก่อน บอกเพศกับอายุมาได้เลยครับ เดี๋ยวคิดให้");
  });

  it("acknowledges a filled-in form without promising anything", async () => {
    const answer = await answerQuestion(said("กรอกแล้วครับ"), { ...quoted, formSent: true });
    expect(chat).not.toHaveBeenCalled();
    expect(answer.messages).toHaveLength(1);
    expect(answer.messages[0].text).toBe("ขอบคุณครับ 🙏 เดี๋ยวตัวแทนเช็กข้อมูลแล้วติดต่อกลับในแชทนี้ครับ");
    expect(answer.slots.formSent).toBe(true);
  });

  it("does not read กรอกแล้ว as the form when no form was sent", async () => {
    const answer = await answerQuestion(said("กรอกแล้วครับ"), quoted);
    expect(answer.messages[0].text).not.toContain("เช็กข้อมูล");
  });
});

describe("the price being too much", () => {
  const known = { intent: "quote" as const, age: 38, sex: "M" as const, coverWanted: 2_000_000 };
  const monthlyFor = (variant: string, sum: number) => {
    const table = lifeProtectTable();
    const m = lifeProtectModes(table, termAt(table, variant), { sex: "M", age: 38, sumAssured: sum })!;
    return formatBaht(m.find((x) => x.mode === "monthly")!.total);
  };

  it("shows the halved premium exactly as the quotation will, half-baht and all", async () => {
    routed = { intent: "other" };
    const offered = await answerQuestion(said("แพงไป"), known);
    routed = { intent: "other" };
    const taken = await answerQuestion(said("เอา"), offered.slots);
    // 9,550 a year is 859.50 a month; the quotation floors it and so must the offer
    const shown = offered.messages[0].text.match(/ประมาณ ([\d,]+) บาท\/เดือน/)![1];
    expect(taken.messages[0].text).toContain(`รายเดือน ${shown} บาท`);
  });

  it("names the to-99 term as the cheapest by the year, and offers half the cover with a real figure", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไปหน่อย มีถูกกว่านี้ไหม"), known);
    const text = answer.messages[0].text;
    expect(text).toContain("ถูกที่สุดแล้ว");
    expect(text).toContain("ทุน 500,000 บาท (ครอบครัวได้รับ 1,000,000)");
    expect(text).toContain(`${monthlyFor("WLF99H", 500_000)} บาท/เดือน`);
    expect(answer.slots.offer).toEqual({ coverWanted: 1_000_000, sumAssured: 500_000, variant: "WLF99H" });
    expect(answer.messages[0].card).toBeUndefined();
  });

  it("does not offer the shorter terms, which cost more a year", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไป"), known);
    expect(answer.messages[0].text).not.toContain("จ่าย 9 ปี");
    expect(answer.messages[0].text).not.toContain("จ่าย 19 ปี");
  });

  it("points someone on a short term at the to-99 premium for the same cover", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไปหน่อย"), { ...known, variant: "WLF09H" });
    expect(answer.messages[0].text).toContain("จ่ายถึงอายุ 99");
    expect(answer.messages[0].text).toContain(`${monthlyFor("WLF99H", 1_000_000)} บาท/เดือน`);
  });

  it("prices the halved arrangement on a bare yes", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    const taken = await answerQuestion(said("เอา"), offered);
    expect(taken.priced).toBe(true);
    expect(taken.messages[0].card).toContain("sum=500000");
    expect(taken.messages[0].card).toContain("variant=WLF99H");
  });

  it("takes the offer once: a second yes is the decision to buy, not the same quotation again", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    const first = await answerQuestion(said("โอเค"), offered);
    expect(first.priced).toBe(true);
    expect(first.slots.offer).toBeUndefined();
    const second = await answerQuestion(said("ตกลง"), first.slots);
    expect(second.priced).toBeFalsy();
    expect(second.messages[1].text).toBe("https://ktaxaform.vercel.app/?ref=sa-9f3a");
    expect(second.slots.takenSum).toBe(first.slots.takenSum);
  });

  it("still remembers the taken sum when a later follow-up names the same cover", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    const taken = (await answerQuestion(said("เอา"), offered)).slots;
    routed = { intent: "quote", variant: "WLF19H" };
    const again = await answerQuestion(said("จ่าย 19 ปีล่ะ"), taken);
    expect(again.messages[0].card).toContain("sum=500000");
  });

  it("drops the offer when the customer steps back", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    const left = await answerQuestion(said("เดี๋ยวคิดดูก่อน"), offered);
    expect(left.slots.offer).toBeUndefined();
  });

  it("keeps the offer's own sum when the customer names its cover, despite the one-million rule", async () => {
    routed = { intent: "other" };
    const offered = (await answerQuestion(said("แพงไป"), known)).slots;
    // "1 ล้าน" alone would be read as a sum assured of a million; after the offer it is the offer
    routed = { intent: "quote", coverWanted: 1_000_000 };
    const taken = await answerQuestion(said("เอาแบบ 1 ล้าน"), offered);
    expect(taken.messages[0].card).toContain("sum=500000");
  });

  it("says so when the cover is already at the floor", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไป"), { intent: "quote", age: 38, sex: "M", coverWanted: 300_000 });
    expect(answer.messages[0].text).toContain("ขั้นต่ำ");
    expect(answer.slots.offer).toBeUndefined();
  });

  it("asks for the details first when nothing has been priced", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("แพงไป"), null);
    expect(answer.messages[0].text).toContain("อายุ");
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
    expect(answer.messages[0].text).not.toContain("ถ้าอยากดูแบบ");
    expect(answer.messages[1].text).toContain("ถ้าอยากดูแบบ");
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

  it("tells the model what the customer already gave, so it stops asking", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(
      said("เบี้ยประกันคงที่ไหมคะ"),
      { intent: "quote", age: 30, sex: "F", coverWanted: 2_000_000, variant: "WLF09H" },
    );
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).toContain("หญิง · อายุ 30 ปี · ครอบครัวได้รับ 2,000,000 บาท · จ่าย 9 ปี");
    expect(system).toContain("ห้ามขอข้อมูลที่ทราบแล้วซ้ำอีก");
  });

  it("puts the engine's own premium in front of the model, so it cannot invent one", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(
      said("เบี้ยประกันคงที่ไหมคะ"),
      { intent: "quote", age: 30, sex: "F", coverWanted: 2_000_000, variant: "WLF09H" },
    );
    const system = chat.mock.calls[1][0].messages[0].content as string;
    // the figures the quotation actually carried, not a rounding of them
    expect(system).toContain("รายเดือน 3,861 บาท");
    expect(system).toContain("รายปี 42,900 บาท");
    expect(system).toContain("ห้ามคำนวณเอง");
    // and what staying to the end pays, which the model had been guessing
    expect(system).toContain("อยู่ครบสัญญาถึงอายุ 99 รับเงินคืน 1,000,000 บาท");
  });

  it("splits a model's paragraphs into bubbles without ever sending an empty one", async () => {
    routed = { intent: "plan_info" };
    worded = "บรรทัดหนึ่งครับ\n\nบรรทัดสองครับ";
    const two = await answerQuestion(said("คุ้มครองยังไง"), null);
    expect(two.messages.map((m) => m.text)).toEqual(["บรรทัดหนึ่งครับ", "บรรทัดสองครับ"]);

    worded = "หนึ่ง\n\nสอง\n\nสาม\n\nสี่\n\nห้า";
    const many = await answerQuestion(said("คุ้มครองยังไง"), null);
    expect(many.messages).toHaveLength(3);
    expect(many.messages[2].text).toBe("สาม\n\nสี่\n\nห้า");
    expect(many.messages.every((m) => m.text.trim().length > 0)).toBe(true);
  });

  it("forbids figures outright until something has been priced", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(said("คุ้มครองยังไง"), { intent: "quote", coverWanted: 2_000_000 });
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).toContain("ห้ามตอบตัวเลขเบี้ยเอง");
    expect(system).not.toContain("รายเดือน");
  });

  it("asks only for the gaps when the customer is half known", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(said("คุ้มครองยังไง"), { intent: "quote", coverWanted: 2_000_000 });
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).toContain("ครอบครัวได้รับ 2,000,000 บาท");
    expect(system).toContain("ให้ขอเฉพาะข้อมูลที่ยังขาด");
  });

  it("says nothing about a customer it knows nothing about", async () => {
    routed = { intent: "plan_info" };
    chat.mockClear();
    await answerQuestion(said("คุ้มครองยังไง"), null);
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).not.toContain("ข้อมูลของลูกค้ารายนี้ที่ทราบแล้ว");
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

  it("tells small talk what the customer already gave, so a goodbye is not an intake form", async () => {
    routed = { intent: "other" };
    chat.mockClear();
    // a stall never reaches the model now; a thank-you still does
    await answerQuestion(said("ขอบคุณค่ะ"), { intent: "quote", age: 38, sex: "M", coverWanted: 2_000_000 });
    const system = chat.mock.calls[1][0].messages[0].content as string;
    expect(system).toContain("ชาย · อายุ 38 ปี · ครอบครัวได้รับ 2,000,000 บาท");
    expect(system).toContain("ห้ามขอข้อมูลที่ทราบแล้วซ้ำอีก");
  });

  it("falls back to asking for the details when the model says nothing", async () => {
    routed = { intent: "other" };
    worded = "   ";
    const answer = await answerQuestion(said("..."), null);
    expect(answer.messages[0].text).toContain("อายุ");
  });
});

describe("what the turn leaves for the record", () => {
  const kinds = (trace: { kind: string }[] | undefined) => (trace ?? []).map((t) => t.kind);

  it("writes the premium down exactly as the engine made it", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("ชาย 35 ล้านนึง"), null);
    const table = lifeProtectTable();
    const modes = lifeProtectModes(table, termAt(table, "WLF99H"), { sex: "M", age: 35, sumAssured: 1_000_000 })!;
    expect(kinds(answer.trace)).toEqual(["routed", "quoted"]);
    const quoted = answer.trace!.find((t) => t.kind === "quoted")!;
    expect(quoted.data).toMatchObject({ planCode: "LIFEPROTECT", variant: "WLF99H", age: 35, sex: "M", sumAssured: 1_000_000, coverWanted: 1_000_000, people: 1 });
    expect(quoted.data!.monthly).toBe(modes.find((m) => m.mode === "monthly")!.total / 100);
    expect(quoted.data!.annual).toBe(modes.find((m) => m.mode === "annual")!.total / 100);
  });

  it("says why there was no price, and hands over, for an age the plan does not issue to", async () => {
    routed = { intent: "quote", age: 95, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerQuestion(said("อายุ 95 ทุนล้าน"), null);
    expect(kinds(answer.trace)).toEqual(["routed", "no_price", "handover"]);
    expect(answer.trace![1].data).toMatchObject({ reason: "out_of_range", age: 95 });
  });

  it("puts the lead code on the form link and in the record", async () => {
    const quoted = { intent: "quote" as const, age: 38, sex: "M" as const, coverWanted: 2_000_000 };
    const answer = await answerQuestion(said("เอาแผนนี้ครับ"), quoted, { formRef: "abc123def4" });
    expect(answer.messages[1].text).toBe("https://ktaxaform.vercel.app/?ref=sa-9f3a&lead=abc123def4");
    expect(answer.trace).toEqual([{ kind: "form_sent", data: { had_quote: true, form_ref: "abc123def4" } }]);
  });

  it("leaves the form link bare when it has no conversation to tie it to", async () => {
    const answer = await answerQuestion(said("สมัครยังไงคะ"), null);
    expect(answer.messages[1].text).toBe("https://ktaxaform.vercel.app/?ref=sa-9f3a");
    expect(answer.trace).toEqual([{ kind: "form_sent", data: { had_quote: false } }]);
  });

  it("names the written answer it gave, and hands a condition to a person", async () => {
    routed = { intent: "other" };
    const answer = await answerQuestion(said("เป็นเบาหวานทำได้ไหม"), null);
    expect(kinds(answer.trace)).toEqual(["routed", "faq", "handover"]);
    expect(answer.trace![1].data).toEqual({ key: "health" });
    expect(answer.trace![2].data).toEqual({ reason: "health" });
  });

  it("keeps the model's rewrite of a question it had to answer itself, and only the rewrite", async () => {
    routed = { intent: "plan_info", question: "แบบประกันนี้มีมูลค่าเวนคืนไหม" };
    const rewritten = await answerQuestion(said("เวนคืนได้มั้ย"), null);
    expect(rewritten.trace!.at(-1)).toEqual({ kind: "plan_info", question: "แบบประกันนี้มีมูลค่าเวนคืนไหม" });
    routed = { intent: "plan_info" };
    const verbatim = await answerQuestion(said("เวนคืนได้มั้ย"), null);
    expect(verbatim.trace!.at(-1)).toEqual({ kind: "plan_info", question: undefined });
  });

  it("never files the customer's own words among the figures", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const token = "ZQXV-เฉพาะคนนี้";
    const answer = await answerQuestion(said(`ชาย 35 ล้านนึง ${token}`), null);
    expect(JSON.stringify(answer.trace!.map((t) => t.data ?? {}))).not.toContain(token);
  });

  it("records the customer stepping back, and whether they had a price in hand", async () => {
    const answer = await answerQuestion(said("ขอคิดดูก่อนนะคะ"), { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 });
    expect(answer.trace).toEqual([{ kind: "stalled", data: { had_quote: true } }]);
  });
});
