"use client";
import { useMemo, useState } from "react";
import { businessTypes } from "@/lib/group-insurance/business-types";
import { Icon } from "./Icon";
import { useLang } from "./lang";

/**
 * The registrar's list of trades, and which risk class each one falls in.
 *
 * This is the lookup an agent does before touching the calculator: the employer says what
 * they do, this says whether that is ลักษณะธุรกิจ 1, 2 or 3 — and occasionally that it is
 * class 4, which is not written at all.
 *
 * A page of sixty rows at a time rather than all 1,099. Not for the memory: for the browser,
 * which lays 1,099 rows of Thai out in about a second on a phone, once per keystroke of the
 * search box. Sixty is what fits on a screen and a half, and the button says how many are
 * behind it.
 *
 * The rows are the registrar's own Thai and there is no English edition of them, which the
 * page says out loud when the language is English rather than leaving a reader to wonder
 * whether the translation failed.
 */

const LEVEL_LABELS: Record<number, { th: string; en: string }> = {
  1: { th: "ขั้น 1 (ความเสี่ยงต่ำมาก)", en: "Level 1 (Very Low Risk)" },
  2: { th: "ขั้น 2 (ความเสี่ยงต่ำ)", en: "Level 2 (Low Risk)" },
  3: { th: "ขั้น 3 (ความเสี่ยงปานกลาง)", en: "Level 3 (Medium Risk)" },
  4: { th: "ขั้น 4 (ความเสี่ยงสูง/ไม่คุ้มครอง)", en: "Level 4 (High Risk/Not Covered)" },
};

const PAGE = 60;

export function BusinessTypeTable() {
  const { t, fmt, lang } = useLang();
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(PAGE);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return businessTypes;
    return businessTypes.filter(
      (b) => b.code.includes(q) || b.name.toLowerCase().includes(q) || (b.note?.toLowerCase().includes(q) ?? false),
    );
  }, [search]);

  const shown = Math.min(limit, filtered.length);

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6 text-center">
        <h1 className="text-2xl font-bold tracking-tight">{t("bizTypePageTitle")}</h1>
        <p className="mt-0.5 text-[var(--gi-mute)]">{t("bizTypePageSubtitle")}</p>
        {lang === "en" && (
          <p
            className="mt-2 inline-block rounded-md border px-3 py-1 text-xs"
            style={{ background: "var(--gi-warn-bg)", borderColor: "var(--gi-warn-line)", color: "var(--gi-warn-ink)" }}
          >
            {t("bizTypeThOnly")}
          </p>
        )}
      </header>

      <div className="mb-6">
        <div className="relative mx-auto max-w-md">
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--gi-mute)]">
            <Icon name="search" className="h-5 w-5" />
          </span>
          <input
            type="search"
            value={search}
            aria-label={t("searchBizType")}
            placeholder={t("searchBizType")}
            onChange={(e) => {
              setSearch(e.target.value);
              // a new search starts at the top of its own results, not sixty rows into them
              setLimit(PAGE);
            }}
            className="w-full rounded-lg border border-[var(--gi-line-strong)] bg-[var(--gi-panel)] py-3 pl-12 pr-4 text-[var(--gi-ink)]"
          />
        </div>
        <p aria-live="polite" className="mt-2 text-center text-sm text-[var(--gi-mute)]">
          {fmt(filtered.length)} / {fmt(businessTypes.length)} {t("bizTypeItems")}
        </p>
      </div>

      <div className="overflow-hidden rounded-lg border border-[var(--gi-line)] bg-[var(--gi-panel)] shadow-sm">
        {filtered.length === 0 ? (
          <p className="py-12 text-center text-[var(--gi-mute)]">{t("noSearchResults")}</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <caption className="sr-only">{t("bizTypePageTitle")}</caption>
                <thead className="border-b border-[var(--gi-line)] bg-[var(--gi-sunken)]">
                  <tr>
                    <th scope="col" className="whitespace-nowrap px-4 py-3 text-left font-semibold text-[var(--gi-ink-soft)]">
                      {t("bizCode")}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-[var(--gi-ink-soft)]">
                      {t("bizTypeName")}
                    </th>
                    <th scope="col" className="whitespace-nowrap px-4 py-3 text-left font-semibold text-[var(--gi-ink-soft)]">
                      {t("bizLevel")}
                    </th>
                    <th scope="col" className="px-4 py-3 text-left font-semibold text-[var(--gi-ink-soft)]">
                      {t("bizNote")}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, limit).map((b) => (
                    <tr key={b.code} className="border-b border-[var(--gi-line)]">
                      <th scope="row" className="whitespace-nowrap px-4 py-2.5 text-left font-mono font-normal text-[var(--gi-mute)]">
                        {b.code}
                      </th>
                      <td className="px-4 py-2.5">{b.name}</td>
                      <td className="whitespace-nowrap px-4 py-2.5">
                        <span
                          className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium"
                          style={{
                            background: `var(--gi-lv${b.level}-bg)`,
                            color: `var(--gi-lv${b.level}-ink)`,
                          }}
                        >
                          {LEVEL_LABELS[b.level]?.[lang] ?? b.level}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-xs text-[var(--gi-mute)]">{b.note || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {shown < filtered.length && (
              <div className="border-t border-[var(--gi-line)] p-4 text-center">
                <button
                  type="button"
                  onClick={() => setLimit((n) => n + PAGE)}
                  className="inline-flex items-center justify-center rounded-lg border border-[var(--gi-line-strong)] px-5 py-2.5 text-sm font-semibold text-[var(--gi-ink-soft)] hover:bg-[var(--gi-sunken)]"
                >
                  {t("showMore")} ({fmt(shown)}/{fmt(filtered.length)})
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <p className="mt-6 text-center text-sm text-[var(--gi-mute)]">{t("bizTypePageFooter")}</p>
    </div>
  );
}
