import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { answerAny } from "@/lib/assistant/dispatch";
import {
  asksAboutDeathBenefit, asksForPrice, asksPayTerm, asksValueTable,
} from "@/lib/assistant/lifeprotect/route";
import { asksFullTable, asksOtherPlans, asksShareOfBill } from "@/lib/assistant/ihealthy/route";
import { asksCheaper } from "@/lib/assistant/common";
import type { AnySlots } from "@/lib/assistant/slots";
import { assembleKnowledge } from "./knowledge";

/**
 * The assistant that answers out of this system's own knowledge, and out of nothing else.
 *
 * Two things can be asked of it and they are answered by two different machines.
 *
 * A question about money goes to `answerAny` — the same dispatcher the Messenger bot runs on,
 * which reads the message, fills what it can, asks for what it cannot, and prices through the
 * engine. Reusing it rather than calling `quote()` here is the whole point: the figure this
 * page gives and the figure the bot gives are then the same figure by construction, and the
 * trap that lies between them is not stepped in — on the life plan "ทุน 1 ล้าน" is what the
 * family receives and the sum assured behind it is half that before the booster age, a
 * distinction that doubles a premium if it is got wrong.
 *
 * A question about a rule goes to a model with every rule in the system in front of it. That
 * model is told, at length, that it may claim nothing which is not there.
 */

const SYSTEM = `คุณคือผู้ช่วยของตัวแทนประกันชีวิต ตอบคำถามจากคลังความรู้ด้านล่างเท่านั้น

กฎที่ห้ามฝ่าฝืน:
1. ตอบเฉพาะสิ่งที่มีอยู่ในคลังความรู้ ถ้าไม่มีให้บอกตรงๆ ว่า "ข้อมูลนี้ไม่มีในระบบ" แล้วแนะนำให้ถามบริษัท
   ห้ามเดา ห้ามเติมจากความรู้ทั่วไปของคุณเอง แม้จะมั่นใจแค่ไหนก็ตาม
2. ห้ามคิดหรือคาดเดาตัวเลขเบี้ยประกันเด็ดขาด ถ้าถูกถามเรื่องเบี้ย ให้บอกว่าพิมพ์ อายุ เพศ แบบประกัน และทุน
   มาได้เลย ระบบจะคิดให้จากตารางจริง — ห้ามให้ตัวเลขประมาณการใดๆ ทั้งสิ้น
3. บอกที่มาของคำตอบทุกครั้ง เช่น "จากกฎของ Life Protect" หรือ "จากบันทึกของตัวแทน"
4. ถ้าคำตอบมาจาก "บันทึกของตัวแทนเอง" ต้องบอกให้ชัดว่าเป็นบันทึกภายใน ไม่ใช่เอกสารบริษัท
5. ห้ามรับรองผลการพิจารณารับประกัน เรื่องนั้นเป็นคำตอบของผู้พิจารณาเท่านั้น
6. ตอบเป็นภาษาไทย สั้น ตรงประเด็น ใช้หัวข้อย่อยเมื่อมีหลายข้อ`;

/**
 * Money words, as a net under the brains' own readers.
 *
 * "เท่าไหร่" was in this list and had to come out. It is the Thai for "how much" of anything
 * at all — how old, how large a sum, how many days — so the very first suggestion on the
 * page, "DCI ซื้อได้ถึงอายุเท่าไหร่", was sent down the pricing path. A money word has to be
 * present: the question is about the premium or it is not.
 */
const ASKS_PRICE = /เบี้ย|ราคา|กี่บาท|ค่างวด|จ่ายเดือนละ|จ่ายปีละ|จ่ายเท่าไหร่|คิดให้|premium/i;

/**
 * Whether the dispatcher should take this, rather than a model with the rule book.
 *
 * The brains already know how to recognise what they answer, and asking them is the only way
 * this stays right as they grow. Hand-rolling the test here got the premium and missed
 * everything else the engine draws: "ขอดูตารางมูลค่า" went to a model with no ability to
 * draw a table, and the customer got prose where the bot would have sent the picture.
 */
function forTheEngine(text: string): boolean {
  return asksForPrice(text)
    || asksValueTable(text)
    || asksPayTerm(text)
    || asksAboutDeathBenefit(text)
    || asksFullTable(text)
    || asksOtherPlans(text)
    || asksShareOfBill(text)
    || asksCheaper(text)
    || ASKS_PRICE.test(text);
}

export interface CopilotAnswer {
  text: string;
  /** which model answered, or the engine's own name when no model was asked */
  model: string;
  /** the premium came from the engine, so the page may say so */
  priced?: boolean;
  /**
   * What the pricing brain now knows about this person, handed back so the next question can
   * carry on from it — "ชาย 35" and then "ทุน 1 ล้าน" is two messages about one quotation.
   */
  slots?: AnySlots | null;
  /**
   * The pictures the engine drew, in the order it drew them.
   *
   * A list rather than one: a couple priced together — "ผญ 32 ผช 33" — is two quotations and
   * two cards, and keeping only the first is quietly losing one of them.
   */
  cards?: string[];
}

