import { describe, it, expect } from "vitest";
import { repairThaiText } from "@/lib/knowledge/repair";

/** Every input here was taken from a real company PDF as pdf.js extracted it. */
const CASES: [string, string][] = [
  ["\u0e40\u0e04\u0e25\u0e21\u0e2d\u0e22\u008b\u0e32\u0e07", "\u0e40\u0e04\u0e25\u0e21\u0e2d\u0e22\u0e48\u0e32\u0e07"],
  ["\u0e16\u008c\u0e32\u0e40\u0e02\u008c\u0e32\u0e43\u0e08", "\u0e16\u0e49\u0e32\u0e40\u0e02\u0e49\u0e32\u0e43\u0e08"],
  ["2 \u0e1b\u0082", "2 \u0e1b\u0e35"],
  ["\u0e40\u0e1b\u009a\u0e19", "\u0e40\u0e1b\u0e47\u0e19"],
  ["\u0e01\u0e23\u0e21\u0e18\u0e23\u0e23\u0e21\u008f", "\u0e01\u0e23\u0e21\u0e18\u0e23\u0e23\u0e21\u0e4c"],
];

describe("repairing Thai text from PDFs", () => {
  it.each(CASES)("repairs %s", (input, expected) => {
    expect(repairThaiText(input).text).toBe(expected);
  });

  it("counts what it repaired", () => {
    const r = repairThaiText("\u0e44\u0e21\u008b\u0e04\u0e38\u008c\u0e21\u0e04\u0e23\u0e2d\u0e07");
    expect(r.text).toBe("\u0e44\u0e21\u0e48\u0e04\u0e38\u0e49\u0e21\u0e04\u0e23\u0e2d\u0e07");
    expect(r.repaired).toBe(2);
    expect(r.unreadable).toBe(0);
  });

  it("leaves unidentifiable glyphs alone and counts them", () => {
    const r = repairThaiText("\u0e40\u0e23\ufffd\u0e48\u0e2d\u0e07");
    expect(r.unreadable).toBe(1);
    expect(r.text).toContain("\ufffd");
  });

  it("does not touch clean text", () => {
    const clean = "\u0e40\u0e07\u0e37\u0e48\u0e2d\u0e19\u0e44\u0e02\u0e17\u0e31\u0e48\u0e27\u0e44\u0e1b\u0e02\u0e2d\u0e07\u0e01\u0e23\u0e21\u0e18\u0e23\u0e23\u0e21\u0e4c";
    const r = repairThaiText(clean);
    expect(r.text).toBe(clean);
    expect(r.repaired).toBe(0);
  });

  it("leaves English and digits alone", () => {
    expect(repairThaiText("Claim Process 2562").text).toBe("Claim Process 2562");
  });
});
