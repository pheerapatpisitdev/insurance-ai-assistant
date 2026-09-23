"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { askCopilot } from "./actions";
import type { ChatMessage } from "@/lib/ai/types";
import type { AnySlots } from "@/lib/assistant/slots";
import type { GuideGroup, GuideItem } from "@/lib/copilot/guide";

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
  /** the quotation as the engine drew it — the same picture the bot sends a customer */
  cards?: string[];
  /** what to offer next, as buttons, when the answer leads somewhere in particular */
  guide?: GuideItem[];
}

/**
 * A row of questions to press.
 *
 * The same shape wherever it appears — under the heading before anything has been asked, and
 * under the last answer afterwards — so that pressing a button always means the same thing.
 */
function Chips(
  { items, onPick, disabled }: { items: GuideItem[]; onPick: (ask: string) => void; disabled?: boolean },
) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((g) => (
        <button
          key={g.ask} type="button" disabled={disabled} onClick={() => onPick(g.ask)}
          title={g.ask}
          className="rounded-full border border-[var(--hm-line)] bg-[var(--hm-panel)] px-3 py-1.5 text-sm text-[var(--hm-ink)] hover:border-[var(--hm-line-strong)] hover:bg-[var(--hm-ground)] disabled:opacity-40"
        >
          {g.label}
        </button>
      ))}
    </div>
  );
}

