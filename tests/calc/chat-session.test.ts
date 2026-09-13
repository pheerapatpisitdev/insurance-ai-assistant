import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = new Map<string, Record<string, unknown>>();
let lastUpsert: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: rows.get("session") ?? null }) }),
        }),
      }),
      upsert: async (v: Record<string, unknown>) => { lastUpsert = v; return { error: null }; },
      insert: async () => ({ error: null }),
    }),
  }),
}));

const { isMuted, loadSession, muteFor, saveSession } = await import("@/lib/chat/session");

const now = () => new Date().toISOString();

beforeEach(() => { rows.clear(); lastUpsert = null; });

describe("a conversation", () => {
  it("starts empty when nobody has written", async () => {
    expect(await loadSession("facebook", "hash")).toEqual({ messages: [], slots: null, mutedUntil: null });
  });

  it("keeps only the last six turns", async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({ role: "user" as const, content: String(i) }));
    await saveSession("facebook", "hash", messages, null, null);
    expect(lastUpsert!.messages as unknown[]).toHaveLength(6);
    expect((lastUpsert!.messages as { content: string }[])[0].content).toBe("4");
  });

  it("leaves an existing mute alone when it is only recording what was said", async () => {
    await saveSession("facebook", "hash", [{ role: "user", content: "hi" }], null);
    expect(lastUpsert).not.toHaveProperty("muted_until");
  });

  it("still writes the mute when it is asked to", async () => {
    await saveSession("facebook", "hash", [], null, muteFor());
    expect(typeof lastUpsert!.muted_until).toBe("string");
  });

  it("forgets what was said more than a day ago, but not the mute", async () => {
    const stale = new Date(Date.now() - 30 * 3600_000).toISOString();
    rows.set("session", {
      messages: [{ role: "user", content: "เมื่อวาน" }],
      slots: { intent: "quote" },
      updated_at: stale,
      muted_until: new Date(Date.now() + 3600_000).toISOString(),
    });
    const session = await loadSession("facebook", "hash");
    expect(session.messages).toEqual([]);
    expect(session.slots).toBeNull();
    expect(session.mutedUntil).not.toBeNull();
  });

  it("keeps what was said within the day", async () => {
    rows.set("session", {
      messages: [{ role: "user", content: "เมื่อกี้" }],
      slots: { intent: "quote", age: 35 },
      updated_at: now(),
      muted_until: null,
    });
    const session = await loadSession("facebook", "hash");
    expect(session.messages).toHaveLength(1);
    expect(session.slots).toMatchObject({ age: 35 });
  });
});

describe("the mute", () => {
  it("is in the future for a day after the agent types", () => {
    const at = new Date("2026-09-13T10:00:00Z");
    expect(muteFor(at).toISOString()).toBe("2026-09-14T10:00:00.000Z");
  });

  it("silences the bot while it stands", () => {
    const at = new Date("2026-09-13T10:00:00Z");
    expect(isMuted("2026-09-13T12:00:00Z", at)).toBe(true);
    expect(isMuted("2026-09-13T09:00:00Z", at)).toBe(false);
    expect(isMuted(null, at)).toBe(false);
  });
});
