"use server";
import { headers } from "next/headers";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { answerFromKnowledge, type CopilotAnswer } from "@/lib/copilot/answer";
import { allow } from "@/lib/assistant/rate-limit";
import { BudgetExceeded } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import type { AnySlots } from "@/lib/assistant/slots";

/**
 * The home page's assistant, open to anyone — which the owner chose knowingly after being
 * told what it means: this and the Messenger bot spend one monthly budget, so a busy day
 * here is a quieter one there.
 *
 * What is kept is the burst limit the bot already uses. It is not a gate — nobody is asked
 * who they are — it only stops one caller asking eight times a minute, which no person does
 * and a script does immediately.
 */

const MAX_QUESTION = 500;

const BUSY = "ตอนนี้มีคำถามเข้ามาเยอะครับ รบกวนรอสักครู่แล้วถามใหม่นะครับ";
const OUT_OF_BUDGET = "ตอนนี้ผู้ช่วยปิดชั่วคราวครับ รบกวนติดต่อตัวแทนโดยตรงนะครับ";
const BROKEN = "ขออภัยครับ ระบบขัดข้องชั่วคราว ลองถามใหม่อีกครั้งนะครับ";

/** Whoever is asking, as well as this can be known behind a proxy. */
async function caller(): Promise<string> {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || h.get("x-real-ip") || "unknown";
}

export async function askCopilot(
  question: string,
  history: ChatMessage[] = [],
  slots: AnySlots | null = null,
): Promise<CopilotAnswer> {
  const asked = question.trim().slice(0, MAX_QUESTION);
  if (!asked) return { text: "", model: "—" };

  if (!allow(`copilot:${await caller()}`)) return { text: BUSY, model: "—" };

  try {
    return await answerFromKnowledge(asked, history, slots);
  } catch (e) {
    if (e instanceof BudgetExceeded) return { text: OUT_OF_BUDGET, model: "—" };
    console.error("copilot failed:", e);
    return { text: BROKEN, model: "—" };
  }
}

/* ------------------------------------------------------------------ *
 * The knowledge anyone may add
 *
 * Open to every visitor, which the owner chose after being told what it
 * means: a note written here is read back by the assistant to whoever
 * asks next. No gate was asked for and none is smuggled in. What is here
 * instead is the pair of things that make a bad note survivable — every
 * note is listed with the time it arrived, and any of them can be
 * removed in one click.
 * ------------------------------------------------------------------ */

const MAX_Q = 200;
const MAX_A = 2000;
