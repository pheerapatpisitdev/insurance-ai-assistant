import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { PER, displayPremium, perDay } from "@/lib/legacy-cta";
import { spoken } from "@/lib/lifeprotect-facts";
import { coverEndsAt, perMillion, plbDiscount, plbModes, termAt, totalPaid } from "@/lib/plb-quote";
import { plbTable, type PlbTable, type PlbTerm } from "@/lib/plb-table";

/**
 * The figures the sales copy quotes, taken from the engine rather than typed into the JSX —
 * the rule ishield-facts.ts follows, for the same reason: a number in prose has no idea the
 * table behind it has moved. Every price here is null once the rate table lapses, and the
 * copy says something else instead.
 */
export interface PlbTermExample {
  label: string;
  short: string;
  years: number;
  /** the age the cover ends at for the example insured */
  endsAtAge: number;
  /** the headline instalment, or null when no price may be shown */
  premium: string | null;
  /** "/เดือน" or "/ปี", matching `premium` */
  per: string | null;
  /** every premium over the term, or null */
  total: string | null;
}

export interface PlbCopyFacts {
  expired: boolean;
  rateVersion: string;
  ageMin: number;
  ageMax: number;
  saMin: string;
  saMinShort: string;
  saMax: string;
  saMaxShort: string;
  /** the cheapest honest opening figure, on the term that happens to price it lowest */
  from: { age: number; sexWord: string; sum: string; sumShort: string; termShort: string; perDay: number | null };
  /** the block that compares the four terms */
  example: { age: number; sex: Sex; sum: string; sumShort: string; terms: PlbTermExample[] };
  /**
   * What the sum-assured discount is worth, priced both ways on one insured: the same cover
   * per million costs less once the sum clears the top threshold.
   */
  scale: {
    termLabel: string;
    small: { sum: string; sumShort: string; perMillion: string | null };
    big: { sum: string; sumShort: string; perMillion: string | null };
    savedPercent: number | null;
  } | null;
  /** the largest discount per thousand the table gives, and the sum it starts at */
  discount: { perThousand: number; fromSum: string; fromSumShort: string };
}

/** The cheapest instalment the page opens on is quoted on a real person, not on a floor price. */
const FROM = { age: 30, sex: "F" as Sex, sum: 1_000_000 };
const EXAMPLE = { age: 35, sex: "M" as Sex, sum: 1_000_000 };
/** The term the discount comparison is priced on — the one the company's own proposal uses. */
const SCALE_TERM = "PLB12";

const money = (baht: number) => baht.toLocaleString("en-US");

const annualOf = (table: PlbTable, term: PlbTerm, who: { age: number; sex: Sex; sum: number }) =>
  plbModes(table, term, { sex: who.sex, age: who.age, sumAssured: who.sum })?.find((m) => m.mode === "annual");

export function plbFacts(today: Date = new Date()): PlbCopyFacts {
  const table = plbTable(today);

  const headline = (term: PlbTerm, who: { age: number; sex: Sex; sum: number }): ModePremium | undefined =>
    displayPremium(plbModes(table, term, { sex: who.sex, age: who.age, sumAssured: who.sum }), table.expired);

  // the opening figure is the cheapest of the four terms rather than a term picked in
  // advance: which one prices lowest moves with age, and the copy should not have to know
  const priced = table.terms
    .map((term) => ({ term, annual: annualOf(table, term, FROM) }))
    .filter((x): x is { term: PlbTerm; annual: ModePremium } => x.annual !== undefined)
    .sort((a, b) => a.annual.total - b.annual.total);
  const cheapest = priced[0];

  // the top discount tier, and the sum at which it starts
  const tiers = table.discount.byVariant[SCALE_TERM] ?? [];
  const best = tiers.reduce((at, value, i) => (value > (tiers[at] ?? 0) ? i : at), 0);

  const scaleTerm = termAt(table, SCALE_TERM);
  const smallSum = table.saMin;
  const bigSum = table.discount.thresholds[best];
  const smallAnnual = annualOf(table, scaleTerm, { ...EXAMPLE, sum: smallSum });
  const bigAnnual = annualOf(table, scaleTerm, { ...EXAMPLE, sum: bigSum });
  const smallPer = smallAnnual ? perMillion(smallAnnual.total, smallSum) : null;
  const bigPer = bigAnnual ? perMillion(bigAnnual.total, bigSum) : null;

  return {
    expired: table.expired,
    rateVersion: table.rateVersion,
    ageMin: table.ageMin,
    ageMax: table.ageMax,
    saMin: money(table.saMin),
    saMinShort: spoken(table.saMin),
    saMax: money(table.saMax),
    saMaxShort: spoken(table.saMax),
    from: {
      age: FROM.age,
      sexWord: FROM.sex === "M" ? "ชาย" : "หญิง",
      sum: money(FROM.sum),
      sumShort: spoken(FROM.sum),
      termShort: cheapest?.term.short ?? "",
      perDay: table.expired || !cheapest ? null : perDay(cheapest.annual.total),
    },
    example: {
      age: EXAMPLE.age,
      sex: EXAMPLE.sex,
      sum: money(EXAMPLE.sum),
      sumShort: spoken(EXAMPLE.sum),
      terms: table.terms.map((term) => {
        const shown = headline(term, EXAMPLE);
        const annual = annualOf(table, term, EXAMPLE);
        return {
          label: term.label,
          short: term.short,
          years: term.years,
          endsAtAge: coverEndsAt(term, EXAMPLE.age),
          premium: shown ? formatBaht(shown.total) : null,
          per: shown ? PER[shown.mode] : null,
          total: annual && !table.expired ? formatBaht(totalPaid(annual.total, term)) : null,
        };
      }),
    },
    scale: table.expired || smallPer === null || bigPer === null ? null : {
      termLabel: scaleTerm.label,
      small: { sum: money(smallSum), sumShort: spoken(smallSum), perMillion: money(smallPer) },
      big: { sum: money(bigSum), sumShort: spoken(bigSum), perMillion: money(bigPer) },
      savedPercent: Math.round(((smallPer - bigPer) / smallPer) * 100),
    },
    discount: {
      perThousand: plbDiscount(table, SCALE_TERM, bigSum),
      fromSum: money(bigSum),
      fromSumShort: spoken(bigSum),
    },
  };
}
