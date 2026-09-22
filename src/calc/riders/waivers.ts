import benefits from "../../../data/riders/waiver-benefits.json";

export interface WaiverBenefit {
  /** what the contract does, in one sentence */
  what: string;
  /** option code → what that flavour is written against */
  covers: Record<string, string>;
}

/**
 * What a premium-waiving rider does, in the words a customer reads.
 *
 * Unlike the illness lists next door, this is not lifted off a benefit sheet: the company's
 * workbook carries these contracts as names, plancodes and rates only. The wording here was
 * drafted from the plancodes — DD is death and disability, TPD is disability alone, the CI
 * suffix adds critical illness — and belongs to the agency rather than to the engine, which
 * is why it sits in its own file where it can be corrected without touching a rate.
 *
 * A rider with no entry shows no description at all, rather than a guess at one.
 */
const BY_CODE = benefits as Record<string, WaiverBenefit>;

export function waiverBenefit(code: string): WaiverBenefit | undefined {
  return BY_CODE[code];
}
