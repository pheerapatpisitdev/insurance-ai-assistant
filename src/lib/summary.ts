import type { QuoteInput, QuoteResult } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";

const sexTh = (s: "M" | "F") => (s === "M" ? "ชาย" : "หญิง");

export function summaryText(input: QuoteInput, result: QuoteResult): string {
  const lines: string[] = [];
  lines.push(result.items[0]?.name ?? `${result.meta.planName} ${input.variant}`);
  lines.push(`เพศ${sexTh(input.sex)} อายุ ${input.age} ปี ชำระ${PAY_MODE_LABEL[input.mode]}`);
  if (input.basis === "premium") {
    lines.push(`เบี้ยที่ต้องการ ${(input.targetPremium ?? 0).toLocaleString("en-US")} บาท → ทุนประกัน ${result.sumAssured.toLocaleString("en-US")} บาท`);
  }
  for (const it of result.items) {
    const amount = it.amountLabel
      ? it.amountLabel
      : it.code === "MEB" || it.code === "MEX"
        ? `แผน ${it.amount.toLocaleString("en-US")}`
        : `ทุน ${it.amount.toLocaleString("en-US")} บาท`;
    const value = it.eligible ? `${formatBaht(it.modal)} บาท` : (it.message ?? "-");
    lines.push(`- ${it.name} ${amount}: ${value}`);
  }
  lines.push(`รวมเบี้ยต่องวด (${PAY_MODE_LABEL[input.mode]}): ${formatBaht(result.totalModal)} บาท`);
  lines.push(`รวมเบี้ยรายปี: ${formatBaht(result.totalAnnual)} บาท`);
  for (const w of result.warnings) lines.push(`⚠ ${w.message}`);
  lines.push(`(ตารางเบี้ย ${result.meta.version})`);
  return lines.join("\n");
}
