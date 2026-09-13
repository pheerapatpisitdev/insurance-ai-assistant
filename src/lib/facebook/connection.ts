import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * The Page the bot answers as, and the token it answers with.
 *
 * The token arrives from Meta's own login screen and is kept encrypted in the database, so
 * connecting a Page is something the back office can do on its own — no deploy config to
 * edit, no redeploy to wait for. FB_PAGE_ACCESS_TOKEN still works as a fallback for a
 * deployment that was set up by hand before this existed.
 */

/** the live connection */
const KEY = "facebook";
/** a login in progress: the user token, held only until a Page is chosen */
export const PENDING_KEY = "facebook_pending";

export interface PageConnection {
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

/** Every message the bot sends goes through this, so it is cached briefly. */
let cache: { at: number; token: string | null } | null = null;
const CACHE_MS = 60_000;

export function forgetCachedToken(): void {
  cache = null;
}

/** The Page token to send messages with: the connected one, else the one from the env. */
export async function pageToken(): Promise<string | null> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.token;
  let token: string | null = null;
  try {
    token = (await read(KEY))?.token ?? null;
  } catch {
    // a database that is unreachable must not take the bot down when an env token exists
  }
  token ??= process.env.FB_PAGE_ACCESS_TOKEN ?? null;
  cache = { at: Date.now(), token };
  return token;
}

/** What to show in the back office. Null when nobody has connected a Page here. */
export async function pageConnection(): Promise<PageConnection | null> {
  const row = await read(KEY);
  if (!row?.page_id) return null;
  return {
    pageId: row.page_id,
    pageName: row.page_name ?? row.page_id,
    scopes: row.scopes ?? [],
    fields: row.fields ?? [],
    connectedAt: row.updated_at,
  };
}

export async function saveConnection(c: {
  pageId: string; pageName: string; token: string; scopes: string[]; fields: string[];
}): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_set_channel_auth", {
    p_key: KEY,
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

export async function clearConnection(): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_clear_channel_auth", { p_key: KEY });
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
