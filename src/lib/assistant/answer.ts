import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { getPlan } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";
import { formatBaht } from "@/calc/money";
import { cardPath } from "@/lib/card-link";
import { lifeProtectQuoteText } from "@/lib/lifeprotect-cta";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { cashAt, deathBenefitOf, lifeProtectModes, termAt } from "@/lib/lifeprotect-quote";
import { lifeProtectTable, type LifeProtectTable } from "@/lib/lifeprotect-table";
import { faqAnswer } from "./faq";
import { PLAN_INFO_SYSTEM, SMALL_TALK_SYSTEM } from "./prompts";
import { affirms, asksAboutCompany, asksAboutTrust, asksCheaper, asksPayTerm, mergeSlots, PLAN_CODE, recentTurns, routeMessage, type Routed } from "./route";

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

/** A person does not send one long block; the model's paragraphs go out as separate bubbles. */
const MAX_BUBBLES = 3;

function spoken(text: string): Omit<Answer, "slots"> {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return one(ASK_FOR_DETAILS);
  if (parts.length <= MAX_BUBBLES) return { messages: parts.map((t) => ({ text: t })) };
  // more than fits: the last bubble carries the rest, so nothing is dropped and none is empty
  const head = parts.slice(0, MAX_BUBBLES - 1);
  const tail = parts.slice(MAX_BUBBLES - 1).join("\n\n");
  return { messages: [...head, tail].map((t) => ({ text: t })) };
}

const ASK_FOR_DETAILS =
  'ขออายุ เพศ กับทุนที่สนใจหน่อยครับ เดี๋ยวคิดเบี้ยให้เลย (เช่น "ชาย 35 ทุน 1 ล้าน")';

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
  if (slots.coverWanted !== undefined) {
    known.push(slots.coverWanted === COVER_MEANS_SUM
      ? `ทุน ${slots.coverWanted.toLocaleString("en-US")} บาท`
      : `ครอบครัวได้รับ ${slots.coverWanted.toLocaleString("en-US")} บาท`);
  }
  if (slots.variant) known.push(table.terms.find((t) => t.variant === slots.variant)?.label ?? "");

  const missing: string[] = [];
  const example: string[] = [];
  if (slots.sex === undefined) { missing.push("เพศ"); example.push("ชาย"); }
  if (slots.age === undefined) { missing.push("อายุ"); example.push("35"); }
  if (slots.coverWanted === undefined) { missing.push("ทุนประกันที่สนใจ"); example.push("ทุน 1 ล้าน"); }
  if (missing.length === 0) return ASK_FOR_DETAILS;

  const ask = `ขอ${missing.join("กับ")}ด้วยครับ เดี๋ยวคิดเบี้ยให้เลย (เช่น "${example.join(" ")}")`;
  return known.filter(Boolean).length ? `ได้เลยครับ ${known.filter(Boolean).join(" · ")} 👍\n${ask}` : ask;
}

const HAND_OVER = "เดี๋ยวตัวแทนมาคุยต่อในแชทนี้ครับ ระหว่างนี้ถามเรื่อง Life Protect x 2 ได้เลย";

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
  if (asksPayTerm(asked)) return { ...answerPayTerm(slots), slots };
  if (asksCheaper(asked)) return answerCheaper(slots);
  // a bare "เอา" takes the cheaper arrangement the bot last put on the table
  if (affirms(asked) && slots.offer) {
    const taken: Routed = { ...slots, intent: "quote", coverWanted: slots.offer.coverWanted, variant: slots.offer.variant };
    return { ...answerQuote(taken), slots: taken };
  }

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

  if (slots.intent === "plan_info") return { ...(await answerPlanInfo(history, slots)), slots };
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
 * The one figure a customer means as a sum assured rather than as what the family receives.
 *
 * The adverts teach it: their artwork reads "ทุน 1 ล้าน → ครอบครัวได้ 2 ล้าน", and the
 * button under it says "สนใจประกันมรดก ทุน 1,000,000". Someone who says that number is
 * repeating the advert back, and quoting them half of it would be quoting them half of what
 * they were shown. Every other figure people name is the inheritance they want to leave.
 */
const COVER_MEANS_SUM = 1_000_000;

/**
 * The sum assured that pays what the customer asked for.
 *
 * A customer who says "ทุน 3 ล้าน" means three million reaching the family, and before sixty
 * this plan pays twice the sum assured — so the contract behind that sentence is written at
 * one and a half. Past the booster age there is no doubling left to divide by, and the two
 * numbers are the same. Rounded to a whole thousand, which is the unit the rate table prices in.
 */
