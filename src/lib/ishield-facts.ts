import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { PER, displayPremium, perDay } from "@/lib/legacy-cta";
import { totalPaid } from "@/lib/lifeprotect-quote";
import { spoken } from "@/lib/lifeprotect-facts";
import { cashAt, iShieldModes, illnessBenefit, payYears, termAt } from "@/lib/ishield-quote";
import { iShieldTable, type IShieldTerm } from "@/lib/ishield-table";

/**
 * The figures the sales copy quotes, taken from the engine rather than typed into the JSX —
 * the rule lifeprotect-facts.ts follows, for the same reason: a number in prose has no idea
 * the table behind it has moved. Every price here is null once the rate table lapses, and
 * the copy says something else instead.
 */
export interface IShieldTermExample {
  label: string;
  short: string;
  years: number;
  /** the headline instalment, or null when no price may be shown */
  premium: string | null;
  /** "/เดือน" or "/ปี", matching `premium` */
  per: string | null;
  /** every premium over the term, or null */
  total: string | null;
}

export interface IShieldCopyFacts {
  expired: boolean;
  rateVersion: string;
  ageMin: number;
  ageMax: number;
  maturityAge: number;
  saMin: string;
  saMax: string;
  illness: { earlyCount: number; earlyPercent: number; majorCount: number; majorPercent: number; waitingDays: number };
  /** the total number the headline says, e.g. 70 */
  illnessTotal: number;
  /** the cheapest honest opening figure: a woman of `fromAge` on a 500,000 sum, paying 20 years */
  fromAge: number;
  fromSum: string;
  fromPerDay: number | null;
  /** the block that compares the four terms */
  example: {
    age: number; sex: Sex; sum: string; sumShort: string;
    terms: IShieldTermExample[];
    /** what a diagnosis pays on that sum */
    early: string; major: string;
  };
  /** the cash value the copy quotes for the example insured on the ten-year term, at 60 */
  cash60: string;
}

const FROM = { age: 35, sex: "F" as Sex, sum: 500_000, variant: "WLCI20" };
const EXAMPLE = { age: 35, sex: "M" as Sex, sum: 1_000_000 };
const EXAMPLE_TERM = "WLCI10";

const money = (baht: number) => baht.toLocaleString("en-US");

export function iShieldFacts(today: Date = new Date()): IShieldCopyFacts {
  const table = iShieldTable(today);

  const headline = (term: IShieldTerm, who: { age: number; sex: Sex; sum: number }): ModePremium | undefined =>
    displayPremium(iShieldModes(table, term, { sex: who.sex, age: who.age, sumAssured: who.sum }), table.expired);
  const annualOf = (term: IShieldTerm, who: { age: number; sex: Sex; sum: number }) =>
    iShieldModes(table, term, { sex: who.sex, age: who.age, sumAssured: who.sum })?.find((m) => m.mode === "annual");

  const from = annualOf(termAt(table, FROM.variant), FROM);
  const exampleTerm = termAt(table, EXAMPLE_TERM);
  const benefit = illnessBenefit(table, EXAMPLE.sum);
  const cash60 = cashAt(exampleTerm, EXAMPLE.sex, EXAMPLE.age, EXAMPLE.sum, table.ageMin).find((r) => r.age === 60);

  return {
    expired: table.expired,
    rateVersion: table.rateVersion,
    ageMin: table.ageMin,
    ageMax: table.ageMax,
    maturityAge: table.maturityAge,
    saMin: money(table.saMin),
    saMax: money(table.saMax),
    illness: table.illness,
    illnessTotal: table.illness.earlyCount + table.illness.majorCount,
    fromAge: FROM.age,
    fromSum: money(FROM.sum),
    fromPerDay: table.expired || !from ? null : perDay(from.total),
    example: {
      age: EXAMPLE.age,
      sex: EXAMPLE.sex,
      sum: money(EXAMPLE.sum),
      sumShort: spoken(EXAMPLE.sum),
      early: money(benefit.early),
      major: money(benefit.major),
      terms: table.terms.map((term) => {
        const shown = headline(term, EXAMPLE);
        const annual = annualOf(term, EXAMPLE);
        const years = payYears(term);
        return {
          label: term.label,
          short: term.short,
          years,
          premium: shown ? formatBaht(shown.total) : null,
          per: shown ? PER[shown.mode] : null,
          total: shown && annual ? formatBaht(totalPaid(annual.total, years)) : null,
        };
      }),
    },
    cash60: cash60 ? money(cash60.amount) : "0",
  };
}
