import { describe, expect, it } from "vitest";
import type { ModePremium } from "@/calc/mode-premiums";
import { FACEBOOK_PAGE, displayPremium, legacyMessage, messengerUrl, perDay } from "@/lib/legacy-cta";

/** ชาย 38 ปี มรดก 3 ล้าน — every mode is issuable */
const AFFORDABLE: ModePremium[] = [
  { mode: "annual", total: 1_668_750, belowMinimum: false },
  { mode: "semi", total: 867_750, belowMinimum: false },
  { mode: "monthly", total: 150_187, belowMinimum: false },
];

/** หญิง 30 ปี มรดก 1 ล้าน — the monthly instalment is under the company's 1,000 baht floor */
const UNDER_FLOOR: ModePremium[] = [
  { mode: "annual", total: 412_300, belowMinimum: false },
  { mode: "semi", total: 214_396, belowMinimum: false },
  { mode: "monthly", total: 37_107, belowMinimum: true },
];

describe("displayPremium", () => {
  it("headlines the monthly instalment when the company will take it", () => {
    expect(displayPremium(AFFORDABLE, false)).toEqual(AFFORDABLE[2]);
  });

  it("falls back to the yearly premium when the monthly instalment is under the minimum", () => {
    expect(displayPremium(UNDER_FLOOR, false)).toEqual(UNDER_FLOOR[0]);
  });

  it("shows no price at all once the rate table has expired", () => {
    expect(displayPremium(AFFORDABLE, true)).toBeUndefined();
  });

  it("shows no price when the bundle could not be quoted", () => {
    expect(displayPremium(undefined, false)).toBeUndefined();
  });
});

describe("perDay", () => {
  it("turns a yearly premium into whole baht a day", () => {
    // ชาย 38 · 3 ล้าน: 16,687.50 บาท/ปี ÷ 365 = 45.7 → 46
    expect(perDay(1_668_750)).toBe(46);
  });

  it("rounds up, so the figure is never one the premium undershoots", () => {
    // หญิง 30 · 1 ล้าน: 4,123 บาท/ปี ÷ 365 = 11.3 → 12
    expect(perDay(412_300)).toBe(12);
  });
});

const RANGE = { min: 20, max: 65 };

describe("legacyMessage", () => {
  it("carries the sum, the insured and the headline premium", () => {
    expect(legacyMessage({ millions: 3, age: 38, sex: "M", range: RANGE, premium: AFFORDABLE[2] }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน อายุ 38 ชาย เบี้ยประมาณ 1,501 บาท/เดือน");
  });

  it("names the yearly premium when that is what is on the card", () => {
    expect(legacyMessage({ millions: 1, age: 30, sex: "F", range: RANGE, premium: UNDER_FLOOR[0] }))
      .toBe("สนใจมรดกเพื่อครอบครัว 1 ล้าน อายุ 30 หญิง เบี้ยประมาณ 4,123 บาท/ปี");
  });

  it("asks about the sum alone before an age has been picked", () => {
    expect(legacyMessage({ millions: 3, age: "", sex: "M", range: RANGE, premium: undefined }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน");
  });

  /**
   * The picker offers the ages the bundle takes and one way out for everyone else, so an
   * age outside the range arrives as "other" — a real person the agent should still call
   * back, not a number to quote.
   */
  it("asks for something else when the age is outside what the bundle takes", () => {
    expect(legacyMessage({ millions: 3, age: "other", sex: "F", range: RANGE, premium: undefined }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน อายุนอกช่วง 20–65 ปี ขอแบบที่เหมาะกับอายุนี้");
  });

  it("asks for the current price when no premium may be shown", () => {
    expect(legacyMessage({ millions: 3, age: 38, sex: "M", range: RANGE, premium: undefined }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน อายุ 38 ชาย ขอราคาปัจจุบัน");
  });
});

describe("contact links", () => {
  const text = "สนใจมรดกเพื่อครอบครัว 3 ล้าน";

  it("opens the agency's Page in Messenger with the message ready to send", () => {
    expect(messengerUrl(text)).toBe(`https://m.me/${FACEBOOK_PAGE}?text=` + encodeURIComponent(text));
  });
});
