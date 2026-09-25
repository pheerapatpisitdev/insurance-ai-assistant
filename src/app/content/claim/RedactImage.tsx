"use client";
import { useRef, useState } from "react";
import type { Box } from "@/lib/content/claim";

/**
 * One claim paper with its black bars, as they will be burnt in: tap a bar to lift it, and
 * with ลากเพื่อปิดเพิ่ม on, drag across the paper to lay a new one. The drag is a mode rather
 * than always on, so a finger on a phone can still scroll past the paper.
 */
export function RedactImage({ src, boxes, onChange, drawing, alt }: {
  src: string;
  boxes: Box[];
  onChange: (b: Box[]) => void;
  drawing: boolean;
  alt: string;
}) {
  const area = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

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
      {boxes.map((b, i) => (
        <button
          key={i} type="button" aria-label={`เอาแถบดำที่ ${i + 1} ออก`} title="แตะเพื่อเอาแถบดำออก"
          onClick={() => onChange(boxes.filter((_, j) => j !== i))}
          style={pct(b)}
          className="absolute bg-black outline-offset-1 hover:outline hover:outline-2 hover:outline-[var(--ct-alert)]"
        />
      ))}
      {live && <div style={pct(live)} className="pointer-events-none absolute bg-black/70 outline outline-2 outline-[var(--ct-accent)]" />}
    </div>
  );
}
