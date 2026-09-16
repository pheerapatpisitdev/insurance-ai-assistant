import { describe, expect, it } from "vitest";
import { calculateQuote, listQuotePlans } from "@/lib/mcp/quotes";

describe("MCP quote tools", () => {
  it("exposes a usable variant for each supported plan", () => {
    const plans = listQuotePlans();
    expect(plans).toHaveLength(4);
    for (const plan of plans) {
      expect(plan.variants.length).toBeGreaterThan(0);
      expect(plan.rates_expired).toBe(false);
    }
  });

  it("uses each plan's existing premium engine", () => {
    for (const plan of listQuotePlans()) {
      const result = calculateQuote({
        plan_code: plan.plan_code as "PLB" | "LIFEPROTECT" | "ISHIELD" | "LIFETREASURE",
        variant: plan.variants[0].code,
        age: Math.max(plan.age_min, Math.min(35, plan.age_max)),
        sex: "M",
        sum_assured: plan.sum_assured_min,
      });
      expect(result.premiums.annual.amount_baht).toBeGreaterThan(0);
      expect(result.currency).toBe("THB");
    }
  });

  it("rejects an age outside the sale range", () => {
    expect(() => calculateQuote({ plan_code: "PLB", variant: "PLB12", age: 19, sex: "M", sum_assured: 1_000_000 }))
      .toThrow(/อายุ/);
  });
});
