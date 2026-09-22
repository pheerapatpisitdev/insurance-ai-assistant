import { describe, expect, it } from "vitest";
import { benefitCell, cellRuns } from "@/components/ihealthy/BenefitTable";
import { iHealthyFacts, isHeading, type BenefitRow } from "@/lib/ihealthy-facts";

const facts = iHealthyFacts();
const ALL = facts.plans.map((p) => p.code);
/** what the rate table sells an eight-year-old, from tests/calc/ihealthy-quote.test.ts */
const CHILD_PLANS = ["SMART", "BRONZE"];

const row = (no: number) => facts.rows.find((r): r is BenefitRow => !isHeading(r) && r.no === no)!;

/** a row the extract could produce but the current sheet does not: a gap and a missing plan */
const patchy: BenefitRow = {
  no: 99,
  title: "หมวดที่ 99 แถวที่สกัดออกมาไม่ครบ",
  endorsement: false,
  adult: { SMART: "", BRONZE: "  ", SILVER: "1,000 ต่อวัน" },
};

describe("benefitCell", () => {
  it("prints nothing for a heading", () => {
    const heading = facts.rows.find(isHeading)!;
    expect(benefitCell(heading, "SMART", 35, ALL)).toEqual({ text: "", unavailable: false });
  });

  it("withholds the figure for a plan this age cannot buy, whatever the sheet holds", () => {
    // ซิลเวอร์ pays on หมวดที่ 1 at every age; at eight it is simply not on offer
    expect(row(1).adult.SILVER).toBeTruthy();
    // the reason is the column header's to say, so the cell itself is only a placeholder
    expect(benefitCell(row(1), "SILVER", 8, CHILD_PLANS)).toEqual({ text: "-", unavailable: true });
  });

  it("says so for a plan code the rate table has never heard of", () => {
    expect(benefitCell(row(1), "TITANIUM", 35, ALL)).toEqual({ text: "-", unavailable: true });
  });

  it("gives every row and heading a key of its own", () => {
    // the table keys its rows on this wording; a re-run of the extract script that repeated
    // one would have React reconcile two rows as one, and say nothing about it
    const keys = facts.rows.map((e) => (isHeading(e) ? e.heading : e.title));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("reads a blank cell as a dash rather than as an empty gap", () => {
    expect(benefitCell(patchy, "SMART", 35, ALL)).toEqual({ text: "-", unavailable: false });
    // a cell of spaces is a blank cell: it would otherwise draw a row with nothing in it
    expect(benefitCell(patchy, "BRONZE", 35, ALL)).toEqual({ text: "-", unavailable: false });
  });

  it("reads a column the extract dropped as a dash, not as nothing to pay", () => {
    expect(patchy.adult.PLATINUM).toBeUndefined();
    expect(benefitCell(patchy, "PLATINUM", 35, ALL)).toEqual({ text: "-", unavailable: false });
  });

  it("keeps the company's own dash on a row a plan does not cover", () => {
    // หมวดที่ 20 is the endorsement's, and สมาร์ท does not carry it
    expect(benefitCell(row(20), "SMART", 35, ALL)).toEqual({ text: "-", unavailable: false });
  });

  it("gives หมวดที่ 3 the child wording below eleven and the adult wording from eleven", () => {
    expect(benefitCell(row(3), "SMART", 10, ALL).text).toBe("1,000 ต่อวัน*/ ตามที่จ่ายจริง");
    expect(benefitCell(row(3), "SMART", 11, ALL).text).toBe("ตามที่จ่ายจริง");
    // the sheet gives a child wording to สมาร์ท and บรอนซ์ only; the rest keep theirs
    expect(benefitCell(row(3), "SILVER", 10, ALL).text).toBe(row(3).adult.SILVER);
  });

  it("passes a real figure through verbatim", () => {
    expect(benefitCell(row(1), "SMART", 35, ALL)).toEqual({
      text: "1,500 ต่อวัน",
      unavailable: false,
    });
    expect(benefitCell(row(1), "PLATINUM", 35, ALL).text).toBe(row(1).adult.PLATINUM);
  });
  it("groups a cell the workbook stored as a number, and leaves the rest alone", () => {
    const opd = facts.rows.find((r) => !isHeading(r) && r.no === 18)! as BenefitRow;
    // the sheet holds 6000 as a number and "1,500 ต่อวัน" as text; both reach a customer
    expect(benefitCell(opd, "SILVER", 35, ALL).text).toBe("6,000");
    const room = facts.rows.find((r) => !isHeading(r) && r.no === 1)! as BenefitRow;
    expect(benefitCell(room, "SMART", 35, ALL).text).toBe("1,500 ต่อวัน");
  });

});

describe("cellRuns", () => {
  const runsFor = (no: number, plans: string[] = ALL) =>
    cellRuns(plans.map((p) => benefitCell(row(no), p, 35, plans)), plans);
  /** each run as "what it says ×how many columns", which is what the table draws */
  const shape = (no: number, plans: string[] = ALL) =>
    runsFor(no, plans).map((r) => `${r.cell.text} ×${r.plans.length}`);

  it("gathers a row the six plans agree on into one cell", () => {
    // หมวดที่ 3 is ตามที่จ่ายจริง in every plan, which is half the sheet's rows
    expect(shape(3)).toEqual(["ตามที่จ่ายจริง ×6"]);
  });

  it("leaves a row where every plan differs as six cells", () => {
    // หมวดที่ 1 is the room rate, which is the whole reason the plans are priced apart
    expect(runsFor(1)).toHaveLength(6);
    expect(runsFor(1).every((r) => r.plans.length === 1)).toBe(true);
  });

  it("gathers only the neighbours that agree, and keeps the rest apart", () => {
    // หมวดที่ 18: the two cheapest plans do not cover it, then three figures, then in full
    expect(shape(18)).toEqual([
      "- ×2", "6,000 ×1", "12,000 ×1", "60,000 ×1", "ตามที่จ่ายจริง ×1",
    ]);
  });

  it("merges over whichever columns it is given, which is how a phone gets its own cells", () => {
    // a phone lays out three of the six; a cell merged across all six would cover columns
    // it is not drawing and take their width back, sliding every figure a plan to the right
    const phone = ["BRONZE", "SILVER", "GOLD"];
    expect(shape(18, phone)).toEqual(["- ×1", "6,000 ×1", "12,000 ×1"]);
    expect(shape(3, phone)).toEqual(["ตามที่จ่ายจริง ×3"]);
  });

  it("does not merge a dash the company printed with a dash standing in for a plan not on offer", () => {
    // at eight only ซิลเวอร์ upward is withheld, and หมวดที่ 21 is a dash of the sheet's own
    // in the plans below it — alike on screen, and not the same statement
    const runs = cellRuns(ALL.map((p) => benefitCell(row(21), p, 8, CHILD_PLANS)), ALL);
    expect(runs.map((r) => [r.cell.text, r.cell.unavailable, r.plans.length])).toEqual([
      ["-", false, 2],
      ["-", true, 4],
    ]);
  });

  it("stands a lone column up on its own", () => {
    expect(cellRuns([{ text: "x", unavailable: false }], ["SMART"]))
      .toEqual([{ cell: { text: "x", unavailable: false }, plans: ["SMART"] }]);
    expect(cellRuns([], [])).toEqual([]);
  });
});
