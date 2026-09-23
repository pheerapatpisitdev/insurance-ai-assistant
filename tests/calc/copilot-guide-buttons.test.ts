import { describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

/**
 * Every opening button, pressed through the page's own router.
 *
 * `copilot-guide` checks where each button is headed by reading its words. This one sends
 * them: the need buttons are written by hand and each lands on a different machine — Life
 * Protect's brain, the health brain, the CI 123 pricer, the pension pricer — so the only
 * proof that one comes back with a figure is to ask it.
 *
 * The model is stubbed to say nothing useful. A button that still prices is one that does
 * not depend on a model reading it kindly; the health one prices only because it names a
 * ceiling the plan list really has.
 */
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify({ intent: "other" }) : "—",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});
vi.mock("@/lib/assistant/unanswered", () => ({ noteAfterAnswer: () => {} }));
vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => { throw new Error("no database in tests"); },
}));

const { answerFromKnowledge } = await import("@/lib/copilot/answer");
const { openingGuide } = await import("@/lib/copilot/guide");
const { healthTopicsFor } = await import("@/lib/health-knowledge");

const open = openingGuide().filter((g) => g.open);

describe("the buttons the page opens with, pressed", () => {
  it("prices every need button with a figure from the engine", async () => {
    for (const item of open.filter((g) => g.kind === "price").flatMap((g) => g.items)) {
      const reply = await answerFromKnowledge(item.ask);
      expect(reply.priced, item.label).toBe(true);
      expect(reply.text, item.label).toMatch(/\d{1,3}(?:,\d{3})+ บาท/);
    }
  }, 30_000);

  it("answers every claim button out of what the system holds, not by asking for an age", async () => {
    for (const item of open.filter((g) => g.kind === "rule").flatMap((g) => g.items)) {
      chat.mockClear();
      const reply = await answerFromKnowledge(item.ask);
      expect(reply.priced, item.label).toBeFalsy();
      const tasks = chat.mock.calls.map(([o]) => o.task);
      // either the health brain's written answer, with no model at all, or the library
      // holding the block that answers it
      const written = tasks.length === 0 && reply.text.length > 40;
      const fromLibrary = tasks.includes("library") && healthTopicsFor(item.ask).length > 0;
      expect(written || fromLibrary, `${item.label} → ${tasks.join(",")}`).toBe(true);
    }
  }, 30_000);
});
