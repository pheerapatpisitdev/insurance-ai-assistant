"use client";
import { useId, useState } from "react";
import {
  CLAIM_ANGLES, FACT_LIMIT, MAX_CLAIM_CUSTOM, MAX_CLAIM_PIECES, MAX_DOCS, claimAngleLines, type ClaimFacts, type DocRead,
} from "@/lib/content/claim";
import { AUTO, OVERHEAD_THB, WRITERS, writerOf } from "@/lib/content/models";
import { FORMAT_LABEL, LENGTHS, MAX_READER, NICHES, type Format, type Length } from "@/lib/content/prompt";
import type { GenerateResult } from "../actions";
import { PhotoDrop } from "../people/PhotoDrop";
import { burn, shrink } from "./redact";

/**
 * รีวิวเคลม's tools, one press like a plan's (owner, 2026-09-25): add the papers, tick the
 * customer's consent, set the round, press สร้าง. The press reads the papers, puts the AI's
 * stickers on the one for the poster, and writes; the pieces land in รอตรวจ like any round's.
 * The one check left — are the stickers enough — is in the editor (ClaimPaperCheck), and a
 * piece with a paper cannot be posted until it is ticked there.
 */

type ReadReply = ({ ok: true; costThb: number; facts: ClaimFacts; docs: DocRead[] }) | { ok: false; error: string };

/** reading the papers, on top of the writing; Gemini Flash reads six for about ฿0.1 */
const READ_THB = 0.2;

const chip = (on: boolean) =>
  `inline-flex min-h-11 items-center justify-center rounded-full border px-3.5 py-1.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)] hover:bg-[var(--ct-soft)]"}`;
const field = "min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";
const solid = "min-h-11 w-full rounded-lg bg-[var(--ct-solid)] px-4 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50";

