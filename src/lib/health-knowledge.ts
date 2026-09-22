import contract from "../../data/riders/ihealthy-ultra-contract.json";
import claims from "../../data/claims/admission-criteria.json";

/**
 * What the health contract says beyond its benefit table, and what the industry says about
 * claiming at all.
 *
 * Two files, and the split is not tidiness. `data/riders/ihealthy-ultra.json` is generated
 * from the workbook by `scripts/extract_ihu_benefits.py` and says so at the top — every
 * figure in it is the sales sheet's. What is here came from the registered policy wording
 * and from the คปภ. admission rules, which the workbook has never carried and never will.
 * Putting them in the generated file would have meant losing them on the next extract.
 *
 * The admission criteria are the further half of that: they belong to no product. A customer
 * who is refused an overnight stay is refused it under the same regulator's table whichever
 * company sold them the cover, so this knowledge outlives iHealthy Ultra and is kept where a
 * second health rider could reach it.
 */

export interface Exclusion {
  no: number;
  text: string;
}

export interface Condition {
  /** the clause's own number in ข้อกำหนดทั่วไป */
  no: number;
  title: string;
  /** one line an agent can repeat, where the clause itself is a paragraph */
  short: string;
  text: string;
  items?: string[];
}

export interface HealthContract {
  name: string;
  code: string;
  source: string;
  exclusionsIntro: string;
  exclusions: Exclusion[];
  conditions: Condition[];
  gracePeriodDays: number;
  incontestableYears: number;
  claimEvidenceDays: number;
  payoutDays: number;
  payoutMaxDays: number;
  lateInterestPercent: number;
  reinstatementDays: number;
  noticeDays: number;
}

export interface ConditionCriteria {
  code: string;
  title: string;
  criteria: string[];
}

export interface ClaimRules {
  name: string;
  source: string;
  /** travels with every admission block; see `admissionDetail` */
  caution: string;
  simpleDisease: {
    title: string;
    rule: string;
    threshold: string;
    criteria: string[];
    ageNote: string;
  };
  byCondition: ConditionCriteria[];
  timeline: { title: string; steps: { when: string; what: string }[] };
  payFirst: { title: string; items: string[]; note: string };
  notCovered: { title: string; items: string[] };
}

/**
 * Frozen at import for the reason `ihealthy-facts` freezes its sheet: every caller is handed
 * the same arrays, so one caller sorting `exclusions` in place would reorder them for every
 * later render in the process.
 */
function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object") {
    for (const inner of Object.values(value)) deepFreeze(inner);
    Object.freeze(value);
  }
  return value;
}

const CONTRACT = deepFreeze(contract as HealthContract);
const CLAIMS = deepFreeze(claims as ClaimRules);

export function healthContract(): HealthContract {
  return CONTRACT;
}

export function claimRules(): ClaimRules {
  return CLAIMS;
}

/**
 * A block of this knowledge, and the words that open it.
 *
 * The same shape as `DiseaseList` in the copilot's knowledge, and for the same reason: the
 * vocabulary is closed and small, so a declared index is testable where a nearest-neighbour
 * search is only inspectable. Each route below has a test that presses it.
 */
export interface HealthTopic {
  code: string;
  /** the line that travels on every question, whether or not the detail does */
  summary: string;
  detail: () => string;
  re: RegExp;
}

/** The 21 exclusions, verbatim, under the contract's own preamble. */
function exclusionsDetail(): string {
  return [
    `### ข้อยกเว้นทั่วไปของสัญญาเพิ่มเติมค่ารักษาพยาบาล ไอเฮลท์ตี้ อัลตร้า — ${CONTRACT.exclusions.length} ข้อ`,
    CONTRACT.exclusionsIntro,
    ...CONTRACT.exclusions.map((e) => `${e.no}. ${e.text}`),
    "- ข้อความข้างบนเป็นถ้อยคำของกรมธรรม์ ห้ามย่อ ห้ามตีความเอง ถ้าลูกค้าถามถึงกรณีของตัวเอง ให้ยกข้อที่เกี่ยวข้องมาอ่านให้ฟัง แล้วบอกว่าผลการพิจารณาเป็นของบริษัท",
  ].join("\n");
}

