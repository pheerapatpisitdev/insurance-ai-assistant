"use server";
import { priceRiders } from "@/lib/ihealthy-rider-quote";
import type { RiderQuoteInput, RiderQuoteResult } from "@/lib/ihealthy-rider-quote";

export type {
  AttachedRider, RiderChoice, RiderQuoteInput, RiderQuoteResult, RiderQuoteRow,
} from "@/lib/ihealthy-rider-quote";

/**
 * The agent's half of the page, across the wire.
 *
 * A server action and not more browser arithmetic because of what pricing these riders needs:
 * their own rate tables, and the eligibility rules behind them — age bands, plan caps, the
 * sums a package pins — none of which a customer's browser has any business downloading. The
 * quoting itself is next door, where the card route can reach it without going through an
 * action.
 */
export async function priceWithRiders(input: RiderQuoteInput): Promise<RiderQuoteResult> {
  return priceRiders(input);
}
