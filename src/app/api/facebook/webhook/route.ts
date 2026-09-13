import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { siteUrl } from "@/lib/site-url";
import { hashUserId, verifySignature, verifyTokenMatches } from "@/lib/facebook/verify";
import { claimEvent, isMuted, loadSession, muteFor, saveSession } from "@/lib/chat/session";
import { sendImage, sendMessage, showTyping } from "@/lib/facebook/client";
import { answerQuestion } from "@/lib/assistant/answer";
import { allow } from "@/lib/assistant/rate-limit";
import { BudgetExceeded } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { agentTyped, eventKey, textOf, type Messaging } from "@/lib/facebook/events";

export const runtime = "nodejs";
export const maxDuration = 60;

const BUSY = "ตอนนี้มีคำถามเข้ามาเยอะครับ รบกวนรอสักครู่แล้วถามใหม่นะครับ";
const BROKEN = "ขออภัยครับ ระบบตอบไม่ได้ในตอนนี้ รบกวนถามใหม่อีกครั้งครับ";
const OUT_OF_BUDGET = "ตอนนี้ระบบผู้ช่วยปิดชั่วคราวครับ รบกวนติดต่อตัวแทนโดยตรงนะครับ";

interface Entry {
  messaging?: Messaging[];
}

/** Meta checks it owns this URL by asking for a challenge back, once, when the webhook is set. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (params.get("hub.mode") === "subscribe" && verifyTokenMatches(params.get("hub.verify_token"))) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  // the signature is computed over the exact bytes Meta sent, so the body is read as text
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let entries: Entry[] = [];
  try {
    const body = JSON.parse(raw);
    if (body.object !== "page") return NextResponse.json({ ok: true });
    entries = (body.entry ?? []) as Entry[];
  } catch {
    return new NextResponse("bad body", { status: 400 });
  }

  // Meta gives up on a webhook that takes more than a few seconds, and an answer takes
  // longer than that, so the reply happens after this response has already been sent.
  after(async () => {
    for (const entry of entries) {
      for (const m of entry.messaging ?? []) {
        await handle(m).catch((e) => console.error("facebook event failed:", e));
      }
    }
  });

  return NextResponse.json({ ok: true });
}

/** Exported for its tests: everything below here is what the customer actually experiences. */
export async function handle(event: Messaging): Promise<void> {
  const psid = event.sender?.id;
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
    await sendMessage(psid, answer.reply);
    // the card follows the words, so the customer reads the answer before the picture of it
    if (answer.card) await sendImage(psid, siteUrl(answer.card)).catch((e) => console.error("card failed:", e));
    await saveSession(
      "facebook", userHash, [...history, { role: "assistant", content: answer.reply }], answer.slots, null,
    );
  } catch (e) {
    await sendMessage(psid, e instanceof BudgetExceeded ? OUT_OF_BUDGET : BROKEN);
    throw e;
  }
}
