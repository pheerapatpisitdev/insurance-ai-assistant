"use client";
import { refreshSubscription } from "./actions";
import { ActionError, useAction } from "./useAction";

export function RefreshSubscriptionButton() {
  const { pending, error, run } = useAction();
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => refreshSubscription())}
        className="rounded-md border px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
      >
        {pending ? "กำลังสมัคร…" : "สมัครรับเหตุการณ์ใหม่"}
      </button>
      <ActionError error={error} />
    </>
  );
}
