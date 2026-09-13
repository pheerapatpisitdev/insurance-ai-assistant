import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Connecting a Page by logging in to Facebook, instead of pasting a token into a deploy
 * config. Meta hands back a short-lived user token; it is traded for a long-lived one,
 * because the Page tokens derived from a long-lived user token do not expire — which is the
 * whole point of doing this once rather than every couple of months.
 */

const GRAPH = "https://graph.facebook.com/v23.0";
const DIALOG = "https://www.facebook.com/v23.0/dialog/oauth";

/**
 * The least the bot can work with: list the Pages this person admins, answer messages as the
 * chosen one, and subscribe that Page to this app's webhook. Nothing broader, so a later App
 * Review stays small.
 */
export const SCOPES = ["pages_show_list", "pages_messaging", "pages_manage_metadata"];

/**
 * The events the webhook actually handles: typed messages, taps on ice breakers or buttons,
 * and the page's own outgoing messages.
 *
 * The last of those is not about answering anyone. It is the only way to learn that the
 * agent has replied by hand, which is what tells the bot to stay out of that thread — a page
 * subscribed without it has a bot that talks over its own agent.
 */
export const SUBSCRIBED_FIELDS = ["messages", "messaging_postbacks", "message_echoes"];

export interface FacebookPage {
  id: string;
  name: string;
  accessToken: string;
}

export function appId(): string {
  const id = process.env.FB_APP_ID;
  if (!id) throw new Error("ยังไม่ได้ตั้งค่า FB_APP_ID");
  return id;
}

function appSecret(): string {
  const s = process.env.FB_APP_SECRET;
  if (!s) throw new Error("ยังไม่ได้ตั้งค่า FB_APP_SECRET");
  return s;
}

export function oauthIsConfigured(): boolean {
  return Boolean(process.env.FB_APP_ID && process.env.FB_APP_SECRET);
}

/** Meta matches this against its allow-list character for character. */
export function redirectUri(origin: string): string {
  return `${origin}/api/facebook/connect/callback`;
}

const STATE_TTL_MS = 10 * 60 * 1000;

function stateSecret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s) throw new Error("ADMIN_SESSION_SECRET is not set");
  return s;
}

/** Signed and short-lived, so a link someone else crafts cannot start a connection for us. */
export function makeState(): string {
  const expires = String(Date.now() + STATE_TTL_MS);
  const nonce = randomBytes(12).toString("hex");
  const mac = createHmac("sha256", stateSecret()).update(`${expires}.${nonce}`).digest("hex");
  return `${expires}.${nonce}.${mac}`;
}

export function stateIsValid(state: string | null): boolean {
  if (!state) return false;
  const [expires, nonce, mac] = state.split(".");
  if (!expires || !nonce || !mac) return false;
  const expected = createHmac("sha256", stateSecret()).update(`${expires}.${nonce}`).digest("hex");
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  return Number(expires) > Date.now();
}

/**
 * A Business-type app ignores `scope` and asks only for a name and photo; what it wants is a
 * login configuration made in the dashboard, which bundles the same permissions. With one
 * configured the dialog uses it; without, the plain scope list still serves a Consumer app.
 */
export function authorizeUrl(origin: string, state: string): string {
  const params = new URLSearchParams({
    client_id: appId(),
    redirect_uri: redirectUri(origin),
    state,
    response_type: "code",
  });
  const config = process.env.FB_LOGIN_CONFIG_ID;
  if (config) {
    params.set("config_id", config);
    params.set("override_default_response_type", "true");
  } else {
    params.set("scope", SCOPES.join(","));
  }
  return `${DIALOG}?${params}`;
}

async function graph<T>(path: string, params: Record<string, string>, token?: string): Promise<T> {
  const url = `${GRAPH}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cache: "no-store",
  });
  const body = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `${path} ${res.status}`);
  return body;
}

/**
 * The code is exchanged for a token that lasts about an hour, then for one that lasts about
 * two months. Both calls carry the app secret, so both happen on the server only.
 */
export async function tokenFromCode(code: string, origin: string): Promise<string> {
  const short = await graph<{ access_token: string }>("/oauth/access_token", {
    client_id: appId(),
    client_secret: appSecret(),
    redirect_uri: redirectUri(origin),
    code,
  });
  const long = await graph<{ access_token: string }>("/oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: appId(),
    client_secret: appSecret(),
    fb_exchange_token: short.access_token,
  });
  return long.access_token;
}

export async function grantedScopes(userToken: string): Promise<string[]> {
  const res = await graph<{ data: { permission: string; status: string }[] }>(
    "/me/permissions", {}, userToken,
  );
  return (res.data ?? []).filter((p) => p.status === "granted").map((p) => p.permission);
}

/** Each Page comes with its own token, already scoped to that Page. */
export async function listPages(userToken: string): Promise<FacebookPage[]> {
  const res = await graph<{ data: { id: string; name: string; access_token: string }[] }>(
    "/me/accounts", { fields: "id,name,access_token", limit: "100" }, userToken,
  );
  return (res.data ?? []).map((p) => ({ id: p.id, name: p.name, accessToken: p.access_token }));
}

/** Without this the Page never sends its messages to the webhook, whatever the token says. */
export async function subscribePage(page: FacebookPage): Promise<string[]> {
  const url = `${GRAPH}/${page.id}/subscribed_apps`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${page.accessToken}` },
    body: JSON.stringify({ subscribed_fields: SUBSCRIBED_FIELDS.join(",") }),
  });
  const body = (await res.json()) as { success?: boolean; error?: { message?: string } };
  if (!res.ok || body.error) throw new Error(body.error?.message ?? `subscribe ${res.status}`);
  return SUBSCRIBED_FIELDS;
}

export async function unsubscribePage(pageId: string, pageToken: string): Promise<void> {
  const res = await fetch(`${GRAPH}/${pageId}/subscribed_apps`, {
    method: "DELETE",
    headers: { authorization: `Bearer ${pageToken}` },
  });
  if (!res.ok) throw new Error(`unsubscribe ${res.status}: ${(await res.text()).slice(0, 120)}`);
}