/** The general conditions an agent is actually rung up about. */
function conditionsDetail(): string {
  return [
    "### ข้อกำหนดทั่วไปของสัญญาเพิ่มเติม (ตามแบบและข้อความที่นายทะเบียนเห็นชอบ)",
    ...CONTRACT.conditions.flatMap((c) => [
      `**ข้อ ${c.no} ${c.title}** — ${c.short}`,
      c.text,
      ...(c.items ?? []).map((i) => `  - ${i}`),
    ]),
    `- ระยะเวลาผ่อนผันชำระเบี้ย ${CONTRACT.gracePeriodDays} วัน ตามที่กำหนดไว้ในกรมธรรม์ประกันภัย`,
  ].join("\n");
}

/**
 * The regulator's admission table, and the warning that has to travel with it.
 *
 * The caution is not decoration. A customer reading eight thresholds will ask whether their
 * own fever clears the bar, and the honest answer is that a doctor admits them and the
 * company pays or does not — neither of which this chat gets to decide. The line is emitted
 * from the data file rather than typed here so that the page, the bot and the web chat cannot
 * drift into three different warnings.
 */
function admissionDetail(): string {
  const s = CLAIMS.simpleDisease;
  return [
    `### ${s.title}`,
    s.rule,
    `**${s.threshold}**`,
    ...s.criteria.map((c, i) => `${i + 1}. ${c}`),
    `- ${s.ageNote}`,
    ...CLAIMS.byCondition.flatMap((c) => [
      `**${c.title}**`,
      ...c.criteria.map((x, i) => `  ${i + 1}. ${x}`),
    ]),
    `- **${CLAIMS.caution}**`,
  ].join("\n");
}

/** When cover starts, when the card works, and when the customer pays first. */
function claimingDetail(): string {
  const { timeline, payFirst, notCovered } = CLAIMS;
  return [
    `### ${timeline.title}`,
    ...timeline.steps.map((s) => `- ${s.when}: ${s.what}`),
    `### ${payFirst.title}`,
    ...payFirst.items.map((i) => `- ${i}`),
    payFirst.note,
    `### ${notCovered.title}`,
    ...notCovered.items.map((i) => `- ${i}`),
    "- เรื่องรายชื่อโรงพยาบาลคู่สัญญาและผลการพิจารณาเคลมแต่ละเคส ให้ตัวแทนเป็นคนตอบ ข้อมูลชุดนี้บอกได้แค่ว่าบริษัทใช้หลักเกณฑ์อะไร",
  ].join("\n");
}

/**
 * Every block, with the words that fetch it.
 *
 * The summaries are written so that a question whose detail was not fetched still gets a true
 * answer and an offer — the same rule the illness lists are split under. An assistant that
 * says "ไม่มีในระบบ" about twenty-one exclusions it holds is worse than one that says nothing.
 */
