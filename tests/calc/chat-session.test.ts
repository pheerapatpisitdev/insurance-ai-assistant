import { beforeEach, describe, expect, it, vi } from "vitest";

let row: Record<string, unknown> | null = null;
const upserts: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row }) }) }) }),
      upsert: async (values: Record<string, unknown>) => {
        upserts.push(values);
        return { error: null };
      },
    }),
  }),
}));

const { loadSession, saveSession } = await import("@/lib/chat/session");

const fresh = new Date().toISOString();
const stale = new Date(Date.now() - 48 * 3600_000).toISOString();

beforeEach(() => {
  row = null;
  upserts.length = 0;
});

describe("the conversation a live session belongs to", () => {
  it("comes back with the session", async () => {
    row = { messages: [], slots: {}, muted_until: null, updated_at: fresh, conversation_id: "conv-1" };
    expect((await loadSession("facebook", "h1")).conversationId).toBe("conv-1");
  });

  it("is dropped with the rest when the row has gone stale, so a new one is opened", async () => {
    row = {
      messages: [{ role: "user", content: "hi" }], slots: { age: 30 },
      muted_until: null, updated_at: stale, conversation_id: "conv-old",
    };
    const session = await loadSession("facebook", "h1");
    expect(session.conversationId).toBeNull();
    expect(session.messages).toEqual([]);
  });

  it("is null for someone who has never written before", async () => {
    expect((await loadSession("facebook", "h1")).conversationId).toBeNull();
  });

  it("is written back with the turn", async () => {
    await saveSession("facebook", "h1", [], null, undefined, "conv-2");
    expect(upserts[0].conversation_id).toBe("conv-2");
  });

  it("is left exactly as it is when the save does not mention one", async () => {
    await saveSession("facebook", "h1", [], null);
    expect(upserts[0]).not.toHaveProperty("conversation_id");
  });

  it("still leaves the mute alone when the save does not mention that either", async () => {
    await saveSession("facebook", "h1", [], null, undefined, "conv-2");
    expect(upserts[0]).not.toHaveProperty("muted_until");
  });
});

describe("a mute outliving the conversation it was written in", () => {
  it("is read from a stale row, which is the whole reason the row is read at all", async () => {
    const until = new Date(Date.now() + 3600_000).toISOString();
    row = { messages: [], slots: {}, muted_until: until, updated_at: stale, conversation_id: "conv-old" };
    const session = await loadSession("facebook", "h1");
    expect(session.mutedUntil).toBe(until);
    expect(session.conversationId).toBeNull();
  });
});
