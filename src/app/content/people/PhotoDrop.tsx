"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { XIcon } from "../ui/icons";

const ACCEPT = ["image/jpeg", "image/png", "image/webp"];

/** an upload tray: a picture with an arrow rising out of it */
function UploadIcon() {
  return (
    <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="size-7">
      <path d="M4 16.5V18a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-1.5M12 15V4.5M7.5 9 12 4.5 16.5 9" />
    </svg>
  );
}

/**
 * The photo chooser, in place of the browser's own "Choose Files — No file chosen": a tray
 * to tap or drop photos on, and the chosen ones shown as thumbnails with an × each, so what
 * is about to be sent is what is on screen. `limit` is how many more photos may be added.
 */
export function PhotoDrop({ files, onChange, limit }: { files: File[]; onChange: (f: File[]) => void; limit: number }) {
  const input = useRef<HTMLInputElement>(null);
  const id = useId();
  const [over, setOver] = useState(false);
  const [refused, setRefused] = useState<string | null>(null);

  // thumbnails for the chosen files, released when the choice changes
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  function take(list: FileList | null) {
    const picked = [...(list ?? [])];
    const ok = picked.filter((f) => ACCEPT.includes(f.type));
    setRefused(ok.length < picked.length ? "บางรูปไม่ใช่ JPG, PNG หรือ WebP (รูป HEIC จากไอโฟน ให้แปลงเป็น JPG ก่อน)" : null);
    const next = [...files, ...ok].slice(0, Math.max(0, limit));
    if (files.length + ok.length > limit) setRefused(`เลือกได้อีก ${Math.max(0, limit)} รูปเท่านั้น`);
    onChange(next);
    if (input.current) input.current.value = "";
  }

  const full = files.length >= limit;

  return (
    <div className="space-y-2">
      <input
        ref={input} id={id} type="file" accept={ACCEPT.join(",")} multiple className="sr-only"
        onChange={(e) => take(e.target.files)} disabled={full}
      />
      <label
        htmlFor={id}
        onDragOver={(e) => { e.preventDefault(); if (!full) setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); if (!full) take(e.dataTransfer.files); }}
        className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed px-4 py-6 text-center transition-colors ${
          full ? "cursor-not-allowed border-[var(--ct-hair)] opacity-60"
            : over ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] text-[var(--ct-accent)]"
              : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:border-[var(--ct-solid)] hover:bg-[var(--ct-soft)] hover:text-[var(--ct-accent)]"
        }`}
      >
        <UploadIcon />
        <span className="text-sm font-medium">{full ? "ครบจำนวนแล้ว" : "แตะเพื่อเลือกรูป หรือลากรูปมาวางที่นี่"}</span>
        <span className="text-xs">JPG · PNG · WebP · เลือกได้อีก {Math.max(0, limit - files.length)} รูป</span>
      </label>

      {files.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {files.map((f, i) => (
            <div key={`${f.name}-${i}`} className="relative size-20 overflow-hidden rounded-lg ring-1 ring-[var(--ct-hair)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local preview of a file not yet sent */}
              <img src={previews[i]} alt="" className="size-full object-cover" />
              {/* a finger-sized press over a small drawn circle, so the photo stays visible */}
              <button
                type="button" aria-label="เอารูปนี้ออก" title="เอารูปนี้ออก"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                className="group absolute right-0 top-0 flex size-11 items-start justify-end p-1"
              >
                <span className="flex size-7 items-center justify-center rounded-full bg-[var(--ct-scrim)] text-[var(--ct-on-scrim)] group-hover:bg-[var(--ct-scrim-strong)]">
                  <XIcon className="size-4" />
                </span>
              </button>
            </div>
          ))}
        </div>
      )}
      {refused && <p className="text-xs text-[var(--ct-alert)]">{refused}</p>}
    </div>
  );
}
