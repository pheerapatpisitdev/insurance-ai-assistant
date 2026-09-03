import { NextResponse } from "next/server";
import { chat, embedTexts } from "@/lib/ai/client";

/** Temporary probe used while wiring the providers up; removed once the bot is live. */
export async function GET() {
  const out: Record<string, unknown> = {};
  try {
    const small = await chat({
      tier: "small", task: "probe",
      messages: [{ role: "user", content: 'ตอบเป็น JSON เท่านั้น: {"ok": true, "lang": "th"}' }],
      json: true, maxTokens: 50,
    });
    out.small = { provider: small.provider, model: small.model, text: small.text.slice(0, 120), costThb: small.costThb };
  } catch (e) {
    out.small = { error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  }
  try {
    const v = await embedTexts(["ทดสอบการแปลงข้อความเป็นเวกเตอร์"], "probe");
    out.embedding = { dims: v[0]?.length ?? 0 };
  } catch (e) {
    out.embedding = { error: e instanceof Error ? e.message.slice(0, 300) : String(e) };
  }
  return NextResponse.json(out);
}
