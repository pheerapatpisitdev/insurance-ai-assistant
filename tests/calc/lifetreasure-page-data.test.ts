import { describe, expect, it } from "vitest";
import { getPlan } from "@/calc/plans/registry";
import { quote } from "@/calc/quote";
import { quoteModePremiums } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import { hasCashValues } from "@/calc/cash-value";
import type { Sex } from "@/calc/types";
import { cashProjection } from "@/lib/cash-projection";
import { lifeTreasureTable } from "@/lib/lifetreasure-table";
import {
  cashAt, deathBenefitOf, leverage, lifeTreasureDiscount, lifeTreasureModes, payYears, termAt, totalPaid,
} from "@/lib/lifetreasure-quote";
import { lifeTreasureMessage, lifeTreasureQuoteText } from "@/lib/lifetreasure-cta";
import { lifeTreasureFacts } from "@/lib/lifetreasure-facts";

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");
const AFTER_EXPIRY = new Date("2027-04-01");

describe("lifeTreasureTable", () => {
  it("carries the three payment terms in the order the page shows them", () => {
    const t = lifeTreasureTable(WHILE_CURRENT);
    expect(t).toMatchObject({
      planCode: "LIFETREASURE", ageMin: 0, ageMax: 70, expired: false, rateVersion: "A2026-1",
      minMonthly: 1000, saMin: 10_000_000, saMax: 50_000_000, coverToAge: 99,
      topUp: { premiumPercent: 101, includeCashValue: true },
      modeFactors: { annual: 1, semi: 0.52, monthly: 0.09 },
    });
    expect(t.terms.map((x) => [x.variant, x.label, x.short, x.payTerm])).toEqual([
      ["H99F06A", "ชำระเบี้ย 6 ปี", "6 ปี", 6],
      ["H99F12A", "ชำระเบี้ย 12 ปี", "12 ปี", 12],
      ["H99F18A", "ชำระเบี้ย 18 ปี", "18 ปี", 18],
    ]);
  });

  it("has a rate and a surrender schedule for every age and sex", () => {
    const t = lifeTreasureTable(WHILE_CURRENT);
    const rates = getPlan("LIFETREASURE")!.rates;
    for (const term of t.terms) {
      for (const sex of ["M", "F"] as const) {
        expect(term.rates[sex]).toHaveLength(71);
        expect(term.rates[sex].every((r) => typeof r === "number")).toBe(true);
        expect(term.rates[sex][30]).toBe(rates.base.rates[term.variant][sex]["30"]);
        // cover runs to 99, so a policy issued at 30 has 69 policy years of surrender values
        expect(term.schedule[sex][30]).toHaveLength(69);
        expect(term.schedule[sex][70]).toHaveLength(29);
      }
    }
  });

  /** Same defence as the other pages: a warm cache must not keep saying the table is current. */
  it("reports the lapse even when the table was built while it was current", () => {
    expect(lifeTreasureTable(WHILE_CURRENT).expired).toBe(false);
    expect(lifeTreasureTable(AFTER_EXPIRY).expired).toBe(true);
    expect(lifeTreasureTable(WHILE_CURRENT).expired).toBe(false);
  });

  it("is registered with the engine's surrender tables, not only with the page's", () => {
    expect(hasCashValues("LIFETREASURE")).toBe(true);
  });
});

/**
 * ชาย 30 · ทุน 20,000,000 · ชำระเบี้ย 18 ปี is the arrangement the company's own
 * ตารางแสดงผลประโยชน์ prints, so every figure below can be read off that sheet.
 */
