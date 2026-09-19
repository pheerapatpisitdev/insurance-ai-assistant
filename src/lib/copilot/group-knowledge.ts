import { aboutAGroup } from "@/lib/assistant/choose";
import { GI, PRODUCT_LIMITS, type Product } from "@/lib/group-insurance/data";
import { translations } from "@/lib/group-insurance/translations";
import type { Key } from "@/lib/group-insurance/translations";

/**
 * What the assistant may say about ประกันภัยกลุ่ม.
 *
 * It is the sixth product and the first one sold to a company, and until this file the
 * assistant had never heard of it. Worse than that: "ประกันสุขภาพกลุ่มมีไหม" was read as the
 * individual health plan — because "ประกันสุขภาพ" is inside it — so a company asking about
 * cover for thirty staff was asked its age and its sex and quoted a premium for one person.
 * An answer that is wrong and looks right. `choose.ts` now refuses that reading, and this is
 * what it refuses in favour of.
 *
 * Everything here is built from the same tables `/group-insurance` prices from. Not one
 * figure is typed twice, so a rate sheet that is replaced cannot leave the assistant quoting
 * last year's cover.
 *
 * ── what travels, and what waits to be asked for ─────────────────────────────────────────
 *
 * Three tiers, and the reason is money: this knowledge is rebuilt into the prompt of every
 * question anybody asks, and the great majority of them are about one person's life cover.
 *
 * What always travels is two lines — that the product exists, that it is not the individual
 * plans, and that the full facts are here for the asking. A hundred and fifty characters.
 *
 * The spine opens when the question is about a company's staff, which `aboutAGroup` decides
 * and which is the same test that routes the question here in the first place. It is what an
 * employer actually asks: who may be covered, the three risk classes, the six plan levels,
 * the head-count limits, and that the chat cannot price it.
 *
 * The benefit tables open only for a question that names which of the two products it means.
 * Health's ten lines and PA's eight, each across six plans, come to several kilobytes and
 * answer a question nobody asks in those words.
 *
 * Each tier names the one above it, so a question whose block did not travel is answered
 * "ขอดูได้ครับ ระบุว่า…" rather than "ไม่มีในระบบ" — which is the failure every split
 * knowledge base has, and the one the illness lists were already split around.
 *
 * ── the one thing it must not do ─────────────────────────────────────────────────────────
 *
 * No premium figure appears anywhere in this file, and the spine says so twice. The tables
 * are in the repository and a model handed one would read a number out of it — rounded,
 * out of the wrong band, or from the wrong risk class. The band alone is the reason: it is
 * taken from the TOTAL head count across every group on the quotation, which is not a rule
 * a model reading a table will apply, and getting it wrong is a price that is wrong in the
 * customer's favour about half the time.
 */

const t = (key: string) => translations.th[key as Key] ?? key;

const fmt = (n: number) => n.toLocaleString("en-US");

/** The two things sold under the one name, each with its own tables and its own limits. */
const PRODUCTS: { product: Product; name: string; rider: string }[] = [
  { product: "health", name: "ประกันสุขภาพกลุ่ม (Group Health)", rider: "OPD (ผู้ป่วยนอก)" },
  { product: "pa", name: "ประกันอุบัติเหตุกลุ่ม (Group PA)", rider: "ME (ค่ารักษาพยาบาลต่ออุบัติเหตุ)" },
];

/** The risk classes, with the trades the rate sheet gives as examples of each. */
function riskClasses(): string {
  return [
    `- **${t("biz1Label")}** (ความเสี่ยงต่ำ) — ${t("biz1Desc")}`,
    `- **${t("biz2Label")}** (ความเสี่ยงปานกลาง) — ${t("biz2Desc")}`,
    `- **${t("biz3Label")}** (ความเสี่ยงสูง) — ${t("biz3Desc")}`,
    "- ธุรกิจของบริษัทไหนอยู่ขั้นไหน ดูได้ที่แท็บ “ประเภทธุรกิจ” ในหน้า /group-insurance — มีรหัสธุรกิจตามกรมพัฒนาธุรกิจการค้าครบ 1,099 รายการ",
    "- ขั้น 4 (ความเสี่ยงสูงมาก) **ไม่รับทำประกัน**",
  ].join("\n");
}

