import { describe, expect, it, vi } from "vitest";

/**
 * The three judgements the Messenger screen makes on its own, away from Meta and the
 * database: is the subscription ours, is a waiting login still one to offer, and has the
 * inbox gone quiet.
 */

vi.mock("@/lib/supabase/admin", () => ({ supabaseAdmin: () => { throw new Error("no database in this test"); } }));

const { ourSubscription } = await import("@/lib/facebook/status");
const { pendingIsFresh, PENDING_TTL_MS } = await import("@/lib/facebook/connection");
const { inboxIsQuiet } = await import("@/lib/facebook/inbound");

describe("whether the Page sends its events to this app", () => {
  const ours = { id: "111", name: "advisortool", subscribed_fields: ["messages", "messaging_postbacks"] };
  const theirs = { id: "999", name: "some inbox tool", subscribed_fields: ["messages", "feed"] };

  it("is not fooled by another app's subscription", () => {
    expect(ourSubscription([theirs], "111")).toEqual({ subscribed: false, fields: [] });
  });

  it("counts only our own fields when several apps are subscribed", () => {
    expect(ourSubscription([theirs, ours], "111")).toEqual({
      subscribed: true,
      fields: ["messages", "messaging_postbacks"],
    });
  });

  it("says nothing rather than guess when the app id is not set", () => {
    expect(ourSubscription([ours], undefined)).toBeUndefined();
  });

  it("is unsubscribed with no apps at all", () => {
    expect(ourSubscription([], "111")).toEqual({ subscribed: false, fields: [] });
  });
});

describe("a half-finished login", () => {
  const now = new Date("2026-09-25T10:00:00Z");

  it("is offered while it is under an hour old", () => {
    expect(pendingIsFresh("2026-09-25T09:30:00Z", now)).toBe(true);
  });

  it("is treated as gone once it is an hour old", () => {
    expect(pendingIsFresh(new Date(now.getTime() - PENDING_TTL_MS).toISOString(), now)).toBe(false);
    // the row production is sitting on: saved the evening before
    expect(pendingIsFresh("2026-09-24T16:27:21.643097+00:00", now)).toBe(false);
  });

  it("is treated as gone when its time cannot be read", () => {
    expect(pendingIsFresh(null, now)).toBe(false);
    expect(pendingIsFresh("not a date", now)).toBe(false);
  });
});

describe("a quiet inbox", () => {
  const now = new Date("2026-09-25T10:00:00Z");

  it("is fine within a day", () => {
    expect(inboxIsQuiet("2026-09-24T12:00:00Z", now)).toBe(false);
  });

  it("is quiet after 24 hours, and when nothing has ever arrived", () => {
    expect(inboxIsQuiet("2026-09-24T07:57:19Z", now)).toBe(true);
    expect(inboxIsQuiet(null, now)).toBe(true);
  });
});
