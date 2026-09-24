/**
 * What Meta says about each Page this bot answers for.
 *
 * The token generated from Messenger → Settings carries `pages_messaging` and nothing else,
 * which is all the bot needs to read and answer messages but not enough to read the Page's
 * own name or its app subscriptions. Those two reads are therefore best-effort: a permission
 * refusal is a note about what cannot be shown, not a fault. Only a token that cannot send
 * messages at all is an error, because only that stops the bot.
 *
 * Every connected Page is asked separately, because Meta answers per Page and the failure
 * this screen exists to catch is one Page going dark while another is fine: a login that
 * re-grants the app for one Page revokes it for every Page left unticked, and a screen that
 * checked only the newest connection called that "everything is working".
 */

import { pageToken } from "./connection";

const GRAPH = "https://graph.facebook.com/v23.0";

export interface FacebookStatus {
  configured: boolean;
  /** the token is live and may send and receive messages — the one thing the bot needs; undefined when Meta would not say */
  messagingOk?: boolean;
  pageName?: string;
  pageId?: string;
  /** the Page sends its events to this app */
  subscribed?: boolean;
  fields?: string[];
  /** what the token is not allowed to read; harmless, but worth saying out loud */
  notes: string[];
  errors: string[];
}

/** One connected Page, as Meta describes it at this moment. */
export interface PageStatus extends FacebookStatus {
  /** from our own records, so a Page that Meta refuses to talk about is still named on screen */
  connectedPageId: string;
  connectedPageName: string;
  /** Meta has taken the token away; this Page answers nobody until it is connected again */
  revoked: boolean;
}

export interface PageRef {
  pageId: string;
  pageName: string;
}

class GraphError extends Error {
  constructor(readonly code: number, readonly detail: string) {
    super(detail);
  }
}

/** Meta answers a missing scope with one of these; anything else (190 above all) is a bad token. */
const PERMISSION_CODES = new Set([3, 10, 100, 200, 294, 299]);
/** Too many calls in a short while — says nothing about the token, only about the clock. */
const RATE_LIMIT_CODES = new Set([4, 17, 32, 613]);
const RATE_LIMIT_NOTE = "Meta จำกัดจำนวนครั้งที่ถามได้ ตรวจไม่ได้ชั่วคราว ลองเปิดหน้านี้ใหม่ในอีกสักครู่";

export type Trouble = "rate-limit" | "revoked" | "permission" | "other";

/**
 * What a Graph error code means for this screen.
 *
 * Split out and tested because the three kinds read almost alike in the response and mean
 * opposite things here: one is the clock, one is a read this token was never allowed, and one
 * — 190 — is the Page being unable to answer a customer. That last one reached production
 * twice as a green screen, so it is a case of its own rather than a permission note.
 */
export function classify(code: number): Trouble {
  if (RATE_LIMIT_CODES.has(code)) return "rate-limit";
  if (code === 190) return "revoked";
  if (PERMISSION_CODES.has(code)) return "permission";
  return "other";
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await res.text();
  let body: (T & { error?: { code?: number; message?: string } }) | undefined;
  try {
    body = JSON.parse(text) as T & { error?: { code?: number; message?: string } };
  } catch {
    throw new GraphError(res.status, `${path} ${res.status}: ${text.slice(0, 120)}`);
  }
  if (!res.ok || body.error) {
    const err = body.error ?? {};
    throw new GraphError(err.code ?? res.status, err.message ?? `${path} ${res.status}`);
  }
  return body;
}

/**
 * Every connected Page, checked one by one.
 *
 * With no Page connected at all there may still be an FB_PAGE_ACCESS_TOKEN set by hand on a
 * deployment older than this screen, and that token is what the bot would be answering with,
 * so it is probed under a nameless entry rather than left off the screen entirely.
 */
export async function facebookStatuses(pages: PageRef[]): Promise<PageStatus[]> {
  if (pages.length === 0) {
    const fallback = await statusOf({ pageId: "", pageName: "" });
    return fallback.configured ? [fallback] : [];
  }
  return Promise.all(pages.map(statusOf));
}

