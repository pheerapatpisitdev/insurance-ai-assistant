/**
 * What a group costs, and the one rule that surprises everybody.
 *
 * An employer rarely insures one uniform group. The office staff take a richer plan than the
 * drivers, and the drivers sit in a costlier risk class — so a quotation is several groups,
 * each with its own class, plan, rider and head count.
 *
 * The rule: the band is read off the **total** head count across every group, not each
 * group's own. Five office staff and five drivers are a group of ten and are priced at the
 * ten-person rate, even though neither half would reach ten alone. That is the insurer's
 * rule and it is the reason this file exists rather than a per-group function called in a
 * loop — the loop would quote each half as an uninsurable group of five.
 *
 * Health OPD is the second surprise and cuts the other way: it is the one table in either
 * product that ignores the band, so a rider premium looked up with one would be wrong.
 *
 * Nothing here rounds. Every figure is a table cell or the product of two of them, which is
 * what the insurer's own quotation does, and a stray `Math.round` here would put this tool
 * a baht away from the policy the customer eventually signs.
 */
import {
  GI,
  PRODUCT_LIMITS,
  type Band,
  type BizType,
  type Product,
} from "./data";

/** One group as the agent typed it. `count` is a string because it comes from a text field. */
export interface GroupInput {
  id: string;
  name: string;
  bizType: BizType;
  /** 0-5, into the six columns of the rate table */
  planIdx: number;
  includeRider: boolean;
  /** 0-5, into OPD's six plans or ME's six cover levels */
  riderIdx: number;
  count: string;
}

/** A group with its premiums filled in. */
export interface GroupQuote extends Omit<GroupInput, "count"> {
  count: number;
  /** IPD for health, the main PA cover for PA */
  mainPremium: number;
  /** OPD for health, ME for PA; zero when the rider is switched off */
  riderPremium: number;
  perPerson: number;
  subtotal: number;
}

export interface MultiGroupQuote {
  product: Product;
  totalCount: number;
  band: Band;
  /** false when the total falls outside what the product will write — see `min`/`max` */
  withinLimit: boolean;
  min: number;
  max: number;
  groups: GroupQuote[];
  grandTotal: number;
}

/** Health writes 10–100 people in three bands. */
export function healthBand(count: number): Band {
  if (count >= 51) return "51-100";
  if (count >= 26) return "26-50";
  return "10-25";
}

/** PA writes 5–2,000 in six, and the top band's key carries its own thousands separator. */
export function paBand(count: number): Band {
  if (count >= 1000) return "1,000-2,000";
  if (count >= 200) return "200-999";
  if (count >= 100) return "100-199";
  if (count >= 50) return "50-99";
  if (count >= 20) return "20-49";
  return "5-19";
}

export function bandFor(product: Product, totalCount: number): Band {
  return product === "pa" ? paBand(totalCount) : healthBand(totalCount);
}

/**
 * A missing cell is nought rather than a throw.
 *
 * The bands below a product's minimum have no row at all, and the agent passes through them
 * on the way to a valid figure — deleting the "1" out of "10" leaves a count of nothing for
 * as long as it takes to type "2". The page says the group is too small; it should not be
 * a page that has stopped working.
 */
function cell(table: Record<BizType, Record<Band, number[]>>, biz: BizType, band: Band, idx: number): number {
  return table[biz]?.[band]?.[idx] ?? 0;
}

export function computeMultiGroupQuote(product: Product, groups: GroupInput[]): MultiGroupQuote {
  const isPa = product === "pa";
  const totalCount = groups.reduce((sum, g) => sum + (Number(g.count) || 0), 0);
  const band = bandFor(product, totalCount);
  const { min, max } = PRODUCT_LIMITS[product];
  const mainTable = isPa ? GI.paMainPremiums : GI.healthIpdPremiums;

  const quoted: GroupQuote[] = groups.map((g) => {
    const count = Number(g.count) || 0;
    const mainPremium = cell(mainTable, g.bizType, band, g.planIdx);
    let riderPremium = 0;
    if (g.includeRider) {
      riderPremium = isPa
        ? cell(GI.paMePremiums, g.bizType, band, g.riderIdx)
        : // OPD is the one table that does not read the band
          (GI.healthOpdPremiums[g.bizType]?.[g.riderIdx] ?? 0);
    }
    const perPerson = mainPremium + riderPremium;
    return { ...g, count, mainPremium, riderPremium, perPerson, subtotal: perPerson * count };
  });

  return {
    product,
    totalCount,
    band,
    withinLimit: totalCount >= min && totalCount <= max,
    min,
    max,
    groups: quoted,
    grandTotal: quoted.reduce((sum, g) => sum + g.subtotal, 0),
  };
}

/**
 * The quotation's own number.
 *
 * Built from the date and the second of the day, so two quotations made in the same minute
 * are still told apart, and an agent reading one over the phone can say when it was made.
 * It is not stored anywhere and is not meant to be unique across agents — nothing looks a
 * quotation up by it.
 */
export function makeQuoteNo(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const ymd = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const secOfDay = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  return `QT-${ymd}-${String(secOfDay % 1000).padStart(3, "0")}`;
}
