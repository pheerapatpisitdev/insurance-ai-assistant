import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { PER, displayPremium } from "@/lib/legacy-cta";
import { spoken } from "@/lib/lifeprotect-facts";
import { cashProjection } from "@/lib/cash-projection";
import {
  cashAt, deathBenefitOf, leverage, lifeTreasureModes, payYears, termAt, totalPaid,
} from "@/lib/lifetreasure-quote";
import { lifeTreasureTable, type LifeTreasureTable, type LifeTreasureTerm } from "@/lib/lifetreasure-table";

/**
 * The figures the sales copy quotes, taken from the engine rather than typed into the JSX —
 * the rule lifeprotect-facts.ts follows, for the same reason: a number in prose has no idea
 * the table behind it has moved. Every price here is null once the rate table lapses, and
 * the copy says something else instead.
 */
export interface LifeTreasureTermExample {
  label: string;
  short: string;
  years: number;
  /** the headline instalment, or null when no price may be shown */
  premium: string | null;
  /** the yearly premium, so a monthly one can stand beside the total it was added up from */
  annualPremium: string | null;
  /** "/เดือน" or "/ปี", matching `premium` */
  per: string | null;
  /** every premium over the paying term, or null */
  total: string | null;
  /** the sum as a multiple of those premiums, e.g. "2.0", or null when it is not above one */
  leverage: string | null;
}

export interface LifeTreasureCopyFacts {
  expired: boolean;
  rateVersion: string;
  ageMin: number;
  ageMax: number;
  coverToAge: number;
  saMin: string;
  saMinShort: string;
  saMax: string;
  saMaxShort: string;
  /** the share of premiums paid the death benefit never falls below */
  premiumFloorPercent: number;
  /** the cheapest honest opening figure, on whichever term prices the example lowest */
  from: { termShort: string; premium: string | null; per: string | null };
  /** the block that compares the three terms */
  example: {
    age: number;
    sex: Sex;
    sum: string;
    sumShort: string;
    terms: LifeTreasureTermExample[];
  };
  /**
   * What the policy is worth along the way for the example insured on the middle term: the
   * year the surrender value catches up with the premiums, and the money held at the end.
   */
  growth: {
    termLabel: string;
    breakEvenAge: number | null;
    breakEvenYear: number | null;
    /** the surrender value at the end of cover — this plan's is the whole sum assured */
    atEnd: string;
    at70: string | null;
  } | null;
}

/** The insured the comparison is drawn on: the age this plan is actually bought at. */
const EXAMPLE = { age: 45, sex: "M" as Sex };
/** The term the growth block is read off — the middle one, and the one most often written. */
const GROWTH_TERM = "H99F12A";

const money = (baht: number) => baht.toLocaleString("en-US");

const annualOf = (table: LifeTreasureTable, term: LifeTreasureTerm, who: { age: number; sex: Sex; sum: number }) =>
  lifeTreasureModes(table, term, { sex: who.sex, age: who.age, sumAssured: who.sum })?.find((m) => m.mode === "annual");

export function lifeTreasureFacts(today: Date = new Date()): LifeTreasureCopyFacts {
  const table = lifeTreasureTable(today);
  // the comparison is drawn on the smallest policy the plan issues, so the figures are the
  // ones a stranger reading the page could actually start from
  const who = { age: EXAMPLE.age, sex: EXAMPLE.sex, sum: table.saMin };

  const headline = (term: LifeTreasureTerm): ModePremium | undefined =>
    displayPremium(lifeTreasureModes(table, term, { sex: who.sex, age: who.age, sumAssured: who.sum }), table.expired);

  // the opening figure is the cheapest of the three terms rather than one picked in advance:
  // which prices lowest moves with age, and the copy should not have to know
  const cheapest = table.terms
    .map((term) => ({ term, annual: annualOf(table, term, who) }))
    .filter((x): x is { term: LifeTreasureTerm; annual: ModePremium } => x.annual !== undefined)
    .sort((a, b) => a.annual.total - b.annual.total)[0];
  const fromShown = cheapest ? headline(cheapest.term) : undefined;

  const growthTerm = termAt(table, GROWTH_TERM);
  const growthAnnual = annualOf(table, growthTerm, who);
  const factors = growthTerm.schedule[who.sex][who.age - table.ageMin];
  const projection = factors
    ? cashProjection({
      factors, age: who.age, sumAssured: who.sum,
      annualSatang: table.expired || !growthAnnual ? null : growthAnnual.total,
      payYears: payYears(growthTerm), death: deathBenefitOf(who.sum), topUp: table.topUp,
    })
    : undefined;
  const milestones = cashAt(growthTerm, who.sex, who.age, who.sum, table.ageMin);

  return {
    expired: table.expired,
    rateVersion: table.rateVersion,
    ageMin: table.ageMin,
    ageMax: table.ageMax,
    coverToAge: table.coverToAge,
    saMin: money(table.saMin),
    saMinShort: spoken(table.saMin),
    saMax: money(table.saMax),
    saMaxShort: spoken(table.saMax),
    premiumFloorPercent: table.topUp.premiumPercent,
    from: {
      termShort: cheapest?.term.short ?? "",
      premium: fromShown ? formatBaht(fromShown.total) : null,
      per: fromShown ? PER[fromShown.mode] : null,
    },
    example: {
      age: who.age,
      sex: who.sex,
      sum: money(who.sum),
      sumShort: spoken(who.sum),
      terms: table.terms.map((term) => {
        const shown = headline(term);
        const annual = annualOf(table, term, who);
        const total = annual ? totalPaid(annual.total, term) : null;
        const times = total !== null ? leverage(who.sum, total) : null;
        return {
          label: term.label,
          short: term.short,
          years: term.payTerm,
          premium: shown ? formatBaht(shown.total) : null,
          annualPremium: annual && !table.expired ? formatBaht(annual.total) : null,
          per: shown ? PER[shown.mode] : null,
          total: total !== null && !table.expired ? formatBaht(total) : null,
          leverage: times !== null && !table.expired ? times.toFixed(1) : null,
        };
      }),
    },
    growth: projection
      ? {
        termLabel: growthTerm.label,
        // the break-even year only exists while there is a price to compare against
        breakEvenAge: projection.breakEven?.age ?? null,
        breakEvenYear: projection.breakEven?.policyYear ?? null,
        atEnd: money(milestones[milestones.length - 1]?.amount ?? 0),
        at70: milestones.find((r) => r.age === 70)?.amount.toLocaleString("en-US") ?? null,
      }
      : null,
  };
}
