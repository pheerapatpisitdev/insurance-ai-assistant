import { siteUrl } from "@/lib/site-url";
import { hashUserId } from "@/lib/facebook/verify";
import { claimEvent, isMuted, loadSession, muteFor, saveSession } from "@/lib/chat/session";
import { sendImage, sendMessage, showTyping } from "@/lib/facebook/client";
import { answerAny } from "@/lib/assistant/dispatch";
import { allow } from "@/lib/assistant/rate-limit";
import { BudgetExceeded } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { agentTyped, customerOf, eventKey, textOf, type Messaging } from "@/lib/facebook/events";

/**
 * The answer, with one more attempt before giving up.
 *
 * The failures that reach a customer are transient — a key table that could not be read on a
 * cold start, a provider refusing one call. A second try costs a second and saves the lead.
 */
async function answered(history: ChatMessage[], slots: Parameters<typeof answerAny>[1]) {
  try {
    return await answerAny(history, slots);
  } catch (e) {
    if (e instanceof BudgetExceeded) throw e;
    console.error("answer failed, trying once more:", e);
    return await answerAny(history, slots);
  }
}

/**
 * One event from the page's inbox, answered.
 *
 * It sits here rather than in the route because a Next route file may export only its own
 * verbs, and this is the half worth testing: the route's job is to check Meta's signature
 * and get out of the way.
 */

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BUSY = "ตอนนี้มีคำถามเข้ามาเยอะครับ รบกวนรอสักครู่แล้วถามใหม่นะครับ";
/**
 * What the customer sees when the bot cannot answer at all. It used to send them away —
 * "รบกวนถามใหม่อีกครั้งครับ" — which is no way to treat someone who arrived through a paid
 * advertisement. The agent watches this inbox, so the message says so.
 */
const BROKEN = "ขออภัยครับ ระบบขัดข้องชั่วคราว เดี๋ยวแอดมินมาตอบให้นะครับ 🙏";
const OUT_OF_BUDGET = "ตอนนี้ระบบผู้ช่วยปิดชั่วคราวครับ รบกวนติดต่อตัวแทนโดยตรงนะครับ";

export async function handle(event: Messaging): Promise<void> {
  // on an echo the sender is the page, so the thread is named by who it was sent to
  const psid = customerOf(event);
  if (!psid) return;
  const userHash = hashUserId(psid);

  // the agent has answered in the page's own inbox: the thread is marked as theirs until the
  // customer writes again. Checked before the customer's words are read, because this event
  // carries the page's words, not theirs.
  if (agentTyped(event)) {
    const session = await loadSession("facebook", userHash);
    await saveSession("facebook", userHash, session.messages, session.slots, muteFor());
    return;
  }

  // a typed message and a tapped button are both the customer's words; an echo is not
  const text = textOf(event);
  if (!text) return;

  // a redelivery of an event already answered must not answer it a second time
  const key = eventKey(event);
  if (key && !(await claimEvent("facebook", key))) return;

  const session = await loadSession("facebook", userHash);
  /**
   * The agent answering by hand pauses the bot, and this message ends the pause: the customer
   * has written again, so the thread is handed back.
   *
   * It used to be a day of silence, which is what the owner asked for at first and then
   * watched go wrong — an agent said hello to a lead from the advertisement, the lead gave
   * her age, and the bot sat on the answer it had ready. What the pause still has to stop is
   * the bot talking over an agent who types in the seconds the model takes, so the mark on
   * the thread is remembered here and compared with the one that is there when the answer is
   * ready.
   */
  const markedBefore = session.mutedUntil;

  if (!allow(`fb:${userHash}`)) {
    await sendMessage(psid, BUSY);
    return;
  }

  const history: ChatMessage[] = [...session.messages, { role: "user", content: text }];

  await showTyping(psid).catch(() => {});
  try {
    const answer = await answered(history, session.slots);
    // the model takes seconds, and an agent watching the thread answers inside them. Their
    // words are already in the customer's phone by now, so the bot says nothing and records
    // nothing — a mark that was not there when this answer began is theirs, just now.
    const marked = (await loadSession("facebook", userHash)).mutedUntil;
    if (marked !== markedBefore && isMuted(marked)) return;
    for (const [i, said] of answer.messages.entries()) {
      // a second bubble arrives the way a person's would: after the dots, and after a pause
      // that scales with how much there was to type
      if (i > 0) {
        await showTyping(psid).catch(() => {});
        await pause(Math.min(2500, 400 + said.text.length * 15));
      }
      // the buttons ride on whatever lands last, because anything sent after them clears them
      const last = i === answer.messages.length - 1;
      await sendMessage(psid, said.text, last && !said.card ? answer.replies : undefined);
      // the card follows its own words, so the customer reads the quote before the picture of
      // it — and a couple priced together gets the pair in the order they were named
      if (said.card) {
        await sendImage(psid, siteUrl(said.card), last ? answer.replies : undefined)
          .catch((e) => console.error("card failed:", e));
      }
    }
    const spoken = answer.messages.map((m) => m.text).join("\n\n");
    // no mute argument: recording what was said must never clear one
    await saveSession("facebook", userHash, [...history, { role: "assistant", content: spoken }], answer.slots);
  } catch (e) {
    await sendMessage(psid, e instanceof BudgetExceeded ? OUT_OF_BUDGET : BROKEN);
    throw e;
  }
}