function sumForCover(table: LifeProtectTable, age: number, cover: number): number {
  if (cover === COVER_MEANS_SUM) return cover;
  return Math.round(cover / coverMultiple(table, age) / 1000) * 1000;
}

/** One insured, priced — or a sentence saying why this one has no price. */
function quoteFor(
  table: LifeProtectTable, variant: string, who: { age: number; sex: "M" | "F" }, coverWanted: number,
  offer?: Routed["offer"],
): Said {
  const { age, sex } = who;
  if (age < table.ageMin || age > table.ageMax) {
    return { text: `อายุ ${age} ปี แบบนี้รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ ${HAND_OVER}` };
  }

  // the offer carries its own sum, because its cover may be the one figure read as a sum
  const sumAssured = offer && offer.coverWanted === coverWanted && offer.variant === variant
    ? offer.sumAssured
    : sumForCover(table, age, coverWanted);
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
  const messages = people.map((who) => quoteFor(table, variant, who, coverWanted, slots.offer));

  // the offer of the other terms belongs once, under the last price on the screen
  const last = messages.map((m) => Boolean(m.card)).lastIndexOf(true);
  if (last >= 0) messages[last].text += `\n\n${otherTerms(table, variant)}`;

  return { messages, priced: last >= 0 };
}

/**
 * How long the premium runs, in one line, for whichever term is on the table.
 *
 * Answered from the plan's own terms rather than by re-sending the quotation: someone who
 * asks how many years they pay for has the figures already and wants the one fact that was
 * not among them.
 */
function answerPayTerm(slots: Routed): Omit<Answer, "slots"> {
  const table = lifeProtectTable();
  const quotable = table.terms.filter((t) => QUOTABLE.has(t.variant));
  const term = slots.variant ? quotable.find((t) => t.variant === slots.variant) : undefined;

  if (!term) {
    return one(
      `แบบนี้เลือกระยะเวลาชำระเบี้ยได้ 3 แบบครับ — ${quotable.map((t) => t.label).join(" · ")}\n`
      + `ทุกแบบคุ้มครองถึงอายุ ${table.coverToAge} เหมือนกัน สนใจแบบไหนบอกได้เลยครับ`,
    );
  }

  const rest = quotable.filter((t) => t.variant !== term.variant).map((t) => t.label).join(" หรือ ");
  return one(term.payTerm !== undefined
    ? `แบบที่คิดให้อยู่นี้ ${term.label} ครับ จ่ายครบ ${term.payTerm} ปีแล้วไม่ต้องจ่ายอีก `
      + `แต่ยังคุ้มครองถึงอายุ ${table.coverToAge}\nถ้าอยากดูแบบ${rest} บอกได้เลยครับ`
    : `แบบที่คิดให้อยู่นี้ ${term.label} ครับ คือชำระเบี้ยไปจนถึงอายุ ${table.coverToAge}\n`
      + `ถ้าอยากให้จ่ายจบเร็วกว่านี้ มีแบบ${rest} บอกได้เลยครับ`);
}

/**
 * "แพงไป" — answered with what is actually cheaper.
 *
 * The bot's first instinct was to offer the nine- and nineteen-year terms, which cost more a
 * year, not less. Two things genuinely lower the premium on this plan: paying to ninety-nine,
 * which is the cheapest term by the year, and a smaller cover, which lowers it in
 * proportion. Both are stated with the engine's figures, and the smaller cover is left on the
 * table so a bare "เอา" can take it.
 */
