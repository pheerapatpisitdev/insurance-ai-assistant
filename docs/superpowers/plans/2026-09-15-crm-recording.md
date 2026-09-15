# CRM Recording Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Messenger bot record every conversation, milestone and lead into the `ins_conversations` / `ins_events` / `ins_leads` tables that already exist in Supabase but have never been written to, and capture which ad each customer arrived from.

**Architecture:** A new `src/lib/chat/record.ts` wraps the six `ins_*` RPCs that already exist. It never throws — a database failure must never cost a customer their answer. `conversation.ts` collects events in an array during the turn and makes exactly one `ins_record` call after the customer has been answered. The conversation's id rides on the existing-but-unused `ins_chat_sessions.conversation_id` column.

**Tech Stack:** Next.js App Router (Node runtime), Supabase JS client with service role, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-crm-dashboard-design.md`

**Out of scope for this plan:** the `/admin/crm` page (separate plan), ad spend / cost-per-lead (needs `ads_read`).

---

## Ground rules

1. **Recording never throws.** Every function in `record.ts` catches its own errors and logs them. A test asserts this.
2. **The `kind` vocabulary is not ours to choose.** `ins_record` matches on exact strings — `message`, `routed`, `plan_info`, `small_talk`, `quoted`, `form_sent`, `form_done`, `agent_replied`, `stalled`, `handover`. Any other string inserts a row but moves no milestone.
3. **Never record the customer's words.** `data` carries figures and enums only. The single exception is `ins_unanswered.question`, which is out of scope for this plan.
4. **Existing behaviour must not change.** Dedup, human takeover, follow-up and rate limiting all keep working exactly as they do now.
5. `npm run verify` must pass before every commit.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/chat/record.ts` | **Create.** The only place that calls the CRM RPCs. Swallows all errors. |
| `src/lib/facebook/events.ts` | **Modify.** Add the `referral` shape and `referralOf()` that reads all three places Meta puts it. |
| `src/lib/facebook/oauth.ts` | **Modify.** Add `messaging_referrals` to `SUBSCRIBED_FIELDS`. |
| `src/lib/chat/session.ts` | **Modify.** Carry `conversation_id` in and out of the session row. |
| `src/lib/facebook/conversation.ts` | **Modify.** Open the conversation, collect events, record once, open the lead. |
| `src/app/api/facebook/webhook/route.ts` | **Modify.** Pass `entry.id` (the page id) into `handle()`. |
| `src/app/api/cron/prune/route.ts` | **Create.** Calls `ins_prune()` behind the existing cron token. |
| `tests/calc/chat-record.test.ts` | **Create.** Tests `record.ts` against a mocked Supabase. |
| `tests/calc/facebook.test.ts` | **Modify.** Tests for `referralOf()`. |

---

## Task 1: Read the referral wherever Meta hid it

Meta puts the ad information in three different places depending on the ad's shape. One function reads all three so nothing downstream has to care.

**Files:**
- Modify: `src/lib/facebook/events.ts:7-13`
- Test: `tests/calc/facebook.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `tests/calc/facebook.test.ts`:

```ts
describe("where the advertisement is named", () => {
  it("reads a referral sent on its own, which is what an ad with no button sends", () => {
    expect(referralOf({ referral: { source: "ADS", type: "OPEN_THREAD", ad_id: "120:1" } }))
      .toEqual({ source: "ADS", ad_id: "120:1", ref: undefined });
  });

  it("reads one riding on the Get Started button", () => {
    expect(referralOf({ postback: { title: "เริ่ม", referral: { source: "ADS", ad_id: "120:2" } } }))
      .toEqual({ source: "ADS", ad_id: "120:2", ref: undefined });
  });

  it("reads one riding on the first message", () => {
    expect(referralOf({ message: { text: "สนใจ", referral: { source: "ADS", ad_id: "120:3", ref: "lp-a" } } }))
      .toEqual({ source: "ADS", ad_id: "120:3", ref: "lp-a" });
  });

  it("keeps a shortlink referral, which carries a ref and no ad", () => {
    expect(referralOf({ referral: { source: "SHORTLINK", type: "OPEN_THREAD", ref: "line-card" } }))
      .toEqual({ source: "SHORTLINK", ad_id: undefined, ref: "line-card" });
  });

  it("says nothing about an ordinary message, so nothing is attributed to an ad", () => {
    expect(referralOf({ message: { text: "สวัสดี" } })).toBeUndefined();
    expect(referralOf({})).toBeUndefined();
  });

  it("prefers the standalone referral when an event somehow carries two", () => {
    expect(referralOf({
      referral: { source: "ADS", ad_id: "outer" },
      message: { text: "hi", referral: { source: "ADS", ad_id: "inner" } },
    })?.ad_id).toBe("outer");
  });
});
```

Add `referralOf` to the import at the top of the file:

```ts
import { agentTyped, customerOf, eventKey, referralOf, textOf, type Messaging } from "@/lib/facebook/events";
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/calc/facebook.test.ts`
Expected: FAIL — `referralOf is not a function` (or a TypeScript error that it is not exported).

- [ ] **Step 3: Write the implementation**

In `src/lib/facebook/events.ts`, replace the `Messaging` interface (lines 7-13) with:

```ts
/**
 * What Meta says about the advertisement a customer arrived through.
 *
 * `ads_context_data` and the rest of the object are deliberately not typed: nothing here
 * needs the ad's title or its video, and a shape Meta extends should not break a build.
 */
