import { describe, it, expect } from "vitest";
import { discountPerThousand } from "@/calc/discount";
import plbJson from "../../data/rates/plb.json";
import type { PlanRates } from "@/calc/types";

const plb = plbJson as unknown as PlanRates;

describe("discountPerThousand (Excel Cal!B32:K32)", () => {
  it("steps at each threshold for PLB12", () => {
    expect(discountPerThousand(plb, "PLB12", 300_000)).toBe(0);
    expect(discountPerThousand(plb, "PLB12", 349_999)).toBe(0);
    expect(discountPerThousand(plb, "PLB12", 350_000)).toBe(0);
    expect(discountPerThousand(plb, "PLB12", 499_999)).toBe(0);
    expect(discountPerThousand(plb, "PLB12", 500_000)).toBe(0.5);
    expect(discountPerThousand(plb, "PLB12", 699_999)).toBe(0.5);
    expect(discountPerThousand(plb, "PLB12", 700_000)).toBe(0.5);
    expect(discountPerThousand(plb, "PLB12", 999_999)).toBe(0.5);
    expect(discountPerThousand(plb, "PLB12", 1_000_000)).toBe(1);
    expect(discountPerThousand(plb, "PLB12", 25_000_000)).toBe(1);
  });
  it("returns 0 for an unknown variant", () => {
    expect(discountPerThousand(plb, "NOPE", 5_000_000)).toBe(0);
  });
});
