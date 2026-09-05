import { describe, expect, it } from "vitest";
import { legacyTable } from "@/lib/legacy-table";
import { legacyFacts } from "@/lib/legacy-facts";
import { getBundle } from "@/calc/bundles/registry";
import { bundleModePremiums } from "@/calc/bundles/quote";

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");

describe("legacyTable", () => {
  it("prices every age, sex and tier the bundle sells", () => {
    const t = legacyTable(WHILE_CURRENT);
    expect(t).toMatchObject({ ageMin: 20, ageMax: 65, tiers: 10, expired: false, diseaseCount: 31 });
    for (const sex of ["M", "F"] as const) {
      expect(t.premiums[sex]).toHaveLength(10);
      for (const tier of t.premiums[sex]) {
        expect(tier).toHaveLength(46);
        expect(tier.every((row) => row !== null)).toBe(true);
      }
    }
  });

  /**
   * The table is the page's only source of prices now, so a row that drifts from the engine
   * is a wrong price shown to a customer with nothing left to catch it.
   */
  it("carries the same figures the engine quotes", () => {
    const t = legacyTable(WHILE_CURRENT);
    const bundle = getBundle("LEGACY_FAMILY")!;
    for (const [tier, age, sex] of [[3, 38, "M"], [1, 30, "F"], [10, 65, "F"]] as const) {
      const modes = bundleModePremiums(bundle, tier, { age, sex }, WHILE_CURRENT)!;
      const row = t.premiums[sex][tier - 1][age - t.ageMin]!;
      expect(row.slice(0, 3)).toEqual(modes.map((m) => m.total));
      expect(row[3]).toBe(modes.find((m) => m.mode === "monthly")!.belowMinimum ? 1 : 0);
    }
  });

  it("marks the instalment the company will not take", () => {
    const t = legacyTable(WHILE_CURRENT);
    // หญิง 30 · มรดก 1 ล้าน is 371 baht a month, under the 1,000 baht floor
    expect(t.premiums.F[0][30 - t.ageMin]![3]).toBe(1);
    // ชาย 38 · มรดก 3 ล้าน is 1,501 and stands
    expect(t.premiums.M[2][38 - t.ageMin]![3]).toBe(0);
  });

  it("bands the death benefit on each side of the booster age", () => {
    const t = legacyTable(WHILE_CURRENT);
    expect(t.death[2].under).toMatchObject({
      sumBefore: 3_150_000, sumFrom: 3_000_000, alreadyPastAge: false,
      riderCoverEnds: { age: 75, sum: 150_000 },
    });
    expect(t.death[2].from).toMatchObject({ sumBefore: 3_000_000, alreadyPastAge: true });
  });
});

describe("legacyFacts", () => {
  it("takes the sales copy's figures from the engine", () => {
    const f = legacyFacts(WHILE_CURRENT);
    expect(f).toMatchObject({
      expired: false, rateVersion: "A2026-1", ageMin: 20, ageMax: 65, diseaseCount: 31,
      // หญิง 35 · มรดก 1 ล้าน: 4,858.50 บาท/ปี ÷ 365
      fromAge: 35, fromPerDay: 14,
      waiting: { youngAge: 30, young: "4,897", olderAge: 45, older: "10,716" },
    });
    expect(f.plan1).toEqual({
      base: "150,000", rider: "850,000", total: "1,000,000", before60: "1,150,000",
      endAge: 75, endSum: "150,000", critical: "850,000",
    });
  });
});

/**
 * The calculator already refuses to show a price once the rate table lapses. Before the
 * copy took its figures from the engine, the page went on advertising last year's premium
 * beside a calculator that had gone silent — the same defect as a benefit quoted past the
 * age it stops being paid.
 */
describe("once the rate table has lapsed", () => {
  const AFTER = new Date("2027-04-01");

  it("the table says so, even to a process that started while it was current", () => {
    legacyTable(WHILE_CURRENT); // warm the cache the way a live server would
    expect(legacyTable(AFTER).expired).toBe(true);
    expect(legacyTable(WHILE_CURRENT).expired).toBe(false);
  });

  it("the sales copy stops quoting a premium", () => {
    const f = legacyFacts(AFTER);
    expect(f.expired).toBe(true);
    expect(f.fromPerDay).toBeNull();
    expect(f.waiting).toBeNull();
  });

  /** The benefits do not come from the rate table, so they are still true and still shown. */
  it("but still says what the family receives", () => {
    expect(legacyFacts(AFTER).plan1.total).toBe("1,000,000");
  });
});

/**
 * A critical-illness claim is paid by the rider alone. The base policy pays on death, so it
 * stays in force — which is the good news — but it also means the cash in hand is the
 * rider's sum, not the tier's headline. The page said "the full amount", which overstated
 * every plan by the base sum.
 */
describe("what a living claimant receives", () => {
  it("is the rider's sum, one base policy short of the death benefit", () => {
    const t = legacyTable(WHILE_CURRENT);
    expect(t.critical).toEqual([
      850_000, 1_850_000, 2_850_000, 3_850_000, 4_850_000,
      5_850_000, 6_850_000, 7_850_000, 8_850_000, 9_850_000,
    ]);
    for (const [i, cash] of t.critical.entries()) {
      expect(t.death[i].from.sumFrom - cash).toBe(150_000);
    }
  });

  it("reaches the sales copy as a figure, not as a promise of the whole sum", () => {
    expect(legacyFacts(WHILE_CURRENT).plan1.critical).toBe("850,000");
  });
});
