/**
 * The way a customer reaches a person from the sales page.
 *
 * The LINE account is asked for its own ID rather than told it in a setting, so the button
 * follows whichever account the bot answers as instead of waiting for a deploy config to
 * catch up.
 *
 * Null means the channel is not set up, and the page leaves that button out.
 */
export interface LegacyChannels {
  /** the LINE official account's basic ID, e.g. "@006crkvq" */
  lineOaId: string | null;
}

const INFO_URL = "https://api.line.me/v2/bot/info";

/** An env value only counts when it holds something; an empty variable is not a setting. */
function fromEnv(name: string): string | null {
  return process.env[name] || null;
}

async function lineBasicId(): Promise<string | null> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return null;
  const res = await fetch(INFO_URL, {
    headers: { authorization: `Bearer ${token}` },
    // the account's own ID changes about never, so it is worth an hour of not asking again
    next: { revalidate: 3600 },
  });
  if (!res.ok) return null;
  return ((await res.json()) as { basicId?: string }).basicId ?? null;
}

/**
 * A LINE token that has been revoked costs the button and nothing else — the page still
 * renders with whatever is left, because a landing page that loads beats an error.
 */
export async function legacyChannels(): Promise<LegacyChannels> {
  try {
    return { lineOaId: (await lineBasicId()) ?? fromEnv("NEXT_PUBLIC_LINE_OA_ID") };
  } catch {
    return { lineOaId: fromEnv("NEXT_PUBLIC_LINE_OA_ID") };
  }
}
