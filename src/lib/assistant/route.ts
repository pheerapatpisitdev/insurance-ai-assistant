import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import type { TraceStep } from "./answer";
import { getPlan } from "@/calc/plans/registry";
import { getBundle, listBundles } from "@/calc/bundles/registry";
import { planCatalogue } from "./catalogue";

export type Intent = "quote" | "plan_info" | "doc_qa" | "other";

export interface Routed {
  intent: Intent;
  planCode?: string;
  variant?: string;
  age?: number;
  sex?: "M" | "F";
  sumAssured?: number;
  mode?: "annual" | "semi" | "monthly";
  /** an agency bundle the customer asked for by name, quoted whole instead of plan by plan */
  bundleCode?: string;
  /** which step of that bundle, e.g. 3 for "มรดก 3 ล้าน" */
  tier?: number;
  /** a stand-alone rewrite of the question, with pronouns from earlier turns filled in */
  question?: string;
}

const SYSTEM = `คุณเป็นตัวช่วยของตัวแทนประกันชีวิต หน้าที่ของคุณคืออ่านข้อความล่าสุดแล้วบอกว่าผู้ใช้ต้องการอะไร ตอบเป็น JSON เท่านั้น

intent มี 4 แบบ
- "quote" = ขอเบี้ยประกัน ต้องคำนวณเป็นตัวเลข
- "plan_info" = ถามว่าแบบประกันมีอะไรบ้าง เงื่อนไข อายุที่รับ ทุนขั้นต่ำ สัญญาเพิ่มเติม
- "doc_qa" = ถามเรื่องทั่วไปในเอกสาร เช่น การเคลม ระยะรอคอย ข้อยกเว้น
- "other" = ทักทายหรือเรื่องอื่น

ฟิลด์ที่ต้องเติมถ้ามีในข้อความ
- planCode, variant ใช้รหัสจากรายการข้างล่างเท่านั้น
- age เป็นตัวเลขปี
- sex เป็น "M" (ชาย) หรือ "F" (หญิง)
- sumAssured ทุนประกันเป็นบาท ("1 ล้าน" = 1000000)
- mode เป็น "annual" (รายปี) "semi" (ราย 6 เดือน) หรือ "monthly" (รายเดือน)
- question เขียนคำถามใหม่ให้เข้าใจได้ด้วยตัวเอง โดยเติมสิ่งที่อ้างถึงจากบทสนทนาก่อนหน้า

ถ้าไม่มีข้อมูลให้ละฟิลด์นั้นไป ห้ามเดา

รายการแบบประกัน
`;

/**
 * The last few turns, always beginning with something the customer said. Cutting a
 * conversation to a fixed length can land on an assistant turn, and providers differ on
 * whether they accept a reply with nothing to reply to — one refuses outright. Starting on
 * a user turn keeps every provider in the failover chain usable.
 */
export function recentTurns(history: ChatMessage[], count: number): ChatMessage[] {
  const recent = history.slice(-count);
  const first = recent.findIndex((m) => m.role === "user");
  return first < 0 ? [] : recent.slice(first);
}

/** Reads the conversation and returns what the user is asking for. Cheap model, strict JSON. */
export async function routeMessage(history: ChatMessage[], trace?: TraceStep[]): Promise<Routed> {
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM + planCatalogue() },
    ...recentTurns(history, 6),
  ];
  const r = await chat({ tier: "small", task: "route", messages, maxTokens: 300, json: true });
  const parsed = parseJsonReply<Routed>(r.text);
  trace?.push({
    step: "อ่านคำถาม แยกเจตนา",
    model: r.model, inputTokens: r.inputTokens, outputTokens: r.outputTokens, costThb: r.costThb,
    detail: parsed ? JSON.stringify(parsed, null, 0) : `อ่านคำตอบไม่ได้: ${r.text.slice(0, 200)}`,
  });
  if (!parsed) return { intent: "other" };
  const cleaned = clean(parsed, history);
  if (JSON.stringify(cleaned) !== JSON.stringify(parsed)) {
    trace?.push({ step: "ตรวจกับรายการจริง", detail: JSON.stringify(cleaned, null, 0) });
  }
  return cleaned;
}

