import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

/**
 * Server client bound to the caller's session cookies. Everything the back office reads or
 * writes goes through this, so Postgres row level security is the single source of truth —
 * there is no service-role key in this app.
 */
export async function supabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try {
            for (const { name, value, options } of list) store.set(name, value, options);
          } catch {
            // called from a Server Component: the middleware refreshes the session instead
          }
        },
      },
    },
  );
}

export interface AdminSession {
  email: string;
  userId: string;
}

/** The signed-in user, but only when their email is listed in ins.admins. */
export async function requireAdmin(): Promise<AdminSession | null> {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data, error } = await supabase.schema("ins").from("admins").select("email").limit(1);
  if (error || !data || data.length === 0) return null;
  return { email: user.email, userId: user.id };
}
