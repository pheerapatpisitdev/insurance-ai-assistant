"use client";
import { useEffect, useRef, useState } from "react";

interface Source {
  title: string;
  page: number | null;
}
interface Turn {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
  /** where a priced answer is drawn as a card the customer can save */
  card?: string;
}

const EXAMPLES = [
  "ชาย 35 ปี ทุน 1 ล้าน ไลฟ์โพรเทค เบี้ยเท่าไหร่",
  "iShield รับอายุเท่าไหร่ ทุนขั้นต่ำเท่าไหร่",
  "ขั้นตอนการเคลมมีอะไรบ้าง",
];

export function ChatClient() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // the router's slots ride along so "แล้วผู้หญิงล่ะ" keeps the plan and sum assured
  const slots = useRef<unknown>(null);
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [turns, busy]);

  /**
   * A question handed over by another page (the legacy calculator's "ถาม AI" button) lands
   * in the box rather than in the conversation: the customer sees what is about to be asked
   * on their behalf, and sends it themselves.
   */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setDraft(q);
  }, []);

  async function send(text: string) {
    const question = text.trim();
    if (!question || busy) return;
    const next: Turn[] = [...turns, { role: "user", content: question }];
    setTurns(next);
    setDraft("");
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          messages: next.map((t) => ({ role: t.role, content: t.content })),
          slots: slots.current,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ตอบไม่ได้ในตอนนี้");
      slots.current = data.slots ?? null;
      setTurns([...next, { role: "assistant", content: data.reply, sources: data.sources, card: data.card }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "ตอบไม่ได้ในตอนนี้");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col">
      <div className="flex-1 space-y-4 overflow-y-auto rounded-lg border bg-white p-4">
        {turns.length === 0 && (
          <div className="space-y-3 text-sm text-slate-500">
            <p>ถามได้ทั้งเบี้ยประกัน เงื่อนไขของแบบประกัน และเรื่องทั่วไปจากเอกสารที่อัปโหลดไว้</p>
            <div className="flex flex-wrap gap-2">
              {EXAMPLES.map((e) => (
                <button
                  key={e}
                  onClick={() => send(e)}
                  className="rounded-full border px-3 py-1 text-left text-slate-600 hover:bg-slate-50"
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : "flex justify-start"}>
            <div
              className={
                t.role === "user"
                  ? "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-slate-900 px-4 py-2 text-sm text-white"
                  : "max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-slate-100 px-4 py-2 text-sm"
              }
            >
              {t.content}
              {t.card && (
                // the card is drawn per quote and already sized for a phone, so there is
                // nothing for the image optimiser to do but add a hop
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={t.card} alt="สรุปเบี้ยและผลประโยชน์" width={1000} height={1000}
                  className="mt-3 h-auto w-full max-w-[420px] rounded-xl border border-slate-300"
                />
              )}
              {t.sources && t.sources.length > 0 && (
                <div className="mt-2 border-t border-slate-300 pt-2 text-xs text-slate-500">
                  {t.sources.map((s, n) => (
                    <div key={n}>
                      [{n + 1}] {s.title}
                      {s.page ? ` หน้า ${s.page}` : ""}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {busy && <div className="text-sm text-slate-400">กำลังคิด…</div>}
        {error && <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <div ref={bottom} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="mt-3 flex gap-2"
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(draft);
            }
          }}
          rows={2}
          placeholder="พิมพ์คำถาม เช่น ชาย 40 ปี ทุน 5 แสน เบี้ยเท่าไหร่"
          className="flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
        <button
          type="submit"
          disabled={busy || !draft.trim()}
          className="self-end rounded-lg bg-slate-900 px-5 py-2 text-sm text-white disabled:opacity-40"
        >
          ส่ง
        </button>
      </form>
    </div>
  );
}
