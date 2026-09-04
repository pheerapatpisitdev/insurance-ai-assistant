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
import { promptText } from "./prompts";
import { MATCH_THRESHOLD, searchFaq } from "./faq";
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

/**
 * One thing the assistant did on the way to an answer. Collected only when a caller asks for
 * it — the back office does, so an odd reply can be explained instead of guessed at.
 */
export interface TraceStep {
  step: string;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  costThb?: number;
  detail?: string;
}

export async function answerQuestion(
  history: ChatMessage[], previous: Routed | null = null, trace?: TraceStep[],
): Promise<Answer> {
  const routed = await routeMessage(history, trace);
  const slots = mergeSlots(previous, routed);
  trace?.push({
    step: "รวมกับบทสนทนาก่อนหน้า",
    detail: JSON.stringify(slots, null, 0),
  });
  // a bundle is a whole arrangement the agency sells under its own name, so asking for one by
  // name is answered as that arrangement rather than as its base plan
  if (slots.bundleCode && slots.intent !== "doc_qa") {
    trace?.push({ step: "เส้นทาง: ชุดจัดเอง", detail: "คำนวณด้วยเครื่องคำนวณ ไม่ใช้ AI" });
    return { ...answerBundle(slots), slots };
  }

  // A premium is arithmetic and a bundle is an arrangement; neither is something a written
  // answer should stand in for. Everything else is checked against the agency's own answers
  // first, because a sentence the trainer wrote beats a model's paraphrase of a document.
  if (slots.intent !== "quote") {
    const curated = await answerFromFaq(slots.question ?? "", trace);
    if (curated) return { ...curated, slots };
  }

  switch (slots.intent) {
    case "quote":
      trace?.push({ step: "เส้นทาง: คำนวณเบี้ย", detail: "คำนวณด้วยเครื่องคำนวณ ไม่ใช้ AI" });
      return { ...(await answerQuote(slots)), slots };
    case "plan_info":
      return { ...(await answerPlanInfo(slots, trace)), slots };
    case "doc_qa":
      return { ...(await answerFromDocuments(slots, trace)), slots };
    default:
      return { ...(await answerSmallTalk(history, trace)), slots };
  }
}

// ---------- answers the agency wrote ----------

async function answerFromFaq(
  question: string, trace?: TraceStep[],
): Promise<Omit<Answer, "slots"> | null> {
  if (!question.trim()) return null;
  let hits;
  try {
    hits = await searchFaq(question);
  } catch (e) {
    // a curated answer is a nicety; losing it must not cost the customer their reply
    trace?.push({ step: "ค้นคลังคำตอบ", detail: `ค้นไม่สำเร็จ ข้ามไปใช้เส้นทางปกติ: ${e instanceof Error ? e.message : e}` });
    return null;
  }

  const best = hits[0];
  trace?.push({
    step: "ค้นคลังคำตอบที่เขียนเอง",
    detail: best
      ? `ใกล้ที่สุด "${best.question}" ตรงกัน ${(best.score * 100).toFixed(0)}% (ต้องถึง ${(MATCH_THRESHOLD * 100).toFixed(0)}% ถึงจะใช้)`
      : "ยังไม่มีคำตอบที่เขียนไว้",
  });
  if (!best || best.score < MATCH_THRESHOLD) return null;

  trace?.push({ step: "เส้นทาง: คำตอบที่เขียนเอง", detail: "ส่งข้อความตามที่เขียนไว้ ไม่ผ่าน AI" });
  return { reply: best.answer, sources: [] };
}

// ---------- an agency bundle ----------

