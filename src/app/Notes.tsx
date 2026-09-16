"use client";
import { useState, useTransition } from "react";
import { addNote, deleteNote, setNoteEnabled, type Note } from "./actions";

/**
 * What the assistant knows on top of the plan rules, and the box anyone may add to.
 *
 * Open to every visitor by the owner's decision. The two things that make that survivable
 * are here rather than a lock: every note shows when it arrived, and every note has a delete
 * beside it. A note nobody can see is a note nobody can take back.
 *
 * Folded away by default. Most people who open this page came to ask something, and a form
 * for editing the assistant's memory is not what they are looking at.
 */
export function Notes({ initial }: { initial: Note[] }) {
  const [notes, setNotes] = useState(initial);
  const [open, setOpen] = useState(false);
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
    <section className="mt-8 rounded-xl border border-slate-200 bg-white">
      <button
        type="button" onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="text-sm font-medium text-slate-800">
          สอนอะไรเพิ่มให้ผู้ช่วย
          <span className="ml-2 font-normal text-slate-400">{notes.length} บันทึก</span>
        </span>
        <span className="text-slate-400">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-slate-100 px-4 py-4">
          <p className="mb-3 text-xs leading-relaxed text-slate-500">
            ใช้เก็บสิ่งที่ไม่มีในกฎของบริษัท เช่น วิธีตอบลูกค้าที่บอกว่าแพงไป หรือจุดที่แบบของเราต่างจากคู่แข่ง
            ผู้ช่วยจะบอกทุกครั้งว่าคำตอบนี้มาจากบันทึกที่ผู้ใช้เพิ่ม ไม่ใช่เอกสารบริษัท
          </p>

          <div className="space-y-2">
            <input
              value={q} onChange={(e) => setQ(e.target.value)} maxLength={200}
              placeholder="เมื่อลูกค้าถามว่า… เช่น ทำไมแพงกว่าเจ้าอื่น"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            <textarea
              value={a} onChange={(e) => setA(e.target.value)} maxLength={2000} rows={3}
              placeholder="ให้ตอบว่า…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="button" onClick={submit} disabled={pending || !q.trim() || !a.trim()}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
            >
              {pending ? "กำลังบันทึก…" : "เพิ่มความรู้"}
            </button>
          </div>

          {notes.length > 0 && (
            <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100">
              {notes.map((n) => (
                <li key={n.id} className="flex items-start gap-3 py-3">
                  <div className={`min-w-0 flex-1 ${n.enabled ? "" : "opacity-45"}`}>
                    <p className="text-sm font-medium text-slate-800">{n.question}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-600">{n.answer}</p>
                    <p className="mt-1 text-[0.65rem] text-slate-400">
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
                      className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {n.enabled ? "ปิด" : "เปิด"}
                    </button>
                    <button
                      type="button" disabled={pending}
                      onClick={() => start(async () => {
                        await deleteNote(n.id);
                        setNotes((list) => list.filter((x) => x.id !== n.id));
                      })}
                      className="rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
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
