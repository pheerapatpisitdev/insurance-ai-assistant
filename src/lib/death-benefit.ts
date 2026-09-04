import type { DeathBenefit } from "@/calc/types";

export interface BenefitRow {
  /** the ages this figure is payable in, in words */
  label: string;
  amount: number;
}

/**
 * The death benefit as the bands a person reads, rather than the fields it is stored in.
 *
 * There is one of these for the agent's quote, the customer's page, the copied summary and
 * the assistant's answers, because four hand-written versions of the same bands is four
 * chances for one of them to keep promising cover that has ended.
 *
 * Bands are closed at both ends wherever something follows them: an arrangement whose rider
 * stops at 75 reads "อายุ 60–74 ปี", never "อายุ 60 ปีขึ้นไป" over a figure that stops being
 * payable at 75.
 */
export function deathBenefitRows(db: DeathBenefit): BenefitRow[] {
  const ends = db.riderCoverEnds;
  const middle = ends ? `อายุ ${db.beforeAge}–${ends.age - 1} ปี` : `อายุ ${db.beforeAge} ปีขึ้นไป`;
  const rows: BenefitRow[] = db.alreadyPastAge
    ? [{ label: ends ? `จนถึงอายุ ${ends.age - 1} ปี` : "ทุกช่วงอายุ", amount: db.sumFrom }]
    : [
      { label: `เสียชีวิตก่อนอายุ ${db.beforeAge} ปี`, amount: db.sumBefore },
      { label: middle, amount: db.sumFrom },
    ];
  if (ends) rows.push({ label: `อายุ ${ends.age} ปีขึ้นไป`, amount: ends.sum });
  return rows;
}
