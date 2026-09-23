"use client";
import { useEffect, useState } from "react";
import {
  BLOCK_KINDS, BLOCK_LABEL, LAYOUTS, LAYOUT_LABEL, MAX_CHARS, SIZES, THEMES, THEME_LABEL,
  posterUrl, type BlockKind, type PosterSpec, type SizeId,
} from "@/lib/content/poster";

/**
 * The poster, editable: its four lines, where they sit, which colours, which size to download.
 *
 * One line of each kind — the shape the writer is asked for. Emptying a line leaves it off the
 * poster. A poster without a headline is not drawn, so while the headline is empty the preview
 * asks for one and there is nothing to download; saving then keeps the poster as it was. The
 * preview waits for typing to pause before it asks for a new picture, since every change is a
 * new drawing.
 */

const ORDER: BlockKind[] = [...BLOCK_KINDS];

function textsOf(p: PosterSpec): Record<BlockKind, string> {
  const t = { badge: "", headline: "", sub: "", footer: "" };
  for (const b of p.blocks) if (!t[b.kind]) t[b.kind] = b.text;
  return t;
}

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1 text-xs ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] hover:bg-[var(--ct-soft)]"}`;

export function PosterPanel({ value, onChange }: { value: PosterSpec; onChange: (p: PosterSpec) => void }) {
  const texts = textsOf(value);
  const drawable = value.blocks.some((b) => b.kind === "headline");
  const [size, setSize] = useState<SizeId>("square");
  const [shown, setShown] = useState(value);

  // a new picture once typing pauses, not on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setShown(value), 600);
    return () => clearTimeout(t);
  }, [value]);

  const set = (kind: BlockKind, text: string) => {
    const next = { ...texts, [kind]: text };
    onChange({ ...value, blocks: ORDER.filter((k) => next[k].trim()).map((k) => ({ kind: k, text: next[k] })) });
  };

  return (
    <div className="grid gap-4 rounded-lg bg-[var(--ct-ground)] p-3 sm:grid-cols-[minmax(0,260px)_minmax(0,1fr)]">
      <div>
        {shown.blocks.some((b) => b.kind === "headline") ? (
          // eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route
          <img
            src={posterUrl(shown, size)}
            alt="ตัวอย่างโปสเตอร์"
            className="w-full rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)]"
            style={{ aspectRatio: `${SIZES[size].width} / ${SIZES[size].height}` }}
          />
        ) : (
          <p className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-[var(--ct-line)] p-4 text-center text-sm text-[var(--ct-mute)]">
            ใส่พาดหัวก่อน แล้วรูปจะขึ้นตรงนี้
          </p>
        )}
        <div className="mt-2 flex flex-wrap gap-1.5">
          {(Object.keys(SIZES) as SizeId[]).map((s) => (
            <button key={s} type="button" aria-pressed={size === s} onClick={() => setSize(s)} className={chip(size === s)}>{SIZES[s].label}</button>
          ))}
        </div>
        {drawable && (
          <a
            href={posterUrl(value, size, true)}
            download={`poster-${size}.png`}
            className="mt-2 block rounded-lg bg-[var(--ct-solid)] px-3 py-2 text-center text-sm font-medium text-[var(--ct-solid-ink)]"
          >
            ดาวน์โหลดรูป PNG
          </a>
        )}
      </div>

      <div className="space-y-3">
        {ORDER.map((kind) => (
          <label key={kind} className="block">
            <span className="mb-1 flex justify-between text-xs font-medium">
              <span>{BLOCK_LABEL[kind]}{kind === "headline" ? "" : " (ไม่ใส่ก็ได้)"}</span>
              <span className="font-normal text-[var(--ct-mute)]">{[...texts[kind]].length}/{MAX_CHARS[kind]}</span>
            </span>
            <input
              value={texts[kind]}
              maxLength={MAX_CHARS[kind]}
              onChange={(e) => set(kind, e.target.value)}
              className="w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-1.5 text-sm outline-none focus:border-[var(--ct-accent)]"
            />
          </label>
        ))}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 font-medium">ตำแหน่งข้อความ</span>
          {LAYOUTS.map((l) => (
            <button key={l} type="button" aria-pressed={value.layout === l} onClick={() => onChange({ ...value, layout: l })} className={chip(value.layout === l)}>{LAYOUT_LABEL[l]}</button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="mr-1 font-medium">สี</span>
          {THEMES.map((t) => (
            <button key={t} type="button" aria-pressed={value.theme === t} onClick={() => onChange({ ...value, theme: t })} className={chip(value.theme === t)}>{THEME_LABEL[t]}</button>
          ))}
        </div>
        <p className="text-xs text-[var(--ct-mute)]">ตัวหนังสือไทยพิมพ์ด้วยฟอนต์จริง ไม่เพี้ยนแบบรูปที่ AI วาด · ตัวเลขบนภาพถูกตรวจเทียบตารางเบี้ยเมื่อกดบันทึก</p>
      </div>
    </div>
  );
}
