import type { Reply } from "./common";

/** The two things this page sells, as the session records which one a customer came for. */
export type Product = "lifeprotect" | "ihealthy";

/**
 * A plan named outright — the only signal strong enough to move a conversation already under
 * way. "ประกันสุขภาพ" is that; a bare "สุขภาพ" is not, because a customer buying life cover is
 * asked to declare their health and then asks about the declaration.
 */
const NAMES: [Product, RegExp][] = [
  ["ihealthy", /ประกันสุขภาพ|ไอเฮลท์ตี้|ไอเฮลตี้|i\s*-?\s*healthy/i],
  ["lifeprotect", /life\s*protect|ไลฟ์\s*โพรเทค|ไลฟ์โปรเทค|ประกันชีวิต|ประกันมรดก|มรดก/i],
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
  ["lifeprotect", /ทุน\s*\d|ทุนประกัน|\d+\s*ล้าน|\d+\s*แสน|(?:จ่าย|ชำระ)\s*(?:เบี้ย)?\s*\d+\s*ปี|อายุ\s*99|เวนคืน|เสียชีวิต|มรดก/i],
];

/** The subject of a message, when only one of the two recognises it. */
export function productByTopic(text: string): Product | undefined {
  const found = TOPICS.filter(([, re]) => re.test(text));
  return found.length === 1 ? found[0][0] : undefined;
}

/**
 * The words on the two buttons.
 *
 * A tapped button arrives as its own title, so each one has to be a message `productNamedIn`
 * reads back — which is why they say the plans' names rather than "อันแรก" and "อันที่สอง".
 */
export const CHOOSE_HEALTH = "🏥 ประกันสุขภาพ";
export const CHOOSE_LIFE = "🛡️ Life Protect x 2";

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
    ? [{ text: lead }, { text: "สนใจแบบไหนครับ" }]
    : [{ text: "สวัสดีครับ 🙏 สนใจแบบไหนครับ" }];
  return { messages, replies: [CHOOSE_HEALTH, CHOOSE_LIFE] };
}
