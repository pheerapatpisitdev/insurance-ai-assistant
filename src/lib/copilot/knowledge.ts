import { getPlan, listPlans, trimSuffix } from "@/calc/plans/registry";
import { riderDiseases } from "@/calc/riders/diseases";
import ishieldDiseases from "../../../data/riders/ishield-diseases.json";
import ci123Diseases from "../../../data/riders/ci123-diseases.json";
import rrssDiseases from "../../../data/riders/rrss-diseases.json";
import { pricedHere } from "./price";
import { FAQ as LIFE_FAQ } from "@/lib/assistant/lifeprotect/faq";
import { FAQ as HEALTH_FAQ } from "@/lib/assistant/ihealthy/faq";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { groupSection, groupTablesFor } from "./group-knowledge";
import type { PlanRules } from "@/calc/types";

/**
 * Everything this assistant is allowed to know, written out as Thai it can read.
 *
 * The whole of it — every rule of every plan — goes into one prompt, and that is a decision
 * rather than a shortcut. The rules come to 19 kilobytes; the premium tables they sit beside
 * come to 2.7 megabytes, a hundred and forty times more. Searching is what you do when the
 * knowledge will not fit, and this knowledge fits.
 *
 * Searching would also be the riskier answer here. A retrieval that misses one rule does not
 * return a worse answer, it returns a confident wrong one: the model would say HIC and MEB
 * can be bought together because it never saw the line that says they cannot. Sending
 * everything cannot miss anything.
 *
 * The premiums themselves are never in here. They are computed, by the engine, from the
 * tables — a figure this file handed to a model would be a figure a model could round.
 */

const money = (n: number) => n.toLocaleString("en-US");

/**
 * Which plans this chat can put a price on — asked of the code that does the pricing.
 *
 * Saying so inside the knowledge is not a detail in either direction. Claim too much and a
 * customer asks for a premium the assistant cannot produce; claim too little and it sends
 * them to another page for a figure it could have given them in the next sentence. It did
 * exactly that for a while: this was a hand-kept list of one, and stayed at one after the
 * chat learned to price three more.
 *
 * ไลฟ์ โพรเทค+ is added by hand because it is not priced by ./price at all — it has the
 * dispatcher, which is a different road to the same figure.
 */
const PRICEABLE = new Set([...pricedHere(), "LIFEPROTECT"]);

