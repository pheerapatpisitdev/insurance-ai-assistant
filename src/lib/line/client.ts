const REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const PUSH_URL = "https://api.line.me/v2/bot/message/push";

/** LINE rejects a text message longer than this, so a long answer is split across bubbles. */
const MAX_TEXT = 4800;
const MAX_BUBBLES = 5;

function token(): string {
  const t = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!t) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set");
  return t;
}

/** Splits on blank lines first, then hard-wraps whatever is still too long. */
export function toBubbles(text: string): { type: "text"; text: string }[] {
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
  return chunks.slice(0, MAX_BUBBLES).map((t) => ({ type: "text" as const, text: t }));
}

async function send(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token()}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LINE ${res.status}: ${(await res.text()).slice(0, 300)}`);
}

export async function reply(replyToken: string, text: string): Promise<void> {
  await send(REPLY_URL, { replyToken, messages: toBubbles(text) });
}

/** Used when the reply token has expired, which happens once an answer takes too long. */
export async function push(to: string, text: string): Promise<void> {
  await send(PUSH_URL, { to, messages: toBubbles(text) });
}
