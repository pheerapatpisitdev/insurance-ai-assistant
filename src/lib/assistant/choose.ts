import type { Reply } from "./common";

/** What this page sells, as the session records which one a customer came for. */
export type Product = "lifeprotect" | "ihealthy" | "legacy" | "ishield";

/**
 * A plan named outright — the only signal strong enough to move a conversation already under
 * way. "ประกันสุขภาพ" is that; a bare "สุขภาพ" is not, because a customer buying life cover is
 * asked to declare their health and then asks about the declaration.
 */
const NAMES: [Product, RegExp][] = [
  ["ihealthy", /ประกันสุขภาพ|ไอเฮลท์ตี้|ไอเฮลตี้|i\s*-?\s*healthy/i],
  ["legacy", /เบี้ยทิ้ง|มรดกเพื่อครอบครัว|มรดก\s*\+\s*โรคร้าย/i],
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
/**
 * The health plan keeps its name and loses its button.
 *
 * The advertising sells the two legacies, so those are what the buttons offer — a third
 * choice in front of a lead paid for by a legacy advertisement is a way of losing it. The
 * brain behind this name is untouched and still answers: a customer who types "ค่าห้อง
 * เท่าไหร่" is routed to it exactly as before. Nobody is being shown the door, only not
 * shown the button.
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
 * under two names they have never seen is being asked to guess. The difference between the two
 * is one sentence apiece, so it is given.
 */
export const CHOICES = [
  "สวัสดีครับ 🙏 มรดกที่ทิ้งไว้ให้ครอบครัว เลือกได้ 3 แบบครับ",
  "💰 เบี้ยไม่ทิ้ง — จ่ายแล้วสะสมเป็นเงินก้อน เลิกกลางทางได้เงินคืน",
  "🛡 เบี้ยทิ้ง + โรคร้ายแรง — วงเงินใหญ่ เบี้ยเบา เจอโรคร้ายรับเงินสดก้อนโต",
  "🌱 ออม + โรคร้ายแรง — จ่ายสั้น 5–20 ปี อยู่ถึง 85 รับเงินคืนเต็มจำนวน",
].join("\n");

/**
 * The one question the bot asks before it knows what it is selling.
 *
 * Only when the message itself says nothing: the adverts open with buttons that name the plan
 * and most customers type a sum or a symptom, and a lead the campaign paid for should not have
 * to tap twice to be answered.
 */
export function askWhich(lead?: string): Reply {
  // a customer who asked something first is answered first: "ของอะไร" met with "สนใจแบบไหนครับ"
  // is a question answered with a question, which is how it read in the inbox
  const messages = lead
    ? [{ text: lead }, { text: `${CHOICES}\n\nสนใจแบบไหนครับ` }]
    : [{ text: `${CHOICES}\n\nสนใจแบบไหนครับ` }];
  return { messages, replies: [CHOOSE_LIFE, CHOOSE_LEGACY, CHOOSE_ISHIELD] };
}