function topics(): HealthTopic[] {
  return [
    {
      code: "EXCLUSIONS",
      summary: `- ข้อยกเว้นทั่วไปของ iHealthy Ultra มี ${CONTRACT.exclusions.length} ข้อ ระบบนี้มีถ้อยคำเต็มทุกข้อ ถ้าลูกค้าขอ ให้บอกว่า “ขอข้อยกเว้นฉบับเต็มได้ครับ” ห้ามบอกว่าไม่มีในระบบ`,
      detail: exclusionsDetail,
      re: /ข้อยกเว้น|ยกเว้นอะไร|ไม่คุ้มครองอะไร|อะไรบ้างที่ไม่คุ้มครอง|เคลมไม่ได้|ไม่จ่ายกรณี|exclusion/i,
    },
    {
      code: "CONDITIONS",
      summary: `- เงื่อนไขสัญญา: ผ่อนผันชำระเบี้ย ${CONTRACT.gracePeriodDays} วัน · พ้น ${CONTRACT.incontestableYears} ปีบริษัทโต้แย้งความไม่สมบูรณ์ของสัญญาไม่ได้ · ส่งหลักฐานเคลมภายใน ${CONTRACT.claimEvidenceDays} วันหลังออกจากโรงพยาบาล · บริษัทจ่ายภายใน ${CONTRACT.payoutDays} วันเมื่อเอกสารครบ · บริษัทสงวนสิทธิ์ไม่ต่ออายุได้ ${CONTRACT.conditions.find((c) => c.no === 7)?.items?.length ?? 0} กรณี — ระบบมีข้อความเต็มของทุกข้อ`,
      detail: conditionsDetail,
      re: /ต่ออายุ|ไม่ต่อสัญญา|ยกเลิกสัญญา|บอกเลิก|ผ่อนผัน|ขาดส่ง|ค้างเบี้ย|ปรับเบี้ย|เบี้ยขึ้น|โต้แย้ง|บอกล้าง|แถลง|ปกปิด|กี่วัน.{0,10}จ่าย|จ่ายสินไหม|reinstat/i,
    },
    {
      code: "ADMISSION",
      summary: `- เกณฑ์เข้าแอดมิดของการเจ็บป่วยทั่วไป (Simple Disease ตามที่ คปภ. บังคับใช้กับทุกบริษัท) มีอยู่ในระบบ ${CLAIMS.simpleDisease.criteria.length} ข้อ พร้อมเกณฑ์เฉพาะโรคอีก ${CLAIMS.byCondition.length} กลุ่ม ถ้าลูกค้าถามว่าทำไมนอนโรงพยาบาลแล้วเคลมไม่ได้ ให้เสนอว่าอธิบายเกณฑ์ให้ได้`,
      detail: admissionDetail,
      re: /แอดมิ|admit|นอนโรงพยาบาล|นอนรพ|ผู้ป่วยใน|\bipd\b|simple\s*disease|เกณฑ์.{0,12}นอน|ทำไม.{0,20}เคลมไม่|ไข้หวัด|ท้องเสีย|อุจจาระร่วง|ลำไส้อักเสบ|เวียนศีรษะ|เวียนหัว/i,
    },
    {
      code: "CLAIMING",
      summary: "- วิธีใช้สิทธิ: บัตรประกันใช้ไม่ต้องสำรองจ่ายที่โรงพยาบาลคู่สัญญา ระบบมีรายการกรณีที่ต้องสำรองจ่ายก่อนและไทม์ไลน์ว่าความคุ้มครองแต่ละอย่างเริ่มเมื่อไร",
      detail: claimingDetail,
      re: /สำรองจ่าย|จ่ายก่อน|แฟกซ์เคลม|fax\s*claim|direct\s*billing|บัตรประกัน|โรงพยาบาลคู่สัญญา|รพ.?คู่สัญญา|เบิกคืน|ใช้สิทธิ|เคลมยังไง|เคลมอย่างไร|ยื่นเคลม/i,
    },
  ];
}

/**
 * Which blocks this question opens — none of them when there is no question.
 *
 * `listsFor` opens every illness list for an empty question and this deliberately does not,
 * which is worth the inconsistency. The rule the knowledge base splits under is that a block
 * may be fetched rather than always sent only when its absence makes the assistant say so,
 * and every summary below ends by telling it to offer the full text. Summary-only is
 * therefore a state that lies about nothing.
 *
 * The other half is a measurement. Opening all four here for an empty question put the
 * assembled knowledge at 41,728 characters, past the 40,000 that `copilot-knowledge` watches
 * for a leaked rate table — and no real caller would have gained by it, because every one of
 * them passes the customer's own words.
 */
export function healthTopicsFor(question: string): HealthTopic[] {
  if (!question) return [];
  return topics().filter((t) => t.re.test(question));
}

export function healthTopic(code: string): HealthTopic | undefined {
  return topics().find((t) => t.code === code);
}

/** The lines that travel on every question, whether or not any detail does. */
export function healthKnowledgeSummary(): string {
  return [
    "## เงื่อนไขและการเคลมประกันสุขภาพ — สรุป",
    ...topics().map((t) => t.summary),
  ].join("\n");
}

/** The blocks this question asked for, in full. */
export function healthKnowledgeDetail(question: string): string {
  const opened = healthTopicsFor(question);
  if (!opened.length) return "";
  return [
    "## เงื่อนไขและการเคลมประกันสุขภาพ — ฉบับเต็ม",
    ...opened.map((t) => t.detail()),
  ].join("\n");
}
