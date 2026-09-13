import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { getPlan } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";
import { cardPath } from "@/lib/card-link";
import { lifeProtectQuoteText } from "@/lib/lifeprotect-cta";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { cashAt, deathBenefitOf, lifeProtectModes, termAt } from "@/lib/lifeprotect-quote";
import { lifeProtectTable, type LifeProtectTable } from "@/lib/lifeprotect-table";
import { faqAnswer } from "./faq";
import { PLAN_INFO_SYSTEM, SMALL_TALK_SYSTEM } from "./prompts";
import { asksAboutCompany, asksAboutTrust, mergeSlots, PLAN_CODE, recentTurns, routeMessage, type Routed } from "./route";

/** The package quoted when the customer has not named one: the cheapest instalment of the three. */
const DEFAULT_TERM = "WLF99H";

/**
 * The packages this chat may price. The plan's table also holds the x1.5 product and two
 * health packages; they are real arrangements, sold by hand, and a bot that quoted one of
 * them because its name was close would be quoting something nobody advertised.
 */
const QUOTABLE = new Set(["WLF09H", "WLF19H", "WLF99H"]);

/** One message the bot sends, and the picture that follows it. */
export interface Said {
  text: string;
  /** where the quote is drawn as a picture, as a path on this site */
  card?: string;
}

export interface Answer {
  /**
   * What the bot sends, in the order it sends it.
   *
   * A list rather than one string because a customer pricing a couple — "ผญ 32 ผช33ค่ะ" —
   * is owed a quote each, and two quotes in one bubble is a wall of figures nobody can read
   * back to their partner.
   */
  messages: Said[];
  /** carried into the next turn so a follow-up keeps the age, sex and amount */
  slots: Routed;
  /** the answer carries a premium — the moment a browser turns into someone worth calling */
  priced?: boolean;
}

/** The usual case: the bot says one thing. */
function one(text: string, card?: string): Omit<Answer, "slots"> {
  return { messages: [card ? { text, card } : { text }] };
}

const ASK_FOR_DETAILS =
  'รบกวนบอก อายุ / เพศ / ทุนประกันที่สนใจ ครับ แล้วผมคิดเบี้ยให้เลย (เช่น "ชาย 35 ทุน 1 ล้าน")';

/**
 * What is still needed, named one field at a time.
 *
 * The adverts open the conversation with a button that already says the sum — "สนใจประกันมรดก
 * ทุน 1,000,000" — and a bot that answers it by asking for the sum again reads as one that did
 * not listen, on the first message the campaign paid for. So what is known is repeated back and
 * only the gaps are asked for.
 */
function askForMissing(slots: Routed, table: LifeProtectTable): string {
  const known: string[] = [];
  if (slots.coverWanted !== undefined) known.push(`ครอบครัวได้รับ ${slots.coverWanted.toLocaleString("en-US")} บาท`);
  if (slots.variant) known.push(table.terms.find((t) => t.variant === slots.variant)?.label ?? "");

  const missing: string[] = [];
  const example: string[] = [];
  if (slots.sex === undefined) { missing.push("เพศ"); example.push("ชาย"); }
  if (slots.age === undefined) { missing.push("อายุ"); example.push("35"); }
  if (slots.coverWanted === undefined) { missing.push("ทุนประกันที่สนใจ"); example.push("ทุน 1 ล้าน"); }
  if (missing.length === 0) return ASK_FOR_DETAILS;

  const ask = `รบกวนบอก${missing.join("กับ")}ด้วยครับ แล้วผมคิดเบี้ยให้เลย (เช่น "${example.join(" ")}")`;
  return known.filter(Boolean).length ? `รับทราบครับ ${known.filter(Boolean).join(" · ")} 🙏\n${ask}` : ask;
}

const HAND_OVER = "เดี๋ยวตัวแทนมาตอบในแชทนี้ครับ ระหว่างนี้สอบถามเรื่อง Life Protect x 2 ได้เลย";

/**
 * Who stands behind the policy, in the agency's own words rather than a model's.
 *
 * The insurer is a constant because the project holds no other record of it, and because a
 * model asked the question agreed with whichever name the customer proposed. Anything about
 * the people — a licence, whether they can be trusted — is not a fact this code has, so it
 * is handed to someone who does.
 */
const INSURER = "บมจ. กรุงไทย-แอกซ่า ประกันชีวิต";

/**
 * The agents behind the page, as their own licences record them.
 *
 * Only the two fields a customer is entitled to check: the name and the licence number the
 * regulator issued, which an agent is required to show anyway. The national id printed beside
 * them on the same card is deliberately not here — the bot tells customers it never handles
 * one, and it should hold none of its own either.
 */
const AGENTS = [
  { name: "พีรพัฒฑ์พิสิษฐ์ ทองสีทอง", licence: "6001028534" },
  { name: "ศิวลักษณ์ ทองสีทอง", licence: "6401024117" },
];

