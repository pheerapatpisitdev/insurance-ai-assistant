import { siteUrl } from "@/lib/site-url";
import { hashUserId } from "@/lib/facebook/verify";
import { claimEvent, isMuted, loadSession, muteFor, saveSession } from "@/lib/chat/session";
import {
  attribute, formRefOf, openConversation, openLead, record,
  type CollectedEvent, type LeadStage, type Unanswered,
} from "@/lib/chat/collect";
import { sendImage, sendMessage, showTyping } from "@/lib/facebook/client";
import { answerQuestion, type Answer, type AnswerContext, type TraceEvent } from "@/lib/assistant/answer";
import { allow } from "@/lib/assistant/rate-limit";
import { BudgetExceeded } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { agentTyped, customerOf, eventKey, pageOf, referralOf, textOf, type Messaging } from "@/lib/facebook/events";

/** The one plan this bot sells; the record names it until the slots carry a product of their own. */
const PRODUCT = "lifeprotect";

/**
 * The answer, with one more attempt before giving up.
 *
 * The failures that reach a customer are transient — a key table that could not be read on a
 * cold start, a provider refusing one call. A second try costs a second and saves the lead.
 */
async function answered(history: ChatMessage[], slots: Parameters<typeof answerQuestion>[1], ctx: AnswerContext) {
  try {
    return await answerQuestion(history, slots, ctx);
  } catch (e) {
    if (e instanceof BudgetExceeded) throw e;
    console.error("answer failed, trying once more:", e);
    return await answerQuestion(history, slots, ctx);
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
    // their stepping in is part of the conversation's story, when there is a live one to tell it in
    if (session.conversationId) await record(session.conversationId, [{ kind: "agent_replied" }], PRODUCT);
    return;
  }

  // a typed message and a tapped button are both the customer's words; an echo is not.
  // A referral is not words either, but it is where the thread was opened from, and a
  // messaging_referrals event carries nothing else.
  const text = textOf(event);
  const referral = referralOf(event);
  if (!text && !referral) return;

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

  // the conversation this event belongs to in the record: the live one, or a new one starting
  // now and carrying where it came from. Null when the record cannot be reached, in which
  // case the customer is answered and this turn is simply not written down.
  let conversationId = session.conversationId;
  if (!conversationId) {
    conversationId = await openConversation({
      channel: "facebook", userHash, pageId: pageOf(event), referral, entryPayload: event.postback?.payload,
    });
  } else if (referral) {
    await attribute(conversationId, referral);
  }

  // a referral with no words: the thread was opened from an advert or a link, and the words
  // are on their way. The conversation is kept on the session so those words join it.
  if (!text) {
    if (conversationId) await saveSession("facebook", userHash, session.messages, session.slots, undefined, conversationId);
    return;
  }

  if (!allow(`fb:${userHash}`)) {
    await sendMessage(psid, BUSY);
    if (conversationId) await record(conversationId, [{ kind: "rate_limited" }], PRODUCT);
    return;
  }

  const history: ChatMessage[] = [...session.messages, { role: "user", content: text }];
  const ctx: AnswerContext = conversationId ? { formRef: formRefOf(conversationId) } : {};

  await showTyping(psid).catch(() => {});
  try {
    const answer = await answered(history, session.slots, ctx);
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
    await saveSession("facebook", userHash, [...history, { role: "assistant", content: spoken }], answer.slots, undefined, conversationId);
    // the customer has their answer; what the turn did is written down afterwards, and a
    // record that fails to write fails alone
    if (conversationId) await remember(conversationId, psid, event, answer).catch((e) => console.error("record failed:", e));
  } catch (e) {
    await sendMessage(psid, e instanceof BudgetExceeded ? OUT_OF_BUDGET : BROKEN);
    if (conversationId) {
      await record(conversationId, [{
        kind: e instanceof BudgetExceeded ? "budget_exceeded" : "error",
        // the system's words about itself, never the customer's: the first line of the error
        data: { message: (e instanceof Error ? e.message : String(e)).split("\n")[0].slice(0, 120) },
      }], PRODUCT);
    }
    throw e;
  }
}

/**
 * The turn, written down: that the customer wrote, what the bot did with it, and a lead when
 * they asked to go ahead or to talk to a person.
 *
 * The events carry the trace's kinds and figures. A question the bot had no written answer
 * for travels separately, to a list with no conversation on it, so a customer's words are
 * never filed next to the thread they came from.
 */
async function remember(conversationId: string, psid: string, event: Messaging, answer: Answer): Promise<void> {
  const trace = answer.trace ?? [];
  const events: CollectedEvent[] = [
    { kind: "message", data: { chars: textOf(event).length, button: Boolean(event.postback) } },
    ...trace.map(({ kind, data }) => (data ? { kind, data } : { kind })),
  ];
  const unanswered: Unanswered[] = trace
    .filter((t): t is TraceEvent & { question: string } => Boolean(t.question))
    .map((t) => ({ intent: t.kind === "plan_info" ? "plan_info" : "other", route: "model" as const, question: t.question }));
  await record(conversationId, events, PRODUCT, unanswered);

  const stage = leadStageOf(trace);
  if (stage) await openLead({ conversationId, psid, stage, product: PRODUCT, formRef: formRefOf(conversationId) });
}

/**
 * Whether this turn made the customer a lead, and how far along: the form went out, the form
 * came back, or they asked for a person — about the company's standing or about a condition,
 * which are the two questions the bot hands over rather than answers.
 */
function leadStageOf(trace: TraceEvent[]): LeadStage | undefined {
  if (trace.some((t) => t.kind === "form_done")) return "form_done";
  if (trace.some((t) => t.kind === "form_sent")) return "form_sent";
  const askedForAPerson = trace.some((t) => t.kind === "handover" && (t.data?.reason === "trust" || t.data?.reason === "health"));
  return askedForAPerson ? "interested" : undefined;
}
