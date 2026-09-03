import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { verifySignature, verifyTokenMatches, hashUserId } from "@/lib/facebook/verify";
import { claimEvent, loadSession, saveSession } from "@/lib/chat/session";
import { sendMessage, showTyping } from "@/lib/facebook/client";
import { answerQuestion } from "@/lib/assistant/answer";
import { allow } from "@/lib/assistant/rate-limit";
import { BudgetExceeded } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHARS = 1000;
const BUSY = "ตอนนี้มีคำถามเข้ามาเยอะครับ รบกวนรอสักครู่แล้วถามใหม่นะครับ";
const BROKEN = "ขออภัยครับ ระบบตอบไม่ได้ในตอนนี้ รบกวนถามใหม่อีกครั้งครับ";
const OUT_OF_BUDGET = "ตอนนี้ระบบผู้ช่วยปิดชั่วคราวครับ รบกวนติดต่อตัวแทนโดยตรงนะครับ";

interface Messaging {
  sender?: { id?: string };
  message?: { mid?: string; text?: string; is_echo?: boolean };
}
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

async function handle(event: Messaging): Promise<void> {
  // an echo is the page's own message coming back; answering it would talk to ourselves
  if (event.message?.is_echo) return;
  const text = (event.message?.text ?? "").trim().slice(0, MAX_CHARS);
  const psid = event.sender?.id;
  const mid = event.message?.mid;
  if (!text || !psid) return;

  // a redelivery of a message already answered must not answer it a second time
  if (mid && !(await claimEvent("facebook", mid))) return;

  const userHash = hashUserId(psid);
  if (!allow(`fb:${userHash}`)) {
    await sendMessage(psid, BUSY);
    return;
  }

  const session = await loadSession("facebook", userHash);
  const history: ChatMessage[] = [...session.messages, { role: "user", content: text }];

  await showTyping(psid).catch(() => {});
  try {
    const answer = await answerQuestion(history, session.slots);
    await sendMessage(psid, answer.reply);
    await saveSession("facebook", userHash, [...history, { role: "assistant", content: answer.reply }], answer.slots);
  } catch (e) {
    await sendMessage(psid, e instanceof BudgetExceeded ? OUT_OF_BUDGET : BROKEN);
    throw e;
  }
}
