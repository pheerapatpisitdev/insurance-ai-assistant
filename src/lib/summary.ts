import type { QuoteInput, QuoteResult } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";

export function summaryText(input: QuoteInput, result: QuoteResult): string {
  const lines: string[] = [];
  lines.push(`${result.meta.planName} ${input.variant}`);
  lines.push(`เพศ${input.sex === "M" ? "ชาย" : "หญิง"} อายุ ${input.age} ปี ชำระ${PAY_MODE_LABEL[input.mode]}`);
  for (const it of result.items) {
    const amount = it.code === "MEB" ? `แผน ${it.amount.toLocaleString("en-US")}` : `ทุน ${it.amount.toLocaleString("en-US")} บาท`;
    const value = it.eligible ? `${formatBaht(it.modal)} บาท` : (it.message ?? "-");
    lines.push(`- ${it.name} ${amount}: ${value}`);
  }
  lines.push(`รวมเบี้ยต่องวด (${PAY_MODE_LABEL[input.mode]}): ${formatBaht(result.totalModal)} บาท`);
  lines.push(`รวมเบี้ยรายปี: ${formatBaht(result.totalAnnual)} บาท`);
  for (const w of result.warnings) lines.push(`⚠ ${w.message}`);
  lines.push(`(ตารางเบี้ย ${result.meta.version})`);
  return lines.join("\n");
}