describe("the company's own benefit table, read back", () => {
  const t = lifeTreasureTable(WHILE_CURRENT);
  const term = termAt(t, "H99F18A");
  const who = { sex: "M" as Sex, age: 30, sumAssured: 20_000_000 };
  const modes = lifeTreasureModes(t, term, who)!;
  const annual = modes.find((m) => m.mode === "annual")!;

  it("prices the base contract at 506,000 a year", () => {
    expect(formatBaht(annual.total)).toBe("506,000");
  });

  it("reads the surrender values the sheet prints at 80 and at the end", () => {
    const rows = cashAt(term, who.sex, who.age, who.sumAssured, t.ageMin);
    expect(rows.find((r) => r.age === 80)!.amount).toBe(16_140_000);
    expect(rows[rows.length - 1]).toEqual({ age: 99, amount: 20_000_000 });
  });

  it("holds the cover at the sum assured all the way, as the sheet's column does", () => {
    const p = cashProjection({
      factors: term.schedule.M[who.age]!, age: who.age, sumAssured: who.sumAssured,
      annualSatang: annual.total, payYears: payYears(term),
      death: deathBenefitOf(who.sumAssured), topUp: t.topUp,
    });
    expect(p.rows).toHaveLength(69);
    expect(p.maturityAge).toBe(99);
    // the premiums stop after the eighteenth year and add up to what the sheet prints
    expect(p.rows[17].premiumPaid! / 100).toBe(9_108_000);
    expect(p.rows[18].premiumDue).toBe(0);
    // 101% of 9,108,000 is still under 20,000,000, and so is every surrender value but the
    // last, so the sheet's cover column is 20,000,000 on every row
    expect(p.rows.every((r) => r.cover === 20_000_000 * 100)).toBe(true);
  });
});

/**
 * The page prices itself in the browser from its own copy of the tables. That copy is only
 * worth having if it agrees with the engine to the satang — and for this plan the thing most
 * likely to break that is the sum-assured discount, which differs per term.
 */
describe("the browser's arithmetic against the engine", () => {
  const t = lifeTreasureTable(WHILE_CURRENT);

  it("agrees with quote() for every term, age, sex and sum the page offers", () => {
    for (const term of t.terms) {
      for (const age of [0, 30, 45, 70]) {
        for (const sex of ["M", "F"] as Sex[]) {
          for (const sumAssured of [10_000_000, 20_000_000, 50_000_000]) {
            const mine = lifeTreasureModes(t, term, { sex, age, sumAssured })!;
            const theirs = quoteModePremiums(
              { planCode: "LIFETREASURE", variant: term.variant, age, sex, mode: "annual", sumAssured, riders: [] },
              WHILE_CURRENT,
            )!;
            expect(mine.map((m) => [m.mode, m.total])).toEqual(theirs.map((m) => [m.mode, m.total]));
          }
        }
      }
    }
  });

  it("takes a different discount off the six- and eighteen-year terms", () => {
    // every policy this plan issues clears the top threshold, but the tiers below it are
    // carried whole so a change to them cannot pass unnoticed
    expect(lifeTreasureDiscount(t, "H99F06A", 10_000_000)).toBe(4);
    expect(lifeTreasureDiscount(t, "H99F18A", 10_000_000)).toBe(1.5);
    expect(lifeTreasureDiscount(t, "H99F18A", 100_000)).toBe(0);
  });
});

describe("what the estate buyer is actually comparing", () => {
  const t = lifeTreasureTable(WHILE_CURRENT);

  it("adds the premiums up over the paying term and states the multiple", () => {
    const term = termAt(t, "H99F18A");
    const annual = lifeTreasureModes(t, term, { sex: "M", age: 45, sumAssured: 10_000_000 })!
      .find((m) => m.mode === "annual")!;
    expect(formatBaht(annual.total)).toBe("370,000");
    expect(formatBaht(totalPaid(annual.total, term))).toBe("6,660,000");
    expect(leverage(10_000_000, totalPaid(annual.total, term))!.toFixed(1)).toBe("1.5");
  });

  it("says nothing rather than flatter, once the premiums add up to more than the sum", () => {
    const term = termAt(t, "H99F18A");
    const annual = lifeTreasureModes(t, term, { sex: "M", age: 70, sumAssured: 10_000_000 })!
      .find((m) => m.mode === "annual")!;
    // ชาย 70 pays in more than ten million over eighteen years
    expect(totalPaid(annual.total, term)).toBeGreaterThan(10_000_000 * 100);
    expect(leverage(10_000_000, totalPaid(annual.total, term))).toBeNull();
  });
});

