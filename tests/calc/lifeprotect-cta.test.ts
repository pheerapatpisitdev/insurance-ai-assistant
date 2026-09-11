import { describe, expect, it } from "vitest";
import type { ModePremium } from "@/calc/mode-premiums";
import { lifeProtectMessage, lifeProtectQuoteText } from "@/lib/lifeprotect-cta";

const MONTHLY: ModePremium = { mode: "monthly", total: 258_300, belowMinimum: false };
const ANNUAL: ModePremium = { mode: "annual", total: 600_000, belowMinimum: false };
const base = { sumAssured: 1_000_000, termLabel: "จ่าย 19 ปี", sex: "M" as const, ageMax: 80 };

describe("lifeProtectMessage", () => {
  it("carries the sum, the term, the insured and the headline premium", () => {
    expect(lifeProtectMessage({ ...base, age: 35, premium: MONTHLY }))
      .toBe("สนใจ Life Protect+ 100 ทุน 1,000,000 จ่าย 19 ปี อายุ 35 ชาย เบี้ยประมาณ 2,583 บาท/เดือน");
  });

  it("names the yearly premium when that is what is on the card", () => {
    expect(lifeProtectMessage({ ...base, termLabel: "จ่ายถึงอายุ 99", age: 0, premium: ANNUAL }))
      .toBe("สนใจ Life Protect+ 100 ทุน 1,000,000 จ่ายถึงอายุ 99 อายุแรกเกิด ชาย เบี้ยประมาณ 6,000 บาท/ปี");
  });

  it("asks for something else for an age past the plan's last", () => {
    expect(lifeProtectMessage({ ...base, sex: "F", age: "over", premium: undefined }))
      .toBe("สนใจ Life Protect+ 100 ทุน 1,000,000 อายุเกิน 80 ปี ขอแบบที่เหมาะกับอายุนี้");
  });

  it("asks for the current price when no premium may be shown", () => {
    expect(lifeProtectMessage({ ...base, sex: "F", age: 42, premium: undefined }))
      .toBe("สนใจ Life Protect+ 100 ทุน 1,000,000 จ่าย 19 ปี อายุ 42 หญิง ขอราคาปัจจุบัน");
  });
});

describe("lifeProtectQuoteText", () => {
  // ชาย 35 · 1 ล้าน · จ่ายถึงอายุ 99: the figures the page shows for its opening case
  const modes: ModePremium[] = [
    { mode: "monthly", total: 154_800, belowMinimum: false },
    { mode: "annual", total: 1_720_000, belowMinimum: false },
    { mode: "semi", total: 894_400, belowMinimum: false },
  ];
  const death = { beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false };

  it("writes every figure on the card, in the card's order", () => {
    const text = lifeProtectQuoteText({
      sumAssured: 1_000_000, termLabel: "จ่ายถึงอายุ 99", age: 35, sex: "M", modes, death,
      cash: [{ age: 60, amount: 123_456 }, { age: 99, amount: 1_000_000 }],
    });
    expect(text).toBe([
      "Life Protect+ 100",
      "ทุน 1,000,000 บาท เพิ่มเป็น 2,000,000 ถึงอายุ 60",
      "",
      "ชาย อายุ 35 · จ่ายถึงอายุ 99",
      "เบี้ยประมาณ 1,548 บาท/เดือน (ตกวันละ 48 บาท)",
      "",
      "รายเดือน 1,548 บาท",
      "ราย 6 เดือน 8,944 บาท",
      "รายปี 17,200 บาท",
      "",
      "ครอบครัวได้รับเมื่อเสียชีวิต",
      "- เสียชีวิตก่อนอายุ 60 ปี 2,000,000 บาท",
      "- อายุ 60 ปีขึ้นไป 1,000,000 บาท",
      "",
      "มูลค่าเงินสดสะสม (หากเวนคืน)",
      "- อายุ 60 ปี 123,456 บาท",
      "- อายุ 99 ปี 1,000,000 บาท",
      "",
      "เบี้ยคงที่ตลอดระยะเวลาชำระ",
      "เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน",
    ].join("\n"));
  });

  it("promises no doubling to an insured already past the age it stops at", () => {
    const past = { beforeAge: 60, sumBefore: 1_000_000, sumFrom: 1_000_000, alreadyPastAge: true };
    const text = lifeProtectQuoteText({ sumAssured: 1_000_000, termLabel: "จ่าย 9 ปี", age: 62, sex: "M", modes, death: past, cash: [] });
    expect(text).toContain("Life Protect+ 100\nทุน 1,000,000 บาท\n\nชาย อายุ 62");
    expect(text).not.toContain("เพิ่มเป็น");
  });

  it("leaves the cash-value block out when there is none to show", () => {
    const text = lifeProtectQuoteText({ sumAssured: 1_000_000, termLabel: "จ่าย 9 ปี", age: 0, sex: "F", modes, death, cash: [] });
    expect(text).toContain("หญิง อายุ แรกเกิด · จ่าย 9 ปี");
    expect(text).not.toContain("มูลค่าเงินสด");
  });
});