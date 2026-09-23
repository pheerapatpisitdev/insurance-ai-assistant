import { describe, expect, it } from "vitest";
import { getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange, quoteBundle } from "@/calc/bundles/quote";
import { quoteCard, type BundleCardInput, type QuoteCard } from "@/lib/quote-card";
import { CPR_STAGES, cprStagePays } from "@/lib/cancer-benefits";

/** The rate table behind these figures lapses on 2027-03-31. */
const TODAY = new Date("2026-09-23");
const bundle = getBundle("CANCER_SET")!;

describe("the cancer set", () => {
  /**
   * CPR may be at most 5× the base, so at the base's 150,000 minimum it tops out at 750,000;
   * the last two tiers only raise HIC, whose daily amount the workbook lists as 1,000–10,000.
   */
  it("sells five tiers of CPR and HIC on Life Protect+ 100 at its 150,000 minimum", () => {
    expect(bundle.planCode).toBe("LIFEPROTECT");
    expect(bundle.variant).toBe("WLF99H");
    expect(bundle.tiers.map((t) => t.sumAssured)).toEqual(Array(5).fill(150_000));
    expect(bundle.tiers.map((t) => t.riders)).toEqual([
      [300_000, 1_000], [500_000, 2_000], [750_000, 3_000], [750_000, 5_000], [750_000, 10_000],
    ].map(([cpr, hic]) => [{ code: "CPR", sumAssured: cpr }, { code: "HIC", sumAssured: hic }]));
  });

  it("is sold from birth to 65, the riders' own age limits", () => {
    expect(bundleAgeRange(bundle)).toEqual({ min: 0, max: 65 });
  });

  it("issues every tier at every age it offers", () => {
    for (const tier of bundle.tiers) {
      for (const sex of ["M", "F"] as const) {
        for (let age = 0; age <= 65; age++) {
          const q = quoteBundle(bundle, tier.no, { age, sex, mode: "annual" }, TODAY)!;
          expect(q.warnings.filter((w) => w.level === "error"), `tier ${tier.no} ${sex}${age}`).toEqual([]);
        }
      }
    }
  });

  /**
   * Cal!G37 ROUNDDOWN(rate × SA / 1000, 2) and Cal!G38 ROUND(rate × SA / 1000, 2) with the
   * workbook's age-30 male rates 0.28 (CPR) and 11.39 (HIC), on top of the 2,160 base.
   */
  it("prices a man of 30 on tier 3 as the workbook does", () => {
    const q = quoteBundle(bundle, 3, { age: 30, sex: "M", mode: "annual" }, TODAY)!;
    const annual = Object.fromEntries(q.items.map((i) => [i.code, i.annual]));
    // the engine counts in satang
    expect(annual).toEqual({ WLF99H: 216_000, CPR: 21_000, HIC: 3_417 });
    expect(q.totalAnnual).toBe(240_417);
  });
});

describe("cprStagePays", () => {
  it("pays 10% capped at 50,000, then 15%, 30% and the whole sum", () => {
    expect(CPR_STAGES.map((st) => cprStagePays(st, 750_000))).toEqual([50_000, 112_500, 225_000, 750_000]);
    expect(CPR_STAGES.map((st) => cprStagePays(st, 300_000))).toEqual([30_000, 45_000, 90_000, 300_000]);
  });
});

describe("quoteCard, for the cancer set", () => {
  const input: BundleCardInput = { kind: "bundle", bundleCode: "CANCER_SET", tier: 3, age: 30, sex: "M", mode: "annual" };
  const card = quoteCard(input, TODAY)!;
  const section = (title: string) => card.sections.find((s: QuoteCard["sections"][number]) => s.title === title);

  it("says HIC's sum is by the day", () => {
    expect(section("ชุดนี้ประกอบด้วย")?.rows).toEqual([
      { label: expect.any(String), amount: "150,000" },
      { label: "สัญญาเพิ่มเติมคุ้มครองโรคมะเร็ง (CPR)", amount: "750,000" },
      { label: "สัญญาเพิ่มเติมค่าชดเชยรายวันเนื่องจากโรคมะเร็ง (HIC) ต่อวัน", amount: "3,000" },
    ]);
  });

  it("draws what each stage of a cancer pays and the daily hospital sum", () => {
    expect(section("ตรวจพบมะเร็ง รับเงินก้อนตามระยะ")?.rows.map((r) => r.amount))
      .toEqual(["50,000", "112,500", "225,000", "750,000"]);
    expect(section("นอนโรงพยาบาลเพราะมะเร็ง รับรายวัน")?.rows).toEqual([
      { label: "ต่อวัน สูงสุด 365 วัน", amount: "3,000" },
      { label: "ระยะลุกลาม ขยายอีก 180 วัน", amount: "3,000" },
    ]);
  });

  it("leaves out the surrender values of a base that only carries the riders", () => {
    expect(section("มูลค่าเงินสดสะสม (หากเวนคืน)")).toBeUndefined();
  });
});
