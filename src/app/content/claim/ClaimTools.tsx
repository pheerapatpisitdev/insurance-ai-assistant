"use client";
import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  CLAIM_ANGLES, CLAIM_KINDS, DOC_KINDS, EMPTY_FACTS, FACT_LIMIT, MAX_CLAIM_PIECES, MAX_DOCS,
  type Box, type ClaimFacts, type ClaimKind, type DocKind, type DocRead,
} from "@/lib/content/claim";
import { AUTO, OVERHEAD_THB, WRITERS, writerOf } from "@/lib/content/models";
import type { GenerateResult } from "../actions";
import { PhotoDrop } from "../people/PhotoDrop";
import { AlertIcon, CheckIcon, XIcon } from "../ui/icons";
import { burn, shrink } from "./redact";
import { RedactImage } from "./RedactImage";

/**
 * รีวิวเคลม's tools (owner, 2026-09-25): add the papers, tick the customer's consent, let the
 * model read them, check every black bar and every figure, then write. The pieces land in
 * รอตรวจ like any round's; the page's own runRound takes it from the press.
 */

interface Doc {
  /** the shrunk photograph as sent to be read; kept only in this tab */
  blob: Blob;
  src: string;
  width: number;
  height: number;
  kind: DocKind;
  boxes: Box[];
  /** ตรวจแล้ว: the owner looked at this paper's bars; any change to them takes it back */
  checked: boolean;
}

type ReadReply = ({ ok: true; costThb: number; facts: ClaimFacts; docs: DocRead[] }) | { ok: false; error: string };

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-1.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)] hover:bg-[var(--ct-soft)]"}`;
const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";
const solid = "min-h-11 w-full rounded-lg bg-[var(--ct-solid)] px-4 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50";
const outline = "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg border border-[var(--ct-line)] px-3 text-sm hover:bg-[var(--ct-soft)]";

/** the figures a reader must hold against the paper: the model read them, it did not know them */
const NUMBER_FIELDS: { key: "billTotal" | "paid" | "selfPaid" | "nights" | "daysToApprove"; label: string; unit: string }[] = [
  { key: "billTotal", label: "ค่ารักษาทั้งหมด", unit: "บาท" },
  { key: "paid", label: "ประกันจ่าย", unit: "บาท" },
  { key: "selfPaid", label: "ลูกค้าจ่ายเอง", unit: "บาท" },
  { key: "nights", label: "นอนโรงพยาบาล", unit: "คืน" },
  { key: "daysToApprove", label: "ยื่นเคลมถึงอนุมัติ", unit: "วัน" },
];

