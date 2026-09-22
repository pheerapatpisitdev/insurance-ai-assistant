import { supabaseAdmin } from "@/lib/supabase/admin";
import { ADS_PENDING_KEY, adAccountIdInKey, adsKeyFor } from "./keys";

/**
 * The ad accounts the back office may read figures from, and the token it reads with.
 *
 * One user token, kept once per account it was granted for. It is the person's own token
 * rather than a Page's, because ad accounts belong to people and businesses, not to Pages —
 * and it lasts about sixty days, after which Meta answers with error 190 and the ADS page
 * asks for the login again. The Page tokens next to it in the table never expire; this one
 * does, and that difference is the whole reason the page has a "reconnect" state.
 */

export interface AdAccount {
  /** Meta's id, with its `act_` prefix */
  id: string;
  name: string;
  currency: string | null;
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

/** Every connected ad account, newest first. No token travels with the list. */
export async function adAccounts(): Promise<AdAccount[]> {
  const { data, error } = await supabaseAdmin()
    .from("ins_channel_auth")
    .select("key, page_id, page_name, fields, updated_at")
    .order("updated_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as Omit<Row, "token" | "scopes">[];
  return rows.flatMap((r) => {
    const id = adAccountIdInKey(r.key);
    if (!id) return [];
    // the currency rides in `fields` — a column meant for webhook fields, but it is a text
    // array and the account has exactly one word to keep there
    return [{ id, name: r.page_name ?? id, currency: r.fields?.[0] ?? null, connectedAt: r.updated_at }];
  });
}

export async function adAccountToken(actId: string): Promise<string | null> {
  return (await read(adsKeyFor(actId)))?.token ?? null;
}

export async function saveAdAccount(a: { id: string; name: string; currency: string | null; token: string; scopes: string[] }): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_set_channel_auth", {
    p_key: adsKeyFor(a.id),
    p_page_id: a.id,
    p_page_name: a.name,
    p_token: a.token,
    p_scopes: a.scopes,
    p_fields: a.currency ? [a.currency] : [],
    p_passphrase: passphrase(),
  });
  if (error) throw new Error(error.message);
}

export async function clearAdAccount(actId: string): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_clear_channel_auth", { p_key: adsKeyFor(actId) });
  if (error) throw new Error(error.message);
}

/** Holds the user token between the Meta redirect and the moment an account is picked. */
export async function savePendingAds(userToken: string, scopes: string[]): Promise<void> {
  const { error } = await supabaseAdmin().rpc("ins_set_channel_auth", {
    p_key: ADS_PENDING_KEY,
    p_page_id: null,
    p_page_name: null,
    p_token: userToken,
    p_scopes: scopes,
    p_fields: [],
    p_passphrase: passphrase(),
  });
  if (error) throw new Error(error.message);
}

export async function readPendingAds(): Promise<{ token: string; scopes: string[] } | null> {
  const row = await read(ADS_PENDING_KEY);
  return row ? { token: row.token, scopes: row.scopes ?? [] } : null;
}

export async function clearPendingAds(): Promise<void> {
  await supabaseAdmin().rpc("ins_clear_channel_auth", { p_key: ADS_PENDING_KEY });
}