/** One plan's rules as sentences. The shapes are the workbook's; the wording is for reading. */
function planSection(code: string, name: string, rules: PlanRules): string {
  const lines: string[] = [
    `## ${trimSuffix(name)} (รหัส ${code})`,
    PRICEABLE.has(code)
      ? "- คิดเบี้ยในแชทนี้ได้ — บอกอายุ เพศ ทุนประกัน (และระยะเวลาชำระเบี้ยถ้าแบบนี้มีให้เลือก)"
      : getPlan(code)?.rules.base.premiumBasis
        // its figures run the other way: a premium in, a sum assured back
        ? "- **แชทนี้คิดให้ไม่ได้** เพราะแบบนี้กรอกเบี้ยที่อยากจ่ายแล้วได้ทุนกลับมา ไม่ใช่กรอกทุน ใช้ที่หน้าแบบประกันอื่นๆ (/other-plans)"
        : "- **คิดเบี้ยในแชทนี้ไม่ได้** ตอบเรื่องเงื่อนไขได้อย่างเดียว เบี้ยต้องไปที่หน้าแบบประกันอื่นๆ (/other-plans)",
  ];
  const b = rules.base;

  lines.push(`- อายุที่รับประกัน: ${b.ageMin}–${b.ageMax} ปี`);
  lines.push(`- ทุนประกันขั้นต่ำ: ${money(b.saMin)} บาท${b.saMax ? ` สูงสุด ${money(b.saMax)} บาท` : ""}`);
  if (b.saMinByVariant && Object.keys(b.saMinByVariant).length) {
    const per = Object.entries(b.saMinByVariant).map(([v, n]) => `${v} ขั้นต่ำ ${money(n)}`).join(", ");
    lines.push(`- ทุนขั้นต่ำเฉพาะแบบ: ${per}`);
  }
  if (b.saExactVariants?.length) {
    lines.push(`- แบบที่รับเฉพาะทุนขั้นต่ำเท่านั้น ห้ามมากกว่านั้น: ${b.saExactVariants.join(", ")}`);
  }
  if (b.ageMaxByVariant && Object.keys(b.ageMaxByVariant).length) {
    const per = Object.entries(b.ageMaxByVariant).map(([v, n]) => `${v} ถึงอายุ ${n}`).join(", ");
    lines.push(`- อายุสูงสุดเฉพาะแบบ: ${per}`);
  }
  if (b.extraDeathBenefitBeforeAge) {
    lines.push(`- เสียชีวิตก่อนอายุ ${b.extraDeathBenefitBeforeAge} ปี ได้รับเพิ่มจากทุนประกันตามตัวคูณของแบบนั้น`);
  }
  /**
   * Worded away from the word "เบี้ย" on purpose. It is a floor on what may be paid monthly,
   * not a price, and a model that finds "เบี้ย… 1,000 บาท" in its prompt has been handed a
   * premium to read out — which is the one thing every prompt in this system forbids.
   */
  if (rules.minMonthlyTotal) {
    lines.push(`- ยอดชำระขั้นต่ำต่อเดือน รวมทุกสัญญา (เป็นข้อจำกัดการชำระ ไม่ใช่ราคาของแบบนี้): ${money(rules.minMonthlyTotal)} บาท`);
  }

  const riders = Object.entries(rules.riders ?? {});
  if (riders.length) {
    lines.push("", "### สัญญาเพิ่มเติมที่ซื้อกับแบบนี้ได้");
    for (const [rcode, r] of riders) {
      const parts = [`อายุ ${r.ageMin}–${r.ageMax} ปี`];
      if (r.saMin) parts.push(`ทุนขั้นต่ำ ${money(r.saMin)}`);
      if (r.saMaxCap) parts.push(`ทุนสูงสุด ${money(r.saMaxCap)}`);
      if (r.saMaxMultipleOfBase) parts.push(`ทุนไม่เกิน ${r.saMaxMultipleOfBase} เท่าของทุนหลัก`);
      if (r.coverToAge) parts.push(`คุ้มครองถึงอายุ ${r.coverToAge}`);
      if (r.paysOnDeath) parts.push("จ่ายเมื่อเสียชีวิตด้วย");
      lines.push(`- **${rcode}** ${r.name ?? ""} — ${parts.join(" · ")}`);
    }
  }

  /**
   * The rules about combinations, which is what an agent actually rings up to ask. Each
   * carries the company's own message where the workbook has one, because that sentence is
   * what the agent has to be able to repeat.
   */
  const pairs: string[] = [];
  for (const x of rules.exclusive ?? []) pairs.push(`- ${x.riders.join(" กับ ")} เลือกได้อย่างใดอย่างหนึ่งเท่านั้น${x.message ? ` — ${x.message}` : ""}`);
  for (const x of rules.requires ?? []) pairs.push(`- ${x.rider} ต้องซื้อคู่กับ ${x.needs.join(", ")}${x.message ? ` — ${x.message}` : ""}`);
  for (const x of rules.conflicts ?? []) pairs.push(`- ${x.rider} ห้ามซื้อคู่กับ ${x.with.join(", ")}${x.message ? ` — ${x.message}` : ""}`);
  for (const x of rules.combined ?? []) {
    // not every combined rule has both halves: DCI + CPR is a ceiling with no multiple, and
    // printing the missing half read "ไม่เกิน undefined เท่า" — a sentence about a limit
    // that names no limit, which is worse in a knowledge base than saying nothing
    const limits = [
      x.maxMultipleOfBase ? `ไม่เกิน ${x.maxMultipleOfBase} เท่าของทุนหลัก` : null,
      x.cap ? `ไม่เกิน ${money(x.cap)} บาท` : null,
    ].filter(Boolean);
    if (limits.length) pairs.push(`- ${x.riders.join(" + ")} รวมกัน${limits.join(" และ")}`);
  }
  if (pairs.length) lines.push("", "### กฎการซื้อคู่", ...pairs);

  return lines.join("\n");
}

/**
 * The illness lists, and which question reaches which of them.
 *
 * Every list declares the words that call it. That is a deliberate choice against searching
 * by similarity: the vocabulary here is closed — five plans and thirteen riders, all named —
 * so a declared index is testable where a nearest-neighbour is only inspectable. Every route
 * in this table has a test that presses it.
 */
interface DiseaseList {
  name: string;
  note: string;
  groups: { title: string; diseases: string[] }[];
  /** the words that name this rider in particular */
  re: RegExp;
}

