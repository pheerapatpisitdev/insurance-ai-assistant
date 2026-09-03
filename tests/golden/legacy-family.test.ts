import { describe, expect, it } from "vitest";
import { getBundle } from "@/calc/bundles/registry";
import { quoteBundle } from "@/calc/bundles/quote";
import type { PayMode, Sex } from "@/calc/types";

/**
 * Anchors read straight off the Life Protect+ 100 (WLF99H) and DCI rate tables, so a wrong
 * sum assured or a dropped mode factor in the bundle layer shows up as a baht figure.
 * Base premium = rate × 150,000 / 1,000; DCI = rate × tier sum assured / 1,000.
 */
const bundle = getBundle("LEGACY_FAMILY")!;
const TODAY = new Date("2026-09-04");
const baht = (sex: Sex, age: number, tier: number, mode: PayMode = "annual") => {
  const r = quoteBundle(bundle, tier, { age, sex, mode }, TODAY)!;
  return (mode === "annual" ? r.totalAnnual : r.totalModal) / 100;
};

describe("มรดกเพื่อครอบครัว — annual premium against the rate tables", () => {
  const cases: [Sex, number, [number, number, number]][] = [
    ["M", 20, [3_572.5, 12_972.5, 24_722.5]],
    ["M", 40, [7_752, 29_832, 57_432]],
    ["M", 65, [44_995, 209_795, 415_795]],
    ["F", 20, [2_967, 10_647, 20_247]],
    ["F", 40, [6_212.5, 24_012.5, 46_262.5]],
    ["F", 65, [35_757.5, 164_357.5, 325_107.5]],
  ];
  for (const [sex, age, [t1, t5, t10]] of cases) {
    it(`${sex === "M" ? "ชาย" : "หญิง"} ${age} ปี`, () => {
      expect(baht(sex, age, 1)).toBe(t1);
      expect(baht(sex, age, 5)).toBe(t5);
      expect(baht(sex, age, 10)).toBe(t10);
    });
  }
});

describe("มรดกเพื่อครอบครัว — mode factor and edges", () => {
  it("applies the monthly factor to both lines", () => {
    expect(baht("M", 40, 1, "monthly")).toBe(697.68);
    expect(baht("M", 40, 5, "monthly")).toBe(2_684.88);
    expect(baht("F", 40, 10, "monthly")).toBe(4_163.62);
  });

  it("refuses ages outside the 20-65 window DCI leaves", () => {
    for (const age of [19, 66]) {
      const r = quoteBundle(bundle, 1, { age, sex: "M", mode: "annual" }, TODAY)!;
      expect(r.totalAnnual).toBe(0);
      expect(r.warnings.map((w) => w.code)).toContain("BUNDLE_INCOMPLETE");
    }
  });

  it("flags the 1,000 baht monthly minimum without hiding the premium", () => {
    expect(baht("M", 20, 5, "monthly")).toBe(1_167.52); // over the minimum, no warning
    const tooSmall = quoteBundle(bundle, 5, { age: 20, sex: "F", mode: "monthly" }, TODAY)!;
    expect(tooSmall.totalModal / 100).toBe(958.23);
    expect(tooSmall.warnings.map((w) => w.code)).toContain("MIN_MONTHLY");
  });
});
