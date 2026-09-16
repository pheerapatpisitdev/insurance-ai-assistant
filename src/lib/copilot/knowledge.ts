import { getPlan, listPlans, trimSuffix } from "@/calc/plans/registry";
import { riderDiseases } from "@/calc/riders/diseases";
import ishieldDiseases from "../../../data/riders/ishield-diseases.json";
import ci123Diseases from "../../../data/riders/ci123-diseases.json";
import rrssDiseases from "../../../data/riders/rrss-diseases.json";
import { pricedHere } from "./price";
import { FAQ as LIFE_FAQ } from "@/lib/assistant/lifeprotect/faq";
import { FAQ as HEALTH_FAQ } from "@/lib/assistant/ihealthy/faq";
import { supabaseAdmin } from "@/lib/supabase/admin";
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
  if (rules.minMonthlyTotal) lines.push(`- เบี้ยรายเดือนขั้นต่ำรวมทุกสัญญา: ${money(rules.minMonthlyTotal)} บาท`);

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
 * The illnesses the critical-illness riders name, one line each.
 *
 * They were in the repository and not in here, so the assistant answered "DCI คุ้มครองกี่โรค"
 * with "ข้อมูลนี้ไม่มีในระบบ" — which was true of what it could see and false of the system,
 * and it is one of the questions an agent is asked most. Thirty-one names and seventy cost
 * about four kilobytes, against a knowledge base that already sends everything it has.
 *
 * The names only, never the definitions: what counts as the illness is the policy's wording,
 * and a model summarising that sentence is a model rewriting the contract.
 */
function diseaseSection(): string {
  /** One rider, however its own file happens to be shaped, as the same few lines. */
  const block = (
    name: string, note: string, groups: { title: string; diseases: string[] }[],
  ): string[] => {
    const total = groups.reduce((n, g) => n + g.diseases.length, 0);
    const heading = groups.length === 1
      ? `### ${name} — ${total} โรค`
      : `### ${name} — รวม ${total} โรค (${groups.map((g) => `${g.title} ${g.diseases.length}`).join(", ")})`;
    return [heading, `- ${note}`, ...groups.map((g) => `- ${g.title}: ${g.diseases.join(" / ")}`)];
  };

  const out: string[] = ["## โรคร้ายแรงที่สัญญาเพิ่มเติมคุ้มครอง (ชื่อโรคตามกรมธรรม์)"];

  const dci = riderDiseases("DCI");
  if (dci) out.push(...block(dci.name, dci.note, [{ title: "รายชื่อ", diseases: dci.diseases }]));

  const shield = ishieldDiseases as { note: string; early: string[]; major: string[] };
  out.push(...block("iShield", shield.note, [
    { title: "ระยะเริ่มต้น", diseases: shield.early },
    { title: "ระยะรุนแรง", diseases: shield.major },
  ]));

  for (const r of [ci123Diseases, rrssDiseases] as {
    name: string; note: string; groups: { title: string; diseases: string[] }[];
  }[]) {
    out.push(...block(r.name, r.note, r.groups));
  }

  out.push("- คำนิยามของแต่ละโรคเป็นไปตามที่ระบุในกรมธรรม์ ห้ามสรุปหรือย่อคำนิยามเอง");
  return out.join("\n");
}

/** The answers the agency already gives by hand, which are the house's own words. */
function faqSection(): string {
  const all = [
    ...LIFE_FAQ.map((f): { plan: string; key: string; answer: string } =>
      ({ plan: "Life Protect x 2", key: f.key, answer: f.answer })),
    // the health entries hold a function, because two of them are read off the contract
    // sheet at the moment they are asked rather than typed into the file
    ...HEALTH_FAQ.map((f): { plan: string; key: string; answer: string } =>
      ({ plan: "iHealthy Ultra", key: f.key, answer: f.answer() })),
  ];
  return ["## คำตอบมาตรฐานที่เอเจนซี่ใช้อยู่",
    ...all.map((f) => `- [${f.plan} · ${f.key}] ${f.answer.replace(/\n+/g, " ")}`)].join("\n");
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
export async function assembleKnowledge(): Promise<string> {
  const plans = knowledgePlans()
    .map((p) => planSection(p.code, p.name, getPlan(p.code)!.rules))
    .join("\n\n");
  const notes = await ownNotesSection();
  return [
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
    "",
    diseaseSection(),
    "",
    faqSection(),
    ...(notes ? ["", notes] : []),
  ].join("\n");
}
