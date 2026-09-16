import { createHash, randomBytes } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * Who is calling the public API, and whether they may.
 *
 * The key is never stored, only its hash: a table of working keys is a table worth stealing,
 * and this one is not. What is stored beside the hash is the first few characters, which is
 * enough to tell one row from another in a list and never enough to make a request.
 *
 * The quota is counted in the database rather than here, in one statement, because checking
 * and then incrementing from two places lets two requests read the same count and both pass.
 */

const PREFIX = "sk_ins_";
/** shown in the admin list; long enough to recognise, short enough to be useless */
const SHOWN = PREFIX.length + 6;

export const hashKey = (key: string) => createHash("sha256").update(key.trim()).digest("hex");

/** A new key, in the only moment it exists in readable form. */
export function mintKey(): { key: string; hash: string; prefix: string } {
  const key = PREFIX + randomBytes(24).toString("base64url");
  return { key, hash: hashKey(key), prefix: key.slice(0, SHOWN) };
}

export type Refusal = "missing" | "unknown_key" | "disabled" | "quota_exhausted";

export interface Caller {
  name: string;
  /** calls left this month, or null where the key has no monthly limit */
  remaining: number | null;
}

/** The key a request carries, from the header every HTTP client already knows how to send. */
export function keyIn(request: Request): string | undefined {
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.match(/^Bearer\s+(.+)$/i)?.[1];
  return (bearer ?? request.headers.get("x-api-key") ?? "").trim() || undefined;
}

/**
 * Whether this request may proceed, and on whose behalf.
 *
 * A failure says which failure it was, because the caller has to be told something different
 * in each case: a key that was never issued is a mistake in their configuration, and a key
 * that has run out of its month is a decision somebody here made.
 */
export async function authorise(request: Request): Promise<{ caller: Caller } | { refused: Refusal }> {
  const key = keyIn(request);
  if (!key) return { refused: "missing" };

  /**
   * The key is looked up by its hash and never compared here.
   *
   * Which also answers the timing question without a constant-time comparison: what the
   * database matches is a SHA-256, so a caller learns nothing about a real key by measuring
   * how long a wrong one takes — the hash of a near-miss is not a near-miss.
   */
  const { data, error } = await supabaseAdmin().rpc("ins_api_client_use", { p_hash: hashKey(key) });
  if (error) throw new Error(error.message);

  const row = (Array.isArray(data) ? data[0] : data) as
    { ok: boolean; reason: Refusal | null; client_name: string | null; remaining: number | null } | undefined;
  if (!row?.ok) return { refused: row?.reason ?? "unknown_key" };

  return { caller: { name: row.client_name ?? "—", remaining: row.remaining } };
}
