import type { ChatMessage } from "@/lib/ai/types";

/**
 * What a bot on this page is, before it is a bot about any particular plan.
 *
 * The shape of a reply, the words a customer hears when they step back or decide to go ahead,
 * and the questions that are answered the same way whatever is being sold — who insures this,
 * is the price negotiable, is the form filled in. All of it was inside the Life Protect brain
 * because there was only one brain. A second one would otherwise have had to answer the same
 * questions in its own words, and two bots in one inbox that word the same answer differently
 * is a customer noticing they are talking to a machine.
 */

/** One message the bot sends, and the picture that follows it. */
export interface Said {
  text: string;
  /** where the quote is drawn as a picture, as a path on this site */
  card?: string;
}

/** A person does not send one long block; the model's paragraphs go out as separate bubbles. */
export const MAX_BUBBLES = 3;

/**
 * Who stands behind the policy, in the agency's own words rather than a model's.
 *
 * The insurer is a constant because the project holds no other record of it, and because a
 * model asked the question agreed with whichever name the customer proposed. Anything about
 * the people — a licence, whether they can be trusted — is not a fact this code has, so it
 * is handed to someone who does.
 */
export const INSURER = "บมจ. กรุงไทย-แอกซ่า ประกันชีวิต";

/**
 * The agents behind the page, as their own licences record them.
 *
 * Only the two fields a customer is entitled to check: the name and the licence number the
 * regulator issued, which an agent is required to show anyway. The national id printed beside
 * them on the same card is deliberately not here — the bot tells customers it never handles
 * one, and it should hold none of its own either.
 */
export const AGENTS = [
  { name: "พีรพัฒฑ์พิสิษฐ์ ทองสีทอง", licence: "6001028534" },
  { name: "ศิวลักษณ์ ทองสีทอง", licence: "6401024117" },
];

export const ABOUT_INSURER = `แบบประกันนี้รับประกันโดย ${INSURER} ครับ 🙏`;

export const ABOUT_AGENTS = [
  "ดูแลโดยตัวแทนที่ได้รับใบอนุญาตจาก คปภ.",
  ...AGENTS.map((a) => `• ${a.name} — ใบอนุญาตเลขที่ ${a.licence}`),
].join("\n");

export const ABOUT_TRUST = "ถ้าอยากคุยรายละเอียดกับตัวแทนโดยตรง เดี๋ยวมีคนมาตอบในแชทนี้ครับ";

/**
 * The answer to a question about who stands behind the policy: the insurer, then the people
 * selling it. Built from constants and never from a model — asked the same question, a model
 * agreed with whichever company name the customer had guessed.
 *
 * It ends there. It used to close by asking for an age and a sex, which reads as not
 * listening to a customer who has already given both — and the question was answered, so
 * there is nothing to add to it.
 */
export function aboutCompany(question: string): string {
  const tail = asksAboutTrust(question) ? ["", ABOUT_TRUST] : [];
  return [ABOUT_INSURER, "", ABOUT_AGENTS, ...tail].join("\n");
}

/**
 * The application form the agency sends a customer who has decided. The `ref` names the
 * agent, so the form arrives already knowing who sold it.
 */
export const APPLICATION_FORM = "https://ktaxaform.vercel.app/?ref=sa-9f3a";

export const FORM_NEXT = "กรอกเสร็จแล้วแจ้งในแชทนี้ได้เลย เดี๋ยวตัวแทนติดต่อกลับไปดูแลขั้นตอนต่อให้ครับ";
export const FORM_RECEIVED = "ขอบคุณครับ 🙏 เดี๋ยวตัวแทนเช็กข้อมูลแล้วติดต่อกลับในแชทนี้ครับ";

export const WANTS_IN = "สนใจสมัคร";

/**
 * Everything an answer is except which plan it was about.
 *
 * The slots are the one part that differs between brains, so each brain adds its own:
 * `type Answer = Reply & { slots: Routed }`.
 */
