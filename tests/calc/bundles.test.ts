import { describe, expect, it } from "vitest";
import { getBundle, listBundles } from "@/calc/bundles/registry";
import { bundleAgeRange, bundleQuoteInput, describeTier, quoteBundle } from "@/calc/bundles/quote";
import { quote } from "@/calc/quote";

describe("bundle registry", () => {
  it("lists the legacy bundle", () => {
    expect(listBundles()).toEqual([{ code: "LEGACY_FAMILY", name: "มรดกเพื่อครอบครัว" }]);
  });

  it("sells the legacy bundle as ten tiers of Life Protect+ 100 paid to age 99", () => {
    const bundle = getBundle("LEGACY_FAMILY")!;
    expect(bundle.planCode).toBe("LIFEPROTECT");
    expect(bundle.variant).toBe("WLF99H");
    expect(bundle.tiers).toHaveLength(10);
    expect(bundle.tiers.map((t) => t.no)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    // every tier keeps the base at 200,000 and steps DCI up by a million
    expect(bundle.tiers.map((t) => t.sumAssured)).toEqual(Array(10).fill(200_000));
    expect(bundle.tiers.map((t) => t.riders[0].sumAssured)).toEqual([
      800_000, 1_800_000, 2_800_000, 3_800_000, 4_800_000,
      5_800_000, 6_800_000, 7_800_000, 8_800_000, 9_800_000,
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
      sumAssured: 200_000,
      riders: [{ code: "DCI", sumAssured: 2_800_000 }],
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
      message: "ชุดมรดกเพื่อครอบครัว แผน 1 ใช้กับกรณีนี้ไม่ได้",
    });
    // the base plan still quotes at 66, so only DCI explains the refusal — keep that row visible
    const dci = result.items.find((i) => i.code === "DCI")!;
    expect(dci.eligible).toBe(false);
    expect(dci.message).toBeTruthy();
  });

  it("voids the whole bundle when the monthly premium falls under the minimum", () => {
    const result = quoteBundle(bundle, 1, { age: 20, sex: "M", mode: "monthly" }, TODAY)!;
    expect(result.totalModal).toBe(0);
    expect(result.warnings.map((w) => w.code)).toContain("MIN_MONTHLY");
    expect(result.warnings.map((w) => w.code)).toContain("BUNDLE_INCOMPLETE");
    // every line is sellable on its own; it is the total that fails
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
    // Life Protect+ 100 issues from 0 to 80; DCI only from 20 to 65
    expect(bundleAgeRange(getBundle("LEGACY_FAMILY")!)).toEqual({ min: 20, max: 65 });
  });
});

describe("describeTier", () => {
  const bundle = getBundle("LEGACY_FAMILY")!;

  it("spells out every sum assured the tier locks in", () => {
    expect(describeTier(bundle, 3)).toBe("แผน 3 — หลัก 200,000 / DCI 2,800,000");
    expect(describeTier(bundle, 10)).toBe("แผน 10 — หลัก 200,000 / DCI 9,800,000");
  });

  it("has nothing to describe for a tier the bundle does not sell", () => {
    expect(describeTier(bundle, 11)).toBeUndefined();
  });
});