/**
 * How people actually write each plan's name. The model is asked for a plan code too, but
 * it sometimes leaves it out, and a quote on the wrong plan is the one mistake a customer
 * would not forgive — so the name written in the message wins over whatever the model said.
 */
const PLAN_ALIASES: [string, RegExp][] = [
  ["LIFEPROTECT", /ไลฟ์\s*โพรเทค|life\s*protect|โพรเทค\s*\+|lpp/i],
  ["ISHIELD", /i\s*shield|ไอ\s*ชิลด์|ไอ\s*ชิว|ไอ\s*ชีลด์/i],
  ["ISMART", /i\s*smart|ไอ\s*สมาร์ท|ไอ\s*สมาท|80\s*\/\s*6/i],
  ["LIFETREASURE", /ไลฟ์\s*เทรเชอร์|life\s*treasure|เทรเชอร์/i],
  ["PLB", /\bplb\b|protection\s*life|โพรเทคชั่น\s*ไลฟ์|โปรเทคชั่น\s*ไลฟ์/i],
];

/**
 * How people ask for an agency bundle. Customers say "ประกันมรดก" long before they say the
 * bundle's full name, and the arrangement behind it is not something they could assemble
 * from the plan list, so the name has to be recognised on its own.
 */
const BUNDLE_ALIASES: [string, RegExp][] = [
  ["LEGACY_FAMILY", /มรดก/i],
];

/** The bundle named in a message, or undefined when none is. */
export function bundleNamedIn(text: string): string | undefined {
  const hit = BUNDLE_ALIASES.find(([, re]) => re.test(text))?.[0];
  return hit && getBundle(hit) ? hit : undefined;
}

/** The tier a sum of whole millions stands for, when the bundle sells one that size. */
export function tierForSum(bundleCode: string, sumAssured: number | undefined): number | undefined {
  const bundle = getBundle(bundleCode);
  if (!bundle || sumAssured === undefined || sumAssured % 1_000_000 !== 0) return undefined;
  const no = sumAssured / 1_000_000;
  return bundle.tiers.some((t) => t.no === no) ? no : undefined;
}

/** The bundles on offer, for the router prompt. */
export function bundleCatalogue(): string {
  return listBundles().map((b) => `${b.code} — ${b.name}`).join("\n");
}

/** The plan named in a message, or undefined when none is. */
export function planNamedIn(text: string): string | undefined {
  return PLAN_ALIASES.find(([, re]) => re.test(text))?.[0];
}

/**
 * How ไลฟ์ โพรเทค+ names its payment terms, in the customer's words and in the workbook's.
 *
 * The plan sells six of them: three terms under two products that differ only in how much
 * they pay on early death. That is two decisions the model has to make from prose, and it
 * was making neither — a customer arriving from /lifeprotect having chosen "จ่าย 19 ปี" was
 * quoted the pay-to-99 term instead, at nearly half the premium the page had just shown.
 * A price that changes between the page and the chat is the one thing neither will forgive,
 * so both halves are read off the text here rather than left to the model.
 *
 * A term counts only where the customer is paying — "จ่าย 19 ปี", "ชำระเบี้ย 19 ปี" — never
 * from a bare number of years, because "อายุ 19 ปี" is an insured, not a term.
 */
const LIFEPROTECT_TERMS: [string, RegExp][] = [
  ["99", /(?:ถึง|ครบ)\s*อายุ\s*99|จนอายุ\s*99|to\s*99/i],
  ["19", /(?:จ่าย|ชำระ)(?:เบี้ย)?\s*19\s*ปี|19\s*ปีจบ/i],
  ["09", /(?:จ่าย|ชำระ)(?:เบี้ย)?\s*9\s*ปี|(?:^|[^\d])9\s*ปีจบ/i],
];

/** The x1.5 product; anything else on this plan is the x2 one the agency actually sells. */
const LIFEPROTECT_HALF = /\+\s*50|x\s*1\.5|โพรเทค\s*\+?\s*50/i;