export interface Reply {
  /**
   * What the bot sends, in the order it sends it.
   *
   * A list rather than one string because a customer pricing a couple — "ผญ 32 ผช33ค่ะ" —
   * is owed a quote each, and two quotes in one bubble is a wall of figures nobody can read
   * back to their partner.
   */
  messages: Said[];
  /** the answer carries a premium — the moment a browser turns into someone worth calling */
  priced?: boolean;
  /**
   * Buttons offered under the last thing sent.
   *
   * A quotation ends with an invitation nobody acts on — it is the last line of twenty, under
   * a picture. The same invitation as a row of buttons is one tap, and a tap arrives as the
   * words themselves, so every title here is a sentence the bot already answers.
   */
  replies?: string[];
}

/** The usual case: the bot says one thing. */
export function one(text: string, card?: string): Reply {
  return { messages: [card ? { text, card } : { text }] };
}

/**
 * A person does not send one long block; the model's paragraphs go out as separate bubbles.
 *
 * The fallback is each brain's own: a health customer told "ขออายุ เพศ กับทุนที่สนใจ" would be
 * asked for something this contract never uses.
 */
export function spoken(text: string, fallback: string): Reply {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return one(fallback);
  if (parts.length <= MAX_BUBBLES) return { messages: parts.map((t) => ({ text: t })) };
  // more than fits: the last bubble carries the rest, so nothing is dropped and none is empty
  const head = parts.slice(0, MAX_BUBBLES - 1);
  const tail = parts.slice(MAX_BUBBLES - 1).join("\n\n");
  return { messages: [...head, tail].map((t) => ({ text: t })) };
}

/**
 * Handing over the form: three bubbles, the link on its own so it is one tap. Someone who
 * asks how to apply before hearing a price is also told the price is a message away — the
 * only time the bot volunteers that, because here it knows nothing has been quoted.
 *
 * `quoted` rather than the slots themselves: what counts as a quote differs between plans
 * (a sum assured on one, a chosen health plan on the other) and neither answer differs.
 */
export function handOverForm(quoted: boolean): Reply {
  const next = quoted ? FORM_NEXT : `${FORM_NEXT} ถ้าอยากทราบเบี้ยก่อน บอกเพศกับอายุมาได้เลยครับ เดี๋ยวคิดให้`;
  return { messages: [{ text: "ยินดีครับ 😊 รบกวนกรอกข้อมูลตามฟอร์มนี้ได้เลยครับ" }, { text: APPLICATION_FORM }, { text: next }] };
}

/**
 * What the bot says when the customer steps back. One line, no question, and — once they
 * have a quotation in hand — the door left open by name: the owner's choice, over silence
 * and over a follow-up.
 */
export function stallReply(quoted: boolean): string {
  return quoted
    ? "ได้เลยครับ ถ้าตัดสินใจแล้วหรืออยากได้ใบเสนออย่างเป็นทางการ ทักมาได้เลยนะครับ"
    : "ได้เลยครับ สะดวกเมื่อไหร่ทักมาได้เลยนะครับ";
}

/**
 * Someone who says they have a condition must not be told they will be accepted, whichever
 * plan they are asking about. It is the first answer both FAQ lists check for, for that reason.
 */
export const HEALTH_QUESTION =
  /โรคประจำตัว|มีโรค|เป็นโรค|ป่วยเป็น|เบาหวาน|ความดัน|ไทรอยด์|หอบ|ภูมิแพ้|มะเร็ง|หัวใจ|ผ่าตัด|ตรวจสุขภาพ|แถลงสุขภาพ|สุขภาพไม่ดี|กินยา|รักษาตัว/i;

export const HEALTH_DECLARATION =
  "มีโรคประจำตัวยื่นขอทำประกันได้ครับ แต่ต้องแถลงข้อมูลสุขภาพตามจริงในใบคำขอ "
  + "แล้วบริษัทจะพิจารณาเป็นรายบุคคล — อาจรับตามปกติ มีเบี้ยเพิ่ม หรือมีข้อยกเว้นเฉพาะโรค\n"
  + "ผลพิจารณาผมตอบแทนบริษัทไม่ได้ครับ ขอให้ตัวแทนดูให้ เดี๋ยวมีคนมาตอบในแชทนี้ 🙏\n"
  + "และไม่ต้องส่งรายละเอียดสุขภาพหรือผลตรวจมาในแชทนะครับ";

