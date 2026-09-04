"use client";
import { useTransition } from "react";
import { refreshSubscription } from "./actions";

export function RefreshSubscriptionButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => start(() => { void refreshSubscription(); })}
      className="rounded-md border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
    >
      {pending ? "กำลังสมัคร…" : "สมัครรับเหตุการณ์ใหม่"}
    </button>
  );
}
