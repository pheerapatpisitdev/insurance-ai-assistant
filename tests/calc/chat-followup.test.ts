import { beforeEach, describe, expect, it, vi } from "vitest";

/** what the database was asked to do, in order */
const calls: { fn: string; args: Record<string, unknown> }[] = [];
let secretRow: { secret: string } | null = { secret: "the-word" };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      return { data: fn === "ins_claim_followups" ? [{ user_hash: "h1", psid: "psid-1" }] : null, error: null };
    },
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: secretRow }) }) }),
    }),
  }),
}));

const { armFollowup, claimDueFollowups, dropFollowup, FOLLOWUP_REPLIES, FOLLOWUP_TEXT, SILENCE_MS } =
  await import("@/lib/chat/followup");
const { cronCallerIsOurs } = await import("@/lib/chat/cron-token");
const { asksCheaper, wantsToBuy } = await import("@/lib/assistant/common");
const { asksValueTable } = await import("@/lib/assistant/lifeprotect/route");

beforeEach(() => {
  calls.length = 0;
  secretRow = { secret: "the-word" };
  process.env.ADMIN_SESSION_SECRET = "passphrase";
});

describe("the one question sent into a silence", () => {
  it("is armed five minutes out, and expires within the day Meta allows", async () => {
    const now = new Date("2026-09-15T03:00:00.000Z");
    await armFollowup("facebook", "h1", "psid-1", now);
    const { args } = calls[0];
    expect(calls[0].fn).toBe("ins_arm_followup");
    expect(args.p_due_at).toBe(new Date(now.getTime() + SILENCE_MS).toISOString());
    expect(args.p_expires_at).toBe(new Date(now.getTime() + 24 * 3600_000).toISOString());
    expect(SILENCE_MS).toBe(5 * 60_000);
  });

  it("hands the page-scoped id over only to be encrypted, never stored as it arrived", async () => {
    await armFollowup("facebook", "h1", "psid-1");
    expect(calls[0].args.p_psid).toBe("psid-1");
    expect(calls[0].args.p_passphrase).toBe("passphrase");
  });

  it("is dropped the moment anyone speaks", async () => {
    await dropFollowup("facebook", "h1");
    expect(calls[0]).toMatchObject({ fn: "ins_drop_followup", args: { p_user_hash: "h1" } });
  });

  it("claims what is due, which is the same statement that marks it sent", async () => {
    expect(await claimDueFollowups("facebook")).toEqual([{ userHash: "h1", psid: "psid-1" }]);
    expect(calls[0].fn).toBe("ins_claim_followups");
  });

  it("says something both doors of which the bot can walk through itself", () => {
    expect(FOLLOWUP_TEXT).not.toContain("สนใจไหม");
    for (const title of FOLLOWUP_REPLIES) {
      expect(title.length, title).toBeLessThanOrEqual(20);
      const heard = asksCheaper(title) || asksValueTable(title) || wantsToBuy(title, true);
      expect(heard, title).toBe(true);
    }
  });
});

describe("who may make the page speak", () => {
  it("is whoever carries the word the database holds", async () => {
    expect(await cronCallerIsOurs("Bearer the-word")).toBe(true);
    expect(await cronCallerIsOurs("the-word")).toBe(true);
  });

  it("is nobody else", async () => {
    expect(await cronCallerIsOurs("Bearer wrong")).toBe(false);
    expect(await cronCallerIsOurs(null)).toBe(false);
    expect(await cronCallerIsOurs("Bearer ")).toBe(false);
  });

  it("is nobody at all when the database holds no word", async () => {
    secretRow = null;
    expect(await cronCallerIsOurs("Bearer the-word")).toBe(false);
  });
});
