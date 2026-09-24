import { serviceKeyIsConfigured, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * One anonymous row per plan built on /plan or /fhc, kept thirty days, read by /admin/crm.
 * No names ever reach it: the pages send figures only.
 */

const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

/** a plan is shown whether or not the log can be written */
export async function logRun(input: object, result: object): Promise<void> {
  if (!serviceKeyIsConfigured()) return;
  try {
    const db = supabaseAdmin();
    await db.from("ins_plan_runs").insert({ input, result });
    await db.from("ins_plan_runs").delete().lt("created_at", new Date(Date.now() - KEEP_MS).toISOString());
  } catch {
    // nothing to tell the customer
  }
}