function diseaseLists(): DiseaseList[] {
  const dci = riderDiseases("DCI");
  const shield = ishieldDiseases as { note: string; early: string[]; major: string[] };
  const ci = ci123Diseases as { name: string; note: string; groups: { title: string; diseases: string[] }[] };
  const rrss = rrssDiseases as { name: string; note: string; groups: { title: string; diseases: string[] }[] };
  return [
    ...(dci ? [{
      name: dci.name, note: dci.note, re: /\bdci\b|ดีซีไอ/i,
      groups: [{ title: "รายชื่อ", diseases: dci.diseases }],
    }] : []),
    {
      name: "iShield", note: shield.note, re: /i\s*-?\s*shield|ไอ\s*ชิลด์/i,
      groups: [
        { title: "ระยะเริ่มต้น", diseases: shield.early },
        { title: "ระยะรุนแรง", diseases: shield.major },
      ],
    },
    { name: ci.name, note: ci.note, groups: ci.groups, re: /\bci\s*-?\s*123\b|ซีไอ\s*123/i },
    { name: rrss.name, note: rrss.note, groups: rrss.groups, re: /\brrss\b|\bmci\b|โซชิลด์/i },
  ];
}

const listTotal = (l: DiseaseList) => l.groups.reduce((n, g) => n + g.diseases.length, 0);

/** The heading every list keeps in the knowledge whether or not its names are sent with it. */
function listHeading(l: DiseaseList): string {
  const total = listTotal(l);
  return l.groups.length === 1
    ? `### ${l.name} — ${total} โรค`
    : `### ${l.name} — รวม ${total} โรค (${l.groups.map((g) => `${g.title} ${g.diseases.length}`).join(", ")})`;
}

/**
 * What every question carries: how many illnesses each rider covers, and the groups they fall
 * into. It is the answer to the question people actually ask — "กี่โรค" — and it costs a few
 * hundred characters rather than ten thousand.
 *
 * The last line is the reason this can be split at all. Without it, a question whose names
 * were not fetched would be answered "ข้อมูลนี้ไม่มีในระบบ", which is a lie about a system
 * that has them. With it, the assistant knows the list exists and offers to fetch it.
 */
function diseaseSummary(lists: DiseaseList[]): string {
  return [
    "## โรคร้ายแรงที่สัญญาเพิ่มเติมคุ้มครอง — สรุปจำนวน",
    ...lists.map((l) => `- ${listHeading(l).replace(/^### /, "")}`),
    "- ชื่อโรคทุกโรคมีอยู่ในระบบ ถ้าผู้ใช้ขอรายชื่อเต็มแต่ไม่เห็นรายชื่อด้านล่าง ให้บอกว่า “ขอรายชื่อเต็มได้ครับ ระบุสัญญาที่ต้องการ” — ห้ามบอกว่าไม่มีในระบบ",
  ].join("\n");
}

/** The names themselves, for the lists this question actually asked about. */
function diseaseDetail(lists: DiseaseList[]): string {
  if (!lists.length) return "";
  return [
    "## รายชื่อโรค (ชื่อตามกรมธรรม์)",
    ...lists.flatMap((l) => [
      listHeading(l),
      `- ${l.note}`,
      ...l.groups.map((g) => `- ${g.title}: ${g.diseases.join(" / ")}`),
    ]),
    "- คำนิยามของแต่ละโรคเป็นไปตามที่ระบุในกรมธรรม์ ห้ามสรุปหรือย่อคำนิยามเอง",
  ].join("\n");
}

/**
 * Which lists this question opens: the rider it names, and nothing otherwise.
 *
 * "โรคร้ายแรงมีอะไรบ้าง" used to open all four, twelve thousand characters of illness names —
 * and it was the wrong answer as well as the expensive one. A customer asking that is asking
 * which products cover critical illness, not for two hundred and thirty-nine diagnoses; the
 * owner had to point this out, having watched it happen. That question is now answered by
 * the options table above, which travels on every question and costs a few hundred
 * characters.
 *
 * So the names come out only for a named contract. Someone who does want them says which —
 * and if they do not, the summary's own line tells the assistant to ask, which it has to do
 * regardless: there are four different lists and no way to guess which one is meant.
 */
export function listsFor(question: string): DiseaseList[] {
  const all = diseaseLists();
  if (!question) return all;
  return all.filter((l) => l.re.test(question));
}

