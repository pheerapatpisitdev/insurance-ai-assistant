import { describe, expect, it } from "vitest";
import { valueTableCard } from "@/lib/quote-card";
import { quote } from "@/calc/quote";
import { getPlan } from "@/calc/plans/registry";
import { cashValueSchedule } from "@/calc/cash-value";
import { coverRows } from "@/lib/cover-rows";
import { plbTable } from "@/lib/plb-table";
import { plbModes, termAt } from "@/lib/plb-quote";

/**
 * PLB's table, which is a table of cover rather than of value.
 *
 * The plan is protection and nothing else — คุ้มครองล้วน ไม่มีมูลค่าเวนคืนและไม่มีเงินคืนเมื่อ
 * ครบสัญญา — so there is no surrender column to show, and the workbook has none to give
 * either: its CV sheets belong to PR60, the retirement plan the file was copied from, and
 * its summary sheet still answers #REF! where PR60's savings figures used to be.
 *
 * What is pinned here is the shape that follows from that, and the one fact a customer of a
 * term plan most needs: the year the cover stops.
 */

const CARD = { kind: "plan" as const, planCode: "PLB", variant: "PLB12", age: 35, sex: "M" as const, sumAssured: 1_000_000 };

describe("the table PLB is drawn as", () => {
  const card = valueTableCard(CARD)!;

  it("has no surrender column, because the plan has no surrender value", () => {
    expect(card.columns).toEqual(["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "คุ้มครอง"]);
    expect(card.rows.every((r) => r.cash === undefined)).toBe(true);
    // nothing was quietly borrowed from the PR60 sheets sitting in the same workbook
    expect(cashValueSchedule("PLB", "PLB12", "M", 35, 1_000_000)).toEqual([]);
    expect(getPlan("PLB")?.coverTopUp).toBeUndefined();
  });

  it("runs exactly as long as the premium is paid", () => {
    // สรุปผลประโยชน์!D36 (ระยะเวลาคุ้มครอง) and E36 (ระยะเวลาชำระเบี้ย) are the same formula
    expect(getPlan("PLB")?.rates.base.coverTerm).toEqual({ PLB05: 5, PLB10: 10, PLB12: 12, PLB15: 15 });
    expect(getPlan("PLB")?.rates.base.payTerm).toEqual({ PLB05: 5, PLB10: 10, PLB12: 12, PLB15: 15 });

    expect(card.rows).toHaveLength(12);
    expect(card.rows[0]).toMatchObject({ year: 1, age: 35 });
    expect(card.rows[11]).toMatchObject({ year: 12, age: 46 });
    // the premium falls due in every one of those years — there is no paid-up period
    expect(card.rows.every((r) => r.due !== "—")).toBe(true);
  });

  it("says the year the cover ends, which is what a term plan is misread about", () => {
    expect(card.notes[0]).toBe("คุ้มครอง 12 ปี ถึงอายุ 47 ปี แล้วสัญญาสิ้นสุด");
    expect(card.notes).toContain("คุ้มครองล้วน ไม่มีมูลค่าเวนคืนและไม่มีเงินคืนเมื่อครบสัญญา");
  });

  it("carries the engine's own premium, and adds it up", () => {
    const expected = quote({
      planCode: "PLB", variant: "PLB12", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: [],
    });
    const yearly = Math.round(expected.totalAnnual / 100);
    expect(card.premiumLine).toBe(`เบี้ย ${yearly.toLocaleString("en-US")} บาทต่อปี · ชำระ 12 ปี`);
    expect(card.rows[0].due).toBe(yearly.toLocaleString("en-US"));
    expect(card.rows[11].paid).toBe((yearly * 12).toLocaleString("en-US"));
  });

  it("covers the sum assured, flat, for every year of the term", () => {
    expect(new Set(card.rows.map((r) => r.cover))).toEqual(new Set(["1,000,000"]));
  });

  it("draws each of the four terms for its own length", () => {
    for (const [variant, years] of [["PLB05", 5], ["PLB10", 10], ["PLB15", 15]] as const) {
      const other = valueTableCard({ ...CARD, variant })!;
      expect(other.rows, variant).toHaveLength(years);
      expect(other.notes[0], variant).toContain(`คุ้มครอง ${years} ปี`);
    }
  });

  it("is not drawn at all for an insured the plan will not take", () => {
    // PLB is sold from 20 to 59, and a table for a contract nobody can buy is a fiction
    expect(valueTableCard({ ...CARD, age: 65 })).toBeUndefined();
  });
});

/**
 * The page shows this table now, not only the picture of it.
 *
 * Both are built by `coverRows`, and this is the test that says so: the page computes its
 * rows from what the calculator already has in hand, the card computes its own from the
 * engine, and a customer reading the page while the agent sends the picture must be looking
 * at the same twelve years. Two places computing one table eventually disagree by a baht or
 * a year, and nothing says which is right.
 */
describe("the table on the page and the picture of it", () => {
  it("are the same rows, built by the same loop", () => {
    const table = plbTable();
    const term = termAt(table, "PLB12");
    const annual = plbModes(table, term, { sex: "M", age: 35, sumAssured: 1_000_000 })!
      .find((m) => m.mode === "annual")!;

    const onPage = coverRows({
      years: term.years,
      payYears: term.years,
      age: 35,
      annualSatang: annual.total,
      coverSatang: 1_000_000 * 100,
    });

    expect(onPage).toEqual(valueTableCard(CARD)!.rows);
  });
});
