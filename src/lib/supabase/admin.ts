import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Server-only Supabase client. The back office authenticates with its own PIN, so Postgres
 * sees this privileged caller rather than a signed-in user. Never import this from a
 * component that runs in the browser.
 */
export function supabaseAdmin(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("ตั้งค่า SUPABASE_SERVICE_ROLE_KEY ใน .env.local ก่อน");
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function serviceKeyIsConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}
