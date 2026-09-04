"use client";
import { useState, useTransition } from "react";
import { saveMessengerProfile } from "./actions";
import { MAX_GREETING_CHARS, MAX_ICE_BREAKERS, MAX_QUESTION_CHARS, type MessengerProfile } from "@/lib/facebook/profile";

export function ProfileForm({ initial }: { initial: MessengerProfile }) {
  const [greeting, setGreeting] = useState(initial.greeting);
  const [questions, setQuestions] = useState<string[]>(
    [...initial.questions, ...Array(MAX_ICE_BREAKERS)].slice(0, MAX_ICE_BREAKERS).map((q) => q ?? ""),
  );
  const [status, setStatus] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setStatus(null);
        start(async () => {
          try {
            await saveMessengerProfile({ greeting, questions });
            setStatus({ ok: true, text: "บันทึกแล้ว คนที่เปิดแชทใหม่จะเห็นทันที" });
          } catch (err) {
            setStatus({ ok: false, text: err instanceof Error ? err.message : "บันทึกไม่ได้" });
          }
        });
      }}
      className="space-y-3"
    >
      <label className="block text-sm">
        <span className="text-slate-500">ข้อความทักทาย</span>
        <textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          maxLength={MAX_GREETING_CHARS}
          rows={3}
          className="mt-1 w-full rounded-md border px-3 py-2"
        />
        <span className="text-xs text-slate-400">{greeting.length}/{MAX_GREETING_CHARS}</span>
      </label>
      <div className="space-y-2">
        <span className="text-sm text-slate-500">ปุ่มคำถาม (สูงสุด {MAX_ICE_BREAKERS} ปุ่ม เว้นว่างได้)</span>
        {questions.map((q, i) => (
          <input
            key={i}
            value={q}
            onChange={(e) => setQuestions(questions.map((x, j) => (j === i ? e.target.value : x)))}
            maxLength={MAX_QUESTION_CHARS}
            placeholder={`ปุ่มที่ ${i + 1}`}
            className="block w-full rounded-md border px-3 py-2 text-sm"
          />
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "กำลังบันทึก…" : "บันทึกไปที่เพจ"}
        </button>
        {status && (
          <span className={`text-sm ${status.ok ? "text-emerald-700" : "text-red-700"}`}>{status.text}</span>
        )}
      </div>
    </form>
  );
}
