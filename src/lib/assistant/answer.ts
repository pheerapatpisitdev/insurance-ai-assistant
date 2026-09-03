import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { getPlan, listPlans } from "@/calc/plans/registry";
import { baseAgeRange, baseSumAssuredLimits, packageSeq, requiredRiders } from "@/calc/rules";
import { quote } from "@/calc/quote";
import type { QuoteInput, RiderInput } from "@/calc/types";
import { summaryText } from "@/lib/summary";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/ai/client";
import { allPlanFacts, planFacts } from "./catalogue";
import { mergeSlots, routeMessage, type Routed } from "./route";

export interface Source {
  title: string;
  page: number | null;
}
export interface Answer {
  reply: string;
  sources: Source[];
  /** carried into the next turn so follow-up questions keep the age, sex and plan */
  slots: Routed;
}

const NOT_ADVICE = "ตัวเลขนี้เป็นเบี้ยประมาณการจากตารางเบี้ยของบริษัท ใช้ประกอบการนำเสนอ ไม่ใช่ใบเสนอราคาอย่างเป็นทางการ";

export async function answerQuestion(history: ChatMessage[], previous: Routed | null = null): Promise<Answer> {
  const slots = mergeSlots(previous, await routeMessage(history));
  switch (slots.intent) {
    case "quote":
      return { ...(await answerQuote(slots)), slots };
    case "plan_info":
      return { ...(await answerPlanInfo(slots)), slots };
    case "doc_qa":
      return { ...(await answerFromDocuments(slots)), slots };
    default:
      return { ...(await answerSmallTalk(history)), slots };
  }
}

// ---------- quote ----------

/** The plan a question about "ประกันชีวิต" with no name should be priced on. */
const DEFAULT_PLAN = "LIFEPROTECT";

function defaultVariant(planCode: string): string {
  const plan = getPlan(planCode)!;
  return plan.defaultVariant ?? Object.keys(plan.variantLabels)[0];
}

async function answerQuote(slots: Routed): Promise<Omit<Answer, "slots">> {
  const missing: string[] = [];
  if (slots.age === undefined) missing.push("อายุ");
  if (slots.sex === undefined) missing.push("เพศ");
  if (missing.length) {
    const known = slots.planCode ? `แบบ ${getPlan(slots.planCode)!.planLabel ?? slots.planCode} ` : "";
    return { reply: `ขอ${missing.join("และ")}ของผู้เอาประกันด้วยครับ ${known}จะได้คำนวณเบี้ยให้ถูกต้อง`, sources: [] };
  }

  const planCode = slots.planCode ?? DEFAULT_PLAN;
  const plan = getPlan(planCode)!;
  const variant = slots.variant ?? defaultVariant(planCode);
  const age = slots.age!;

  const range = baseAgeRange(plan.rules, variant, plan.rates);
  if (age < range.min || age > range.max) {
    return {
      reply: `${plan.variantLabels[variant]} รับอายุ ${range.min} ถึง ${range.max} ปี อายุ ${age} ปีจึงสมัครแบบนี้ไม่ได้ครับ ลองแบบอื่นได้ไหมครับ`,
      sources: [],
    };
  }

  const saLimits = baseSumAssuredLimits(plan.rules, variant);
  const sumAssured = saLimits.exact ? saLimits.min : (slots.sumAssured ?? saLimits.min);
  if (!saLimits.exact && sumAssured < saLimits.min) {
    return { reply: `แบบนี้ทุนประกันขั้นต่ำ ${saLimits.min.toLocaleString("en-US")} บาทครับ ระบุทุนใหม่ได้ไหมครับ`, sources: [] };
  }

  // riders the package forces on are added, because the engine treats them as part of the plan
  const seq = packageSeq(variant, plan.rates);
  const riders: RiderInput[] = requiredRiders(plan.rules, seq).map((code) => ({ code }));

  const input: QuoteInput = {
    planCode, variant, age, sex: slots.sex!, mode: slots.mode ?? "annual",
    sumAssured, basis: "sumAssured", riders,
  };
  const result = quote(input);
  const lines = [summaryText(input, result)];
  // when the term was assumed rather than asked for, say which one, so nobody quotes the wrong thing
  if (!slots.variant && Object.keys(plan.variantLabels).length > 1) {
    lines.push(`คิดจากแผน ${plan.variantLabels[variant]} ถ้าต้องการระยะเวลาชำระเบี้ยแบบอื่น บอกได้ครับ`);
  }
  lines.push(NOT_ADVICE);
  return { reply: lines.join("\n\n"), sources: [] };
}