export function ClaimTools({ writer, onWriter, left, pending, making, run }: {
  writer: string;
  onWriter: (id: string) => void;
  /** the month's content money left, for the estimate and for อัตโนมัติ */
  left: number;
  pending: boolean;
  making: number;
  run: (asked: number, send: () => Promise<GenerateResult>) => Promise<void>;
}) {
  const id = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [docs, setDocs] = useState<Doc[] | null>(null);
  const [facts, setFacts] = useState<ClaimFacts>(EMPTY_FACTS);
  const [posterDoc, setPosterDoc] = useState<number | null>(null);
  const [count, setCount] = useState(1);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState(false);

  // the papers' previews live as long as this read does
  const urls = useRef<string[]>([]);
  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  function startOver() {
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setDocs(null);
    setFiles([]);
    setFacts(EMPTY_FACTS);
    setPosterDoc(null);
    setError(null);
  }

  async function read() {
    if (reading || files.length === 0 || !consent) return;
    setReading(true);
    setError(null);
    try {
      const shrunk = await Promise.all(files.map((f) => shrink(f)));
      const form = new FormData();
      form.set("consent", "on");
      shrunk.forEach((s, i) => form.append("docs", s.blob, `doc-${i + 1}.jpg`));
      const res = await fetch("/api/content-claim", { method: "POST", body: form });
      const reply = await res.json() as ReadReply;
      if (!reply.ok) { setError(reply.error); return; }
      const made = shrunk.map((s, i): Doc => {
        const src = URL.createObjectURL(s.blob);
        urls.current.push(src);
        return { blob: s.blob, src, width: s.width, height: s.height, kind: reply.docs[i]?.kind ?? "other", boxes: reply.docs[i]?.boxes ?? [], checked: false };
      });
      setDocs(made);
      setFacts(reply.facts);
      // the approval letter shows the payment best; failing that, the first paper
      const approval = made.findIndex((d) => d.kind === "approval");
      setPosterDoc(approval >= 0 ? approval : 0);
      setReview(true);
    } catch {
      setError("อ่านเอกสารไม่สำเร็จ ลองใหม่อีกครั้งนะครับ");
    } finally {
      setReading(false);
    }
  }

  const chosen = docs && posterDoc !== null ? docs[posterDoc] : null;
  const unchecked = chosen ? !chosen.checked : false;
  const thin = !facts.illness.trim() && !facts.paid.trim() && !facts.billTotal.trim();
  const blocked = !docs ? "ให้ AI อ่านเอกสารก่อน"
    : !consent ? "ติ๊กยืนยันความยินยอมของลูกค้าก่อน"
      : unchecked ? "ตรวจแถบดำของรูปที่ใช้ทำโปสเตอร์ แล้วกด “ตรวจแล้ว” ก่อน"
        : thin ? "ใส่โรค/อาการ หรือยอดเงินก่อน" : null;

  const pick = writerOf(writer, left);
  const estimate = (count * (pick.thb + OVERHEAD_THB)).toFixed(2);

  async function write() {
    if (pending || blocked || !docs) return;
    // the paper as the owner last saw it, bars and all, taken at the press
    const paper = chosen;
    const payload = { ...facts };
    await run(count, async () => {
      const form = new FormData();
      form.set("consent", "on");
      form.set("facts", JSON.stringify(payload));
      form.set("count", String(count));
      form.set("writer", writer);
      if (paper) {
        form.set("paper", await burn(paper.blob, paper.boxes), "paper.jpg");
        form.set("ratio", String(paper.width / paper.height));
        form.set("checked", paper.checked ? "on" : "");
      }
      const res = await fetch("/api/content-claim", { method: "PUT", body: form });
      return await res.json() as GenerateResult;
    });
  }

  const checkedCount = docs?.filter((d) => d.checked).length ?? 0;

  return (
    <>
      <div className="space-y-4 p-4">
        <div>
          <span className="mb-1 block text-sm font-medium">เอกสารเคลม <span className="font-normal text-[var(--ct-mute)]">(ไม่เกิน {MAX_DOCS} รูป)</span></span>
          {docs ? (
            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {docs.map((d, i) => (
                  <button
                    key={i} type="button" onClick={() => setReview(true)} title="เปิดตรวจ"
                    className="relative size-16 overflow-hidden rounded-lg ring-1 ring-[var(--ct-hair)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- a local preview, never uploaded as it is */}
                    <img src={d.src} alt={`เอกสาร ${i + 1}`} className="size-full object-cover" />
                    <span className={`absolute bottom-0.5 right-0.5 flex size-5 items-center justify-center rounded-full ${d.checked ? "bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]" : "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
                      {d.checked ? <CheckIcon className="size-3.5" /> : <AlertIcon className="size-3.5" />}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-[var(--ct-mute)]">ตรวจแล้ว {checkedCount}/{docs.length} รูป</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setReview(true)} className={`${outline} flex-1 font-medium`}>ตรวจเอกสารและข้อมูล</button>
                <button type="button" onClick={startOver} className={outline}>เริ่มใหม่</button>
              </div>
            </div>
          ) : (
            <PhotoDrop files={files} onChange={setFiles} limit={MAX_DOCS} />
          )}
          <p className="mt-1.5 text-xs text-[var(--ct-mute)]">หนังสืออนุมัติ บิลโรงพยาบาล ใบรับรองแพทย์ แคปแชท/สลิป · PDF ให้แคปหน้าจอก่อน · ระบบเก็บเฉพาะรูปที่ถมดำแล้ว</p>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
          <span>ลูกค้ายินยอมให้ใช้เอกสารนี้ลงเพจแล้ว <span className="block text-xs opacity-80">ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหวตาม PDPA ต้องได้รับความยินยอมก่อนทุกครั้ง</span></span>
        </label>

        {!docs && (
          <button type="button" onClick={read} disabled={reading || files.length === 0 || !consent} className={solid}>
            {reading ? "AI กำลังอ่านเอกสาร… (ราว 20–60 วินาที)" : "ให้ AI อ่านเอกสาร (ราว ฿0.2)"}
          </button>
        )}
        {error && <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] p-2.5 text-sm text-[var(--ct-alert)]">{error}</p>}

        {docs && (
          <>
            <div className="rounded-lg bg-[var(--ct-soft)] p-3 text-sm">
              <p className="font-medium">{CLAIM_KINDS.find((k) => k.id === facts.kind)?.label}{facts.illness ? ` · ${facts.illness}` : ""}</p>
              <p className="mt-0.5 text-[var(--ct-mute)]">
                {[facts.paid && `ประกันจ่าย ${facts.paid} บาท`, facts.nights && `นอน ${facts.nights} คืน`, facts.selfPaid && `จ่ายเอง ${facts.selfPaid} บาท`].filter(Boolean).join(" · ") || "ยังไม่มียอดเงิน"}
              </p>
              <button type="button" onClick={() => setReview(true)} className="mt-1 text-sm font-medium text-[var(--ct-accent)] underline underline-offset-2">แก้ข้อมูล</button>
            </div>

            <div role="group" aria-labelledby={`${id}-count`}>
              <span id={`${id}-count`} className="mb-1.5 block text-sm font-medium">จำนวนชิ้น <span className="font-normal text-[var(--ct-mute)]">(แต่ละชิ้นเล่าคนละมุม)</span></span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: MAX_CLAIM_PIECES }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={chip(count === n)}>{n}</button>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-[var(--ct-mute)]">{CLAIM_ANGLES.slice(0, count).map((a) => a.label).join(" · ")}</p>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">ผู้เขียน</span>
              <select value={writer} onChange={(e) => onWriter(e.target.value)} className={field}>
                <option value={AUTO}>อัตโนมัติ</option>
                {WRITERS.map((w) => <option key={w.id} value={w.id}>{w.label} · {w.short}</option>)}
              </select>
            </label>
          </>
        )}
      </div>

      {docs && (
        <div className="sticky bottom-0 z-10 rounded-b-xl border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={write} disabled={pending || Boolean(blocked)} className={solid}>
            {pending ? `กำลังเขียน ${making} ชิ้น… (ราว 20–40 วินาที)` : `สร้างรีวิวเคลม ${count} ชิ้น`}
          </button>
          <p className="mt-2 text-xs text-[var(--ct-mute)]">{blocked ?? `ราว ฿${estimate} · งบคอนเทนต์เดือนนี้เหลือ ฿${left.toFixed(2)}`}</p>
        </div>
      )}

      {/* out of the tools column, which is sticky and scrolls and put the dialog under the pieces;
          into .content-page rather than the body, where the page's colour tokens live */}
      {review && docs && createPortal(
        <ReviewDialog
          docs={docs} onDocs={setDocs} facts={facts} onFacts={setFacts}
          posterDoc={posterDoc} onPosterDoc={setPosterDoc} onClose={() => setReview(false)}
        />,
        document.querySelector(".content-page") ?? document.body,
      )}
    </>
  );
}

function ReviewDialog({ docs, onDocs, facts, onFacts, posterDoc, onPosterDoc, onClose }: {
  docs: Doc[];
  onDocs: (d: Doc[]) => void;
  facts: ClaimFacts;
  onFacts: (f: ClaimFacts) => void;
  posterDoc: number | null;
  onPosterDoc: (i: number | null) => void;
  onClose: () => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [drawing, setDrawing] = useState<number | null>(null);
  const close = useRef(onClose);
  close.current = onClose;

  useEffect(() => {
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    box.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close.current(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = scroll;
    };
  }, []);

  const change = (i: number, next: Partial<Doc>) => onDocs(docs.map((d, j) => (j === i ? { ...d, ...next } : d)));
  const set = <K extends keyof ClaimFacts>(k: K, v: ClaimFacts[K]) => onFacts({ ...facts, [k]: v });

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-[var(--ct-scrim)] sm:p-4">
      <div ref={box} role="dialog" aria-modal="true" aria-label="ตรวจเอกสารเคลม" className="flex w-full max-w-5xl flex-col overflow-hidden border border-[var(--ct-hair)] bg-[var(--ct-panel)] sm:rounded-xl">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--ct-hair)] px-4 py-3">
          <div>
            <h2 className="font-semibold">ตรวจเอกสารเคลม</h2>
            <p className="text-xs text-[var(--ct-mute)]">แถบดำคือที่จะถูกปิดจริงบนโปสเตอร์ · แตะแถบเพื่อเอาออก</p>
          </div>
          <button type="button" data-autofocus onClick={onClose} aria-label="ปิด" className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-[var(--ct-line)]">
            <XIcon className="size-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 overflow-y-auto overscroll-contain lg:grid-cols-[minmax(0,1fr)_340px] lg:overflow-hidden">
          <div className="space-y-6 p-4 lg:overflow-y-auto">
            {docs.map((d, i) => (
              <section key={i} aria-label={`เอกสาร ${i + 1}`} className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium">รูปที่ {i + 1} · {DOC_KINDS.find((k) => k.id === d.kind)?.label} <span className="font-normal text-[var(--ct-mute)]">· แถบดำ {d.boxes.length} จุด</span></p>
                  <button
                    type="button" aria-pressed={drawing === i} onClick={() => setDrawing(drawing === i ? null : i)}
                    className={chip(drawing === i)}
                  >
                    {drawing === i ? "ลากบนรูปเพื่อปิด · แตะเพื่อหยุด" : "ลากเพื่อปิดเพิ่ม"}
                  </button>
                </div>
                <RedactImage
                  src={d.src} boxes={d.boxes} drawing={drawing === i} alt={`เอกสาร ${i + 1}`}
                  onChange={(boxes) => change(i, { boxes, checked: false })}
                />
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button" aria-pressed={d.checked} onClick={() => change(i, { checked: !d.checked })}
                    className={`${chip(d.checked)} gap-1.5`}
                  >
                    {d.checked && <CheckIcon className="size-4" />}
                    {d.checked ? "ตรวจแล้ว" : "กดเมื่อตรวจแล้ว ไม่เห็นชื่อหรือเลขใดๆ"}
                  </button>
                  <button type="button" aria-pressed={posterDoc === i} onClick={() => onPosterDoc(posterDoc === i ? null : i)} className={chip(posterDoc === i)}>
                    {posterDoc === i ? "ใช้รูปนี้ทำโปสเตอร์" : "ใช้ทำโปสเตอร์"}
                  </button>
                </div>
              </section>
            ))}
          </div>

          <div className="space-y-3 border-t border-[var(--ct-hair)] p-4 lg:overflow-y-auto lg:border-l lg:border-t-0">
            <h3 className="text-sm font-semibold">ข้อมูลที่ AI อ่านได้</h3>
            <p className="flex gap-1.5 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-2.5 text-xs text-[var(--ct-warn-ink)]">
              <AlertIcon className="size-4 shrink-0" />
              AI อ่าน — เทียบตัวเลขกับเอกสารทุกช่องก่อนสร้าง โพสต์จะใช้ตัวเลขตามนี้ตรงตัว
            </p>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">ประเภทการเคลม</span>
              <select value={facts.kind} onChange={(e) => set("kind", e.target.value as ClaimKind)} className={field}>
                {CLAIM_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">โรค/อาการ</span>
              <input value={facts.illness} maxLength={FACT_LIMIT.illness} onChange={(e) => set("illness", e.target.value)} placeholder="เช่น ไข้เลือดออก" className={field} />
            </label>
            <div className="grid grid-cols-2 gap-2">
              {NUMBER_FIELDS.map((f) => (
                <label key={f.key} className="block">
                  <span className="mb-1 block text-xs font-medium">{f.label} ({f.unit})</span>
                  <input
                    value={facts[f.key]} maxLength={FACT_LIMIT[f.key]} inputMode="decimal"
                    onChange={(e) => set(f.key, e.target.value.replace(/[^\d.,]/g, ""))} className={field}
                  />
                </label>
              ))}
            </div>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">ผู้เอาประกัน <span className="font-normal text-[var(--ct-mute)]">(ห้ามใส่ชื่อ)</span></span>
              <input value={facts.who} maxLength={FACT_LIMIT.who} onChange={(e) => set("who", e.target.value)} placeholder="เช่น ผู้หญิง วัย 40+" className={field} />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">เล่าเพิ่ม <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
              <textarea value={facts.note} maxLength={FACT_LIMIT.note} rows={3} onChange={(e) => set("note", e.target.value)} placeholder="เช่น ลูกค้าบอกว่าไม่ต้องสำรองจ่ายสักบาท" className={field} />
            </label>
          </div>
        </div>

        <div className="border-t border-[var(--ct-hair)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
          <button type="button" onClick={onClose} className={solid}>เสร็จ</button>
        </div>
      </div>
    </div>
  );
}
