import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { getPlan } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";
import { cardPath } from "@/lib/card-link";
import { lifeProtectQuoteText } from "@/lib/lifeprotect-cta";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { cashAt, deathBenefitOf, lifeProtectModes, termAt } from "@/lib/lifeprotect-quote";
import { lifeProtectTable, type LifeProtectTable } from "@/lib/lifeprotect-table";
import { PLAN_INFO_SYSTEM, SMALL_TALK_SYSTEM } from "./prompts";
import { mergeSlots, PLAN_CODE, recentTurns, routeMessage, type Routed } from "./route";

/** The package quoted when the customer has not named one: the cheapest instalment of the three. */
const DEFAULT_TERM = "WLF99H";

/**
 * The packages this chat may price. The plan's table also holds the x1.5 product and two
 * health packages; they are real arrangements, sold by hand, and a bot that quoted one of
 * them because its name was close would be quoting something nobody advertised.
 */
const QUOTABLE = new Set(["WLF09H", "WLF19H", "WLF99H"]);

export interface Answer {
  reply: string;
  /** carried into the next turn so a follow-up keeps the age, sex and sum */
  slots: Routed;
  /** the answer carries a premium — the moment a browser turns into someone worth calling */
  priced?: boolean;
  /** where the quote is drawn as a picture, as a path on this site */
  card?: string;
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
  if (slots.sumAssured !== undefined) known.push(`ทุน ${slots.sumAssured.toLocaleString("en-US")} บาท`);
  if (slots.variant) known.push(table.terms.find((t) => t.variant === slots.variant)?.label ?? "");

  const missing: string[] = [];
  const example: string[] = [];
  if (slots.sex === undefined) { missing.push("เพศ"); example.push("ชาย"); }
  if (slots.age === undefined) { missing.push("อายุ"); example.push("35"); }
  if (slots.sumAssured === undefined) { missing.push("ทุนประกันที่สนใจ"); example.push("ทุน 1 ล้าน"); }
  if (missing.length === 0) return ASK_FOR_DETAILS;

  const ask = `รบกวนบอก${missing.join("กับ")}ด้วยครับ แล้วผมคิดเบี้ยให้เลย (เช่น "${example.join(" ")}")`;
  return known.filter(Boolean).length ? `รับทราบครับ ${known.filter(Boolean).join(" · ")} 🙏\n${ask}` : ask;
}

const HAND_OVER = "เดี๋ยวตัวแทนมาตอบในแชทนี้ครับ ระหว่างนี้สอบถามเรื่อง Life Protect x 2 ได้เลย";

export async function answerQuestion(history: ChatMessage[], previous: Routed | null): Promise<Answer> {
  const slots = mergeSlots(previous, await routeMessage(history));
  if (slots.intent === "quote") return { ...answerQuote(slots), slots };
  if (slots.intent === "plan_info") return { ...(await answerPlanInfo(history)), slots };
  return { ...(await answerSmallTalk(history)), slots };
}

/** The quote as the sales page would state it, or a sentence saying why there is none. */
function answerQuote(slots: Routed): Omit<Answer, "slots"> {
  if (slots.variant && !QUOTABLE.has(slots.variant)) {
    return { reply: `ในแชทนี้ผมคิดให้ได้เฉพาะแบบ Life Protect x 2 ครับ แบบอื่นขอให้ตัวแทนเสนอให้นะครับ ${HAND_OVER}` };
  }

  const table = lifeProtectTable();
  const { age, sex, sumAssured } = slots;
  if (age === undefined || sex === undefined || sumAssured === undefined) {
    return { reply: askForMissing(slots, table) };
  }

  if (table.expired) {
    return { reply: `ตารางเบี้ยชุดนี้หมดอายุแล้วครับ ขอราคาปัจจุบันจากตัวแทนได้เลย ${HAND_OVER}` };
  }
  if (age < table.ageMin || age > table.ageMax) {
    return { reply: `แบบนี้รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ ${HAND_OVER}` };
  }

  const variant = slots.variant ?? DEFAULT_TERM;
  // the floor is a rule of the plan, not a field of the page's slim table
  const floor = baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, variant).min;
  if (sumAssured < floor) {
    return { reply: `ทุนประกันขั้นต่ำของแบบนี้คือ ${floor.toLocaleString("en-US")} บาทครับ บอกทุนที่สนใจมาใหม่ได้เลย` };
  }

  const term = termAt(table, variant);
  const modes = lifeProtectModes(table, term, { sex, age, sumAssured });
  if (!modes) return { reply: `แบบนี้รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ ${HAND_OVER}` };

  const text = lifeProtectQuoteText({
    sumAssured,
    termLabel: term.label,
    age,
    sex,
    modes,
    death: deathBenefitOf(table, age, sumAssured),
    cash: cashAt(term, sex, age, sumAssured, table.ageMin),
  });

  return {
    reply: `${text}\n\n${otherTerms(table, variant)}`,
    priced: true,
    card: cardPath({
      kind: "plan", planCode: PLAN_CODE, variant, age, sex, sumAssured,
      ...(slots.mode ? { mode: slots.mode } : {}),
    }),
  };
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
  return { reply: r.text.trim() || `${ASK_FOR_DETAILS}` };
}

async function answerSmallTalk(history: ChatMessage[]): Promise<Omit<Answer, "slots">> {
  const r = await chat({
    tier: "small",
    task: "small_talk",
    maxTokens: 200,
    messages: [{ role: "system", content: SMALL_TALK_SYSTEM }, ...recentTurns(history, 6)],
  });
  return { reply: r.text.trim() || ASK_FOR_DETAILS };
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