/**
 * The last few turns, always beginning with something the customer said. Cutting a
 * conversation to a fixed length can land on an assistant turn, and providers differ on
 * whether they accept a reply with nothing to reply to — one refuses outright. Starting on
 * a user turn keeps every provider in the failover chain usable.
 */
export function recentTurns(history: ChatMessage[], count: number): ChatMessage[] {
  const recent = history.slice(-count);
  const first = recent.findIndex((m) => m.role === "user");
  return first < 0 ? [] : recent.slice(first);
}

/**
 * Asking which company stands behind the policy — by name, by "ของบริษัทอะไร", or by
 * proposing a rival and waiting to be agreed with.
 *
 * Answered from a constant rather than by a model. Nothing in this project records the
 * insurer: asked "กรุงไทยแอกซ่าใช่ไหม", the model said "ใช่ครับ", which was agreement with
 * whatever name the customer happened to type, about the company that would be insuring
 * their life. A rival's name is matched too, so that guess is corrected rather than confirmed.
 *
 * The short forms count as the same question. Customers drop the noun — "ของอะไรครับ",
 * "ประกันของใครคะ", "เจ้าไหน" — and mean exactly which company. Left out, those reached the
 * model, which has no business naming one. "ที่ไหน" is deliberately absent: "ซื้อได้ที่ไหน"
 * asks where to buy, not who sells.
 */
const INSURER_QUESTION =
  /บริษัท\s*(อะไร|ไหน|อะไรคะ|ไรครับ)|ของบริษัท|ของอะไร|ของใคร|เจ้าไหน|ของค่าย|ผู้รับประกัน|รับประกันโดย|ค่ายไหน|แบรนด์|กรุงไทย|แอกซ่า|axa|เมืองไทย|เอไอเอ|\baia\b|ไทยประกัน|พรูเด็นเชียล|prudential|allianz|อลิอันซ์|\bfwd\b|โตเกียว|กรุงเทพประกัน|ไทยพาณิชย์|\bscb\b/i;

/**
 * Asking about the people rather than the company: a licence, a brokerage, whether any of
 * them can be trusted. The insurer can be named from a constant; none of this can, so it
 * goes to a person.
 */
const TRUST_QUESTION = /ใบอนุญาต|นายหน้า|ตัวแทนของ|เชื่อถือ|มั่นคง|โกง|หลอก|จดทะเบียน|ตัวจริง/i;

/**
 * The premium is too much. Answered by pointing at what is actually cheaper — the pay-to-99
 * term, a smaller cover — rather than by the shorter terms the bot offered on its first
 * attempt, which cost more a year, not less.
 */
const TOO_EXPENSIVE = /แพง|ถูกกว่า|ถูกลง|ลดได้|ลดหน่อย|ลดทุน|ส่วนลด|ต่อราคา|โปรโมชั่น|มีโปร|เกินงบ|งบไม่ถึง|ไม่มีตังค์|ไม่มีเงิน/;

/** Whether a message is saying the price is too high. */
export function asksCheaper(text: string): boolean {
  return TOO_EXPENSIVE.test(text);
}

/** A short yes, with nothing else in it — taking whatever was last offered. */
const AFFIRMS = /^\s*(?:เอา|ตกลง|โอเค|โอเช|ok|okay|ได้|สนใจ|ครับ|ค่ะ|คะ|ขอ)(?:เลย|ครับ|ค่ะ|คะ|แบบนี้|อันนี้|แบบลดทุน|แบบนั้น|นี้)*\s*(?:ครับ|ค่ะ|คะ)?\s*$/i;

/** Whether a message is a bare acceptance of what the bot last put on the table. */
export function affirms(text: string): boolean {
  return text.length <= 30 && !/\d/.test(text) && AFFIRMS.test(text);
}

/**
 * Stepping back — "เดี๋ยวคิดดูก่อน", "ขอปรึกษาแฟนก่อน", "ไว้จะติดต่อกลับ". Not a question, not
 * a refusal: a person who has what they came for and is leaving to think.
 */
