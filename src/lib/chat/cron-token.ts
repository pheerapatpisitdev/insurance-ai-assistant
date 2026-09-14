import { createHash, timingSafeEqual } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabase/admin";

/**
 * The shared word between the database's scheduler and the route it calls.
 *
 * It lives in one place — a table only the service key can read — so there is no third copy
 * in a deploy setting to rotate, to leak, or to forget. The scheduler reads it on its way out
 * and the route reads it on the way in.
 */
const NAME = "followups";

export async function cronCallerIsOurs(header: string | null): Promise<boolean> {
  const given = header?.replace(/^Bearer\s+/i, "") ?? "";
  if (!given) return false;
  const { data } = await supabaseAdmin()
    .from("ins_cron_secret").select("secret").eq("name", NAME).maybeSingle();
  const expected = (data as { secret?: string } | null)?.secret;
  if (!expected) return false;
  // compared through a digest so the lengths always match and the timing says nothing
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}
