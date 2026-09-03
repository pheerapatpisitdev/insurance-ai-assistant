import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import { summaryText } from "@/lib/summary";
import { getBundle } from "@/calc/bundles/registry";
import { bundleQuoteInput, quoteBundle } from "@/calc/bundles/quote";

describe("summaryText", () => {
  it("renders a compact Thai summary", () => {
    const input = { planCode: "PLB", variant: "PLB12", age: 35, sex: "M" as const, mode: "monthly" as const, sumAssured: 1_000_000,
      riders: [{ code: "AP", sumAssured: 1_000_000 }] };
    const text = summaryText(input, quote(input, new Date("2026-09-03")));
    expect(text).toBe([
      "Protection Life (PLB) PLB12",
      "เพศชาย อายุ 35 ปี ชำระรายเดือน",
      "- Protection Life (PLB) PLB12 ทุน 1,000,000 บาท: 492.30 บาท",
      "- สัญญาเพิ่มเติมอุบัติเหตุ (AP) ทุน 1,000,000 บาท: 270.00 บาท",
      "รวมเบี้ยต่องวด (รายเดือน): 762.30 บาท",
      "รวมเบี้ยรายปี: 8,470.00 บาท",
      "⚠ เบี้ยประกันภัยรายเดือนต่ำกว่า 1,000 บาท",
      "(ตารางเบี้ย A2026-1)",
    ].join("\n"));
  });

  it("names the bundle and tier above the plan when the arrangement came from one", () => {
    const bundle = getBundle("LEGACY_FAMILY")!;
    const who = { age: 40, sex: "F" as const, mode: "annual" as const };
    const input = bundleQuoteInput(bundle, 3, who)!;
    const result = quoteBundle(bundle, 3, who, new Date("2026-09-04"))!;
    const text = summaryText(input, result, { name: bundle.name, tier: `${bundle.tierLabel} 3` });
    expect(text.split("\n").slice(0, 5)).toEqual([
      "ชุดมรดกเพื่อครอบครัว — แผน 3",
      "Life Protect+ 100 — ชำระเบี้ยครบอายุ 99 ปี",
      "เพศหญิง อายุ 40 ปี ชำระรายปี",
      "- Life Protect+ 100 — ชำระเบี้ยครบอายุ 99 ปี ทุน 200,000 บาท: 3,240.00 บาท",
      "- สัญญาเพิ่มเติมโรคร้ายแรง (DCI) ทุน 2,800,000 บาท: 12,460.00 บาท",
    ]);
  });
});
