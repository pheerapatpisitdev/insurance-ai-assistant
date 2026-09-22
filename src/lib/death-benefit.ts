import type { DeathBenefit } from "@/calc/types";

export interface BenefitRow {
  /** the ages this figure is payable in, in words */
  label: string;
  amount: number;
}

/**
 * How the bands are said. Thai unless a caller asks otherwise — the iHealthy Ultra page is
 * the one surface that reads in other languages, and it passes its own.
 */
export interface DeathWords {
  before: (age: number) => string;
  between: (from: number, to: number) => string;
  from: (age: number) => string;
  until: (age: number) => string;
  always: string;
}

const THAI: DeathWords = {
  before: (age) => `เสียชีวิตก่อนอายุ ${age} ปี`,
  between: (from, to) => `อายุ ${from}–${to} ปี`,
  from: (age) => `อายุ ${age} ปีขึ้นไป`,
  until: (age) => `จนถึงอายุ ${age} ปี`,
  always: "ทุกช่วงอายุ",
};

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
export function deathBenefitRows(db: DeathBenefit, words: DeathWords = THAI): BenefitRow[] {
  const ends = db.riderCoverEnds;
  const middle = ends ? words.between(db.beforeAge, ends.age - 1) : words.from(db.beforeAge);
  const rows: BenefitRow[] = db.alreadyPastAge
    ? [{ label: ends ? words.until(ends.age - 1) : words.always, amount: db.sumFrom }]
    : [
      { label: words.before(db.beforeAge), amount: db.sumBefore },
      { label: middle, amount: db.sumFrom },
    ];
  if (ends) rows.push({ label: words.from(ends.age), amount: ends.sum });
  return rows;
}
