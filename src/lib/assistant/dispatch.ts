import type { ChatMessage } from "@/lib/ai/types";
import { askWhich, askWhichAgain, productByTopic, productNamedIn, type Product } from "./choose";
import {
  aboutCompany, ageIn, asksAboutCompany, handOverForm, peopleIn, tookUpTheOffer, wantsToBuy,
  type Reply,
} from "./common";
import { answerHealth } from "./ihealthy/answer";
import { answerLegacy, type LegacySlots } from "./legacy/answer";
import { answerIShield, type IShieldSlots } from "./ishield/answer";
import type { HealthSlots } from "./ihealthy/route";
import { answerQuestion } from "./lifeprotect/answer";
import type { Routed } from "./lifeprotect/route";
import type { AnySlots, Undecided } from "./slots";
import { planNamedIn, priceNamedPlan } from "@/lib/copilot/price";
import type { GuideItem } from "@/lib/copilot/guide";
import { writtenFor, type Channel } from "./channel";
import { answerFromLibrary } from "@/lib/copilot/library";

/** The last line of the menu, which is how a turn knows the menu was the last thing said. */
const ASKED_WHICH = "สนใจแบบไหนครับ";

/** One answer, and everything the bot should remember about this customer next turn. */
export type AnyAnswer = Reply & {
  slots: AnySlots;
  /**
   * Set when the words came out of the library rather than a brain.
   *
   * It saves the website asking the same question twice: it used to answer anything the
   * dispatcher could not place by calling the library itself, which is now where the
   * dispatcher sends it too — so without this the question would be paid for twice and
   * answered once.
   */
  fromLibrary?: true;
  /**
   * What to offer next, for the plans priced here rather than by a brain.
   *
   * The page draws them as buttons and the inbox has no use for them, but they belong to the
   * answer rather than to the page: it is this code that knows a PLB quotation has three
   * other paying terms worth comparing, and the page that used to know it no longer prices
   * anything itself.
   */
  guide?: GuideItem[];
};

/** A message that asks something, as against one that announces an interest. */
const ASKS_SOMETHING = /ไหม|มั้ย|หรือเปล่า|รึเปล่า|อะไร|เท่าไหร่|เท่าไร|กี่|ยังไง|อย่างไร|ทำไม|ที่ไหน|\?/;

/** Words that make a question about a plan a question about its price. */
const asksAboutMoney = (text: string) => /เบี้ย|ราคา|กี่บาท|ค่างวด|จ่ายเดือนละ|จ่ายปีละ|จ่ายเท่าไหร่|คิดให้|premium/i.test(text);

