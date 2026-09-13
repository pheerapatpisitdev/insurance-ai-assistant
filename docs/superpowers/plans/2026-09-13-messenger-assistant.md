# Messenger Assistant (Life Protect x 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring back a bot on the agency's Facebook Page that answers questions about Life Protect x 2, prices it from the same calculator the sales page uses, sends the quote as text plus a card, and goes quiet for 24 hours in any thread the agent types into.

**Architecture:** Most of this existed and was removed on 11 Sep 2026. The transport, the session store and the page connection are restored verbatim from git (`7fb20b8^` for anything under `src/lib/facebook/` and the webhook, `cfa8dbc^` for the session and the assistant). The brain is rewritten small: one plan, three intents, and no knowledge base. A premium is computed by `lifeProtectModes()` and worded by `lifeProtectQuoteText()` — the same two functions `/lifeprotect` renders with — so the model never produces a figure or a sentence about one.

**Tech Stack:** Next.js 15 App Router (route handlers + `after()`), Supabase (service role), vitest, the existing multi-provider AI client in `src/lib/ai/`.

**Spec:** `docs/superpowers/specs/2026-09-13-messenger-assistant-design.md`

---

## File Structure

| File | Responsibility |
| --- | --- |
| `src/lib/facebook/verify.ts` | Webhook signature, verify token, PSID hashing. Restored verbatim. |
| `src/lib/facebook/events.ts` | Reads the customer's words out of an event; tells the agent's echo from the bot's. |
| `src/lib/facebook/client.ts` | Send API: text (split at 1,900 chars), image, typing bubble. Restored verbatim. |
| `src/lib/facebook/connection.ts` | The page token: stored encrypted, read back for the Send API. Restored verbatim. |
| `src/lib/facebook/oauth.ts` | The login round trip that fetches a page token. Restored verbatim. |
| `src/lib/facebook/status.ts` | What `/admin/messenger` shows about the connection. Restored, trimmed. |
| `src/app/api/facebook/webhook/route.ts` | Receives events, answers after responding. |
| `src/app/api/facebook/connect/route.ts` + `connect/callback/route.ts` | Start and finish the login. Restored verbatim. |
| `src/app/admin/messenger/page.tsx` + `PagePicker.tsx` + `DisconnectButton.tsx` + `useAction.tsx` + `actions.ts` | The back-office page that connects and disconnects the Page. |
| `src/lib/chat/session.ts` | Loads and saves a conversation; claims an event id; holds the mute. |
| `src/lib/assistant/route.ts` | Reads a message into `{ intent, age, sex, sumAssured, variant, mode, question }`. |
| `src/lib/assistant/answer.ts` | Chooses the route and builds the reply and the card. |
| `src/lib/assistant/prompts.ts` | The system prompts, one per route. |
| `src/lib/assistant/rate-limit.ts` | 8 messages per person per minute. Restored verbatim. |
| `src/app/privacy/page.tsx` | Says what the bot actually keeps. |
| `docs/facebook-connect.md` | The steps a person does on Meta's own site. |

---

## Task 1: Groundwork — the mute column and the environment

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add the column**

Run against the Supabase project `tmbbxahyxwkshxuxphcb` (MCP `apply_migration`, name `messenger_mute`):

```sql
alter table ins_chat_sessions add column if not exists muted_until timestamptz;
comment on column ins_chat_sessions.muted_until is
  'While this is in the future the bot stays out of the thread: an agent has answered by hand.';
```

- [ ] **Step 2: Verify the column landed**

```sql
select column_name from information_schema.columns
where table_schema='public' and table_name='ins_chat_sessions' and column_name='muted_until';
```

Expected: one row.

- [ ] **Step 3: Document the three variables**

Append to `.env.example`:

```
# Facebook Messenger — the app that owns the Page connection.
# FB_APP_SECRET also signs the PSID hash and encrypts the stored page token, so changing it
# orphans every stored conversation and the connection has to be made again.
FB_APP_ID=
FB_APP_SECRET=
FB_VERIFY_TOKEN=
```

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "chore(messenger): name the three variables the Page connection needs"
```

---

## Task 2: The transport — signature, events, Send API

**Files:**
- Create: `src/lib/facebook/verify.ts` (restore)
- Create: `src/lib/facebook/client.ts` (restore)
- Create: `src/lib/facebook/events.ts` (restore + echo)
- Test: `tests/calc/facebook.test.ts`

- [ ] **Step 1: Restore the three files**

```bash
git show 7fb20b8^:src/lib/facebook/verify.ts > src/lib/facebook/verify.ts
git show 7fb20b8^:src/lib/facebook/client.ts > src/lib/facebook/client.ts
git show 7fb20b8^:src/lib/facebook/events.ts > src/lib/facebook/events.ts
```

- [ ] **Step 2: Write the failing test**

Create `tests/calc/facebook.test.ts`:

```ts
import crypto from "crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { toParts } from "@/lib/facebook/client";
import { agentTyped, eventKey, textOf, type Messaging } from "@/lib/facebook/events";
import { hashUserId, verifySignature, verifyTokenMatches } from "@/lib/facebook/verify";

const SECRET = "test-app-secret";

beforeEach(() => {
  process.env.FB_APP_SECRET = SECRET;
  process.env.FB_VERIFY_TOKEN = "test-verify";
  process.env.FB_APP_ID = "1624098972401227";
});
afterEach(() => {
  delete process.env.FB_APP_SECRET;
  delete process.env.FB_VERIFY_TOKEN;
  delete process.env.FB_APP_ID;
});

const sign = (body: string) => "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");

describe("what Meta sends", () => {
  it("accepts a body signed with the app secret", () => {
    const body = JSON.stringify({ object: "page" });
    expect(verifySignature(body, sign(body))).toBe(true);
  });

  it("refuses a body that was changed after signing", () => {
    const body = JSON.stringify({ object: "page" });
    expect(verifySignature(body + " ", sign(body))).toBe(false);
  });

  it("refuses a request carrying no signature at all", () => {
    expect(verifySignature("{}", null)).toBe(false);
  });

  it("echoes the challenge only for the token we chose", () => {
    expect(verifyTokenMatches("test-verify")).toBe(true);
    expect(verifyTokenMatches("something-else")).toBe(false);
    expect(verifyTokenMatches(null)).toBe(false);
  });

  it("hashes a page-scoped id to something stable and unrecognisable", () => {
    const hash = hashUserId("psid-123");
    expect(hash).toBe(hashUserId("psid-123"));
    expect(hash).not.toContain("psid-123");
  });
});

