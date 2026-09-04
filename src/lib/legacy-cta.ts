import type { ModePremium } from "@/calc/mode-premiums";

/**
 * The instalment to put in the largest type. A customer reads a monthly figure as what the
 * plan costs, so it is preferred — but only while the company will actually take it. Under
 * its monthly floor the instalment is not a price anyone can pay, so the yearly premium
 * takes the headline rather than a number the application would be refused for.
 *
 * Undefined means no price may be shown: the rate table has expired, or the arrangement
 * could not be priced at all.
 */
export function displayPremium(
  modes: ModePremium[] | undefined, expired: boolean,
): ModePremium | undefined {
  if (!modes || expired) return undefined;
  const monthly = modes.find((m) => m.mode === "monthly");
  if (monthly && !monthly.belowMinimum) return monthly;
  return modes.find((m) => m.mode === "annual");
}
