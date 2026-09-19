import { formatBaht } from "@/calc/money";

/**
 * One year of a contract that is protection and nothing else.
 *
 * The same shape the card's `ValueTableRow` carries, minus the surrender column, because a
 * plan with no surrender value has nothing to put in one.
 */
export interface CoverRow {
  year: number;
  /** the insured's age at the start of that policy year, as the company table labels it */
  age: number;
  /** the premium falling due that year, or "—" once the paying term is over */
  due: string;
  /** every premium due up to and including this year, or null with no price to show */
  paid: string | null;
  cover: string;
}

export interface CoverRowsInput {
  /** how many years the contract runs */
  years: number;
  /** how many of them carry a premium */
  payYears: number;
  /** the insured's age when the policy is issued */
  age: number;
  /** the yearly premium in satang, or null when no price may be shown */
  annualSatang: number | null;
  /** what the family receives, in satang — flat for a term plan */
  coverSatang: number;
}

/**
 * The year-by-year table of a term plan, built once for both the things that show it.
 *
 * The picture and the page were drawn from two copies of this loop for about an hour, which
 * is exactly the arrangement this project keeps having to undo: two places computing one
 * table will eventually disagree by a baht or a year, and nothing will say which is right.
 * There is a test that runs the card's rows against this function's for the same insured.
 */
export function coverRows(
  { years, payYears, age, annualSatang, coverSatang }: CoverRowsInput,
): CoverRow[] {
  let paid = 0;
  return Array.from({ length: years }, (_, i) => {
    const due = annualSatang === null ? null : i < payYears ? annualSatang : 0;
    if (due !== null) paid += due;
    return {
      year: i + 1,
      age: age + i,
      due: due ? formatBaht(due) : "—",
      paid: due === null ? null : formatBaht(paid),
      cover: formatBaht(coverSatang),
    };
  });
}
