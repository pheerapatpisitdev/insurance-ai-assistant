import { describe, expect, it } from "vitest";
import { getPlan } from "@/calc/plans/registry";
import { quote } from "@/calc/quote";
import { quoteModePremiums } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import type { PayMode, Sex } from "@/calc/types";
import { plbTable } from "@/lib/plb-table";
import { coverEndsAt, perMillion, plbDiscount, plbModes, plbTakes, termAt, totalPaid } from "@/lib/plb-quote";
import { plbMessage, plbQuoteText } from "@/lib/plb-cta";
import { plbFacts } from "@/lib/plb-facts";

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");
const AFTER_EXPIRY = new Date("2027-04-01");

describe("plbTable", () => {
  it("carries the four terms, whose cover is as long as their premium", () => {
    const t = plbTable(WHILE_CURRENT);
    expect(t).toMatchObject({
      planCode: "PLB", ageMin: 20, ageMax: 59, expired: false, rateVersion: "A2026-1",
      minMonthly: 1000, saMin: 300_000, saMax: 5_000_000,
      modeFactors: { annual: 1, semi: 0.52, monthly: 0.09 },
    });
    expect(t.terms.map((x) => [x.variant, x.label, x.short, x.years])).toEqual([
      ["PLB05", "ชำระเบี้ย 5 ปี", "5 ปี", 5],
      ["PLB10", "ชำระเบี้ย 10 ปี", "10 ปี", 10],
      ["PLB12", "ชำระเบี้ย 12 ปี", "12 ปี", 12],
      ["PLB15", "ชำระเบี้ย 15 ปี", "15 ปี", 15],
    ]);
  });

  it("has a rate for every age and sex the plan issues at, and none outside", () => {
    const t = plbTable(WHILE_CURRENT);
    const rates = getPlan("PLB")!.rates;
    for (const term of t.terms) {
      for (const sex of ["M", "F"] as const) {
        expect(term.rates[sex]).toHaveLength(40);
        expect(term.rates[sex].every((r) => typeof r === "number")).toBe(true);
        // the table is indexed from the plan's own youngest age, not from zero
        expect(term.rates[sex][35 - t.ageMin]).toBe(rates.base.rates[term.variant][sex]["35"]);
      }
    }
    expect(plbTakes(t, 19)).toBe(false);
    expect(plbTakes(t, 20)).toBe(true);
    expect(plbTakes(t, 59)).toBe(true);
    expect(plbTakes(t, 60)).toBe(false);
  });

  /** Same defence as the other pages: a warm cache must not keep saying the table is current. */
  it("reports the lapse even when the table was built while it was current", () => {
    expect(plbTable(WHILE_CURRENT).expired).toBe(false);
    expect(plbTable(AFTER_EXPIRY).expired).toBe(true);
    expect(plbTable(WHILE_CURRENT).expired).toBe(false);
  });
});

/**
 * The page prices itself in the browser from its own copy of the tables. That copy is only
 * worth having if it agrees with the engine to the satang — and for PLB the thing most
 * likely to break that is the sum-assured discount, which no other page has to apply.
 */
describe("the browser's arithmetic against the engine", () => {
  const t = plbTable(WHILE_CURRENT);
  // one sum in each discount band, including the two that share a rate
  const SUMS = [300_000, 350_000, 499_999, 500_000, 700_000, 999_999, 1_000_000, 5_000_000];

  it("agrees with quote() for every term, age, sex and discount band", () => {
    for (const term of t.terms) {
      for (const age of [20, 35, 44, 59]) {
        for (const sex of ["M", "F"] as Sex[]) {
          for (const sumAssured of SUMS) {
            const mine = plbModes(t, term, { sex, age, sumAssured })!;
            const theirs = quoteModePremiums(
              { planCode: "PLB", variant: term.variant, age, sex, mode: "annual", sumAssured, riders: [] },
              WHILE_CURRENT,
            )!;
            expect(mine.map((m) => [m.mode, m.total])).toEqual(theirs.map((m) => [m.mode, m.total]));
          }
        }
      }
    }
  });

  it("takes the discount off the rate before the sum, the way base-premium does", () => {
    expect(plbDiscount(t, "PLB12", 299_999)).toBe(0);
    expect(plbDiscount(t, "PLB12", 350_000)).toBe(0);
    expect(plbDiscount(t, "PLB12", 500_000)).toBe(0.5);
    expect(plbDiscount(t, "PLB12", 999_999)).toBe(0.5);
    expect(plbDiscount(t, "PLB12", 1_000_000)).toBe(1);
    // ชาย 35 · PLB12 is 6.47 per thousand; at a million the rate paid is 5.47
    const annual = plbModes(t, termAt(t, "PLB12"), { sex: "M", age: 35, sumAssured: 1_000_000 })!
      .find((m) => m.mode === "annual")!;
    expect(annual.total).toBe(547_000);
  });

  it("flags a monthly instalment the company would refuse", () => {
    // หญิง 20 · PLB10 on the smallest sum is far under the 1,000 baht monthly floor
    const modes = plbModes(t, termAt(t, "PLB10"), { sex: "F", age: 20, sumAssured: 300_000 })!;
    expect(modes.find((m) => m.mode === "monthly")!.belowMinimum).toBe(true);
    expect(modes.find((m) => m.mode === "annual")!.belowMinimum).toBe(false);
  });
});

