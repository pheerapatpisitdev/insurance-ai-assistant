import { getBundle } from "@/calc/bundles/registry";
import { quoteBundle } from "@/calc/bundles/quote";
import { getPlan } from "@/calc/plans/registry";
import { formatBaht } from "@/calc/money";
import { perDay } from "@/lib/legacy-cta";
import { legacyTable } from "@/lib/legacy-table";

/**
 * The figures the sales copy quotes, taken from the engine rather than typed into the JSX.
 *
 * They were written out by hand, and that was the same defect the death benefit had: a
 * number in prose has no idea the table behind it has moved. Worse, the calculator already
 * refuses to show a price once the rate table lapses — so a hand-written page would have
 * gone on advertising last year's premium beside a calculator that had gone silent.
 *
 * Every price here is therefore null when the table has expired, and the copy that would
 * have quoted it says something else instead.
 */
export interface LegacyCopyFacts {
  expired: boolean;
  /** the rate table these figures come from, e.g. "A2026-1" */
  rateVersion: string;
  ageMin: number;
  ageMax: number;
  diseaseCount: number;
  /** the cheapest honest opening figure: the youngest woman's smallest plan, in baht a day */
  fromPerDay: number | null;
  /** the age that opening figure belongs to */
  fromAge: number;
  /** what waiting costs, for the question about the premium rising */
  waiting: { youngAge: number; young: string; olderAge: number; older: string } | null;
  /** the smallest plan, itemised for the block that shows what is being bought */
  plan1: { base: string; rider: string; total: string; before60: string; endAge: number; endSum: string };
}

const BUNDLE = getBundle("LEGACY_FAMILY")!;
/** The figure in the hero belongs to a woman of this age on the smallest plan. */
const FROM_AGE = 35;
/** The two ages the FAQ contrasts to show what starting later costs. */
const WAIT_FROM = 30;
const WAIT_TO = 45;

export function legacyFacts(today: Date = new Date()): LegacyCopyFacts {
  const table = legacyTable(today);
  const annual = (age: number, sex: "M" | "F") =>
    quoteBundle(BUNDLE, 1, { age, sex, mode: "annual" }, today)?.totalAnnual;

  const from = annual(FROM_AGE, "F");
  const young = annual(WAIT_FROM, "M");
  const older = annual(WAIT_TO, "M");
  const death = table.death[0].under;
  const tier = BUNDLE.tiers[0];

  return {
    expired: table.expired,
    rateVersion: getPlan(BUNDLE.planCode)!.rates.version,
    ageMin: table.ageMin,
    ageMax: table.ageMax,
    diseaseCount: table.diseaseCount,
    fromPerDay: table.expired || !from ? null : perDay(from),
    fromAge: FROM_AGE,
    waiting: table.expired || !young || !older
      ? null
      : { youngAge: WAIT_FROM, young: formatBaht(young), olderAge: WAIT_TO, older: formatBaht(older) },
    plan1: {
      base: tier.sumAssured.toLocaleString("en-US"),
      rider: tier.riders[0].sumAssured!.toLocaleString("en-US"),
      total: death.sumFrom.toLocaleString("en-US"),
      before60: death.sumBefore.toLocaleString("en-US"),
      endAge: death.riderCoverEnds!.age,
      endSum: death.riderCoverEnds!.sum.toLocaleString("en-US"),
    },
  };
}
