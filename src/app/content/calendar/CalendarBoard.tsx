"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useOptimistic, useRef, useState, useTransition } from "react";
import {
  canDrag, canDropOnDay, dropRejection, groupByDay, repeats, thaiDayLabel, unscheduled,
  DROP_TIME, type BoardItem, type MonthCell,
} from "@/lib/content/calendar";
import { postLink } from "@/lib/facebook/publish";
import { cancelScheduled, scheduleAt, scheduleOnDay, type PublishResult, type PublishSetup } from "../publish";
import { ask } from "../ask";

/**
 * The month board, ported from the owner's Maryjane project (calendar-board.tsx, post-card.tsx,
 * day-sheet.tsx) with its drag handling and its reasons kept: a press-and-hold on touch so a
 * drag does not steal the page's scroll, the page scrolling at the screen's edge, and the
 * click a browser fires after a drop swallowed so the sheet does not open by itself.
 *
 * What differs is what a drop does. Maryjane queues the post for its own cron; here Facebook
 * holds the schedule, so a drop sends the post, through the piece's checks, and
 * waits for Facebook's answer before the card stays where it was put.
 */

const TOUCH_HOLD_MS = 250;
const TOUCH_CANCEL_PX = 10;
const MOUSE_START_PX = 4;
const EDGE_PX = 72;
const EDGE_STEP_PX = 16;
const CLICK_AFTER_DRAG_MS = 300;
const WEEKDAYS = ["จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส.", "อา."];
/** the Page last posted to, shared with the editor's ลงเพจ box */
const PAGE_KEY = "content-page";

const STATUS_LABEL: Record<BoardItem["status"], string> = {
  waiting: "ยังไม่ตั้งเวลา",
  scheduled: "ตั้งเวลาแล้ว",
  posting: "กำลังส่ง",
  published: "ลงเพจแล้ว",
  failed: "โพสต์ไม่สำเร็จ",
};

type Sheet = { kind: "day"; day: string } | { kind: "item"; id: string };

interface DragSession {
  item: BoardItem;
  x0: number;
  y0: number;
  touch: boolean;
  active: boolean;
  hold: number | null;
  detach: () => void;
}

/** runs an action, and asks for the confirmation it needs before trying again */
type Run = (act: (confirmNumbers: boolean) => Promise<PublishResult>) => Promise<boolean>;

