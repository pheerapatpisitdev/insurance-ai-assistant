"use client";
import { useState, useTransition } from "react";
import type { ContentWord, WordKind } from "@/lib/content/check";
import { addContentWord, listContentWords, removeContentWord } from "./actions";

/**
 * The words /content warns about, and the box to add to them.
 *
 * Written in the same shape as the notes above it on purpose: one list, one box, a delete on
 * every line. A word here only ever produces a warning beside a generated post — it never
 * changes the post — so a wrong entry costs a false alarm and one click to take back.
 */
export function Words({ initial }: { initial: ContentWord[] }) {
  const [words, setWords] = useState(initial);
  const [word, setWord] = useState("");
  const [kind, setKind] = useState<WordKind>("banned");
  const [fix, setFix] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  function submit() {
    setError(undefined);
    start(async () => {
      const res = await addContentWord(word, kind, fix);
      if (!res.ok) { setError(res.error); return; }
      setWord(""); setFix("");
      setWords(await listContentWords());
    });
  }

  const input = "rounded-lg border border-[var(--bot-line-strong)] bg-[var(--bot-surface)] px-3 py-2 text-sm outline-none focus:border-[var(--bot-navy)]";

  return (
    <section className="mt-8 rounded-xl border border-[var(--bot-line)] bg-[var(--bot-surface)] px-4 py-4">
      <h2 className="text-sm font-medium text-[var(--bot-ink)]">
        คำที่ต้องเตือนในหน้าสร้างคอนเทนต์
        <span className="ml-2 font-normal text-[var(--bot-ink-mute)]">{words.length} คำ</span>
      </h2>
      <p className="mt-1 mb-3 text-xs leading-relaxed text-[var(--bot-ink-mute)]">
        ถ้าโพสต์ที่ AI เขียนมีคำเหล่านี้ หน้า /content จะขึ้นแถบเตือนให้ตรวจก่อนโพสต์ ระบบไม่แก้ให้เอง
        คำโฆษณาต้องห้ามที่มีคำว่า “ไม่” นำหน้า (เช่น “ไม่การันตี”) จะไม่ถูกเตือน
      </p>

      <div className="flex flex-wrap gap-2">
        <select value={kind} onChange={(e) => setKind(e.target.value as WordKind)} className={input} aria-label="ชนิดของคำ">
          <option value="banned">คำโฆษณาต้องห้าม</option>
          <option value="misspelling">คำที่มักสะกดผิด</option>
        </select>
        <input value={word} onChange={(e) => setWord(e.target.value)} maxLength={60} placeholder={kind === "banned" ? "เช่น ดีที่สุด" : "คำที่สะกดผิด เช่น คุ้มคลอง"} className={`${input} min-w-0 flex-1`} />
        {kind === "misspelling" && (
          <input value={fix} onChange={(e) => setFix(e.target.value)} maxLength={60} placeholder="คำที่ถูก เช่น คุ้มครอง" className={`${input} min-w-0 flex-1`} />
        )}
        <button
          type="button" onClick={submit} disabled={pending || !word.trim()}
          className="rounded-lg bg-[var(--bot-navy)] px-4 py-2 text-sm text-[var(--bot-surface)] disabled:opacity-40"
        >
          {pending ? "กำลังบันทึก…" : "เพิ่มคำ"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-[var(--bot-red-ink)]">{error}</p>}

      {words.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {words.map((w) => (
            <li key={w.word} className="flex items-center gap-1.5 rounded-full border border-[var(--bot-line)] py-1 pl-3 pr-1 text-sm">
              <span>{w.kind === "misspelling" ? `${w.word} → ${w.fix}` : w.word}</span>
              <button
                type="button" disabled={pending} aria-label={`ลบคำ ${w.word}`}
                onClick={() => start(async () => {
                  await removeContentWord(w.word);
                  setWords((list) => list.filter((x) => x.word !== w.word));
                })}
                className="rounded-full px-2 text-[var(--bot-ink-mute)] hover:bg-[var(--bot-red-soft)] hover:text-[var(--bot-red-ink)]"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
