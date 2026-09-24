"use client";
import { useEffect, useState } from "react";
import { postLink } from "@/lib/facebook/publish";
import { publishView, quickTimes, thaiWhen } from "@/lib/content/publish-label";
import type { ContentItem } from "@/lib/content/store";
import { cancelScheduled, publishPiece, publishSetup, unlockPublishing, type PublishResult, type PublishSetup } from "./publish";

/**
 * The editor's ลงเพจ box: pick the Page and the time, and send — or see where it went.
 *
 * Posting now asks once more, because it is public the moment it lands; a schedule does not,
 * because it can be taken back until its time. Unsaved edits are saved first, so what goes up
 * is what is on screen.
 */

/** the Page last posted to, kept in this browser */
const PAGE_KEY = "content-page";
const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

interface Props {
  item: ContentItem;
  /** which opening line goes up, for older pieces that carry three */
  hook: number;
  /** saves the editor's unsaved words; false when that failed */
  beforePublish: () => Promise<boolean>;
  onPublished: (item: ContentItem) => void;
}

/** a datetime-local value for a Date, in the browser's time */
const localInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

export function PublishPanel({ item, hook, beforePublish, onPublished }: Props) {
  const [setup, setSetup] = useState<PublishSetup | null>(null);
  const [pageId, setPageId] = useState("");
  const [when, setWhen] = useState("now");
  const [custom, setCustom] = useState("");
  const [pin, setPin] = useState("");
  const [askPin, setAskPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();

  useEffect(() => {
    let live = true;
    publishSetup().then((s) => {
      if (!live) return;
      setSetup(s);
      if (s.pinSet && !s.unlocked) setAskPin(true);
      let kept = "";
      try { kept = localStorage.getItem(PAGE_KEY) ?? ""; } catch { /* storage unavailable */ }
      const usable = s.pages.filter((p) => p.canPost);
      setPageId(usable.find((p) => p.pageId === kept)?.pageId ?? usable[0]?.pageId ?? s.pages[0]?.pageId ?? "");
    }).catch(() => { if (live) setSetup({ pinSet: false, unlocked: false, pages: [] }); });
    return () => { live = false; };
  }, []);

  const view = publishView(item.publish);
  const pageName = (id: string | null | undefined) => setup?.pages.find((p) => p.pageId === id)?.pageName ?? "เพจ";
  const blocked = (item.flags.policy ?? []).filter((f) => f.severity === "block");
  const times = quickTimes();

  function chosenTime(): string | null | undefined {
    if (when === "now") return null;
    if (when === "custom") return custom ? new Date(custom).toISOString() : undefined;
    return times.find((t) => t.label === when)?.at.toISOString();
  }

  async function send(confirmNumbers = false) {
    const at = chosenTime();
    if (at === undefined) { setNote("เลือกวันเวลาก่อนนะครับ"); return; }
    if (at === null && !confirmNumbers && !window.confirm(`โพสต์ลงเพจ ${pageName(pageId)} ตอนนี้เลย?`)) return;
    setBusy(true);
    setNote(undefined);
    try {
      if (!(await beforePublish())) { setNote("บันทึกการแก้ไขไม่สำเร็จ เลยยังไม่ได้โพสต์"); return; }
      try { localStorage.setItem(PAGE_KEY, pageId); } catch { /* not kept */ }
      const res: PublishResult = await publishPiece({ id: item.id, pageId, at, hook, confirmNumbers });
      if (res.ok) { onPublished(res.item); return; }
      if (res.needPin) { setAskPin(true); setNote(res.error); return; }
      if (res.confirmNumbers) {
        const go = window.confirm(`มีตัวเลขที่ไม่ตรงกับตารางเบี้ย: ${res.confirmNumbers.join(", ")}\n\nตรวจแล้วว่าถูกต้อง และยังจะโพสต์ไหม?`);
        if (go) { setBusy(false); await send(true); }
        return;
      }
      setNote(res.error);
    } catch {
      setNote("การเชื่อมต่อหลุด ลองเช็กในเพจก่อนกดใหม่นะครับ");
    } finally {
      setBusy(false);
    }
  }

  async function unlock() {
    setBusy(true);
    const res = await unlockPublishing(pin).catch(() => ({ ok: false, error: "การเชื่อมต่อหลุด" }));
    setBusy(false);
    if (!res.ok) { setNote(res.error); return; }
    setAskPin(false);
    setPin("");
    setSetup((s) => (s ? { ...s, unlocked: true } : s));
    setNote("ปลดล็อกแล้ว — กดโพสต์อีกครั้งได้เลย");
  }

  async function cancel() {
    if (!window.confirm("ยกเลิกโพสต์ที่ตั้งเวลาไว้?")) return;
    setBusy(true);
    const res = await cancelScheduled(item.id).catch(() => null);
    setBusy(false);
    if (!res) { setNote("ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"); return; }
    if (res.ok) { onPublished(res.item); setNote("ยกเลิกแล้ว ตั้งเวลาใหม่ได้"); return; }
    if (res.needPin) setAskPin(true);
    setNote(res.error);
  }

  const pinBox = askPin && (
    <div className="mt-2 flex gap-2">
      <input
        value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))} inputMode="numeric" maxLength={8}
        placeholder="PIN สำหรับโพสต์" aria-label="PIN สำหรับโพสต์" className={`${field} max-w-40`}
        onKeyDown={(e) => { if (e.key === "Enter" && pin) void unlock(); }}
      />
      <button type="button" disabled={busy || pin.length < 4} onClick={unlock} className="rounded-lg border border-[var(--ct-line)] px-3 py-2 text-sm disabled:opacity-50">ปลดล็อก</button>
    </div>
  );

  let body: React.ReactNode;
  if (!setup) {
    body = <p className="text-sm text-[var(--ct-mute)]">กำลังโหลด…</p>;
  } else if (view.kind === "posting") {
    body = <p className="text-sm text-[var(--ct-mute)]">กำลังส่งไปเพจ…</p>;
  } else if (view.kind === "scheduled") {
    body = (
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm">⏰ ตั้งเวลาไว้ <b>{thaiWhen(view.at)}</b> ที่ {pageName(item.publish?.pageId)}</p>
        <button type="button" disabled={busy} onClick={cancel} className="rounded-lg border border-[var(--ct-line)] px-3 py-1.5 text-sm text-[var(--ct-alert)] disabled:opacity-50">ยกเลิกการตั้งเวลา</button>
      </div>
    );
  } else if (view.kind === "published") {
    body = (
      <p className="text-sm">
        ✓ ลง {pageName(item.publish?.pageId)} แล้ว{view.at ? ` ${thaiWhen(view.at)}` : ""}
        {item.publish?.postId && <> · <a href={postLink(item.publish.postId)} target="_blank" rel="noreferrer" className="text-[var(--ct-accent)] underline">ดูโพสต์</a></>}
      </p>
    );
  } else if (!setup.pinSet) {
    body = <p className="text-sm text-[var(--ct-mute)]">ยังไม่ได้ตั้ง PIN สำหรับโพสต์ — ตั้ง CONTENT_PUBLISH_PIN ในระบบก่อน</p>;
  } else if (!setup.pages.some((p) => p.canPost)) {
    body = (
      <p className="text-sm text-[var(--ct-mute)]">
        ยังไม่มีเพจที่เปิดสิทธิ์โพสต์ — เพิ่ม pages_manage_posts ในแอป Facebook แล้วเชื่อมเพจใหม่ที่ <a href="/admin/messenger" className="underline">/admin/messenger</a>
      </p>
    );
  } else {
    body = (
      <div className="space-y-2">
        {view.kind === "failed" && <p className="text-sm text-[var(--ct-alert)]">ครั้งก่อนไม่สำเร็จ: {view.error}</p>}
        {blocked.length > 0 && <p className="text-sm text-[var(--ct-alert)]">ยังผิดกฎโฆษณาของ Facebook ({blocked[0].message}) — แก้แล้วกดบันทึกก่อน จึงจะโพสต์ได้</p>}
        <div className="grid gap-2 sm:grid-cols-2">
          <select value={pageId} onChange={(e) => setPageId(e.target.value)} aria-label="เพจที่จะโพสต์" className={field}>
            {setup.pages.map((p) => (
              <option key={p.pageId} value={p.pageId} disabled={!p.canPost}>{p.pageName}{p.canPost ? "" : " (ยังไม่เปิดสิทธิ์โพสต์)"}</option>
            ))}
          </select>
          <select value={when} onChange={(e) => setWhen(e.target.value)} aria-label="เวลาโพสต์" className={field}>
            <option value="now">โพสต์ตอนนี้</option>
            {times.map((t) => <option key={t.label} value={t.label}>ตั้งเวลา · {t.label}</option>)}
            <option value="custom">ตั้งเวลา · เลือกวันเวลาเอง…</option>
          </select>
        </div>
        {when === "custom" && (
          <input
            type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)}
            min={localInput(new Date(Date.now() + 15 * 60_000))} max={localInput(new Date(Date.now() + 30 * 24 * 60 * 60_000))}
            aria-label="วันเวลาที่จะโพสต์" className={field}
          />
        )}
        <button
          type="button" disabled={busy || blocked.length > 0 || !pageId} onClick={() => send()}
          className="rounded-lg bg-[var(--ct-solid)] px-4 py-2 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50"
        >
          {busy ? "กำลังส่ง…" : when === "now" ? "โพสต์ลงเพจเลย" : "ตั้งเวลาโพสต์"}
        </button>
        <p className="text-xs text-[var(--ct-mute)]">ส่งรูปโปสเตอร์ 1:1 พร้อมข้อความเต็ม (รวมข้อความเตือนและชื่อบริษัท) · ตั้งเวลาได้ 15 นาที–30 วันข้างหน้า</p>
      </div>
    );
  }

  return (
    <section className="mt-4 rounded-lg border border-[var(--ct-line)] p-3">
      <p className="mb-2 text-sm font-medium">ลงเพจ</p>
      {body}
      {pinBox}
      {note && <p role="status" className="mt-2 text-sm text-[var(--ct-mute)]">{note}</p>}
    </section>
  );
}
