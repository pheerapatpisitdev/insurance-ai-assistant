"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, type TextareaHTMLAttributes } from "react";
import { AlertIcon, CheckIcon } from "./editor-icons";

/**
 * Small pieces the editor's panels share: the line that says how an action went, and a text
 * box that grows with its words.
 */

/** what an action left to say: done (grey), or went wrong (red, read out at once) */
export type NoteState = { kind: "ok" | "error"; text: string } | null;

export const okNote = (text: string): NoteState => ({ kind: "ok", text });
export const errorNote = (text: string): NoteState => ({ kind: "error", text });

const SETTINGS_HREF = "/admin/messenger";

/**
 * A message from the server, with the plumbing taken out. Facebook's permission name and the
 * settings page's address mean nothing to the owner; the page becomes a link in her words.
 */
export function PlainText({ text }: { text: string }) {
  const link = <a href={SETTINGS_HREF} className="font-medium underline">หน้าตั้งค่าเพจ</a>;
  if (/pages_manage_posts|ยังไม่ได้เปิดสิทธิ์โพสต์|ยังไม่มีเพจที่เปิดสิทธิ์โพสต์/.test(text)) {
    return <>ยังไม่ได้อนุญาตให้ระบบโพสต์ลงเพจ — ไปเชื่อมเพจใหม่ที่ {link}</>;
  }
  const parts = text.split(/(?:หน้า\s*)?\/admin\/messenger/);
  if (parts.length === 1) return <>{text}</>;
  return <>{parts.map((p, i) => <span key={i}>{p}{i < parts.length - 1 && link}</span>)}</>;
}

export function Note({ note, className = "" }: { note: NoteState; className?: string }) {
  if (!note) return null;
  if (note.kind === "error") {
    return (
      <p role="alert" className={`flex items-start gap-2 rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)] ${className}`}>
        <AlertIcon className="mt-0.5 size-4" />
        <span className="min-w-0 whitespace-pre-line"><PlainText text={note.text} /></span>
      </p>
    );
  }
  return (
    <p role="status" className={`flex items-start gap-2 text-sm text-[var(--ct-mute)] ${className}`}>
      <CheckIcon className="mt-0.5 size-4" />
      <span className="min-w-0 whitespace-pre-line"><PlainText text={note.text} /></span>
    </p>
  );
}

const fieldSizing = () => typeof CSS !== "undefined" && CSS.supports?.("field-sizing", "content");

/**
 * A textarea as tall as its words, so on a phone the page scrolls, not a box inside it.
 * `field-sizing: content` does it where the browser knows it; elsewhere (Firefox, iOS Safari)
 * the height is set from the words — after each change, whenever the box's width changes (a
 * phone turned on its side re-wraps the Thai), and once the web font has arrived (its lines
 * are taller than the fallback's). On a desk it stops at 60% of the screen and scrolls inside.
 * It may scroll anywhere, in case a measure is ever stale: a cut-off line that cannot be
 * reached is worse than a scrollbar.
 */
export function AutoTextarea({ minRows = 2, className = "", style, value, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement> & { minRows?: number; value: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el || fieldSizing()) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, []);

  useLayoutEffect(fit, [value, fit]);

  useEffect(() => {
    const el = ref.current;
    if (!el || fieldSizing()) return;
    let live = true;
    // the font's own lines, once it is in
    document.fonts?.ready.then(() => { if (live) fit(); }).catch(() => {});
    if (typeof ResizeObserver === "undefined") return () => { live = false; };
    // a new width re-wraps the words; the height this sets is not a reason to measure again
    let width = el.getBoundingClientRect().width;
    const watch = new ResizeObserver(([entry]) => {
      const next = entry.contentRect.width;
      if (Math.abs(next - width) < 0.5) return;
      width = next;
      fit();
    });
    watch.observe(el);
    return () => { live = false; watch.disconnect(); };
  }, [fit]);

  return (
    <textarea
      ref={ref}
      value={value}
      rows={minRows}
      className={`resize-none overflow-y-auto [field-sizing:content] lg:max-h-[60vh] ${className}`}
      style={{ minHeight: `calc(${minRows} * 1.625em + 1rem)`, ...style }}
      {...rest}
    />
  );
}
