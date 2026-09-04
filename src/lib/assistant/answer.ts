import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { getPlan, listPlans } from "@/calc/plans/registry";
import { baseAgeRange, baseSumAssuredLimits, packageSeq, requiredRiders } from "@/calc/rules";
import { quote } from "@/calc/quote";
import type { QuoteInput, RiderInput } from "@/calc/types";
import { bundleReply, citationLine, quoteFooter, quoteReply, tierChoices } from "./format";
import { replaceCodes } from "./codes";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { embedTexts } from "@/lib/ai/client";
import { allPlanFacts } from "./catalogue";
import { mergeSlots, recentTurns, routeMessage, type Routed } from "./route";
import { getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange, bundleModePremiums, describeTier, quoteBundle } from "@/calc/bundles/quote";

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

export async function answerQuestion(history: ChatMessage[], previous: Routed | null = null): Promise<Answer> {
  const slots = mergeSlots(previous, await routeMessage(history));
  // a bundle is a whole arrangement the agency sells under its own name, so asking for one by
  // name is answered as that arrangement rather than as its base plan
  if (slots.bundleCode && slots.intent !== "doc_qa") {
    return { ...answerBundle(slots), slots };
  }
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

// ---------- an agency bundle ----------

function answerBundle(slots: Routed): Omit<Answer, "slots"> {
  const bundle = getBundle(slots.bundleCode!)!;
  const names = bundle.tiers.map((t) => t.name);
  const choices = tierChoices(names);
  const example = names[Math.min(2, names.length - 1)];

  if (slots.age === undefined || slots.sex === undefined) {
    const missing = [slots.age === undefined ? "อายุ" : null, slots.sex === undefined ? "เพศ" : null].filter(Boolean);
    return {
      reply: `ชุด${bundle.name}\n${choices}\n\nขอ${missing.join("และ")}ของผู้เอาประกัน และระดับที่ต้องการด้วยครับ\nเช่น "ชาย 35 ${example}"`,
      sources: [],
    };
  }
  if (slots.tier === undefined) {
    return { reply: `ชุด${bundle.name}\n${choices}\n\nต้องการระดับไหนครับ เช่น "${example}"`, sources: [] };
  }

  const range = bundleAgeRange(bundle);
  if (slots.age < range.min || slots.age > range.max) {
    return { reply: `ชุด${bundle.name} รับอายุ ${range.min}-${range.max} ปี อายุ ${slots.age} ปีจึงจัดชุดนี้ไม่ได้ครับ`, sources: [] };
  }

  const who = { age: slots.age, sex: slots.sex };
  const result = quoteBundle(bundle, slots.tier, { ...who, mode: "annual" });
  const tierName = describeTier(bundle, slots.tier);
  if (!result || !tierName) {
    return { reply: `ชุด${bundle.name} ไม่มีระดับที่ขอครับ\n${choices}`, sources: [] };
  }
  return { reply: bundleReply(bundle.name, tierName, who, result, bundleModePremiums(bundle, slots.tier, who)), sources: [] };
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
    const label = plan.variantLabels[variant];
    const planLabel = plan.planLabel ?? planCode;
    const named = label.includes(planLabel) ? label : `${planLabel} (${label})`;
    return {
      reply: `${named} รับอายุ ${range.min}-${range.max} ปี อายุ ${age} ปีจึงสมัครแบบนี้ไม่ได้ครับ ลองแบบอื่นได้ไหมครับ`,
      sources: [],
    };
  }

  const saLimits = baseSumAssuredLimits(plan.rules, variant);
  const sumAssured = saLimits.exact ? saLimits.min : (slots.sumAssured ?? saLimits.min);
  if (!saLimits.exact && sumAssured < saLimits.min) {
    return { reply: `แบบนี้ทุนประกันขั้นต่ำ ${saLimits.min.toLocaleString("en-US")} บาทครับ ระบุทุนใหม่ได้ไหมครับ`, sources: [] };
  }
  // the engine prices an amount over the maximum and only flags it, which in a chat reads as
  // a quote the customer could act on; refusing says plainly that it cannot be issued
  if (saLimits.max !== undefined && sumAssured > saLimits.max) {
    return { reply: `แบบนี้ทุนประกันสูงสุด ${saLimits.max.toLocaleString("en-US")} บาทครับ ระบุทุนใหม่ได้ไหมครับ`, sources: [] };
  }

  // riders the package forces on are added, because the engine treats them as part of the plan
  const seq = packageSeq(variant, plan.rates);
  const riders: RiderInput[] = requiredRiders(plan.rules, seq).map((code) => ({ code }));

  const input: QuoteInput = {
    planCode, variant, age, sex: slots.sex!, mode: slots.mode ?? "annual",
    sumAssured, basis: "sumAssured", riders,
  };
  const result = quote(input);
  const assumedTerm = !slots.variant && Object.keys(plan.variantLabels).length > 1;
  const assumedAmount = !saLimits.exact && slots.sumAssured === undefined;
  return { reply: `${quoteReply(input, result)}\n\n${quoteFooter(assumedTerm, assumedAmount, input.mode)}`, sources: [] };
}

