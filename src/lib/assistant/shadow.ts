import { judge } from "@/lib/ai/client";
import type { JudgeAnswer, JudgeQuestion } from "@/lib/ai/providers";
import type { ChatMessage } from "@/lib/ai/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { recentTurns } from "./common";

/**
 * TypeSafe's judge, running beside the router and deciding nothing.
 *
 * The plan is to let Jev call the intent and keep the chat model for what Jev cannot do.
 * Fifty messages without history said it would call more of them right; a week of real
 * turns, with history, will say whether that holds. So for that week every routed turn is
 * also put to Jev, and one row records what each of them said. The bot's answer is the chat
 * model's, exactly as before — this module cannot change it, only watch it.
 *
 * It must cost the customer nothing: it starts before the chat model is asked and is
 * usually finished before the model answers; it has its own short timeout; and nothing in
 * it throws. A shadow that slowed or broke the bot would be measuring the wrong thing.
 */
export type Intent = "quote" | "plan_info" | "other";
export type ShadowProduct = "lifeprotect" | "ihealthy";

/** How long the shadow may take before it is dropped; longer than Jev needs, shorter than a customer notices. */
const SHADOW_TIMEOUT_MS = 6_000;

/** How many turns the judge is shown. The router shows the chat model six; three is the last exchange and the question. */
const SHADOW_TURNS = 3;

const QUESTIONS: Record<ShadowProduct, Record<string, JudgeQuestion>> = {
  lifeprotect: {
    intent: {
      type: "choice",
      instructions: "บทสนทนานี้ลูกค้าคุยกับตัวแทนขายประกันชีวิต Life Protect x 2 ข้อความล่าสุดของลูกค้าต้องการอะไร",
      criteria: {
        quote: "ขอเบี้ยประกัน หรือให้ข้อมูลเพื่อคำนวณเบี้ย เช่น อายุ เพศ ทุนประกัน จำนวนเงิน",
        plan_info: "ถามว่าแบบประกันคุ้มครองอะไร เสียชีวิตแล้วได้เท่าไหร่ รับอายุเท่าไหร่ จ่ายกี่ปี เวนคืน เงื่อนไข",
        other: "ทักทาย ตอบรับสั้นๆ กดปุ่มเมนู ขอสมัคร หรือเรื่องอื่นที่ไม่ใช่สองข้อบน",
      },
    },
  },
  ihealthy: {
    intent: {
      type: "choice",
      instructions: "บทสนทนานี้ลูกค้าคุยกับตัวแทนขายประกันสุขภาพ iHealthy Ultra ข้อความล่าสุดของลูกค้าต้องการอะไร",
      criteria: {
        quote: "ขอเบี้ยประกัน อยากรู้ราคา เลือกแผน หรือให้ข้อมูลเพื่อคำนวณเบี้ย เช่น อายุ เพศ",
        plan_info: "ถามว่าคุ้มครองอะไร ค่าห้องเท่าไหร่ OPD ได้ไหม รอคอยกี่วัน ต่ออายุถึงอายุเท่าไหร่ แผนไหนต่างกันยังไง",
        other: "ทักทาย ตอบรับสั้นๆ กดปุ่มเมนู ขอสมัคร หรือเรื่องอื่นที่ไม่ใช่สองข้อบน",
      },
    },
  },
};

/** The last exchange as the judge sees it: who said what, newest last. */
function transcript(history: ChatMessage[]): string {
  return recentTurns(history, SHADOW_TURNS)
    .map((m) => `${m.role === "user" ? "ลูกค้า" : "บอท"}: ${m.content}`)
    .join("\n");
}

export interface ShadowVerdict {
  intent: Intent;
  confidence: number;
}

/**
 * Starts the judge on the conversation. Resolves to null on any failure — no key, switched
 * off, timed out, refused — because a shadow with nothing to say is a row not written, not
 * a customer not answered.
 */
export function askShadow(product: ShadowProduct, history: ChatMessage[]): Promise<ShadowVerdict | null> {
  return judge({
    task: "route_shadow",
    state: transcript(history),
    questions: QUESTIONS[product],
    signal: AbortSignal.timeout(SHADOW_TIMEOUT_MS),
  }).then((r) => {
    const a = r.answers.intent as JudgeAnswer | undefined;
    if (!a || a.type !== "choice") return null;
    const intent = (["quote", "plan_info", "other"] as const).find((i) => i === a.choice);
    return intent ? { intent, confidence: a.confidence } : null;
  }).catch((e) => {
    // switched off or without a key is the normal state outside the trial; say nothing
    if (!/TypeSafe/.test(String(e))) console.warn("route shadow:", e instanceof Error ? e.message : e);
    return null;
  });
}

/**
 * Writes the comparison once the router has decided. `modelIntent` is what the chat model
 * said; `finalIntent` is what the code settled on after its own rules, which is what the
 * customer actually got.
 */
export async function recordShadow(
  product: ShadowProduct, pending: Promise<ShadowVerdict | null>, modelIntent: Intent, finalIntent: Intent,
): Promise<void> {
  const verdict = await pending;
  if (!verdict) return;
  try {
    const { error } = await supabaseAdmin().from("ins_route_shadow").insert({
      product, model_intent: modelIntent, final_intent: finalIntent,
      jev_intent: verdict.intent, jev_confidence: Number(verdict.confidence.toFixed(3)),
      agrees_model: verdict.intent === modelIntent, agrees_final: verdict.intent === finalIntent,
    });
    if (error) console.warn("route shadow row:", error.message);
  } catch (e) {
    console.warn("route shadow row:", e instanceof Error ? e.message : e);
  }
}