const STALLS = /คิดดูก่อน|ขอคิดดู|คิดก่อน|ไว้ก่อน|ไว้ค่อย|ติดต่อกลับ|เดี๋ยวติดต่อ|ทักกลับ|ขอปรึกษา|ปรึกษาก่อน|ปรึกษาที่บ้าน|ยังไม่ตัดสินใจ|ขอเวลา|เดี๋ยวมาใหม่|ขอดูก่อน/;
/** A stall that is really a question stays a question. */
const ASKS = /\?|ไหม|มั้ย|ยังไง|อย่างไร|อะไร|เท่าไ|กี่|ไหน|เมื่อไ/;

/** Whether the customer is leaving to think it over. */
export function stalls(text: string): boolean {
  return STALLS.test(text) && !ASKS.test(text);
}

/**
 * Deciding to buy — "เอาแผนนี้", "สมัครยังไง", "ต้องทำยังไงต่อ", "ใช้เอกสารอะไรบ้าง". The one
 * message the whole campaign is for, and the one a model was wording on its own: it asked for
 * a name and a phone number the privacy page says are never asked for, and once promised to
 * "เตรียมเอกสาร". The agency's answer is a form, so the answer is written out and the words
 * that mean it are listed here.
 */
const BUYS =
  /สมัคร|ทำ(?:ยังไง|อย่างไร|ไง)|ขั้นตอน|ต้องทำอะไร|เอา(?:แผน|แบบ|แผ่น|อัน|ตัว)นี้|ตกลงทำ|สนใจทำ|ทำเลย|เอาเลย|เริ่ม(?:ยังไง|อย่างไร|ได้เลย)|เตรียม(?:อะไร|เอกสาร)|ใช้เอกสาร|เอกสารอะไร|ซื้อ(?:ยังไง|ได้ที่ไหน|ได้เลย|เลย)|ดำเนินการ/;
/** "ทำยังไง" about a claim, a cancellation or a surrender is a service question, not a purchase */
const NOT_BUYING = /เคลม|ยกเลิก|เวนคืน|กู้|ต่ออายุ|เปลี่ยนแปลง/;
/** a bare ตกลง or เอา — a decision once a premium is on the table, and only then */
const COMMITS = /^\s*(?:ตกลง|เอา)(?:\s*(?:ครับ|ค่ะ|คะ|เลย|นะ))*\s*$/;

/**
 * Whether the customer is asking to go ahead. `quoted` says a premium has been given, which
 * is what lets a one-word ตกลง count; a one-word โอเค never does — it is an acknowledgement.
 */
export function wantsToBuy(text: string, quoted: boolean): boolean {
  if (asksCheaper(text) || NOT_BUYING.test(text) || peopleIn(text).length > 0) return false;
  return BUYS.test(text) || (quoted && COMMITS.test(text));
}

/** Whether the customer says the form has been filled in and sent. */
const FORM_DONE = /กรอก(?:แล้ว|เสร็จ|เรียบร้อย)|ส่ง(?:ฟอร์ม|ข้อมูล)?แล้ว|เรียบร้อยแล้ว|ทำแล้ว/;
export function saysFormDone(text: string): boolean {
  return FORM_DONE.test(text);
}

/** Whether a message is asking who stands behind the policy. */
export function asksAboutCompany(text: string): boolean {
  return INSURER_QUESTION.test(text) || TRUST_QUESTION.test(text);
}

/** Whether that question is one only a person should answer. */
export function asksAboutTrust(text: string): boolean {
  return TRUST_QUESTION.test(text);
}

/**
 * A sex and an age standing next to each other, in either order and in any of the forms
 * customers actually use: "ผญ 32", "42 ญ", "ชายอายุ 35", "เพศหญิง อายุ 36".
 *
 * Read here rather than asked of the model, because the model returns one person and a
 * message often names two. Two of six conversations from the campaign's first day were a
 * couple in one line.
 */
const SEX_WORD = "ผู้หญิง|ผู้ชาย|ผญ|ผช|หญิง|ชาย|ญ|ช";
const PERSON_RE = new RegExp(
  `(${SEX_WORD})\\s*(?:เพศ\\s*)?(?:อายุ\\s*)?(\\d{1,2})(?!\\d)`
  + `|(\\d{1,2})(?!\\d)\\s*(?:ปี)?\\s*(${SEX_WORD})`,
  "g",
);