function answerCheaper(slots: Routed): Answer {
  const table = lifeProtectTable();
  const { age, sex, coverWanted } = slots;
  if (age === undefined || sex === undefined || coverWanted === undefined) {
    return { ...one(`บอกอายุ เพศ กับทุนที่สนใจมาก่อนครับ เดี๋ยวคิดให้ดูว่าแบบไหนเบาที่สุด`), slots };
  }
  if (table.expired || age < table.ageMin || age > table.ageMax) return { ...one(HAND_OVER), slots };

  // the same formatting the quotation uses, so one instalment never shows as two figures
  const baht = formatBaht;
  const monthly = (variant: string, sum: number) =>
    lifeProtectModes(table, termAt(table, variant), { sex, age, sumAssured: sum })?.find((m) => m.mode === "monthly");
  const variant = slots.variant ?? DEFAULT_TERM;
  const sumNow = slots.offer && slots.offer.coverWanted === coverWanted ? slots.offer.sumAssured : sumForCover(table, age, coverWanted);
  const lines: string[] = [];

  // the term: to-99 is the cheapest by the year, and worth naming if they are not on it
  if (variant !== DEFAULT_TERM) {
    const m = monthly(DEFAULT_TERM, sumNow);
    if (m) lines.push(`ถ้าเปลี่ยนเป็นแบบจ่ายถึงอายุ 99 ทุนเท่าเดิม เบี้ยจะเหลือประมาณ ${baht(m.total)} บาท/เดือนครับ (แบบนี้เบี้ยต่อปีถูกที่สุด)`);
  } else {
    lines.push("แบบจ่ายถึงอายุ 99 ที่คิดให้อยู่นี้ เป็นแบบที่เบี้ยต่อปีถูกที่สุดแล้วครับ");
  }

  // the cover: halve the sum, and keep the arrangement so "เอา" can take it
  const floor = baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, DEFAULT_TERM).min;
  const half = Math.round(sumNow / 2 / 1000) * 1000;
  let offer = slots.offer;
  if (half >= floor) {
    const m = monthly(DEFAULT_TERM, half);
    const coverHalf = half * coverMultiple(table, age);
    if (m) {
      lines.push(
        `หรือถ้าลดทุนลงครึ่งหนึ่ง เป็นทุน ${half.toLocaleString("en-US")} บาท (ครอบครัวได้รับ ${coverHalf.toLocaleString("en-US")}) `
        + `เบี้ยจะประมาณ ${baht(m.total)} บาท/เดือนครับ`,
      );
      offer = { coverWanted: coverHalf, sumAssured: half, variant: DEFAULT_TERM };
    }
  } else {
    lines.push(`ทุนตอนนี้อยู่ที่ขั้นต่ำของแบบนี้แล้วครับ ลดลงกว่านี้ไม่ได้`);
  }

  lines.push(offer && offer !== slots.offer
    ? 'สนใจแบบลดทุน พิมพ์ว่า "เอา" ได้เลยครับ เดี๋ยวส่งใบเสนอให้ หรือบอกทุนที่อยากได้มาใหม่ก็ได้'
    : "บอกทุนที่อยากได้มาใหม่ได้เลยครับ เดี๋ยวคิดให้");

  return { messages: [{ text: lines.join("\n") }], slots: { ...slots, offer } };
}

/** The terms this quote did not take, offered by name so the customer can ask for one. */
function otherTerms(table: LifeProtectTable, quoted: string): string {
  const rest = table.terms.filter((t) => QUOTABLE.has(t.variant) && t.variant !== quoted).map((t) => t.label);
  return `ถ้าอยากดูแบบ${rest.join(" หรือ ")} บอกได้เลยนะครับ เดี๋ยวคิดให้`;
}

/**
 * What is already known about this customer, written out for the model.
 *
 * Without it the answer ends "แจ้งเพศ อายุ และทุนประกันที่สนใจมาได้เลย ผมจะคำนวณให้ทันที"
 * to someone who gave all three and was sent a premium three messages ago — the same not
 * listening that asking for the amount twice was, one step further along.
 */
function knownSoFar(slots: Routed, table: LifeProtectTable): string {
  const bits: string[] = [];
  if (slots.sex) bits.push(slots.sex === "M" ? "ชาย" : "หญิง");
  if (slots.age !== undefined) bits.push(`อายุ ${slots.age} ปี`);
  if (slots.coverWanted !== undefined) {
    bits.push(slots.coverWanted === COVER_MEANS_SUM
      ? `ทุน ${slots.coverWanted.toLocaleString("en-US")} บาท`
      : `ครอบครัวได้รับ ${slots.coverWanted.toLocaleString("en-US")} บาท`);
  }
  const term = slots.variant ? table.terms.find((t) => t.variant === slots.variant) : undefined;
  if (term) bits.push(term.label);
  if (bits.length === 0) return "";

  const quoted = quotedFigures(slots, table);
  return `\n\nข้อมูลของลูกค้ารายนี้ที่ทราบแล้ว: ${bits.join(" · ")}\n`
    + "ห้ามขอข้อมูลที่ทราบแล้วซ้ำอีก\n"
    + (quoted
      ? `เบี้ยที่คิดและส่งให้ลูกค้าไปแล้วคือ ${quoted}\n`
        + "ถ้าจะพูดถึงตัวเลขเบี้ย ให้ใช้ตัวเลขชุดนี้เท่านั้น คัดลอกมาตรงๆ ห้ามคำนวณเอง ห้ามประมาณ ห้ามปัดเศษ\n"
        + "ถ้าลูกค้าอยากได้เบี้ยของอายุ ทุน หรือแบบชำระอื่น ห้ามตอบเป็นตัวเลข ให้บอกว่าเดี๋ยวคิดให้ แล้วให้เขาบอกมา"
      : "ถ้าลูกค้าอยากได้เบี้ย ให้ขอเฉพาะข้อมูลที่ยังขาด ห้ามตอบตัวเลขเบี้ยเอง");
}