/**
 * What the agency sells against critical illness, as products rather than as diagnoses.
 *
 * Built from the rules and the lists themselves, so a rider that gains a plan or changes its
 * ages is described correctly here without anyone remembering to come back.
 */
function criticalIllnessSection(lists: DiseaseList[]): string {
  const count = (re: RegExp) => {
    const hit = lists.find((l) => re.test(l.name) || re.test(l.re.source));
    return hit ? listTotal(hit) : undefined;
  };
  /** the plans that sell a rider, by the name a person would say */
  const soldWith = (code: string) => knowledgePlans()
    .filter((p) => getPlan(p.code)?.rules.riders?.[code])
    .map((p) => trimSuffix(p.name))
    .join(", ");

  const lines = ["## คุ้มครองโรคร้ายแรง — มีอะไรให้เลือกบ้าง (ตอบคำถามแนว “โรคร้ายแรงมีแบบไหนบ้าง”)"];

  const ishield = getPlan("ISHIELD");
  if (ishield) {
    const b = ishield.rules.base;
    lines.push(
      `- **iShield** — เป็น**แบบประกันหลัก** ไม่ใช่สัญญาเพิ่มเติม คุ้มครองโรคร้ายแรง ${count(/iShield/) ?? "?"} โรค`
      + ` (ระยะเริ่มต้นจ่าย 25% ของทุนต่อโรค ระยะรุนแรงสูงสุด 100%) · อายุ ${b.ageMin}–${b.ageMax} ปี`
      + " · แบบนี้กรอกเบี้ยที่อยากจ่ายแล้วได้ทุนกลับมา",
    );
  }

  for (const [code, extra] of [
    ["DCI", "จ่ายทั้งกรณีเสียชีวิตและกรณีเจ็บป่วยด้วยโรคร้ายแรง"],
    ["CI123", "แบ่งจ่ายตามระยะของโรค ตั้งแต่ระยะก่อนเริ่มต้นถึงระยะรุนแรง"],
    ["RRSS", "เป็นค่ารักษาพยาบาลสำหรับโรคร้ายแรง ไม่ใช่เงินก้อน"],
  ] as const) {
    const rules = knowledgePlans().map((p) => getPlan(p.code)?.rules.riders?.[code]).find(Boolean);
    if (!rules) continue;
    const total = count(code === "RRSS" ? /โซชิลด์|MCI/ : new RegExp(code === "CI123" ? "CI\\s*123" : code, "i"));
    const limits = [
      `อายุ ${rules.ageMin}–${rules.ageMax} ปี`,
      ...(rules.coverToAge ? [`คุ้มครองถึงอายุ ${rules.coverToAge}`] : []),
      ...(rules.saMin ? [`ทุนขั้นต่ำ ${money(rules.saMin)}`] : []),
    ].join(" · ");
    lines.push(
      `- **${rules.name}** — สัญญาเพิ่มเติม ซื้อพ่วงกับ ${soldWith(code)}`
      + `${total ? ` · คุ้มครอง ${total} โรค` : ""} · ${limits} · ${extra}`,
    );
  }

  lines.push("- ถ้าลูกค้าถามว่า “โรคร้ายแรงมีอะไรบ้าง” ให้ตอบด้วยรายการนี้ก่อน แล้วค่อยถามว่าอยากดูรายชื่อโรคของตัวไหน");
  return lines.join("\n");
}

/** The answers the agency already gives by hand, which are the house's own words. */
function faqSection(question: string): string {
  /**
   * Each entry carries the pattern that summons it — written by whoever wrote the answer,
   * and the same one the Messenger bot matches on to serve it. Asking that pattern is how
   * this stays in step: a rewritten answer brings its own new trigger with it, and there is
   * no second list of keywords here to fall out of date.
   */
  const all = [
    ...LIFE_FAQ.map((f) => ({ plan: "Life Protect x 2", key: f.key, match: f.match, answer: f.answer })),
    // the health entries hold a function, because two of them are read off the contract
    // sheet at the moment they are asked rather than typed into the file
    ...HEALTH_FAQ.map((f) => ({ plan: "iHealthy Ultra", key: f.key, match: f.match, answer: f.answer() })),
  ];
  const wanted = question ? all.filter((f) => f.match.test(question)) : all;
  if (!wanted.length) return "";
  return ["## คำตอบมาตรฐานที่เอเจนซี่ใช้อยู่",
    ...wanted.map((f) => `- [${f.plan} · ${f.key}] ${f.answer.replace(/\n+/g, " ")}`)].join("\n");
}

