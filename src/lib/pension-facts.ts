import {
  availablePensionAges, PENSION_AGES, PENSION_LIMITS, quotePension, type PensionQuote,
} from "@/calc/pension/engine";

/**
 * Every figure the /bumnan95 copy states, worked out by the engine rather than typed into a
 * sentence — so a new rate table changes the page and cannot leave it saying last year's
 * price.
 */
export interface PensionCopyFacts {
  ageMin: number;
  ageMax: number;
  pensionAges: number[];
  /** the oldest a person may be to choose each pension age, paying until it starts */
  latestEntry: { pensionAge: number; ageMax: number }[];
  example: { age: number; sex: "M" | "F"; monthly: number; quote: PensionQuote };
  rateVersion: string;
}

/** The example is the one the chat and the page open on: a man of 40 wanting 10,000 a month from 60. */
const EXAMPLE = { age: 40, sex: "M" as const, annuityAge: 60, monthly: 10_000 };

export function pensionFacts(): PensionCopyFacts {
  const r = quotePension({
    age: EXAMPLE.age, sex: EXAMPLE.sex, annuityAge: EXAMPLE.annuityAge, pay: "untilAnnuity",
    mode: "annual", basis: "monthlyPension", amount: EXAMPLE.monthly,
  });
  if (!r.ok) throw new Error(`the page's example no longer prices: ${r.error}`);
  const latestEntry = PENSION_AGES.map((pensionAge) => {
    let ageMax = PENSION_LIMITS.ageMin;
    for (let a = PENSION_LIMITS.ageMin; a <= PENSION_LIMITS.ageMax; a++) {
      if (availablePensionAges(a, "untilAnnuity").includes(pensionAge)) ageMax = a;
    }
    return { pensionAge, ageMax };
  });
  return {
    ageMin: PENSION_LIMITS.ageMin,
    ageMax: PENSION_LIMITS.ageMax,
    pensionAges: [...PENSION_AGES],
    latestEntry,
    example: { age: EXAMPLE.age, sex: EXAMPLE.sex, monthly: EXAMPLE.monthly, quote: r.quote },
    rateVersion: "A2026-1",
  };
}
