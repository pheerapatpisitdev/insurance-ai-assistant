/**
 * What a phone shows of a table built for a sheet of paper.
 *
 * It began in the benefit table's own file, which is a React module — and `ihealthy-card.ts`,
 * which draws the same table as a picture, was reaching into it for these. The bot draws it
 * too now, so the answer to "which plans and which rows fit a narrow surface" lives on its
 * own rather than inside whichever surface asked first.
 */

/**
 * Three plans and three figures, chosen by the user. Six columns of Thai do not fit a phone
 * at a size worth reading, and forty-one rows of them is a document rather than a
 * comparison — so a phone gets the middle three plans and the three figures that separate
 * them, and the whole table waits on a wider screen.
 *
 * The plan being quoted is always kept, whichever it is: a link can arrive carrying
 * แพลทินั่ม and a child is sold สมาร์ท, and the column the card is pricing must not be the
 * one column missing from the table under it.
 */
export const PHONE_PLANS = ["BRONZE", "SILVER", "GOLD"];

/**
 * The rows a phone shows, and what to call them there.
 *
 * The company's own wording runs to thirteen lines in a column a phone can spare for it,
 * which is a paragraph where a label is wanted. The short form is the page's own and is only
 * ever a label: a wide screen and a printed sheet both keep the contract's words, which is
 * what a customer is actually buying.
 *
 * One map rather than a list and a lookup, so a row cannot be shown without a name for it.
 */
export const PHONE_ROW_LABEL: Record<number, { icon: string; label: string }> = {
  1: { icon: "🛏️", label: "ค่าห้องและค่าอาหาร" },
  5: { icon: "🏥", label: "Day Surgery" },
  7: { icon: "🚑", label: "อุบัติเหตุ OPD 24 ชม" },
  10: { icon: "🎗️", label: "มะเร็ง รังสีรักษา" },
  18: { icon: "💊", label: "ผู้ป่วยนอก OPD" },
};

/**
 * The columns a phone-width picture carries, in the sheet's own order.
 *
 * `sellable` is what `plansFor` says the company writes at this age, and nothing outside it
 * is ever returned — a picture with a column the customer cannot buy is an advertisement for
 * something that does not exist. Ages 6–10 are sold two plans in total, which is fewer than
 * the three a phone shows, so they get both rather than a single column with nothing to
 * compare it against.
 */
export function phoneColumns(
  order: readonly string[], sellable: readonly string[], selected?: string,
): string[] {
  const sold = order.filter((code) => sellable.includes(code));
  const three = sold.filter((code) => PHONE_PLANS.includes(code));
  const shown = three.length >= 2 ? three : sold;
  const keep = selected && sold.includes(selected) && !shown.includes(selected)
    ? [...shown, selected]
    : shown;
  return order.filter((code) => keep.includes(code));
}