/**
 * The two lines every question carries, whatever it was about.
 *
 * Short enough to be free, and it does the one job that cannot wait for a trigger: it stops
 * the assistant telling a company that the system has no group cover. Everything else waits
 * for the question to be about a company.
 */
export function groupPointer(): string {
  return [
    "## ประกันภัยกลุ่ม (Group Insurance) — มีในระบบ",
    "- ระบบนี้ขายประกันกลุ่มสำหรับองค์กรด้วย (บริษัทซื้อให้พนักงานทั้งกลุ่ม) เป็นสินค้าคนละตัวกับแบบรายบุคคลข้างบนทั้งหมด",
    "- รายละเอียดทั้งหมด **มีอยู่ในระบบ** ถ้าลูกค้าถามเรื่องประกันกลุ่มแต่ไม่เห็นหัวข้อเต็มด้านล่าง ให้ถามกลับว่าสนใจประกันสุขภาพกลุ่มหรืออุบัติเหตุกลุ่ม — ห้ามบอกว่าไม่มีในระบบ และห้ามตอบด้วยข้อมูลของแบบรายบุคคล",
  ].join("\n");
}

/**
 * The spine — opened by a question about a company's staff.
 *
 * The refusal to price is written three ways on purpose: as a rule, as what to do instead,
 * and as what to ask the customer for. A single "ห้ามคิดเบี้ย" was not enough in this
 * system's other prompts; a model told only what not to do finds something adjacent to do
 * instead, which for a premium means an estimate.
 */
export function groupSpine(): string {
  const products = PRODUCTS.map(({ product, name, rider }) => {
    const { min, max } = PRODUCT_LIMITS[product];
    return `- **${name}** — รับ ${fmt(min)}–${fmt(max)} คน · 6 แผน (แผน 1 ต่ำสุด → แผน 6 สูงสุด) · พ่วงสัญญาเพิ่มเติมได้ 1 ตัวคือ ${rider} ซึ่งสูงกว่าแผนหลักได้ไม่เกิน 1 แผน`;
  }).join("\n");

  return [
    "## ประกันภัยกลุ่ม (Group Insurance) — ประกันสำหรับองค์กร ไม่ใช่รายบุคคล",
    "",
    "สินค้าคนละตัวกับแบบประกันชีวิต/สุขภาพรายบุคคลข้างบนทั้งหมด **ห้ามสับสนกัน** — บริษัท/ห้างร้าน/โรงงาน ซื้อให้พนักงานทั้งกลุ่ม ไม่ใช่บุคคลซื้อให้ตัวเอง",
    "",
    "### มีให้เลือก 2 ตัว",
    products,
    "",
    "### ลักษณะธุรกิจ (ตัวที่กำหนดอัตราเบี้ย)",
    riskClasses(),
    "",
    "### เงื่อนไขการรับประกัน",
    `- ${t("ageRange")}: ${t("ageDetail")}`,
    `- ${t("coverageStart")}: ${t("coverageStartDetail")}`,
    /**
     * Named as a payment floor, with the word เบี้ย kept away from the figure.
     *
     * The rate sheet writes it "เบี้ยประกันภัย รวมขั้นต่ำ: ไม่ต่ำกว่า 3,000 บาท/กลุ่ม", which
     * puts เบี้ย and a baht figure in one breath — and a model that finds that in its prompt
     * has been handed a premium to read out. The life plans' `minMonthlyTotal` was written
     * out of the same trap and words it the same way; a test in `assistant-answer` presses
     * both.
     */
    "- ยอดชำระขั้นต่ำต่อกลุ่ม รวมทุกคนทุกแผน (เป็นข้อจำกัดการชำระ ไม่ใช่ราคาของแผนใดแผนหนึ่ง): 3,000 บาท",
    `- ${t("paymentMethod")}: ${t("paymentDetail")}`,
    "",
    "### เรื่องเบี้ย — อ่านให้ครบก่อนตอบ",
    "- **แชทนี้คิดเบี้ยประกันกลุ่มให้ไม่ได้** ห้ามบอกตัวเลข ห้ามประมาณ ห้ามสมมติตัวเลขขึ้นมา แม้ลูกค้าจะยืนยันขอก็ตาม",
    "- ให้ชี้ไปที่หน้า **/group-insurance** ซึ่งคิดจากตารางจริง และออกใบเสนอราคาให้ได้ทันที",
    "- ถ้าลูกค้าอยากรู้ราคา ให้ขอ 3 อย่างนี้ไปให้ตัวแทน: ลักษณะธุรกิจ, จำนวนพนักงาน, แผนที่สนใจ",
    "- เหตุผลที่เดาไม่ได้: อัตราขึ้นกับ**จำนวนคนรวมทั้งใบเสนอราคา** ไม่ใช่จำนวนคนของแต่ละกลุ่มย่อย คนยิ่งมากยิ่งถูกต่อหัว — กฎนี้อ่านจากตารางไม่ได้",
    "- ตารางผลประโยชน์เต็ม (วงเงินคุ้มครองทุกแผน) **มีอยู่ในระบบ** ถ้าลูกค้าขอดูแต่ไม่เห็นตารางด้านล่าง ให้บอกว่า “ขอดูได้ครับ ระบุว่าประกันสุขภาพกลุ่มหรืออุบัติเหตุกลุ่ม” — ห้ามบอกว่าไม่มีในระบบ",
  ].join("\n");
}

