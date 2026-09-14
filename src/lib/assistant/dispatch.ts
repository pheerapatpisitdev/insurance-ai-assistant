import type { ChatMessage } from "@/lib/ai/types";
import { askWhich, productByTopic, productNamedIn, type Product } from "./choose";
import { peopleIn, type AnswerContext, type Reply } from "./common";
import { answerHealth } from "./ihealthy/answer";
import type { HealthSlots } from "./ihealthy/route";
import { answerQuestion } from "./lifeprotect/answer";
import type { Routed } from "./lifeprotect/route";
import type { AnySlots, Undecided } from "./slots";

/** One answer, and everything the bot should remember about this customer next turn. */
export type AnyAnswer = Reply & { slots: AnySlots };

/** What of a person is worth carrying from one contract to the other: not much, and not more. */
interface Person {
  age?: number;
  sex?: "M" | "F";
}

/**
 * Which plan a stored session was about.
 *
 * A row with no `product` was written before there was more than one plan to be about, so it
 * can only have been the life one. Guessing anything else would take a customer mid-quotation
 * and start them over.
 */
function settled(slots: AnySlots | null): Product | "undecided" | undefined {
  if (!slots) return undefined;
  if ("product" in slots && slots.product) return slots.product;
  return "lifeprotect";
}

/** The age and the sex, whichever kind of slots they are in. */
function personIn(slots: AnySlots | null): Person {
  if (!slots) return {};
  const { age, sex } = slots as Routed | HealthSlots | Undecided;
  return { ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}

/**
 * The one door the webhook knocks on.
 *
 * Which plan the message is about is decided before any model is paid, and from the strongest
 * evidence available: a plan named outright can turn a conversation around; a subject can only
 * settle one that has not begun; and where neither says anything, the customer is asked with
 * two buttons rather than guessed at.
 */
export async function answerAny(
  history: ChatMessage[], stored: AnySlots | null, ctx: AnswerContext = {},
): Promise<AnyAnswer> {
  const asked = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const now = settled(stored);
  const named = productNamedIn(asked);

  if (now === "lifeprotect" || now === "ihealthy") {
    // the customer has named the other plan: only the person travels, because the sum, the
    // plan, the territory and any offer on the table all belong to the contract being left
    if (named && named !== now) return run(named, history, personIn(stored), true, ctx);
    return run(now, history, stored, false, ctx);
  }

  // nothing settled yet: the name first, then the subject
  const product = named ?? productByTopic(asked);
  if (product) return run(product, history, personIn(stored), true, ctx);

  // the customer has not said, so the customer is asked — and what they did say is kept
  const person = peopleIn(asked)[0];
  const undecided: Undecided = {
    product: "undecided",
    ...(person ? { age: person.age, sex: person.sex } : personIn(stored)),
  };
  return { ...askWhich(), slots: undecided, trace: [{ kind: "asked_which" }] };
}

/**
 * Hand the turn to one brain.
 *
 * `fresh` says the slots being passed are a person and not a conversation — a switch of plan,
 * or a first turn — so the brain starts over with an age and a sex rather than inheriting
 * fields that were about something else.
 */
async function run(
  product: Product, history: ChatMessage[], carried: AnySlots | Person | null, fresh: boolean, ctx: AnswerContext,
): Promise<AnyAnswer> {
  if (product === "ihealthy") {
    const previous = fresh
      ? startHealth(carried as Person)
      : (carried as HealthSlots);
    const answer = await answerHealth(history, previous, ctx);
    return { ...answer, slots: answer.slots };
  }
  const previous = fresh ? startLife(carried as Person) : (carried as Routed);
  const answer = await answerQuestion(history, previous, ctx);
  return { ...answer, slots: { ...answer.slots, product: "lifeprotect" } };
}

/** A health conversation begun from whatever the last one knew about the person. */
function startHealth(person: Person): HealthSlots | null {
  if (person.age === undefined && person.sex === undefined) return null;
  return { product: "ihealthy", intent: "quote", ...person };
}

/** The same, the other way round. */
function startLife(person: Person): Routed | null {
  if (person.age === undefined && person.sex === undefined) return null;
  return { intent: "quote", product: "lifeprotect", ...person };
}