describe("reading an event", () => {
  it("takes a typed message as the customer's words", () => {
    expect(textOf({ message: { text: "  สนใจครับ  " } })).toBe("สนใจครับ");
  });

  it("takes a tapped button as the customer's words too", () => {
    expect(textOf({ postback: { title: "ขอเบี้ยประกัน" } })).toBe("ขอเบี้ยประกัน");
  });

  it("does not take the page's own message as the customer's words", () => {
    expect(textOf({ message: { text: "สวัสดีครับ", is_echo: true } })).toBe("");
  });

  it("recognises a redelivery by the message id", () => {
    expect(eventKey({ message: { mid: "m-1", text: "hi" } })).toBe("m-1");
    expect(eventKey({ sender: { id: "p" }, timestamp: 7, postback: { title: "hi" } })).toBe("pb:p:7");
  });
});

describe("telling the agent's message from the bot's", () => {
  it("counts an echo with no app id as the agent typing in the inbox", () => {
    const event: Messaging = { message: { mid: "m", text: "เดี๋ยวโทรหานะครับ", is_echo: true } };
    expect(agentTyped(event)).toBe(true);
  });

  it("does not count the bot's own echo", () => {
    const event: Messaging = { message: { mid: "m", text: "เบี้ย…", is_echo: true, app_id: 1624098972401227 } };
    expect(agentTyped(event)).toBe(false);
  });

  it("does not count a message the customer sent", () => {
    expect(agentTyped({ message: { mid: "m", text: "สนใจครับ" } })).toBe(false);
  });
});

