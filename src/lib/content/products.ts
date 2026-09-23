import type { Sex } from "@/calc/types";
import { cancerTable } from "@/lib/cancer-table";
import { ci123Table } from "@/lib/ci123-table";
import { sumWords } from "@/lib/ci123-cta";
import { easyProtectFacts } from "@/lib/easyprotect-facts";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { iShieldFacts } from "@/lib/ishield-facts";
import { legacyFacts } from "@/lib/legacy-facts";
import { perDay } from "@/lib/legacy-cta";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { lifeTreasureFacts } from "@/lib/lifetreasure-facts";
import { pensionFacts } from "@/lib/pension-facts";
import { plbFacts } from "@/lib/plb-facts";

/**
 * What the content generator may say about each product, and nothing else.
 *
 * The selling points are the sales pages' own sentences, lifted so a post says what the page
 * it links to says. They are words only: every figure is read from the same `*Facts()` the
 * page renders from, so a post and its page cannot disagree, and a lapsed rate table silences
 * the post's prices exactly as it silences the page's.
 *
 * Group insurance is absent on purpose. The owner sells it across a table, with a person in
 * the conversation, and the chat is already forbidden to describe it; an advertisement written
 * by a model would be the same description by another door.
 */

export interface Figures {
  /** the rate table has lapsed: no price may be shown */
  expired: boolean;
  rateVersion: string | null;
  /** what the product is: ages, sums, benefits — safe to say whatever the rate table's state */
  facts: string[];
  /** premiums and anything read off them; dropped whole when `expired` */
  prices: string[];
}

export interface ContentProduct {
  href: string;
  name: string;
  kind: string;
  audience: string;
  points: string[];
  /** what the page itself is careful about; the post must be no less careful */
  cautions: string[];
  figures: (today: Date) => Figures;
}

const sexWord = (s: Sex) => (s === "F" ? "ผู้หญิง" : "ผู้ชาย");
const baht = (n: number) => n.toLocaleString("en-US");
/** a bundle table's premiums are in satang: [annual, semi-annual, monthly, …] */
const annualBaht = (satang: number) => baht(Math.round(satang / 100));