/** Exported for its tests: the replies below are what an advert's first click lands on. */
export function answerBundle(slots: Routed): Omit<Answer, "slots"> {
  const bundle = getBundle(slots.bundleCode!)!;
  const names = bundle.tiers.map((t) => t.name);
  const choices = tierChoices(names);
  const example = names[Math.min(2, names.length - 1)];

  const range = bundleAgeRange(bundle);
  const chosen = slots.tier === undefined ? undefined : describeTier(bundle, slots.tier);

  if (slots.age === undefined || slots.sex === undefined) {
    const missing = [slots.age === undefined ? "อายุ" : null, slots.sex === undefined ? "เพศ" : null].filter(Boolean);
    // a step already named needs nothing repeated: only the person is still unknown
    if (chosen) {
      return {
        reply: `ชุด${bundle.name} — ${chosen}\nขอ${missing.join("และ")}ของผู้เอาประกันด้วยครับ เช่น "ชาย 35"`,
        sources: [],
      };
    }
    // a first contact — typically someone arriving from an advert — is told what the
    // arrangement is before being asked anything
    const intro = [bundle.description, `รับอายุ ${range.min}-${range.max} ปี`].filter(Boolean).join("\n");
    return {
      reply: `ชุด${bundle.name}\n${intro}\n\nเลือกวงเงินได้\n${choices}\n\nขอ${missing.join("และ")}ของผู้เอาประกัน และระดับที่ต้องการด้วยครับ\nเช่น "ชาย 35 ${example}"`,
      sources: [],
    };
  }
  if (slots.tier === undefined) {
    return { reply: `ชุด${bundle.name}\n${choices}\n\nต้องการระดับไหนครับ เช่น "${example}"`, sources: [] };
  }

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

async function answerPlanInfo(slots: Routed, trace?: TraceStep[]): Promise<Omit<Answer, "slots">> {
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
      { role: "system", content: `${await promptText("plan_info")}\n\n${focus}ข้อเท็จจริง\n${allPlanFacts()}` },
      { role: "user", content: slots.question ?? "" },
    ],
    maxTokens: 800,
  });
  trace?.push({ step: "เส้นทาง: เงื่อนไขแบบประกัน", model: r.model, inputTokens: r.inputTokens,
    outputTokens: r.outputTokens, costThb: r.costThb, detail: "ข้อเท็จจริงจากตารางเบี้ยของทุกแบบ" });
  return { reply: replaceCodes(r.text.trim()), sources: [] };
}

// ---------- questions answered from the uploaded documents ----------

async function answerFromDocuments(slots: Routed, trace?: TraceStep[]): Promise<Omit<Answer, "slots">> {
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
      { role: "system", content: `${await promptText("doc_qa")}\n\nเอกสารอ้างอิง\n${context}` },
      { role: "user", content: question },
    ],
    maxTokens: 1600,
  });
  const sources = hits.map((h) => ({ title: h.doc_title, page: h.page }));
  trace?.push({ step: "เส้นทาง: ค้นจากเอกสาร", model: r.model, inputTokens: r.inputTokens,
    outputTokens: r.outputTokens, costThb: r.costThb,
    detail: `ค้นเจอ ${hits.length} ท่อน จาก ${new Set(hits.map((h) => h.doc_title)).size} ไฟล์` });
  return { reply: `${replaceCodes(r.text.trim())}\n\n${citationLine(sources)}`, sources };
}

// ---------- anything else ----------

async function answerSmallTalk(history: ChatMessage[], trace?: TraceStep[]): Promise<Omit<Answer, "slots">> {
  const plans = listPlans().map((p) => p.name).join(", ");
  const r = await chat({
    tier: "small",
    task: "smalltalk",
    messages: [
      {
        role: "system",
        content: `${await promptText("smalltalk")}\n\nแบบประกันที่มี: ${plans}`,
      },
      ...recentTurns(history, 4),
    ],
    maxTokens: 300,
  });
  trace?.push({ step: "เส้นทาง: ทักทาย/นอกเรื่อง", model: r.model, inputTokens: r.inputTokens,
    outputTokens: r.outputTokens, costThb: r.costThb });
  return { reply: replaceCodes(r.text.trim()), sources: [] };
}