export function CalendarBoard({ cells, items, today, setup, defaultPage }: {
  cells: MonthCell[];
  items: BoardItem[];
  today: string;
  setup: PublishSetup;
  defaultPage: string;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [, startTransition] = useTransition();
  const [pageId, setPageId] = useState("");
  const usable = setup.pages.filter((p) => p.canPost);

  // the Page chip at the top leads, then the last Page posted to — but only a Page that can
  // post; the chip changes without remounting the board, so this runs again on each one
  useEffect(() => {
    let kept = "";
    try { kept = localStorage.getItem(PAGE_KEY) ?? ""; } catch { /* storage unavailable */ }
    const pick = [defaultPage, kept].find((id) => id && usable.some((p) => p.pageId === id));
    setPageId(pick ?? usable[0]?.pageId ?? "");
    // the Pages do not change while the board is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultPage]);

  const choosePage = (id: string) => {
    setPageId(id);
    try { localStorage.setItem(PAGE_KEY, id); } catch { /* not kept */ }
  };

  // a card moves the moment it is dropped; if Facebook refuses, it goes back when the
  // transition ends and the reason is shown
  const [board, applyMove] = useOptimistic(items, (state: BoardItem[], moved: { id: string; day: string }) =>
    state.map((it) => (it.id === moved.id ? { ...it, day: moved.day, status: "scheduled" as const } : it)));

  const [drag, setDrag] = useState<{ item: BoardItem; x: number; y: number; over: string | null } | null>(null);
  const session = useRef<DragSession | null>(null);
  const scroller = useRef<{ id: number; dir: -1 | 1 } | null>(null);
  const lastDragEnd = useRef(Number.NEGATIVE_INFINITY);

  const byDay = groupByDay(board);
  const waiting = unscheduled(board);
  const repeated = repeats(board);

  const run: Run = async (act) => {
    let res = await act(false).catch(() => ({ ok: false, error: "การเชื่อมต่อหลุด ลองเช็กในเพจก่อนกดใหม่" }) as PublishResult);
    if (!res.ok && res.confirmNumbers) {
      if (!(await ask(`มีตัวเลขที่ไม่ตรงกับตารางเบี้ย: ${res.confirmNumbers.join(", ")}\n\nตรวจแล้วว่าถูกต้อง และยังจะตั้งเวลาไหม?`, "ตั้งเวลาต่อ"))) return false;
      res = await act(true).catch(() => ({ ok: false, error: "การเชื่อมต่อหลุด" }) as PublishResult);
    }
    if (res.ok) { setError(null); router.refresh(); return true; }
    setError(res.error);
    return false;
  };

  function stopEdgeScroll() {
    if (!scroller.current) return;
    clearInterval(scroller.current.id);
    scroller.current = null;
  }

  function edgeScroll(y: number) {
    const dir: -1 | 0 | 1 = y < EDGE_PX ? -1 : y > window.innerHeight - EDGE_PX ? 1 : 0;
    if (dir === 0) return stopEdgeScroll();
    if (scroller.current?.dir === dir) return;
    stopEdgeScroll();
    scroller.current = { dir, id: window.setInterval(() => window.scrollBy(0, dir * EDGE_STEP_PX), 16) };
  }

  /** the day cell under the finger, read from the DOM: the page may have scrolled mid-drag */
  function dayUnder(x: number, y: number): string | null {
    const el = document.elementFromPoint(x, y);
    const cell = el instanceof Element ? el.closest("[data-day]") : null;
    return cell instanceof HTMLElement ? (cell.dataset.day ?? null) : null;
  }

  function endSession() {
    const s = session.current;
    if (!s) return;
    if (s.hold != null) clearTimeout(s.hold);
    s.detach();
    session.current = null;
    stopEdgeScroll();
    setDrag(null);
  }

  function activate(x: number, y: number) {
    const s = session.current;
    if (!s || s.active) return;
    s.active = true;
    setDrag({ item: s.item, x, y, over: dayUnder(x, y) });
  }

  function tryMove(item: BoardItem, day: string) {
    if (!canDropOnDay(item, day, today)) {
      const reason = dropRejection(item, day, today);
      if (reason) setError(reason);
      return;
    }
    if (item.status !== "scheduled" && usable.length === 0) { setError("ยังตั้งเวลาไม่ได้ — ยังไม่มีเพจไหนเปิดสิทธิ์โพสต์ (ดูกล่องสีเหลืองด้านบน)"); return; }
    if (item.status !== "scheduled" && !pageId) { setError("เลือกเพจที่จะลงก่อน (ช่อง ลงเพจ เหนือแถบรอตั้งเวลา)"); return; }
    setError(null);
    startTransition(async () => {
      applyMove({ id: item.id, day });
      await run((confirmNumbers) => scheduleOnDay({ id: item.id, day, pageId, confirmNumbers }));
    });
  }

  function beginPress(e: React.PointerEvent, item: BoardItem) {
    if (!canDrag(item)) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest("[data-no-drag]")) return;
    endSession();

    const touch = e.pointerType !== "mouse";
    const startX = e.clientX;
    const startY = e.clientY;

    const onMove = (ev: PointerEvent) => {
      const s = session.current;
      if (!s) return;
      if (!s.active) {
        const dist = Math.hypot(ev.clientX - s.x0, ev.clientY - s.y0);
        if (s.touch) {
          if (dist > TOUCH_CANCEL_PX) endSession();
          return;
        }
        if (dist < MOUSE_START_PX) return;
        activate(ev.clientX, ev.clientY);
      }
      edgeScroll(ev.clientY);
      setDrag({ item: s.item, x: ev.clientX, y: ev.clientY, over: dayUnder(ev.clientX, ev.clientY) });
    };
    const onUp = (ev: PointerEvent) => {
      const s = session.current;
      const dropped = s?.active ? { item: s.item, day: dayUnder(ev.clientX, ev.clientY) } : null;
      endSession();
      if (dropped) {
        lastDragEnd.current = ev.timeStamp;
        if (dropped.day) tryMove(dropped.item, dropped.day);
      }
    };
    // the browser or OS gave up the gesture: clear it, and never read it as a drop
    const onCancel = (ev: PointerEvent) => {
      const wasActive = session.current?.active === true;
      endSession();
      if (wasActive) lastDragEnd.current = ev.timeStamp;
    };
    // passive: false, or a touch drag scrolls the page under the finger
    const blockScroll = (ev: TouchEvent) => {
      if (session.current?.active) ev.preventDefault();
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", onCancel);
    document.addEventListener("touchmove", blockScroll, { passive: false });
    session.current = {
      item, x0: startX, y0: startY, touch, active: false, hold: null,
      detach: () => {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onCancel);
        document.removeEventListener("touchmove", blockScroll);
      },
    };
    if (touch) session.current.hold = window.setTimeout(() => activate(startX, startY), TOUCH_HOLD_MS);
  }

  function openSheet(next: Sheet, at: number) {
    if (at - lastDragEnd.current < CLICK_AFTER_DRAG_MS) return;
    setSheet(next);
  }

  const sheetItems = !sheet ? [] : sheet.kind === "day" ? (byDay.get(sheet.day) ?? []) : board.filter((i) => i.id === sheet.id);
  const sheetTitle = !sheet ? "" : sheet.kind === "day" ? thaiDayLabel(sheet.day) : "รอตั้งเวลา";

  return (
    <div className="space-y-4">
      {error && (
        <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] p-3 text-sm text-[var(--ct-alert)]">{error}</p>
      )}
      {usable.length === 0 && (
        <p className="rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
          ยังไม่มีเพจที่เปิดสิทธิ์โพสต์ — เพิ่ม pages_manage_posts ในแอป Facebook แล้วเชื่อมเพจใหม่ที่ <a href="/admin/messenger" className="underline">/admin/messenger</a>
        </p>
      )}

      <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
        <div className="min-w-0 flex-1">
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-hair)]">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-[var(--ct-panel)] py-2 text-center text-xs text-[var(--ct-mute)]">{d}</div>
            ))}
            {cells.map((cell) => {
              const dayItems = byDay.get(cell.day) ?? [];
              const compact = dayItems.length > 1;
              const isToday = cell.day === today;
              const isPast = cell.day < today;
              const isTarget = drag?.over === cell.day;
              const accepts = drag ? canDropOnDay(drag.item, cell.day, today) : false;
              return (
                <div
                  key={cell.day}
                  data-day={cell.day}
                  onClick={(e) => { if (dayItems.length > 0) openSheet({ kind: "day", day: cell.day }, e.timeStamp); }}
                  className={`min-h-24 p-1 transition-colors sm:p-2 lg:min-h-36 ${isTarget && accepts ? "bg-[var(--ct-soft)]" : "bg-[var(--ct-panel)]"} ${cell.inMonth ? "" : "opacity-50"} ${drag && !accepts ? "opacity-40" : ""}`}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span className={`flex size-6 items-center justify-center rounded-full text-xs ${isToday ? "bg-[var(--ct-solid)] font-medium text-[var(--ct-solid-ink)]" : isPast ? "text-[var(--ct-mute)]" : ""}`}>
                      {Number(cell.day.slice(-2))}
                    </span>
                    {compact && <span className="hidden text-[10px] text-[var(--ct-mute)] sm:inline">{dayItems.length} โพสต์</span>}
                  </div>
                  <div className={`mt-1 ${compact ? "grid grid-cols-2 gap-1" : "space-y-1"}`}>
                    {dayItems.map((item) => (
                      <PostCard
                        key={item.id} item={item} compact={compact} repeated={repeated.has(item.id)}
                        dragging={drag?.item.id === item.id}
                        onPointerDown={(e) => beginPress(e, item)}
                        onOpen={(at) => openSheet({ kind: "day", day: cell.day }, at)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <aside className="shrink-0 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:w-60 xl:overflow-y-auto">
          <p className="text-sm font-medium">รอตั้งเวลา · {waiting.length}</p>
          <p className="mt-1 text-xs text-[var(--ct-mute)]">ลากลงวันที่ต้องการ = ตั้งเวลา {DROP_TIME} (บนมือถือกดค้างแล้วลาก)</p>
          {usable.length > 0 && (
            <label className="mt-2 block">
              <span className="mb-1 block text-xs text-[var(--ct-mute)]">ลงเพจ</span>
              <select value={pageId} onChange={(e) => choosePage(e.target.value)} className="w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-2 py-1.5 text-sm">
                {usable.map((p) => <option key={p.pageId} value={p.pageId}>{p.pageName}</option>)}
              </select>
            </label>
          )}
          {waiting.length === 0 ? (
            <p className="mt-3 text-xs text-[var(--ct-mute)]">ยังไม่มีโพสต์ที่รอลงเพจ — สร้างที่หน้า <Link href="/content" className="underline">สร้างคอนเทนต์</Link></p>
          ) : (
            <div className="mt-3 grid grid-cols-3 gap-2 xl:grid-cols-1">
              {waiting.map((item) => (
                <PostCard
                  key={item.id} item={item} compact={false} repeated={false}
                  dragging={drag?.item.id === item.id}
                  onPointerDown={(e) => beginPress(e, item)}
                  onOpen={(at) => openSheet({ kind: "item", id: item.id }, at)}
                />
              ))}
            </div>
          )}
        </aside>
      </div>

      {/* the card under the finger; pointer-events none so it never hides the day beneath */}
      {drag && (
        <div aria-hidden className="pointer-events-none fixed z-50 w-28 -translate-x-1/2 -translate-y-1/2 rotate-2 opacity-90 shadow-lg" style={{ left: drag.x, top: drag.y }}>
          <PostCard item={drag.item} compact repeated={false} dragging={false} onPointerDown={() => {}} onOpen={() => {}} />
        </div>
      )}

      {sheet && (
        <DaySheet
          title={sheetTitle} items={sheetItems} today={today} pages={usable} pageId={pageId} onPage={choosePage}
          run={run} onClose={() => setSheet(null)}
        />
      )}

    </div>
  );
}

function PostCard({ item, compact, repeated, dragging, onPointerDown, onOpen }: {
  item: BoardItem;
  compact: boolean;
  repeated: boolean;
  dragging: boolean;
  onPointerDown: (e: React.PointerEvent) => void;
  onOpen: (at: number) => void;
}) {
  const movable = canDrag(item) && !item.blocked;
  const tag = "rounded bg-[var(--ct-solid)] px-1 py-px text-[9px] text-[var(--ct-solid-ink)]";
  return (
    <div
      role="button" tabIndex={0} aria-label={`${item.time} ${item.hook}`}
      onPointerDown={onPointerDown}
      // the day cell has an onClick too; without this the sheet would open twice
      onClick={(e) => { e.stopPropagation(); onOpen(e.timeStamp); }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onOpen(e.timeStamp); } }}
      // iOS and Android's long-press menu would sit on top of a press-and-hold drag
      onContextMenu={(e) => movable && e.preventDefault()}
      className={`relative select-none overflow-hidden rounded-md border ${repeated ? "border-[var(--ct-warn-line)]" : "border-[var(--ct-hair)]"} bg-[var(--ct-ground)] outline-none ${movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} ${dragging ? "opacity-30" : ""}`}
      style={{ WebkitTouchCallout: "none" }}
    >
      <div className="relative aspect-square w-full">
        {/* eslint-disable-next-line @next/next/no-img-element -- the piece's own poster, drawn by the poster route */}
        <img src={item.imageUrl} alt="" draggable={false} loading="lazy" className="h-full w-full object-cover" />
        {item.pageName && <span className={`absolute left-1 top-1 max-w-[calc(100%-0.5rem)] truncate ${tag}`}>{item.pageName}</span>}
        {item.day && <span className={`absolute bottom-1 left-1 font-medium ${tag}`}>{item.time}</span>}
        <span className="absolute bottom-1 right-1 text-xs" title={STATUS_LABEL[item.status]}>
          {item.status === "published" ? "✓" : item.status === "failed" ? "⚠" : item.status === "posting" ? "…" : item.status === "scheduled" ? "⏰" : ""}
        </span>
      </div>
      {!compact && (
        <div className="hidden p-1.5 lg:block">
          <p className="line-clamp-2 text-[11px] font-medium leading-snug">{item.hook}</p>
          <p className="line-clamp-1 text-[10px] text-[var(--ct-mute)]">{item.planName}{item.unreviewed ? " · ยังไม่ได้ตรวจ" : ""}</p>
          {repeated && <p className="text-[10px] text-[var(--ct-warn-ink)]">แบบเดียวกับโพสต์ก่อนหน้า</p>}
        </div>
      )}
    </div>
  );
}

/** a sheet from the bottom on a phone, a dialog in the middle on a desk — the card is too small to press buttons on */
function DaySheet({ title, items, today, pages, pageId, onPage, run, onClose }: {
  title: string;
  items: BoardItem[];
  today: string;
  pages: PublishSetup["pages"];
  pageId: string;
  onPage: (id: string) => void;
  run: Run;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ct-ink)]/60 sm:items-center" onClick={onClose}>
      <div
        role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}
        className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 sm:rounded-xl"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="ปิด" className="flex size-9 items-center justify-center rounded border border-[var(--ct-line)]">✕</button>
        </div>
        {items.length === 0 ? (
          <p className="text-sm text-[var(--ct-mute)]">วันนี้ยังไม่มีโพสต์</p>
        ) : (
          <ul className="space-y-4">
            {items.map((item) => <SheetItem key={item.id} item={item} today={today} pages={pages} pageId={pageId} onPage={onPage} run={run} onDone={onClose} />)}
          </ul>
        )}
      </div>
    </div>
  );
}

function SheetItem({ item, today, pages, pageId, onPage, run, onDone }: {
  item: BoardItem;
  today: string;
  pages: PublishSetup["pages"];
  pageId: string;
  onPage: (id: string) => void;
  run: Run;
  onDone: () => void;
}) {
  const [local, setLocal] = useState(`${item.day ?? today}T${item.time}`);
  const [busy, setBusy] = useState(false);
  const act = async (fn: Parameters<Run>[0]) => {
    setBusy(true);
    const ok = await run(fn);
    setBusy(false);
    if (ok) onDone();
  };
  const btn = "rounded-lg border border-[var(--ct-line)] px-3 py-2 text-sm disabled:opacity-50";

  return (
    <li className="rounded-lg border border-[var(--ct-hair)] p-3">
      {/* the poster carries words, so it is shown whole rather than cropped beside the text */}
      <a href={item.imageUrl} target="_blank" rel="noopener noreferrer" title="เปิดรูปขนาดเต็ม" className="block overflow-hidden rounded-lg bg-[var(--ct-ground)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- the piece's own poster */}
        <img src={item.imageUrl} alt="" className="mx-auto max-h-[50vh] w-full object-contain" />
      </a>
      <div className="mt-3 space-y-1">
        <p className="text-xs text-[var(--ct-mute)]">
          {item.planName}{item.pageName ? ` · ${item.pageName}` : ""} · {STATUS_LABEL[item.status]}{item.unreviewed ? " · ยังไม่ได้ตรวจ" : ""}
        </p>
        <p className="text-sm font-medium">{item.hook}</p>
        <p className="line-clamp-6 whitespace-pre-wrap text-xs text-[var(--ct-mute)]">{item.body}</p>
        {item.blocked && <p className="text-xs text-[var(--ct-alert)]">ผิดกฎโฆษณาของ Facebook: {item.blocked} — เปิดแก้ไขก่อน</p>}
      </div>

      <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-[var(--ct-hair)] pt-3">
        {item.status === "published" ? (
          <p className="text-sm">
            ขึ้นเพจแล้ว
            {item.postId && <> · <a href={postLink(item.postId)} target="_blank" rel="noopener noreferrer" className="text-[var(--ct-accent)] underline">เปิดโพสต์บน Facebook</a></>}
          </p>
        ) : item.status === "posting" ? (
          <p className="text-sm text-[var(--ct-mute)]">กำลังส่งไปเพจ — โหลดหน้านี้ใหม่อีกครั้งในอีกสักครู่</p>
        ) : !item.blocked && (
          <>
            {item.status !== "scheduled" && pages.length > 0 && (
              <label className="block">
                <span className="mb-1 block text-xs text-[var(--ct-mute)]">ลงเพจ</span>
                <select value={pageId} onChange={(e) => onPage(e.target.value)} className="rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] p-2 text-sm">
                  {pages.map((p) => <option key={p.pageId} value={p.pageId}>{p.pageName}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <span className="mb-1 block text-xs text-[var(--ct-mute)]">วันและเวลาโพสต์ (เวลาไทย)</span>
              <input type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} className="rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] p-2 text-sm" />
            </label>
            <button
              type="button" disabled={busy || (item.status !== "scheduled" && !pageId)}
              onClick={() => act((confirmNumbers) => scheduleAt({ id: item.id, local, pageId, confirmNumbers }))}
              className="rounded-lg bg-[var(--ct-solid)] px-3 py-2 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50"
            >
              {busy ? "กำลังส่ง…" : item.status === "scheduled" ? "ย้ายเวลา" : "ตั้งเวลา"}
            </button>
            {item.status === "scheduled" && (
              <button
                type="button" disabled={busy}
                onClick={async () => { if (await ask("เอาโพสต์นี้ออกจากคิว?", "เอาออก")) void act(() => cancelScheduled(item.id)); }}
                className={`${btn} text-[var(--ct-alert)]`}
              >
                เอาออกจากคิว
              </button>
            )}
          </>
        )}
        <Link href={`/content?open=${item.id}`} className={`${btn} ml-auto`}>เปิดแก้ไข</Link>
      </div>
      {item.status === "failed" && (
        <p className="mt-2 text-xs text-[var(--ct-warn-ink)]">ครั้งก่อนส่งไม่สำเร็จ — เปิดเพจเช็กก่อนว่าโพสต์ขึ้นไปแล้วหรือยัง ก่อนตั้งเวลาใหม่</p>
      )}
    </li>
  );
}

/** the month as a list by day — easier to read through than the grid; moving days is the grid's */
export function MonthList({ items }: { items: BoardItem[] }) {
  const byDay = groupByDay(items);
  const days = [...byDay.keys()].sort();
  if (days.length === 0) {
    return <p className="rounded-xl border border-dashed border-[var(--ct-line)] px-4 py-10 text-center text-sm text-[var(--ct-mute)]">เดือนนี้ยังไม่มีโพสต์ที่ลงเพจหรือตั้งเวลาไว้</p>;
  }
  return (
    <ul className="space-y-5">
      {days.map((day) => (
        <li key={day}>
          <p className="mb-2 text-xs text-[var(--ct-mute)]">{thaiDayLabel(day)}</p>
          <ul className="space-y-2">
            {(byDay.get(day) ?? []).map((item) => (
              <li key={item.id}>
                <Link href={`/content?open=${item.id}`} className="flex gap-3 rounded-lg border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-3 hover:bg-[var(--ct-soft)]">
                  {/* eslint-disable-next-line @next/next/no-img-element -- the piece's own poster */}
                  <img src={item.imageUrl} alt="" loading="lazy" className="size-16 shrink-0 rounded object-cover" />
                  <span className="min-w-0">
                    <span className="block text-xs text-[var(--ct-accent)]">{item.time} · {item.pageName} · {STATUS_LABEL[item.status]}</span>
                    <span className="block truncate text-sm font-medium">{item.hook}</span>
                    <span className="line-clamp-2 text-xs text-[var(--ct-mute)]">{item.body}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}