export const CONTENT_PRODUCTS: ContentProduct[] = [
  {
    href: "/lifeprotect",
    name: "Life Protect x 2",
    kind: "ประกันชีวิตตลอดชีพ",
    audience: "คนที่ยังมีภาระ ลูกยังเรียน บ้านยังผ่อน — ช่วงที่ครอบครัวขาดเขาไม่ได้ และพ่อแม่ที่อยากซื้อให้ลูก",
    points: [
      "ถ้าพรุ่งนี้ไม่มีคุณ บ้านนี้ไปต่อได้ไหม",
      "จ่ายเป็นสองเท่าของทุนในช่วงที่ครอบครัวต้องพึ่งมากที่สุด",
      "เบี้ยเท่าเดิมทุกปี และจ่ายจบได้ใน 9 หรือ 19 ปี (หรือจ่ายถึงอายุ 99)",
      "หลังช่วงทุนสองเท่า ความคุ้มครองยังอยู่ต่อจนสิ้นสัญญา ไม่ใช่จ่ายทิ้ง",
    ],
    cautions: [
      "ทุนสองเท่าได้เฉพาะเสียชีวิตก่อนอายุที่กำหนด เริ่มทำตอนอายุถึงเกณฑ์นั้นแล้วจะไม่ได้สองเท่า",
      "เบี้ยที่แสดงเป็นเบี้ยมาตรฐานโดยประมาณ ไม่ใช่ใบเสนอราคา",
    ],
    figures: (today) => {
      const f = lifeProtectFacts(today);
      const prices: string[] = [];
      const facts = [
        `- รับอายุ ${f.ageMin}–${f.ageMax} ปี · คุ้มครองถึงอายุ ${f.coverToAge} · ทุนสองเท่าถ้าเสียชีวิตก่อนอายุ ${f.boosterBeforeAge}`,
        `- ตัวอย่างทุนสองเท่า: ทุน ${f.double.sum} บาท ครอบครัวได้ ${f.double.before} บาท`,
      ];
      if (f.fromPerDay !== null) {
        prices.push(`- เริ่มต้น: ผู้หญิงอายุ ${f.fromAge} ทุน ${f.fromSum} บาท (คุ้มครอง ${f.fromDouble} บาท) เบี้ยเฉลี่ยวันละ ${f.fromPerDay} บาท`);
      }
      for (const t of f.example.terms) {
        if (t.premium) prices.push(`- ${sexWord(f.example.sex)}อายุ ${f.example.age} ทุน ${f.example.sum} บาท ${t.label}: เบี้ย ${t.premium} บาท${t.per} รวมทั้งสัญญา ${t.total} บาท`);
      }
      if (f.newborn.premium) {
        prices.push(`- ซื้อให้ลูกแรกเกิด: ทุน ${f.newborn.sum} บาท (คุ้มครอง ${f.newborn.double} บาท) ${f.newborn.termLabel} เบี้ย ${f.newborn.premium} บาท${f.newborn.per}`);
      }
      return { expired: f.expired, rateVersion: f.rateVersion, facts, prices };
    },
  },
  {
    href: "/plb",
    name: "Protection Life",
    kind: "ประกันชีวิตแบบกำหนดระยะเวลา",
    audience: "ครอบครัวในช่วงผ่อนบ้านและส่งลูกเรียน ที่อยากได้ทุนก้อนใหญ่ในงบที่จ่ายไหว",
    points: [
      "หนี้บ้านอีกสิบกว่าปี ลูกอีกหลายปีกว่าจะจบ ช่วงนี้แหละที่ต้องมีทุนให้พอ",
      "ซื้อทุนก้อนใหญ่ด้วยเบี้ยต่ำ เสียชีวิตระหว่างสัญญา ครอบครัวรับเต็มทุน",
      "เลือกคุ้มครอง 5 10 12 หรือ 15 ปี ให้ตรงกับภาระ",
      "ทุนยิ่งสูง เบี้ยต่อล้านยิ่งถูก",
      "เบี้ยเท่าเดิมทุกปี จ่ายมีวันจบ",
    ],
    cautions: [
      "อยู่ครบสัญญาแล้วไม่มีเงินคืน — ไม่เหมาะกับคนที่อยากได้เงินออม",
      "ไม่ใช่ประกันโรคร้ายแรงหรือค่ารักษา",
      "ต่ออายุใหม่หลังครบสัญญา เบี้ยคิดตามอายุใหม่",
    ],
    figures: (today) => {
      const f = plbFacts(today);
      const prices: string[] = [];
      const facts = [
        `- รับอายุ ${f.ageMin}–${f.ageMax} ปี · ทุน ${f.saMin}–${f.saMax} บาท`,
      ];
      prices.push(`- ส่วนลดทุนสูงสุด ${f.discount.perThousand} บาทต่อทุนพัน เมื่อทุนตั้งแต่ ${f.discount.fromSum} บาท`);
      if (f.from.perDay !== null) {
        prices.push(`- เริ่มต้น: ${f.from.sexWord}อายุ ${f.from.age} ทุน ${f.from.sum} บาท ${f.from.termShort} เบี้ยเฉลี่ยวันละ ${f.from.perDay} บาท`);
      }
      for (const t of f.example.terms) {
        if (t.premium) prices.push(`- ${sexWord(f.example.sex)}อายุ ${f.example.age} ทุน ${f.example.sum} บาท ${t.label} (คุ้มครองถึงอายุ ${t.endsAtAge}): เบี้ย ${t.premium} บาท${t.per}`);
      }
      if (f.scale?.savedPercent) prices.push(`- ทุน ${f.scale.big.sum} เทียบทุน ${f.scale.small.sum} (${f.scale.termLabel}): เบี้ยต่อล้านถูกลงราว ${f.scale.savedPercent}%`);
      return { expired: f.expired, rateVersion: f.rateVersion, facts, prices };
    },
  },
  {
    href: "/easyprotect",
    name: "อีซี่ โพรเทค 6 (Easy Protect 6)",
    kind: "ประกันชีวิตตลอดชีพ จ่ายเบี้ยสั้น",
    audience: "คนที่รายได้ดีช่วงนี้ แต่ไม่อยากผูกรายจ่ายยาวไปถึงวัยเกษียณ",
    points: [
      "คนส่วนใหญ่ไม่ได้กลัวเบี้ยแพง แต่กลัวว่าต้องจ่ายไปอีกนานแค่ไหน",
      "จ่ายเบี้ยแค่ 6 ปี แล้วคุ้มครองยาวตลอดชีพ",
      "มูลค่าเวนคืนโตขึ้นทุกปี เงินไม่ได้หายไปกับเบี้ย",
      "เบี้ยล็อกตามอายุวันที่ทำ",
    ],
    cautions: [
      "สัญญาเพิ่มเติมเป็นรายปี ต้องต่อและจ่ายแยก",
      "เบี้ยที่แสดงเป็นเบี้ยมาตรฐาน ไม่ใช่ใบเสนอราคา",
    ],
    figures: (today) => {
      const f = easyProtectFacts(today);
      const prices: string[] = [];
      const facts = [
        `- รับอายุ ${f.ageMin}–${f.ageMax} ปี · จ่ายเบี้ย ${f.payYears} ปี · คุ้มครองถึงอายุ ${f.coverToAge} · ทุน ${f.saMin}–${f.saMax} บาท`,
        `- เสียชีวิต ได้อย่างน้อย ${f.premiumFloorPercent}% ของเบี้ยที่จ่ายมาแล้วเสมอ`,
      ];
      if (f.from.premium) prices.push(`- เริ่มต้น: ${sexWord(f.from.sex)}อายุ ${f.from.age} เบี้ย ${f.from.premium} บาท${f.from.per}`);
      for (const a of f.example.ages) {
        if (a.premium) prices.push(`- ${sexWord(f.example.sex)}อายุ ${a.age} ทุน ${f.example.sum} บาท: เบี้ย ${a.premium} บาท${a.per} รวม ${f.payYears} ปี ${a.total} บาท`);
      }
      if (f.growth?.breakEvenAge) prices.push(`- ตัวอย่างอายุ ${f.growth.age}: มูลค่าเวนคืนแซงเบี้ยที่จ่ายเมื่ออายุ ${f.growth.breakEvenAge}`);
      return { expired: f.expired, rateVersion: f.rateVersion, facts, prices };
    },
  },
  {
    href: "/lifetreasure",
    name: "ไลฟ์เทรเชอร์ (Life Treasure)",
    kind: "ประกันชีวิตตลอดชีพเพื่อการส่งต่อมรดก",
    audience: "คนที่มีทรัพย์สินเป็นที่ดิน ธุรกิจ หรือหุ้น และอยากเตรียมเงินสดก้อนไว้ส่งต่อ",
    points: [
      "มรดกส่วนใหญ่ไม่ได้อยู่ในรูปเงินสด วันที่ต้องใช้ มันขายไม่ทัน",
      "เปลี่ยนเบี้ยที่จ่ายเป็นเงินก้อนที่ระบุจำนวนไว้ล่วงหน้า ไม่ขึ้นกับตลาด",
      "เงินก้อนพร้อมใช้ในวันแรก แบ่งให้ใครเท่าไรระบุได้",
    ],
    cautions: [
      "ออกแบบมาเพื่อส่งต่อทรัพย์สิน ไม่ใช่ประกันคุ้มครองรายได้ทั่วไป",
      "ชื่อกรมธรรม์จริงคือ ไลฟ์เรดดี้ (ไม่มีเงินปันผล)",
    ],
    figures: (today) => {
      const f = lifeTreasureFacts(today);
      const prices: string[] = [];
      const facts = [
        `- รับอายุ ${f.ageMin}–${f.ageMax} ปี · คุ้มครองถึงอายุ ${f.coverToAge} · ทุน ${f.saMin}–${f.saMax} บาท`,
      ];
      for (const t of f.example.terms) {
        if (t.premium) prices.push(`- ${sexWord(f.example.sex)}อายุ ${f.example.age} ทุน ${f.example.sum} บาท ${t.label}: เบี้ย ${t.premium} บาท${t.per} รวม ${t.total} บาท (ส่งต่อได้ ${t.leverage} เท่าของเบี้ย)`);
      }
      return { expired: f.expired, rateVersion: f.rateVersion, facts, prices };
    },
  },
  {
    href: "/legacy",
    name: "มรดกเพื่อครอบครัว (Family Legacy)",
    kind: "ชุดประกันชีวิต + โรคร้ายแรง (Life Protect x 2 คู่กับสัญญาเพิ่มเติม DCI)",
    audience: "คนที่ลูกยังเรียนไม่จบ บ้านยังผ่อนไม่หมด เงินเก็บมีก้อนเดียว",
    points: [
      "วันที่คุณล้ม ครอบครัวต้องไม่ล้มตาม",
      "ประกันมรดกทั่วไปจ่ายวันที่คุณไม่อยู่ แบบนี้จ่ายตั้งแต่วันที่คุณยังอยู่ — ป่วยโรคร้ายแรงก็ได้เงินก้อน",
      "เตรียมเงินก้อน 1–10 ล้านบาทให้คนข้างหลัง",
    ],
    cautions: [
      "สัญญาเพิ่มเติมโรคร้ายแรงคิดเบี้ยตามอายุ จึงปรับขึ้นทุกปี — ทุกราคาเป็นเบี้ยปีแรก",
      "โรคร้ายแรงมีระยะเวลารอคอย",
    ],
    figures: (today) => {
      const f = legacyFacts(today);
      const prices: string[] = [];
      const facts = [
        `- รับอายุ ${f.ageMin}–${f.ageMax} ปี · คุ้มครองโรคร้ายแรง ${f.diseaseCount} โรค (ถึงอายุ ${f.plan1.endAge})`,
        `- แผน 1 ล้าน: ป่วยโรคร้ายแรงได้เงินสด ${f.plan1.critical} บาท · เสียชีวิตก่อนอายุ 60 ได้ ${f.plan1.before60} บาท`,
      ];
      if (f.fromPerDay !== null) prices.push(`- เริ่มต้น: อายุ ${f.fromAge} แผนเล็กสุด เบี้ยปีแรกเฉลี่ยวันละ ${f.fromPerDay} บาท`);
      if (f.waiting) prices.push(`- เริ่มอายุ ${f.waiting.youngAge} เบี้ยปีแรก ${f.waiting.young} บาท · รอถึงอายุ ${f.waiting.olderAge} เบี้ยปีแรก ${f.waiting.older} บาท`);
      return { expired: f.expired, rateVersion: f.rateVersion, facts, prices };
    },
  },
  {
    href: "/ishield",
    name: "iShield",
    kind: "ประกันชีวิตและโรคร้ายแรงตลอดชีพ",
    audience: "คนที่มีประกันสุขภาพแล้ว แต่ยังไม่มีเงินก้อนไว้ใช้ตอนป่วยหนักแล้วต้องหยุดทำงาน",
    points: [
      "วันที่หมอบอกให้หยุดทำงาน รายได้หยุด แต่รายจ่ายไม่หยุด",
      "จ่ายเป็นเงินก้อน ไม่ใช่ค่าห้องค่ายา — เจอตั้งแต่ระยะเริ่มต้นก็ได้เงิน",
      "เบี้ยเท่าเดิมทุกปี จ่ายจบใน 5 ถึง 20 ปี",
      "ไม่ป่วยเลยก็ไม่เสียเปล่า อยู่ครบสัญญารับคืนเต็มทุน",
    ],
    cautions: [
      "มีระยะเวลารอคอยโรคร้ายแรง",
      "เคลมระยะเริ่มต้นแล้ว ทุนและมูลค่าเวนคืนลดลงตามส่วน",
      "ไม่จ่ายค่ารักษาพยาบาล",
    ],
    figures: (today) => {
      const f = iShieldFacts(today);
      const i = f.illness;
      const prices: string[] = [];
      const facts = [
        `- รับอายุ ${f.ageMin}–${f.ageMax} ปี · คุ้มครองถึงอายุ ${f.maturityAge} · ทุน ${f.saMin}–${f.saMax} บาท`,
        `- คุ้มครอง ${f.illnessTotal} โรค: ระยะเริ่มต้น ${i.earlyCount} โรค รับ ${i.earlyPercent}% ของทุน · ระยะรุนแรง ${i.majorCount} โรค รับ ${i.majorPercent}% · รอคอย ${i.waitingDays} วัน`,
      ];
      if (f.fromPerDay !== null) prices.push(`- เริ่มต้น: อายุ ${f.fromAge} ทุน ${f.fromSum} บาท เบี้ยเฉลี่ยวันละ ${f.fromPerDay} บาท`);
      for (const t of f.example.terms) {
        if (t.premium) prices.push(`- ${sexWord(f.example.sex)}อายุ ${f.example.age} ทุน ${f.example.sum} บาท ${t.label}: เบี้ย ${t.premium} บาท${t.per} รวม ${t.total} บาท`);
      }
      return { expired: f.expired, rateVersion: f.rateVersion, facts, prices };
    },
  },
  {
    href: "/ci123",
    name: "CI 123",
    kind: "ประกันโรคร้ายแรงจ่ายตามระยะ (สัญญาเพิ่มเติม คู่กับ Life Protect x 2)",
    audience: "คนที่อยากได้เงินก้อนตั้งแต่เจอโรคร้ายระยะแรก รวมถึงพ่อแม่ที่ซื้อให้ลูก",
    points: [
      "เจอเร็ว ก็ได้เงินเร็ว ไม่ต้องรอให้ถึงระยะรุนแรง",
      "ประกันโรคร้ายแรงทั่วไปจ่ายเมื่อถึงระยะรุนแรง CI 123 จ่ายตั้งแต่ระยะแรก",
      "เคลมระยะแรกแล้ว ยังเคลมระยะถัดไปได้อีก",
    ],
    cautions: [
      "เบี้ยส่วน CI 123 คิดตามอายุจริง ปรับขึ้นเมื่ออายุมากขึ้น — ทุกราคาเป็นเบี้ยปีแรก",
      "ระยะเวลารอคอย 90 วัน · เคลมระยะรุนแรงแล้วสัญญาสิ้นสุด",
    ],
    figures: (today) => {
      const t = ci123Table(today);
      const prices: string[] = [];
      const facts = [
        `- รับอายุ ${t.ageMin}–${t.ageMax} ปี · คุ้มครอง ${t.diseaseCount} โรค · ทุน CI 123 เลือกได้ ${t.sums.map(sumWords).join(" / ")}`,
        `- คู่กับประกันชีวิต Life Protect x 2 ทุน ${baht(t.baseSum)} บาท`,
      ];
      const at30 = t.premiums.F[0]?.[30 - t.ageMin];
      if (at30) prices.push(`- เริ่มต้น: ผู้หญิงอายุ 30 ทุน CI 123 ${sumWords(t.sums[0])} เบี้ยปีแรกรวม ${annualBaht(at30[0])} บาท เฉลี่ยวันละ ${perDay(at30[0])} บาท`);
      return { expired: t.expired, rateVersion: t.rateVersion, facts, prices };
    },
  },
  {
    href: "/cancer",
    name: "ชุดประกันมะเร็ง (Cancer)",
    kind: "ชุดประกันมะเร็ง: Life Protect x 2 คู่กับสัญญาเพิ่มเติม CPR และ HIC",
    audience: "คนที่มีประกันสุขภาพแล้วแต่อยากได้เงินก้อนตอนเจอมะเร็ง และพ่อแม่ที่ซื้อให้ลูก",
    points: [
      "เจอมะเร็งระยะแรก ก็ได้เงินก้อน ไม่ต้องรอให้ลุกลาม",
      "นอนโรงพยาบาลเพราะมะเร็ง รับเงินชดเชยรายวันเพิ่ม",
      "รายได้หยุด แต่รายจ่ายไม่หยุด — เงินก้อนเอาไปใช้อะไรก็ได้",
    ],
    cautions: [
      "สัญญาเพิ่มเติม CPR และ HIC เป็นรายปี เบี้ยปรับตามอายุ — ทุกราคาเป็นเบี้ยปีแรก",
      "เงินชดเชยรายวันไม่คุ้มครองมะเร็งระยะแรก · โรคที่เป็นมาก่อนอาจถูกยกเว้น",
    ],
    figures: (today) => {
      const t = cancerTable(today);
      const low = t.tiers[0];
      const top = t.tiers[t.tiers.length - 1];
      const prices: string[] = [];
      const facts = [
        `- รับอายุ ${t.ageMin}–${t.ageMax} ปี · ทุนมะเร็ง (CPR) ${sumWords(low.cpr)} ถึง ${sumWords(top.cpr)} · ชดเชยนอนโรงพยาบาลวันละ ${baht(low.hic)}–${baht(top.hic)} บาท`,
      ];
      const at30 = t.premiums.F[0]?.[30 - t.ageMin];
      if (at30) prices.push(`- เริ่มต้น: ผู้หญิงอายุ 30 ทุนมะเร็ง ${sumWords(low.cpr)} เบี้ยปีแรกรวม ${annualBaht(at30[0])} บาท เฉลี่ยวันละ ${perDay(at30[0])} บาท`);
      return { expired: t.expired, rateVersion: t.rateVersion, facts, prices };
    },
  },
  {
    href: "/ihealthy-ultra",
    name: "iHealthy Ultra",
    kind: "ประกันสุขภาพเหมาจ่ายค่ารักษาพยาบาล",
    audience: "คนที่อยากมีวงเงินค่ารักษาสูงไว้ใช้โรงพยาบาลเอกชน",
    points: [
      "ค่ารักษาพยาบาลเหมาจ่ายต่อปี เลือกได้ 6 แผน",
      "ต่ออายุได้ยาวถึงวัยเกษียณและหลังจากนั้น",
      "ไม่เคลมต่อเนื่อง ได้ส่วนลดเบี้ย",
    ],
    cautions: [
      "เบี้ยประกันสุขภาพคิดตามอายุ ปรับขึ้นทุกปี และบริษัทปรับเบี้ยปีต่ออายุได้ — โพสต์นี้ห้ามระบุเบี้ย",
      "มีระยะเวลารอคอย และไม่คุ้มครองโรคที่เป็นมาก่อน",
      "ตอนต่ออายุ บริษัทอาจขอให้ร่วมจ่าย",
    ],
    figures: () => {
      const f = iHealthyFacts();
      const limits = f.plans.map((p) => p.annualMax);
      const prices: string[] = [];
      const facts = [
        `- วงเงินค่ารักษาต่อปี ตั้งแต่ ${baht(Math.min(...limits))} ถึง ${baht(Math.max(...limits))} บาท (${f.plans.length} แผน)`,
        `- ต่ออายุได้ถึงอายุ ${f.terms.renewalToAge} ปี · ระยะเวลารอคอย ${f.terms.waitingDays} วัน`,
        `- ไม่เคลม 3 ปีติดต่อกัน ลดเบี้ย ${f.terms.noClaimDiscountPercent}%`,
      ];
      return { expired: false, rateVersion: null, facts, prices };
    },
  },
  {
    href: "/bumnan95",
    name: "บำนาญ สมาร์ท 95",
    kind: "ประกันบำนาญ ลดหย่อนภาษีได้",
    audience: "คนทำงานที่อยากมีรายได้แน่นอนหลังเกษียณ และอยากลดหย่อนภาษีระหว่างที่ยังทำงาน",
    points: [
      "เงินเดือนหยุดวันเกษียณ ค่าใช้จ่ายไม่ได้หยุดตาม",
      "จ่ายบำนาญให้ทุกปี จนถึงอายุ 95 และรับประกันจ่าย 15 ปีแรก",
      "บำนาญเพิ่มขึ้นเป็นขั้นตามอายุ ได้มากขึ้นในวัยที่ใช้มากขึ้น",
      "จ่ายเบี้ยแค่ 6 ปี หรือจ่ายจนถึงวันเริ่มรับบำนาญ",
      "เบี้ยที่จ่ายนำไปลดหย่อนภาษีได้",
    ],
    cautions: [
      "ลดหย่อนภาษีได้ตามเงื่อนไขกรมสรรพากร มีเพดาน",
      "เสียชีวิตก่อนรับบำนาญ ได้คืนเบี้ยที่จ่ายหรือมูลค่าเวนคืน ไม่ใช่ทุนก้อนใหญ่",
    ],
    figures: () => {
      const f = pensionFacts();
      const q = f.example.quote;
      // a band's percent is stored as a fraction of the sum: 0.15 is fifteen per cent
      const prices: string[] = [];
      const facts = [
        `- รับอายุ ${f.ageMin}–${f.ageMax} ปี · เริ่มรับบำนาญได้ที่อายุ ${f.pensionAges.join(" / ")}`,
        `- บำนาญต่อปีเป็นขั้นตามอายุ: ${q.bands.map((b) => `อายุ ${b.fromAge}–${b.toAge} รับ ${Math.round(b.percent * 100)}% ของทุน`).join(" · ")}`,
      ];
      prices.push(`- ตัวอย่าง: ${sexWord(f.example.sex)}อายุ ${f.example.age} อยากได้บำนาญเดือนละ ${baht(q.monthlyPension)} บาท ตั้งแต่อายุ ${q.plan.annuityStartAge} → ทุน ${baht(q.sumAssured)} บาท เบี้ยปีละ ${baht(q.annualPremium)} บาท จ่าย ${q.payYears} ปี`);
      return { expired: false, rateVersion: f.rateVersion, facts, prices };
    },
  },
];

export function contentProduct(href: string): ContentProduct | undefined {
  return CONTENT_PRODUCTS.find((p) => p.href === href);
}
