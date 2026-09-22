import { describe, it, expect } from "vitest";
import { quotePension } from "@/calc/pension/engine";
import { pensionFacts } from "@/lib/pension-facts";
import { pensionMessage, pensionQuoteText } from "@/lib/pension-cta";

/** What leaves the /bumnan95 sales page: the copy's figures, the chat's first line, the pasted quote. */
describe("the บำนาญ สมาร์ท 95 sales page", () => {
  const facts = pensionFacts();

  it("opens on the same example the chat prices", () => {
    expect(facts.example.quote.monthlyPension).toBe(10_000);
    expect(facts.example.quote.sumAssured).toBe(787_402);
    expect(Math.floor(facts.example.quote.annualPremium)).toBe(136_220);
  });

  it("names, for each pension age, the oldest a person may start at", () => {
    expect(facts.latestEntry).toEqual([
      { pensionAge: 55, ageMax: 49 }, { pensionAge: 60, ageMax: 55 },
      { pensionAge: 65, ageMax: 60 }, { pensionAge: 70, ageMax: 65 },
    ]);
  });

  it("opens the customer's chat with the figures on screen", () => {
    const msg = pensionMessage({ age: 40, sex: "M" }, facts.example.quote);
    expect(msg).toBe("สนใจบำนาญ สมาร์ท 95 ชาย อายุ 40 รับบำนาญอายุ 60 เดือนละ 10,000 ชำระเบี้ยจนถึงอายุ 60 (20 ปี) เบี้ยประมาณ 136,220 บาท/ปี");
    expect(pensionMessage({ age: 40, sex: "F" }, null)).toContain("ขอคำแนะนำ");
  });

  it("says six years for the six-year plan", () => {
    const r = quotePension({ age: 40, sex: "M", annuityAge: 60, pay: "6", mode: "annual", basis: "monthlyPension", amount: 10_000 });
    if (!r.ok) throw new Error(r.error);
    expect(pensionMessage({ age: 40, sex: "M" }, r.quote)).toContain("ชำระเบี้ย 6 ปี");
  });

  it("puts the riders into the copied quote, and totals them", () => {
    const r = quotePension({
      age: 40, sex: "M", annuityAge: 60, pay: "untilAnnuity", mode: "annual", basis: "monthlyPension", amount: 10_000,
      riders: { dci: { sumAssured: 1_000_000 } },
    });
    if (!r.ok) throw new Error(r.error);
    const text = pensionQuoteText({ age: 40, sex: "M" }, r.quote);
    expect(text).toContain(`💰 เบี้ยรวมปีละ ${Math.floor(r.quote.totalAnnualPremium).toLocaleString("en-US")} บาท`);
    expect(text).toContain("- DCI (โรคร้ายแรง) ปีละ 5,520 บาท");
    expect(text).not.toMatch(/\*\*/);
  });
});
