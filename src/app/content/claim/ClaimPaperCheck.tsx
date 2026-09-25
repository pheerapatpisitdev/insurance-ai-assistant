"use client";
import { useEffect, useState } from "react";
import type { Box } from "@/lib/content/claim";
import type { ContentItem } from "@/lib/content/store";
import { AlertIcon, CheckIcon } from "../ui/icons";
import { burn } from "./redact";
import { RedactImage } from "./RedactImage";

/**
 * รีวิวเคลม's one check, in the editor (owner, 2026-09-25: one press to create, as for a plan).
 * The AI laid the stickers; the owner looks at the paper as it will be posted, drags more over
 * anything it missed, and ticks ตรวจแล้ว. Until then the piece cannot go to a Page.
 */
export function ClaimPaperCheck({ item, onChecked }: { item: ContentItem; onChecked: (item: ContentItem) => void }) {
  const [paper, setPaper] = useState<{ blob: Blob; src: string; width: number; height: number } | null>(null);
  const [failed, setFailed] = useState(false);
  const [boxes, setBoxes] = useState<Box[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const path = item.output.poster?.document?.path;

  useEffect(() => {
    let src = "";
    let gone = false;
    setPaper(null);
    setFailed(false);
    (async () => {
      const res = await fetch(`/api/content-claim/paper?id=${item.id}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const bitmap = await createImageBitmap(blob);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      if (gone) return;
      src = URL.createObjectURL(blob);
      setPaper({ blob, src, ...size });
    })().catch(() => { if (!gone) setFailed(true); });
    return () => {
      gone = true;
      if (src) URL.revokeObjectURL(src);
    };
  }, [item.id, path]);

  async function check() {
    if (!paper || saving) return;
    setSaving(true);
    setError(null);
    try {
      const form = new FormData();
      form.set("id", item.id);
      if (boxes.length) {
        form.set("paper", await burn(paper.blob, boxes), "paper.jpg");
        form.set("ratio", String(paper.width / paper.height));
      }
      const res = await fetch("/api/content-claim/paper", { method: "POST", body: form });
      const reply = await res.json() as { ok: true; item: ContentItem } | { ok: false; error: string };
      if (!reply.ok) { setError(reply.error); return; }
      setBoxes([]);
      onChecked(reply.item);
    } catch {
      setError("บันทึกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section aria-label="ตรวจรูปเอกสารเคลม" className="mt-4 space-y-2 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3">
      <p className="flex items-start gap-1.5 text-sm font-medium text-[var(--ct-warn-ink)]">
        <AlertIcon className="mt-0.5 size-4 shrink-0" />
        <span>ตรวจรูปเอกสารก่อนโพสต์ — AI แปะสติ๊กเกอร์ปิดชื่อและเลขให้แล้ว ดูว่าไม่เหลือชื่อ เลขบัตร เลขกรมธรรม์ หรือชื่อโรงพยาบาลที่ไม่อยากให้เห็น ถ้าเจอ กด “แปะสติ๊กเกอร์เพิ่ม” แล้วลากบนรูป</span>
      </p>
      {failed ? (
        <p role="alert" className="text-sm text-[var(--ct-alert)]">เปิดรูปเอกสารไม่ได้ ลองปิดแล้วเปิดชิ้นนี้ใหม่นะครับ</p>
      ) : !paper ? (
        <p className="text-sm text-[var(--ct-mute)]">กำลังโหลดรูปเอกสาร…</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button" aria-pressed={drawing} onClick={() => setDrawing((d) => !d)}
              className={`inline-flex min-h-11 items-center rounded-full border px-3.5 text-sm ${drawing
                ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
                : "border-[var(--ct-line)] bg-[var(--ct-panel)] hover:bg-[var(--ct-soft)]"}`}
            >
              {drawing ? "ลากบนรูปเพื่อแปะ · แตะเพื่อหยุด" : "แปะสติ๊กเกอร์เพิ่ม"}
            </button>
            {/* always there, so the paper does not jump when the first sticker lands */}
            <span className="text-sm text-[var(--ct-mute)]">{boxes.length ? `เพิ่มใหม่ ${boxes.length} จุด · แตะสติ๊กเกอร์ใหม่เพื่อเอาออก` : "สติ๊กเกอร์ที่ AI แปะไว้แล้วเอาออกไม่ได้"}</span>
          </div>
          <div className="mx-auto max-w-md">
            <RedactImage src={paper.src} width={paper.width} height={paper.height} boxes={boxes} onChange={setBoxes} drawing={drawing} alt="รูปเอกสารเคลมที่จะขึ้นโปสเตอร์" />
          </div>
          <button
            type="button" onClick={check} disabled={saving}
            className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--ct-solid)] px-4 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50"
          >
            <CheckIcon className="size-4" />
            {saving ? "กำลังบันทึก…" : boxes.length ? `แปะ ${boxes.length} จุดแล้วกดตรวจแล้ว` : "ตรวจแล้ว ไม่เห็นชื่อหรือเลขใดๆ"}
          </button>
          {error && <p role="alert" className="text-sm text-[var(--ct-alert)]">{error}</p>}
        </>
      )}
    </section>
  );
}
