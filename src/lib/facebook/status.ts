/**
 * What Meta says about the Page this bot answers for.
 *
 * The token generated from Messenger → Settings carries `pages_messaging` and nothing else,
 * which is all the bot needs to read and answer messages but not enough to read the Page's
 * own name or its app subscriptions. Those two reads are therefore best-effort: a permission
 * refusal is a note about what cannot be shown, not a fault. Only a token that cannot send
 * messages at all is an error, because only that stops the bot.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

export interface FacebookStatus {
  configured: boolean;
  /** the token is live and may send and receive messages — the one thing the bot needs */
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

class GraphError extends Error {
  constructor(readonly code: number, readonly detail: string) {
    super(detail);
  }
}

/** Meta answers a missing scope with one of these; anything else (190 above all) is a bad token. */
const PERMISSION_CODES = new Set([3, 10, 100, 200, 294, 299]);

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

export async function facebookStatus(): Promise<FacebookStatus> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) return { configured: false, notes: [], errors: ["ยังไม่ได้ตั้งค่า FB_PAGE_ACCESS_TOKEN"] };

  const status: FacebookStatus = { configured: true, notes: [], errors: [] };
  // each call stands on its own: one refused read should not blank the whole page
  const [messaging, page, subs] = await Promise.allSettled([
    get<unknown>("/me/messenger_profile?fields=greeting", token),
    get<{ id: string; name: string }>("/me?fields=id,name", token),
    get<{ data: { name: string; subscribed_fields?: string[] }[] }>("/me/subscribed_apps", token),
  ]);

  status.messagingOk = messaging.status === "fulfilled";
  if (messaging.status === "rejected") {
    const e = messaging.reason as GraphError;
    status.errors.push(
      e.code === 190
        ? `โทเค็นเพจใช้ไม่ได้แล้ว ต้องออกใหม่: ${e.detail}`
        : `โทเค็นเพจส่งข้อความไม่ได้: ${e.detail}`,
    );
  }

  if (page.status === "fulfilled") {
    status.pageId = page.value.id;
    status.pageName = page.value.name;
  } else note(status, page.reason as GraphError, "ชื่อและรหัสเพจ", "pages_show_list");

  if (subs.status === "fulfilled") {
    const apps = subs.value.data ?? [];
    status.subscribed = apps.length > 0;
    status.fields = apps.flatMap((a) => a.subscribed_fields ?? []);
  } else note(status, subs.reason as GraphError, "การรับข้อมูล", "pages_manage_metadata");

  return status;
}

function note(status: FacebookStatus, e: GraphError, what: string, scope: string) {
  if (PERMISSION_CODES.has(e.code)) {
    status.notes.push(`ดู${what}ไม่ได้ เพราะโทเค็นไม่มีสิทธิ์ ${scope} — ไม่กระทบการตอบข้อความ`);
  } else {
    status.errors.push(`อ่าน${what}ไม่ได้: ${e.detail}`);
  }
}
