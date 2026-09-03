import { describe, it, expect } from "vitest";
import { quote } from "@/calc/quote";
import { summaryText } from "@/lib/summary";

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
});