describe("what the customer sends, and what the agent pastes", () => {
  const t = lifeTreasureTable(WHILE_CURRENT);
  const term = termAt(t, "H99F18A");
  const who = { sex: "M" as Sex, age: 45, sumAssured: 10_000_000 };
  const modes = lifeTreasureModes(t, term, who)!;
  const headline = modes.find((m) => m.mode === "monthly")!;
  const annual = modes.find((m) => m.mode === "annual")!;

  it("opens the chat with the figures already on screen", () => {
    expect(lifeTreasureMessage({
      sumAssured: who.sumAssured, termLabel: term.label, age: who.age, sex: who.sex,
      ageMax: t.ageMax, premium: headline,
    })).toBe(`สนใจไลฟ์เทรเชอร์ ทุน 10,000,000 ชำระเบี้ย 18 ปี อายุ 45 ชาย เบี้ยประมาณ ${formatBaht(headline.total)} บาท/เดือน`);
  });

  it("asks for a plan that fits when the customer is past the oldest age", () => {
    expect(lifeTreasureMessage({
      sumAssured: 10_000_000, termLabel: term.label, age: "over", sex: "M",
      ageMax: t.ageMax, premium: undefined,
    })).toBe("สนใจไลฟ์เทรเชอร์ ทุน 10,000,000 อายุเกิน 70 ปี ขอแบบที่เหมาะกับอายุนี้");
  });

  it("carries the cover, the floors, the surrender values and the total", () => {
    const total = totalPaid(annual.total, term);
    const text = lifeTreasureQuoteText({
      sumAssured: who.sumAssured, termLabel: term.label, age: who.age, sex: who.sex,
      years: term.payTerm, coverToAge: t.coverToAge,
      modes: [headline, ...modes.filter((m) => m.mode !== headline.mode)],
      total, leverage: leverage(who.sumAssured, total),
      cash: cashAt(term, who.sex, who.age, who.sumAssured, t.ageMin),
      premiumFloorPercent: t.topUp.premiumPercent,
    });
    expect(text).toContain("คุ้มครองถึงอายุ 99");
    expect(text).toContain("10,000,000 บาท ทุกช่วงอายุ");
    expect(text).toContain("ไม่น้อยกว่า 101% ของเบี้ยที่ชำระมาแล้ว");
    expect(text).toContain("อายุ 99 ปี 10,000,000 บาท");
    expect(text).toContain("เบี้ยรวมตลอด 18 ปี 6,660,000 บาท (ส่งต่อ 1.5 เท่าของเบี้ยที่จ่าย)");
    // a four-figure day rate is grouped like every other figure on the page
    expect(text).toContain("ตกวันละ 1,014 บาท");
  });
});

describe("lifeTreasureFacts", () => {
  it("quotes the copy's figures off the rate and surrender tables", () => {
    const f = lifeTreasureFacts(WHILE_CURRENT);
    expect(f).toMatchObject({
      expired: false, rateVersion: "A2026-1", ageMin: 0, ageMax: 70, coverToAge: 99,
      saMin: "10,000,000", saMinShort: "10 ล้าน", saMax: "50,000,000",
      premiumFloorPercent: 101,
    });
    expect(f.example.terms.map((x) => x.years)).toEqual([6, 12, 18]);
    for (const term of f.example.terms) {
      expect(term.premium).not.toBeNull();
      expect(term.total).not.toBeNull();
      expect(term.leverage).not.toBeNull();
    }
    // the surrender value reaches the whole sum assured at the end of cover
    expect(f.growth!.atEnd).toBe("10,000,000");
    expect(f.growth!.breakEvenAge).toBeGreaterThan(f.example.age);
  });

  it("shows no price at all once the rate table has lapsed", () => {
    const f = lifeTreasureFacts(AFTER_EXPIRY);
    expect(f.expired).toBe(true);
    expect(f.from.premium).toBeNull();
    for (const term of f.example.terms) {
      expect(term.premium).toBeNull();
      expect(term.total).toBeNull();
      expect(term.leverage).toBeNull();
    }
    // the surrender table does not depend on a price, so the growth block still reads
    expect(f.growth!.atEnd).toBe("10,000,000");
    expect(f.growth!.breakEvenAge).toBeNull();
  });
});

/** The engine still has to agree that an arrangement the page offers is one the company issues. */
describe("the plan behind the page", () => {
  it("issues every sum and age the calculator can be set to", () => {
    for (const age of [0, 70]) {
      for (const sumAssured of [10_000_000, 50_000_000]) {
        const result = quote(
          { planCode: "LIFETREASURE", variant: "H99F12A", age, sex: "M", mode: "annual", sumAssured, riders: [] },
          WHILE_CURRENT,
        );
        expect(result.items[0].eligible).toBe(true);
        expect(result.warnings.filter((w) => w.level === "error")).toEqual([]);
      }
    }
  });
});
