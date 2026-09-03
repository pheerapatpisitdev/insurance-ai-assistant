import type { PlanRates } from "./types";

/**
 * Excel Cal!B32:K32:
 *   IF(SA>=T4, d4, IF(SA>=T3, d3, IF(SA>=T2, d2, IF(SA>=T1, d1, 0))))
 * Thresholds ascending; pick the highest threshold <= SA.
 */
export function discountPerThousand(rates: PlanRates, variant: string, sumAssured: number): number {
  const values = rates.discount.byVariant[variant];
  if (!values) return 0;
  const { thresholds } = rates.discount;
  let result = 0;
  for (let i = 0; i < thresholds.length; i++) {
    if (sumAssured >= thresholds[i]) result = values[i];
  }
  return result;
}
