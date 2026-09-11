import type { PayMode, Sex } from "@/calc/types";

/**
 * What a card is asked for, and the link that asks for it.
 *
 * This sits apart from quote-card.ts on purpose. Three customer-facing calculators build
 * card links in the browser, and quote-card.ts reaches the engine, the plan registry and
 * every surrender table behind it — around a megabyte of rate data that a page which only
 * needs to write a query string has no business shipping.
 */
/**
 * What a card can be asked for. It is the quote's own input minus everything a customer
 * never picks in a chat: riders, a payer, the premium basis.
 */
export interface PlanCardInput {
  kind: "plan";
  planCode: string;
  variant: string;
  age: number;
  sex: Sex;
  sumAssured: number;
  /**
   * The instalment the customer asked about. It does not steer the drawing: the card
   * headlines the largest instalment this insured can actually pay — monthly when it clears
   * the company's minimum, otherwise yearly — and lists the rest regardless. Recorded in the
   * link anyway, because what was asked for is worth keeping even though it changes nothing.
   */
  mode?: PayMode;
}

/**
 * A card for an arrangement the agency sells under its own name. It is named by bundle and
 * tier rather than by sums assured, because the sums are the bundle's business — a link
 * that could set them would be a link that could invent an arrangement the agency does not
 * sell.
 */
export interface BundleCardInput {
  kind: "bundle";
  bundleCode: string;
  tier: number;
  age: number;
  sex: Sex;
  /**
   * The instalment the customer asked about. It does not steer the drawing: the card
   * headlines the largest instalment this insured can actually pay — monthly when it clears
   * the company's minimum, otherwise yearly — and lists the rest regardless. Recorded in the
   * link anyway, because what was asked for is worth keeping even though it changes nothing.
   */
  mode?: PayMode;
}

/** What a card can be asked for: an arrangement priced from the customer's own sum, or one the agency sells under its own name and tier. */
export type CardInput = PlanCardInput | BundleCardInput;

/** The path a card is drawn at, with the arrangement it draws written into it. */
export function cardPath(input: CardInput): string {
  const q = input.kind === "bundle"
    ? new URLSearchParams({
      bundle: input.bundleCode,
      tier: String(input.tier),
      age: String(input.age),
      sex: input.sex,
    })
    : new URLSearchParams({
      plan: input.planCode,
      variant: input.variant,
      age: String(input.age),
      sex: input.sex,
      sum: String(input.sumAssured),
    });
  if (input.mode) q.set("mode", input.mode);
  return `/api/card?${q.toString()}`;
}

/** The same path against a host, for the channels that can only send an absolute URL. */
export function cardUrl(origin: string, input: CardInput): string {
  return new URL(cardPath(input), origin).toString();
}
