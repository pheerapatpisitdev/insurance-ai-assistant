"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { askCopilot } from "./actions";
import type { ChatMessage } from "@/lib/ai/types";
import type { AnySlots } from "@/lib/assistant/slots";

/**
 * The home page: a box to ask this system what it knows.
 *
 * The suggestions are not decoration. An empty box with a cursor in it is a question about
 * what the thing can do, and these four answer it by being the four kinds of question it can
 * actually take — a rule, a pairing, a limit, and the sales knowledge the agent typed in.
 */
const SUGGESTIONS = [
  "DCI ซื้อได้ถึงอายุเท่าไหร่",
  "HIC ซื้อคู่กับ MEB ได้ไหม",
  "Life Protect ทุนขั้นต่ำเท่าไหร่",
  "iHealthy มีระยะเวลารอคอยกี่วัน",
  "Life Protect ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่",
];

/**
 * The two pieces of markdown a model reaches for, drawn rather than printed.
 *
 * Not a markdown library: the answers here are short Thai paragraphs with the occasional
 * bolded rule and the occasional link back to the calculator, and a parser for the whole
 * language would be a dependency earning its keep on two characters. Anything else the model
 * writes is left exactly as it typed it.
 */
const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

function Rich({ text }: { text: string }) {
  return (
    <p className="whitespace-pre-wrap">
      {text.split(INLINE).map((part, i) => {
        const bold = part.match(/^\*\*([^*]+)\*\*$/);
        if (bold) return <strong key={i}>{bold[1]}</strong>;
        const link = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
        if (link) {
          return link[2].startsWith("/")
            ? <Link key={i} href={link[2]} className="underline underline-offset-2">{link[1]}</Link>
            : <span key={i}>{link[1]}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </p>
  );
}

interface Turn {
  role: "user" | "assistant";
  text: string;
  /** shown under an answer so the reader knows which model wrote it */
  model?: string;
  /** the figure came from the engine, which is worth saying out loud */
  priced?: boolean;
}

export function Chat() {
  const [turns, setTurns] = useState<Turn[]>([]);
  /**
   * What the pricing brain knows about the person being quoted, held here between questions.
   *
   * It lives in the page rather than a table because a quotation is one sitting: "ชาย 35",
   * then "ทุน 1 ล้าน", then "แล้วจ่าย 10 ปีล่ะ" is three messages about one person, and none
   * of them is worth keeping once the tab is closed.
   */
  const [slots, setSlots] = useState<AnySlots | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (turns.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turns]);

  async function ask(question: string) {
    const asked = question.trim();
    if (!asked || busy) return;
    setDraft("");
    setBusy(true);
    // the model sees the conversation as it was before this question, which is what the
    // action expects; the screen gets the question straight away so nothing looks dropped
    const history: ChatMessage[] = turns.map((t) => ({ role: t.role, content: t.text }));
    setTurns((t) => [...t, { role: "user", text: asked }]);
    try {
      const reply = await askCopilot(asked, history, slots);
      if (reply.slots !== undefined) setSlots(reply.slots);
      setTurns((t) => [...t, { role: "assistant", text: reply.text, model: reply.model, priced: reply.priced }]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", text: "ขออภัยครับ ระบบขัดข้อง ลองใหม่อีกครั้งนะครับ" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col px-4 py-6 sm:py-10">
      <header className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">ถามเรื่องแบบประกัน</h1>
        <p className="mt-1 text-sm text-slate-500">
          ถามเงื่อนไขก็ได้ ขอเบี้ยก็ได้ — เบี้ยคิดจากตารางจริง ตัวเดียวกับที่บอทและหน้าขายใช้ ·{" "}
          <Link href="/other-plans" className="underline underline-offset-2">แบบประกันอื่นๆ</Link>
        </p>
      </header>

      <div className="flex-1 space-y-4">
        {turns.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 text-sm text-slate-600">ลองถามแบบนี้ดูครับ</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s} type="button" onClick={() => ask(s)}
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:border-slate-400 hover:bg-slate-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : ""}>
            <div
              className={
                t.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2.5 text-sm text-white"
                  : "max-w-[92%] rounded-2xl rounded-bl-sm border border-slate-200 bg-white px-4 py-3 text-sm leading-relaxed text-slate-800"
              }
            >
              {t.role === "assistant" ? <Rich text={t.text} /> : <p className="whitespace-pre-wrap">{t.text}</p>}
              {t.role === "assistant" && t.model && t.model !== "—" && (
                <p className={`mt-2 text-[0.65rem] ${t.priced ? "text-emerald-700" : "text-slate-400"}`}>
                  {t.priced ? `✓ คิดจากตารางเบี้ยจริง · ${t.model}` : `ตอบโดย ${t.model}`}
                </p>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <p className="text-sm text-slate-400" aria-live="polite">กำลังค้นในระบบ…</p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(draft); }}
        className="sticky bottom-0 mt-6 flex gap-2 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pb-4 pt-3"
      >
        <input
          value={draft} onChange={(e) => setDraft(e.target.value)}
          disabled={busy} maxLength={500} autoComplete="off"
          placeholder="พิมพ์คำถามเรื่องแบบประกัน…"
          aria-label="คำถามของคุณ"
          className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
        />
        <button
          type="submit" disabled={busy || !draft.trim()}
          className="rounded-xl bg-slate-900 px-5 py-3 text-sm font-medium text-white disabled:opacity-40"
        >
          ถาม
        </button>
      </form>

      <p className="pb-2 text-center text-xs text-slate-400">
        เบี้ยเป็นตัวเลขประมาณการจากตารางของบริษัท ไม่ใช่ใบเสนอราคา ·{" "}
        <Link href="/privacy" className="underline">ความเป็นส่วนตัว</Link>
      </p>
    </main>
  );
}
