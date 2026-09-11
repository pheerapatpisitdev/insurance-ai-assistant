"use client";
import { cancelPending, connectPage } from "./actions";
import { ActionError, useAction } from "./useAction";

export interface Choice { id: string; name: string }

export function PagePicker({ pages }: { pages: Choice[] }) {
  const { pending, error, run } = useAction();
  return (
    <div>
      <p className="mb-3 text-sm text-slate-700">คุณเป็นแอดมินหลายเพจ เลือกเพจที่จะให้บอทตอบ</p>
      <ul className="mb-3 divide-y rounded-md border">
        {pages.map((p) => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{p.name}</span>
              <span className="block text-xs text-slate-500">{p.id}</span>
            </span>
            <button
              type="button"
              disabled={pending}
              onClick={() => run(() => connectPage(p.id))}
              className="shrink-0 rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
            >
              เลือกเพจนี้
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => cancelPending())}
        className="text-sm text-slate-500 underline disabled:opacity-50"
      >
        ยกเลิก
      </button>
      <ActionError error={error} />
    </div>
  );
}
