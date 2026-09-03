"use client";
import { createBrowserClient } from "@supabase/ssr";

/** Browser client. Only ever holds the publishable key; row level security does the rest. */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
