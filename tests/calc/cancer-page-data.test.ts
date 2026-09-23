import { describe, expect, it } from "vitest";
import { cancerTable } from "@/lib/cancer-table";
import { cancerMessage, cancerQuoteText } from "@/lib/cancer-cta";
import { getBundle } from "@/calc/bundles/registry";
import { bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-23");

describe("cancerTable", () => {
  it("prices every age from birth to 65, both sexes, all eight tiers", () => {
    const t = cancerTable(WHILE_CURRENT);
    expect(t).toMatchObject({ ageMin: 0, ageMax: 65, expired: false });
    expect(t.tiers.map((x) => [x.cpr, x.hic, x.baseSum])).toEqual([
      [300_000, 1_000, 150_000], [500_000, 2_000, 150_000], [750_000, 3_000, 150_000], [1_000_000, 4_000, 200_000],
      [2_000_000, 5_000, 400_000], [3_000_000, 6_000, 600_000], [4_000_000, 8_000, 800_000], [5_000_000, 10_000, 1_000_000],
    ]);
    for (const sex of ["M", "F"] as const) {
      for (const [i, tier] of t.premiums[sex].entries()) {
        expect(tier).toHaveLength(66);
        expect(tier.every((row) => row !== null)).toBe(true);
        expect(t.parts[sex][i].every((row) => row !== null)).toBe(true);
      }
    }
  });

  it("carries the same figures the engine quotes, and its parts add up to them", () => {
    const t = cancerTable(WHILE_CURRENT);
    const bundle = getBundle("CANCER_SET")!;
    for (const [tier, age, sex] of [[1, 0, "M"], [4, 35, "F"], [8, 65, "F"], [6, 50, "M"]] as const) {
      const modes = bundleModePremiums(bundle, tier, { age, sex }, WHILE_CURRENT)!;
      const row = t.premiums[sex][tier - 1][age - t.ageMin]!;
      expect(row.slice(0, 3)).toEqual(modes.map((m) => m.total));
      const parts = t.parts[sex][tier - 1][age - t.ageMin]!;
      expect(parts[0] + parts[1] + parts[2]).toBe(row[0]);
    }
  });

  it("doubles the death benefit before 60, on each tier's own base", () => {
    const t = cancerTable(WHILE_CURRENT);
    expect(t.tiers.map((x) => x.death)).toEqual(t.tiers.map((x) => ({
      beforeAge: 60, sumBefore: 2 * x.baseSum, sumFrom: x.baseSum,
    })));
  });
});

describe("the cancer page's messages", () => {
  it("opens the chat on the figures on screen", () => {
    const q = quoteBundle(getBundle("CANCER_SET")!, 4, { age: 35, sex: "F", mode: "annual" }, WHILE_CURRENT)!;
    expect(cancerMessage({
      cpr: 1_000_000, hic: 4_000, age: 35, sex: "F", range: { min: 0, max: 65 },
      premium: { mode: "annual", total: q.totalAnnual, belowMinimum: false },
    })).toMatch(/^สนใจประกันมะเร็ง ทุน 1 ล้าน ชดเชยวันละ 4,000 อายุ 35 หญิง เบี้ยประมาณ [\d,.]+ บาท\/ปี$/);
    expect(cancerMessage({ cpr: 300_000, hic: 1_000, age: "other", sex: "M", range: { min: 0, max: 65 }, premium: undefined }))
      .toBe("สนใจประกันมะเร็ง ทุน 3 แสน ชดเชยวันละ 1,000 อายุนอกช่วง 0–65 ปี ขอแบบที่เหมาะกับอายุนี้");
  });

  it("pastes the stage amounts and the three contracts", () => {
    const modes = bundleModePremiums(getBundle("CANCER_SET")!, 8, { age: 30, sex: "M" }, WHILE_CURRENT)!;
    const text = cancerQuoteText({ cpr: 5_000_000, hic: 10_000, baseSum: 1_000_000, age: 30, sex: "M", modes, minMonthly: 1_000 });
    expect(text).toContain("ขั้น 1 มะเร็งระยะไม่ลุกลามขั้นต้น 50,000 บาท");
    expect(text).toContain("ขั้น 4 มะเร็งระยะลุกลาม 5,000,000 บาท");
    expect(text).toContain("วันละ 10,000 บาท สูงสุด 365 วัน");
    expect(text).toContain("Life Protect x 2 ชำระเบี้ยถึงอายุ 99 ทุน 1,000,000 บาท");
  });
});
