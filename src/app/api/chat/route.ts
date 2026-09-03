import { NextRequest, NextResponse } from "next/server";
import { answerQuestion } from "@/lib/assistant/answer";
import type { Routed } from "@/lib/assistant/route";
import { allow } from "@/lib/assistant/rate-limit";
import { BudgetExceeded } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_CHARS = 2000;
const MAX_TURNS = 12;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!allow(ip)) {
    return NextResponse.json({ error: "ถามถี่เกินไปครับ รอสักครู่แล้วลองใหม่" }, { status: 429 });
  }

  let body: { messages?: unknown; slots?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "รูปแบบคำขอไม่ถูกต้อง" }, { status: 400 });
  }

  const messages = sanitize(body.messages);
  if (!messages.length) return NextResponse.json({ error: "ไม่มีข้อความ" }, { status: 400 });

  try {
    const answer = await answerQuestion(messages, (body.slots as Routed) ?? null);
    return NextResponse.json(answer);
  } catch (e) {
    if (e instanceof BudgetExceeded) {
      return NextResponse.json({ error: "ใช้งบ AI ของเดือนนี้ครบแล้ว กรุณาแจ้งแอดมิน" }, { status: 503 });
    }
    const message = e instanceof Error ? e.message : "เกิดข้อผิดพลาด";
    console.error("chat failed:", message);
    return NextResponse.json({ error: "ตอบไม่ได้ในตอนนี้ครับ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}

/** Only user and assistant turns of a sane length reach the model. */
function sanitize(input: unknown): ChatMessage[] {
  if (!Array.isArray(input)) return [];
  return input
    .filter((m): m is { role: string; content: string } =>
      Boolean(m) && typeof m === "object" && typeof (m as { content?: unknown }).content === "string")
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, MAX_CHARS) }))
    .filter((m) => m.content.trim().length > 0);
}
