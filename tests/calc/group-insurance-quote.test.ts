/**
 * The group quotation, against figures taken off the insurer's own sheets.
 *
 * The two spot-checks at the top are the ones the standalone tool was signed off against, so
 * they are the anchor: if this file and that tool ever disagree, an agent has quoted two
 * different prices for the same employer.
 *
 * The rest are the three rules that a port gets wrong — the band coming from the total, OPD
 * ignoring the band, and ME not ignoring it — each written so that a wrong implementation
 * fails rather than merely looking different.
 */
import { describe, expect, it } from "vitest";
import { computeMultiGroupQuote, makeQuoteNo, type GroupInput } from "@/lib/group-insurance/quote";
import { GI } from "@/lib/group-insurance/data";

function group(over: Partial<GroupInput> = {}): GroupInput {
  return { id: "g1", name: "", bizType: "biz1", planIdx: 0, includeRider: true, riderIdx: 0, count: "10", ...over };
}

describe("group insurance premium", () => {
  it("prices the signed-off health case: biz1, 10 people, plan 1 + OPD 1", () => {
    const q = computeMultiGroupQuote("health", [group({ count: "10" })]);
    expect(q.band).toBe("10-25");
    expect(q.groups[0].perPerson).toBe(4241);
    expect(q.groups[0].subtotal).toBe(42410);
    expect(q.grandTotal).toBe(42410);
    expect(q.withinLimit).toBe(true);
  });

  it("prices the signed-off PA case: biz1, 5 people, P1 + ME 10,000", () => {
    const q = computeMultiGroupQuote("pa", [group({ count: "5" })]);
    expect(q.band).toBe("5-19");
    expect(q.groups[0].perPerson).toBe(380);
    expect(q.groups[0].subtotal).toBe(1900);
  });

  it("reads the band off the total head count, not each group's own", () => {
    // Five and five: neither half reaches health's ten-person minimum, but together they are
    // a group of ten and both halves are priced at the 10-25 rate.
    const q = computeMultiGroupQuote("health", [
      group({ id: "a", count: "5" }),
      group({ id: "b", count: "5" }),
    ]);
    expect(q.totalCount).toBe(10);
    expect(q.band).toBe("10-25");
    expect(q.withinLimit).toBe(true);
    for (const g of q.groups) expect(g.perPerson).toBe(4241);
  });

  it("moves every group to a cheaper band when the total crosses into one", () => {
    const small = computeMultiGroupQuote("health", [group({ count: "25" })]);
    const large = computeMultiGroupQuote("health", [group({ count: "25" }), group({ id: "b", count: "5" })]);
    expect(small.band).toBe("10-25");
    expect(large.band).toBe("26-50");
    // the 25-person group did not change, yet its rate did — that is the rule under test
    expect(large.groups[0].mainPremium).toBeLessThan(small.groups[0].mainPremium);
  });

  it("prices health OPD without the band, and PA ME with it", () => {
    const small = computeMultiGroupQuote("health", [group({ count: "10" })]);
    const big = computeMultiGroupQuote("health", [group({ count: "80" })]);
    expect(small.band).not.toBe(big.band);
    expect(small.groups[0].riderPremium).toBe(big.groups[0].riderPremium);
    expect(small.groups[0].mainPremium).not.toBe(big.groups[0].mainPremium);

    const paSmall = computeMultiGroupQuote("pa", [group({ count: "5" })]);
    const paBig = computeMultiGroupQuote("pa", [group({ count: "500" })]);
    expect(paSmall.groups[0].riderPremium).toBeGreaterThan(paBig.groups[0].riderPremium);
  });

  it("charges nothing for a rider that is switched off", () => {
    const off = computeMultiGroupQuote("health", [group({ includeRider: false })]);
    expect(off.groups[0].riderPremium).toBe(0);
    expect(off.groups[0].perPerson).toBe(off.groups[0].mainPremium);
  });

  it("adds the groups up rather than re-deriving the total", () => {
    const q = computeMultiGroupQuote("pa", [
      group({ id: "a", count: "12", planIdx: 2, riderIdx: 1 }),
      group({ id: "b", count: "30", bizType: "biz3", planIdx: 5, includeRider: false }),
    ]);
    expect(q.totalCount).toBe(42);
    expect(q.grandTotal).toBe(q.groups.reduce((s, g) => s + g.subtotal, 0));
    expect(q.groups[1].riderPremium).toBe(0);
  });

  it("says a group is out of limits instead of refusing to price it", () => {
    const tooSmall = computeMultiGroupQuote("health", [group({ count: "4" })]);
    expect(tooSmall.withinLimit).toBe(false);
    expect(tooSmall.min).toBe(10);
    expect(tooSmall.max).toBe(100);
    // the page still has numbers to show while the agent finishes typing
    expect(tooSmall.groups[0].perPerson).toBeGreaterThan(0);

    const tooBig = computeMultiGroupQuote("health", [group({ count: "500" })]);
    expect(tooBig.withinLimit).toBe(false);
  });

  it("survives an empty count field mid-keystroke", () => {
    const q = computeMultiGroupQuote("health", [group({ count: "" })]);
    expect(q.totalCount).toBe(0);
    expect(q.grandTotal).toBe(0);
    expect(q.withinLimit).toBe(false);
  });

  it("rounds nothing", () => {
    const q = computeMultiGroupQuote("pa", [group({ count: "7", bizType: "biz2", planIdx: 3 })]);
    const g = q.groups[0];
    expect(g.subtotal).toBe(g.perPerson * 7);
    expect(g.perPerson).toBe(g.mainPremium + g.riderPremium);
  });
});

describe("the tables themselves", () => {
  it("gives every risk class six plans in every band", () => {
    for (const [name, table] of [
      ["health IPD", GI.healthIpdPremiums],
      ["PA main", GI.paMainPremiums],
      ["PA ME", GI.paMePremiums],
    ] as const) {
      for (const biz of ["biz1", "biz2", "biz3"] as const) {
        for (const [band, row] of Object.entries(table[biz])) {
          expect(row, `${name} ${biz} ${band}`).toHaveLength(6);
          for (const v of row) expect(v, `${name} ${biz} ${band}`).toBeGreaterThan(0);
        }
      }
    }
    for (const biz of ["biz1", "biz2", "biz3"] as const) {
      expect(GI.healthOpdPremiums[biz]).toHaveLength(6);
    }
  });

  it("gives every benefit row a figure for all six plans", () => {
    for (const b of [...GI.healthBenefits, ...GI.paMainBenefits]) {
      expect(b.values, b.key).toHaveLength(6);
    }
  });

  it("covers every band the product can land in", () => {
    for (const biz of ["biz1", "biz2", "biz3"] as const) {
      expect(Object.keys(GI.healthIpdPremiums[biz]).sort()).toEqual([...GI.healthEmployeeRanges].sort());
      expect(Object.keys(GI.paMainPremiums[biz]).sort()).toEqual([...GI.paEmployeeRanges].sort());
    }
  });
});

describe("quotation number", () => {
  it("carries the date and tells two quotations a minute apart apart", () => {
    const a = makeQuoteNo(new Date(2026, 8, 19, 10, 30, 0));
    const b = makeQuoteNo(new Date(2026, 8, 19, 10, 31, 0));
    expect(a).toMatch(/^QT-20260919-\d{3}$/);
    expect(a).not.toBe(b);
  });
});