export function Chat({ guide }: { guide: GuideGroup[] }) {
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
  /** whether the guide's other groups are open; closed until asked for */
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  /**
   * Start again, and mean it.
   *
   * The visible half is the conversation; the half that has to go with it is `slots` — what
   * the pricing brain worked out about whoever was being quoted. Clearing the bubbles and
   * leaving that behind is the worse bug of the two: the screen looks new, and the next
   * question is answered about the last customer's age and sum without saying so.
   *
   * An agent showing this to one person after another is the reason it exists.
   */
  function startOver() {
    setTurns([]);
    setSlots(null);
    setDraft("");
    setMore(false);
  }

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
      setTurns((t) => [...t, {
        role: "assistant", text: reply.text, model: reply.model,
        priced: reply.priced, cards: reply.cards, guide: reply.guide,
      }]);
    } catch {
      setTurns((t) => [...t, { role: "assistant", text: "ขออภัยครับ ระบบขัดข้อง ลองใหม่อีกครั้งนะครับ" }]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
      <header className="flex shrink-0 items-start justify-between gap-3 pt-1">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/mark.png" alt="" width={32} height={40}
            className="mt-0.5 h-10 w-auto shrink-0"
          />
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            ถามอะไรก็ได้ที่อยากถาม เกี่ยวกับผลิตภัณฑ์ภายใต้บริษัท{" "}
            {/* the company name kept on one line: Thai wraps anywhere, and it split as กรุงไทยแอก / ซ่า */}
            <span className="whitespace-nowrap">กรุงไทยแอกซ่า ประกันชีวิต</span>
          </h1>
          <p className="mt-1 text-sm text-[var(--hm-mute)]">
            ถามเงื่อนไขก็ได้ ขอเบี้ยก็ได้ — เบี้ยคิดจากตารางจริง ตัวเดียวกับที่บอทและหน้าขายใช้ ·{" "}
            <Link href="/other-plans" className="underline underline-offset-2">แบบประกันอื่นๆ</Link>
          </p>
        </div>
        </div>
        {/* only once there is something to clear: a button that undoes nothing is a button
            somebody has to think about every time they look at the page */}
        {turns.length > 0 && (
          <button
            type="button" onClick={startOver} disabled={busy}
            className="shrink-0 rounded-full border border-[var(--hm-line)] px-3 py-1.5 text-xs text-[var(--hm-mute)] hover:bg-[var(--hm-panel)] disabled:opacity-40"
          >
            เริ่มใหม่
          </button>
        )}
      </header>

      {/**
        * The chat box.
        *
        * One frame holding the conversation and the thing you type into, instead of a page
        * that scrolls with the field stuck to the bottom of the window by a gradient. On a
        * desktop screen that layout left half the page empty between the opening card and a
        * stranded input, which reads as a page that has not finished loading.
        *
        * The interior keeps the ground colour rather than the panel: every answer is a panel
        * bubble, and a panel inside a panel is a bubble with no edge.
        */}
      <section
        className={`flex flex-col overflow-hidden rounded-2xl border border-[var(--hm-hair)] bg-[var(--hm-ground)] shadow-[0_1px_2px_rgba(54,33,31,0.05),0_18px_36px_-20px_rgba(54,33,31,0.35)] ${
          /**
           * Empty, the box is only as tall as what is in it, sitting in the middle of the
           * screen. Stretching it to the full height before anyone has said anything is what
           * put a field to type in at the bottom of an empty page — the thing the owner was
           * looking at when they asked for a chat box. It takes the height when there is a
           * conversation to hold, which is when height is worth having.
           */
          turns.length === 0 ? "my-auto max-h-full" : "min-h-0 flex-1"
        }`}
      >
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-3 sm:p-4">
        {turns.length === 0 && (
          /**
           * The open groups only, and the rest behind a press.
           *
           * All three at once came to eleven buttons, which on a phone pushed the box you type
           * in off the bottom of the screen — a guide that hides the thing it is guiding you
           * to. The prices stay open because that is what people come to ask.
           */
          /* No card around it any more: the box is the container now, and a bordered panel
             inside a bordered panel is a frame drawn twice. */
          <div className="my-auto space-y-4 px-1 py-2">
            <p className="text-sm text-[var(--hm-mute)]">ไม่รู้จะเริ่มตรงไหน กดเลือกได้เลยครับ</p>
            {guide.filter((group) => group.open || more).map((group) => (
              <div key={group.title}>
                <p className="mb-2 text-xs font-medium text-[var(--hm-mute)]">{group.title}</p>
                <Chips items={group.items} onPick={ask} disabled={busy} />
              </div>
            ))}
            {!more && guide.some((group) => !group.open) && (
              <button
                type="button" onClick={() => setMore(true)}
                className="text-sm text-[var(--hm-accent)] underline underline-offset-2"
              >
                ดูแบบประกันอื่นและคำถามเพิ่มเติม
              </button>
            )}
          </div>
        )}

        {turns.map((t, i) => (
          <div key={i} className={t.role === "user" ? "flex justify-end" : "flex items-start gap-2.5"}>
            {/* The mark beside what the assistant says, and nothing beside what the reader
                says — an avatar on both sides is two faces in a conversation with one.
                Decorative, so it carries no alt text for a screen reader to read out on
                every single turn. */}
            {t.role === "assistant" && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/mark.png" alt="" width={22} height={28}
                className="mt-1 h-7 w-auto shrink-0"
              />
            )}
            <div
              className={
                t.role === "user"
                  ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--hm-solid)] px-4 py-2.5 text-sm text-[var(--hm-solid-ink)]"
                  : "min-w-0 max-w-[92%] rounded-2xl rounded-bl-sm border border-[var(--hm-line)] bg-[var(--hm-panel)] px-4 py-3 text-sm leading-relaxed text-[var(--hm-ink)]"
              }
            >
              {t.role === "assistant" ? <Rich text={t.text} /> : <p className="whitespace-pre-wrap">{t.text}</p>}
              {/* the picture the engine drew, which is the thing an agent forwards to a
                  customer — drawn server-side from the same figures the words above carry */}
              {t.cards?.map((card) => (
                <a key={card} href={card} target="_blank" rel="noreferrer" className="mt-3 block">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card} alt="การ์ดสรุปเบี้ยประกัน" loading="lazy"
                    className="w-full rounded-lg border border-[var(--hm-line)]"
                  />
                  <span className="mt-1 block text-[0.65rem] text-[var(--hm-mute)]">แตะเพื่อเปิดรูปเต็ม แล้วบันทึกไปส่งลูกค้าได้</span>
                </a>
              ))}
              {/* offered under the last answer only: older rows are history, and a page of
                  live buttons down its whole length is a page nobody can read */}
              {t.role === "assistant" && t.guide?.length && i === turns.length - 1 && (
                <div className="mt-3 border-t border-[var(--hm-hair)] pt-3">
                  <p className="mb-2 text-xs text-[var(--hm-mute)]">ถามต่อได้เลย</p>
                  <Chips items={t.guide} onPick={ask} disabled={busy} />
                </div>
              )}
              {/**
                * Only the line that means something to whoever is reading.
                *
                * Every answer used to be signed with the model that wrote it — "ตอบโดย
                * gemini-3.1-flash-lite" — which was worth seeing while this page was the
                * agent's own bench and they were choosing between models. To a customer it is
                * a stranger's name under a sentence about their own money.
                *
                * What stays is the claim a customer has a use for: this figure came out of the
                * company's rate tables and not out of a model. The model's name comes off even
                * there, because the point of the line is the opposite — that no model touched
                * the number.
                */}
              {t.role === "assistant" && t.priced && (
                <p className="mt-2 text-[0.65rem] text-[var(--hm-live)]">
                  {"✓ คิดจากตารางเบี้ยจริง"}
                </p>
              )}
            </div>
          </div>
        ))}

        {busy && (
          <p className="text-sm text-[var(--hm-mute)]" aria-live="polite">กำลังค้นในระบบ…</p>
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); ask(draft); }}
        className="flex shrink-0 gap-2 border-t border-[var(--hm-hair)] bg-[var(--hm-panel)] p-3"
      >
        <input
          value={draft} onChange={(e) => setDraft(e.target.value)}
          disabled={busy} maxLength={500} autoComplete="off"
          placeholder="พิมพ์คำถามเรื่องแบบประกัน…"
          aria-label="คำถามของคุณ"
          /* the ground, because the strip it sits on is the panel — a field the colour of
             the thing behind it is a field with only a hairline to say where it is */
          className="flex-1 rounded-xl border border-[var(--hm-line)] bg-[var(--hm-ground)] px-4 py-3 text-sm outline-none placeholder:text-[var(--hm-mute)] focus:border-[var(--hm-accent)]"
        />
        <button
          type="submit" disabled={busy || !draft.trim()}
          className="rounded-xl bg-[var(--hm-solid)] px-5 py-3 text-sm font-medium text-[var(--hm-solid-ink)] disabled:opacity-40"
        >
          ถาม
        </button>
      </form>
      </section>

      <p className="shrink-0 text-center text-xs text-[var(--hm-mute)]">
        เบี้ยเป็นตัวเลขประมาณการจากตารางของบริษัท ไม่ใช่ใบเสนอราคา ·{" "}
        <Link href="/privacy" className="underline">ความเป็นส่วนตัว</Link>
      </p>
    </main>
  );
}