const ABOUT_INSURER = `แบบประกันนี้รับประกันโดย ${INSURER} ครับ 🙏`;

const ABOUT_AGENTS = [
  "ดูแลโดยตัวแทนที่ได้รับใบอนุญาตจาก คปภ.",
  ...AGENTS.map((a) => `• ${a.name} — ใบอนุญาตเลขที่ ${a.licence}`),
].join("\n");

const ABOUT_TRUST = "ถ้าอยากคุยรายละเอียดกับตัวแทนโดยตรง เดี๋ยวมีคนมาตอบในแชทนี้ครับ";

/**
 * The answer to a question about who stands behind the policy: the insurer, then the people
 * selling it. Built from constants and never from a model — asked the same question, a model
 * agreed with whichever company name the customer had guessed.
 *
 * It ends there. It used to close by asking for an age and a sex, which reads as not
 * listening to a customer who has already given both — and the question was answered, so
 * there is nothing to add to it.
 */
export function aboutCompany(question: string): string {
  const tail = asksAboutTrust(question) ? ["", ABOUT_TRUST] : [];
  return [ABOUT_INSURER, "", ABOUT_AGENTS, ...tail].join("\n");
}

export async function answerQuestion(history: ChatMessage[], previous: Routed | null): Promise<Answer> {
  const slots = mergeSlots(previous, await routeMessage(history));
  // checked before the routes that speak: a question about the company is answered by the
  // agency's own sentence whatever else the turn was about
  const asked = lastAsked(history);
  if (asksAboutCompany(asked)) return { ...one(aboutCompany(asked)), slots };

  // one of the answers the agency writes out by hand every day. A message can both ask for a
  // price and ask one of these — "ญ 37 ลดหย่อนภาษีได้ไหม" — so it is added to the quote
  // rather than replacing it.
  const faq = faqAnswer(asked);
  if (slots.intent === "quote") {
    const quoted = answerQuote(slots);
    if (faq) quoted.messages.push({ text: faq });
    return { ...quoted, slots };
  }
  if (faq) return { ...one(faq), slots };

  if (slots.intent === "plan_info") return { ...(await answerPlanInfo(history)), slots };
  return { ...(await answerSmallTalk(history)), slots };
}

/** What the customer said this turn. */
function lastAsked(history: ChatMessage[]): string {
  return [...history].reverse().find((m) => m.role === "user")?.content ?? "";
}

/**
 * The multiple this plan pays on death at that age: twice the sum assured before the booster
 * age, once after it.
 */
function coverMultiple(table: LifeProtectTable, age: number): number {
  return age < table.boosterBeforeAge ? 1 + table.booster : 1;
}

/**
 * The sum assured that pays what the customer asked for.
 *
 * A customer who says "ทุน 3 ล้าน" means three million reaching the family, and before sixty
 * this plan pays twice the sum assured — so the contract behind that sentence is written at
 * one and a half. Past the booster age there is no doubling left to divide by, and the two
 * numbers are the same. Rounded to a whole thousand, which is the unit the rate table prices in.
 */
function sumForCover(table: LifeProtectTable, age: number, cover: number): number {
  return Math.round(cover / coverMultiple(table, age) / 1000) * 1000;
}

/** One insured, priced — or a sentence saying why this one has no price. */
function quoteFor(
  table: LifeProtectTable, variant: string, who: { age: number; sex: "M" | "F" }, coverWanted: number,
): Said {
  const { age, sex } = who;
  if (age < table.ageMin || age > table.ageMax) {
    return { text: `อายุ ${age} ปี แบบนี้รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ ${HAND_OVER}` };
  }

  const sumAssured = sumForCover(table, age, coverWanted);
  // the floor is a rule of the plan, not a field of the page's slim table — and it is stated
  // back in the customer's own terms, which are what the family receives
  const floor = baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, variant).min;
  if (sumAssured < floor) {
    const smallest = floor * coverMultiple(table, age);
    return { text: `แบบนี้เริ่มต้นที่ครอบครัวได้รับ ${smallest.toLocaleString("en-US")} บาทครับ บอกจำนวนที่สนใจมาใหม่ได้เลย` };
  }

  const term = termAt(table, variant);
  const modes = lifeProtectModes(table, term, { sex, age, sumAssured });
  if (!modes) return { text: `อายุ ${age} ปี แบบนี้รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ ${HAND_OVER}` };

  return {
    text: lifeProtectQuoteText({
      sumAssured,
      termLabel: term.label,
      age,
      sex,
      modes,
      death: deathBenefitOf(table, age, sumAssured),
      cash: cashAt(term, sex, age, sumAssured, table.ageMin),
    }),
    card: cardPath({ kind: "plan", planCode: PLAN_CODE, variant, age, sex, sumAssured }),
  };
}

