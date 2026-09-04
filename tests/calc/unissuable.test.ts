import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import type { QuoteInput } from "@/calc/types";

/**
 * The engine keeps pricing while a form is being filled, so these assert what the engine
 * reports rather than what the screen does with it. The panel refuses on exactly these codes.
 */
const UNISSUABLE = new Set(["BASE_SA_MAX", "BASE_SA_MIN", "BASE_SA_EXACT", "BASE_AGE"]);
const blocking = (input: QuoteInput) =>
  quote(input).warnings.filter((w) => w.level === "error" && UNISSUABLE.has(w.code)).map((w) => w.code);

const ISHIELD: QuoteInput = {
  planCode: "ISHIELD", variant: "WLCI20", age: 40, sex: "M",
  mode: "annual", sumAssured: 1_000_000, basis: "sumAssured", riders: [],
};

describe("amounts and ages the company will not issue", () => {
  it("flags iShield above its five million ceiling", () => {
    expect(blocking({ ...ISHIELD, sumAssured: 10_000_000 })).toEqual(["BASE_SA_MAX"]);
  });

  it("says nothing at exactly the ceiling, which is issuable", () => {
    expect(blocking({ ...ISHIELD, sumAssured: 5_000_000 })).toEqual([]);
  });

  it("flags an amount under the minimum", () => {
    expect(blocking({ ...ISHIELD, sumAssured: 50_000 })).toEqual(["BASE_SA_MIN"]);
  });

  it("flags an age outside the issue range", () => {
    expect(blocking({ ...ISHIELD, age: 70 })).toEqual(["BASE_AGE"]);
  });

  it("leaves an ordinary quote alone", () => {
    expect(blocking(ISHIELD)).toEqual([]);
  });

  it("does not treat the monthly minimum as un-issuable — only that instalment is out of reach", () => {
    const cheap: QuoteInput = {
      planCode: "LIFEPROTECT", variant: "WLF99H", age: 20, sex: "F",
      mode: "monthly", sumAssured: 150_000, basis: "sumAssured", riders: [],
    };
    const warnings = quote(cheap).warnings;
    expect(warnings.some((w) => w.code === "MIN_MONTHLY")).toBe(true);
    expect(blocking(cheap)).toEqual([]);
  });
});