/**
 * The cover a message names, in baht — "ทุน1ล้าน", "ขอ 2 ล้าน", "ทุน 500,000", "5 แสน".
 *
 * A backstop for the model, not a replacement: it is consulted only when the model read no
 * amount at all. A family of three wrote "ช 23 ญ 25 ช 53 ทุน1ล้าน", the model missed the sum
 * for want of a space, and the bot asked for what it had been given — twice.
 *
 * Nothing without ล้าน, แสน or the word ทุน in front of it counts, so an age, a year of birth
 * and a payment term are all left alone.
 */
const COVER_WORDS = /(\d+(?:\.\d+)?)\s*(ล้าน|แสน)|ทุน(?:ประกัน)?\s*([\d,]{6,})/;
const SMALLEST_COVER = 10_000;
const LARGEST_COVER = 100_000_000;

export function coverIn(text: string): number | undefined {
  const m = text.match(COVER_WORDS);
  if (!m) return undefined;
  const baht = m[1]
    ? Number(m[1]) * (m[2] === "ล้าน" ? 1_000_000 : 100_000)
    : Number(m[3].replace(/,/g, ""));
  if (!Number.isFinite(baht) || baht < SMALLEST_COVER || baht > LARGEST_COVER) return undefined;
  return Math.round(baht);
}

/** Everyone a message names, in the order it names them. */
export function peopleIn(text: string): { age: number; sex: "M" | "F" }[] {
  const out: { age: number; sex: "M" | "F" }[] = [];
  for (const m of text.matchAll(PERSON_RE)) {
    const word = m[1] ?? m[4] ?? "";
    const age = Number(m[2] ?? m[3]);
    if (!Number.isInteger(age) || age < 0 || age > 99) continue;
    const sex = word.includes("ญ") ? "F" : "M";
    // the same person written twice is still one person
    if (!out.some((p) => p.age === age && p.sex === sex)) out.push({ age, sex });
  }
  return out;
}

/**
 * The age a date of birth in the message works out to, or undefined when it names none.
 *
 * Customers answer "อายุเท่าไหร่" with a birthdate as readily as with a number — "เกิด
 * 14/12/2523 ผู้หญิง" — and the model read that one as 43 when it is 45. Two years is a
 * different premium. An age is arithmetic on a calendar, so it is done here.
 */
export function ageFromBirthdate(text: string, today: Date = new Date()): number | undefined {
  const m = text.match(/(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{4})/);
  if (!m) return ageFromBirthYear(text, today);
  const day = Number(m[1]);
  const month = Number(m[2]);
  const named = Number(m[3]);
  if (day < 1 || day > 31 || month < 1 || month > 12) return undefined;
  // a year in the 2500s is พ.ศ.; anything else is read as ค.ศ.
  const year = named >= 2400 ? named - 543 : named;
  const passed = today.getMonth() + 1 > month
    || (today.getMonth() + 1 === month && today.getDate() >= day);
  const age = today.getFullYear() - year - (passed ? 0 : 1);
  return age >= 0 && age <= 99 ? age : undefined;
}

/**
 * The age behind a birth year with no day or month — "เกิด2522 เพศญ".
 *
 * It cannot say whether this year's birthday has passed, which is why it was once left to
 * the model. The model answered 47 with 45, to a customer waiting on a premium, so the
 * arithmetic is done here instead and read the way it is said aloud in Thai: this year's
 * พ.ศ. less the year named. Someone whose birthday is still to come is a year out, and the
 * quotation prints the age it used, so they can say so.
 *
 * The year must follow the word เกิด. Every other four-digit number in these conversations
 * is money.
 */
function ageFromBirthYear(text: string, today: Date): number | undefined {
  const m = text.match(/เกิด\s*(?:ปี\s*)?(?:พ\s*\.?\s*ศ\s*\.?\s*)?(\d{4})(?!\d)/);
  if (!m) return undefined;
  const named = Number(m[1]);
  const year = named >= 2400 ? named - 543 : named;
  const age = today.getFullYear() - year;
  return age >= 0 && age <= 99 ? age : undefined;
}

