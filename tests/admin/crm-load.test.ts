import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The reads /admin and /admin/crm share, against a database that behaves like PostgREST.
 *
 * Three things went wrong silently here: a select stopped at a thousand rows and said nothing,
 * a failed query came back as an empty list, and a question could never be marked answered.
 */

const CAP = 1000;

interface Call { table: string; filters: string[]; range?: [number, number]; limit?: number; count?: boolean }

let conversations: { id: string; started_at: string }[] = [];
let failWith: { code: string; message: string } | null = null;
/** whether the answered_at column exists yet */
let hasAnsweredColumn = true;
let unanswered: { id: number; at: string; answered_at: string | null }[] = [];
let updates: { table: string; values: Record<string, unknown>; id: unknown }[] = [];
const calls: Call[] = [];

function query(table: string) {
  const call: Call = { table, filters: [] };
  calls.push(call);
  let updateValues: Record<string, unknown> | null = null;
  const q = {
    select: (_cols: string, opts?: { count?: string }) => { call.count = opts?.count === "exact"; return q; },
    gte: () => q,
    order: () => q,
    in: () => q,
    not: () => q,
    is: (col: string) => { call.filters.push(`is:${col}`); return q; },
    range: (from: number, to: number) => { call.range = [from, to]; return q; },
    limit: (n: number) => { call.limit = n; return q; },
    update: (values: Record<string, unknown>) => { updateValues = values; return q; },
    eq: (_col: string, id: unknown) => {
      if (updateValues) {
        if (!hasAnsweredColumn) return Promise.resolve({ error: { code: "PGRST204", message: "no column" } });
        updates.push({ table, values: updateValues, id });
      }
      return q;
    },
    then: (resolve: (v: unknown) => void) => resolve(result()),
  };

  function result() {
    if (failWith) return { data: null, error: failWith, count: null };
    if (table === "ins_conversations") {
      const [from, to] = call.range ?? [0, CAP - 1];
      // PostgREST's own ceiling, whatever range was asked for
      const end = Math.min(to + 1, from + CAP);
      return { data: conversations.slice(from, end), error: null };
    }
    if (table === "ins_unanswered") {
      if (call.filters.includes("is:answered_at") && !hasAnsweredColumn) {
        return { data: null, error: { code: "42703", message: "column ins_unanswered.answered_at does not exist" }, count: null };
      }
      const open = call.filters.includes("is:answered_at") ? unanswered.filter((u) => !u.answered_at) : unanswered;
      return { data: open.slice(0, call.limit ?? CAP), error: null, count: call.count ? open.length : null };
    }
    if (table === "ins_ad_daily") {
      return {
        data: [
          { ad_id: "120253430625160653", ad_name: "Life Protect + DCI (new name)", date: "2026-09-24" },
          { ad_id: "120253430625160653", ad_name: "Life Protect + DCI", date: "2026-09-20" },
        ],
        error: null,
      };
    }
    return { data: [], error: null };
  }
  return q;
}

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({ from: (t: string) => query(t), rpc: async () => ({ data: [], error: null }) }),
}));

const { conversationsSince, openQuestions, markAnswered, adNames } = await import("@/lib/crm/load");

beforeEach(() => {
  conversations = [];
  failWith = null;
  hasAnsweredColumn = true;
  unanswered = [];
  updates = [];
  calls.length = 0;
});

describe("reading every conversation", () => {
  it("reads past the thousand rows a single select would stop at", async () => {
    conversations = Array.from({ length: 2345 }, (_, i) => ({ id: `c${i}`, started_at: "2026-09-20T00:00:00Z" }));
    const rows = await conversationsSince(new Date("2026-09-01T00:00:00Z"));
    expect(rows).toHaveLength(2345);
    expect(new Set(rows.map((r) => r.id)).size).toBe(2345);
  });

  it("throws on a failed read rather than answering with nobody", async () => {
    failWith = { code: "57014", message: "canceling statement due to statement timeout" };
    await expect(conversationsSince(new Date())).rejects.toThrow("อ่านข้อมูลไม่สำเร็จ");
  });
});

describe("open questions", () => {
  it("counts only the unanswered ones, and all of them, not the fifty shown", async () => {
    unanswered = [
      ...Array.from({ length: 96 }, (_, i) => ({ id: i + 1, at: "2026-09-24T00:00:00Z", answered_at: null })),
      { id: 500, at: "2026-09-24T00:00:00Z", answered_at: "2026-09-25T00:00:00Z" },
    ];
    const open = await openQuestions(50);
    expect(open.rows).toHaveLength(50);
    expect(open.total).toBe(96);
    expect(open.canMark).toBe(true);
  });

  it("shows every question, without the button, until the column exists", async () => {
    hasAnsweredColumn = false;
    unanswered = [{ id: 1, at: "2026-09-24T00:00:00Z", answered_at: null }];
    const open = await openQuestions(50);
    expect(open.total).toBe(1);
    expect(open.canMark).toBe(false);
  });

  it("throws on any other failure", async () => {
    failWith = { code: "08006", message: "connection failure" };
    await expect(openQuestions(50)).rejects.toThrow("อ่านข้อมูลไม่สำเร็จ");
  });

  it("stamps answered_at on the one question named", async () => {
    await markAnswered(7, new Date("2026-09-25T03:00:00Z"));
    expect(updates).toEqual([{ table: "ins_unanswered", values: { answered_at: "2026-09-25T03:00:00.000Z" }, id: 7 }]);
  });

  it("says in Thai that the database is not ready when the column is missing", async () => {
    hasAnsweredColumn = false;
    await expect(markAnswered(7)).rejects.toThrow("ต้องอัปเดตฐานข้อมูลก่อน");
  });
});

describe("advertisement names", () => {
  it("names an advertisement by its newest name and leaves an unknown id out", async () => {
    const names = await adNames(["120253430625160653", "999", null]);
    expect(names.get("120253430625160653")).toBe("Life Protect + DCI (new name)");
    expect(names.has("999")).toBe(false);
  });

  it("asks nothing when there are no ids", async () => {
    expect((await adNames([null, undefined])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });
});
