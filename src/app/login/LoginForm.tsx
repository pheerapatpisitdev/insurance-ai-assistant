"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { signIn } from "./actions";

export function LoginForm({ configured }: { configured: boolean }) {
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center p-6">
      <div className="rounded-lg border bg-white p-6">
        <h1 className="text-center text-xl font-semibold">หลังบ้าน</h1>
        <p className="mt-1 text-center text-sm text-[var(--bot-ink-mute)]">กรอกรหัส 6 หลัก</p>

        {configured ? (
          <form
            className="mt-6"
            action={(fd) => start(async () => {
              const res = await signIn(fd);
              if (res?.error) setError(res.error);
            })}
          >
            <input
              name="pin" inputMode="numeric" autoComplete="one-time-code" maxLength={6} autoFocus
              pattern="\d{6}" placeholder="••••••"
              className="w-full rounded-md border px-4 py-3 text-center text-2xl tracking-[0.5em] tabular-nums"
              onChange={() => setError(undefined)}
            />
            <button disabled={pending}
                    className="mt-4 w-full rounded-md bg-[var(--bot-navy)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50">
              {pending ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
            </button>
          </form>
        ) : (
          <p className="mt-4 rounded-md border border-[var(--bot-sand-line)] bg-[var(--bot-sand-soft)] px-3 py-2 text-sm text-[var(--bot-sand-ink)]">
            ยังไม่ได้ตั้งรหัส กรุณาใส่ ADMIN_PIN และ ADMIN_SESSION_SECRET ในไฟล์ .env.local
          </p>
        )}

        {error && <p className="mt-3 text-center text-sm text-[var(--bot-red-ink)]">{error}</p>}
        <Link href="/" className="mt-6 block text-center text-sm text-[var(--bot-ink-mute)] underline">กลับไปหน้าแรก</Link>
      </div>
    </main>
  );
}
