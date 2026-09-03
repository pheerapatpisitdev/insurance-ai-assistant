import type { PayMode, QuoteInput, QuoteResult } from "./types";
import { quote } from "./quote";

export interface ModePremium {
  mode: PayMode;
  /** the premium for one instalment, in satang */
  total: number;
  /** true when this instalment falls under the plan's monthly minimum */
  belowMinimum: boolean;
}

export const MODES: PayMode[] = ["annual", "semi", "monthly"];

/**
 * One arrangement priced in every payment mode. Each mode is quoted in full rather than
 * scaled from the annual figure, because the workbook rounds each instalment down on its
 * own: twelve monthly instalments do not add up to a year.
 *
 * Undefined when any mode cannot be priced, so a caller never shows a partial row of modes.
 */
export function modePremiumsFrom(
  quoteFor: (mode: PayMode) => QuoteResult | undefined,
): ModePremium[] | undefined {
  const priced = MODES.map((mode) => {
    const result = quoteFor(mode);
    if (!result) return undefined;
    return { mode, total: result.totalModal, belowMinimum: result.warnings.some((w) => w.code === "MIN_MONTHLY") };
  });
  return priced.every((p) => p !== undefined) ? (priced as ModePremium[]) : undefined;
}

/** The three prices for a quote assembled by hand. The input's own `mode` is ignored. */
export function quoteModePremiums(input: QuoteInput, today: Date = new Date()): ModePremium[] | undefined {
  return modePremiumsFrom((mode) => quote({ ...input, mode }, today));
}
