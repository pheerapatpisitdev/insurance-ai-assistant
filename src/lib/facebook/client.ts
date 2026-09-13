import { pageToken } from "./connection";

const GRAPH = "https://graph.facebook.com/v23.0/me";

/** Messenger refuses a message longer than this, so a long answer is split across messages. */
const MAX_TEXT = 1900;
const MAX_PARTS = 5;

async function token(): Promise<string> {
  const t = await pageToken();
  if (!t) throw new Error("ยังไม่ได้เชื่อมต่อเพจ Facebook");
  return t;
}

/** Splits on blank lines first, then hard-wraps whatever is still too long. */
export function toParts(text: string): string[] {
  const parts: string[] = [];
  let current = "";
  for (const para of text.split("\n\n")) {
    if (current && current.length + para.length + 2 > MAX_TEXT) {
      parts.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) parts.push(current);

  const chunks = parts.flatMap((p) => {
    const out: string[] = [];
    for (let i = 0; i < p.length; i += MAX_TEXT) out.push(p.slice(i, i + MAX_TEXT));
    return out;
  });
  return chunks.slice(0, MAX_PARTS);
}

async function post(path: string, body: unknown): Promise<void> {
  // the token goes in the header, not the query string: a URL is written to access logs and
  // proxy caches, and this one can send messages as the page
  const res = await fetch(`${GRAPH}/${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${await token()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Messenger ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

/** An answer takes several seconds; the typing bubble says the page is working on it. */
export async function showTyping(psid: string): Promise<void> {
  await post("messages", { recipient: { id: psid }, sender_action: "typing_on" });
}

/**
 * The quote as a picture. Messenger fetches the URL itself, so it has to be one the public
 * internet can reach — which the card route is, and which is why the card carries no more
 * than the arrangement it draws.
 */
export async function sendImage(psid: string, url: string): Promise<void> {
  await post("messages", {
    recipient: { id: psid },
    messaging_type: "RESPONSE",
    message: { attachment: { type: "image", payload: { url, is_reusable: true } } },
  });
}

export async function sendMessage(psid: string, text: string): Promise<void> {
  // parts go one after another, because Messenger shows them in the order they arrive
  for (const part of toParts(text)) {
    await post("messages", { recipient: { id: psid }, messaging_type: "RESPONSE", message: { text: part } });
  }
}
