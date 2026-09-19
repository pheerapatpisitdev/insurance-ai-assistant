"use client";
import { useEffect, useRef, useState } from "react";
import type { QuoteSheet } from "@/lib/group-insurance/sheet";
import { Icon } from "./Icon";
import { useLang } from "./lang";

/**
 * What each group is covered for, side by side.
 *
 * Groups are columns because the question this table answers is "what does the office get
 * that the drivers don't" — and that comparison is only readable when the two sit next to
 * each other on the same row of wording.
 *
 * The first column is sticky, so a fifth group scrolled into view still has "ค่าห้อง" beside
 * it rather than a bare number. `bg-inherit` on the sticky cell is what keeps the stripe
 * under it: a fixed colour there would paint one row's stripe over all of them.
 */
export function BenefitTable({ sheet }: { sheet: QuoteSheet }) {
  const { t, fmt } = useLang();
  const scroll = useRef<HTMLDivElement>(null);
  const [scrollable, setScrollable] = useState(false);

  // The fade at the right edge is a lie when nothing is hidden behind it, so it is only
  // drawn once the content actually overflows — which depends on the group count and on the
  // window, so it is measured rather than guessed.
  useEffect(() => {
    const el = scroll.current;
    if (!el) return;
    const measure = () => setScrollable(el.scrollWidth > el.clientWidth + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sheet.columns.length, sheet.benefits.length]);

  return (
    <div className="mt-6 overflow-hidden rounded-lg border border-[var(--gi-line)] bg-[var(--gi-panel)] shadow-sm">
      <div className="flex items-center gap-2.5 px-6 py-4" style={{ background: "var(--gi-navy)" }}>
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20 text-white">
          <Icon name="info" className="h-4 w-4" />
        </span>
        <h2 className="font-bold text-white">{t("benefits")}</h2>
      </div>
      <div className="gi-hscroll" data-scrollable={scrollable ? "1" : undefined}>
        <div ref={scroll} className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{t("benefits")}</caption>
            <thead>
              <tr className="border-b border-[var(--gi-line)] bg-[var(--gi-sunken)]">
                <th
                  scope="col"
                  className="sticky left-0 min-w-[180px] bg-[var(--gi-sunken)] px-4 py-3 font-semibold text-[var(--gi-ink-soft)]"
                >
                  {t("coverage")}
                </th>
                {sheet.columns.map((col) => (
                  <th key={col.no} scope="col" className="px-2.5 py-3 text-right align-bottom font-semibold">
                    {col.name ? <div>{col.name}</div> : <div>{`${t("groupNo")} ${col.no}`}</div>}
                    <div className="mt-0.5 text-[11px] font-medium text-[var(--gi-mute)]">
                      {col.bizTypeLabel}
                      <br />
                      {col.planLabel}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sheet.benefits.map((row, i) => (
                <tr key={row.label} className={i % 2 === 0 ? "bg-[var(--gi-panel)]" : "bg-[var(--gi-sunken)]"}>
                  <th
                    scope="row"
                    className="sticky left-0 bg-inherit px-4 py-3 text-left font-medium text-[var(--gi-ink-soft)]"
                  >
                    {row.label}
                  </th>
                  {row.values.map((v, j) => (
                    <td key={j} className="tabular whitespace-nowrap px-2.5 py-3 text-right font-bold">
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-t-2 bg-[var(--gi-panel)]" style={{ borderTopColor: "var(--gi-gold)" }}>
                <th scope="row" className="sticky left-0 bg-inherit px-4 py-3 text-left font-bold" style={{ color: "var(--gi-navy)" }}>
                  {t("totalPerPerson")}
                </th>
                {sheet.columns.map((col) => (
                  <td
                    key={col.no}
                    className="tabular whitespace-nowrap px-2.5 py-3 text-right font-bold"
                    style={{ color: "var(--gi-gold-deep)" }}
                  >
                    {fmt(col.perPerson)}
                  </td>
                ))}
              </tr>
              <tr className="bg-[var(--gi-sunken)]">
                <th scope="row" className="sticky left-0 bg-inherit px-4 py-3 text-left font-bold" style={{ color: "var(--gi-navy)" }}>
                  {t("groupSubtotal")}
                </th>
                {sheet.columns.map((col) => (
                  <td
                    key={col.no}
                    className="tabular whitespace-nowrap px-2.5 py-3 text-right font-bold"
                    style={{ color: "var(--gi-navy)" }}
                  >
                    {fmt(col.subtotal)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