/**
 * The premium this customer has already been sent, as the engine computed it.
 *
 * It is put in front of the model because withholding it did not stop the model reaching for
 * one: asked whether the premium was level, it answered 3,790 a month where the quotation it
 * had sent five messages earlier said 3,861. A figure it can copy is a figure it cannot
 * invent. Undefined when nothing has been priced yet, and the prompt then forbids figures
 * outright.
 */
function quotedFigures(slots: Routed, table: LifeProtectTable): string | undefined {
  const { age, sex, coverWanted } = slots;
  if (age === undefined || sex === undefined || coverWanted === undefined || table.expired) return undefined;
  const variant = slots.variant ?? DEFAULT_TERM;
  if (!QUOTABLE.has(variant)) return undefined;
  if (age < table.ageMin || age > table.ageMax) return undefined;

  const sumAssured = sumForCover(table, age, coverWanted);
  if (sumAssured < baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, variant).min) return undefined;
  const modes = lifeProtectModes(table, termAt(table, variant), { sex, age, sumAssured });
  if (!modes) return undefined;

  const baht = formatBaht;
  const by = (mode: string) => modes.find((m) => m.mode === mode);
  // the last row of the surrender schedule is what the policy pays for staying to the end —
  // asked "ถ้าไม่ตายจนครบสัญญาได้อะไร", the model had called it the sum assured, which it is
  // not for every term
  const cash = cashAt(termAt(table, variant), sex, age, sumAssured, table.ageMin);
  const end = cash[cash.length - 1];
  return [
    by("monthly") ? `รายเดือน ${baht(by("monthly")!.total)} บาท` : "",
    by("semi") ? `ราย 6 เดือน ${baht(by("semi")!.total)} บาท` : "",
    by("annual") ? `รายปี ${baht(by("annual")!.total)} บาท` : "",
    end ? `อยู่ครบสัญญาถึงอายุ ${end.age} รับเงินคืน ${end.amount.toLocaleString("en-US")} บาท` : "",
  ].filter(Boolean).join(" · ");
}

async function answerPlanInfo(history: ChatMessage[], slots: Routed): Promise<Omit<Answer, "slots">> {
  const r = await chat({
    tier: "small",
    task: "plan_info",
    maxTokens: 400,
    messages: [
      {
        role: "system",
        content: `${PLAN_INFO_SYSTEM}\n\nข้อมูลแบบประกัน\n${planInfoText()}${knownSoFar(slots, lifeProtectTable())}`,
      },
      ...recentTurns(history, 6),
    ],
  });
  return spoken(r.text.trim() || ASK_FOR_DETAILS);
}

async function answerSmallTalk(history: ChatMessage[]): Promise<Omit<Answer, "slots">> {
  const r = await chat({
    tier: "small",
    task: "small_talk",
    maxTokens: 200,
    messages: [{ role: "system", content: SMALL_TALK_SYSTEM }, ...recentTurns(history, 6)],
  });
  return spoken(r.text.trim() || ASK_FOR_DETAILS);
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
    `อยู่ครบสัญญาถึงอายุ ${f.coverToAge} ได้รับเงินคืนเท่ากับมูลค่าเงินสดสะสม ณ อายุนั้น (ตัวเลขต่างกันตามทุน อายุ และแบบชำระ อยู่ในใบเสนอราคาของแต่ละคน ไม่ใช่ทุนประกันเสมอไป)`,
    `ตัวอย่าง ${f.example.sex === "M" ? "ชาย" : "หญิง"}อายุ ${f.example.age} ปี ทุน ${f.example.sum} บาท: ${example}`,
    `มูลค่าเวนคืนเมื่ออายุ 60 ปีของตัวอย่างแบบจ่าย 19 ปี ${f.cash60} บาท`,
  ].join("\n");
}