export function ClaimTools({ writer, onWriter, reader, onReader, left, pending, making, run }: {
  writer: string;
  onWriter: (id: string) => void;
  /** who the posts talk to — the plan form's, remembered on this device for both */
  reader: string;
  onReader: (r: string) => void;
  /** the month's content money left, for the estimate and for อัตโนมัติ */
  left: number;
  pending: boolean;
  making: number;
  run: (asked: number, format: Format, send: () => Promise<GenerateResult>) => Promise<void>;
}) {
  const id = useId();
  const [files, setFiles] = useState<File[]>([]);
  const [consent, setConsent] = useState(false);
  const [format, setFormat] = useState<Format>("post");
  const [length, setLength] = useState<Length>("60");
  /** an angle id, "custom", or "" for ให้ AI เลือก */
  const [angle, setAngle] = useState("");
  const [custom, setCustom] = useState("");
  const [note, setNote] = useState("");
  const [count, setCount] = useState(1);

  const blocked = files.length === 0 ? "เลือกรูปเอกสารเคลมก่อน"
    : !consent ? "ติ๊กยืนยันความยินยอมของลูกค้าก่อน"
      : angle === "custom" && !custom.trim() ? "พิมพ์มุมที่อยากเล่า หรือเลือก “ให้ AI เลือก”" : null;

  const pick = writerOf(writer, left);
  const estimate = (READ_THB + count * (pick.thb + OVERHEAD_THB)).toFixed(2);
  const unit = format === "ad" ? "แบบ" : "ชิ้น";

  async function create() {
    if (pending || blocked) return;
    // the form as it was at the press, whatever changes while the round is out
    const papers = files;
    const round = { format, length, angle, custom: custom.trim(), reader: reader.trim(), note: note.trim(), count, writer };
    await run(count, round.format, async (): Promise<GenerateResult> => {
      const shrunk = await Promise.all(papers.map((f) => shrink(f)));
      const readForm = new FormData();
      readForm.set("consent", "on");
      shrunk.forEach((s, i) => readForm.append("docs", s.blob, `doc-${i + 1}.jpg`));
      const read = await (await fetch("/api/content-claim", { method: "POST", body: readForm })).json() as ReadReply;
      if (!read.ok) return { ok: false, error: read.error };

      const form = new FormData();
      form.set("consent", "on");
      form.set("facts", JSON.stringify({ ...read.facts, note: round.note }));
      form.set("count", String(round.count));
      form.set("writer", round.writer);
      form.set("format", round.format);
      form.set("length", round.length);
      form.set("angle", round.angle);
      form.set("custom", round.custom);
      form.set("reader", round.reader);
      // a script is spoken: no poster, so no paper. Otherwise the approval letter shows the
      // payment best; failing that, the first paper — with the AI's stickers, checked later
      if (round.format !== "script") {
        const approval = read.docs.findIndex((d) => d.kind === "approval");
        const at = approval >= 0 ? approval : 0;
        form.set("paper", await burn(shrunk[at].blob, read.docs[at]?.boxes ?? []), "paper.jpg");
        form.set("ratio", String(shrunk[at].width / shrunk[at].height));
      }
      return await (await fetch("/api/content-claim", { method: "PUT", body: form })).json() as GenerateResult;
    });
  }

  return (
    <>
      <div className="space-y-4 p-4">
        <div>
          <span className="mb-1 block text-sm font-medium">เอกสารเคลม <span className="font-normal text-[var(--ct-mute)]">(ไม่เกิน {MAX_DOCS} รูป)</span></span>
          <PhotoDrop files={files} onChange={setFiles} limit={MAX_DOCS} />
          <p className="mt-1.5 text-xs text-[var(--ct-mute)]">หนังสืออนุมัติ บิลโรงพยาบาล ใบรับรองแพทย์ แคปแชท/สลิป · PDF ให้แคปหน้าจอก่อน · AI อ่านแล้วแปะสติ๊กเกอร์ปิดชื่อให้ · ระบบเก็บเฉพาะรูปที่ปิดข้อมูลแล้ว</p>
        </div>

        <label className="flex items-start gap-2.5 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 size-5 shrink-0" />
          <span>ลูกค้ายินยอมให้ใช้เอกสารนี้ลงเพจแล้ว <span className="block text-xs opacity-80">ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหวตาม PDPA ต้องได้รับความยินยอมก่อนทุกครั้ง</span></span>
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">ทำอะไร</span>
          <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className={field}>
            {(["post", "script", "ad"] as const).map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
          </select>
        </label>

        {format === "script" && (
          <div role="group" aria-labelledby={`${id}-length`}>
            <span id={`${id}-length`} className="mb-1.5 block text-sm font-medium">ความยาวคลิป</span>
            <div className="flex flex-wrap gap-2">
              {LENGTHS.map((l) => (
                <button key={l.id} type="button" aria-pressed={length === l.id} onClick={() => setLength(l.id)} className={chip(length === l.id)}>{l.label}</button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block">
            <span className="mb-1 block text-sm font-medium">มุมที่อยากเล่า <span className="font-normal text-[var(--ct-mute)]">(ไม่เลือกก็ได้)</span></span>
            <select value={angle} onChange={(e) => setAngle(e.target.value)} className={field}>
              <option value="">ให้ AI เลือก</option>
              {CLAIM_ANGLES.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              <option value="custom">พิมพ์เอง…</option>
            </select>
          </label>
          {angle === "custom" && (
            <label className="mt-2 block">
              <span className="sr-only">มุมที่อยากเล่า (พิมพ์เอง)</span>
              <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={MAX_CLAIM_CUSTOM} placeholder="เช่น เคลมได้แม้เพิ่งทำประกันได้ 1 ปี" className={field} />
            </label>
          )}
        </div>

        <div role="group" aria-labelledby={`${id}-reader`}>
          <span id={`${id}-reader`} className="mb-1.5 block text-sm font-medium">คนอ่านคือใคร <span className="font-normal text-[var(--ct-mute)]">(ระบบจำไว้ให้)</span></span>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={reader === ""} onClick={() => onReader("")} className={chip(reader === "")}>ทุกคน</button>
            {NICHES.map((n) => (
              <button key={n} type="button" aria-pressed={reader === n} onClick={() => onReader(n)} className={chip(reader === n)}>{n}</button>
            ))}
          </div>
          <label className="mt-2 block">
            <span className="sr-only">คนอ่าน (พิมพ์เอง)</span>
            <input value={reader} onChange={(e) => onReader(e.target.value)} maxLength={MAX_READER} placeholder="หรือพิมพ์เอง เช่น พยาบาลกะดึก" className={field} />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">เล่าเพิ่ม <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้ · ห้ามใส่ชื่อ)</span></span>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} maxLength={FACT_LIMIT.note} rows={3}
            placeholder="เช่น ลูกค้าบอกว่าไม่ต้องสำรองจ่ายสักบาท" className={field}
          />
        </label>

        <div role="group" aria-labelledby={`${id}-count`}>
          <span id={`${id}-count`} className="mb-1.5 block text-sm font-medium">จำนวน{unit} <span className="font-normal text-[var(--ct-mute)]">(แต่ละ{unit}เล่าคนละมุม)</span></span>
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: MAX_CLAIM_PIECES }, (_, i) => i + 1).map((n) => (
              <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={chip(count === n)}>{n}</button>
            ))}
          </div>
          <p className="mt-1.5 text-xs text-[var(--ct-mute)]">
            {angle && count > 1 && (angle !== "custom" || custom.trim())
              ? `ทุก${unit}เล่ามุมที่เลือก เปิดเรื่องต่างกัน`
              : claimAngleLines({ angle, custom }, count).map((a) => a.label).join(" · ")}
          </p>
        </div>

        <label className="block">
          <span className="mb-1 block text-sm font-medium">โมเดลเขียน</span>
          <select value={writer} onChange={(e) => onWriter(e.target.value)} className={field}>
            <option value={AUTO}>อัตโนมัติ</option>
            {WRITERS.map((w) => <option key={w.id} value={w.id}>{w.label} · {w.short}</option>)}
          </select>
        </label>
      </div>

      {/* the press and its price stay in reach, as on the plan form */}
      <div className="sticky bottom-0 z-10 rounded-b-xl border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button type="button" onClick={create} disabled={pending || Boolean(blocked)} className={solid}>
          {pending
            ? `กำลังอ่านเอกสารและเขียน ${making} ${unit}… (ราว 30–60 วินาที)`
            : `สร้าง${format === "post" ? "รีวิวเคลม" : format === "ad" ? "โฆษณารีวิวเคลม" : "สคริปต์รีวิวเคลม"} ${count} ${unit}`}
        </button>
        <p className="mt-2 text-xs text-[var(--ct-mute)]">{blocked ?? `ราว ฿${estimate} · งบคอนเทนต์เดือนนี้เหลือ ฿${left.toFixed(2)}`}</p>
      </div>
    </>
  );
}
