import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { PER, displayPremium } from "@/lib/legacy-cta";
import { spoken } from "@/lib/lifeprotect-facts";
import { cashProjection } from "@/lib/cash-projection";
import {
  cashAt, deathBenefitOf, easyProtectModes, leverage, payYears, termAt, totalPaid,
} from "@/lib/easyprotect-quote";
import { easyProtectTable } from "@/lib/easyprotect-table";

/**
 * The figures the sales copy quotes, taken from the engine rather than typed into the JSX —
 * the rule lifeprotect-facts.ts follows, for the same reason: a number in prose has no idea
 * the table behind it has moved. Every price here is null once the rate table lapses, and
 * the copy says something else instead.
 */
export interface EasyProtectAgeExample {
  age: number;
  /** the headline instalment at that age, or null when no price may be shown */
  premium: string | null;
  /** "/เดือน" or "/ปี", matching `premium` */
  per: string | null;
  /** all six years of premium added up, or null */
  total: string | null;
  /** the sum as a multiple of those premiums, e.g. "3.4", or null when it is not above one */
  leverage: string | null;
}

export interface EasyProtectCopyFacts {
  expired: boolean;
  rateVersion: string;
  ageMin: number;
  ageMax: number;
  coverToAge: number;
  /** years the premium is paid — the whole point of the plan, so the copy never hardcodes it */
  payYears: number;
  saMin: string;
  saMinShort: string;
  saMax: string;
  saMaxShort: string;
  /** the share of premiums paid the death benefit never falls below */
  premiumFloorPercent: number;
  /** the cheapest honest opening figure: the smallest sum, at the age the example is drawn on */
  from: { premium: string | null; per: string | null; age: number; sex: Sex };
  /** the block that shows what starting earlier is worth, on one sum assured */
  example: {
    sex: Sex;
    sum: string;
    sumShort: string;
    ages: EasyProtectAgeExample[];
  };
  /**
   * What the policy is worth along the way for the example insured: the year the surrender
   * value catches up with the premiums, and the money held at each milestone.
   */
  growth: {
    age: number;
    breakEvenAge: number | null;
    breakEvenYear: number | null;
    /** the surrender value at the end of cover — this plan's is the whole sum assured */
    atEnd: string;
    at60: string | null;
  } | null;
}

/**
 * The insured the comparison is drawn on. Thirty-five is the age this plan is written at:
 * old enough to have the six years of premium, young enough that the multiple is the reason
 * to buy it.
 */
const EXAMPLE = { age: 35, sex: "M" as Sex };
/** The three ages the comparison puts side by side — the point being that the youngest wins. */
const AGES = [25, 35, 45];

const money = (baht: number) => baht.toLocaleString("en-US");

export function easyProtectFacts(today: Date = new Date()): EasyProtectCopyFacts {
  const table = easyProtectTable(today);
  const term = termAt(table, table.terms[0].variant);
  // the comparison is drawn on the smallest policy the plan issues, so the figures are the
  // ones a stranger reading the page could actually start from
  const sum = table.saMin;

  const modesAt = (age: number, sex: Sex = EXAMPLE.sex) =>
    easyProtectModes(table, term, { sex, age, sumAssured: sum });
  const headlineAt = (age: number): ModePremium | undefined => displayPremium(modesAt(age), table.expired);
  const annualAt = (age: number) => modesAt(age)?.find((m) => m.mode === "annual");

  const fromShown = headlineAt(EXAMPLE.age);

  const factors = term.schedule[EXAMPLE.sex][EXAMPLE.age - table.ageMin];
  const growthAnnual = annualAt(EXAMPLE.age);
  const projection = factors
    ? cashProjection({
      factors, age: EXAMPLE.age, sumAssured: sum,
      annualSatang: table.expired || !growthAnnual ? null : growthAnnual.total,
      payYears: payYears(term), death: deathBenefitOf(sum), topUp: table.topUp,
    })
    : undefined;
  const milestones = cashAt(term, EXAMPLE.sex, EXAMPLE.age, sum, table.ageMin);

  return {
    expired: table.expired,
    rateVersion: table.rateVersion,
    ageMin: table.ageMin,
    ageMax: table.ageMax,
    coverToAge: table.coverToAge,
    payYears: term.payTerm,
    saMin: money(table.saMin),
    saMinShort: spoken(table.saMin),
    saMax: money(table.saMax),
    saMaxShort: spoken(table.saMax),
    premiumFloorPercent: table.topUp.premiumPercent,
    from: {
      premium: fromShown ? formatBaht(fromShown.total) : null,
      per: fromShown ? PER[fromShown.mode] : null,
      age: EXAMPLE.age,
      sex: EXAMPLE.sex,
    },
    example: {
      sex: EXAMPLE.sex,
      sum: money(sum),
      sumShort: spoken(sum),
      ages: AGES.map((age) => {
        const shown = headlineAt(age);
        const annual = annualAt(age);
        const total = annual ? totalPaid(annual.total, term) : null;
        const times = total !== null ? leverage(sum, total) : null;
        return {
          age,
          premium: shown ? formatBaht(shown.total) : null,
          per: shown ? PER[shown.mode] : null,
          total: total !== null && !table.expired ? formatBaht(total) : null,
          leverage: times !== null && !table.expired ? times.toFixed(1) : null,
        };
      }),
    },
    growth: projection
      ? {
        age: EXAMPLE.age,
        // the break-even year only exists while there is a price to compare against
        breakEvenAge: projection.breakEven?.age ?? null,
        breakEvenYear: projection.breakEven?.policyYear ?? null,
        atEnd: money(milestones[milestones.length - 1]?.amount ?? 0),
        at60: milestones.find((r) => r.age === 60)?.amount.toLocaleString("en-US") ?? null,
      }
      : null,
  };
}
