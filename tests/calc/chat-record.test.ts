import { beforeEach, describe, expect, it, vi } from "vitest";

/** what the database was asked to do, in order */
const calls: { fn: string; args: Record<string, unknown> }[] = [];
/** which table was searched, and for whom */
const selects: { table: string; userHash: string }[] = [];
let fail = false;
let foundConversation: { id: string } | null = { id: "conv-found" };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fail) return { data: null, error: { message: "database is on fire" } };
      const data = fn === "ins_open_conversation" ? "conv-1" : fn === "ins_open_lead" ? "lead-1" : null;
      return { data, error: null };
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, userHash: string) => {
          selects.push({ table, userHash });
          return {
            order: () => ({
              limit: () => ({
                maybeSingle: async () =>
                  fail ? { data: null, error: { message: "no" } } : { data: foundConversation, error: null },
              }),
            }),
          };
        },
      }),
    }),
  }),
}));

const { openConversation, attribute, record, openLead, markStalled, prune } =
  await import("@/lib/chat/record");

beforeEach(() => {
  calls.length = 0;
  selects.length = 0;
  fail = false;
  foundConversation = { id: "conv-found" };
  process.env.ADMIN_SESSION_SECRET = "passphrase";
});

describe("opening a conversation", () => {
  it("names the page, the person and the advertisement that brought them", async () => {
    const id = await openConversation(
      "facebook", "page-9", "hash-1", { source: "ADS", ad_id: "120:1", ref: "lp-a" }, "GET_STARTED",
    );
    expect(id).toBe("conv-1");
    expect(calls[0].fn).toBe("ins_open_conversation");
    expect(calls[0].args).toMatchObject({
      p_channel: "facebook", p_page_id: "page-9", p_user_hash: "hash-1",
      p_source: "ADS", p_ad_id: "120:1", p_ref: "lp-a", p_entry_payload: "GET_STARTED",
    });
  });

  it("says organic when nothing brought them", async () => {
    await openConversation("facebook", "page-9", "hash-1", undefined, undefined);
    expect(calls[0].args.p_source).toBe("organic");
    expect(calls[0].args.p_ad_id).toBeNull();
  });

  it("returns null rather than throwing when the database refuses", async () => {
    fail = true;
    await expect(openConversation("facebook", "p", "h", undefined, undefined)).resolves.toBeNull();
  });
});

describe("recording a turn", () => {
  it("sends every event of the turn in one statement", async () => {
    await record("conv-1", [
      { kind: "message" },
      { kind: "quoted", data: { age: 35, sex: "M", sum: 1_000_000, premium: 23_400 } },
    ], "lifeprotect");
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("ins_record");
    expect(calls[0].args.p_conversation).toBe("conv-1");
    expect(calls[0].args.p_product).toBe("lifeprotect");
    expect(calls[0].args.p_events).toEqual([
      { kind: "message", data: {} },
      { kind: "quoted", data: { age: 35, sex: "M", sum: 1_000_000, premium: 23_400 } },
    ]);
  });

  it("says nothing at all when the turn produced no events", async () => {
    await record("conv-1", [], "lifeprotect");
    expect(calls).toHaveLength(0);
  });

  it("does nothing when there is no conversation to record against", async () => {
    await record(null, [{ kind: "message" }], "lifeprotect");
    expect(calls).toHaveLength(0);
  });

  it("swallows a database failure, because an answer has already gone out", async () => {
    fail = true;
    await expect(record("conv-1", [{ kind: "message" }], null)).resolves.toBeUndefined();
  });
});

describe("opening a lead", () => {
  it("hands the page-scoped id over only to be encrypted", async () => {
    const id = await openLead("conv-1", "psid-1", "interested", "lifeprotect");
    expect(id).toBe("lead-1");
    expect(calls[0].fn).toBe("ins_open_lead");
    expect(calls[0].args).toMatchObject({
      p_conversation: "conv-1", p_psid: "psid-1",
      p_passphrase: "passphrase", p_stage: "interested", p_product: "lifeprotect",
    });
  });

  it("returns null rather than throwing when the database refuses", async () => {
    fail = true;
    await expect(openLead("conv-1", "psid-1", "interested", null)).resolves.toBeNull();
  });

  it("does nothing when there is no conversation to hang the lead on", async () => {
    await openLead(null, "psid-1", "interested", null);
    expect(calls).toHaveLength(0);
  });
});

describe("attributing an advertisement to a conversation already open", () => {
  it("passes what the referral said", async () => {
    await attribute("conv-1", { source: "ADS", ad_id: "120:7" });
    expect(calls[0].fn).toBe("ins_attribute");
    expect(calls[0].args).toMatchObject({ p_conversation: "conv-1", p_source: "ADS", p_ad_id: "120:7" });
  });

  it("does nothing when there is no advertisement to attribute", async () => {
    await attribute("conv-1", undefined);
    expect(calls).toHaveLength(0);
  });
});

describe("the conversation that went quiet", () => {
  it("finds the newest conversation for that person and marks it stalled", async () => {
    await markStalled("facebook", "hash-1");
    expect(selects).toContainEqual({ table: "ins_conversations", userHash: "hash-1" });
    expect(calls[0].fn).toBe("ins_record");
    expect(calls[0].args.p_conversation).toBe("conv-found");
    expect(calls[0].args.p_events).toEqual([{ kind: "stalled", data: {} }]);
  });

  it("does nothing when that person has no conversation on record", async () => {
    foundConversation = null;
    await markStalled("facebook", "hash-1");
    expect(calls).toHaveLength(0);
  });
});

describe("forgetting on a schedule", () => {
  it("asks the database to run its own retention rules", async () => {
    await expect(prune()).resolves.toBe(true);
    expect(calls[0].fn).toBe("ins_prune");
  });

  it("reports a failure rather than throwing at the scheduler", async () => {
    fail = true;
    await expect(prune()).resolves.toBe(false);
  });
});
