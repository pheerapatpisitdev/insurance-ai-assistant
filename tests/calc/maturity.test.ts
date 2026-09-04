import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import type { QuoteInput } from "@/calc/types";

const at = (plan: string, variant: string, age: number, sumAssured: number): QuoteInput => ({
  planCode: plan, variant, age, sex: "M", mode: "annual", sumAssured, basis: "sumAssured", riders: [],
});

describe("what the contract pays for living to the end of it", () => {
  it("ไอสมาร์ท 80/6 at 44 on a million matches the workbook's F69", () => {
    // 1% in policy years 1-5 and 2% from 6 to 35 is 650,000, plus 200% at the anniversary
    // at 80, which the sheet totals as 2,650,000
    const m = quote(at("ISMART", "W80F06", 44, 1_000_000)).maturityBenefit!;
    expect(m).toMatchObject({ age: 80, amount: 2_000_000, survivalTotal: 650_000, total: 2_650_000 });
  });

  it("pays a survival benefit in every year before maturity and none in the last", () => {
    // 65 is the oldest ไอสมาร์ท will issue: fifteen policy years, fourteen of them before
    // maturity — five at 1% and nine at 2% of a million
    const m = quote(at("ISMART", "W80F06", 65, 1_000_000)).maturityBenefit!;
    expect(m.survivalTotal).toBe(5 * 10_000 + 9 * 20_000);
  });

  it("adds a year of survival benefit for each year earlier the policy starts", () => {
    const at50 = quote(at("ISMART", "W80F06", 50, 1_000_000)).maturityBenefit!;
    const at51 = quote(at("ISMART", "W80F06", 51, 1_000_000)).maturityBenefit!;
    // one policy year fewer, and it falls in the 2% band
    expect(at50.survivalTotal! - at51.survivalTotal!).toBe(20_000);
  });

  it("scales with the sum assured", () => {
    const m = quote(at("ISMART", "W80F06", 44, 500_000)).maturityBenefit!;
    expect(m).toMatchObject({ amount: 1_000_000, survivalTotal: 325_000, total: 1_325_000 });
  });

  it("stays quiet on the two plans whose surrender table already answers this", () => {
    // Their workbooks say two things: the summary sheet pays 100% of the sum assured at 99,
    // while the last row of TABCV — which the chat quotes as "อยู่ครบสัญญา" — is 111% for a
    // man of 35. Until the agency says which the policy pays, the calculator says neither
    // rather than contradicting the bot.
    expect(quote(at("LIFEPROTECT", "WLF99H", 35, 1_000_000)).maturityBenefit).toBeUndefined();
    expect(quote(at("LIFETREASURE", "H99F06A", 40, 10_000_000)).maturityBenefit).toBeUndefined();
  });

  it("matures at 85 on iShield", () => {
    expect(quote(at("ISHIELD", "WLCI10", 40, 1_000_000)).maturityBenefit)
      .toEqual({ age: 85, amount: 1_000_000 });
  });

  it("says nothing for PLB, whose workbook has no maturity figures to take", () => {
    expect(quote(at("PLB", "PLB10", 35, 1_000_000)).maturityBenefit).toBeUndefined();
  });

  it("says nothing when the plan cannot be issued, so a zero sum assured invents no payout", () => {
    expect(quote(at("ISMART", "W80F06", 24, 1_000_000)).maturityBenefit).toBeUndefined();
  });
});
