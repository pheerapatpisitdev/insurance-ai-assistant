/**
 * A rehearsal bench for the Messenger bot: feeds one message through the real answer path,
 * with the real model and the real rate tables, and keeps the conversation's slots on disk
 * so the next message continues it.
 *
 * Inert unless CHAT_MSG is set, so `npm run verify` neither calls a provider nor spends a
 * satang. Run it as:  CHAT_MSG="สนใจครับ" npx vitest run tests/calc/chat-harness.test.ts
 * and CHAT_RESET=1 to begin a new conversation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const STATE = process.env.CHAT_STATE ?? "/tmp/bot-rehearsal.json";
const MSG = process.env.CHAT_MSG ?? "";

describe("rehearsal", () => {
  it.skipIf(!MSG)("answers one message", async () => {
    for (const line of fs.readFileSync(path.resolve(".env.local"), "utf8").split("\n")) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
    const { answerAny } = await import("@/lib/assistant/dispatch");

    const fresh = process.env.CHAT_RESET === "1" || !fs.existsSync(STATE);
    const state = fresh
      ? { history: [] as { role: "user" | "assistant"; content: string }[], slots: null as unknown }
      : JSON.parse(fs.readFileSync(STATE, "utf8"));

    const history = [...state.history, { role: "user" as const, content: MSG }];
    const started = Date.now();
    const answer = await answerAny(history, state.slots);

    console.log(`\n👤 ลูกค้า: ${MSG}`);
    answer.messages.forEach((m, i) => {
      console.log(`\n🤖 บอท (ข้อความที่ ${i + 1}/${answer.messages.length}):\n${m.text}`);
      if (m.card) console.log(`   [ส่งรูปการ์ด] https://www.advisortool.app${m.card}`);
    });
    console.log(`\n⏱  ${((Date.now() - started) / 1000).toFixed(1)} วินาที · ข้อมูลที่บอทจำไว้: ${JSON.stringify(answer.slots)}`);

    fs.writeFileSync(STATE, JSON.stringify({
      history: [...history, { role: "assistant", content: answer.messages.map((m) => m.text).join("\n\n") }].slice(-10),
      slots: answer.slots,
    }));
    expect(answer.messages.length).toBeGreaterThan(0);
  }, 120_000);
});
