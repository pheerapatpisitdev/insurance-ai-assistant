"use client";
import { useTransition } from "react";
import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className="rounded border px-2.5 py-1 text-xs hover:bg-[var(--bot-panel)]"
            onClick={() => start(() => signOut())}>
      ออกจากระบบ
    </button>
  );
}
