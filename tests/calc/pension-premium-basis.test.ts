import { describe, it, expect } from "vitest";
import { quotePension, type PensionMode } from "@/calc/pension/engine";

/** /bumnan95 worked from a premium the customer can afford, per instalment. */
const from = (amount: number, mode: PensionMode = "annual") =>
  quotePension({ age: 40, sex: "M", annuityAge: 60, pay: "untilAnnuity", mode, basis: "premium", amount });

describe("บำนาญ สมาร์ท 95 from a premium", () => {
  it("finds the sum a premium buys, and the premium comes back at about that figure", () => {
    const r = from(50_000);
    if (!r.ok) throw new Error(r.error);
    expect(Math.abs(r.quote.modePremium - 50_000)).toBeLessThan(r.quote.rate);
  });

  it("names the smallest premium when the one given is too small", () => {
    const r = from(10_000);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const min = Number(r.error.match(/เบี้ยขั้นต่ำ ([\d,]+) บาท/)![1].replace(/,/g, ""));
    expect(from(min).ok).toBe(true);
    expect(from(min - 1).ok).toBe(false);
  });

  it("does the same for a monthly instalment", () => {
    const r = from(500, "monthly");
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toContain("รายเดือน");
    const min = Number(r.error.match(/เบี้ยขั้นต่ำ ([\d,]+) บาท/)![1].replace(/,/g, ""));
    expect(from(min, "monthly").ok).toBe(true);
    expect(from(min - 1, "monthly").ok).toBe(false);
  });

  it("names the largest premium when the one given is too large", () => {
    const r = from(50_000_000);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    const max = Number(r.error.match(/เบี้ยสูงสุด ([\d,]+) บาท/)![1].replace(/,/g, ""));
    expect(from(max).ok).toBe(true);
    expect(from(max + 1).ok).toBe(false);
  });
});
