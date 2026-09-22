import { describe, expect, it, vi } from "vitest";

/**
 * The month's spend, read from the ledger as a sum rather than as rows.
 *
 * The client library returns at most 1,000 rows of any select, and says nothing when it
 * stops. On 2026-09-22 the spend card showed exactly 1,000 calls at ฿29.68 while the table
 * held 1,180 at ฿34.54 — and the budget guard, reading the same way, was watching a number
 * that had quietly stopped moving. A budget that under-counts is not a budget.
 */

const CAP = 1000;

/** what the real client does with a select: the first thousand rows, and no complaint */
function ledgerClient(rows: { model: string; task: string; cost_thb: number }[]) {
  const rpc = vi.fn(async (name: string, args: { p_since: string }) => {
    if (name !== "ins_month_spend") return { data: null, error: { message: `no ${name}` } };
    const acc = new Map<string, { model: string; task: string; calls: number; cost_thb: number }>();
    for (const r of rows) {
      const k = `${r.model}|${r.task}`;
      const at = acc.get(k) ?? { model: r.model, task: r.task, calls: 0, cost_thb: 0 };
      at.calls += 1;
      at.cost_thb += r.cost_thb;
      acc.set(k, at);
    }
    return { data: [...acc.values()], error: null, since: args.p_since };
  });
  const ranged = vi.fn();
  /** a select: thenable for the capped first page, `.range` for an explicit slice of it */
  const query = () => {
    const page = (from: number, to: number) => ({ data: rows.slice(from, Math.min(to + 1, from + CAP)), error: null });
    const q = {
      order: () => q,
      range: async (from: number, to: number) => { ranged(from, to); return page(from, to); },
      then: (ok: (v: unknown) => unknown) => Promise.resolve(page(0, rows.length)).then(ok),
    };
    return q;
  };
  return {
    rpc,
    ranged,
    from: () => ({ select: () => ({ gte: query }) }),
  };
}

const rows = [
  ...Array.from({ length: 1150 }, () => ({ model: "gemini-3.1-flash-lite", task: "route", cost_thb: 0.03 })),
  ...Array.from({ length: 30 }, () => ({ model: "claude-sonnet-5", task: "copilot", cost_thb: 0.5 })),
];

const client = ledgerClient(rows);
vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => client }));
const { monthSpend } = await import("@/lib/ai/ledger");

const SINCE = new Date("2026-09-01T00:00:00Z");

describe("the month's spend", () => {
  it("counts every call, not the first thousand", async () => {
    const s = await monthSpend(SINCE);
    expect(s.calls).toBe(1180);
    expect(s.baht).toBeCloseTo(1150 * 0.03 + 30 * 0.5, 6);
  });

  it("keeps the model and task of each line, so the card can say who was paid for what", async () => {
    const s = await monthSpend(SINCE);
    expect(s.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ model: "gemini-3.1-flash-lite", task: "route", calls: 1150 }),
      expect.objectContaining({ model: "claude-sonnet-5", task: "copilot", calls: 30 }),
    ]));
  });

  it("asks from the moment it is given", async () => {
    await monthSpend(SINCE);
    expect(client.rpc).toHaveBeenLastCalledWith("ins_month_spend", { p_since: "2026-09-01T00:00:00.000Z" });
  });

  it("does not report a failed read as a free month", async () => {
    client.rpc.mockResolvedValueOnce({ data: null, error: { message: "down" } } as never);
    await expect(monthSpend(SINCE)).rejects.toThrow(/down/);
  });

  /**
   * The function arrives by a migration and the code by a deploy, and nothing orders the
   * two. Until the function is there the rows are paged through explicitly — slower, still
   * exact — rather than the bot refusing every customer for want of a sum.
   */
  it("pages through the rows, all of them, while the function is not there yet", async () => {
    client.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "Could not find the function" } } as never);
    client.ranged.mockClear();
    const s = await monthSpend(SINCE);
    expect(s.calls).toBe(1180);
    expect(s.baht).toBeCloseTo(1150 * 0.03 + 30 * 0.5, 6);
    expect(s.lines).toEqual(expect.arrayContaining([
      expect.objectContaining({ model: "claude-sonnet-5", task: "copilot", calls: 30 }),
    ]));
    expect(client.ranged.mock.calls.length).toBeGreaterThan(1);
  });
});
