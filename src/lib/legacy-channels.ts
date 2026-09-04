import { pageConnection } from "@/lib/facebook/connection";

/**
 * The ways a customer can reach a person from the sales page.
 *
 * Both are read from the channels the bot already answers on rather than from settings of
 * their own: the LINE account is asked for its own ID, and the Facebook Page is the one
 * connected in the back office. Connecting a Page there already changes who the bot replies
 * as, and it would be its own kind of bug for the buttons on the sales page to keep pointing
 * somewhere else until a deploy config caught up.
 *
 * Null means the channel is not set up, and the page leaves that button out.
 */
export interface LegacyChannels {
  /** the LINE official account's basic ID, e.g. "@006crkvq" */
  lineOaId: string | null;
  /** the Facebook Page the bot answers as, in the form m.me accepts */
  messengerPage: string | null;
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

async function connectedPage(): Promise<string | null> {
  return (await pageConnection())?.pageId ?? null;
}

/**
 * Both channels, each answered on its own. A LINE token that has been revoked, or a database
 * that cannot be reached, costs its own button and nothing else — the page still renders with
 * whatever is left, because a landing page with one way to reach someone beats an error.
 */
export async function legacyChannels(): Promise<LegacyChannels> {
  const [line, messenger] = await Promise.allSettled([lineBasicId(), connectedPage()]);
  return {
    lineOaId: value(line) ?? fromEnv("NEXT_PUBLIC_LINE_OA_ID"),
    messengerPage: value(messenger) ?? fromEnv("NEXT_PUBLIC_FB_PAGE"),
  };
}

function value<T>(r: PromiseSettledResult<T | null>): T | null {
  return r.status === "fulfilled" ? r.value : null;
}