/** What the agent has typed in for themselves: objections, comparisons, anything else. */
async function ownNotesSection(): Promise<string> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("ins_faq").select("question, answer").eq("enabled", true).limit(300);
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as { question: string; answer: string }[];
    if (rows.length === 0) return "";
    return ["## บันทึกของตัวแทนเอง (พิมพ์ไว้ในหลังบ้าน ไม่ใช่เอกสารบริษัท)",
      ...rows.map((r) => `- ถาม: ${r.question}\n  ตอบ: ${r.answer.replace(/\n+/g, " ")}`)].join("\n");
  } catch (e) {
    // a note the assistant cannot read is a note it answers without; the plan rules are the
    // part that must never be missing, and they are not in the database
    console.error("อ่านบันทึกของตัวแทนไม่สำเร็จ:", e);
    return "";
  }
}

/** The plans this chat can price, by the names a person would use for them. */
function priceableNames(): string[] {
  return knowledgePlans().filter((p) => PRICEABLE.has(p.code)).map((p) => trimSuffix(p.name));
}

/** Which plans the assistant may speak about, newest question first in the caller's hands. */
export function knowledgePlans(): { code: string; name: string }[] {
  return listPlans().filter((p) => getPlan(p.code)?.rules);
}

/**
 * The whole knowledge base as one block of Thai.
 *
 * Pure but for the one database read, and that read fails soft: the rules are the part that
 * must never be missing and they come from files in this repository, not from a table.
 */
export async function assembleKnowledge(question = ""): Promise<string> {
  const plans = knowledgePlans()
    .map((p) => planSection(p.code, p.name, getPlan(p.code)!.rules))
    .join("\n\n");
  const notes = await ownNotesSection();
  const all = diseaseLists();
  const opened = listsFor(question);
  const faq = faqSection(question);

  const text = [
    "# คลังความรู้ของระบบนี้",
    "ทุกอย่างด้านล่างมาจากไฟล์กฎและตารางของระบบนี้เอง ไม่ได้มาจากที่อื่น",
    "",
    /**
     * Written from the same set the per-plan lines use. This sentence used to name two plans
     * by hand and forbid quoting any other — which outranked everything below it, so fixing
     * the per-plan lines alone would have left the assistant refusing anyway.
     */
    `**สำคัญ:** แชทนี้คิดเบี้ยให้ได้เฉพาะแบบเหล่านี้: ${priceableNames().join(", ")} และ iHealthy Ultra`,
    "แบบที่ไม่อยู่ในรายการนี้ ตอบได้แต่เรื่องเงื่อนไข ห้ามเสนอว่าจะคิดเบี้ยให้ และให้ชี้ไปที่หน้า /other-plans แทน",
    "",
    plans,
    /**
     * Group insurance, after the plans and before the illnesses.
     *
     * After the plans because it is not one of them — the plans above are contracts a person
     * buys on their own life, this is one a company buys over its payroll, and its heading
     * says so in its first line. Before the illnesses because `## รายชื่อโรค` is the last
     * heading of the document by design: `copilot-diseases` reads everything after it to see
     * which illness lists a question opened, and a section that arrived later was counted as
     * four more of them.
     */
    "",
    groupSection(question),
    "",
    criticalIllnessSection(all),
    "",
    diseaseSummary(all),
    ...(opened.length ? ["", diseaseDetail(opened)] : []),
    ...(faq ? ["", faq] : []),
    ...(notes ? ["", notes] : []),
  ].join("\n");

  /**
   * What was sent, in one line. A route that quietly fetches the wrong thing is the failure
   * this design can have, and the only way to find it is to be able to read afterwards which
   * blocks a question opened.
   */
  const groupTables = groupTablesFor(question);
  console.info(
    `[knowledge] ${text.length} ตัวอักษร · โรค: ${opened.length ? opened.map((l) => l.name.slice(0, 18)).join("+") : "สรุปเท่านั้น"}`
    + ` · faq: ${faq ? faq.split("\n").length - 1 : 0}`
    + ` · กลุ่ม: ${groupTables.length ? groupTables.join("+") : "สรุปเท่านั้น"}`,
  );
  return text;
}
