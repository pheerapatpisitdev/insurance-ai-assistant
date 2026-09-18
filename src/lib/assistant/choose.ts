import type { Reply } from "./common";
import { getPlan } from "@/calc/plans/registry";
import { getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange } from "@/calc/bundles/quote";
import { baseAgeRange } from "@/calc/rules";
import { iHealthyTable } from "@/lib/ihealthy-table";

/** The bundle the มรดก door opens on, by the code the registry knows it as. */
const LEGACY_FAMILY = "LEGACY_FAMILY";

/** What this page sells, as the session records which one a customer came for. */
export type Product = "lifeprotect" | "ihealthy" | "legacy" | "ishield";

/**
 * A plan named outright — the only signal strong enough to move a conversation already under
 * way. "ประกันสุขภาพ" is that; a bare "สุขภาพ" is not, because a customer buying life cover is
 * asked to declare their health and then asks about the declaration.
 *
 * The English words are here because an m.me link carries one: `?ref=legacy` arrives as the
 * whole of the customer's first message, and a ref the reader does not know fails the way
 * every silent failure does — the customer is asked which plan, exactly as if the link had
 * never been set. Three of the four already answered to their own English name; this one had
 * none, so it has one. Whatever /admin/ads offers to copy has to be a word this list knows.
 */
const NAMES: [Product, RegExp][] = [
  ["ihealthy", /ประกันสุขภาพ|ไอเฮลท์ตี้|ไอเฮลตี้|i\s*-?\s*healthy/i],
  ["legacy", /เบี้ยทิ้ง|มรดกเพื่อครอบครัว|มรดก\s*\+\s*โรคร้าย|\blegacy\b/i],
  ["ishield", /i\s*-?\s*shield|ไอ\s*ชิลด์|ออม/i],
  ["lifeprotect", /life\s*protect|ไลฟ์\s*โพรเทค|ไลฟ์โปรเทค|ประกันชีวิต|เบี้ยไม่ทิ้ง/i],
];

/**
 * What a message is about when it says so in as many words, or nothing when it says neither —
 * or both, which is a question about the difference and belongs to whoever is already
 * answering rather than to a switch of brains.
 */
export function productNamedIn(text: string): Product | undefined {
  const named = NAMES.filter(([, re]) => re.test(text));
  return named.length === 1 ? named[0][0] : undefined;
}

/**
 * What a message is about from its subject alone.
 *
 * Weaker than a name, and only ever consulted before a conversation has settled on a plan: a
 * customer three turns into a health quote who asks "ทุนเท่าไหร่" means the sum on the base
 * contract under it, not a change of subject.
 */
const TOPICS: [Product, RegExp][] = [
  ["ihealthy", /ค่ารักษา|ค่าห้อง|เหมาจ่าย|ค่าหมอ|ผู้ป่วยใน|ผู้ป่วยนอก|\bopd\b|\bipd\b|แอดมิท|นอนโรงพยาบาล|นอน\s*รพ|ค่าผ่าตัด|วงเงินค่ารักษา/i],
  ["lifeprotect", /ทุน\s*\d|ทุนประกัน|\d+\s*ล้าน|\d+\s*แสน|(?:จ่าย|ชำระ)\s*(?:เบี้ย)?\s*\d+\s*ปี|อายุ\s*99|เวนคืน|เสียชีวิต/i],
];

/** The subject of a message, when only one of the two recognises it. */
export function productByTopic(text: string): Product | undefined {
  const found = TOPICS.filter(([, re]) => re.test(text));
  return found.length === 1 ? found[0][0] : undefined;
}

/**
 * The words on the buttons.
 *
 * A tapped button arrives as its own title, so each one has to be a message `productNamedIn`
 * reads back — which is why they say what the plan is rather than "อันแรก" and "อันที่สอง".
 *
 * Twenty characters is the whole budget: Messenger cuts a longer title without saying so, and
 * "🛡 มรดกเบี้ยทิ้ง+โรคร้ายแรง" arrives in the inbox as "🛡 มรดกเบี้ยทิ้ง+โร". What the two
 * arrangements actually are is said in the message above them, which has no such limit.
 */
export const CHOOSE_HEALTH = "🏥 ประกันสุขภาพ";
export const CHOOSE_LIFE = "💰 มรดกเบี้ยไม่ทิ้ง";
export const CHOOSE_LEGACY = "🛡 มรดก+โรคร้ายแรง";
export const CHOOSE_ISHIELD = "🌱 มรดก+ออม+โรคร้าย";

/** Longer than this and Messenger truncates the title mid-word. */
export const MAX_BUTTON = 20;

/**
 * What the customer is choosing between, said before they are asked to choose.
 *
 * The buttons cannot carry it — twenty characters each — and a customer asked "สนใจแบบไหนครับ"
 * under four names they have never seen is being asked to guess. Each one gets a sentence.
 *
 * The heading no longer says มรดก. Three of these are, and the fourth is the opposite half of
 * a person's life — money for the family after, against the bills while you are still here —
 * so a heading that called all four a legacy would be wrong about the one that is not.
 */