/** What of a person is worth carrying from one contract to the other: not much, and not more. */
interface Person {
  age?: number;
  sex?: "M" | "F";
  /**
   * Everyone the message named, when it named more than one.
   *
   * Carried because it was not: a family of three wrote "ช 23 / ญ 25 / ช 53" before saying
   * which plan, and only the first of them survived the question — the other two were asked
   * for again, given again, and never priced.
   */
  people?: { age: number; sex: "M" | "F" }[];
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
  const { people } = slots as Routed | Undecided;
  return {
    ...(age !== undefined ? { age } : {}),
    ...(sex ? { sex } : {}),
    ...(people?.length ? { people } : {}),
  };
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
  history: ChatMessage[], stored: AnySlots | null, channel: Channel = "web",
  /**
   * What the advertisement that sent this customer was selling, where one did.
   *
   * The weakest of the three signals on purpose, and last of them: what the customer says now
   * outranks what they clicked, and a subject they raise outranks it too. Someone who came
   * through a Life Protect advertisement and opens with "ค่าห้องเท่าไหร่" is asking about
   * health cover, whatever they pressed to get here.
   */
  cameFor?: Product,
): Promise<AnyAnswer> {
  const asked = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const now = settled(stored);
  const named = productNamedIn(asked);

  if (now === "lifeprotect" || now === "ihealthy" || now === "legacy" || now === "ishield") {
    // the customer has named the other plan: only the person travels, because the sum, the
    // plan, the territory and any offer on the table all belong to the contract being left
    if (named && named !== now) return run(named, history, personIn(stored), true, channel);
    return run(now, history, stored, false, channel);
  }

  /**
   * A plan with no brain, named outright and asked about money.
   *
   * It lives here rather than in the page that first needed it, because the answer must not
   * depend on which door the customer came through: the same question about a PLB premium
   * gets the same figure from the website and from the page's inbox, drawn on the same card.
   * Checked before the topic, since "PLB ทุน 1 ล้าน" reads as a life-insurance subject and
   * would otherwise be quoted as the plan that owns that subject.
   */
  const other = planNamedIn(asked);
  if (other && asksAboutMoney(asked)) {
    const priced = priceNamedPlan(asked, other.code, other.label);
    return {
      messages: [
        // the same words, written for wherever they are about to be read
        { text: writtenFor(channel, priced.text), ...(priced.cards?.[0] ? { card: priced.cards[0] } : {}) },
        ...(priced.cards?.slice(1) ?? []).map((card) => ({ text: "", card })),
      ],
      priced: priced.priced,
      ...(priced.guide?.length ? { guide: priced.guide } : {}),
      // a plan without a brain carries no conversation, so nothing is held between turns
      slots: { product: "undecided", ...personIn(stored) },
    };
  }

  // nothing settled yet: the name first, then the subject, then the advertisement they came through
  const product = named ?? productByTopic(asked) ?? cameFor;
  if (product) return run(product, history, personIn(stored), true, channel);

  // the customer has not said, so the customer is asked — and what they did say is kept,
  // all of it: everyone they named, not only whoever they named first
  const here = peopleIn(asked);
  const carriedPerson = personIn(stored);
  // an age with no sex beside it is still an age: it decides which doors can be opened at all
  const alone = here.length ? undefined : ageIn(asked);
  const undecided: Undecided = {
    product: "undecided",
    ...(here.length
      ? { age: here[0].age, sex: here[0].sex, ...(here.length > 1 ? { people: here } : {}) }
      : { ...carriedPerson, ...(alone !== undefined ? { age: alone } : {}) }),
  };
  /**
   * A question the dispatcher cannot place, but the library can answer.
   *
   * "HIC ซื้อคู่กับ MEB ได้ไหม" names no plan and is about no one plan's subject, so this used
   * to be met with "สวัสดีครับ สนใจแบบไหนครับ" — a question answered with a question, in an
   * inbox paid for by advertising. The rules of all five plans are in the library, so it is
   * asked before the customer is.
   *
   * Only for something actually asked. "สนใจประกันชีวิต" is a lead, not a question, and the
   * two buttons are the right answer to it — which is why they are still attached below.
   */
  /**
   * Someone asking to apply, who was never placed on a plan.
   *
   * Both halves of this were the four buttons until now. "สนใจสมัคร" is the words the bot
   * itself hands out and the title of the button under every follow-up, and typed by a
   * customer with no plan on their session it was read as nothing at all; "สนใจ", from a
   * customer the bot had just invited to apply, was read as no better. Neither is a question
   * about which plan they came for, and both are the message this whole campaign is for.
   *
   * The form does not need a plan — it asks for what the agency needs and a person reads it —
   * and it says the premium is a message away, which is the invitation the menu was trying
   * to make.
   */
  const lastSaid = [...history].reverse().find((m) => m.role === "assistant")?.content;
  if (wantsToBuy(asked, false) || tookUpTheOffer(asked, lastSaid)) {
    const form = handOverForm(false);
    return {
      ...form,
      messages: form.messages.map((m) => ({ ...m, text: writtenFor(channel, m.text) })),
      slots: { ...undecided, formSent: true },
    };
  }

  // a question they asked on the way in is answered before the question they are asked back
  const lead = asksAboutCompany(asked) ? aboutCompany(asked) : undefined;

  /**
   * Checked after the company's own answer, which is free and is the better one: "ของอะไร"
   * asks which insurer, and the library would spend a model call arriving somewhere worse.
   */
  if (!lead && ASKS_SOMETHING.test(asked)) {
    const answer = await answerFromLibrary(history, asked, channel);
    if (answer) {
      return {
        messages: [{ text: answer }], replies: askWhich(undefined, undecided.age).replies,
        slots: undecided, fromLibrary: true,
      };
    }
  }

  /**
   * The same menu twice is a dead end.
   *
   * A man of sixty-eight gave his age, was shown four arrangements, wrote "ขอดูทั้ง2แบบ", and
   * was shown the same four again — two of which no company would have issued him. The age
   * narrows the list below; a second pass at the same list does not need narrowing, it needs
   * a person, and the agency is watching this inbox.
   */
  if (!lead && lastSaid?.includes(ASKED_WHICH)) {
    return { ...askWhichAgain(undecided.age), slots: undecided };
  }

  return { ...askWhich(lead, undecided.age), slots: undecided };
}

