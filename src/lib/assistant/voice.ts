/**
 * Whether a Page answers as a man or as a woman.
 *
 * Thai has no polite sentence that hides this: the particle at the end of every line is
 * ครับ or ค่ะ and there is no third one, so a Page staffed by more than one person either
 * picks a voice and keeps it, or tells every customer which of them happened to be at the
 * keyboard. The agency picked. Each Page speaks as one person whoever is answering.
 *
 * The copy in this repository is written in ครับ — it was, before there was more than one
 * Page — so that is the voice a rewrite starts from, and a Page that speaks it is left
 * exactly alone. Nothing here is a translation: it is one particle and one pronoun.
 */

export type Voice = "male" | "female";

/**
 * The Pages that keep the ครับ the copy is written in. Every other Page speaks ค่ะ.
 *
 * A list of the exceptions rather than a row per Page, because a Page connected tomorrow
 * should already have a voice, and the one it should have is the one the other two use.
 */
const SPEAKS_AS_A_MAN = new Set([
  "103716981993581", // ประกันเพื่อคนวัยทำงาน
]);

export function voiceOf(pageId?: string): Voice {
  return pageId && SPEAKS_AS_A_MAN.has(pageId) ? "male" : "female";
}

/**
 * The words that turn ครับ into คะ rather than ค่ะ.
 *
 * A woman ends a question with คะ and a statement with ค่ะ, and a page that writes ค่ะ on
 * both is making the mistake Thai readers notice first. A man's ครับ does the work of both,
 * so the question has to be recognised here or it is lost. What marks one is the word
 * immediately before the particle, which is why this is matched against the end of the line
 * rather than anywhere in it.
 */
const ASKS = /(ไหม|มั้ย|หรือ|เหรอ|รึ|อะไร|ไหน|ใคร|เมื่อไหร่|เมื่อไร|ยังไง|อย่างไร|เท่าไหร่|เท่าไร|ทำไม|ยัง)ครับ/g;

/**
 * ผม as a pronoun, and not as the hair on somebody's head.
 *
 * Thai is written without spaces, so there is no word boundary to match on and "เส้นผม" and
 * "ผมร่วง" are both one character away from being rewritten into nonsense. Hair belongs in
 * this inbox — it is what a customer asks about after chemotherapy, and critical illness is
 * three of the arrangements sold here — so the exceptions are named.
 */
const I_MYSELF = /(?<!เส้น|ทรง|โกน|สระ|ย้อม|ตัด|หนัง)ผม(?!ร่วง|บาง|ยาว|สั้น|หงอก|เสีย|แห้ง|มัน|ขาว|ดก)/g;

/**
 * One line, said in the voice its Page speaks in.
 *
 * Only the words. A quick reply is not passed through this and must not be: a tapped button
 * arrives back as its own title, and two places compare that title against the constant it
 * was built from, so a button rewritten on the way out is a button the dispatcher no longer
 * recognises on the way in. The titles carry no particle, so there is nothing to rewrite.
 */
export function spokenBy(voice: Voice, text: string): string {
  if (voice === "male") return text;
  return text
    .replace(/ครับผม/g, "ค่ะ")
    .replace(/นะครับ/g, "นะคะ")
    .replace(ASKS, "$1คะ")
    .replace(/ครับ/g, "ค่ะ")
    .replace(I_MYSELF, "เรา");
}
