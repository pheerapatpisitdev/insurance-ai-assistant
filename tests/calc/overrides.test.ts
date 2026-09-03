import { describe, it, expect } from "vitest";
import { applyRuleOverride } from "@/calc/plans/overrides";
import { getPlan } from "@/calc/plans/registry";

describe("applyRuleOverride", () => {
  it("returns the repo rules unchanged when there is no override", () => {
    expect(applyRuleOverride("PLB", null)).toEqual(getPlan("PLB")!.rules);
  });

  it("overrides only the fields it names", () => {
    const merged = applyRuleOverride("PLB", { base: { saMin: 500_000 } })!;
    const original = getPlan("PLB")!.rules;
    expect(merged.base.saMin).toBe(500_000);
    expect(merged.base.ageMin).toBe(original.base.ageMin);
    expect(merged.riders).toEqual(original.riders);
  });

  it("patches one rider without touching the others", () => {
    const original = getPlan("PLB")!.rules;
    const merged = applyRuleOverride("PLB", { riders: { AP: { ageMax: 55 } } })!;
    expect(merged.riders.AP.ageMax).toBe(55);
    expect(merged.riders.AP.saMin).toBe(original.riders.AP.saMin);
    expect(merged.riders.ECARE).toEqual(original.riders.ECARE);
  });

  it("ignores a rider that does not exist in the plan", () => {
    const merged = applyRuleOverride("PLB", { riders: { NOPE: { ageMax: 1 } } })!;
    expect(merged.riders.NOPE).toBeUndefined();
  });

  it("does not mutate the rules in the registry", () => {
    const before = JSON.stringify(getPlan("PLB")!.rules);
    applyRuleOverride("PLB", { base: { saMin: 1 }, riders: { AP: { ageMax: 2 } } });
    expect(JSON.stringify(getPlan("PLB")!.rules)).toBe(before);
  });

  it("returns undefined for an unknown plan", () => {
    expect(applyRuleOverride("NOPE", null)).toBeUndefined();
  });
});