export interface FacebookReferral {
  source?: string;
  type?: string;
  ref?: string;
  ad_id?: string;
}

export interface Messaging {
  sender?: { id?: string };
  recipient?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; app_id?: number | string; referral?: FacebookReferral };
  postback?: { title?: string; payload?: string; referral?: FacebookReferral };
  referral?: FacebookReferral;
}

/** What a referral is worth keeping: which advertisement, and whatever the link labelled itself. */
export interface Referral {
  source?: string;
  ad_id?: string;
  ref?: string;
}
```

Append to the end of the same file:

```ts
/**
 * Which advertisement brought this customer, from whichever of the three places Meta put it.
 *
 * A thread opened from an ad with no button arrives as a referral of its own; one with a Get
 * Started button carries it on the postback; and the first message of a new thread carries a
 * copy too — but only for a page subscribed to `messaging_referrals` as well as `messages`,
 * which is why that field is subscribed even though nothing reads the event it delivers.
 */
export function referralOf(event: Messaging): Referral | undefined {
  const r = event.referral ?? event.postback?.referral ?? event.message?.referral;
  if (!r) return undefined;
  return { source: r.source, ad_id: r.ad_id, ref: r.ref };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/calc/facebook.test.ts`
Expected: PASS, all tests in the file.

- [ ] **Step 5: Commit**

```bash
npm run verify && \
git add src/lib/facebook/events.ts tests/calc/facebook.test.ts && \
git commit -m "feat(crm): read the advertisement from all three places Meta puts it

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: Subscribe to the field that makes the referral arrive

Without `messaging_referrals` subscribed, `message.referral` is not delivered either — Meta requires both. This is a one-line change with a test that pins the reason.

**Files:**
- Modify: `src/lib/facebook/oauth.ts:28`
- Test: `tests/calc/facebook.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/facebook.test.ts`:

```ts
describe("what the page is subscribed to", () => {
  it("asks for referrals, without which an ad's first message carries no ad id", () => {
    expect(SUBSCRIBED_FIELDS).toContain("messaging_referrals");
  });

  it("still asks for the three it already needed", () => {
    expect(SUBSCRIBED_FIELDS).toEqual(
      expect.arrayContaining(["messages", "messaging_postbacks", "message_echoes"]),
    );
  });
});
```

Add the import at the top of the file:

```ts
import { SUBSCRIBED_FIELDS } from "@/lib/facebook/oauth";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/facebook.test.ts -t "asks for referrals"`
Expected: FAIL — the array does not contain `messaging_referrals`.

- [ ] **Step 3: Write the implementation**

In `src/lib/facebook/oauth.ts`, replace lines 19-28 (the comment and the constant) with:

```ts
/**
 * The events the webhook actually handles: typed messages, taps on ice breakers or buttons,
 * and the page's own outgoing messages.
 *
 * The third of those is not about answering anyone. It is the only way to learn that the
 * agent has replied by hand, which is what tells the bot to stay out of that thread — a page
 * subscribed without it has a bot that talks over its own agent.
 *
 * The fourth is subscribed for a copy of itself. A thread opened from an advertisement
 * carries the ad's id on its first message, but Meta only sends that copy to a page that
 * also subscribes to the standalone referral — so the field is asked for whether or not the
 * event it delivers is ever read.
 */
export const SUBSCRIBED_FIELDS = [
  "messages", "messaging_postbacks", "message_echoes", "messaging_referrals",
];
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/calc/facebook.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run verify && \
git add src/lib/facebook/oauth.ts tests/calc/facebook.test.ts && \
git commit -m "feat(crm): subscribe to referrals, without which the ad id never arrives

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Note the manual follow-up**

The page is already connected, and a connected page does not pick up a new subscribed field
on its own. After deploying, re-run the subscribe call — either by reconnecting the page at
`/admin/messenger`, or by confirming the existing connect flow re-subscribes on every visit.
Verify in Meta's App Dashboard that `messaging_referrals` is listed for the LuckyPlanner page
before trusting any `ad_id` in the data.

---

## Task 3: The recording module

**Files:**
- Create: `src/lib/chat/record.ts`
- Test: `tests/calc/chat-record.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/calc/chat-record.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

/** what the database was asked to do, in order */
const calls: { fn: string; args: Record<string, unknown> }[] = [];
let fail = false;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fail) return { data: null, error: { message: "database is on fire" } };
      return { data: fn === "ins_open_conversation" ? "conv-1" : fn === "ins_open_lead" ? "lead-1" : null, error: null };
    },
  }),
}));

const { openConversation, attribute, record, openLead } = await import("@/lib/chat/record");

beforeEach(() => {
  calls.length = 0;
  fail = false;
  process.env.ADMIN_SESSION_SECRET = "passphrase";
});

