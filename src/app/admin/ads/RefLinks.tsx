"use client";
import { useState } from "react";

/**
 * The links themselves, made for this page rather than described.
 *
 * "ใส่ ?ref=lifeprotect ต่อท้ายลิงก์ m.me ของคุณ" is a sentence somebody then has to turn into
 * an address, and the turning is where it goes wrong: the page's own name has to be found,
 * the numeric id works but looks wrong, and a typed ref that does not match what the bot reads
 * fails silently — the customer is simply asked which plan, as if nothing had been set.
 *
 * So the addresses are built here from the id the system is actually connected to, and the
 * refs are the words the bot actually recognises. Copying one cannot be got wrong.
 */

const LINKS = [
  { ref: "lifeprotect", label: "Life Protect (ประกันชีวิต)" },
  { ref: "ihealthy", label: "iHealthy Ultra (ประกันสุขภาพ)" },
] as const;

function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          setDone(false);
        }
      }}
      className="shrink-0 rounded border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
    >
      {done ? "คัดลอกแล้ว" : "คัดลอก"}
    </button>
  );
}

export function RefLinks({ pageId }: { pageId: string | null }) {
  if (!pageId) {
    return (
      <p className="text-sm text-slate-600">
        ยังไม่ได้เชื่อมเพจ — เชื่อมที่หน้า Messenger ก่อน แล้วลิงก์พร้อมใช้จะขึ้นตรงนี้
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {LINKS.map((l) => {
        const url = `https://m.me/${pageId}?ref=${l.ref}`;
        return (
          <div key={l.ref}>
            <div className="text-xs text-slate-500">{l.label}</div>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded bg-slate-100 px-2 py-1.5 text-xs text-slate-800">
                {url}
              </code>
              <Copy text={url} />
            </div>
          </div>
        );
      })}
      <p className="text-xs leading-relaxed text-slate-500">
        ลิงก์นี้ใช้เลขประจำเพจ ไม่ใช่ชื่อเพจ — เปิดได้เหมือนกันและไม่พังเวลาเปลี่ยนชื่อเพจ
      </p>
    </div>
  );
}