async function statusOf(page: PageRef): Promise<PageStatus> {
  const status: PageStatus = {
    connectedPageId: page.pageId,
    connectedPageName: page.pageName,
    revoked: false,
    configured: true,
    notes: [],
    errors: [],
  };

  // an empty id means the env-token fallback, which belongs to whichever Page Meta says
  const token = await pageToken(page.pageId || undefined);
  if (!token) {
    return { ...status, configured: false, errors: ["ยังไม่ได้เชื่อมต่อเพจ Facebook"] };
  }

  // each call stands on its own: one refused read should not blank the whole Page
  const [messaging, profile, subs] = await Promise.allSettled([
    get<unknown>("/me/messenger_profile?fields=greeting", token),
    get<{ id: string; name: string }>("/me?fields=id,name", token),
    get<{ data: SubscribedApp[] }>("/me/subscribed_apps", token),
  ]);

  if (messaging.status === "fulfilled") {
    status.messagingOk = true;
  } else {
    const e = messaging.reason as GraphError;
    const kind = classify(e.code);
    if (kind === "rate-limit") {
      addNote(status, RATE_LIMIT_NOTE);
    } else {
      status.messagingOk = false;
      if (kind === "revoked") {
        status.revoked = true;
        status.errors.push("Meta ถอนสิทธิ์ของเพจนี้แล้ว บอทตอบข้อความในเพจนี้ไม่ได้เลย");
      } else {
        status.errors.push(`สิทธิ์เชื่อมต่อของเพจนี้ส่งข้อความไม่ได้ — Facebook แจ้งว่า: ${e.detail}`);
      }
    }
  }

  if (profile.status === "fulfilled") {
    status.pageId = profile.value.id;
    status.pageName = profile.value.name;
  } else note(status, profile.reason as GraphError, "ชื่อและรหัสเพจ", "pages_show_list");

  if (subs.status === "fulfilled") {
    const ours = ourSubscription(subs.value.data ?? [], process.env.FB_APP_ID);
    if (ours) {
      status.subscribed = ours.subscribed;
      status.fields = ours.fields;
    } else {
      addNote(status, "บอกไม่ได้ว่าเพจส่งข้อมูลมาที่แอปนี้หรือไม่ เพราะเครื่องนี้ยังไม่ได้ตั้ง FB_APP_ID");
    }
  } else note(status, subs.reason as GraphError, "การรับข้อมูล", "pages_manage_metadata");

  return status;
}

/** One entry of a Page's `subscribed_apps` — every app the Page sends its events to, not only ours. */
export interface SubscribedApp {
  id?: string;
  name?: string;
  subscribed_fields?: string[];
}

/**
 * Whether the Page sends its events to this app, and which ones.
 *
 * The list Meta returns is every app the Page is subscribed to. A Page that also feeds a
 * chat-inbox tool, a CRM or an old test app has entries in it that have nothing to do with
 * this bot, and counting the list — or pooling everyone's fields — drew a green "เพจส่งข้อมูล
 * มาที่แอปนี้แล้ว" for a Page that sends this app nothing at all. Only the entry carrying our
 * own app id counts.
 *
 * Nothing (rather than a guess) when the app id is not set, because then no entry can be told
 * to be ours and either answer would be made up.
 */
export function ourSubscription(
  apps: SubscribedApp[],
  appId: string | undefined,
): { subscribed: boolean; fields: string[] } | undefined {
  if (!appId) return undefined;
  const mine = apps.filter((a) => a.id === appId);
  return {
    subscribed: mine.length > 0,
    fields: mine.flatMap((a) => a.subscribed_fields ?? []),
  };
}

function addNote(status: PageStatus, text: string) {
  if (!status.notes.includes(text)) status.notes.push(text);
}

function note(status: PageStatus, e: GraphError, what: string, scope: string) {
  switch (classify(e.code)) {
    case "rate-limit":
      return addNote(status, RATE_LIMIT_NOTE);
    /** the one line about the revoked token has been said already; repeating it per read buries it */
    case "revoked":
      status.revoked = true;
      return;
    case "permission":
      return addNote(status, `ดู${what}ไม่ได้ เพราะสิทธิ์เชื่อมต่อไม่รวม ${scope} — ไม่กระทบการตอบข้อความ`);
    default:
      status.errors.push(`อ่าน${what}ไม่ได้ — Facebook แจ้งว่า: ${e.detail}`);
  }
}