/** The name shown under an answer the engine produced, where a model name would go. */
const ENGINE = "เครื่องคิดเบี้ยของระบบ";

/**
 * The plans this chat knows about but cannot price, by the names a person calls them.
 *
 * The dispatcher speaks for two products. The knowledge describes five, because the rule
 * files describe five — and that combination quotes the wrong plan with total confidence:
 * "iShield ทุน 1 ล้าน เบี้ยเท่าไหร่" carries no name the router recognises, but "1 ล้าน" is
 * in Life Protect's subject list, so the question came back priced as Life Protect with a
 * Life Protect card attached. A different contract, a different table, and nothing on screen
 * to say so.
 *
 * Recognised here and stopped here. A page that says it cannot do this is worth any number
 * of pages that do it wrongly.
 */
const CANNOT_PRICE: [string, RegExp][] = [
  ["iShield", /i\s*-?\s*shield|ไอชิลด์|ไอ\s*ชิลด์/i],
  ["iSmart", /i\s*-?\s*smart|ไอสมาร์ท|ไอ\s*สมาร์ท/i],
  ["Life Treasure", /life\s*treasure|ไลฟ์\s*เทรเชอร์|ไลฟ์เทรเชอร์/i],
  ["Protection Life (PLB)", /protection\s*life|\bplb\b|โพรเทคชั่น\s*ไลฟ์/i],
];

function namedButUnpriceable(text: string): string | undefined {
  return CANNOT_PRICE.find(([, re]) => re.test(text))?.[0];
}

const elsewhere = (plan: string) => `แบบ **${plan}** ผมคิดเบี้ยให้ในแชทนี้ยังไม่ได้ครับ

แชทนี้คิดเบี้ยได้สองแบบ — **Life Protect x 2** กับ **iHealthy Ultra**

${plan} คิดได้ที่ [หน้าแบบประกันอื่นๆ](/other-plans) ซึ่งใช้ตารางเบี้ยชุดเดียวกัน

ส่วนเรื่องเงื่อนไขของ ${plan} เช่น ช่วงอายุ ทุนขั้นต่ำ หรือสัญญาเพิ่มเติมที่ซื้อคู่ได้ ถามผมได้เลยครับ ผมมีข้อมูลครบ`;

export async function answerFromKnowledge(
  question: string,
  history: ChatMessage[] = [],
  slots: AnySlots | null = null,
): Promise<CopilotAnswer> {
  /**
   * Anything about money, and anything asked while a quotation is already half-built.
   *
   * The second half matters: after "Life Protect ชาย 35" the next message is "ทุน 1 ล้าน",
   * which names no money word at all and would otherwise be read as a question about rules.
   */
  /**
   * Checked before the engine, not after: the harm is done the moment the dispatcher is
   * handed a question about a contract it does not sell.
   */
  const unpriceable = namedButUnpriceable(question);
  if (unpriceable && (forTheEngine(question) || slots)) {
    return { text: elsewhere(unpriceable), model: "—" };
  }

  if (forTheEngine(question) || slots) {
    const turns: ChatMessage[] = [...history.slice(-6), { role: "user", content: question }];
    const answer = await answerAny(turns, slots);
    const text = answer.messages.map((m) => m.text).join("\n\n");
    const cards = answer.messages.map((m) => m.card).filter((c): c is string => Boolean(c));
    return {
      text,
      model: answer.priced ? ENGINE : ENGINE,
      priced: Boolean(answer.priced),
      slots: answer.slots,
      ...(cards.length ? { cards } : {}),
    };
  }

  const knowledge = await assembleKnowledge();
  const messages: ChatMessage[] = [
    { role: "system", content: `${SYSTEM}\n\n---\n\n${knowledge}` },
    ...history.slice(-6),
    { role: "user", content: question },
  ];
  /**
   * The cheap tier, which is the right one for the work.
   *
   * This asks a model to read rules it has just been handed and say what they mean — no
   * arithmetic, no long chain of reasoning, and nothing it has to know on its own. The
   * expensive tier was the first choice and the ledger showed what that costs: Anthropic
   * took two thirds of a month's spending on five per cent of its calls, forty-four times
   * the price each, while the bot answered six hundred customers on the cheap tier for half
   * as much. A public page on the expensive one fills the month's budget in forty questions
   * a day — and the budget it fills is the one the Messenger bot answers advertisements out
   * of.
   */
  const reply = await chat({ tier: "small", task: "copilot", messages, maxTokens: 900 });
  return { text: reply.text, model: reply.model };
}
