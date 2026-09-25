"use client";
import { useEffect, useRef, useState } from "react";
import type { Box } from "@/lib/content/claim";
import { pageFont } from "./redact";
import { drawSticker, stickerRect } from "./stickers";

/**
 * One claim paper with its stickers, as they will be burnt in: tap a sticker to lift it, and
 * with ลากเพื่อปิดเพิ่ม on, drag across the paper to lay a new one. The drag is a mode rather
 * than always on, so a finger on a phone can still scroll past the paper.
 *
 * The stickers are drawn by the same function that burns them in, on a canvas the paper's own
 * size laid over it, so what the owner checks is exactly what is saved. Invisible buttons over
 * each one take the taps.
 */
export function RedactImage({ src, width, height, boxes, onChange, drawing, alt }: {
  src: string;
  /** the paper's pixels, which the stickers are sized in */
  width: number;
  height: number;
  boxes: Box[];
  onChange: (b: Box[]) => void;
  drawing: boolean;
  alt: string;
}) {
  const area = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLCanvasElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  useEffect(() => {
    const g = sheet.current?.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, width, height);
    const font = pageFont();
    boxes.forEach((b, i) => drawSticker(g, b, i, width, height, font));
  }, [boxes, width, height]);

  function at(e: React.PointerEvent): { x: number; y: number } {
    const r = area.current!.getBoundingClientRect();
    return {
      x: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)),
      y: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)),
    };
  }

  function down(e: React.PointerEvent) {
    if (!drawing || e.button !== 0) return;
    if (e.target instanceof HTMLElement && e.target.closest("button")) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = at(e);
    setDrag({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
  }
  function move(e: React.PointerEvent) {
    if (!drag) return;
    const p = at(e);
    setDrag({ ...drag, x1: p.x, y1: p.y });
  }
  function up() {
    if (!drag) return;
    const box = { x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0) };
    setDrag(null);
    // a tap, not a drag: nothing laid
    if (box.w > 0.01 && box.h > 0.005) onChange([...boxes, box]);
  }

  // the tap target is the sticker as drawn, padding and all
  const hit = (b: Box) => {
    const r = stickerRect(b, width, height);
    return { left: `${(r.x / width) * 100}%`, top: `${(r.y / height) * 100}%`, width: `${(r.w / width) * 100}%`, height: `${(r.h / height) * 100}%` };
  };
  const pct = (b: Box) => ({ left: `${b.x * 100}%`, top: `${b.y * 100}%`, width: `${b.w * 100}%`, height: `${b.h * 100}%` });
  const live = drag && { x: Math.min(drag.x0, drag.x1), y: Math.min(drag.y0, drag.y1), w: Math.abs(drag.x1 - drag.x0), h: Math.abs(drag.y1 - drag.y0) };

  return (
    <div
      ref={area}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => setDrag(null)}
      className={`relative select-none overflow-hidden rounded-lg ring-1 ring-[var(--ct-hair)] ${drawing ? "cursor-crosshair touch-none" : ""}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- a local file, never uploaded as it is */}
      <img src={src} alt={alt} draggable={false} className="block w-full" />
      <canvas ref={sheet} width={width} height={height} aria-hidden className="pointer-events-none absolute inset-0 size-full" />
      {boxes.map((b, i) => (
        <button
          key={i} type="button" aria-label={`เอาสติ๊กเกอร์ที่ ${i + 1} ออก`} title="แตะเพื่อเอาสติ๊กเกอร์ออก"
          onClick={() => onChange(boxes.filter((_, j) => j !== i))}
          style={hit(b)}
          className="absolute rounded-full hover:outline hover:outline-2 hover:outline-[var(--ct-alert)]"
        />
      ))}
      {live && <div style={pct(live)} className="pointer-events-none absolute rounded-md bg-[var(--ct-soft)]/80 outline outline-2 outline-[var(--ct-accent)]" />}
    </div>
  );
}
