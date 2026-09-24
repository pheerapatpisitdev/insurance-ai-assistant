import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { HOSPITAL_LABEL, LIFE_WANT_LABEL } from "@/lib/plan/assumptions";
import { fixedSummary } from "@/lib/plan/order";
import type { AreaKey, PlanResult } from "@/lib/plan/recommend";
import { RELATION_LABEL, WORK_ABILITY_LABEL } from "./assumptions";
import { figures, scores, type FhcInput, type Level, type Score } from "./health";

/**
 * The check's words: what is going well, what to watch, where to start. Figures go to the
 * model; none may come back — an item carrying a digit is dropped, as the planner's words are.
 */

export interface FhcSummary {
  strengths: string[];
  risks: string[];
  start: string;
}

const DIGIT = /[0-9๐-๙]/;
const MAX_ITEM = 200;
const MAX_ITEMS = 3;
const LEVEL_WORD: Record<Level, string> = { green: "ดี", yellow: "ควรปรับ", red: "ต้องแก้", none: "ไม่มีข้อมูล" };

/** Sentences built from the scores alone, for when the model is down or says something off. */
export function fallbackSummary(sc: Score[], first: AreaKey): FhcSummary {
  return {
    strengths: sc.filter((s) => s.level === "green").slice(0, MAX_ITEMS).map((s) => `${s.label}อยู่ในเกณฑ์ดี`),
    risks: sc.filter((s) => s.level === "red").slice(0, MAX_ITEMS).map((s) => `${s.label}ยังต่ำกว่าเกณฑ์`),
    start: fixedSummary(first),
  };
}

function clean(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t && t.length <= MAX_ITEM && !DIGIT.test(t) ? t : null;
}

function list(v: unknown, fallback: string[]): string[] {
  if (!Array.isArray(v)) return fallback;
  const kept = v.map(clean).filter((x): x is string => x !== null).slice(0, MAX_ITEMS);
  return kept.length ? kept : fallback;
}

export function parseSummary(reply: string, fallback: FhcSummary): FhcSummary {
  const got = parseJsonReply<{ strengths?: unknown; risks?: unknown; start?: unknown }>(reply);
  if (!got) return fallback;
  return { strengths: list(got.strengths, fallback.strengths), risks: list(got.risks, fallback.risks), start: clean(got.start) ?? fallback.start };
}

/** The facts, with figures, for the model only. */
export function summaryBrief(f: FhcInput, plan: PlanResult): string {
  const g = figures(f);
  const people = f.people.length ? f.people.map((p) => `${RELATION_LABEL[p.relation]} อายุ ${p.age}`).join(", ") : "ไม่มี";
  return [
    `ลูกค้า: ${f.sex === "F" ? "หญิง" : "ชาย"} อายุ ${f.age} อยากเกษียณ ${f.retireAge} อายุเฉลี่ย ${f.expectancy}; ${WORK_ABILITY_LABEL[f.work]}`,
    `รายได้ ${f.income}/เดือน ค่าใช้จ่าย ${f.expense}/เดือน เหลือ ${g.netMonth}/เดือน; ค่าความสามารถในการทำงาน ${g.lifetimeIncome}`,
    `เงินเก็บ ${g.savings} ลงทุน ${g.invest} หนี้ ${g.debts} สินทรัพย์สุทธิ ${g.netWorth}`,
    `คนในความดูแล: ${people}`,
    `อยากใช้${HOSPITAL_LABEL[f.hospital]}; ประกันชีวิตแบบ${LIFE_WANT_LABEL[f.lifeWant].title}`,
    ...scores(f).map((s) => `คะแนน ${s.label}: ${LEVEL_WORD[s.level]} (${s.shown})`),
    `แผนที่เสนอ เริ่มจาก: ${plan.order.join(" → ")}`,
  ].join("\n");
}

export function summaryMessages(f: FhcInput, plan: PlanResult): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "คุณคือนักวางแผนการเงินที่อบอุ่นและตรงไปตรงมา อ่านผลตรวจสุขภาพการเงินของลูกค้า แล้วสรุปคุยกับลูกค้าโดยตรงด้วยคำว่า \"คุณ\"",
        "ตอบเป็น JSON เท่านั้น: {\"strengths\":[\"...\"],\"risks\":[\"...\"],\"start\":\"...\"}",
        "strengths: จุดแข็งไม่เกินสามข้อ risks: จุดที่ต้องระวังไม่เกินสามข้อ แต่ละข้อหนึ่งประโยคสั้น",
        "start: หนึ่งประโยค ควรเริ่มแก้จากตรงไหนก่อน ให้สอดคล้องกับด้านแรกของแผนที่เสนอ",
        "ห้ามมีตัวเลข จำนวนเงิน อายุ หรือเปอร์เซ็นต์ใดๆ เด็ดขาด หน้าเว็บแสดงตัวเลขเอง",
        "ห้ามรับประกันผลตอบแทน ห้ามกดดันให้ซื้อ ห้ามพูดถึงสิ่งที่ไม่มีในข้อมูล",
      ].join("\n"),
    },
    { role: "user", content: summaryBrief(f, plan) },
  ];
}

export async function explainHealth(f: FhcInput, plan: PlanResult): Promise<FhcSummary> {
  const fallback = fallbackSummary(scores(f), plan.order[0]);
  try {
    const res = await chat({ tier: "small", task: "fhc-summary", messages: summaryMessages(f, plan), maxTokens: 900, json: true, timeoutMs: 15_000 });
    return parseSummary(res.text, fallback);
  } catch {
    return fallback;
  }
}
