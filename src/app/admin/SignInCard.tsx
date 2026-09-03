"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";

export function SignInCard({ error, signedInAs }: { error?: string; signedInAs?: string }) {
  const [busy, setBusy] = useState(false);

  async function signIn() {
    setBusy(true);
    const supabase = supabaseBrowser();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  }

  async function signOut() {
    setBusy(true);
    await supabaseBrowser().auth.signOut();
    window.location.reload();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="rounded-lg border bg-white p-6 text-center">
        <h1 className="text-xl font-semibold">หลังบ้าน</h1>
        <p className="mt-1 text-sm text-slate-500">สำหรับผู้ดูแลระบบเท่านั้น</p>

        {signedInAs ? (
          <>
            <p className="mt-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              บัญชี {signedInAs} ไม่มีสิทธิ์เข้าหลังบ้าน
            </p>
            <button onClick={signOut} disabled={busy} className="mt-4 w-full rounded-md border px-4 py-2 text-sm">
              ออกจากระบบ
            </button>
          </>
        ) : (
          <button onClick={signIn} disabled={busy}
                  className="mt-6 w-full rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {busy ? "กำลังพาไปที่ Google…" : "เข้าสู่ระบบด้วย Google"}
          </button>
        )}

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        <Link href="/" className="mt-6 block text-sm text-slate-500 underline">กลับไปหน้าคำนวณเบี้ย</Link>
      </div>
    </main>
  );
}
