import { beforeEach, describe, expect, it, vi } from "vitest";

const reply = { text: "", model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0 };
const chat = vi.fn(async () => reply);

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { affirms, ageFromBirthdate, asksCheaper, mergeSlots, routeMessage, stalls, wantsToBuy, saysFormDone } = await import("@/lib/assistant/route");

/** The age someone born on that date is today, counted the way a person counts it. */
function ageOn(today: Date, day: number, month: number, year: number): number {
  const passed = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);
  return today.getFullYear() - year - (passed ? 0 : 1);
}

const said = (content: string) => [{ role: "user" as const, content }];

beforeEach(() => { chat.mockClear(); });

describe("reading what the customer wants", () => {
  it("reads an age, a sex and a sum out of one line", async () => {
    reply.text = JSON.stringify({ intent: "quote", age: 35, sex: "M", coverWanted: 1000000 });
    expect(await routeMessage(said("ชาย 35 ล้านนึง"))).toMatchObject({
      intent: "quote", age: 35, sex: "M", coverWanted: 1000000,
    });
  });

  it("takes the term named in the message over the one the model guessed", async () => {
    reply.text = JSON.stringify({ intent: "quote", variant: "WLF99H" });
    expect((await routeMessage(said("จ่าย 19 ปีเท่าไหร่"))).variant).toBe("WLF19H");
  });

  it("keeps the x 1.5 term the customer named, for the answer to turn down", async () => {
    reply.text = JSON.stringify({ intent: "quote" });
    expect((await routeMessage(said("แบบ x 1.5 จ่าย 9 ปี"))).variant).toBe("WLF09L");
  });

  it("refuses a code that is not one of this plan's packages", async () => {
    reply.text = JSON.stringify({ intent: "quote", variant: "ISH10" });
    expect((await routeMessage(said("ขอราคา"))).variant).toBeUndefined();
  });

  it("drops an age outside what a person can be", async () => {
    reply.text = JSON.stringify({ intent: "quote", age: 140 });
    expect((await routeMessage(said("อายุ 140"))).age).toBeUndefined();
  });

  it("treats a question about what the family receives as a question about the plan", async () => {
    reply.text = JSON.stringify({ intent: "other" });
    expect((await routeMessage(said("ทำทุน 1 ล้าน ครอบครัวได้ 2 ล้านจริงไหม"))).intent).toBe("plan_info");
  });

  it("treats the advert's own button as a request for a price, whatever the model called it", async () => {
    reply.text = JSON.stringify({ intent: "plan_info", coverWanted: 1000000 });
    const routed = await routeMessage(said("สนใจประกันมรดก ทุน 1,000,000"));
    expect(routed.intent).toBe("quote");
    expect(routed.coverWanted).toBe(1000000);
  });

  it("leaves a question about what the family receives alone, sum or no sum", async () => {
    reply.text = JSON.stringify({ intent: "plan_info", coverWanted: 1000000 });
    expect((await routeMessage(said("ทำทุน 1 ล้าน ครอบครัวได้ 2 ล้านจริงไหม"))).intent).toBe("plan_info");
  });

  it("falls back to a plain conversation when the model answers with rubbish", async () => {
    reply.text = "ไม่ใช่ JSON";
    expect(await routeMessage(said("สวัสดี"))).toEqual({ intent: "other" });
  });
});

describe("an age given as a birthdate", () => {
  it("is counted on the calendar, not by the model", async () => {
    reply.text = JSON.stringify({ intent: "quote", age: 43 });
    const routed = await routeMessage(said("เกิด 14/12/2523 ผู้หญิง"));
    expect(routed.age).toBe(ageOn(new Date(), 14, 12, 1980));
    expect(routed.age).not.toBe(43);
  });

  it("reads a Christian-era year too", async () => {
    reply.text = JSON.stringify({ intent: "quote" });
    expect((await routeMessage(said("เกิด 14/12/1980"))).age).toBe(ageOn(new Date(), 14, 12, 1980));
  });

  it("does not count a birthday that has not come round yet", () => {
    expect(ageFromBirthdate("เกิด 31/12/2523", new Date("2026-09-13"))).toBe(45);
    expect(ageFromBirthdate("เกิด 01/01/2523", new Date("2026-09-13"))).toBe(46);
  });

  it("leaves a bare year to be asked about", () => {
    expect(ageFromBirthdate("เกิดปี 2523")).toBeUndefined();
  });

  it("ignores a date that is not one", () => {
    expect(ageFromBirthdate("40/13/2523")).toBeUndefined();
  });
});

describe("the price being too much", () => {
  it("is heard in the words customers use for it", () => {
    for (const t of ["แพงไปหน่อย มีถูกกว่านี้ไหม", "ขอส่วนลดได้ไหม", "ลดหน่อยได้ไหมคะ", "เกินงบไปนิด"]) {
      expect(asksCheaper(t), t).toBe(true);
    }
  });

  it("is not heard in a question about the term or a request for a price", () => {
    for (const t of ["ต้องจ่ายถึงกี่ปี", "ชาย 35 ทุน 1 ล้าน", "จ่าย 19 ปีเท่าไหร่"]) {
      expect(asksCheaper(t), t).toBe(false);
    }
  });
});

