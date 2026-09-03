import { describe, expect, it } from "vitest";
import { quoteModePremiums } from "@/calc/mode-premiums";
import { quote } from "@/calc/quote";
import type { PayMode, QuoteInput } from "@/calc/types";

const TODAY = new Date("2026-09-04");
const plb: QuoteInput = {
  planCode: "PLB", variant: "PLB12", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: [],
};

describe("quoteModePremiums", () => {
  it("prices a hand-built quote in all three modes", () => {
    expect(quoteModePremiums(plb, TODAY)).toEqual([
      { mode: "annual", total: 547_000, belowMinimum: false },
      { mode: "semi", total: 284_440, belowMinimum: false },
      { mode: "monthly", total: 49_230, belowMinimum: true },
    ]);
  });

  it("quotes each mode in full instead of scaling the annual premium", () => {
    // the workbook rounds every instalment down on its own, so twelve monthly ones overshoot the year
    const [annual, , monthly] = quoteModePremiums(plb, TODAY)!;
    expect(monthly.total * 12).not.toBe(annual.total);
    for (const mode of ["annual", "semi", "monthly"] as PayMode[]) {
      expect(quoteModePremiums(plb, TODAY)!.find((m) => m.mode === mode)!.total)
        .toBe(quote({ ...plb, mode }, TODAY).totalModal);
    }
  });

  it("ignores the mode the caller happened to put in the input", () => {
    expect(quoteModePremiums({ ...plb, mode: "monthly" }, TODAY)).toEqual(quoteModePremiums(plb, TODAY));
  });
});
