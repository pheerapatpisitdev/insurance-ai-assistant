import { describe, expect, it } from "vitest";
import { healthQuote } from "@/lib/assistant/ihealthy/quote";
import { baht } from "@/lib/assistant/common";

/**
 * The figures a quotation is written down as.
 *
 * What is being checked is not the arithmetic — the pricing tests do that — but that the
 * number the record keeps is the same number the customer was told. A report whose money
 * column is quietly a different figure from the one in the chat is worse than none.
 */

const WHILE_CURRENT = new Date("2026-09-12");

describe("a health quotation, written down", () => {
  const answer = healthQuote(
    { product: "ihealthy", intent: "quote", age: 35, sex: "M", plan: "GOLD" },
    WHILE_CURRENT,
  );

  it("is marked as carrying a price at all", () => {
    expect(answer.priced).toBe(true);
  });

  it("keeps the person it was priced for", () => {
    expect(answer.quote).toMatchObject({ age: 35, sex: "M", plan: "GOLD" });
  });

  it("keeps a yearly premium in baht, not the satang the tables hold", () => {
    const annual = answer.quote?.annual;
    expect(annual).toBeGreaterThan(0);
    // a yearly health premium is thousands of baht, not hundreds of thousands of satang
    expect(annual).toBeLessThan(1_000_000);
  });

  it("says the same figure the customer was told", () => {
    const spoken = answer.messages.map((m) => m.text).join(" ");
    const annual = answer.quote!.annual;
    // the text writes it with thousands separators, which is how a person reads it back
    expect(spoken).toContain(annual.toLocaleString("en-US"));
  });

  it("keeps the territory, which changes the price and is easy to forget", () => {
    expect(answer.quote?.territory).toBeTruthy();
  });

  it("carries no figures when the age is one the plan will not cover", () => {
    const refused = healthQuote(
      { product: "ihealthy", intent: "quote", age: 200, sex: "F", plan: "GOLD" },
      WHILE_CURRENT,
    );
    expect(refused.priced).toBeFalsy();
    expect(refused.quote).toBeUndefined();
  });
});

describe("satang to baht", () => {
  it("divides once, so nothing downstream has to know which it is holding", () => {
    expect(baht(2_340_000)).toBe(23_400);
    expect(baht(98_550)).toBe(985.5);
  });

  it("rounds a stray satang rather than carrying a fraction of one", () => {
    expect(baht(1_234.6)).toBe(12.35);
  });
});
