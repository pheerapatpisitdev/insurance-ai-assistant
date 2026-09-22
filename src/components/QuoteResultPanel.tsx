"use client";
import type { QuoteResult, PayMode } from "@/calc/types";
import { riderDiseases } from "@/calc/riders/diseases";
import type { ModePremium } from "@/calc/mode-premiums";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { deathBenefitRows } from "@/lib/death-benefit";
import { WarningList } from "./WarningList";

export interface QuoteResultPanelProps {
  result: QuoteResult;
  mode: PayMode;
  derivedSumAssured: boolean;
  /** when given, every payment mode is priced at once instead of only the one picked */
  modePremiums?: ModePremium[];
}

/**
 * The illnesses a rider names, shown outright. Folding them away saved space on a screen
 * nobody was short of, and cost a customer the one answer they came for.
 */
function Diseases({ code, riderName }: { code: string; riderName: string }) {
  const info = riderDiseases(code);
  if (!info) return null;
  return (
    <div className="rounded-lg border border-[var(--op-line)] bg-[var(--op-ground)] p-4">
      <div className="text-sm font-medium text-[var(--op-ink)]">
        {riderName} คุ้มครอง {info.diseases.length} โรค
      </div>
      <p className="mt-0.5 text-xs text-[var(--op-mute)]">{info.note}</p>
      {/* newspaper columns rather than a grid: the numbers should read down the first
          column and continue at the top of the second, not left to right in pairs */}
      <ol className="mt-2 text-xs text-[var(--op-ink)] sm:columns-2 sm:gap-x-6">
        {info.diseases.map((d, i) => (
          <li key={d} className="flex gap-1.5 break-inside-avoid pb-0.5">
            <span className="shrink-0 tabular-nums text-[var(--op-mute)]">{i + 1}.</span>
            <span>{d}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Problems with the base plan itself — an age or an amount the company will not issue. The
 * arrangement cannot be sold at all, so a premium for it is a number nobody can act on.
 */
const UNISSUABLE = new Set(["BASE_SA_MAX", "BASE_SA_MIN", "BASE_SA_EXACT", "BASE_AGE"]);

export function QuoteResultPanel({ result, mode, derivedSumAssured, modePremiums }: QuoteResultPanelProps) {
  // A bundle is sold whole, so a total of 0 is not a price — say so instead of showing it.
  const incomplete = result.warnings.find((w) => w.code === "BUNDLE_INCOMPLETE")
    // and neither is a premium for an amount or an age the company refuses: the engine still
    // prices those so the figure can be seen while the form is being filled, but a price
    // shown next to its own refusal reads as an offer
    ?? result.warnings.find((w) => w.level === "error" && UNISSUABLE.has(w.code));
  return (
    <section className="space-y-4">
      {derivedSumAssured && (
        <div className="rounded-md bg-[var(--bot-navy-soft)] px-3 py-2 text-sm text-[var(--bot-navy)]">
          ทุนประกันที่ได้: <span className="font-semibold tabular-nums">{result.sumAssured.toLocaleString("en-US")}</span> บาท
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--op-line)] text-left text-[var(--op-mute)]">
              <th className="py-2">รายการ</th>
              <th className="py-2 pl-3 text-right whitespace-nowrap">ทุนประกัน</th>
            </tr>
          </thead>
          <tbody>
            {result.items.map((it) => (
              <tr key={it.code} className="border-b border-[var(--op-line)]">
                <td className="py-2">
                  {it.name}
                  {it.message && <div className="text-xs text-[var(--op-error)]">{it.message}</div>}
                </td>
                <td className="py-2 pl-3 text-right whitespace-nowrap">{it.amountLabel ?? it.amount.toLocaleString("en-US")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {incomplete ? (
        <div className="rounded-lg bg-[var(--op-error-bg)] p-4">
          <div className="text-lg font-semibold text-[var(--op-error-strong)]">เสนอแบบนี้ไม่ได้</div>
          <div className="mt-1 text-sm text-[var(--op-error)]">{incomplete.message}</div>
        </div>
      ) : modePremiums ? (
        <div className="rounded-lg bg-[var(--op-figure-bg)] p-4">
          <div className="text-sm text-[var(--op-accent)]">เบี้ยประกันที่ต้องชำระ</div>
          <dl className="mt-2 space-y-1">
            {modePremiums.map((m) => (
              <div key={m.mode} className="flex items-baseline justify-between gap-3">
                <dt className={`text-sm ${m.mode === mode ? "font-semibold text-[var(--op-figure)]" : "text-[var(--op-accent)]"}`}>
                  {PAY_MODE_LABEL[m.mode]}
                  {m.belowMinimum && <span className="ml-1 text-xs text-[var(--op-mute)]">(ต่ำกว่าขั้นต่ำ {result.meta.minMonthlyTotal.toLocaleString("en-US")} บาท)</span>}
                </dt>
                <dd className={`tabular-nums ${m.mode === mode ? "text-2xl font-semibold text-[var(--op-figure)]" : "text-[var(--op-accent)]"}`}>
                  {formatBaht(m.total)} บาท
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ) : (
        <div className="rounded-lg bg-[var(--op-figure-bg)] p-4">
          <div className="text-sm text-[var(--op-accent)]">รวมเบี้ยต่องวด ({PAY_MODE_LABEL[mode]})</div>
          <div className="text-3xl font-semibold tabular-nums text-[var(--op-figure)]">{formatBaht(result.totalModal)} บาท</div>
          <div className="mt-1 text-sm text-[var(--op-accent)]">รวมเบี้ยรายปี {formatBaht(result.totalAnnual)} บาท</div>
        </div>
      )}

      {result.deathBenefit && !incomplete && (
        <div className="rounded-lg border border-[var(--op-line)] bg-[var(--op-ground)] p-4 text-sm">
          <div className="font-medium text-[var(--op-ink)]">ผลประโยชน์กรณีเสียชีวิต</div>
          {deathBenefitRows(result.deathBenefit).map((row) => (
            <div key={row.label} className="mt-1 flex justify-between gap-3">
              <span className="text-[var(--op-mute)]">{row.label}</span>
              <span className="font-semibold tabular-nums">{row.amount.toLocaleString("en-US")} บาท</span>
            </div>
          ))}
        </div>
      )}

      {result.maturityBenefit && !incomplete && (
        <div className="rounded-lg border border-[var(--op-line)] bg-[var(--op-ground)] p-4 text-sm">
          <div className="font-medium text-[var(--op-ink)]">ผลประโยชน์ครบสัญญา</div>
          <div className="mt-1 flex justify-between gap-3">
            <span className="text-[var(--op-mute)]">ครบสัญญาอายุ {result.maturityBenefit.age} ปี</span>
            <span className="font-semibold tabular-nums">
              {result.maturityBenefit.amount.toLocaleString("en-US")} บาท
            </span>
          </div>
          {result.maturityBenefit.survivalTotal !== undefined && (
            <>
              <div className="mt-0.5 flex justify-between gap-3">
                <span className="text-[var(--op-mute)]">เงินจ่ายคืนระหว่างสัญญา รวม</span>
                <span className="font-semibold tabular-nums">
                  {result.maturityBenefit.survivalTotal.toLocaleString("en-US")} บาท
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-3 border-t border-[var(--op-line)] pt-1">
                <span className="text-[var(--op-mute)]">รวมรับทั้งสิ้น</span>
                <span className="font-semibold tabular-nums">
                  {(result.maturityBenefit.total ?? 0).toLocaleString("en-US")} บาท
                </span>
              </div>
            </>
          )}
        </div>
      )}

      {/* last, because it is reference rather than a figure: whoever is reading the quote has
          finished with the numbers by the time they wonder what counts as a critical illness */}
      {result.items
        .filter((it) => it.eligible && riderDiseases(it.code))
        .map((it) => <Diseases key={it.code} code={it.code} riderName={it.name} />)}

      {/* the bundle's own refusal already headlines the panel; the list keeps the reasons behind it */}
      {/* the bundle's own refusal headlines the panel and the monthly minimum is marked beside its figure */}
      <WarningList warnings={result.warnings.filter((w) => w !== incomplete && !(modePremiums && w.code === "MIN_MONTHLY"))} />
    </section>
  );
}