/**
 * The quote, or a sentence saying why there is none — one message per insured.
 *
 * A couple asking together gets a quote each, in the order they named themselves, because
 * each of them is buying their own contract at their own age.
 */
function answerQuote(slots: Routed): Omit<Answer, "slots"> {
  if (slots.variant && !QUOTABLE.has(slots.variant)) {
    return one(`ในแชทนี้ผมคิดให้ได้เฉพาะแบบ Life Protect x 2 ครับ แบบอื่นขอให้ตัวแทนเสนอให้นะครับ ${HAND_OVER}`);
  }

  const table = lifeProtectTable();
  const { age, sex, coverWanted } = slots;
  const people = slots.people ?? (age !== undefined && sex !== undefined ? [{ age, sex }] : []);
  if (people.length === 0 || coverWanted === undefined) return one(askForMissing(slots, table));

  if (table.expired) {
    return one(`ตารางเบี้ยชุดนี้หมดอายุแล้วครับ ขอราคาปัจจุบันจากตัวแทนได้เลย ${HAND_OVER}`);
  }

  const variant = slots.variant ?? DEFAULT_TERM;
  const messages = people.map((who) => quoteFor(table, variant, who, coverWanted));

  // the offer of the other terms belongs once, under the last price on the screen
  const last = messages.map((m) => Boolean(m.card)).lastIndexOf(true);
  if (last >= 0) messages[last].text += `\n\n${otherTerms(table, variant)}`;

  return { messages, priced: last >= 0 };
}

/** The terms this quote did not take, offered by name so the customer can ask for one. */
function otherTerms(table: LifeProtectTable, quoted: string): string {
  const rest = table.terms.filter((t) => QUOTABLE.has(t.variant) && t.variant !== quoted).map((t) => t.label);
  return `สนใจแบบ${rest.join(" หรือ ")} ไหมครับ บอกมาได้เลย เดี๋ยวคิดให้ใหม่`;
}

async function answerPlanInfo(history: ChatMessage[]): Promise<Omit<Answer, "slots">> {
  const r = await chat({
    tier: "small",
    task: "plan_info",
    maxTokens: 400,
    messages: [
      { role: "system", content: `${PLAN_INFO_SYSTEM}\n\nข้อมูลแบบประกัน\n${planInfoText()}` },
      ...recentTurns(history, 6),
    ],
  });
  return one(r.text.trim() || ASK_FOR_DETAILS);
}

async function answerSmallTalk(history: ChatMessage[]): Promise<Omit<Answer, "slots">> {
  const r = await chat({
    tier: "small",
    task: "small_talk",
    maxTokens: 200,
    messages: [{ role: "system", content: SMALL_TALK_SYSTEM }, ...recentTurns(history, 6)],
  });
  return one(r.text.trim() || ASK_FOR_DETAILS);
}

/**
 * What the plan is, in the engine's own figures. Built from the facts the sales page renders,
 * so a change to the rate tables reaches the chat without anyone retyping a number — and so
 * the model has no reason to reach for one of its own.
 */
function planInfoText(): string {
  const f = lifeProtectFacts();
  const table = lifeProtectTable();
  const floor = baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, DEFAULT_TERM).min;
  const example = f.example.terms
    .map((t) => `${t.label} ${t.premium ? `${t.premium}${t.per ?? ""}` : "ขอราคาปัจจุบัน"}`)
    .join(", ");
  return [
    "ชื่อแบบ: Life Protect+ 100 (Life Protect x 2)",
    `รับประกันอายุ ${f.ageMin}-${f.ageMax} ปี คุ้มครองถึงอายุ ${f.coverToAge} ปี`,
    `ทุนประกันขั้นต่ำ ${floor.toLocaleString("en-US")} บาท`,
    `เสียชีวิตก่อนอายุ ${f.boosterBeforeAge} ปี ครอบครัวได้รับ 2 เท่าของทุน ตั้งแต่อายุ ${f.boosterBeforeAge} ปีขึ้นไปได้รับ 1 เท่าของทุน`,
    `แบบการชำระเบี้ยมีให้เลือก ${table.terms.filter((t) => QUOTABLE.has(t.variant)).map((t) => t.label).join(" / ")}`,
    "เบี้ยคงที่ตลอดระยะเวลาชำระ และมีมูลค่าเวนคืนสะสม",
    `ตัวอย่าง ${f.example.sex === "M" ? "ชาย" : "หญิง"}อายุ ${f.example.age} ปี ทุน ${f.example.sum} บาท: ${example}`,
    `มูลค่าเวนคืนเมื่ออายุ 60 ปีของตัวอย่างแบบจ่าย 19 ปี ${f.cash60} บาท`,
  ].join("\n");
}
