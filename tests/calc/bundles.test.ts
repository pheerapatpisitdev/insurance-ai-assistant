import { describe, expect, it } from "vitest";
import { getBundle, listBundles } from "@/calc/bundles/registry";
import { bundleAgeRange, bundleModePremiums, bundleQuoteInput, describeTier, quoteBundle } from "@/calc/bundles/quote";
import { quote } from "@/calc/quote";

describe("bundle registry", () => {
  it("lists the legacy bundle and the CI 123 set", () => {
    expect(listBundles()).toEqual([
      { code: "LEGACY_FAMILY", name: "มรดกเพื่อครอบครัว" },
      { code: "CI123_SET", name: "ประกันโรคร้ายแรง CI 123" },
    ]);
  });

  it("sells CI 123 as seven sums on Life Protect+ 100 paid to age 99 at its 150,000 minimum", () => {
    const bundle = getBundle("CI123_SET")!;
    expect(bundle.planCode).toBe("LIFEPROTECT");
    expect(bundle.variant).toBe("WLF99H");
    expect(bundle.tiers.map((t) => t.sumAssured)).toEqual(Array(7).fill(150_000));
    expect(bundle.tiers.map((t) => t.riders)).toEqual(
      [500_000, 1_000_000, 2_000_000, 3_000_000, 4_000_000, 5_000_000, 10_000_000]
        .map((sumAssured) => [{ code: "CI123", sumAssured }]),
    );
  });

  it("sells the legacy bundle as ten tiers of Life Protect x 2 paid to age 99", () => {
    const bundle = getBundle("LEGACY_FAMILY")!;
    expect(bundle.planCode).toBe("LIFEPROTECT");
    expect(bundle.variant).toBe("WLF99H");
    expect(bundle.tiers).toHaveLength(10);
    expect(bundle.tiers.map((t) => t.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // every tier keeps the base at its 150,000 minimum and lets DCI make up the round million
    expect(bundle.tiers.map((t) => t.sumAssured)).toEqual(Array(10).fill(150_000));
    expect(bundle.tiers.map((t) => t.riders[0].sumAssured)).toEqual([
      850_000, 1_850_000, 2_850_000, 3_850_000, 4_850_000,
      5_850_000, 6_850_000, 7_850_000, 8_850_000, 9_850_000,
    ]);
    expect(bundle.tiers.every((t) => t.riders.length === 1 && t.riders[0].code === "DCI")).toBe(true);
  });

  it("has no bundle under an unknown code", () => {
    expect(getBundle("NOPE")).toBeUndefined();
  });
});

describe("bundleQuoteInput", () => {
  const bundle = getBundle("LEGACY_FAMILY")!;

  it("locks the plan, variant and every sum assured of the chosen tier", () => {
    expect(bundleQuoteInput(bundle, 3, { age: 40, sex: "F", mode: "annual" })).toEqual({
      planCode: "LIFEPROTECT",
      variant: "WLF99H",
      age: 40,
      sex: "F",
      mode: "annual",
      sumAssured: 150_000,
      riders: [{ code: "DCI", sumAssured: 2_850_000 }],
    });
  });

  it("has no input for a tier the bundle does not sell", () => {
    expect(bundleQuoteInput(bundle, 11, { age: 40, sex: "F", mode: "annual" })).toBeUndefined();
    expect(bundleQuoteInput(bundle, 0, { age: 40, sex: "F", mode: "annual" })).toBeUndefined();
  });
});

describe("quoteBundle", () => {
  const bundle = getBundle("LEGACY_FAMILY")!;
  const TODAY = new Date("2026-09-04");

  it("quotes exactly what the same arrangement built by hand would cost", () => {
    const who = { age: 40, sex: "F", mode: "annual" } as const;
    const byHand = quote(bundleQuoteInput(bundle, 3, who)!, TODAY);
    expect(quoteBundle(bundle, 3, who, TODAY)).toEqual(byHand);
  });

  it("has no quote for a tier the bundle does not sell", () => {
    expect(quoteBundle(bundle, 11, { age: 40, sex: "F", mode: "annual" }, TODAY)).toBeUndefined();
  });

  it("voids the whole bundle when the insured is too old for DCI", () => {
    const result = quoteBundle(bundle, 1, { age: 66, sex: "M", mode: "annual" }, TODAY)!;
    expect(result.totalAnnual).toBe(0);
    expect(result.totalModal).toBe(0);
    const incomplete = result.warnings.find((w) => w.code === "BUNDLE_INCOMPLETE");
    expect(incomplete).toEqual({
      level: "error",
      code: "BUNDLE_INCOMPLETE",
      message: "ชุดมรดกเพื่อครอบครัว — มรดก 1 ล้าน ใช้กับกรณีนี้ไม่ได้",
    });
    // the base plan still quotes at 66, so only DCI explains the refusal — keep that row visible
    const dci = result.items.find((i) => i.code === "DCI")!;
    expect(dci.eligible).toBe(false);
    expect(dci.message).toBeTruthy();
  });

  it("still prices a bundle whose monthly premium falls under the minimum", () => {
    const result = quoteBundle(bundle, 1, { age: 20, sex: "M", mode: "monthly" }, TODAY)!;
    // every line is sellable — only the payment mode is out of reach, so show what it costs
    expect(result.totalModal).toBe(32_152);
    expect(result.warnings.map((w) => w.code)).toContain("MIN_MONTHLY");
    expect(result.warnings.map((w) => w.code)).not.toContain("BUNDLE_INCOMPLETE");
    expect(result.items.every((i) => i.eligible)).toBe(true);
  });

  it("leaves a sellable bundle untouched", () => {
    const result = quoteBundle(bundle, 5, { age: 40, sex: "M", mode: "monthly" }, TODAY)!;
    expect(result.warnings.map((w) => w.code)).not.toContain("BUNDLE_INCOMPLETE");
    expect(result.totalModal).toBeGreaterThan(0);
  });
});

describe("bundleAgeRange", () => {
  it("narrows the base plan's range to what every rider in the bundle also accepts", () => {
    // Life Protect x 2 issues from 0 to 80; DCI only from 20 to 65
    expect(bundleAgeRange(getBundle("LEGACY_FAMILY")!)).toEqual({ min: 20, max: 65 });
  });
});

describe("describeTier", () => {
  const bundle = getBundle("LEGACY_FAMILY")!;

  it("names the tier by the legacy it leaves", () => {
    expect(describeTier(bundle, 1)).toBe("มรดก 1 ล้าน");
    expect(describeTier(bundle, 3)).toBe("มรดก 3 ล้าน");
    expect(describeTier(bundle, 10)).toBe("มรดก 10 ล้าน");
  });

  it("names every tier after the death benefit it leaves from age 60", () => {
    for (const tier of bundle.tiers) {
      const r = quoteBundle(bundle, tier.no, { age: 40, sex: "F", mode: "annual" }, new Date("2026-09-04"))!;
      expect(`มรดก ${r.deathBenefit!.sumFrom / 1_000_000} ล้าน`).toBe(tier.name);
    }
  });

  it("names every tier after what it actually covers", () => {
    for (const tier of bundle.tiers) {
      const covered = tier.sumAssured + tier.riders.reduce((sum, r) => sum + (r.sumAssured ?? 0), 0);
      expect(tier.name).toBe(`มรดก ${covered / 1_000_000} ล้าน`);
    }
  });

  it("has nothing to describe for a tier the bundle does not sell", () => {
    expect(describeTier(bundle, 11)).toBeUndefined();
  });
});

describe("bundleModePremiums", () => {
  const bundle = getBundle("LEGACY_FAMILY")!;
  const TODAY = new Date("2026-09-04");

  it("prices all three payment modes at once", () => {
    expect(bundleModePremiums(bundle, 3, { age: 40, sex: "F" }, TODAY)).toEqual([
      { mode: "annual", total: 1_511_250, belowMinimum: false },
      { mode: "semi", total: 785_850, belowMinimum: false },
      { mode: "monthly", total: 136_012, belowMinimum: false },
    ]);
  });

  it("marks a monthly premium that falls under the minimum without hiding it", () => {
    const modes = bundleModePremiums(bundle, 1, { age: 20, sex: "M" }, TODAY)!;
    expect(modes.find((m) => m.mode === "monthly")).toEqual({ mode: "monthly", total: 32_152, belowMinimum: true });
    expect(modes.every((m) => m.total > 0)).toBe(true);
  });

  it("prices nothing for a tier the bundle does not sell", () => {
    expect(bundleModePremiums(bundle, 11, { age: 40, sex: "F" }, TODAY)).toBeUndefined();
  });
});
