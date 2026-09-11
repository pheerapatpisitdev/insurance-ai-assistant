import { describe, expect, it } from "vitest";
import { formatBaht } from "@/calc/money";
import { cashProjection } from "@/lib/cash-projection";
import { iShieldTable } from "@/lib/ishield-table";
import {
  cashAt, deathBenefitOf, iShieldModes, illnessBenefit, payYears, termAt, termTakes,
} from "@/lib/ishield-quote";
import diseases from "../../data/riders/ishield-diseases.json";

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");

describe("iShieldTable", () => {
  it("carries the four payment terms with the oldest age each one takes", () => {
    const t = iShieldTable(WHILE_CURRENT);
    expect(t).toMatchObject({
      planCode: "ISHIELD", ageMin: 0, ageMax: 56, expired: false, rateVersion: "A2026-1",
      minMonthly: 1000, saMin: 100_000, saMax: 5_000_000, maturityAge: 85,
      topUp: { premiumPercent: 100, includeCashValue: false },
      illness: { earlyCount: 20, earlyPercent: 25, majorCount: 50, majorPercent: 100, waitingDays: 90 },
      modeFactors: { annual: 1, semi: 0.52, monthly: 0.09 },
    });
    expect(t.terms.map((x) => [x.variant, x.label, x.payTerm, x.ageMax])).toEqual([
      ["WLCI05", "ชำระเบี้ย 5 ปี", 5, 52],
      ["WLCI10", "ชำระเบี้ย 10 ปี", 10, 51],
      ["WLCI15", "ชำระเบี้ย 15 ปี", 15, 56],
      ["WLCI20", "ชำระเบี้ย 20 ปี", 20, 52],
    ]);
  });

  it("offers a term only at the ages it is sold at", () => {
    const t = iShieldTable(WHILE_CURRENT);
    // at 56 only the fifteen-year term is left
    expect(t.terms.filter((x) => termTakes(t, x, 56)).map((x) => x.variant)).toEqual(["WLCI15"]);
    expect(t.terms.filter((x) => termTakes(t, x, 51)).map((x) => x.variant)).toEqual(["WLCI05", "WLCI10", "WLCI15", "WLCI20"]);
    expect(t.terms.filter((x) => termTakes(t, x, 0)).map((x) => x.variant)).toHaveLength(4);
    for (const term of t.terms) {
      const past = term.ageMax + 1;
      expect(iShieldModes(t, term, { sex: "M", age: past, sumAssured: 500_000 })).toBeUndefined();
      // past the term's own oldest age there is no schedule — either a null entry, or off
      // the end of the array when that age is past the whole plan's oldest too
      expect(term.schedule.M[past] ?? null).toBeNull();
    }
  });
});

/**
 * ชาย 11 ปี · ทุน 500,000 · iShield 10 is the arrangement the company's own proposal prints,
 * so every figure below can be read off that document.
 */
describe("the company's own proposal, read back", () => {
  const t = iShieldTable(WHILE_CURRENT);
  const term = termAt(t, "WLCI10");
  const who = { sex: "M" as const, age: 11, sumAssured: 500_000 };
  const modes = iShieldModes(t, term, who)!;

  it("prices the base contract at 22,105 a year", () => {
    expect(formatBaht(modes.find((m) => m.mode === "annual")!.total)).toBe("22,105");
  });

  it("pays a quarter of the sum on an early-stage illness and all of it on a major one", () => {
    expect(illnessBenefit(t, who.sumAssured)).toEqual({ early: 125_000, major: 500_000 });
  });

  it("reads the surrender values the proposal's table prints", () => {
    const p = cashProjection({
      factors: term.schedule.M[who.age]!, age: who.age, sumAssured: who.sumAssured,
      annualSatang: modes[0].total, payYears: payYears(term),
      death: deathBenefitOf(who.sumAssured), topUp: t.topUp,
    });
    expect(p.rows).toHaveLength(74);
    expect(p.maturityAge).toBe(85);
    // policy years 1 to 10, the years the premium is paid
    expect(p.rows.slice(0, 10).map((r) => r.cashValue / 100)).toEqual([
      0, 7_000, 23_000, 39_000, 58_500, 74_500, 90_500, 107_000, 124_000, 141_000,
    ]);
    expect(p.rows[9].premiumPaid! / 100).toBe(221_050);
    // and nothing more is due after the tenth
    expect(p.rows[10].premiumDue).toBe(0);
    expect(p.rows[10].premiumPaid! / 100).toBe(221_050);
    // ปีที่ 44 · อายุ 54 is 302,500 in the right-hand half of the proposal's table
    expect(p.rows[43].cashValue / 100).toBe(302_500);
    // staying to the end hands back the whole sum assured
    expect(p.rows[73].cashValue / 100).toBe(500_000);
  });

  it("holds the cover at the sum assured, which the premiums never overtake here", () => {
    const p = cashProjection({
      factors: term.schedule.M[who.age]!, age: who.age, sumAssured: who.sumAssured,
      annualSatang: modes[0].total, payYears: payYears(term),
      death: deathBenefitOf(who.sumAssured), topUp: t.topUp,
    });
    expect(new Set(p.rows.map((r) => r.cover))).toEqual(new Set([50_000_000]));
  });

  it("quotes the milestones the card shows", () => {
    expect(cashAt(term, "M", who.age, who.sumAssured, t.ageMin)).toEqual([
      { age: 60, amount: 338_000 }, { age: 70, amount: 395_000 },
      { age: 80, amount: 455_500 }, { age: 85, amount: 500_000 },
    ]);
  });
});

describe("the illnesses iShield covers", () => {
  it("carries twenty early-stage and fifty major-stage, named without their numbering", () => {
    expect(diseases.early).toHaveLength(20);
    expect(diseases.major).toHaveLength(50);
    expect(diseases.early[0]).toBe("การใส่เครื่องกระตุ้นหัวใจ");
    expect(diseases.major[0]).toBe("โรคสมองเสื่อมชนิดอัลไซเมอร์");
    expect(diseases.major[49]).toBe("อีโบล่า");
    for (const name of [...diseases.early, ...diseases.major]) {
      expect(name).not.toMatch(/^\s*\d/);
      expect(name.trim()).toBe(name);
    }
  });
});