describe("a long answer", () => {
  it("is split on blank lines, never mid-paragraph, while it can be", () => {
    const para = "ก".repeat(900);
    const parts = toParts([para, para, para].join("\n\n"));
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBe([para, para].join("\n\n"));
  });

  it("hard-wraps a paragraph Messenger would refuse on its own", () => {
    const parts = toParts("ก".repeat(4000));
    expect(parts.every((p) => p.length <= 1900)).toBe(true);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run tests/calc/facebook.test.ts`
Expected: FAIL — `agentTyped` is not exported by `events.ts`.

- [ ] **Step 4: Add `app_id` and `agentTyped` to `events.ts`**

In `src/lib/facebook/events.ts`, add `app_id` to the message shape and append the function:

```ts
export interface Messaging {
  sender?: { id?: string };
  timestamp?: number;
  message?: { mid?: string; text?: string; is_echo?: boolean; app_id?: number | string };
  postback?: { title?: string; payload?: string };
}

/**
 * Whether this event is the agent answering by hand.
 *
 * Meta echoes every message the Page sends, the bot's included, and the only thing telling
 * them apart is the app id it carries: ours when the Send API sent it, absent when a person
 * typed it into the Page's inbox. An echo we cannot attribute is treated as the agent's,
 * because a bot that talks over its own agent is worse than one that waits a day.
 */
export function agentTyped(event: Messaging): boolean {
  if (!event.message?.is_echo) return false;
  const ours = process.env.FB_APP_ID;
  return !ours || String(event.message.app_id ?? "") !== ours;
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run tests/calc/facebook.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/facebook tests/calc/facebook.test.ts
git commit -m "feat(messenger): receive what the page is sent, and answer on it"
```

---

## Task 3: The conversation — sessions, deduplication, the mute

**Files:**
- Create: `src/lib/chat/session.ts` (restore + mute)
- Test: `tests/calc/chat-session.test.ts`

- [ ] **Step 1: Restore the file**

```bash
mkdir -p src/lib/chat && git show cfa8dbc^:src/lib/chat/session.ts > src/lib/chat/session.ts
```

- [ ] **Step 2: Write the failing test**

Create `tests/calc/chat-session.test.ts`. The Supabase client is replaced so the test never reaches the network; it asserts on what would have been written.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const rows = new Map<string, Record<string, unknown>>();
let lastUpsert: Record<string, unknown> | null = null;

vi.mock("@/lib/supabase/admin", () => ({
  supabaseAdmin: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            gte: () => ({ maybeSingle: async () => ({ data: rows.get("session") ?? null }) }),
            maybeSingle: async () => ({ data: rows.get("session") ?? null }),
          }),
        }),
      }),
      upsert: async (v: Record<string, unknown>) => { lastUpsert = v; return { error: null }; },
      insert: async () => ({ error: null }),
    }),
  }),
}));

const { isMuted, loadSession, muteFor, saveSession } = await import("@/lib/chat/session");

beforeEach(() => { rows.clear(); lastUpsert = null; });

describe("a conversation", () => {
  it("starts empty when nobody has written", async () => {
    expect(await loadSession("facebook", "hash")).toEqual({ messages: [], slots: null, mutedUntil: null });
  });

  it("keeps only the last six turns", async () => {
    const messages = Array.from({ length: 10 }, (_, i) => ({ role: "user" as const, content: String(i) }));
    await saveSession("facebook", "hash", messages, null, null);
    expect((lastUpsert!.messages as unknown[])).toHaveLength(6);
    expect((lastUpsert!.messages as { content: string }[])[0].content).toBe("4");
  });
});

describe("the mute", () => {
  it("is in the future for a day after the agent types", () => {
    const now = new Date("2026-09-13T10:00:00Z");
    expect(muteFor(now).toISOString()).toBe("2026-09-14T10:00:00.000Z");
  });

  it("silences the bot while it stands", () => {
    const now = new Date("2026-09-13T10:00:00Z");
    expect(isMuted("2026-09-13T12:00:00Z", now)).toBe(true);
    expect(isMuted("2026-09-13T09:00:00Z", now)).toBe(false);
    expect(isMuted(null, now)).toBe(false);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run tests/calc/chat-session.test.ts`
Expected: FAIL — `isMuted`, `muteFor` are not exported, and `loadSession` returns no `mutedUntil`.

- [ ] **Step 4: Rewrite `session.ts` around the mute**

Replace the `Channel` type, the `Session` shape and both accessors:

```ts
/** Which messaging service a person wrote from. Messenger is the only one the bot answers on. */
export type Channel = "facebook";

/** How long the bot stays out of a thread after the agent has answered in it by hand. */
const MUTE_HOURS = 24;

export interface Session {
  messages: ChatMessage[];
  slots: Routed | null;
  /** ISO time the bot may speak again, or null when it was never asked to stop */
  mutedUntil: string | null;
}

/** When the bot may speak in this thread again, counted from the agent's message. */
export function muteFor(now: Date = new Date()): Date {
  return new Date(now.getTime() + MUTE_HOURS * 3600_000);
}

export function isMuted(mutedUntil: string | null, now: Date = new Date()): boolean {
  return mutedUntil !== null && new Date(mutedUntil) > now;
}
```

`loadSession` reads the row without the freshness filter and applies it to the messages alone,
because a mute outlives the conversation it was set on:

```ts
export async function loadSession(channel: Channel, userHash: string): Promise<Session> {
  const { data } = await supabaseAdmin()
    .from("ins_chat_sessions")
    .select("messages, slots, muted_until, updated_at")
    .eq("channel", channel)
    .eq("user_hash", userHash)
    .maybeSingle();
  if (!data) return { messages: [], slots: null, mutedUntil: null };
  const fresh = new Date(data.updated_at).getTime() > Date.now() - MAX_AGE_HOURS * 3600_000;
  const messages = fresh && Array.isArray(data.messages) ? (data.messages as ChatMessage[]) : [];
  const slots = fresh && data.slots && Object.keys(data.slots).length ? (data.slots as Routed) : null;
  return { messages: messages.slice(-MAX_TURNS), slots, mutedUntil: data.muted_until ?? null };
}
```

`saveSession` takes the mute as its last argument and writes it through:

```ts
export async function saveSession(
  channel: Channel, userHash: string, messages: ChatMessage[], slots: Routed | null, mutedUntil: Date | null,
): Promise<void> {
  await supabaseAdmin().from("ins_chat_sessions").upsert({
    channel,
    user_hash: userHash,
    messages: messages.slice(-MAX_TURNS),
    slots: slots ?? {},
    muted_until: mutedUntil?.toISOString() ?? null,
    updated_at: new Date().toISOString(),
  });
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run tests/calc/chat-session.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/chat tests/calc/chat-session.test.ts
git commit -m "feat(chat): remember a conversation for a day, and step aside for the agent"
```

---

## Task 4: Reading the message

**Files:**
- Create: `src/lib/assistant/route.ts` (restore, cut to one plan)
- Create: `src/lib/assistant/rate-limit.ts` (restore)
- Test: `tests/calc/assistant-route.test.ts`

- [ ] **Step 1: Restore both files**

```bash
mkdir -p src/lib/assistant
git show cfa8dbc^:src/lib/assistant/route.ts > src/lib/assistant/route.ts
git show cfa8dbc^:src/lib/assistant/rate-limit.ts > src/lib/assistant/rate-limit.ts
```

- [ ] **Step 2: Write the failing test**

Create `tests/calc/assistant-route.test.ts`. The model is replaced by a stub that returns whatever JSON the case is about, so the test is about `clean()` and `mergeSlots()`, not about a provider.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const reply = { text: "", model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0 };
const chat = vi.fn(async () => reply);

vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { mergeSlots, routeMessage } = await import("@/lib/assistant/route");

const said = (content: string) => [{ role: "user" as const, content }];

beforeEach(() => { chat.mockClear(); });

describe("reading what the customer wants", () => {
  it("reads an age, a sex and a sum out of one line", async () => {
    reply.text = JSON.stringify({ intent: "quote", age: 35, sex: "M", sumAssured: 1000000 });
    expect(await routeMessage(said("ชาย 35 ล้านนึง"))).toMatchObject({
      intent: "quote", age: 35, sex: "M", sumAssured: 1000000,
    });
  });

  it("takes the term named in the message over the one the model guessed", async () => {
    reply.text = JSON.stringify({ intent: "quote", variant: "WLF99H" });
    expect((await routeMessage(said("จ่าย 19 ปีเท่าไหร่"))).variant).toBe("WLF19H");
  });

  it("refuses a term this plan does not sell", async () => {
    reply.text = JSON.stringify({ intent: "quote", variant: "WLF09L" });
    expect((await routeMessage(said("ขอราคา"))).variant).toBeUndefined();
  });

  it("drops an age outside what a person can be", async () => {
    reply.text = JSON.stringify({ intent: "quote", age: 140 });
    expect((await routeMessage(said("อายุ 140"))).age).toBeUndefined();
  });

  it("falls back to a plain conversation when the model answers with rubbish", async () => {
    reply.text = "ไม่ใช่ JSON";
    expect(await routeMessage(said("สวัสดี"))).toEqual({ intent: "other" });
  });
});

describe("carrying the conversation forward", () => {
  it("keeps the age and sex from an earlier turn", () => {
    const merged = mergeSlots({ intent: "quote", age: 35, sex: "M", sumAssured: 1000000 }, { intent: "quote", variant: "WLF19H" });
    expect(merged).toMatchObject({ age: 35, sex: "M", sumAssured: 1000000, variant: "WLF19H" });
  });

  it("lets the newest turn overwrite what it names", () => {
    const merged = mergeSlots({ intent: "quote", sumAssured: 1000000 }, { intent: "quote", sumAssured: 500000 });
    expect(merged.sumAssured).toBe(500000);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run tests/calc/assistant-route.test.ts`
Expected: FAIL — the restored router still resolves plan codes and bundles.

- [ ] **Step 4: Cut the router down to this plan**

In `src/lib/assistant/route.ts`:

- `Intent` becomes `"quote" | "plan_info" | "other"`.
- `Routed` keeps `{ intent, age, sex, sumAssured, variant, mode, question }` and loses `planCode`, `bundleCode`, `tier`.
- Delete the imports of `getPlan`, `getBundle`, `listBundles` and `planCatalogue`.
- Replace `PLAN_ALIASES` with the term aliases, and make `clean()` check the variant against the
  plan's own three:

```ts
/** How people write each payment term. What the message says wins over what the model returned. */
const TERM_ALIASES: [string, RegExp][] = [
  ["WLF09H", /(จ่าย|ชำระ)\s*9\s*ปี|9\s*ปี/],
  ["WLF19H", /(จ่าย|ชำระ)\s*19\s*ปี|19\s*ปี/],
  ["WLF99H", /ถึงอายุ\s*99|ครบ\s*อายุ\s*99|99\s*ปี|ยาว ?ๆ/],
];

const TERMS = new Set(["WLF09H", "WLF19H", "WLF99H"]);
```

`clean()` keeps its age, sex, sum and mode checks unchanged, and replaces the plan block with:

```ts
  const said = lastUserMessage(history);
  const named = TERM_ALIASES.find(([, re]) => re.test(said))?.[0];
  const variant = named ?? (parsed.variant && TERMS.has(parsed.variant) ? parsed.variant : undefined);
```

- The system prompt loses the plan catalogue and names the one product:

```ts
const SYSTEM = `คุณเป็นตัวช่วยของตัวแทนประกันชีวิต อ่านข้อความล่าสุดแล้วบอกว่าลูกค้าต้องการอะไร ตอบเป็น JSON เท่านั้น

ตอนนี้เอเจนซี่ขายแบบเดียวคือ "Life Protect x 2" (ไลฟ์ โพรเทค+ 100 แบบคุ้มครองสองเท่า)

intent มี 3 แบบ
- "quote" = ขอเบี้ยประกัน ต้องคำนวณเป็นตัวเลข
- "plan_info" = ถามว่าคุ้มครองอะไร จ่ายเท่าไหร่เมื่อเสียชีวิต รับอายุเท่าไหร่ ทุนขั้นต่ำ จ่ายกี่ปี เวนคืนได้เท่าไหร่
- "other" = ทักทาย หรือเรื่องอื่นที่ไม่ใช่สองข้อบน

ฟิลด์ที่ต้องเติมถ้ามีในข้อความ
- age เป็นตัวเลขปี
- sex เป็น "M" (ชาย) หรือ "F" (หญิง)
- sumAssured ทุนประกันเป็นบาท ("1 ล้าน" = 1000000, "5 แสน" = 500000)
- variant เป็น "WLF09H" (จ่าย 9 ปี) "WLF19H" (จ่าย 19 ปี) หรือ "WLF99H" (จ่ายถึงอายุ 99)
- mode เป็น "annual" (รายปี) "semi" (ราย 6 เดือน) หรือ "monthly" (รายเดือน)
- question เขียนคำถามใหม่ให้เข้าใจได้ด้วยตัวเอง โดยเติมสิ่งที่อ้างถึงจากบทสนทนาก่อนหน้า

ถ้าไม่มีข้อมูลให้ละฟิลด์นั้นไป ห้ามเดา`;
```

- `routeMessage()` sends `SYSTEM` on its own — drop the `+ planCatalogue()`.
- Add the helper the alias check needs:

```ts
function lastUserMessage(history: ChatMessage[]): string {
  return [...history].reverse().find((m) => m.role === "user")?.content ?? "";
}
```

- `mergeSlots()` keeps its behaviour; delete the branches that carried `bundleCode` and `tier`.

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run tests/calc/assistant-route.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/assistant tests/calc/assistant-route.test.ts
git commit -m "feat(assistant): read a message as a request about one plan"
```

---

## Task 5: The answer

**Files:**
- Create: `src/lib/assistant/answer.ts`
- Create: `src/lib/assistant/prompts.ts`
- Test: `tests/calc/assistant-answer.test.ts`

The quote path calls nothing new: `lifeProtectTable()` builds the slim table the sales page
uses, `termAt()` picks the payment term, `lifeProtectModes()` prices it, `deathBenefitOf()` and
`cashAt()` fill the blocks, `lifeProtectQuoteText()` writes the message, `cardPath()` names the
picture. The model is asked for words only on the `plan_info` and `other` routes, and both
prompts forbid it from stating a figure.

- [ ] **Step 1: Write the failing test**

Create `tests/calc/assistant-answer.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const reply = { text: "ยินดีครับ", model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0 };
const chat = vi.fn(async () => reply);
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerQuestion } = await import("@/lib/assistant/answer");
const { lifeProtectTable } = await import("@/lib/lifeprotect-table");
const { lifeProtectQuoteText } = await import("@/lib/lifeprotect-cta");
const { cashAt, deathBenefitOf, lifeProtectModes, termAt } = await import("@/lib/lifeprotect-quote");

beforeEach(() => { chat.mockClear(); });

const slots = { intent: "quote" as const, age: 35, sex: "M" as const, sumAssured: 1_000_000 };

describe("a quote", () => {
  it("says exactly what the sales page would say", async () => {
    const answer = await answerQuestion([{ role: "user", content: "ชาย 35 ล้านนึง" }], slots);
    const table = lifeProtectTable();
    const term = termAt(table, "WLF99H");
    const expected = lifeProtectQuoteText({
      sumAssured: 1_000_000,
      termLabel: term.label,
      age: 35,
      sex: "M",
      modes: lifeProtectModes(table, term, { sex: "M", age: 35, sumAssured: 1_000_000 })!,
      death: deathBenefitOf(table, 35, 1_000_000),
      cash: cashAt(term, "M", 35, 1_000_000, table.ageMin),
    });
    expect(answer.reply).toContain(expected);
    expect(answer.priced).toBe(true);
  });

  it("never asks a model to word a price", async () => {
    await answerQuestion([{ role: "user", content: "ชาย 35 ล้านนึง" }], slots);
    expect(chat).not.toHaveBeenCalled();
  });

  it("sends a card of the same arrangement", async () => {
    const answer = await answerQuestion([{ role: "user", content: "ชาย 35 ล้านนึง" }], slots);
    expect(answer.card).toBe("/api/card?plan=LIFEPROTECT&variant=WLF99H&age=35&sex=M&sum=1000000");
  });

  it("offers the two terms it did not quote", async () => {
    const answer = await answerQuestion([{ role: "user", content: "ชาย 35 ล้านนึง" }], slots);
    expect(answer.reply).toContain("9 ปี");
    expect(answer.reply).toContain("19 ปี");
  });

  it("quotes the term the customer named, and then offers the others", async () => {
    const answer = await answerQuestion([{ role: "user", content: "จ่าย 19 ปี" }], { ...slots, variant: "WLF19H" });
    expect(answer.reply).toContain("จ่าย 19 ปี");
    expect(answer.card).toContain("variant=WLF19H");
  });

  it("asks for what it is missing instead of guessing", async () => {
    const answer = await answerQuestion([{ role: "user", content: "ขอราคาหน่อย" }], { intent: "quote" });
    expect(answer.reply).toContain("อายุ");
    expect(answer.card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
  });

  it("says no price at all for an age the plan does not issue to", async () => {
    const answer = await answerQuestion([{ role: "user", content: "อายุ 95 ทุนล้าน" }], { ...slots, age: 95 });
    expect(answer.card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
    expect(answer.reply).toMatch(/อายุ/);
  });

  it("says no price at all for a sum under the plan's floor", async () => {
    const answer = await answerQuestion([{ role: "user", content: "ทุน 5 หมื่น" }], { ...slots, sumAssured: 50_000 });
    expect(answer.card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
  });
});

describe("everything else", () => {
  it("answers a question about the plan in the model's words", async () => {
    reply.text = "คุ้มครองถึงอายุ 99 ปีครับ";
    const answer = await answerQuestion([{ role: "user", content: "คุ้มครองถึงกี่ขวบ" }], { intent: "plan_info" });
    expect(answer.reply).toBe("คุ้มครองถึงอายุ 99 ปีครับ");
    expect(chat).toHaveBeenCalledOnce();
  });

  it("greets without pricing anything", async () => {
    reply.text = "สวัสดีครับ";
    const answer = await answerQuestion([{ role: "user", content: "สวัสดี" }], { intent: "other" });
    expect(answer.card).toBeUndefined();
    expect(answer.priced).toBeFalsy();
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npx vitest run tests/calc/assistant-answer.test.ts`
Expected: FAIL — `src/lib/assistant/answer.ts` does not exist.

- [ ] **Step 3: Write `prompts.ts`**

```ts
/**
 * What the model is told on the two routes it is allowed to speak on. Neither of them may
 * state a figure: a premium, a benefit and a surrender value are all arithmetic the engine
 * has already done, and a model that paraphrases one is a model that can get it wrong.
 */
export const PLAN_INFO_SYSTEM = `คุณคือผู้ช่วยของตัวแทนประกันชีวิตในไทย ตอบสั้น สุภาพ เป็นกันเอง ลงท้ายว่า "ครับ"

ตอบจากข้อมูลที่ให้ไว้ด้านล่างเท่านั้น ห้ามเดา ห้ามคิดตัวเลขเอง ถ้าข้อมูลไม่มีให้บอกว่าขอให้ตัวแทนตอบและถามกลับว่าสะดวกให้ติดต่อกลับไหม

ห้ามถามหรือรับข้อมูลเหล่านี้ เลขบัตรประชาชน ประวัติสุขภาพ เลขกรมธรรม์ ข้อมูลการชำระเงิน
ห้ามรับสมัครประกัน ห้ามบอกว่าจะได้รับอนุมัติแน่นอน

ความยาวไม่เกิน 4 บรรทัด`;

export const SMALL_TALK_SYSTEM = `คุณคือผู้ช่วยของตัวแทนประกันชีวิตในไทย ตอบสั้นมาก สุภาพ เป็นกันเอง ลงท้ายว่า "ครับ"

ทักทายกลับ แล้วชวนเข้าเรื่องด้วยการขอ อายุ เพศ และทุนประกันที่สนใจ เพื่อคิดเบี้ยให้

ห้ามบอกตัวเลขเบี้ยหรือผลประโยชน์ใดๆ เอง ห้ามถามข้อมูลสุขภาพหรือเลขบัตรประชาชน
ความยาวไม่เกิน 3 บรรทัด`;
```

- [ ] **Step 4: Write `answer.ts`**

```ts
import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { getPlan } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";
import { cardPath } from "@/lib/card-link";
import { lifeProtectQuoteText } from "@/lib/lifeprotect-cta";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { cashAt, deathBenefitOf, lifeProtectModes, termAt } from "@/lib/lifeprotect-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { PLAN_INFO_SYSTEM, SMALL_TALK_SYSTEM } from "./prompts";
import { recentTurns, type Routed } from "./route";

const PLAN_CODE = "LIFEPROTECT";
const DEFAULT_TERM = "WLF99H";

export interface Answer {
  reply: string;
  /** carried into the next turn so a follow-up keeps the age, sex and sum */
  slots: Routed;
  /** the answer carries a premium — the moment a browser turns into someone worth calling */
  priced?: boolean;
  /** where the quote is drawn as a picture, as a path on this site */
  card?: string;
}

const ASK_FOR_DETAILS =
  "รบกวนบอก อายุ / เพศ / ทุนประกันที่สนใจ ครับ แล้วผมคิดเบี้ยให้เลย (เช่น \"ชาย 35 ทุน 1 ล้าน\")";

const HAND_OVER =
  "เรื่องนี้ขอให้ตัวแทนตอบเองจะแม่นกว่าครับ เดี๋ยวมีคนมาตอบในแชทนี้ ระหว่างนี้สอบถามเรื่อง Life Protect x 2 ได้เลยครับ";

export async function answerQuestion(history: ChatMessage[], slots: Routed): Promise<Answer> {
  if (slots.intent === "quote") return { ...answerQuote(slots), slots };
  if (slots.intent === "plan_info") return { ...(await answerPlanInfo(history)), slots };
  return { ...(await answerSmallTalk(history)), slots };
}
```

The quote route, whose every figure comes from the table:

```ts
/** The quote as the sales page would state it, or a sentence saying why there is none. */
function answerQuote(slots: Routed): Omit<Answer, "slots"> {
  const { age, sex, sumAssured } = slots;
  if (age === undefined || sex === undefined || sumAssured === undefined) {
    return { reply: ASK_FOR_DETAILS };
  }

  const table = lifeProtectTable();
  if (table.expired) {
    return { reply: "ตารางเบี้ยชุดนี้หมดอายุแล้วครับ ขอราคาปัจจุบันจากตัวแทนได้เลย เดี๋ยวมีคนมาตอบในแชทนี้ครับ" };
  }
  if (age < table.ageMin || age > table.ageMax) {
    return { reply: `แบบนี้รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ ${HAND_OVER}` };
  }
  const variant = slots.variant ?? DEFAULT_TERM;
  // the floor is a rule of the plan, not a field of the page's slim table
  const floor = baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, variant).min;
  if (sumAssured < floor) {
    return { reply: `ทุนประกันขั้นต่ำของแบบนี้คือ ${floor.toLocaleString("en-US")} บาทครับ บอกทุนที่สนใจมาใหม่ได้เลย` };
  }
  const term = termAt(table, variant);
  const who = { sex, age, sumAssured };
  const modes = lifeProtectModes(table, term, who);
  if (!modes) return { reply: `แบบนี้รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ ${HAND_OVER}` };

  const text = lifeProtectQuoteText({
    sumAssured, termLabel: term.label, age, sex, modes,
    death: deathBenefitOf(table, age, sumAssured),
    cash: cashAt(term, sex, age, sumAssured, table.ageMin),
  });

  return {
    reply: [text, "", otherTerms(table, variant)].join("\n"),
    priced: true,
    card: cardPath({ kind: "plan", planCode: PLAN_CODE, variant, age, sex, sumAssured, ...(slots.mode ? { mode: slots.mode } : {}) }),
  };
}

/** The terms this quote did not take, offered by name so the customer can ask for one. */
function otherTerms(table: ReturnType<typeof lifeProtectTable>, quoted: string): string {
  const rest = table.terms.filter((t) => t.variant !== quoted).map((t) => t.label);
  return `สนใจแบบ${rest.join(" หรือ ")} ไหมครับ บอกมาได้เลย เดี๋ยวคิดให้ใหม่`;
}
```

The two routes the model speaks on. `plan_info` is handed the facts as text and told to answer
from them alone:

```ts
async function answerPlanInfo(history: ChatMessage[]): Promise<Omit<Answer, "slots">> {
  const r = await chat({
    tier: "small",
    task: "plan_info",
    maxTokens: 400,
    messages: [
      { role: "system", content: `${PLAN_INFO_SYSTEM}\n\nข้อมูลแบบประกัน\n${planInfoText()}` },
      ...recentTurns(history, 6),
    ],
  });
  return { reply: r.text.trim() || HAND_OVER };
}

async function answerSmallTalk(history: ChatMessage[]): Promise<Omit<Answer, "slots">> {
  const r = await chat({
    tier: "small",
    task: "small_talk",
    maxTokens: 200,
    messages: [{ role: "system", content: SMALL_TALK_SYSTEM }, ...recentTurns(history, 6)],
  });
  return { reply: r.text.trim() || ASK_FOR_DETAILS };
}

/**
 * What the plan is, in the engine's own figures. Built from the same facts the sales page
 * renders, so a change to the rate tables reaches the chat without anyone retyping a number.
 */
function planInfoText(): string {
  const f = lifeProtectFacts();
  const table = lifeProtectTable();
  return [
    "ชื่อแบบ: Life Protect+ 100 (Life Protect x 2)",
    `รับประกันอายุ ${f.ageMin}-${f.ageMax} ปี คุ้มครองถึงอายุ ${f.coverToAge} ปี`,
    `ทุนประกันขั้นต่ำ ${baseSumAssuredLimits(getPlan(PLAN_CODE)!.rules, DEFAULT_TERM).min.toLocaleString("en-US")} บาท`,
    `เสียชีวิตก่อนอายุ ${f.boosterBeforeAge} ปี ครอบครัวได้รับ 2 เท่าของทุน ตั้งแต่อายุ ${f.boosterBeforeAge} ปีได้รับ 1 เท่าของทุน`,
    `แบบการชำระเบี้ยมี ${table.terms.map((t) => t.label).join(" / ")}`,
    "เบี้ยคงที่ตลอดระยะเวลาชำระ มีมูลค่าเวนคืนสะสม",
    `ตัวอย่าง ${f.example.sex === "M" ? "ชาย" : "หญิง"}อายุ ${f.example.age} ปี ทุน ${f.example.sum}: ` +
      f.example.terms.map((t) => `${t.label} ${t.premium ?? "-"}${t.per ?? ""}`).join(", "),
    `มูลค่าเวนคืนที่อายุ 60 ปีของตัวอย่างแบบจ่าย 19 ปี ${f.cash60}`,
  ].join("\n");
}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npx vitest run tests/calc/assistant-answer.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 6: Commit**

```bash
git add src/lib/assistant tests/calc/assistant-answer.test.ts
git commit -m "feat(assistant): quote the plan in the sales page's own words"
```

---

## Task 6: The webhook

**Files:**
- Create: `src/app/api/facebook/webhook/route.ts` (restore, rewire)
- Modify: `src/app/api/health/route.ts`
- Test: `tests/calc/messenger-webhook.test.ts`

- [ ] **Step 1: Restore the route**

```bash
mkdir -p src/app/api/facebook/webhook
git show 7fb20b8^:src/app/api/facebook/webhook/route.ts > src/app/api/facebook/webhook/route.ts
```

- [ ] **Step 2: Write the failing test**

Create `tests/calc/messenger-webhook.test.ts`. It exercises `handle()` alone — the route's HTTP
shell is covered by the signature tests in Task 2.

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

const sent: { text: string[]; images: string[] } = { text: [], images: [] };
const session = { messages: [] as unknown[], slots: null as unknown, mutedUntil: null as string | null };
const saved: { mutedUntil: Date | null }[] = [];
const answer = vi.fn(async () => ({ reply: "เบี้ยประมาณ…", slots: { intent: "quote" }, priced: true, card: "/api/card?x=1" }));

vi.mock("@/lib/facebook/client", () => ({
  sendMessage: async (_psid: string, text: string) => { sent.text.push(text); },
  sendImage: async (_psid: string, url: string) => { sent.images.push(url); },
  showTyping: async () => {},
}));
vi.mock("@/lib/chat/session", async () => {
  const actual = await vi.importActual<typeof import("@/lib/chat/session")>("@/lib/chat/session");
  return {
    ...actual,
    claimEvent: async () => true,
    loadSession: async () => session,
    saveSession: async (_c: string, _u: string, _m: unknown, _s: unknown, mutedUntil: Date | null) => { saved.push({ mutedUntil }); },
  };
});
vi.mock("@/lib/assistant/answer", () => ({ answerQuestion: answer }));

const { handle } = await import("@/app/api/facebook/webhook/route");

beforeEach(() => {
  process.env.FB_APP_ID = "app-1";
  sent.text = []; sent.images = []; saved.length = 0;
  session.messages = []; session.mutedUntil = null;
  answer.mockClear();
});

describe("a customer's message", () => {
  it("is answered in words and then in a picture", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m1", text: "ชาย 35 ล้านนึง" } });
    expect(sent.text).toEqual(["เบี้ยประมาณ…"]);
    expect(sent.images[0]).toContain("/api/card?x=1");
  });
});

describe("the agent answering by hand", () => {
  it("silences the bot for a day and costs nothing", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m2", text: "เดี๋ยวโทรหาครับ", is_echo: true } });
    expect(answer).not.toHaveBeenCalled();
    expect(sent.text).toEqual([]);
    expect(saved[0].mutedUntil).toBeInstanceOf(Date);
  });

  it("leaves the bot silent while the mute stands", async () => {
    session.mutedUntil = new Date(Date.now() + 3600_000).toISOString();
    await handle({ sender: { id: "psid" }, message: { mid: "m3", text: "ขอราคาหน่อย" } });
    expect(answer).not.toHaveBeenCalled();
    expect(sent.text).toEqual([]);
  });

  it("does not silence the bot for its own echo", async () => {
    await handle({ sender: { id: "psid" }, message: { mid: "m4", text: "เบี้ย…", is_echo: true, app_id: "app-1" } });
    expect(saved).toEqual([]);
  });
});
```

- [ ] **Step 3: Run the test and watch it fail**

Run: `npx vitest run tests/calc/messenger-webhook.test.ts`
Expected: FAIL — `handle` is not exported and knows nothing about echoes.

- [ ] **Step 4: Rewire the route**

- Export `handle` for the test.
- Drop the imports of `@/lib/alerts/lead` and its call — alerts are out of scope.
- `answerQuestion(history, session.slots)` keeps its two arguments; `slots` is now non-null,
  so pass `session.slots ?? { intent: "other" }`.
- Insert the echo branch before anything reads the customer's words, and the mute check before
  the router is reached:

```ts
export async function handle(event: Messaging): Promise<void> {
  const psid = event.sender?.id;
  if (!psid) return;
  const userHash = hashUserId(psid);

  // the agent has answered in the Page's own inbox: the bot steps out of this thread for a day
  if (agentTyped(event)) {
    const session = await loadSession("facebook", userHash);
    await saveSession("facebook", userHash, session.messages as ChatMessage[], session.slots, muteFor());
    return;
  }

  const text = textOf(event);
  if (!text) return;

  const key = eventKey(event);
  if (key && !(await claimEvent("facebook", key))) return;

  const session = await loadSession("facebook", userHash);
  if (isMuted(session.mutedUntil)) return;

  if (!allow(`fb:${userHash}`)) {
    await sendMessage(psid, BUSY);
    return;
  }

  const history: ChatMessage[] = [...session.messages, { role: "user", content: text }];
  await showTyping(psid).catch(() => {});
  try {
    const answer = await answerQuestion(history, session.slots ?? { intent: "other" });
    await sendMessage(psid, answer.reply);
    if (answer.card) await sendImage(psid, siteUrl(answer.card)).catch((e) => console.error("card failed:", e));
    await saveSession("facebook", userHash, [...history, { role: "assistant", content: answer.reply }], answer.slots, null);
  } catch (e) {
    await sendMessage(psid, e instanceof BudgetExceeded ? OUT_OF_BUDGET : BROKEN);
    throw e;
  }
}
```

- [ ] **Step 5: Restore `siteUrl`**

If `src/lib/site-url.ts` is missing, restore it: `git show 7fb20b8^:src/lib/site-url.ts > src/lib/site-url.ts`.
Messenger fetches the card itself, so the URL has to be absolute and public.

- [ ] **Step 6: Say the channel is up in the health check**

In `src/app/api/health/route.ts`, report whether the Page is connected, the way it used to:
add `messenger: Boolean(await pageToken().catch(() => null))` to the JSON it returns.

- [ ] **Step 7: Run the test and watch it pass**

Run: `npx vitest run tests/calc/messenger-webhook.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 8: Commit**

```bash
git add src/app/api/facebook src/app/api/health src/lib/site-url.ts tests/calc/messenger-webhook.test.ts
git commit -m "feat(messenger): answer the page's inbox, and know when to keep quiet"
```

---

## Task 7: Connecting the Page

**Files:**
- Create: `src/lib/facebook/connection.ts`, `src/lib/facebook/oauth.ts`, `src/lib/facebook/status.ts` (restore)
- Create: `src/app/api/facebook/connect/route.ts`, `src/app/api/facebook/connect/callback/route.ts` (restore)
- Create: `src/app/admin/messenger/page.tsx`, `PagePicker.tsx`, `DisconnectButton.tsx`, `useAction.tsx`, `actions.ts` (restore, trimmed)
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Restore the library and the two routes**

```bash
for f in connection oauth status; do git show 7fb20b8^:src/lib/facebook/$f.ts > src/lib/facebook/$f.ts; done
mkdir -p src/app/api/facebook/connect/callback
git show 7fb20b8^:src/app/api/facebook/connect/route.ts > src/app/api/facebook/connect/route.ts
git show 7fb20b8^:src/app/api/facebook/connect/callback/route.ts > src/app/api/facebook/connect/callback/route.ts
git show 7fb20b8^:src/lib/facebook/origin.ts > src/lib/facebook/origin.ts
```

- [ ] **Step 2: Restore the back-office page**

```bash
mkdir -p src/app/admin/messenger
for f in page.tsx PagePicker.tsx DisconnectButton.tsx useAction.tsx actions.ts; do
  git show 7fb20b8^:src/app/admin/messenger/$f > src/app/admin/messenger/$f
done
```

- [ ] **Step 3: Cut what this round does not have**

Delete from the restored files, and from `page.tsx`'s layout:

- `ProfileForm.tsx` and `RefreshSubscriptionButton.tsx` are not restored; remove their imports and the blocks that render them. The greeting and ice breakers were dropped by `001d646` because Meta stopped accepting them.
- `src/lib/facebook/profile.ts` is not restored; delete any import of it from `status.ts` and the profile fields from what `status.ts` returns.
- Anything the restored `actions.ts` does with alerts or with the knowledge base.

- [ ] **Step 4: Put the page back in the back-office nav**

In `src/app/admin/layout.tsx`, add the tab beside the AI one:

```tsx
<NavLink href="/admin/messenger">Messenger</NavLink>
```

Match the element and prop names the file already uses — read it first.

- [ ] **Step 5: Check it compiles and renders**

Run: `npx tsc --noEmit`
Expected: no errors. Then `npm run dev`, open `http://localhost:3000/admin/messenger`, sign in
and confirm the page says the Page is not connected and offers the connect button. Do not
press it yet — the app's redirect URI is not registered until Task 9.

- [ ] **Step 6: Commit**

```bash
git add src/lib/facebook src/app/api/facebook/connect src/app/admin
git commit -m "feat(admin): connect the Page by logging in, not by pasting a token"
```

---

## Task 8: Say what is kept

**Files:**
- Modify: `src/app/privacy/page.tsx`

- [ ] **Step 1: Read what the page claims now**

Run: `grep -n "ไม่เก็บ\|เก็บ" src/app/privacy/page.tsx`

The page currently says nothing about a visitor is collected. With the bot answering, that is
no longer true, and Meta reads this page when the app is reviewed.

- [ ] **Step 2: Write the section the bot needs**

Add a section covering, in the page's existing voice and markup:

- Messages sent to the Page are kept for at most 24 hours so a follow-up question makes sense, then deleted.
- The sender is stored as an HMAC hash of the page-scoped id, which cannot be turned back into a person.
- The AI ledger records token counts and cost only, never the customer's words.
- The bot never asks for a national ID, medical history, policy number or payment details.
- How to ask for deletion, at the existing `#rights` anchor.

- [ ] **Step 3: Check the page renders**

Run: `npm run dev`, open `http://localhost:3000/privacy`, read the new section end to end.

- [ ] **Step 4: Commit**

```bash
git add src/app/privacy/page.tsx
git commit -m "docs(privacy): say what the page's inbox keeps, and for how long"
```

---

## Task 9: The steps on Meta's own site

**Files:**
- Create: `docs/facebook-connect.md`

- [ ] **Step 1: Restore the old note as a starting point**

```bash
git show 7fb20b8^:docs/facebook-connect.md > docs/facebook-connect.md
```

- [ ] **Step 2: Rewrite it as a checklist for today**

It must cover, in Thai, in the order a person does them:

1. Confirm the app `ai chet` (`1624098972401227`) still exists and the Page is still in the same business portfolio.
2. Where to copy `FB_APP_ID` and `FB_APP_SECRET`, and where to set `FB_VERIFY_TOKEN` (a string you choose) — in `.env.local` and in Vercel's project settings, all three environments.
3. Set the webhook to `https://www.advisortool.app/api/facebook/webhook` with that verify token.
4. Subscribe the Page to `messages`, `messaging_postbacks` and `message_echoes`. Name `message_echoes` explicitly: without it the bot talks over the agent.
5. Add `https://www.advisortool.app/api/facebook/connect/callback` to the app's Valid OAuth Redirect URIs.
6. Open `/admin/messenger`, press connect, choose the Page.
7. Test from a Facebook account with no role in the app.

Also record what `docs/facebook-app-review.md` found on 4 Sep 2026: because the Page and the app
sit in one business portfolio, no App Review is needed to answer the public on this Page. Taking
the bot to another agent's Page does need one.

- [ ] **Step 3: Commit**

```bash
git add docs/facebook-connect.md
git commit -m "docs: the steps on Meta's site, in the order a person does them"
```

---

## Task 10: Ship it

- [ ] **Step 1: Run the whole suite and the build**

Run: `npm run verify`
Expected: tsc clean, eslint clean, every vitest file passing, `next build` succeeding.

- [ ] **Step 2: Do Task 9's checklist on Meta, then connect the Page**

Open `/admin/messenger` and connect. The page should then name the Page it is connected to.

- [ ] **Step 3: Message the Page from an account with no role in the app**

Send "สนใจครับ", then "ชาย 35 ล้านนึง". Expect a greeting, then the quote and the card.
Check `/api/health` says `messenger: true`.

- [ ] **Step 4: Prove the mute**

Reply by hand from the Page's inbox, then send another message from the test account.
Expect silence. Check the row:

```sql
select muted_until from ins_chat_sessions where channel = 'facebook' order by updated_at desc limit 1;
```

- [ ] **Step 5: Merge into main and push**

`main` is checked out in the repository root, not here. From this worktree:

```bash
git -C "/Users/pheerapatpisit/Documents/APP/Ai Assis" status --porcelain
git -C "/Users/pheerapatpisit/Documents/APP/Ai Assis" merge --ff-only claude/open-project-a75c36
git -C "/Users/pheerapatpisit/Documents/APP/Ai Assis" push
```

Re-run `npm run verify` in that directory afterwards: it is the tree production deploys from.

- [ ] **Step 6: Watch the first real conversations**

After the deploy, check `ins_usage_ledger` for the day's cost and read the first few threads in
the Page's inbox. A reply that reads wrong is a prompt to fix, not a model to swap.
