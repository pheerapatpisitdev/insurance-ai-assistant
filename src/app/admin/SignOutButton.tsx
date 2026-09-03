"use client";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SignOutButton() {
  return (
    <button
      type="button"
      className="rounded border px-2.5 py-1 text-xs hover:bg-slate-100"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        window.location.href = "/admin";
      }}
    >
      ออกจากระบบ
    </button>
  );
}