/**
 * Hand the turn to one brain.
 *
 * `fresh` says the slots being passed are a person and not a conversation — a switch of plan,
 * or a first turn — so the brain starts over with an age and a sex rather than inheriting
 * fields that were about something else.
 */
async function run(
  product: Product, history: ChatMessage[], carried: AnySlots | Person | null, fresh: boolean,
  channel: Channel = "web",
): Promise<AnyAnswer> {
  if (product === "legacy" || product === "ishield") {
    /**
     * The one brain that is given the message rather than the conversation.
     *
     * It reads two things — a person and a sum — and both are said in the turn being answered.
     * Handing it the history would be handing it turns it has no use for, and a shape it would
     * then have to be kept in step with.
     */
    const asked = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
    if (product === "ishield") {
      const previous = fresh ? startIShield(carried as Person) : (carried as IShieldSlots);
      return answerIShield(asked, previous, channel);
    }
    const previous = fresh ? startLegacy(carried as Person) : (carried as LegacySlots);
    return answerLegacy(asked, previous, channel);
  }
  if (product === "ihealthy") {
    const previous = fresh
      ? startHealth(carried as Person)
      : (carried as HealthSlots);
    const answer = await answerHealth(history, previous);
    return { ...answer, slots: answer.slots };
  }
  const previous = fresh ? startLife(carried as Person) : (carried as Routed);
  const answer = await answerQuestion(history, previous);
  return { ...answer, slots: { ...answer.slots, product: "lifeprotect" } };
}

/**
 * A legacy conversation begun from whatever the last one knew about the person.
 *
 * The tier is left behind with everything else, because a sum chosen on another contract is
 * not a sum chosen on this one: "ทุน 1 ล้าน" on the life plan is what the family receives,
 * and a million of this arrangement is a different arrangement entirely.
 */
function startLegacy({ age, sex }: Person): LegacySlots | null {
  if (age === undefined && sex === undefined) return null;
  return { product: "legacy", ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}

/**
 * The same for iShield, and the sum is left behind for the same reason as the tier.
 *
 * A million of this contract is not a million of either other one — it is a paying term, a
 * maturity and a list of illnesses besides — so a sum decided elsewhere decides nothing here.
 */
function startIShield({ age, sex }: Person): IShieldSlots | null {
  if (age === undefined && sex === undefined) return null;
  return { product: "ishield", ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}

/** A health conversation begun from whatever the last one knew about the person. */
function startHealth({ age, sex }: Person): HealthSlots | null {
  // the group is left behind on purpose: the health contract is priced one person at a time
  if (age === undefined && sex === undefined) return null;
  return { product: "ihealthy", intent: "quote", ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}

/** The same, the other way round. */
function startLife(person: Person): Routed | null {
  if (person.age === undefined && person.sex === undefined) return null;
  return { intent: "quote", product: "lifeprotect", ...person };
}