// ---------- plan information ----------

const PLAN_INFO_SYSTEM = `คุณเป็นผู้ช่วยของตัวแทนประกันชีวิต ตอบคำถามด้วยข้อเท็จจริงที่ให้ไว้ข้างล่างเท่านั้น
- ถ้าข้อเท็จจริงไม่มีคำตอบ ให้บอกตรง ๆ ว่าไม่มีข้อมูลนี้ ห้ามเดา
- ห้ามบอกตัวเลขเบี้ยประกัน ถ้าเขาอยากรู้เบี้ยให้บอกว่าขออายุ เพศ และทุนประกัน แล้วจะคำนวณให้
- ตอบเฉพาะสิ่งที่ถาม ไม่ต้องไล่อายุที่รับและทุนขั้นต่ำทุกครั้ง บอกเมื่อเขาถามหรือเมื่อจำเป็นจริง ๆ
- ตอบภาษาไทย สั้น กระชับ
รูปแบบการตอบ
- ข้อความธรรมดา ห้ามใช้ ** หรือ # หรือสัญลักษณ์มาร์กดาวน์ เพราะ LINE แสดงเป็นตัวอักษรจริง
- เรียกชื่อแบบประกันเป็นภาษาคน ห้ามใช้รหัสภายในเช่น WLCI05 WLF99H W80F06
- ขึ้นต้นบรรทัดรายการด้วย - เท่านั้น
- ตอบให้จบใน 5 บรรทัด ถ้าจำเป็นต้องยาวกว่านั้นให้ตัดเนื้อหาที่ไม่ได้ถาม`;

async function answerPlanInfo(slots: Routed): Promise<Omit<Answer, "slots">> {
  // Every plan's facts go in, always. Narrowing to the plan carried from an earlier turn is
  // what made "สนใจประกันมรดก" come back about Life Protect+ alone: the customer had opened a
  // fresh question and the answer could not see the other four plans. The plan under
  // discussion is named instead, so a genuine follow-up still lands on the right one.
  const focus = slots.planCode
    ? `ลูกค้ากำลังคุยเรื่อง ${getPlan(slots.planCode)!.planLabel ?? slots.planCode} อยู่ ถ้าคำถามล่าสุดเป็นการถามต่อ ให้ตอบเรื่องแบบนี้ ถ้าเป็นคำถามใหม่ที่กว้างกว่านั้น ให้ดูทุกแบบ\n\n`
    : "";
  const r = await chat({
    tier: "small",
    task: "plan_info",
    messages: [
      { role: "system", content: `${PLAN_INFO_SYSTEM}\n\n${focus}ข้อเท็จจริง\n${allPlanFacts()}` },
      { role: "user", content: slots.question ?? "" },
    ],
    maxTokens: 800,
  });
  return { reply: replaceCodes(r.text.trim()), sources: [] };
}

// ---------- questions answered from the uploaded documents ----------

const DOC_SYSTEM = `คุณเป็นผู้ช่วยของตัวแทนประกันชีวิต ตอบจากเอกสารอ้างอิงข้างล่างเท่านั้น
- ถ้าเอกสารไม่ได้ตอบคำถามนี้ ให้บอกว่ายังไม่มีเอกสารเรื่องนี้ ห้ามเดา
- ห้ามใส่หมายเลขอ้างอิงเช่น [1] ระบบเติมที่มาให้ท้ายคำตอบอยู่แล้ว
- เอกสารบางฉบับอ่านจากไฟล์ PDF จึงอาจมีตัวอักษรเพี้ยนบ้าง ให้ตีความตามบริบท
- ตอบภาษาไทย สั้น กระชับ
รูปแบบการตอบ
- ข้อความธรรมดา ห้ามใช้ ** หรือ # หรือสัญลักษณ์มาร์กดาวน์ เพราะ LINE แสดงเป็นตัวอักษรจริง
- เรียกชื่อแบบประกันเป็นภาษาคน ห้ามใช้รหัสภายในเช่น WLCI05 WLF99H W80F06
- ขึ้นต้นบรรทัดรายการด้วย - เท่านั้น หัวข้อไม่ต้องขึ้นต้นด้วย -
- ไม่เกิน 8 บรรทัด ถ้ามีหลายหัวข้อ ให้สรุปหัวข้อละ 1 บรรทัด
- ตอบเฉพาะที่ถาม ไม่ต้องเล่าเนื้อหาอื่นในเอกสาร`;

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
  const sources = hits.map((h) => ({ title: h.doc_title, page: h.page }));
  return { reply: `${replaceCodes(r.text.trim())}\n\n${citationLine(sources)}`, sources };
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
ถ้าถูกถามเรื่องนอกเหนือจากประกัน ให้บอกว่าช่วยเรื่องนี้ไม่ได้ แล้วชวนกลับมาเรื่องประกัน
ตอบไม่เกิน 3 บรรทัด ข้อความธรรมดา ห้ามใช้มาร์กดาวน์`,
      },
      ...recentTurns(history, 4),
    ],
    maxTokens: 300,
  });
  return { reply: replaceCodes(r.text.trim()), sources: [] };
}
