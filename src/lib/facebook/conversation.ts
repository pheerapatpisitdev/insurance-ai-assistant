import { siteUrl } from "@/lib/site-url";
import { hashUserId } from "@/lib/facebook/verify";
import { claimEvent, isMuted, loadSession, muteFor, saveSession } from "@/lib/chat/session";
import { sendImage, sendMessage, showTyping } from "@/lib/facebook/client";
import { answerQuestion } from "@/lib/assistant/answer";
import { allow } from "@/lib/assistant/rate-limit";
import { BudgetExceeded } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { agentTyped, customerOf, eventKey, textOf, type Messaging } from "@/lib/facebook/events";

/**
 * One event from the page's inbox, answered.
 *
 * It sits here rather than in the route because a Next route file may export only its own
 * verbs, and this is the half worth testing: the route's job is to check Meta's signature
 * and get out of the way.
 */

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BUSY = "ตอนนี้มีคำถามเข้ามาเยอะครับ รบกวนรอสักครู่แล้วถามใหม่นะครับ";
const BROKEN = "ขออภัยครับ ระบบตอบไม่ได้ในตอนนี้ รบกวนถามใหม่อีกครั้งครับ";
const OUT_OF_BUDGET = "ตอนนี้ระบบผู้ช่วยปิดชั่วคราวครับ รบกวนติดต่อตัวแทนโดยตรงนะครับ";

export async function handle(event: Messaging): Promise<void> {
  // on an echo the sender is the page, so the thread is named by who it was sent to
  const psid = customerOf(event);
  if (!psid) return;
  const userHash = hashUserId(psid);

  // the agent has answered in the page's own inbox: the bot steps out of this thread for a
  // day. Checked before the customer's words are read, because this event carries the
  // page's words, not theirs.
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
  // silence costs nothing: the check sits above the router, not below it
  if (isMuted(session.mutedUntil)) return;

  if (!allow(`fb:${userHash}`)) {
    await sendMessage(psid, BUSY);
    return;
  }

  const history: ChatMessage[] = [...session.messages, { role: "user", content: text }];

  await showTyping(psid).catch(() => {});
  try {
    const answer = await answerQuestion(history, session.slots);
    // the model takes seconds, and an agent watching the thread answers inside them. Their
    // words are already in the customer's phone by now, so the bot says nothing and records
    // nothing — the mute stands and the thread is theirs.
    if (isMuted((await loadSession("facebook", userHash)).mutedUntil)) return;
    for (const [i, said] of answer.messages.entries()) {
      // a second bubble arrives the way a person's would: after the dots, and after a pause
      // that scales with how much there was to type
      if (i > 0) {
        await showTyping(psid).catch(() => {});
        await pause(Math.min(2500, 400 + said.text.length * 15));
      }
      await sendMessage(psid, said.text);
      // the card follows its own words, so the customer reads the quote before the picture of
      // it — and a couple priced together gets the pair in the order they were named
      if (said.card) await sendImage(psid, siteUrl(said.card)).catch((e) => console.error("card failed:", e));
    }
    const spoken = answer.messages.map((m) => m.text).join("\n\n");
    // no mute argument: recording what was said must never clear one
    await saveSession("facebook", userHash, [...history, { role: "assistant", content: spoken }], answer.slots);
  } catch (e) {
    await sendMessage(psid, e instanceof BudgetExceeded ? OUT_OF_BUDGET : BROKEN);
    throw e;
  }
}
