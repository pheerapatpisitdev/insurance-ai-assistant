import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { verifySignature, hashUserId } from "@/lib/line/verify";
import { claimEvent, loadSession, saveSession } from "@/lib/line/session";
import { push, reply } from "@/lib/line/client";
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

interface LineEvent {
  type: string;
  replyToken?: string;
  webhookEventId?: string;
  source?: { userId?: string };
  message?: { type: string; text?: string };
}

export async function POST(req: NextRequest) {
  // the signature is computed over the exact bytes LINE sent, so the body is read as text
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-line-signature"))) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw).events ?? []) as LineEvent[];
  } catch {
    return new NextResponse("bad body", { status: 400 });
  }

  // LINE gives up on a webhook that takes more than a few seconds, and an answer takes
  // longer than that, so the reply happens after this response has already been sent.
  after(async () => {
    for (const event of events) await handle(event).catch((e) => console.error("line event failed:", e));
  });

  return NextResponse.json({ ok: true });
}

async function handle(event: LineEvent): Promise<void> {
  if (event.type !== "message" || event.message?.type !== "text") return;
  const text = (event.message.text ?? "").trim().slice(0, MAX_CHARS);
  const userId = event.source?.userId;
  const replyToken = event.replyToken;
  if (!text || !userId || !replyToken) return;

  // a redelivery of an event already answered must not answer it a second time
  if (event.webhookEventId && !(await claimEvent(event.webhookEventId))) return;

  const userHash = hashUserId(userId);
  if (!allow(`line:${userHash}`)) {
    await say(replyToken, userId, BUSY);
    return;
  }

  const session = await loadSession(userHash);
  const history: ChatMessage[] = [...session.messages, { role: "user", content: text }];

  try {
    const answer = await answerQuestion(history, session.slots);
    await say(replyToken, userId, answer.reply);
    await saveSession(userHash, [...history, { role: "assistant", content: answer.reply }], answer.slots);
  } catch (e) {
    await say(replyToken, userId, e instanceof BudgetExceeded ? OUT_OF_BUDGET : BROKEN);
    throw e;
  }
}

/** A reply token is only good for a short while; once it lapses the answer is pushed instead. */
async function say(replyToken: string, userId: string, text: string): Promise<void> {
  try {
    await reply(replyToken, text);
  } catch (e) {
    console.error("reply failed, pushing instead:", e);
    await push(userId, text);
  }
}
