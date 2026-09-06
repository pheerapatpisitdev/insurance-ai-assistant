import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { PER, displayPremium, perDay } from "@/lib/legacy-cta";
import { cashAt, deathBenefitOf, lifeProtectModes, payYears, totalPaid } from "@/lib/lifeprotect-quote";
import { lifeProtectTable, type LifeProtectTerm } from "@/lib/lifeprotect-table";

/**
 * The figures the sales copy quotes, taken from the engine rather than typed into the JSX —
 * the same rule legacy-facts.ts follows, for the same reason: a number in prose has no idea
 * the table behind it has moved, and the calculator already goes silent when the rate table
 * lapses. Every price here is null then, and the copy says something else instead.
 */
export interface TermExample {
  label: string;
  years: number;
  /** the headline instalment, or null when no price may be shown */
  premium: string | null;
  /** "/เดือน" or "/ปี", matching `premium` */
  per: string | null;
  /** every premium over the term, or null */
  total: string | null;
}

export interface LifeProtectCopyFacts {
  expired: boolean;
  rateVersion: string;
  ageMin: number;
  ageMax: number;
  boosterBeforeAge: number;
  coverToAge: number;
  /** the cheapest honest opening figure: a woman of `fromAge` on the smallest sum, paying to 99 */
  fromAge: number;
  fromSum: string;
  /** what the family receives on that smallest sum before the booster age — twice it */
  fromDouble: string;
  fromPerDay: number | null;
  /** the block that compares the three terms */
  example: { age: number; sex: Sex; sum: string; terms: TermExample[] };
  /** the block about buying for a child */
  newborn: { sum: string; double: string; termLabel: string; years: number; premium: string | null; per: string | null };
  /** the block about paying double; the short forms ("1 ล้าน") are for the headline */
  double: { sum: string; before: string; sumShort: string; beforeShort: string };
  /** the cash value the FAQ quotes: the example insured, 19-year term, at 60 */
  cash60: string;
}

const FROM = { age: 35, sex: "F" as Sex, sum: 500_000 };
const EXAMPLE = { age: 35, sex: "M" as Sex, sum: 1_000_000 };
const NEWBORN = { age: 0, sex: "M" as Sex, sum: 1_000_000 };
const CHILD_TERM = "WLF19H";

const money = (baht: number) => baht.toLocaleString("en-US");
/** A round sum the way it is said out loud: 1,000,000 → "1 ล้าน", 500,000 → "5 แสน". */
export const spoken = (baht: number) =>
  baht % 1_000_000 === 0 ? `${baht / 1_000_000} ล้าน`
    : baht % 100_000 === 0 ? `${baht / 100_000} แสน`
      : money(baht);

export function lifeProtectFacts(today: Date = new Date()): LifeProtectCopyFacts {
  const table = lifeProtectTable(today);
  const to99 = table.terms[table.terms.length - 1];
  const childTerm = table.terms.find((t) => t.variant === CHILD_TERM)!;

  const headline = (term: LifeProtectTerm, who: { age: number; sex: Sex; sum: number }): ModePremium | undefined =>
    displayPremium(lifeProtectModes(table, term, { sex: who.sex, age: who.age, sumAssured: who.sum }), table.expired);
  const annualOf = (term: LifeProtectTerm, who: { age: number; sex: Sex; sum: number }) =>
    lifeProtectModes(table, term, { sex: who.sex, age: who.age, sumAssured: who.sum })?.find((m) => m.mode === "annual");

  const from = annualOf(to99, FROM);
  const child = headline(childTerm, NEWBORN);
  const death = deathBenefitOf(table, EXAMPLE.age, EXAMPLE.sum);
  const cash60 = cashAt(childTerm, EXAMPLE.sex, EXAMPLE.age, EXAMPLE.sum, table.ageMin).find((r) => r.age === 60)!;

  return {
    expired: table.expired,
    rateVersion: table.rateVersion,
    ageMin: table.ageMin,
    ageMax: table.ageMax,
    boosterBeforeAge: table.boosterBeforeAge,
    coverToAge: table.coverToAge,
    fromAge: FROM.age,
    fromSum: money(FROM.sum),
    fromDouble: money(deathBenefitOf(table, FROM.age, FROM.sum).sumBefore),
    fromPerDay: table.expired || !from ? null : perDay(from.total),
    example: {
      age: EXAMPLE.age,
      sex: EXAMPLE.sex,
      sum: money(EXAMPLE.sum),
      terms: table.terms.map((term) => {
        const shown = headline(term, EXAMPLE);
        const annual = annualOf(term, EXAMPLE);
        const years = payYears(term, EXAMPLE.age);
        return {
          label: term.label,
          years,
          premium: shown ? formatBaht(shown.total) : null,
          per: shown ? PER[shown.mode] : null,
          total: shown && annual ? formatBaht(totalPaid(annual.total, years)) : null,
        };
      }),
    },
    newborn: {
      sum: money(NEWBORN.sum),
      double: money(deathBenefitOf(table, NEWBORN.age, NEWBORN.sum).sumBefore),
      termLabel: childTerm.label,
      years: payYears(childTerm, NEWBORN.age),
      premium: child ? formatBaht(child.total) : null,
      per: child ? PER[child.mode] : null,
    },
    double: {
      sum: money(EXAMPLE.sum), before: money(death.sumBefore),
      sumShort: spoken(EXAMPLE.sum), beforeShort: spoken(death.sumBefore),
    },
    cash60: money(cash60.amount),
  };
}
