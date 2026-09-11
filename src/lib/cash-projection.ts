import type { DeathBenefit } from "@/calc/types";

/**
 * One policy walked forward a year at a time — what has been paid in, what the family would
 * receive, and what surrendering would return.
 *
 * Every amount is in satang, the way the whole of calc/money.ts works. The company's table
 * gives surrender values in whole baht, so they are multiplied up when the rows are built:
 * comparing a premium against a cash value then needs no rounding on either side first, and
 * the year the one overtakes the other is exact.
 */
export interface ProjectionRow {
  policyYear: number;
  /** the insured's age at the start of that policy year, as the company table labels it */
  age: number;
  /** what the family receives if the insured dies that year */
  cover: number;
  /** the premium falling due that year; 0 once the paying term is over, null with no price */
  premiumDue: number | null;
  /** every premium due up to and including this year */
  premiumPaid: number | null;
  /** what surrendering at the end of that year returns */
  cashValue: number;
}

export interface Projection {
  rows: ProjectionRow[];
  /** the first year the policy is worth at least what has been put into it */
  breakEven: ProjectionRow | null;
  /** how many opening years return nothing at all */
  zeroYears: number;
  /** the age the last row's money is held at — the company labels it the year after */
  maturityAge: number;
}

export interface ProjectionInput {
  /** cash-value factors per thousand of sum assured, one per policy year from the first */
  factors: number[];
  /** the insured's age when the policy is issued */
  age: number;
  sumAssured: number;
  /** the yearly premium in satang, or null when no price may be shown */
  annualSatang: number | null;
  /** how many years the premium is paid */
  payYears: number;
  death: DeathBenefit;
}

export function cashProjection(
  { factors, age, sumAssured, annualSatang, payYears, death }: ProjectionInput,
): Projection {
  let paid = 0;
  const rows: ProjectionRow[] = factors.map((factor, i) => {
    const at = age + i;
    const due = annualSatang === null ? null : i < payYears ? annualSatang : 0;
    if (due !== null) paid += due;
    return {
      policyYear: i + 1,
      age: at,
      cover: (at < death.beforeAge ? death.sumBefore : death.sumFrom) * 100,
      premiumDue: due,
      premiumPaid: annualSatang === null ? null : paid,
      // the same ROUND(factor × sum / 1000) baht as cash-value.ts, then carried in satang
      cashValue: Math.round((factor * sumAssured) / 1000) * 100,
    };
  });

  let zeroYears = 0;
  while (zeroYears < rows.length && rows[zeroYears].cashValue === 0) zeroYears += 1;

  const breakEven = rows.find((r) => r.premiumPaid !== null && r.cashValue >= r.premiumPaid) ?? null;
  return { rows, breakEven, zeroYears, maturityAge: age + factors.length };
}