/**
 * The ไลฟ์ โพรเทค+ package a message asks for, when it names a payment term. Undefined when
 * no term is named, which leaves the choice where it was — the model, then the plan's own
 * default.
 */
export function lifeProtectVariantIn(text: string): string | undefined {
  const term = LIFEPROTECT_TERMS.find(([, re]) => re.test(text))?.[0];
  if (!term) return undefined;
  return `WLF${term}${LIFEPROTECT_HALF.test(text) ? "L" : "H"}`;
}

/** Anything the model returns is checked here, so a hallucinated plan code never reaches the engine. */
function clean(raw: Routed, history: ChatMessage[]): Routed {
  const out: Routed = { intent: ["quote", "plan_info", "doc_qa", "other"].includes(raw.intent) ? raw.intent : "other" };
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const planCode = planNamedIn(last) ?? raw.planCode;
  const plan = planCode ? getPlan(planCode) : undefined;
  if (plan && planCode) {
    out.planCode = planCode;
    // the term written in the message wins over the model's, for the same reason the plan
    // name does: it is what the customer chose, and it is on their screen
    const named = planCode === "LIFEPROTECT" ? lifeProtectVariantIn(last) : undefined;
    const variant = named ?? raw.variant;
    // a variant only makes sense on the plan it belongs to
    if (variant && variant in plan.variantLabels) out.variant = variant;
  }
  if (typeof raw.age === "number" && raw.age >= 0 && raw.age <= 99) out.age = Math.trunc(raw.age);
  if (raw.sex === "M" || raw.sex === "F") out.sex = raw.sex;
  if (typeof raw.sumAssured === "number" && raw.sumAssured > 0) out.sumAssured = Math.trunc(raw.sumAssured);
  // a bundle is asked for by name and sized in whole millions, so "มรดก 3 ล้าน" is tier 3
  const bundleCode = bundleNamedIn(last);
  if (bundleCode) {
    out.bundleCode = bundleCode;
    out.tier = tierForSum(bundleCode, out.sumAssured) ?? (typeof raw.tier === "number" ? raw.tier : undefined);
  }
  if (raw.mode === "annual" || raw.mode === "semi" || raw.mode === "monthly") out.mode = raw.mode;
  out.question = typeof raw.question === "string" && raw.question.trim() ? raw.question.trim() : last;
  return out;
}

/**
 * Slots carry over between turns: "อายุ 35 ชาย" then "แล้วทุน 2 ล้านล่ะ" should still know
 * the age and sex. The newer turn always wins.
 */
export function mergeSlots(previous: Routed | null, current: Routed): Routed {
  if (!previous) return current;
  const merged: Routed = { ...current };
  if (merged.planCode === undefined) merged.planCode = previous.planCode;
  // the payment term and the amount belong to the plan they were named for; carrying either
  // across a switch quotes ไลฟ์เทรเชอร์ at a Life Protect+ customer's one million
  const samePlan = merged.planCode === previous.planCode;
  if (merged.variant === undefined && samePlan) merged.variant = previous.variant;
  if (merged.sumAssured === undefined && samePlan) merged.sumAssured = previous.sumAssured;
  if (merged.age === undefined) merged.age = previous.age;
  if (merged.sex === undefined) merged.sex = previous.sex;
  if (merged.mode === undefined) merged.mode = previous.mode;
  // the bundle and its step travel together, for the same reason a term belongs to its plan
  if (merged.bundleCode === undefined) {
    merged.bundleCode = previous.bundleCode;
    if (merged.tier === undefined && merged.bundleCode) {
      // "ทุน 1,000,000" in a conversation already about the bundle is a new step, not a
      // repeat of the old one; an amount that is not a step leaves the step to be asked for
      merged.tier = current.sumAssured !== undefined
        ? tierForSum(merged.bundleCode, current.sumAssured)
        : previous.tier;
    }
  } else if (merged.tier === undefined && merged.bundleCode === previous.bundleCode) {
    merged.tier = previous.tier;
  }
  return merged;
}
