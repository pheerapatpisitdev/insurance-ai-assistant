"use client";
import { useState, useTransition } from "react";
import { addNote, deleteNote, setNoteEnabled, type Note } from "./actions";

/**
 * What the assistant knows on top of the plan rules, and the box to add to it.
 *
 * It opens on the list rather than folded away: this is the whole of its own page now, and a
 * page whose only content is hidden behind a summary is a page that looks empty.
 *
 * What survives from when it sat in public: every note shows when it arrived and has a delete
 * beside it. A note nobody can see is a note nobody can take back — and these are read by the
 * bot answering advertisements, which makes that worth keeping even behind a PIN.
 */
export function Notes({ initial }: { initial: Note[] }) {
  const [notes, setNotes] = useState(initial);
  const [open, setOpen] = useState(true);
  const [q, setQ] = useState("");
  const [a, setA] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const refresh = (next: Note[]) => setNotes(next);

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await addNote(q, a);
      if (!res.ok) { setError(res.error); return; }
      setQ(""); setA("");
      const { listNotes } = await import("./actions");
      refresh(await listNotes());
    });
  }

  const when = (iso: string) => {
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
    if (mins < 60) return `${Math.max(mins, 0)} นาทีที่แล้ว`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} ชม.ที่แล้ว`;
    return `${Math.round(hours / 24)} วันที่แล้ว`;
  };

  return (
    <section className="mt-8 rounded-xl border border-[var(--hm-line)] bg-[var(--hm-panel)]">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-[var(--hm-ink)]">
          สอนอะไรเพิ่มให้ผู้ช่วย
          <span className="ml-2 font-normal text-[var(--hm-mute)]">{notes.length} บันทึก</span>
        </span>
        <span className="text-[var(--hm-mute)]">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-[var(--hm-hair)] px-4 py-4">
          <p className="mb-3 text-xs leading-relaxed text-[var(--hm-mute)]">
            ใช้เก็บสิ่งที่ไม่มีในกฎของบริษัท เช่น วิธีตอบลูกค้าที่บอกว่าแพงไป หรือจุดที่แบบของเราต่างจากคู่แข่ง
            ผู้ช่วยจะบอกทุกครั้งว่าคำตอบนี้มาจากบันทึกที่ผู้ใช้เพิ่ม ไม่ใช่เอกสารบริษัท
          </p>

          <div className="space-y-2">
            <input
              value={q} onChange={(e) => setQ(e.target.value)} maxLength={200}
              placeholder="เมื่อลูกค้าถามว่า… เช่น ทำไมแพงกว่าเจ้าอื่น"
              className="w-full rounded-lg border border-[var(--hm-line)] px-3 py-2 text-sm outline-none focus:border-[var(--hm-accent)]"
            />
            <textarea
              value={a} onChange={(e) => setA(e.target.value)} maxLength={2000} rows={3}
              placeholder="ให้ตอบว่า…"
              className="w-full rounded-lg border border-[var(--hm-line)] px-3 py-2 text-sm outline-none focus:border-[var(--hm-accent)]"
            />
            {error && <p className="text-xs text-[var(--hm-alert)]">{error}</p>}
            <button
              type="button" onClick={submit} disabled={pending || !q.trim() || !a.trim()}
              className="rounded-lg bg-[var(--hm-solid)] px-4 py-2 text-sm text-[var(--hm-solid-ink)] disabled:opacity-40"
            >
              {pending ? "กำลังบันทึก…" : "เพิ่มความรู้"}
            </button>
          </div>

          {notes.length > 0 && (
            <ul className="mt-5 divide-y divide-[var(--hm-hair)] border-t border-[var(--hm-hair)]">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-3">
                  <div className={`min-w-0 flex-1 ${n.enabled ? "" : "opacity-45"}`}>
                    <p className="text-sm font-medium text-[var(--hm-ink)]">{n.question}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-[var(--hm-mute)]">{n.answer}</p>
                    <p className="mt-1 text-[0.65rem] text-[var(--hm-mute)]">
                      เพิ่มเมื่อ {when(n.updatedAt)}{n.enabled ? "" : " · ปิดใช้งานอยู่"}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button" disabled={pending}
                      onClick={() => start(async () => {
                        await setNoteEnabled(n.id, !n.enabled);
                        setNotes((list) => list.map((x) => (x.id === n.id ? { ...x, enabled: !x.enabled } : x)));
                      })}
                      className="rounded border border-[var(--hm-line)] px-2 py-1 text-xs text-[var(--hm-mute)] hover:bg-[var(--hm-ground)]"
                    >
                      {n.enabled ? "ปิด" : "เปิด"}
                    </button>
                    <button
                      type="button" disabled={pending}
                      onClick={() => start(async () => {
                        await deleteNote(n.id);
                        setNotes((list) => list.filter((x) => x.id !== n.id));
                      })}
                      className="rounded border border-[var(--hm-alert-line)] px-2 py-1 text-xs text-[var(--hm-alert)] hover:bg-[var(--hm-alert-bg)]"
                    >
                      ลบ
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
