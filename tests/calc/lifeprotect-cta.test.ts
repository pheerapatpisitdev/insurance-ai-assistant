import { describe, expect, it } from "vitest";
import type { ModePremium } from "@/calc/mode-premiums";
import { lifeProtectMessage } from "@/lib/lifeprotect-cta";

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
