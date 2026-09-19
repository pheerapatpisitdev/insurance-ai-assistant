/**
 * The quotation as a table, once, for the three places that draw one.
 *
 * The on-screen benefit table, the printable quotation and the LINE message all say the same
 * thing in different clothes, and when each built its own rows they drifted: the screen
 * showed an OPD line for a group that had switched OPD off, the sheet did not. So the rows
 * are built here and the three views only decide how to paint them.
 *
 * The rider's row is the whole reason this is not a `map`. A group with no OPD still has to
 * occupy its column when a sibling group has it, or the columns stop lining up with their
 * headings — so the row appears when *any* group takes the rider, and the ones that did not
 * print an em-dash.
 */
import { GI, BIZ_LABEL_KEYS, type Product } from "./data";
import type { GroupQuote, MultiGroupQuote } from "./quote";
import { computeMultiGroupQuote, type GroupInput } from "./quote";
import type { Key } from "./translations";

export interface BenefitLine {
  label: string;
  /** one per group, in the same order as `columns` */
  values: string[];
}

export interface GroupColumn {
  /** 1-based, because it is shown to a person */
  no: number;
  name: string;
  bizTypeLabel: string;
  planLabel: string;
  /** "OPD แผน 2" / "ME 50,000", or empty when the group took no rider */
  riderText: string;
  count: number;
  includeRider: boolean;
  mainPremium: number;
  riderPremium: number;
  perPerson: number;
  subtotal: number;
}

export interface QuoteSheet {
  isPa: boolean;
  result: MultiGroupQuote;
  /** true when at least one group bought the rider, which is what puts its row on the sheet */
  anyRider: boolean;
  columns: GroupColumn[];
  benefits: BenefitLine[];
  /** "เบี้ย IPD" / "เบี้ยหลัก" — the products name the same slot differently */
  mainLabel: string;
  riderLabel: string;
  riderToggleLabel: string;
  riderMaxNote: string;
  productLabel: string;
}

type T = (key: Key) => string;

/** "แผน 3" for health, "P3" for PA — the rate sheets are written that way and agents read them aloud. */
export function planLabel(product: Product, t: T, planIdx: number): string {
  return product === "pa" ? `P${planIdx + 1}` : `${t("plan")} ${planIdx + 1}`;
}

/** What the group's rider is, in words; empty when it has none. */
export function riderText(product: Product, t: T, g: { includeRider: boolean; riderIdx: number }): string {
  if (!g.includeRider) return "";
  return product === "pa" ? `ME ${GI.paMeCoverLevels[g.riderIdx]}` : `OPD ${t("plan")} ${g.riderIdx + 1}`;
}

/** The label under each rider button: a cover amount for PA, a plan number for health. */
export function riderLevelLabel(product: Product, t: T, idx: number): string {
  return product === "pa" ? GI.paMeCoverLevels[idx] : `${t("plan")} ${idx + 1}`;
}

function benefitLines(product: Product, t: T, groups: GroupQuote[], anyRider: boolean): BenefitLine[] {
  const lines: BenefitLine[] = [];
  if (product === "pa") {
    for (const b of GI.paMainBenefits) {
      lines.push({ label: t(b.key as Key), values: groups.map((g) => b.values[g.planIdx]) });
    }
    if (anyRider) {
      lines.push({
        label: t("meSelected"),
        values: groups.map((g) => (g.includeRider ? GI.paMeCoverLevels[g.riderIdx] : "—")),
      });
    }
    return lines;
  }
  // OPD is pulled out of the main list because it is the rider, and reads off riderIdx
  for (const b of GI.healthBenefits) {
    if (b.key === "hOpdPerVisit") continue;
    lines.push({ label: t(b.key as Key), values: groups.map((g) => b.values[g.planIdx]) });
  }
  if (anyRider) {
    const opd = GI.healthBenefits.find((b) => b.key === "hOpdPerVisit");
    lines.push({
      label: t("hOpdPerVisit"),
      values: groups.map((g) => (g.includeRider && opd ? opd.values[g.riderIdx] : "—")),
    });
  }
  return lines;
}

export function buildQuoteSheet(product: Product, t: T, groups: GroupInput[]): QuoteSheet {
  const isPa = product === "pa";
  const result = computeMultiGroupQuote(product, groups);
  const anyRider = result.groups.some((g) => g.includeRider);
  const bizLabels = BIZ_LABEL_KEYS[product];

  const columns: GroupColumn[] = result.groups.map((g, i) => ({
    no: i + 1,
    name: g.name,
    bizTypeLabel: t(bizLabels[g.bizType] as Key),
    planLabel: planLabel(product, t, g.planIdx),
    riderText: riderText(product, t, g),
    count: g.count,
    includeRider: g.includeRider,
    mainPremium: g.mainPremium,
    riderPremium: g.riderPremium,
    perPerson: g.perPerson,
    subtotal: g.subtotal,
  }));

  return {
    isPa,
    result,
    anyRider,
    columns,
    benefits: benefitLines(product, t, result.groups, anyRider),
    mainLabel: isPa ? t("mainPremium") : t("ipdPremium"),
    riderLabel: isPa ? t("mePremium") : t("opdPremium"),
    riderToggleLabel: isPa ? t("mePlan") : t("opdPlan"),
    riderMaxNote: isPa ? t("meMaxOne") : t("opdMaxOne"),
    productLabel: t(isPa ? "productPa" : "productHealth"),
  };
}

/**
 * The quotation as a LINE message.
 *
 * Plain text with a few emoji standing in for the headings, because LINE renders nothing
 * else — and an agent forwards this to an HR manager who will read it on a phone, so each
 * group is two short lines rather than a table that wraps into porridge.
 */
export function lineMessage(product: Product, t: T, fmt: (n: number) => string, sheet: QuoteSheet): string {
  const { result } = sheet;
  const lines = [
    `💼 ${t(sheet.isPa ? "quoteTitleMultiPa" : "quoteTitleMultiHealth")}`,
    `👥 ${t("totalPeople")}: ${fmt(result.totalCount)} ${t("people")} (${t("bandUsed")} ${result.band})`,
    "",
  ];
  for (const col of sheet.columns) {
    lines.push(
      `▶ ${t("groupNo")} ${col.no}${col.name ? ` · ${col.name}` : ""}: ${col.bizTypeLabel} · ${col.planLabel}${col.riderText ? ` · ${col.riderText}` : ""}`,
      `   ${fmt(col.perPerson)} × ${fmt(col.count)} = ${fmt(col.subtotal)} ${t("baht")}`,
    );
  }
  lines.push("", `✅ ${t("totalPremiumYear")}: ${fmt(result.grandTotal)} ${t("baht")}`);
  return lines.join("\n");
}
