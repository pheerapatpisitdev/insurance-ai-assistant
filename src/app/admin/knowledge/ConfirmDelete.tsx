"use client";
import { useState, useTransition } from "react";
import type { Result } from "./actions";

/**
 * A delete that asks first, on the page, in the place the tap landed.
 *
 * A note or a word was gone on one tap, for good — there is no bin — and on a phone the
 * delete sits a thumb's width from the switch beside it. So the first tap only turns the
 * button into "ลบถาวร?" with ยืนยัน and ยกเลิก; the second one deletes. Drawn in the row rather
 * than in window.confirm(), which answers "no" silently in the owner's browser and would
 * have left the button dead.
 *
 * The row leaves the list only when the server says it is gone (`onDone`). A refusal stays
 * here, in red, beside the thing that was not deleted.
 */
export function ConfirmDelete({ what, onConfirm, onDone, trigger, triggerClass }: {
  /** what is being deleted, for the screen reader and the question — "บันทึกนี้", "คำ ดีที่สุด" */
  what: string;
  onConfirm: () => Promise<Result>;
  onDone: () => void;
  trigger: React.ReactNode;
  triggerClass: string;
}) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (!asking) {
    return (
      <span className="flex items-center gap-1.5">
        {error && <span className="text-xs text-[var(--bot-red-ink)]">{error}</span>}
        <button type="button" aria-label={`ลบ${what}`} className={triggerClass} onClick={() => { setError(undefined); setAsking(true); }}>
          {trigger}
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5" role="group" aria-label={`ยืนยันการลบ${what}`}>
      <span className="whitespace-nowrap text-xs text-[var(--bot-red-ink)]">ลบถาวร?</span>
      <button
        type="button" disabled={pending}
        onClick={() => start(async () => {
          try {
            const res = await onConfirm();
            if (res.ok) { onDone(); return; }
            setError(res.error);
          } catch {
            setError("ลบไม่สำเร็จ — เน็ตหลุดหรือเซิร์ฟเวอร์ไม่ตอบ ลองใหม่อีกครั้ง");
          }
          setAsking(false);
        })}
        className="whitespace-nowrap rounded bg-[var(--bot-red-ink)] px-2 py-1 text-xs text-[var(--bot-surface)] disabled:opacity-50"
      >
        {pending ? "กำลังลบ…" : "ยืนยันลบ"}
      </button>
      <button
        type="button" disabled={pending} onClick={() => setAsking(false)}
        className="whitespace-nowrap px-1.5 py-1 text-xs text-[var(--bot-ink-mute)] hover:text-[var(--bot-ink-foot)]"
      >
        ยกเลิก
      </button>
    </span>
  );
}