describe("what the contract is worth saying", () => {
  const t = plbTable(WHILE_CURRENT);
  const term = termAt(t, "PLB12");

  it("ends the cover on the last year the premium is paid for", () => {
    expect(coverEndsAt(term, 35)).toBe(47);
    expect(coverEndsAt(termAt(t, "PLB05"), 59)).toBe(64);
  });

  it("adds the premium up over the term and scales it to a million", () => {
    const annual = plbModes(t, term, { sex: "M", age: 35, sumAssured: 1_000_000 })!
      .find((m) => m.mode === "annual")!;
    expect(totalPaid(annual.total, term)).toBe(547_000 * 12);
    expect(perMillion(annual.total, 1_000_000)).toBe(5_470);
    // the same cover bought in a smaller piece costs more per million — the discount, visible
    const small = plbModes(t, term, { sex: "M", age: 35, sumAssured: 300_000 })!
      .find((m) => m.mode === "annual")!;
    expect(perMillion(small.total, 300_000)).toBe(6_470);
  });
});

describe("what the customer sends, and what the agent pastes", () => {
  const t = plbTable(WHILE_CURRENT);
  const term = termAt(t, "PLB12");
  const who = { sex: "M" as Sex, age: 35, sumAssured: 1_000_000 };
  const modes = plbModes(t, term, who)!;
  const headline = modes.find((m) => m.mode === "monthly")!;

  it("opens the chat with the figures already on screen", () => {
    expect(plbMessage({
      sumAssured: who.sumAssured, termLabel: term.label, age: who.age, sex: who.sex,
      ageMax: t.ageMax, premium: headline,
    })).toBe(`สนใจ Protection Life ทุน 1,000,000 ชำระเบี้ย 12 ปี อายุ 35 ชาย เบี้ยประมาณ ${formatBaht(headline.total)} บาท/เดือน`);
  });

  it("asks for a plan that fits when the customer is past the oldest age", () => {
    expect(plbMessage({
      sumAssured: 1_000_000, termLabel: term.label, age: "over", sex: "M",
      ageMax: t.ageMax, premium: undefined,
    })).toBe("สนใจ Protection Life ทุน 1,000,000 อายุเกิน 59 ปี ขอแบบที่เหมาะกับอายุนี้");
  });

  it("says in the quote itself that nothing comes back at the end", () => {
    const annual = modes.find((m) => m.mode === "annual")!;
    const text = plbQuoteText({
      sumAssured: who.sumAssured, termLabel: term.label, age: who.age, sex: who.sex,
      years: term.years, endsAtAge: coverEndsAt(term, who.age),
      modes: [headline, ...modes.filter((m) => m.mode !== headline.mode)],
      total: totalPaid(annual.total, term),
    });
    expect(text).toContain("คุ้มครอง 12 ปี (ถึงอายุ 47)");
    expect(text).toContain("1,000,000 บาท ตลอด 12 ปีที่คุ้มครอง");
    expect(text).toContain("ไม่มีเงินคืน");
    // one instalment a line, smallest first, as on every other page
    const lines = text.split("\n");
    expect(lines.filter((l) => l.startsWith("รายเดือน ") || l.startsWith("ราย 6 เดือน ") || l.startsWith("รายปี "))
      .map((l) => l.split(" ")[0])).toEqual(["รายเดือน", "ราย", "รายปี"]);
  });
});

describe("plbFacts", () => {
  it("quotes the copy's figures off the rate table", () => {
    const f = plbFacts(WHILE_CURRENT);
    expect(f).toMatchObject({
      expired: false, rateVersion: "A2026-1", ageMin: 20, ageMax: 59,
      saMin: "300,000", saMinShort: "3 แสน", saMax: "5,000,000",
      discount: { perThousand: 1, fromSum: "1,000,000", fromSumShort: "1 ล้าน" },
    });
    expect(f.from.perDay).toBeGreaterThan(0);
    expect(f.example.terms.map((x) => [x.years, x.endsAtAge])).toEqual([[5, 40], [10, 45], [12, 47], [15, 50]]);
    for (const term of f.example.terms) {
      expect(term.premium).not.toBeNull();
      expect(term.total).not.toBeNull();
    }
    // the discount really is worth what the copy claims
    expect(f.scale!.small.perMillion).toBe("6,470");
    expect(f.scale!.big.perMillion).toBe("5,470");
    expect(f.scale!.savedPercent).toBe(15);
  });

  it("shows no price at all once the rate table has lapsed", () => {
    const f = plbFacts(AFTER_EXPIRY);
    expect(f.expired).toBe(true);
    expect(f.from.perDay).toBeNull();
    expect(f.scale).toBeNull();
    for (const term of f.example.terms) {
      expect(term.premium).toBeNull();
      expect(term.total).toBeNull();
    }
  });
});

/** The engine still has to agree that an arrangement the page offers is one the company issues. */
describe("the plan behind the page", () => {
  it("issues every sum and age the calculator can be set to", () => {
    for (const age of [20, 59]) {
      for (const sumAssured of [300_000, 5_000_000]) {
        for (const mode of ["annual", "monthly"] as PayMode[]) {
          const result = quote(
            { planCode: "PLB", variant: "PLB12", age, sex: "M", mode, sumAssured, riders: [] },
            WHILE_CURRENT,
          );
          expect(result.items[0].eligible).toBe(true);
          // the monthly floor is a warning about an instalment, not a refusal of the plan
          expect(result.warnings.filter((w) => w.level === "error" && w.code !== "MIN_MONTHLY")).toEqual([]);
        }
      }
    }
  });
});
