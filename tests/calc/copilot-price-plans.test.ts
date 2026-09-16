import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { planNamedIn, priceNamedPlan } from "@/lib/copilot/price";

/**
 * The figures this page gives against the figures the engine gives.
 *
 * Not a fixture in sight: every expected number is computed here by the same `quote()` the
 * calculator page calls, so the chat and the calculator cannot drift apart without this
 * failing. A premium that is merely plausible is the failure mode that matters.
 */

const baht = (satang: number) => Math.round(satang / 100).toLocaleString("en-US");

describe("recognising which plan was named", () => {
  for (const [text, code] of [
    ["PLB ทุน 1 ล้าน", "PLB"],
    ["Protection Life ชาย 35", "PLB"],
    ["iSmart 80/6 เบี้ยเท่าไหร่", "ISMART"],
    ["ไอสมาร์ท ทุน 1 ล้าน", "ISMART"],
    ["Life Treasure ชาย 40", "LIFETREASURE"],
    ["iShield ทุน 1 ล้าน", "ISHIELD"],
  ] as const) {
    it(`reads "${text}" as ${code}`, () => {
      expect(planNamedIn(text)?.code).toBe(code);
    });
  }

  it("leaves Life Protect alone, which has a brain of its own", () => {
    expect(planNamedIn("Life Protect ชาย 35 ทุน 1 ล้าน")).toBeUndefined();
  });
});

describe("iSmart, which has one package and needs no choosing", () => {
  it("quotes the same figure the engine does", () => {
    const reply = priceNamedPlan("iSmart ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.priced).toBe(true);
    const expected = quote({
      planCode: "ISMART", variant: "W80F06", age: 35, sex: "M",
      mode: "annual", sumAssured: 1_000_000, riders: [],
    });
    expect(reply.text).toContain(baht(expected.totalAnnual));
  });

  it("draws both pictures, the quote and the year-by-year table", () => {
    const reply = priceNamedPlan("iSmart ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.cards?.[0]).toContain("/api/card?");
    expect(reply.cards?.[0]).toContain("plan=ISMART");
    expect(reply.cards?.[1]).toContain("/api/card/table?");
  });
});

describe("a plan sold on several paying terms", () => {
  it("asks which one rather than picking, because the term is most of the premium", () => {
    const reply = priceNamedPlan("Life Treasure ชาย 40 ทุน 10 ล้าน เบี้ยเท่าไหร่", "LIFETREASURE", "Life Treasure");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("ระยะเวลาชำระเบี้ย");
    expect(reply.text).not.toMatch(/\d[\d,]{4,}\s*บาท\*\*/);
  });

  it("quotes once the term is named, and matches the engine on that term", () => {
    const reply = priceNamedPlan(
      "Life Treasure ชาย 40 ทุน 10 ล้าน จ่าย 12 ปี เบี้ยเท่าไหร่", "LIFETREASURE", "Life Treasure");
    expect(reply.priced).toBe(true);
    const expected = quote({
      planCode: "LIFETREASURE", variant: "H99F12A", age: 40, sex: "M",
      mode: "annual", sumAssured: 10_000_000, riders: [],
    });
    expect(reply.text).toContain(baht(expected.totalAnnual));
    expect(reply.cards?.[0]).toContain("variant=H99F12A");
  });

  it("names every term on offer when it asks", () => {
    const reply = priceNamedPlan("PLB ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "PLB", "Protection Life (PLB)");
    expect(reply.priced).toBe(false);
    for (const years of ["5", "10", "12", "15"]) expect(reply.text).toContain(`${years} ปี`);
  });

  it("quotes PLB on the term it was given", () => {
    const reply = priceNamedPlan("PLB ชาย 35 ทุน 1 ล้าน จ่าย 10 ปี", "PLB", "Protection Life (PLB)");
    expect(reply.priced).toBe(true);
    const expected = quote({
      planCode: "PLB", variant: "PLB10", age: 35, sex: "M",
      mode: "annual", sumAssured: 1_000_000, riders: [],
    });
    expect(reply.text).toContain(baht(expected.totalAnnual));
  });
});

describe("iShield, which is filled in the other way round", () => {
  it("says so rather than reading the sum as a sum", () => {
    const reply = priceNamedPlan("iShield ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISHIELD", "iShield");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("กรอกเบี้ยที่อยากจ่าย");
    expect(reply.text).toContain("/other-plans");
    expect(reply.cards).toBeUndefined();
  });
});

describe("what is missing is named", () => {
  it("asks for the person when only a plan and a sum were given", () => {
    const reply = priceNamedPlan("iSmart ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("อายุกับเพศ");
  });

  it("asks for the sum when only a person was given", () => {
    const reply = priceNamedPlan("iSmart ชาย 35 เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.priced).toBe(false);
    expect(reply.text).toContain("ทุนประกัน");
  });
});

describe("an arrangement the plan will not write", () => {
  it("passes the engine's own refusal on rather than a number", () => {
    // iSmart is sold from 25 to 65; a child is outside it
    const reply = priceNamedPlan("iSmart ชาย 5 ทุน 1 ล้าน เบี้ยเท่าไหร่", "ISMART", "iSmart 80/6");
    expect(reply.priced).toBe(false);
    expect(reply.text).not.toMatch(/💰/);
  });
});
