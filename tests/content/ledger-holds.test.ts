import { describe, expect, it, vi } from "vitest";

/**
 * Money a content round sets aside is written to the ledger as a row of its own. Only the
 * content ceiling may count it: the assistant's budget guard and the admin cards read the
 * same ledger, and a hold is not money paid.
 */

const lines = [
  { model: "claude-sonnet-5", task: "content", calls: 2, cost_thb: 1.2 },
  { model: "reservation", task: "content-reserve", calls: 1, cost_thb: 3 },
  { model: "gemini-3.1-flash-lite", task: "route", calls: 10, cost_thb: 0.3 },
];
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => ({ rpc: async () => ({ data: lines, error: null }) }) }));
const { monthSpend } = await import("@/lib/ai/ledger");

describe("monthSpend and holds", () => {
  it("leaves holds out by default — the bot's guard and the admin totals see money paid", async () => {
    const s = await monthSpend(new Date("2026-09-01T00:00:00Z"));
    expect(s.baht).toBeCloseTo(1.5);
    expect(s.calls).toBe(12);
    expect(s.lines.some((l) => l.model === "reservation")).toBe(false);
  });

  it("counts them when asked, for the content ceiling", async () => {
    const s = await monthSpend(new Date("2026-09-01T00:00:00Z"), { holds: true });
    expect(s.baht).toBeCloseTo(4.5);
  });
});
