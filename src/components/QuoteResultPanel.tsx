import type { QuoteResult, PayMode } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { WarningList } from "./WarningList";
import { CopySummaryButton } from "./CopySummaryButton";

export function QuoteResultPanel({ result, mode, summary, derivedSumAssured }: { result: QuoteResult; mode: PayMode; summary: string; derivedSumAssured: boolean }) {
  return (
    <section className="space-y-4">
      {derivedSumAssured && (
        <div className="rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-900">
          ทุนประกันที่ได้: <span className="font-semibold tabular-nums">{result.sumAssured.toLocaleString("en-US")}</span> บาท
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-slate-500">
              <th className="py-2">รายการ</th>
              <th className="py-2 pl-3 text-right whitespace-nowrap">ทุนประกัน</th>
              <th className="py-2 pl-3 text-right whitespace-nowrap">เบี้ย{PAY_MODE_LABEL[mode]}</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((it) => (
              <tr key={it.code} className="border-b">
                <td className="py-2">
                  {it.name}
                  {it.message && <div className="text-xs text-red-600">{it.message}</div>}
                </td>
                <td className="py-2 pl-3 text-right whitespace-nowrap">{it.amountLabel ?? it.amount.toLocaleString("en-US")}</td>
                <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">{it.eligible ? formatBaht(it.modal) : "-"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded-lg bg-emerald-50 p-4">
        <div className="text-sm text-emerald-800">รวมเบี้ยต่องวด ({PAY_MODE_LABEL[mode]})</div>
        <div className="text-3xl font-semibold tabular-nums text-emerald-900">{formatBaht(result.totalModal)} บาท</div>
        <div className="mt-1 text-sm text-emerald-800">รวมเบี้ยรายปี {formatBaht(result.totalAnnual)} บาท</div>
      </div>

      <WarningList warnings={result.warnings} />
      <CopySummaryButton text={summary} />
    </section>
  );
}
