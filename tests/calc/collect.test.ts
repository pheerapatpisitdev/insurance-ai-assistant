import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const calls: { fn: string; args: Record<string, unknown> }[] = [];
let reply: { data?: unknown; error?: { message: string } | null } = { data: "conv-uuid", error: null };
let throwOnRpc = false;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      if (throwOnRpc) throw new Error("network");
      calls.push({ fn, args });
      return reply;
    },
  }),
}));

const { attribute, formRefOf, openConversation, openLead, record } = await import("@/lib/chat/collect");

const secretBefore = process.env.ADMIN_SESSION_SECRET;

beforeEach(() => {
  calls.length = 0;
  reply = { data: "conv-uuid", error: null };
  throwOnRpc = false;
  process.env.ADMIN_SESSION_SECRET = "pass";
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  if (secretBefore === undefined) delete process.env.ADMIN_SESSION_SECRET;
  else process.env.ADMIN_SESSION_SECRET = secretBefore;
});

describe("opening a conversation", () => {
  it("names where it came from, or organic when nowhere", async () => {
    const id = await openConversation({
      channel: "facebook", userHash: "h", pageId: "page",
      referral: { source: "ads", adId: "12", raw: { source: "ADS", ad_id: "12" } },
    });
    expect(id).toBe("conv-uuid");
    expect(calls[0]).toEqual({
      fn: "ins_open_conversation",
      args: expect.objectContaining({ p_source: "ads", p_ad_id: "12", p_user_hash: "h", p_page_id: "page", p_referral: { source: "ADS", ad_id: "12" } }),
    });
    await openConversation({ channel: "facebook", userHash: "h" });
    expect(calls[1].args).toMatchObject({ p_source: "organic", p_ad_id: null, p_referral: null });
  });

  it("gives back nothing, and throws nothing, when the database refuses", async () => {
    reply = { data: null, error: { message: "relation missing" } };
    expect(await openConversation({ channel: "facebook", userHash: "h" })).toBeNull();
    throwOnRpc = true;
    expect(await openConversation({ channel: "facebook", userHash: "h" })).toBeNull();
  });
});

describe("recording a turn", () => {
  it("sends the events and the unanswered questions in one call", async () => {
    await record("c", [{ kind: "message", data: { chars: 3 } }], "lifeprotect", [{ intent: "other", route: "model", question: "q" }]);
    expect(calls).toEqual([{
      fn: "ins_record",
      args: {
        p_conversation: "c",
        p_events: [{ kind: "message", data: { chars: 3 } }],
        p_product: "lifeprotect",
        p_unanswered: [{ intent: "other", route: "model", question: "q" }],
      },
    }]);
  });

  it("makes no call when there is nothing to say", async () => {
    await record("c", [], "lifeprotect");
    expect(calls).toEqual([]);
  });

  it("swallows a failure", async () => {
    throwOnRpc = true;
    await expect(record("c", [{ kind: "message" }], null)).resolves.toBeUndefined();
  });
});

describe("a lead", () => {
  it("is opened with the thread id sealed by the same passphrase as the page token", async () => {
    await openLead({ conversationId: "c", psid: "psid-1", stage: "form_sent", product: "lifeprotect", formRef: "abc" });
    expect(calls[0]).toEqual({
      fn: "ins_open_lead",
      args: { p_conversation: "c", p_psid: "psid-1", p_passphrase: "pass", p_stage: "form_sent", p_product: "lifeprotect", p_form_ref: "abc" },
    });
  });

  it("is not opened, and nothing breaks, without the passphrase", async () => {
    delete process.env.ADMIN_SESSION_SECRET;
    await expect(openLead({ conversationId: "c", psid: "p", stage: "interested", product: null })).resolves.toBeUndefined();
    expect(calls).toEqual([]);
  });
});

describe("attribution and the form code", () => {
  it("passes a later referral through", async () => {
    await attribute("c", { source: "ads", adId: "9", ref: "r", raw: { source: "ADS" } });
    expect(calls[0]).toEqual({
      fn: "ins_attribute",
      args: { p_conversation: "c", p_source: "ads", p_ad_id: "9", p_ref: "r", p_referral: { source: "ADS" } },
    });
  });

  it("is ten characters of the conversation id, with the dashes gone", () => {
    expect(formRefOf("0f3c2a9b-1d2e-4f5a-8b7c-9d0e1f2a3b4c")).toBe("0f3c2a9b1d");
  });
});