const DOORS: { product: Product; title: string; line: string }[] = [
  {
    product: "lifeprotect",
    title: CHOOSE_LIFE,
    line: "💰 มรดก เบี้ยไม่ทิ้ง — จ่ายแล้วสะสมเป็นเงินก้อน เลิกกลางทางได้เงินคืน",
  },
  {
    product: "legacy",
    title: CHOOSE_LEGACY,
    line: "🛡 มรดก เบี้ยทิ้ง + โรคร้ายแรง — วงเงินใหญ่ เบี้ยเบา เจอโรคร้ายรับเงินสดก้อนโต",
  },
  {
    product: "ishield",
    title: CHOOSE_ISHIELD,
    line: "🌱 มรดก + ออม + โรคร้ายแรง — จ่ายสั้น 5–20 ปี อยู่ถึง 85 รับเงินคืนเต็มจำนวน",
  },
  {
    product: "ihealthy",
    title: CHOOSE_HEALTH,
    line: "🏥 ประกันสุขภาพ — ค่าห้อง ค่าหมอ ค่ารักษา ทุกครั้งที่นอนโรงพยาบาล",
  },
];

const HEADING = "สวัสดีครับ 🙏 ที่ผมดูแลมี 4 แบบครับ";

export const CHOICES = [HEADING, ...DOORS.map((d) => d.line)].join("\n");

/**
 * The ages each arrangement is actually issued at, read from the plans themselves.
 *
 * Written down nowhere: the life contract's own table, the bundle's narrowest rider, the four
 * paying terms of the third, and the health contract's table. A number typed here would be a
 * number to keep in step with four files that already know.
 */
const ISHIELD_TERMS = ["WLCI05", "WLCI10", "WLCI15", "WLCI20"];
const ANY_AGE = { min: 0, max: 99 };

function issuedAt(product: Product): { min: number; max: number } {
  if (product === "ihealthy") {
    const t = iHealthyTable();
    return { min: t.ageMin, max: t.ageMax };
  }
  if (product === "legacy") {
    const bundle = getBundle(LEGACY_FAMILY);
    return bundle ? bundleAgeRange(bundle) : ANY_AGE;
  }
  if (product === "ishield") {
    const plan = getPlan("ISHIELD");
    if (!plan) return ANY_AGE;
    const spans = ISHIELD_TERMS.map((v) => baseAgeRange(plan.rules, v, plan.rates));
    return { min: Math.min(...spans.map((s) => s.min)), max: Math.max(...spans.map((s) => s.max)) };
  }
  const plan = getPlan("LIFEPROTECT");
  return plan ? baseAgeRange(plan.rules, "WLF99H", plan.rates) : ANY_AGE;
}

/** Whether this arrangement can be sold to someone of that age at all. */
export function takesAge(product: Product, age: number): boolean {
  const { min, max } = issuedAt(product);
  return age >= min && age <= max;
}

/**
 * The one question the bot asks before it knows what it is selling.
 *
 * Only when the message itself says nothing: the adverts open with buttons that name the plan
 * and most customers type a sum or a symptom, and a lead the campaign paid for should not have
 * to tap twice to be answered.
 *
 * The age narrows it where one is known. A man of sixty-eight wrote his age and then "ขอดูทั้ง
 * 2 แบบ", and was shown all four twice — two of which no company would have issued him. Four
 * doors, two of them painted on, is a worse answer than two doors.
 */
export function askWhich(lead?: string, age?: number): Reply {
  const open = age === undefined ? DOORS : DOORS.filter((d) => takesAge(d.product, age));

  /**
   * Nothing on the shelf reaches them.
   *
   * Above eighty every one of these refuses, and a menu of four arrangements is then four
   * wasted taps ending in four refusals. The agency sells more than the bot prices, so this
   * is a person's job and the bot says so rather than pretending.
   */
  if (age !== undefined && !open.length) {
    const text = `อายุ ${age} ปี แบบที่ผมคิดเบี้ยให้ได้ในแชทนี้ยังไม่มีครับ 🙏`
      + "\nเดี๋ยวตัวแทนมาดูให้ว่ามีแบบไหนที่ยังสมัครได้บ้าง ทิ้งคำถามไว้ได้เลยครับ";
    return { messages: lead ? [{ text: lead }, { text }] : [{ text }] };
  }

  const shown = open;
  const heading = shown.length < DOORS.length
    ? `อายุ ${age} ปี สมัครได้ ${shown.length} แบบนี้ครับ 🙏`
    : HEADING;
  const asked = [heading, ...shown.map((d) => d.line)].join("\n");

  // a customer who asked something first is answered first: "ของอะไร" met with "สนใจแบบไหนครับ"
  // is a question answered with a question, which is how it read in the inbox
  const messages = lead
    ? [{ text: lead }, { text: `${asked}\n\nสนใจแบบไหนครับ` }]
    : [{ text: `${asked}\n\nสนใจแบบไหนครับ` }];
  return { messages, replies: shown.map((d) => d.title) };
}

/**
 * What is said instead of the same menu a second time.
 *
 * The four doors answered twice in a row is a dead end: the customer did not choose, and
 * nothing about repeating the list makes the choice easier. The agency watches this inbox, so
 * the second time the bot says so — and leaves the buttons up, because some customers were
 * only scrolling.
 */
export function askWhichAgain(age?: number): Reply {
  const again = askWhich(undefined, age);
  return {
    messages: [{
      text: "เลือกไม่ถูกไม่เป็นไรครับ 🙏 บอกมาคร่าวๆ ก็ได้ว่าอยากได้แบบไหน"
        + " — เก็บเงินไว้ให้ครอบครัว หรือค่ารักษาตอนนอนโรงพยาบาล"
        + "\nหรือจะให้ตัวแทนช่วยแนะนำก็ได้ครับ เดี๋ยวมีคนมาตอบในแชทนี้",
    }],
    replies: again.replies,
  };
}