// ---------- plan information ----------

const PLAN_INFO_SYSTEM = `คุณเป็นผู้ช่วยของตัวแทนประกันชีวิต ตอบคำถามด้วยข้อเท็จจริงที่ให้ไว้ข้างล่างเท่านั้น
- ถ้าข้อเท็จจริงไม่มีคำตอบ ให้บอกตรง ๆ ว่าไม่มีข้อมูลนี้ ห้ามเดา
- ห้ามบอกตัวเลขเบี้ยประกัน ถ้าเขาอยากรู้เบี้ยให้บอกว่าขออายุ เพศ และทุนประกัน แล้วจะคำนวณให้
- ตอบภาษาไทย สั้น กระชับ ใช้หัวข้อย่อยได้`;

async function answerPlanInfo(slots: Routed): Promise<Omit<Answer, "slots">> {
  const facts = slots.planCode ? planFacts(slots.planCode)! : allPlanFacts();
  const r = await chat({
    tier: "small",
    task: "plan_info",
    messages: [
      { role: "system", content: `${PLAN_INFO_SYSTEM}\n\nข้อเท็จจริง\n${facts}` },
      { role: "user", content: slots.question ?? "" },
    ],
    maxTokens: 800,
  });
  return { reply: r.text.trim(), sources: [] };
}

// ---------- questions answered from the uploaded documents ----------

const DOC_SYSTEM = `คุณเป็นผู้ช่วยของตัวแทนประกันชีวิต ตอบจากเอกสารอ้างอิงข้างล่างเท่านั้น
- อ้างที่มาท้ายประโยคด้วยหมายเลขในวงเล็บเหลี่ยม เช่น [1]
- ถ้าเอกสารไม่ได้ตอบคำถามนี้ ให้บอกว่ายังไม่มีเอกสารเรื่องนี้ ห้ามเดา
- เอกสารบางฉบับอ่านจากไฟล์ PDF จึงอาจมีตัวอักษรเพี้ยนบ้าง ให้ตีความตามบริบท
- ตอบภาษาไทย สั้น กระชับ`;

async function answerFromDocuments(slots: Routed): Promise<Omit<Answer, "slots">> {
  const question = slots.question ?? "";
  const [embedding] = await embedTexts([question], "search");
  const { data, error } = await supabaseAdmin().rpc("ins_search_chunks", {
    query_embedding: embedding as unknown as string,
    query_text: question,
    match_count: 6,
  });
  if (error) throw new Error(`ค้นเอกสารไม่สำเร็จ: ${error.message}`);

  const hits = (data ?? []) as { doc_title: string; page: number | null; content: string }[];
  if (!hits.length) {
    return { reply: "ยังไม่มีเอกสารเรื่องนี้ในคลังความรู้ครับ ลองถามใหม่ด้วยคำอื่น หรือให้แอดมินอัปโหลดเอกสารเพิ่มก็ได้ครับ", sources: [] };
  }

  const context = hits
    .map((h, i) => `[${i + 1}] ${h.doc_title}${h.page ? ` หน้า ${h.page}` : ""}\n${h.content}`)
    .join("\n\n");
  const r = await chat({
    tier: "large",
    task: "doc_qa",
    messages: [
      { role: "system", content: `${DOC_SYSTEM}\n\nเอกสารอ้างอิง\n${context}` },
      { role: "user", content: question },
    ],
    maxTokens: 1600,
  });
  return { reply: r.text.trim(), sources: hits.map((h) => ({ title: h.doc_title, page: h.page })) };
}

// ---------- anything else ----------

async function answerSmallTalk(history: ChatMessage[]): Promise<Omit<Answer, "slots">> {
  const plans = listPlans().map((p) => p.name).join(", ");
  const r = await chat({
    tier: "small",
    task: "smalltalk",
    messages: [
      {
        role: "system",
        content: `คุณเป็นผู้ช่วยของตัวแทนประกันชีวิต ตอบสั้น ๆ เป็นภาษาไทยอย่างสุภาพ
คุณช่วยได้ 3 เรื่อง คำนวณเบี้ยประกัน, เงื่อนไขของแบบประกัน และคำถามจากเอกสารที่บริษัทให้มา
แบบประกันที่มี: ${plans}
ถ้าถูกถามเรื่องนอกเหนือจากประกัน ให้บอกว่าช่วยเรื่องนี้ไม่ได้ แล้วชวนกลับมาเรื่องประกัน`,
      },
      ...history.slice(-4),
    ],
    maxTokens: 300,
  });
  return { reply: r.text.trim(), sources: [] };
}
