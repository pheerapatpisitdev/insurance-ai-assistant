import type { QuoteResult, PayMode } from "@/calc/types";
import type { ModePremium } from "@/calc/mode-premiums";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { WarningList } from "./WarningList";
import { ShareToLineButton } from "./ShareToLineButton";

export interface QuoteResultPanelProps {
  result: QuoteResult;
  mode: PayMode;
  summary: string;
  derivedSumAssured: boolean;
  /** off for a bundle: the parts are not sold separately, so a price per line invites a question with no answer */
  linePremiums?: boolean;
  /** when given, every payment mode is priced at once instead of only the one picked */
  modePremiums?: ModePremium[];
}

export function QuoteResultPanel({ result, mode, summary, derivedSumAssured, linePremiums = true, modePremiums }: QuoteResultPanelProps) {
  // A bundle is sold whole, so a total of 0 is not a price — say so instead of showing it.
  const incomplete = result.warnings.find((w) => w.code === "BUNDLE_INCOMPLETE");
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
              {linePremiums && <th className="py-2 pl-3 text-right whitespace-nowrap">เบี้ย{PAY_MODE_LABEL[mode]}</th>}
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
                {linePremiums && (
                  <td className="py-2 pl-3 text-right tabular-nums whitespace-nowrap">{it.eligible ? formatBaht(it.modal) : "-"}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {incomplete ? (
        <div className="rounded-lg bg-red-50 p-4">
          <div className="text-lg font-semibold text-red-900">เสนอชุดนี้ไม่ได้</div>
          <div className="mt-1 text-sm text-red-800">{incomplete.message}</div>
        </div>
      ) : modePremiums ? (
        <div className="rounded-lg bg-emerald-50 p-4">
          <div className="text-sm text-emerald-800">เบี้ยประกันที่ต้องชำระ</div>
          <dl className="mt-2 space-y-1">
            {modePremiums.map((m) => (
              <div key={m.mode} className="flex items-baseline justify-between gap-3">
                <dt className={`text-sm ${m.mode === mode ? "font-semibold text-emerald-900" : "text-emerald-800"}`}>
                  {PAY_MODE_LABEL[m.mode]}
                  {m.belowMinimum && <span className="ml-1 text-xs text-emerald-700">(ต่ำกว่าขั้นต่ำ {result.meta.minMonthlyTotal.toLocaleString("en-US")} บาท)</span>}
                </dt>
                <dd className={`tabular-nums ${m.mode === mode ? "text-2xl font-semibold text-emerald-900" : "text-emerald-800"}`}>
                  {formatBaht(m.total)} บาท
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div className="rounded-lg bg-emerald-50 p-4">
          <div className="text-sm text-emerald-800">รวมเบี้ยต่องวด ({PAY_MODE_LABEL[mode]})</div>
          <div className="text-3xl font-semibold tabular-nums text-emerald-900">{formatBaht(result.totalModal)} บาท</div>
          <div className="mt-1 text-sm text-emerald-800">รวมเบี้ยรายปี {formatBaht(result.totalAnnual)} บาท</div>
        </div>
      )}

      {result.deathBenefit && !incomplete && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="font-medium text-slate-700">ผลประโยชน์กรณีเสียชีวิต</div>
          {result.deathBenefit.alreadyPastAge ? (
            <div className="mt-1 flex justify-between gap-3">
              <span className="text-slate-600">ทุกช่วงอายุ</span>
              <span className="font-semibold tabular-nums">{result.deathBenefit.sumFrom.toLocaleString("en-US")} บาท</span>
            </div>
          ) : (
            <>
              <div className="mt-1 flex justify-between gap-3">
                <span className="text-slate-600">เสียชีวิตก่อนอายุ {result.deathBenefit.beforeAge} ปี</span>
                <span className="font-semibold tabular-nums">{result.deathBenefit.sumBefore.toLocaleString("en-US")} บาท</span>
              </div>
              <div className="mt-0.5 flex justify-between gap-3">
                <span className="text-slate-600">อายุ {result.deathBenefit.beforeAge} ปีขึ้นไป</span>
                <span className="font-semibold tabular-nums">{result.deathBenefit.sumFrom.toLocaleString("en-US")} บาท</span>
              </div>
            </>
          )}
        </div>
      )}

      {/* the bundle's own refusal already headlines the panel; the list keeps the reasons behind it */}
      {/* the bundle's own refusal headlines the panel and the monthly minimum is marked beside its figure */}
      <WarningList warnings={result.warnings.filter((w) => w !== incomplete && !(modePremiums && w.code === "MIN_MONTHLY"))} />
      <ShareToLineButton text={summary} />
    </section>
  );
}
