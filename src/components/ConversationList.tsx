"use client";
import { useState } from "react";
import type { Conversation } from "@/lib/chat/history";

const CHANNEL_LABEL: Record<string, string> = { line: "LINE", facebook: "Messenger" };

/** The stored turns of one conversation, opened one at a time. */
export function ConversationList({ items, showChannel = false }: { items: Conversation[]; showChannel?: boolean }) {
  const [open, setOpen] = useState<number | null>(null);
  if (!items.length) {
    return (
      <p className="rounded-md border border-dashed px-3 py-6 text-center text-sm text-slate-500">
        ยังไม่มีบทสนทนา บทสนทนาจะหายไปเองหลัง 24 ชั่วโมง
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {items.map((c, i) => (
        <li key={i} className="rounded-md border">
          <button
            type="button"
            onClick={() => setOpen(open === i ? null : i)}
            className="flex w-full flex-wrap items-baseline gap-x-3 gap-y-1 p-3 text-left text-sm hover:bg-slate-50"
          >
            {showChannel && <span className="font-medium">{CHANNEL_LABEL[c.channel] ?? c.channel}</span>}
            <span className={showChannel ? "text-slate-600" : "font-medium"}>{c.turns.length} ข้อความ</span>
            {c.intent && <span className="text-xs text-slate-500">ล่าสุด: {c.intent}</span>}
            <span className="ml-auto text-xs text-slate-500">
              {new Date(c.updatedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </button>
          {open === i && (
            <div className="space-y-2 border-t p-3">
              {c.turns.map((t, n) => (
                <div key={n} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      t.role === "user"
                        ? "max-w-[85%] whitespace-pre-wrap rounded-lg bg-slate-900 px-3 py-2 text-sm text-white"
                        : "max-w-[85%] whitespace-pre-wrap rounded-lg bg-slate-100 px-3 py-2 text-sm"
                    }
                  >
                    {t.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
