import { describe, it, expect } from "vitest";
import { asksPensionPrice, pensionNamedIn, pricePension } from "@/lib/copilot/pension-price";
import { answerAny } from "@/lib/assistant/dispatch";
import { quotePension } from "@/calc/pension/engine";

/** The premium the /bumnan95 page shows for the same person, so the chat cannot drift from it. */
function onThePage(age: number, sex: "M" | "F", annuityAge: number, pay: "6" | "untilAnnuity", monthly: number) {
  const r = quotePension({ age, sex, annuityAge, pay, mode: "annual", basis: "monthlyPension", amount: monthly });
  if (!r.ok) throw new Error(r.error);
  return Math.floor(r.quote.annualPremium).toLocaleString("en-US");
}

describe("บำนาญ สมาร์ท 95 in the chat", () => {
  it("prices a monthly income, the way the plan is sold", () => {
    const reply = pricePension("บำนาญ ชาย 40 อยากได้เดือนละ 10,000 รับบำนาญ 60 จ่ายจนรับบำนาญ");
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain(`💰 เบี้ยปีละ **${onThePage(40, "M", 60, "untilAnnuity", 10_000)} บาท**`);
    expect(reply.text).toContain("ทุน 787,402 บาท");
    expect(reply.text).toContain("เดือนละ **10,000 บาท**");
  });

  it("does not read the 95 in the name as the customer's age", () => {
    const reply = pricePension("บำนาญ สมาร์ท 95 ชาย 40 เดือนละ 1 หมื่น เริ่มรับ 60 จ่าย 6 ปี");
    expect(reply.priced).toBe(true);
    expect(reply.text).toContain("ชาย อายุ 40 ปี");
    expect(reply.text).toContain(`💰 เบี้ยปีละ **${onThePage(40, "M", 60, "6", 10_000)} บาท**`);
  });

  it("reads a premium written with จ่าย as a premium, not a pension", () => {
    const reply = pricePension("บำนาญ หญิง 35 จ่ายปีละ 100,000 รับบำนาญ 60 จ่ายจนรับบำนาญ");
    expect(reply.priced).toBe(true);
    const r = quotePension({ age: 35, sex: "F", annuityAge: 60, pay: "untilAnnuity", mode: "annual", basis: "premium", amount: 100_000 });
    if (!r.ok) throw new Error(r.error);
    expect(reply.text).toContain(`ทุน ${r.quote.sumAssured.toLocaleString("en-US")} บาท`);
  });

  it("asks for the paying term rather than guessing it, and offers both as buttons", () => {
    const reply = pricePension("บำนาญ ชาย 40 เดือนละ 10,000 รับบำนาญ 60");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("6 ปี");
    const asks = reply.guide!.map((g) => g.ask);
    // each button carries everything already said, so pressing it prices
    for (const a of asks) expect(pricePension(a).priced, a).toBe(true);
  });

  it("offers only the pension ages this person can still choose", () => {
    const reply = pricePension("บำนาญ ชาย 52 เดือนละ 10,000 จ่ายจนรับบำนาญ");
    expect(reply.priced).toBe(false);
    expect(reply.guide!.map((g) => g.label)).toEqual(["รับบำนาญอายุ 60", "รับบำนาญอายุ 65", "รับบำนาญอายุ 70"]);
  });

  it("does not take 'ตอนนี้อายุ 55' for the age the pension starts", () => {
    const reply = pricePension("บำนาญ ผู้ชาย ตอนนี้อายุ 55 เดือนละ 10,000 จ่ายจนรับบำนาญ");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("เริ่มรับบำนาญอายุเท่าไหร่");
  });

  it("passes on the engine's refusal", () => {
    const reply = pricePension("บำนาญ ชาย 50 เดือนละ 10,000 รับบำนาญ 55 จ่ายจนรับบำนาญ");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("เลือกรับบำนาญอายุ 55 ไม่ได้");
  });

  it("leaves a question about the rules to the library", () => {
    expect(pensionNamedIn("บำนาญ 95 ลดหย่อนภาษีได้ไหม")).toBe(true);
    expect(asksPensionPrice("บำนาญ 95 ลดหย่อนภาษีได้ไหม")).toBe(false);
  });

  it("is answered by the dispatcher even inside a Life Protect conversation", async () => {
    const answer = await answerAny(
      [{ role: "user", content: "บำนาญ ชาย 40 เดือนละ 10,000 รับบำนาญ 60 จ่ายจนรับบำนาญ" }],
      { product: "lifeprotect" } as never,
    );
    expect(answer.priced).toBe(true);
    expect(answer.messages[0].text).toContain("บำนาญ สมาร์ท 95");
    // the conversation it interrupted is still there
    expect(answer.slots).toEqual({ product: "lifeprotect" });
  });
});

describe("บำนาญ สมาร์ท 95 in the library", () => {
  it("sends its rules when the question names it, and only then", async () => {
    const { assembleKnowledge } = await import("@/lib/copilot/knowledge");
    expect(await assembleKnowledge("บำนาญ 95 รับประกันจ่ายกี่ปี")).toContain("รับประกันจ่ายบำนาญ 15 ปีแรก");
    const other = await assembleKnowledge("PLB รับประกันถึงอายุเท่าไหร่");
    expect(other).not.toContain("รับประกันจ่ายบำนาญ 15 ปีแรก");
    // but the spine still says it can be priced here
    expect(other).toContain("บำนาญ สมาร์ท 95");
  });
});
