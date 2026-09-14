import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import type { Sex } from "@/calc/types";
import { planLabel } from "@/lib/ihealthy-facts";
import { queryFrom } from "@/lib/ihealthy-link";
import { plansFor, territoriesFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { siteUrl } from "@/lib/site-url";
import {
  WANTS_IN, aboutCompany, affirms, asksAboutCompany, asksAboutTrust, asksCheaper, handOverForm, one,
  recentTurns, saysFormDone, spoken, stallReply, stalls, wantsToBuy,
  type AnswerContext, type Reply, type TraceEvent,
} from "../common";
import { CHOOSE_HEALTH } from "../choose";
import { healthFaqMatch } from "./faq";
import { healthMenu, otherPlansReply } from "./menu";
import { HEALTH_PLAN_INFO_SYSTEM, HEALTH_SMALL_TALK_SYSTEM, healthFactsFor } from "./prompts";
import {
  HEALTH_HAND_OVER, SEE_OTHER_PLANS, THIS_PLAN_BENEFITS, arrangementFor, hasHealthQuote, healthQuote,
} from "./quote";
import {
  asksFullTable, asksOtherPlans, asksShareOfBill, planNamedIn, routeHealth, territoryNamedIn,
  type HealthSlots,
} from "./route";

/** One answer from the health brain, and what it should remember next turn. */
export type HealthAnswer = Reply & { slots: HealthSlots };

const ASK_FOR_DETAILS = 'ขออายุกับเพศหน่อยครับ เดี๋ยวดูเบี้ยให้เลย (เช่น "หญิง 35")';

/**
 * What is still needed, named one field at a time. A bot that asks again for something the
 * customer has already given reads as one that did not listen.
 */
function askForMissing(slots: HealthSlots): string {
  const missing: string[] = [];
  if (slots.age === undefined) missing.push("อายุ");
  if (slots.sex === undefined) missing.push("เพศ");
  if (missing.length !== 1) return ASK_FOR_DETAILS;
  const example = missing[0] === "อายุ" ? "35" : "หญิง";
  return `ขอ${missing[0]}ด้วยครับ เดี๋ยวดูเบี้ยให้เลย (เช่น "${example}")`;
}

/**
 * The two arrangements that lower the premium by moving part of the bill to the customer.
 *
 * Described and not priced: both are sold in Thailand only and neither is quoted in this chat,
 * so the honest answer names them and hands the figure to someone who will work it out.
 */
const SHARE_OF_BILL_ANSWER =
  "มีทั้งแบบมีความรับผิดส่วนแรกและแบบร่วมจ่ายครับ เบี้ยถูกลงพอสมควร แลกกับที่เราออกค่ารักษาส่วนแรกเอง\n"
  + `สองแบบนี้บริษัทขายเฉพาะประเทศไทย และตัวเลขขอให้ตัวแทนคิดให้นะครับ ${HEALTH_HAND_OVER}`;

/** What the customer said this turn. */
function lastAsked(history: ChatMessage[]): string {
  return [...history].reverse().find((m) => m.role === "user")?.content ?? "";
}

/**
 * The health brain.
 *
 * Everything answerable from the engine or from a written sentence is answered before a model
 * is paid for anything, and the model is never asked to word a premium — the order of the
 * checks below is the whole of that guarantee.
 */
export async function answerHealth(
  history: ChatMessage[], previous: HealthSlots | null, ctx: AnswerContext = {},
): Promise<HealthAnswer> {
  const asked = lastAsked(history);
  const known: HealthSlots = previous ?? { product: "ihealthy", intent: "other" };
  const quoted = hasHealthQuote(known);
  const trace: TraceEvent[] = [];
  /** the reply with this turn's trace on it, so every way out below is written down the same way */
  const traced = (reply: Reply, slots: HealthSlots): HealthAnswer =>
    ({ ...reply, slots, trace: [...trace, ...(reply.trace ?? [])] });

  // leaving to think it over needs no model and changes nothing the bot knows
  if (stalls(asked)) {
    trace.push({ kind: "stalled", data: { had_quote: quoted } });
    return traced(one(stallReply(quoted)), known);
  }
  // the form is out and they say it is filled in: the agent takes it from here
  if (known.formSent && saysFormDone(asked)) {
    trace.push({ kind: "form_done" });
    return traced(one("ขอบคุณครับ 🙏 เดี๋ยวตัวแทนเช็กข้อมูลแล้วติดต่อกลับในแชทนี้ครับ"), known);
  }
  if (wantsToBuy(asked, quoted) && !affirms(asked)) {
    trace.push({ kind: "form_sent", data: { had_quote: quoted, ...(ctx.formRef ? { form_ref: ctx.formRef } : {}) } });
    return traced(handOverForm(quoted, ctx.formRef), { ...known, formSent: true });
  }
  // a question about the company is answered by the agency's own sentence, whatever else the
  // turn was about
  if (asksAboutCompany(asked)) {
    trace.push({ kind: "company", data: { trust: asksAboutTrust(asked) } });
    if (asksAboutTrust(asked)) trace.push({ kind: "handover", data: { reason: "trust" } });
    return traced(one(aboutCompany(asked)), known);
  }
  // one of the answers the agency writes out by hand: the declaration, the tax relief, the
  // rising premium, the waiting periods
  const faq = healthFaqMatch(asked);
  if (faq) {
    trace.push({ kind: "faq", data: { key: faq.key } });
    // a condition is the one question the written answer hands to a person as well
    if (faq.key === "health") trace.push({ kind: "handover", data: { reason: "health" } });
    return traced(one(faq.answer()), known);
  }
  if (asksShareOfBill(asked)) {
    trace.push({ kind: "handover", data: { reason: "share_of_bill" } });
    return traced(one(SHARE_OF_BILL_ANSWER), known);
  }

  /**
   * The customer tapped the button that got them here, and it says nothing but the product's
   * name. Left to the model it reads as a request for a description of the contract, and the
   * first thing the advert paid for is three bubbles about renewal ages where a question was
   * wanted. It is a button title like the others, so it is answered like the others.
   */
  if (asked === CHOOSE_HEALTH) {
    if (known.age !== undefined && known.sex !== undefined) {
      trace.push({ kind: "menu", data: { age: known.age, sex: known.sex } });
      return traced(healthMenu(known.age, known.sex), known);
    }
    return traced(one(askForMissing(known)), known);
  }

  if (known.age !== undefined && known.sex !== undefined) {
    const who = { ...known, age: known.age, sex: known.sex };
    if (asksFullTable(asked)) {
      trace.push({ kind: "full_table", data: { plan: known.plan ?? null } });
      return traced(fullTableLink(who), known);
    }
    if (asksOtherPlans(asked) || asked === SEE_OTHER_PLANS) {
      trace.push({ kind: "other_plans", data: { plan: known.plan ?? null } });
      return traced(otherPlansReply(who.age, who.sex), known);
    }
    if (asksCheaper(asked)) {
      trace.push({ kind: "cheaper", data: { plan: known.plan ?? null } });
      return traced(cheaper(who.age, who.sex, known.plan), known);
    }
    // a territory named while a plan is on the table either re-prices it or is turned down
    const wanted = territoryNamedIn(asked);
    if (wanted && known.plan) {
      trace.push({ kind: "territory", data: { territory: wanted, plan: known.plan } });
      const answer = territoryAnswer({ ...who, plan: known.plan }, wanted);
      return traced(answer, answer.slots);
    }
  }

  const slots = await routeHealth(history, previous);
  trace.push({
    kind: "routed",
    data: { intent: slots.intent, has_age: slots.age !== undefined, has_sex: slots.sex !== undefined, plan: slots.plan ?? null },
  });
  // a question the model answers is one the bot had no written answer for; only the model's
  // own rewrite of it is kept, never the raw message
  const question = slots.question && slots.question !== asked ? slots.question : undefined;

  if (asked === THIS_PLAN_BENEFITS || slots.intent === "plan_info") {
    trace.push({ kind: "plan_info", question });
    return traced(await planInfo(history, slots), slots);
  }
  if (slots.age === undefined || slots.sex === undefined) {
    return traced(one(askForMissing(slots)), slots);
  }
  /**
   * A plan is quoted when the customer has asked to be: they named one this turn, they picked
   * a different one, or they have not been quoted at all yet.
   *
   * Not merely because a plan is in the slots. The model is handed the conversation and hands
   * the plan back with it, so "OPD ได้ไหม" three messages after a quotation came back as the
   * whole quotation again, card and all — the same thing the life brain did when asked how
   * long the premium ran.
   */
  if (slots.plan) {
    const asking = planNamedIn(asked) !== undefined
      || slots.plan !== known.plan
      || !hasHealthQuote(known);
    if (asking) {
      return traced(healthQuote({ ...slots, age: slots.age, sex: slots.sex, plan: slots.plan }), slots);
    }
    trace.push({ kind: "plan_info", question });
    return traced(await planInfo(history, slots), slots);
  }
  if (slots.intent === "quote") {
    trace.push({ kind: "menu", data: { age: slots.age, sex: slots.sex } });
    return traced(healthMenu(slots.age, slots.sex), slots);
  }
  trace.push({ kind: "small_talk", question });
  return traced(await smallTalk(history, slots), slots);
}

/**
 * The plan one step down, named rather than priced again.
 *
 * The cheapest plan has nothing under it, and saying so is better than offering the same plan
 * back — what is left after that is the two ways of sharing the bill, which is what this says
 * instead.
 */
function cheaper(age: number, sex: Sex, plan?: string): Reply {
  if (!plan) return healthMenu(age, sex);
  const table = iHealthyTable();
  const sellable = plansFor(table, age).map((p) => p.code);
  const below = sellable.slice(0, sellable.indexOf(plan));
  if (below.length === 0) {
    return one(`แผน ${planLabel(plan)} เป็นแผนที่เบี้ยถูกที่สุดของสัญญานี้แล้วครับ\n${SHARE_OF_BILL_ANSWER}`);
  }
  const next = below[below.length - 1];
  return {
    ...one(`ถ้าอยากให้เบาลง มีแผน ${planLabel(next)} ครับ วงเงินน้อยกว่าแต่เบี้ยถูกกว่า อยากดูราคาไหมครับ`),
    replies: [planLabel(next), SEE_OTHER_PLANS],
  };
}

/** A territory re-prices the plan, or is turned down by name with the plans that do sell it. */
function territoryAnswer(
  slots: HealthSlots & { age: number; sex: Sex; plan: string }, wanted: string,
): HealthAnswer {
  const table = iHealthyTable();
  if (territoriesFor(table, slots.plan, slots.age).includes(wanted)) {
    const next = { ...slots, territory: wanted };
    return { ...healthQuote(next), slots: next };
  }
  const sold = plansFor(table, slots.age)
    .map((p) => p.code)
    .filter((code) => territoriesFor(table, code, slots.age).includes(wanted));
  if (sold.length === 0) {
    return { ...one(`อาณาเขต${wanted} สัญญานี้ไม่มีให้เลือกครับ ${HEALTH_HAND_OVER}`), slots };
  }
  return {
    ...one(`อาณาเขต${wanted} บริษัทเขียนไว้เฉพาะแผน ${sold.map(planLabel).join(" กับแผน ")} ครับ อยากดูราคาแผนไหนบอกได้เลย`),
    replies: sold.map(planLabel),
    slots,
  };
}

/**
 * The whole benefit sheet runs to twenty-eight categories; a picture of it is a document. The
 * page already draws it, so the customer is sent there with their own arrangement filled in.
 */
function fullTableLink(slots: HealthSlots & { age: number; sex: Sex }): Reply {
  const table = iHealthyTable();
  const sellable = plansFor(table, slots.age).map((p) => p.code);
  const plan = slots.plan && sellable.includes(slots.plan) ? slots.plan : sellable[sellable.length - 1];
  const query = queryFrom(table, arrangementFor({
    age: slots.age, sex: slots.sex, plan, territory: slots.territory,
  }));
  return {
    messages: [
      { text: "ตารางผลประโยชน์เต็มทุกหมวดอยู่ในหน้านี้ครับ เปิดมาจะกรอกอายุกับแผนไว้ให้แล้ว" },
      { text: siteUrl(`/ihealthy-ultra?${query}`) },
    ],
    replies: [SEE_OTHER_PLANS, WANTS_IN],
  };
}

async function planInfo(history: ChatMessage[], slots: HealthSlots): Promise<Reply> {
  const r = await chat({
    tier: "small",
    task: "plan_info_health",
    maxTokens: 400,
    messages: [
      { role: "system", content: `${HEALTH_PLAN_INFO_SYSTEM}${healthFactsFor(slots)}` },
      ...recentTurns(history, 6),
    ],
  });
  return spoken(r.text.trim(), ASK_FOR_DETAILS);
}

async function smallTalk(history: ChatMessage[], slots: HealthSlots): Promise<Reply> {
  const r = await chat({
    tier: "small",
    task: "small_talk_health",
    maxTokens: 200,
    messages: [
      { role: "system", content: `${HEALTH_SMALL_TALK_SYSTEM}${healthFactsFor(slots)}` },
      ...recentTurns(history, 6),
    ],
  });
  return spoken(r.text.trim(), ASK_FOR_DETAILS);
}
