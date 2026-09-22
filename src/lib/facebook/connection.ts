import { supabaseAdmin } from "@/lib/supabase/admin";
import { LEGACY_KEY, PENDING_KEY, isAdsKey, keyFor, pageIdInKey } from "./keys";

/**
 * The Page the bot answers as, and the token it answers with.
 *
 * The token arrives from Meta's own login screen and is kept encrypted in the database, so
 * connecting a Page is something the back office can do on its own — no deploy config to
 * edit, no redeploy to wait for. FB_PAGE_ACCESS_TOKEN still works as a fallback for a
 * deployment that was set up by hand before this existed.
 */

export { PENDING_KEY };

export interface PageConnection {
  /** true while this Page is still under the pre-multi-Page row */
  legacy?: boolean;
  pageId: string;
  pageName: string;
  scopes: string[];
  fields: string[];
  connectedAt: string;
}

interface Row {
  key: string;
  page_id: string | null;
  page_name: string | null;
  token: string;
  scopes: string[] | null;
  fields: string[] | null;
  updated_at: string;
}

function passphrase(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

async function read(key: string): Promise<Row | null> {
  const { data, error } = await supabaseAdmin()
    .rpc("ins_get_channel_auth", { p_key: key, p_passphrase: passphrase() });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Row[])[0] ?? null;
}

/** Every message the bot sends goes through this, so it is cached briefly, per Page. */
const cache = new Map<string, { at: number; token: string | null }>();
const CACHE_MS = 60_000;

export function forgetCachedToken(): void {
  cache.clear();
}

/**
 * The token to answer a given Page with.
 *
 * `pageId` is the one the message arrived on, and answering with any other Page's token is
 * either rejected by Meta or — worse — sends the agency's reply out of the wrong Page. It is
 * optional only because two callers have no Page in hand: the health check, which just wants
 * to know whether anything is connected, and the profile lookup at start-up.
 *
 * The legacy row is still read. It is what the live Page is answering from today, and a
 * deploy that stopped recognising it would take the agency's inbox down until somebody
 * noticed. It is consulted only when the Page-specific row is absent, and only when it is
 * that Page's row or no Page was named.
 */
export async function pageToken(pageId?: string): Promise<string | null> {
  const slot = pageId ?? "";
  const hit = cache.get(slot);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.token;

  const keep = (t: string | null) => {
    cache.set(slot, { at: Date.now(), token: t });
    return t;
  };

  try {
    if (pageId) {
      const own = await read(keyFor(pageId));
      if (own?.token) return keep(own.token);
    }

    const legacy = await read(LEGACY_KEY);
    if (legacy?.token && (!pageId || !legacy.page_id || legacy.page_id === pageId)) {
      return keep(legacy.token);
    }

    /**
     * A named Page with no row of its own, while the old single row belongs to a different
     * Page. Nothing here can answer it, and the env token is the least safe guess available —
     * on a deployment that has one it is the other Page's. Answering a customer out of the
     * wrong inbox is worse than not answering, so this stops.
     */
    if (pageId && legacy?.page_id && legacy.page_id !== pageId) return keep(null);

    if (!pageId) {
      const any = await anyConnectedToken();
      if (any) return keep(any);
    }
  } catch {
    // a database that is unreachable must not take the bot down when an env token exists
  }

  return keep(process.env.FB_PAGE_ACCESS_TOKEN ?? null);
}

/** For the callers that only want to know whether any Page at all is connected. */
async function anyConnectedToken(): Promise<string | null> {
  const first = (await pageConnections())[0];
  return first ? (await read(keyFor(first.pageId)))?.token ?? null : null;
}

/**
 * Every Page connected here, newest first.
 *
 * Read with a plain select rather than through the decrypting RPC, because nothing on this
 * list needs the token — and a listing that hands out secrets to draw a screen is a listing
 * that will eventually be logged.
 */
export async function pageConnections(): Promise<PageConnection[]> {
  const { data, error } = await supabaseAdmin()
    .from("ins_channel_auth")
    .select("key, page_id, page_name, scopes, fields, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Omit<Row, "token">[];
  return rows
    .filter((r) => r.key !== PENDING_KEY && !isAdsKey(r.key) && r.page_id)
    .map((r) => ({
      pageId: r.page_id!,
      pageName: r.page_name ?? r.page_id!,
      scopes: r.scopes ?? [],
      fields: r.fields ?? [],
      connectedAt: r.updated_at,
      /** true while this Page is still stored under the single row written before Pages
          were told apart — it works, and it is what the migration moves */
      legacy: pageIdInKey(r.key) === undefined,
    }));
}

/** The first connected Page, for the screens that only ask whether there is one. */
export async function pageConnection(): Promise<PageConnection | null> {
  return (await pageConnections())[0] ?? null;
}

export async function saveConnection(c: {
  pageId: string; pageName: string; token: string; scopes: string[]; fields: string[];
}): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_set_channel_auth", {
    p_key: keyFor(c.pageId),
    p_page_id: c.pageId,
    p_page_name: c.pageName,
    p_token: c.token,
    p_scopes: c.scopes,
    p_fields: c.fields,
    p_passphrase: passphrase(),
  });
  if (error) throw new Error(error.message);
  forgetCachedToken();
}

export async function clearConnection(pageId?: string): Promise<void> {
  // without a Page named, the legacy row is the only one that can be meant
  const { error } = await supabaseAdmin()
    .rpc("ins_clear_channel_auth", { p_key: pageId ? keyFor(pageId) : LEGACY_KEY });
  if (error) throw new Error(error.message);
  forgetCachedToken();
}

/** Holds the user token between the Meta redirect and the moment a Page is picked. */
export async function savePending(userToken: string, scopes: string[]): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_set_channel_auth", {
    p_key: PENDING_KEY,
    p_page_id: null,
    p_page_name: null,
    p_token: userToken,
    p_scopes: scopes,
    p_fields: [],
    p_passphrase: passphrase(),
  });
  if (error) throw new Error(error.message);
}

export async function readPending(): Promise<{ token: string; scopes: string[] } | null> {
  const row = await read(PENDING_KEY);
  return row ? { token: row.token, scopes: row.scopes ?? [] } : null;
}

export async function clearPending(): Promise<void> {
  await supabaseAdmin().rpc("ins_clear_channel_auth", { p_key: PENDING_KEY });
}