/** One product's benefit table, as the rate sheet writes it: six plan levels across. */
function benefitTable(product: Product): string {
  const isPa = product === "pa";
  const meta = PRODUCTS.find((p) => p.product === product)!;
  const rows = isPa ? GI.paMainBenefits : GI.healthBenefits;

  const lines = [`### ${meta.name} — วงเงินคุ้มครอง (บาท) แผน 1 → แผน 6`];
  for (const row of rows) {
    // health's OPD line is the rider's, not the main plan's, and is labelled so
    const isRider = row.key === "hOpdPerVisit";
    lines.push(`- ${isRider ? "[สัญญาเพิ่มเติม OPD] " : ""}${row.label}: ${row.values.join(" / ")}`);
  }
  if (isPa) {
    lines.push(`- [สัญญาเพิ่มเติม ME] ${t("mePlan")} วงเงินต่ออุบัติเหตุ: ${GI.paMeCoverLevels.join(" / ")}`);
    lines.push(`- ${t("applicantCount")}: ${t("applicantDetail")}`);
  }
  lines.push("- วงเงินตามกรมธรรม์จริง ห้ามสรุปหรือปัดตัวเลขเอง และตัวเลขเหล่านี้คือ**ความคุ้มครอง ไม่ใช่เบี้ย**");
  return lines.join("\n");
}

/**
 * Which product's table this question opens.
 *
 * A group question first, and that is not belt-and-braces: "ประกันสุขภาพมีไหม" names health
 * and is about one person, so matching the product alone would hand an individual customer
 * the group sheet — the mirror of the fault this whole file was written to close.
 *
 * Then named outright. "ประกันกลุ่มมีอะไรบ้าง" opens neither table and is answered by the
 * spine, which is what that question is actually asking; both named is both, because that
 * question is the comparison.
 */
export function groupTablesFor(question: string): Product[] {
  if (!question || !aboutAGroup(question)) return [];
  const wants: Product[] = [];
  if (/สุขภาพ|ค่าห้อง|ค่ารักษา|ipd|opd|ผู้ป่วยใน|ผู้ป่วยนอก|นอนโรงพยาบาล|health/i.test(question)) wants.push("health");
  if (/อุบัติเหตุ|\bpa\b|\bme\b|สูญเสียอวัยวะ|ทุพพลภาพ/i.test(question)) wants.push("pa");
  return wants;
}

/**
 * As much of this as the question earned.
 *
 * The pointer alone for a question about somebody's own life cover; the spine once the
 * question is about a company's staff — decided by the same `aboutAGroup` that routed it
 * here, so the block and the road cannot disagree about what a group question is; the tables
 * on top of that when the question says which of the two products it means.
 *
 * `question` empty means "everything", which is what the test suite and any future audit of
 * the knowledge want to see.
 */
export function groupSection(question = ""): string {
  if (!question) return [groupSpine(), "", benefitTable("health"), "", benefitTable("pa")].join("\n");
  if (!aboutAGroup(question)) return groupPointer();
  const tables = groupTablesFor(question);
  return [groupSpine(), ...(tables.length ? ["", ...tables.map(benefitTable)] : [])].join("\n");
}
