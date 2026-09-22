"use client";
import type { QuoteSheet } from "@/lib/group-insurance/sheet";
import { useLang } from "./lang";

/**
 * The quotation as it comes off the printer.
 *
 * Laid out at 794px — A4 at 96dpi — so that what the agent approves on screen is what the
 * paper gets, and re-pointed at the paper's own width by the `@media print` block in
 * `theme.css`, because a fixed 794px inside 794px of paper with margins spills a second,
 * nearly empty sheet.
 *
 * Its colours are written inline rather than taken from the `--gi-*` tokens. That is the one
 * deliberate exception in this route: a browser drops backgrounds when it prints unless it
 * is told otherwise, and a custom property that failed to resolve in the print context would
 * leave a navy heading row as white text on white paper — a quotation handed to a customer
 * with its headings blank. Inline hex cannot fail that way.
 */
export function QuoteSheetDoc({
  sheet, customerName, quoteNo, quoteDate,
}: {
  sheet: QuoteSheet;
  customerName: string;
  quoteNo: string;
  quoteDate: string;
}) {
  const { t, fmt } = useLang();
  const { result, columns } = sheet;

  const NAVY = "#022162";
  /* sand dark enough to rule a line on paper */
  const GOLD = "#948763";
  /* was a teal; the sheet has one accent now, so this is simply the muted ink */
  const TEAL = "#5b6472";

  // The label column gives way as groups are added; below 34% the Thai wording wraps to three
  // lines and the sheet grows a page.
  const labelWidth = `${Math.max(34, 60 - columns.length * 6)}%`;

  const labelCell: React.CSSProperties = { padding: "7px 12px", color: "#5b6472", fontSize: 12, textAlign: "left" };
  const numCell: React.CSSProperties = {
    padding: "7px 10px", textAlign: "right", fontWeight: 700, color: "#15181d", fontSize: 12,
    whiteSpace: "nowrap", borderLeft: "1px solid #e2e4e8", fontVariantNumeric: "tabular-nums",
  };

  const premiumRows: { label: string; value: (c: (typeof columns)[number]) => string; accent?: string; strong?: boolean }[] = [
    { label: sheet.mainLabel, value: (c) => fmt(c.mainPremium) },
    ...(sheet.anyRider
      ? [{ label: sheet.riderLabel, value: (c: (typeof columns)[number]) => (c.includeRider ? fmt(c.riderPremium) : "—") }]
      : []),
    { label: t("totalPerPerson"), value: (c) => fmt(c.perPerson), accent: GOLD },
    { label: `${t("employeeCountShort")} (${t("people")})`, value: (c) => fmt(c.count) },
    { label: t("groupSubtotal"), value: (c) => fmt(c.subtotal), accent: NAVY, strong: true },
  ];

  const sectionTitle = (text: string) => (
    <h3 style={{ margin: "20px 0 8px", fontSize: 14, fontWeight: 700, color: NAVY, display: "flex", alignItems: "center", gap: 8 }}>
      <span aria-hidden style={{ width: 4, height: 16, background: GOLD, borderRadius: 2, display: "inline-block" }} />
      {text}
    </h3>
  );

  const infoRow = (label: string, value: string) => (
    <div style={{ display: "flex", gap: 8, fontSize: 13 }}>
      <span style={{ color: "#5b6472", minWidth: 96 }}>{label}:</span>
      <span style={{ fontWeight: 600, color: "#15181d" }}>{value}</span>
    </div>
  );

  const colgroup = (
    <colgroup>
      <col style={{ width: labelWidth }} />
      {columns.map((c) => (
        <col key={c.no} />
      ))}
    </colgroup>
  );

  return (
    <article
      className="gi-sheet"
      style={{
        width: 794, boxSizing: "border-box", background: "#ffffff", color: "#15181d",
        padding: "40px 44px", fontFamily: '"Noto Sans Thai", system-ui, -apple-system, sans-serif',
      }}
    >
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: `3px solid ${NAVY}`, paddingBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, lineHeight: 1.2 }}>{t("groupInsurance")}</div>
          <div style={{ fontSize: 12, color: TEAL, marginTop: 2 }}>{t("groupInsuranceSystem")}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 12, color: "#5b6472" }}>
          <div style={{ fontWeight: 700 }}>
            {t("quoteNoLabel")}: {quoteNo}
          </div>
          <div style={{ marginTop: 2 }}>
            {t("quoteDateLabel")}: {quoteDate}
          </div>
        </div>
      </header>

      <h2 style={{ marginTop: 18, fontSize: 17, fontWeight: 800, color: NAVY }}>
        {t(sheet.isPa ? "quoteTitleMultiPa" : "quoteTitleMultiHealth")}
      </h2>

      <div
        style={{
          marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 20px",
          background: "#f7f7f8", border: "1px solid #c3c6cd", borderRadius: 8, padding: "14px 18px",
        }}
      >
        {infoRow(t("customerName"), customerName || "—")}
        {infoRow(t("selectProduct"), sheet.productLabel)}
        {infoRow(t("totalPeople"), `${fmt(result.totalCount)} ${t("people")}`)}
        {infoRow(t("bandUsed"), result.band)}
      </div>

      {sectionTitle(t("benefits"))}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #c3c6cd", tableLayout: "fixed" }}>
        {colgroup}
        <thead>
          <tr style={{ background: NAVY, color: "#fff" }}>
            <th scope="col" style={{ ...labelCell, color: "#fff", fontWeight: 700, verticalAlign: "bottom" }}>
              {t("coverage")}
            </th>
            {columns.map((c) => (
              <th
                key={c.no}
                scope="col"
                style={{ padding: "8px 10px", textAlign: "right", verticalAlign: "bottom", borderLeft: "1px solid rgba(255,255,255,0.18)" }}
              >
                <div style={{ fontSize: 12, fontWeight: 800, color: "#fff" }}>
                  {t("groupNo")} {c.no}
                  {c.name ? ` · ${c.name}` : ""}
                </div>
                <div style={{ fontSize: 10, fontWeight: 500, color: "#8fb3e3", marginTop: 2, lineHeight: 1.35 }}>
                  {c.bizTypeLabel}
                  <br />
                  {c.planLabel}
                  {c.riderText ? ` + ${c.riderText}` : ""}
                  <br />
                  {fmt(c.count)} {t("people")}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sheet.benefits.map((row, i) => (
            <tr key={row.label} style={{ background: i % 2 === 0 ? "#ffffff" : "#f7f7f8", borderTop: "1px solid #e2e4e8" }}>
              <th scope="row" style={{ ...labelCell, fontWeight: 400 }}>
                {row.label}
              </th>
              {row.values.map((v, j) => (
                <td key={j} style={numCell}>
                  {v}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {sectionTitle(t("premiumSummary"))}
      <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #c3c6cd", tableLayout: "fixed" }}>
        {colgroup}
        <tbody>
          {premiumRows.map((row, i) => (
            <tr
              key={row.label}
              style={{
                background: row.strong ? "#e2e4e8" : i % 2 === 0 ? "#ffffff" : "#f7f7f8",
                borderTop: row.strong ? `1px solid ${GOLD}` : "1px solid #e2e4e8",
              }}
            >
              <th scope="row" style={{ ...labelCell, fontWeight: row.accent ? 700 : 400 }}>
                {row.label}
              </th>
              {columns.map((c) => (
                <td key={c.no} style={{ ...numCell, color: row.accent ?? "#15181d" }}>
                  {row.value(c)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div
        style={{
          marginTop: 18, background: NAVY, color: "#ffffff", borderRadius: 10, padding: "18px 22px",
          display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16,
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 600, color: "#8fb3e3" }}>
          {t("totalPremiumYear")} · {fmt(result.totalCount)} {t("people")}
        </div>
        <div style={{ fontSize: 26, fontWeight: 800, fontVariantNumeric: "tabular-nums" }}>
          {fmt(result.grandTotal)}{" "}
          <span style={{ fontSize: 15, fontWeight: 600, color: "#8fb3e3" }}>{t("perYear")}</span>
        </div>
      </div>

      <footer style={{ marginTop: 20, fontSize: 11, color: "#5b6472", lineHeight: 1.7 }}>
        <p>{t("premiumNote")}</p>
        <p>
          * {t("bandUsed")}: {result.band} ({t("totalPeople")} {fmt(result.totalCount)} {t("people")})
        </p>
        <p>
          * {t("minPremium")}: {t("minPremiumDetail")}
        </p>
      </footer>
    </article>
  );
}