describe("a bare yes", () => {
  it("is a short acceptance with nothing else in it", () => {
    for (const t of ["เอา", "เอาเลยครับ", "ตกลงค่ะ", "โอเค", "สนใจครับ", "เอาแบบลดทุน"]) {
      expect(affirms(t), t).toBe(true);
    }
  });

  it("is not a message that names an amount or asks something", () => {
    for (const t of ["เอา 3 ล้าน", "สนใจประกันมรดก ทุน 1,000,000", "ได้ไหม", "เอาแบบไหนดี"]) {
      expect(affirms(t), t).toBe(false);
    }
  });

  it("carries an offer across turns until something replaces it", () => {
    const offer = { coverWanted: 1_000_000, sumAssured: 500_000, variant: "WLF99H" };
    const merged = mergeSlots({ intent: "quote", age: 38, sex: "M", coverWanted: 2_000_000, offer }, { intent: "other" });
    expect(merged.offer).toEqual(offer);
  });
});

describe("leaving to think it over", () => {
  it("is heard in the ways people say it", () => {
    for (const t of ["เดี๋ยวคิดดูก่อนนะคะ", "ขอปรึกษาแฟนก่อนค่ะ", "ไว้จะติดต่อกลับค่ะ", "ขอเวลาคิดหน่อย", "ยังไม่ตัดสินใจครับ"]) {
      expect(stalls(t), t).toBe(true);
    }
  });

  it("is not a question that happens to mention thinking", () => {
    for (const t of ["ถ้าคิดดูแล้วสนใจ ต้องทำยังไงต่อ", "คิดดูก่อนได้ไหม", "ติดต่อกลับทางไหน", "ขอบคุณค่ะ"]) {
      expect(stalls(t), t).toBe(false);
    }
  });
});

describe("deciding to buy", () => {
  it("is heard in the ways people say it", () => {
    for (const t of ["เอาแผนนี้ครับ", "เอาแผ่นนี้", "ต้องทำยังไงต่อ", "สมัครยังไงคะ", "สนใจทำค่ะ ต้องเตรียมอะไรบ้าง", "ขั้นตอนเป็นยังไง", "ถ้าคิดดูแล้วสนใจ ต้องทำยังไงต่อ", "ใช้เอกสารอะไรบ้าง", "ซื้อได้เลยไหม"]) {
      expect(wantsToBuy(t, true), t).toBe(true);
    }
  });

  it("takes a bare ตกลง or เอา as buying only once a quotation is in hand", () => {
    for (const t of ["ตกลง", "ตกลงค่ะ", "เอาครับ"]) {
      expect(wantsToBuy(t, true), t).toBe(true);
      expect(wantsToBuy(t, false), t).toBe(false);
    }
    // an acknowledgement is not a decision
    for (const t of ["โอเค", "ครับ", "ได้ค่ะ", "รับทราบ"]) expect(wantsToBuy(t, true), t).toBe(false);
  });

  it("is not a question about paying, claiming, cancelling, or the price", () => {
    for (const t of ["จ่ายยังไง", "แพงไป ทำยังไงให้ถูกลง", "เคลมยังไง", "ยกเลิกต้องทำยังไง", "เวนคืนทำยังไง", "ผู้ชาย 35 ทุน 1 ล้านเท่าไหร่", "ต้องจ่ายถึงกี่ปี"]) {
      expect(wantsToBuy(t, true), t).toBe(false);
    }
  });

  it("hears that the form has been filled in", () => {
    for (const t of ["กรอกแล้วครับ", "กรอกเสร็จแล้วค่ะ", "ส่งฟอร์มแล้ว", "เรียบร้อยแล้วครับ", "ทำแล้วนะ"]) expect(saysFormDone(t), t).toBe(true);
    for (const t of ["กรอกยังไง", "กรอกไม่ได้", "ฟอร์มเปิดไม่ขึ้น"]) expect(saysFormDone(t), t).toBe(false);
  });
});

describe("carrying the conversation forward", () => {
  it("keeps the age and sex from an earlier turn", () => {
    const merged = mergeSlots(
      { intent: "quote", age: 35, sex: "M", coverWanted: 1000000 },
      { intent: "quote", variant: "WLF19H" },
    );
    expect(merged).toMatchObject({ age: 35, sex: "M", coverWanted: 1000000, variant: "WLF19H" });
  });

  it("stays on the quote when the customer answers what it asked for", () => {
    const merged = mergeSlots({ intent: "quote", coverWanted: 3_000_000 }, { intent: "plan_info", age: 45, sex: "F" });
    expect(merged.intent).toBe("quote");
    expect(merged.coverWanted).toBe(3_000_000);
  });

  it("does not force a quote onto a turn that supplies nothing", () => {
    const merged = mergeSlots({ intent: "quote", coverWanted: 3_000_000 }, { intent: "plan_info" });
    expect(merged.intent).toBe("plan_info");
  });

  it("lets the newest turn overwrite what it names", () => {
    const merged = mergeSlots({ intent: "quote", coverWanted: 1000000 }, { intent: "quote", coverWanted: 500000 });
    expect(merged.coverWanted).toBe(500000);
  });
});
