import { describe, it, expect } from "vitest";
import { toHundredths, floorDiv, satangToBaht, premiumPerThousand, applyModeFactor, applyModeFactorToFixed, formatBaht } from "@/calc/money";

describe("money", () => {
  it("toHundredths converts a 2-decimal number to an exact integer", () => {
    expect(toHundredths(6.47)).toBe(647);
    expect(toHundredths(0.52)).toBe(52);
    expect(toHundredths(1)).toBe(100);
    expect(toHundredths(0)).toBe(0);
  });

  it("floorDiv floors toward negative infinity", () => {
    expect(floorDiv(7, 2)).toBe(3);
    expect(floorDiv(6, 2)).toBe(3);
    expect(floorDiv(-7, 2)).toBe(-4);
  });

  it("premiumPerThousand = ROUNDDOWN(rate * SA / 1000, 2) in satang", () => {
    expect(premiumPerThousand(647 - 100, 1_000_000)).toBe(547_000);
    expect(premiumPerThousand(647, 300_000)).toBe(194_100);
    expect(premiumPerThousand(405, 123_456)).toBe(49_999); // 499.9968 → 499.99
  });

  it("applyModeFactor = ROUNDDOWN(x * factor, 2) from an unrounded product", () => {
    expect(applyModeFactor(547, 1_000_000, 52)).toBe(284_440);
    expect(applyModeFactor(405, 123_456, 9)).toBe(4_499); // 44.999712 → 44.99
    expect(applyModeFactor(647, 300_000, 100)).toBe(194_100);
  });

  it("applyModeFactorToFixed = ROUNDDOWN(annual * factor, 2)", () => {
    expect(applyModeFactorToFixed(47_500, 9)).toBe(4_275);
    expect(applyModeFactorToFixed(3_210_000, 52)).toBe(1_669_200);
    expect(applyModeFactorToFixed(12_345, 9)).toBe(1_111); // 111.105 → 111.10
  });

  it("satangToBaht and formatBaht", () => {
    expect(satangToBaht(284_440)).toBe(2844.4);
    expect(formatBaht(284_440)).toBe("2,844.40");
    expect(formatBaht(0)).toBe("0.00");
  });
});
