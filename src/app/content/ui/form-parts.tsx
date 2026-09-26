"use client";
import { useEffect, useId, useState } from "react";
import { FORMAT_SHORT, type Format } from "@/lib/content/prompt";
import { ChevronDownIcon } from "./icons";

/**
 * The parts all three create forms (จากแบบประกัน, รีวิวเคลม, หาทีม) share, so they read in one
 * order (owner, 2026-09-26): what the round is from → what to make → เรื่องที่เล่า (open) →
 * ภาพและโมเดล (folded, it is set once and remembered) → the count beside the สร้าง press.
 */

const FORMATS: Format[] = ["post", "script", "ad"];

/** ทำอะไร as one tap each — it reshapes the whole form, so every choice is in sight */
export function FormatPicker({ value, onChange }: { value: Format; onChange: (f: Format) => void }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id}>
      <span id={id} className="mb-1 block text-sm font-medium">ทำอะไร</span>
      <div className="flex gap-1 rounded-lg bg-[var(--ct-soft)] p-1">
        {FORMATS.map((f) => (
          <button
            key={f} type="button" aria-pressed={value === f} onClick={() => onChange(f)}
            className={`min-h-10 flex-1 rounded-md px-1.5 text-sm ${value === f ? "bg-[var(--ct-panel)] font-medium shadow-sm" : "text-[var(--ct-mute)]"}`}
          >
            {FORMAT_SHORT[f]}
          </button>
        ))}
      </div>
    </div>
  );
}

/** a quiet rule and a name over a run of fields */
export function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 border-t border-[var(--ct-hair)] pt-4">
      <h3 className="text-xs font-medium text-[var(--ct-mute)]">{title}</h3>
      {children}
    </div>
  );
}

/** the fold's open or shut, kept in this browser like the picks inside it */
const FOLD_KEY = "content-fold-picture";

/** ภาพและโมเดล: shut by default, with one line saying what is picked inside */
export function PictureFold({ summary, children }: { summary: string; children: React.ReactNode }) {
  const id = useId();
  const [open, setOpenState] = useState(false);
  useEffect(() => {
    try { setOpenState(localStorage.getItem(FOLD_KEY) === "open"); } catch { /* storage unavailable */ }
  }, []);
  const toggle = () => {
    setOpenState((was) => {
      try { localStorage.setItem(FOLD_KEY, was ? "shut" : "open"); } catch { /* not kept */ }
      return !was;
    });
  };
  return (
    <div className="rounded-lg border border-[var(--ct-hair)]">
      <button
        type="button" aria-expanded={open} aria-controls={id} onClick={toggle}
        className="flex min-h-11 w-full items-start justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="min-w-0">
          <span className="block text-sm font-medium">ภาพและโมเดล <span className="font-normal text-[var(--ct-mute)]">(ระบบจำไว้ให้)</span></span>
          <span className="mt-0.5 block text-xs text-[var(--ct-mute)]">{summary}</span>
        </span>
        <ChevronDownIcon className={`mt-0.5 size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div id={id} hidden={!open} className="space-y-4 border-t border-[var(--ct-hair)] p-3">
        {children}
      </div>
    </div>
  );
}

/**
 * The สร้าง press with the round's count beside it: the number the button says is the one set
 * right next to it. A round whose size is set elsewhere (ads: มุมขาย × น้ำเสียง) has no stepper.
 */
export function PressBar({ count, max, onCount, unit, label, onPress, disabled, note }: {
  count: number;
  max: number;
  onCount?: (n: number) => void;
  unit: string;
  label: string;
  onPress: () => void;
  disabled: boolean;
  note: string;
}) {
  const step = "inline-flex size-11 items-center justify-center text-lg text-[var(--ct-ink)] disabled:opacity-30";
  return (
    <div className="sticky bottom-0 z-10 rounded-b-xl border-t border-[var(--ct-hair)] bg-[var(--ct-panel)] px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="flex gap-2">
        {onCount && (
          <div role="group" aria-label={`จำนวน${unit}`} className="flex shrink-0 items-center rounded-lg border border-[var(--ct-line)]">
            <button type="button" aria-label={`ลด 1 ${unit}`} disabled={count <= 1} onClick={() => onCount(count - 1)} className={step}>−</button>
            <span aria-live="polite" className="min-w-6 text-center text-sm font-medium tabular-nums">{count}</span>
            <button type="button" aria-label={`เพิ่ม 1 ${unit}`} disabled={count >= max} onClick={() => onCount(count + 1)} className={step}>+</button>
          </div>
        )}
        <button type="button" onClick={onPress} disabled={disabled} className="min-h-11 flex-1 rounded-lg bg-[var(--ct-solid)] px-4 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50">
          {label}
        </button>
      </div>
      <p className="mt-2 text-xs text-[var(--ct-mute)]">{note}</p>
    </div>
  );
}

/** the folded ภาพและโมเดล in one line: the writer, then — posters only — the picture, its tone and who is in it */
export function pictureSummary({ format, writer, painter, theme, person }: {
  format: Format;
  /** the writing model's short name */
  writer: string;
  /** the drawing model's short name, or null for no picture */
  painter: string | null;
  /** the poster tone's name, where the form offers one */
  theme?: string;
  /** the person in the picture, by name */
  person?: string;
}): string {
  const picture = format === "script" ? [] : [
    painter ? `วาดด้วย ${painter}` : "ไม่วาดภาพ",
    ...(theme ? [theme] : []),
    ...(painter && person ? [person] : []),
  ];
  return [`เขียนด้วย ${writer}`, ...picture].join(" · ");
}