describe("opening a conversation", () => {
  it("names the page, the person and the advertisement that brought them", async () => {
    const id = await openConversation("facebook", "page-9", "hash-1",
      { source: "ADS", ad_id: "120:1", ref: "lp-a" }, "GET_STARTED");
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
      { kind: "quoted", data: { age: 35, sex: "M", plan: "20/10", sum: 1_000_000, premium: 23_400, mode: "annual" } },
    ], "lifeprotect");
    expect(calls).toHaveLength(1);
    expect(calls[0].fn).toBe("ins_record");
    expect(calls[0].args.p_conversation).toBe("conv-1");
    expect(calls[0].args.p_product).toBe("lifeprotect");
    expect(calls[0].args.p_events).toEqual([
      { kind: "message", data: {} },
      { kind: "quoted", data: { age: 35, sex: "M", plan: "20/10", sum: 1_000_000, premium: 23_400, mode: "annual" } },
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

  it("swallows a database failure, because an answer already went out", async () => {
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
});

describe("attributing an advertisement to a conversation already open", () => {
  it("passes what the referral said", async () => {
    await attribute("conv-1", { source: "ADS", ad_id: "120:7", ref: null ?? undefined });
    expect(calls[0].fn).toBe("ins_attribute");
    expect(calls[0].args).toMatchObject({ p_conversation: "conv-1", p_source: "ADS", p_ad_id: "120:7" });
  });

  it("does nothing when there is no advertisement to attribute", async () => {
    await attribute("conv-1", undefined);
    expect(calls).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/calc/chat-record.test.ts`
Expected: FAIL — cannot resolve `@/lib/chat/record`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/chat/record.ts`:

```ts
import { supabaseAdmin } from "@/lib/supabase/admin";
import type { Referral } from "@/lib/facebook/events";
import type { Channel } from "./session";

/**
 * What the bot keeps about a conversation, and the one place that writes it.
 *
 * Nothing here throws. Every function is called after the customer has already been answered,
 * so a database that is down is a gap in a report — not a person left waiting in an inbox
 * that was paid for. The caller is never asked to handle a failure it could not act on.
 */

/**
 * The kinds `ins_record` knows.
 *
 * They are not ours to choose: the function matches these exact strings to decide which
 * milestone to stamp and which counter to raise. A kind spelled any other way is stored as a
 * row and moves nothing, which is the quietest kind of bug this table can have.
 */
export type EventKind =
  | "message"
  | "routed" | "plan_info" | "small_talk"
  | "quoted"
  | "form_sent" | "form_done"
  | "agent_replied" | "stalled" | "handover";

/** One thing that happened, and the figures that describe it — never the customer's words. */
export interface RecordedEvent {
  kind: EventKind;
  data?: Record<string, unknown>;
}

function passphrase(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

/** Open a row for a conversation that is starting now, and return its id. */
export async function openConversation(
  channel: Channel,
  pageId: string,
  userHash: string,
  referral: Referral | undefined,
  entryPayload: string | undefined,
): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin().rpc("ins_open_conversation", {
      p_channel: channel,
      p_page_id: pageId,
      p_user_hash: userHash,
      p_source: referral?.source ?? "organic",
      p_ad_id: referral?.ad_id ?? null,
      p_ref: referral?.ref ?? null,
      p_referral: referral ?? null,
      p_entry_payload: entryPayload ?? null,
    });
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  } catch (e) {
    console.error("เปิดบทสนทนาไม่สำเร็จ:", e);
    return null;
  }
}

/**
 * Name the advertisement on a conversation that is already open.
 *
 * `ins_attribute` coalesces, so the first advertisement to claim a conversation keeps it: a
 * customer who comes back through a second ad is still counted for the one that found them.
 */
export async function attribute(conversationId: string | null, referral: Referral | undefined): Promise<void> {
  if (!conversationId || !referral) return;
  try {
    const { error } = await supabaseAdmin().rpc("ins_attribute", {
      p_conversation: conversationId,
      p_source: referral.source ?? null,
      p_ad_id: referral.ad_id ?? null,
      p_ref: referral.ref ?? null,
      p_referral: referral,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("บันทึกที่มาของลูกค้าไม่สำเร็จ:", e);
  }
}

/**
 * Everything one turn did, in one statement.
 *
 * One call rather than one per event because the same statement raises the counters and
 * stamps the milestones: sending them separately would count a turn twice if the second call
 * failed and was retried.
 */
export async function record(
  conversationId: string | null,
  events: RecordedEvent[],
  product: string | null,
  unanswered: { intent?: string; route?: string; question: string }[] = [],
): Promise<void> {
  if (!conversationId || (events.length === 0 && unanswered.length === 0)) return;
  try {
    const { error } = await supabaseAdmin().rpc("ins_record", {
      p_conversation: conversationId,
      p_events: events.map((e) => ({ kind: e.kind, data: e.data ?? {} })),
      p_product: product,
      p_unanswered: unanswered,
    });
    if (error) throw new Error(error.message);
  } catch (e) {
    console.error("บันทึกเหตุการณ์ไม่สำเร็จ:", e);
  }
}

/**
 * The customer asked to go further, so their id is kept — encrypted — against this conversation.
 *
 * `ins_open_lead` is an upsert with one lead per conversation, and its stage only ever climbs:
 * calling it again with `interested` after `form_done` leaves `form_done` alone.
 */
export async function openLead(
  conversationId: string | null,
  psid: string,
  stage: "interested" | "form_sent" | "form_done",
  product: string | null,
  formRef?: string,
): Promise<string | null> {
  if (!conversationId) return null;
  try {
    const { data, error } = await supabaseAdmin().rpc("ins_open_lead", {
      p_conversation: conversationId,
      p_psid: psid,
      p_passphrase: passphrase(),
      p_stage: stage,
      p_product: product,
      p_form_ref: formRef ?? null,
    });
    if (error) throw new Error(error.message);
    return (data as string | null) ?? null;
  } catch (e) {
    console.error("เปิดรายชื่อผู้สนใจไม่สำเร็จ:", e);
    return null;
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/calc/chat-record.test.ts`
Expected: PASS, all 11 tests.

- [ ] **Step 5: Commit**

```bash
npm run verify && \
git add src/lib/chat/record.ts tests/calc/chat-record.test.ts && \
git commit -m "feat(crm): the module that writes what the tables were built for

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Carry the conversation id on the session

`ins_chat_sessions.conversation_id` has existed all along and nothing has ever written it. The session is where a turn already looks up who it is talking to, so it is where the conversation's id belongs.

**Files:**
- Modify: `src/lib/chat/session.ts:21-25` (the `Session` interface), `:42-55` (`loadSession`), `:65-82` (`saveSession`)
- Test: `tests/calc/chat-session.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `tests/calc/chat-session.test.ts`:

```ts
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
const old = new Date(Date.now() - 48 * 3600_000).toISOString();

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
    row = { messages: [{ role: "user", content: "hi" }], slots: { age: 30 }, muted_until: null, updated_at: old, conversation_id: "conv-old" };
    const s = await loadSession("facebook", "h1");
    expect(s.conversationId).toBeNull();
    expect(s.messages).toEqual([]);
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
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/calc/chat-session.test.ts`
Expected: FAIL — `conversationId` is `undefined`, and `saveSession` takes no sixth argument.

- [ ] **Step 3: Write the implementation**

In `src/lib/chat/session.ts`, add to the `Session` interface (after `mutedUntil`):

```ts
  /** the conversation row this live session is part of, or null when none has been opened */
  conversationId: string | null;
```

Replace the body of `loadSession` (lines 43-55) with:

```ts
  const { data } = await supabaseAdmin()
    .from("ins_chat_sessions")
    .select("messages, slots, muted_until, updated_at, conversation_id")
    .eq("channel", channel)
    .eq("user_hash", userHash)
    .maybeSingle();
  if (!data) return { messages: [], slots: null, mutedUntil: null, conversationId: null };

  const fresh = new Date(data.updated_at).getTime() > Date.now() - MAX_AGE_HOURS * 3600_000;
  const stored = fresh && Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [];
  const slots = fresh && data.slots && Object.keys(data.slots).length ? (data.slots as AnySlots) : null;
  // a stale row is a different customer as far as the bot is concerned, and a conversation
  // that carried on into it would report one visit where there were two
  const conversationId = fresh ? ((data.conversation_id as string | null) ?? null) : null;
  return { messages: stored.slice(-MAX_TURNS), slots, mutedUntil: data.muted_until ?? null, conversationId };
```

Replace the signature and body of `saveSession` (lines 66-82) with:

```ts
export async function saveSession(
  channel: Channel,
  userHash: string,
  messages: ChatMessage[],
  slots: AnySlots | null,
  mutedUntil?: Date | null,
  conversationId?: string | null,
): Promise<void> {
  await supabaseAdmin()
    .from("ins_chat_sessions")
    .upsert({
      channel,
      user_hash: userHash,
      messages: messages.slice(-MAX_TURNS),
      slots: slots ?? {},
      // only the columns named here are written on conflict, so omitting this one keeps it
      ...(mutedUntil === undefined ? {} : { muted_until: mutedUntil?.toISOString() ?? null }),
      ...(conversationId === undefined ? {} : { conversation_id: conversationId }),
      updated_at: new Date().toISOString(),
    });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/calc/chat-session.test.ts`
Expected: PASS, all 5 tests.

- [ ] **Step 5: Check nothing else broke**

Run: `npx tsc --noEmit`
Expected: no errors. `conversation.ts` constructs no `Session` literal, so adding a required
field to the interface should not break it. If it does, that call site is fixed in Task 5.

- [ ] **Step 6: Commit**

```bash
npm run verify && \
git add src/lib/chat/session.ts tests/calc/chat-session.test.ts && \
git commit -m "feat(crm): the column that was there all along, now written

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: Pass the page id into the handler

`ins_open_conversation` wants the page id, and the webhook has it on `entry.id` but drops it on the floor.

**Files:**
- Modify: `src/app/api/facebook/webhook/route.ts:10-12`, `:41-47`
- Modify: `src/lib/facebook/conversation.ts:47`

- [ ] **Step 1: Change the route**

In `src/app/api/facebook/webhook/route.ts`, replace the `Entry` interface (lines 10-12) with:

```ts
interface Entry {
  /** the Page this batch of events belongs to */
  id?: string;
  messaging?: Messaging[];
}
```

Replace the `after(...)` block (lines 41-47) with:

```ts
  after(async () => {
    for (const entry of entries) {
      for (const m of entry.messaging ?? []) {
        await handle(m, entry.id).catch((e) => console.error("facebook event failed:", e));
      }
    }
  });
```

- [ ] **Step 2: Widen the handler's signature**

In `src/lib/facebook/conversation.ts`, change line 47 from:

```ts
export async function handle(event: Messaging): Promise<void> {
```

to:

```ts
export async function handle(event: Messaging, pageId?: string): Promise<void> {
```

- [ ] **Step 3: Verify the build still passes**

Run: `npx tsc --noEmit && npx vitest run`
Expected: no type errors, all existing tests pass. `pageId` is unused so far, which is fine —
it is used in Task 6. If the linter objects to an unused parameter, leave it and finish Task 6
in the same commit.

- [ ] **Step 4: Commit**

```bash
npm run verify && \
git add src/app/api/facebook/webhook/route.ts src/lib/facebook/conversation.ts && \
git commit -m "feat(crm): carry the page id in from the webhook

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Wire the turn

The heart of the plan. `conversation.ts` gains a small ledger that fills up during the turn and is emptied in one call at the end — after the customer has their answer.

**Files:**
- Modify: `src/lib/facebook/conversation.ts`

- [ ] **Step 1: Add the imports**

At the top of `src/lib/facebook/conversation.ts`, after the existing imports:

```ts
import { openConversation, openLead, record, attribute, type RecordedEvent } from "@/lib/chat/record";
import { referralOf } from "@/lib/facebook/events";
```

and extend the existing `events` import to include `referralOf` rather than importing twice:

```ts
import { agentTyped, customerOf, eventKey, referralOf, textOf, type Messaging } from "@/lib/facebook/events";
```

- [ ] **Step 2: Record the agent taking over**

Replace the `agentTyped` block (currently lines 56-63) with:

```ts
  if (agentTyped(event)) {
    const session = await loadSession("facebook", userHash);
    await saveSession("facebook", userHash, session.messages, session.slots, muteFor());
    // the thread is theirs now, so the bot's own follow-up is not wanted — and the id it was
    // holding to send it with goes with it
    await dropFollowup("facebook", userHash);
    // a thread an agent answered by hand is a thread the bot did not close, and the report
    // should say so rather than showing a conversation that simply stopped
    await record(session.conversationId, [{ kind: "agent_replied" }], null);
    return;
  }
```

- [ ] **Step 3: Open or continue the conversation**

After the `const session = await loadSession("facebook", userHash);` line (currently line 76), insert:

```ts
  /**
   * The conversation this turn belongs to.
   *
   * A session that has gone stale comes back without one, which is the point: someone writing
   * a week later is a second visit, and counting it as one long conversation would hide the
   * gap the follow-up was supposed to close.
   */
  const referral = referralOf(event);
  let conversationId = session.conversationId;
  if (!conversationId) {
    conversationId = await openConversation(
      "facebook", pageId ?? "", userHash, referral, event.postback?.payload,
    );
  } else if (referral) {
    // they came back through an advertisement mid-conversation; the first one still wins
    await attribute(conversationId, referral);
  }
  const ledger: RecordedEvent[] = [{ kind: "message" }];
```

- [ ] **Step 4: Fill the ledger and empty it after the answer**

Replace the block that runs from `const spoken = ...` through the follow-up arming (currently lines 122-135) with:

```ts
    const spoken = answer.messages.map((m) => m.text).join("\n\n");
    // no mute argument: recording what was said must never clear one
    await saveSession(
      "facebook", userHash, [...history, { role: "assistant", content: spoken }],
      answer.slots, undefined, conversationId,
    );

    const product = (answer.slots as { product?: string }).product ?? null;
    if (answer.priced) ledger.push({ kind: "quoted", data: quoteFigures(answer.slots) });
    if (wantsIn) ledger.push({ kind: "handover" });
    const formSent = Boolean((answer.slots as { formSent?: boolean }).formSent);
    if (formSent && !(session.slots as { formSent?: boolean } | null)?.formSent) {
      ledger.push({ kind: "form_sent" });
    }

    /**
     * A quotation is where the conversation used to stop, so it is where the bot now arms one
     * question five minutes out. Armed after the session is written, because the follow-up
     * only goes if nothing has touched the thread since.
     *
     * The life plan alone for now: its words offer a shorter term and a lighter sum, which
     * the health contract does not have.
     */
    if (answer.priced && product === "lifeprotect") {
      await armFollowup("facebook", userHash, psid).catch((e) => console.error("followup:", e));
    }

    // the report is written last, and its failure is its own: the customer has been answered
    await record(conversationId, ledger, product);
    if (wantsIn || formSent) {
      await openLead(conversationId, psid, formSent ? "form_sent" : "interested", product);
    }
  } catch (e) {
    ledger.push({ kind: "failed" as RecordedEvent["kind"] });
    await record(conversationId, ledger, null);
    await sendMessage(psid, e instanceof BudgetExceeded ? OUT_OF_BUDGET : BROKEN);
    throw e;
  }
```

> **Note on `failed`:** `ins_record` does not know this kind, so it stores a row and stamps no
> milestone — which is exactly what is wanted. The cast is there because `EventKind`
> deliberately lists only the kinds that move something. If the reviewer prefers, add
> `"failed"` to `EventKind` with a comment saying it moves nothing.

- [ ] **Step 5: Add the two helpers**

Above `export async function handle`, add:

```ts
/**
 * Whether this message is the customer asking to go further rather than asking a question.
 *
 * The button sends its own title as the words, so the test is the title — the same string the
 * brains already match on to decide what to answer.
 */
function wantsInText(text: string): boolean {
  return text.trim() === WANTS_IN;
}

/**
 * The figures behind a quotation, and nothing else.
 *
 * `ins_open_lead` copies the last `quoted` event's data straight into `ins_leads.last_quote`,
 * so this shape is what the report will show in its "เบี้ยที่เสนอ" column. It reads the slots
 * rather than the words, because the words are the one thing this table must never hold.
 */
function quoteFigures(slots: unknown): Record<string, unknown> {
  const s = (slots ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const k of ["age", "sex", "plan", "sum", "premium", "mode"]) {
    if (s[k] !== undefined) out[k] = s[k];
  }
  return out;
}
```

Import `WANTS_IN`:

```ts
import { WANTS_IN } from "@/lib/assistant/common";
```

And after `const text = textOf(event);` add:

```ts
  const wantsIn = wantsInText(text);
```

- [ ] **Step 6: Verify the slot field names**

`quoteFigures` reads `age`, `sex`, `plan`, `sum`, `premium`, `mode` off the slots. **Before
trusting it, open `src/lib/assistant/lifeprotect/route.ts` and `src/lib/assistant/ihealthy/route.ts`
and confirm those are the real field names on `Routed` and `HealthSlots`.** If a brain calls
the sum `sumAssured` or the premium something else, fix the list — a wrong name here means the
CRM's money column is silently empty.

Run: `grep -n "age\|sex\|plan\|sum\|premium\|mode" src/lib/assistant/lifeprotect/route.ts | head -20`

- [ ] **Step 7: Run everything**

Run: `npm run verify`
Expected: all existing tests still pass — dedup, human takeover, follow-up and rate limit
behaviour is untouched.

- [ ] **Step 8: Commit**

```bash
npm run verify && \
git add src/lib/facebook/conversation.ts && \
git commit -m "feat(crm): the turn now says what it did

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 7: The cron that forgets

`ins_prune()` exists and nothing calls it. Without it, stale sessions accumulate forever and nothing that was promised to be forgotten ever is.

**Files:**
- Create: `src/app/api/cron/prune/route.ts`
- Test: `tests/calc/chat-record.test.ts` (extend)

- [ ] **Step 1: Write the route**

Create `src/app/api/cron/prune/route.ts`:

```ts
import type { NextRequest } from "next/server";
import { cronCallerIsOurs } from "@/lib/chat/cron-token";
import { prune } from "@/lib/chat/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The forgetting, once a day.
 *
 * `ins_prune()` drops stale sessions, empties the page-scoped id of a lead long closed, and
 * clears the hash of a conversation nobody has touched in ninety days. It has existed since
 * the tables did and has never been called, so every promise the privacy page makes about
 * forgetting has, until now, been kept by nothing.
 */
export async function POST(req: NextRequest) {
  if (!(await cronCallerIsOurs(req.headers.get("authorization")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const ok = await prune();
  return Response.json({ pruned: ok });
}
```

- [ ] **Step 2: Add `prune` to the recording module**

Append to `src/lib/chat/record.ts`:

```ts
/** Run the retention rules the tables were built with. Returns whether it succeeded. */
export async function prune(): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin().rpc("ins_prune", {});
    if (error) throw new Error(error.message);
    return true;
  } catch (e) {
    console.error("ล้างข้อมูลเก่าไม่สำเร็จ:", e);
    return false;
  }
}
```

- [ ] **Step 3: Write the test**

Append to `tests/calc/chat-record.test.ts`:

```ts
describe("forgetting on a schedule", () => {
  it("asks the database to run its own retention rules", async () => {
    const { prune } = await import("@/lib/chat/record");
    await expect(prune()).resolves.toBe(true);
    expect(calls[0].fn).toBe("ins_prune");
  });

  it("reports a failure rather than throwing at the scheduler", async () => {
    const { prune } = await import("@/lib/chat/record");
    fail = true;
    await expect(prune()).resolves.toBe(false);
  });
});
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/calc/chat-record.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run verify && \
git add src/lib/chat/record.ts src/app/api/cron/prune/route.ts tests/calc/chat-record.test.ts && \
git commit -m "feat(crm): call the forgetting that was written and never scheduled

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

- [ ] **Step 6: Schedule it**

Add a daily `pg_cron` job in Supabase that POSTs to `/api/cron/prune` with the same
authorization header `/api/facebook/followups` uses. Follow whatever mechanism schedules that
one — find it before writing a new one:

Run: `grep -rn "followups" --include=*.sql --include=*.md . | head` and check the Supabase
dashboard's cron jobs. **Do not create a second scheduling mechanism.**

---

## Task 8: Prove it end to end

- [ ] **Step 1: Confirm the tables are still empty before deploying**

```sql
select 'conversations' t, count(*) from ins_conversations
union all select 'events', count(*) from ins_events
union all select 'leads', count(*) from ins_leads;
```

- [ ] **Step 2: Deploy and send one message to the page by hand**

Write to the LuckyPlanner page as a customer would: "ชาย 35 สนใจ Life Protect ทุน 1 ล้าน"

- [ ] **Step 3: Confirm the row appeared**

```sql
select id, page_id, source, ad_id, product, messages, model_calls, priced_at, started_at
from ins_conversations order by started_at desc limit 1;

select kind, product, data, at from ins_events
where conversation_id = (select id from ins_conversations order by started_at desc limit 1)
order by at;
```

Expected: one conversation with `messages >= 1`; events including `started`, `message`, and —
once the bot has quoted — `quoted` with real figures in `data` and `priced_at` stamped.

- [ ] **Step 4: Confirm the lead**

Tap "สนใจสมัคร" in the thread, then:

```sql
select id, stage, product, last_quote, ad_id, psid_cipher is not null as has_psid
from ins_leads order by created_at desc limit 1;
```

Expected: `stage = 'interested'`, `last_quote` holding the figures from the `quoted` event,
`has_psid = true`.

- [ ] **Step 5: Confirm the words are not there**

```sql
select data from ins_events where kind <> 'started' order by at desc limit 20;
```

Expected: figures and enums only. **If any customer sentence appears in this output, stop and
fix it before going further** — the table's own comment promises it holds none.

- [ ] **Step 6: Confirm attribution, if an ad is running**

Click one of the live Life Protect ads and write from that thread, then check `ad_id` and
`source` on the newest conversation. If `ad_id` is null, the page has not picked up the
`messaging_referrals` subscription — go back to Task 2 Step 6.

---

## Task 9: The form that came back

`lifeprotect/answer.ts:77` already knows the moment: the form was sent and the customer says
it is filled in. Nothing downstream hears it. `Reply` already carries `priced` for exactly
this kind of signal, so `formDone` joins it rather than inventing a second mechanism.

**Files:**
- Modify: `src/lib/assistant/common.ts:86-104` (the `Reply` interface)
- Modify: `src/lib/assistant/lifeprotect/answer.ts:77`
- Modify: `src/lib/facebook/conversation.ts`
- Test: `tests/calc/assistant-route.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/assistant-route.test.ts`:

```ts
describe("the form coming back", () => {
  it("is said out loud, so the report can stamp it", async () => {
    const answer = await answerQuestion(
      [{ role: "user", content: "กรอกแล้วครับ" }],
      { intent: "quote", product: "lifeprotect", age: 35, sex: "M", formSent: true } as never,
    );
    expect(answer.formDone).toBe(true);
  });

  it("is not claimed by someone who never had the form", async () => {
    const answer = await answerQuestion(
      [{ role: "user", content: "กรอกแล้วครับ" }],
      { intent: "quote", product: "lifeprotect", age: 35, sex: "M" } as never,
    );
    expect(answer.formDone).toBeFalsy();
  });
});
```

Make sure `answerQuestion` is imported in that file; if it is not, add:

```ts
import { answerQuestion } from "@/lib/assistant/lifeprotect/answer";
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/assistant-route.test.ts -t "the form coming back"`
Expected: FAIL — `formDone` is `undefined` on the first case.

- [ ] **Step 3: Add the field to `Reply`**

In `src/lib/assistant/common.ts`, inside the `Reply` interface, directly after the `priced`
line, add:

```ts
  /**
   * the customer has said the application form is filled in
   *
   * It rides here beside `priced` for the same reason that one does: the turn that knows it
   * is a brain, and the only thing that needs to hear it is the recorder outside them both.
   */
  formDone?: boolean;
```

- [ ] **Step 4: Say it at the one place that knows**

In `src/lib/assistant/lifeprotect/answer.ts`, change line 77 from:

```ts
  if (known.formSent && saysFormDone(asked)) return { ...one(FORM_RECEIVED), slots: known };
```

to:

```ts
  if (known.formSent && saysFormDone(asked)) return { ...one(FORM_RECEIVED), formDone: true, slots: known };
```

- [ ] **Step 5: Record it**

In `src/lib/facebook/conversation.ts`, in the block added by Task 6 Step 4, after the
`form_sent` push, add:

```ts
    if (answer.formDone) ledger.push({ kind: "form_done" });
```

and change the lead call so a returned form climbs the stage:

```ts
    if (wantsIn || formSent || answer.formDone) {
      const stage = answer.formDone ? "form_done" : formSent ? "form_sent" : "interested";
      await openLead(conversationId, psid, stage, product);
    }
```

- [ ] **Step 6: Run the tests**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
npm run verify && \
git add src/lib/assistant/common.ts src/lib/assistant/lifeprotect/answer.ts \
        src/lib/facebook/conversation.ts tests/calc/assistant-route.test.ts && \
git commit -m "feat(crm): the form coming back, said where the report can hear it

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 10: The conversation that went quiet

A follow-up that goes out and is never answered is the one outcome the report most needs and
the hardest to see, because nothing happens. The moment to record it is when the second
follow-up — the last one before Meta's window shuts — is sent: by then the customer has
already ignored the first.

`ins_chat_followups` has no `conversation_id`, and a thread this old may have a stale session,
so the conversation is found by its hash directly rather than through the session.

**Files:**
- Modify: `src/lib/chat/record.ts`
- Modify: `src/app/api/facebook/followups/route.ts:26-35`
- Test: `tests/calc/chat-record.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/chat-record.test.ts`:

```ts
describe("the conversation that went quiet", () => {
  it("finds the newest conversation for that person and marks it stalled", async () => {
    await markStalled("facebook", "hash-1");
    expect(selects).toContainEqual({ table: "ins_conversations", userHash: "hash-1" });
    expect(calls[0].fn).toBe("ins_record");
    expect(calls[0].args.p_events).toEqual([{ kind: "stalled", data: {} }]);
    expect(calls[0].args.p_conversation).toBe("conv-found");
  });

  it("does nothing when that person has no conversation on record", async () => {
    foundConversation = null;
    await markStalled("facebook", "hash-1");
    expect(calls).toHaveLength(0);
  });
});
```

Extend the mock at the top of the same file to serve the lookup — replace the whole
`vi.mock("@/lib/supabase/admin", ...)` block with:

```ts
const selects: { table: string; userHash: string }[] = [];
let foundConversation: { id: string } | null = { id: "conv-found" };

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args });
      if (fail) return { data: null, error: { message: "database is on fire" } };
      return { data: fn === "ins_open_conversation" ? "conv-1" : fn === "ins_open_lead" ? "lead-1" : null, error: null };
    },
    from: (table: string) => ({
      select: () => ({
        eq: (_col: string, userHash: string) => {
          selects.push({ table, userHash });
          return {
            order: () => ({
              limit: () => ({ maybeSingle: async () => ({ data: foundConversation, error: null }) }),
            }),
          };
        },
      }),
    }),
  }),
}));
```

and add to `beforeEach`:

```ts
  selects.length = 0;
  foundConversation = { id: "conv-found" };
```

and to the import line:

```ts
const { openConversation, attribute, record, openLead, markStalled } = await import("@/lib/chat/record");
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/chat-record.test.ts -t "went quiet"`
Expected: FAIL — `markStalled is not a function`.

- [ ] **Step 3: Write the implementation**

Append to `src/lib/chat/record.ts`:

```ts
/**
 * Mark the conversation this person was last having as one that went quiet.
 *
 * The follow-up queue does not carry a conversation id, and a thread that has been silent
 * long enough to reach the second follow-up may have a session too stale to hold one — so the
 * conversation is found by the hash it was opened under, newest first.
 */
export async function markStalled(channel: Channel, userHash: string): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("ins_conversations")
      .select("id")
      .eq("user_hash", userHash)
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const id = (data as { id?: string } | null)?.id;
    if (!id) return;
    await record(id, [{ kind: "stalled" }], null);
  } catch (e) {
    console.error("บันทึกบทสนทนาที่เงียบหายไม่สำเร็จ:", e);
  }
}
```

> `channel` is accepted but not filtered on: `ins_conversations` is Facebook-only today, and a
> second channel will want this narrowed. Leave the parameter so that change is a one-line one.

- [ ] **Step 4: Call it from the follow-up route**

In `src/app/api/facebook/followups/route.ts`, replace the `after(...)` block (lines 27-35) with:

```ts
  after(async () => {
    for (const { userHash, psid, stage } of due) {
      const { text, replies } = followupMessage(stage);
      // proactive, not a reply to anything: Meta has a name for that and this is it
      await sendMessage(psid, text, replies, { proactive: true })
        .catch((e) => console.error("followup failed:", e));
      // the second question is the last one, and reaching it means the first went unanswered
      if (stage >= 2) await markStalled("facebook", userHash);
    }
    await sweepFollowups();
  });
```

and add the import:

```ts
import { markStalled } from "@/lib/chat/record";
```

`claimDueFollowups` already returns `userHash` on each row, so no change is needed there —
confirm at `src/lib/chat/followup.ts:129-131`.

- [ ] **Step 5: Run the tests**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
npm run verify && \
git add src/lib/chat/record.ts src/app/api/facebook/followups/route.ts tests/calc/chat-record.test.ts && \
git commit -m "feat(crm): record the silence the second question was asked into

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-review notes

- **Spec coverage:** §5.1's eight milestones and two counters are covered — `quoted`,
  `handover`, `form_sent` and `agent_replied` in Task 6, `form_done` in Task 9, `stalled` in
  Task 10, `message` in Task 6, and `routed`/`plan_info`/`small_talk` **deliberately not**:
  raising `model_calls` means instrumenting the brains' own model calls, which touches both
  brains for a number nothing on the page depends on yet. `model_calls` will read 0.
  Flagged rather than silently skipped.
- **Spec §6 (attribution)** is covered by Tasks 1, 2 and 6, with the live check in Task 8 Step 6.
- **Spec §9 (retention)** is covered by Task 7, including the scheduling step that is easy to
  forget and leaves every retention promise unkept if it is.
- **Spec §7 (the page)** is out of scope here and needs its own plan.
- **Spec §8 (cost per lead)** is out of scope here and blocked on `ads_read`.
- **Type consistency:** `RecordedEvent`/`EventKind` from Task 3 are used unchanged in Tasks 6,
  9 and 10. `Referral` from Task 1 is what Task 3's `openConversation` and `attribute` accept.
  `Session.conversationId` from Task 4 is what Task 6 reads.
- **The one assumption left in the code:** `quoteFigures` reads six slot field names. Task 6
  Step 6 verifies them against the real types rather than trusting this plan.
