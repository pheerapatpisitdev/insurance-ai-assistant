"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { HOOK_CATEGORY_LABEL, type HookTemplate } from "@/lib/content/hooks";
import { footer, fullText } from "@/lib/content/output";
import type { PiecePerson } from "@/lib/content/people";
import { defaultPoster, posterUrl, THEMES } from "@/lib/content/poster";
import { MAX_PIECES } from "@/lib/content/plan";
import { onPage } from "@/lib/content/publish-label";
import { anglesFor, FORMAT_LABEL, FORMAT_SHORT, GOALS, MAX_FACT, MAX_READER, NICHES, type AngleId, type Format, type GoalId, type Length } from "@/lib/content/prompt";
import { MAX_ANGLES, MAX_TONES } from "@/lib/content/ads";
import { AUTO, AUTO_FLOOR_THB, DEFAULT_PAINTER, DEFAULT_WRITER, OVERHEAD_THB, PAINTERS, WRITERS, painterOf, writerOf } from "@/lib/content/models";
import type { ContentItem, ContentStatus } from "@/lib/content/store";
import { contentSpend, contentWorkbench, removeContent, setContentStatus, type DrawBackgroundResult, type GenerateResult } from "./actions";
import { drawPicture, generateRound } from "./draw";
import { PersonPicker, type PersonOption } from "./PersonPicker";
import { AUTO_THEME, ThemeSwatches, type ThemeChoice } from "./ThemeSwatches";
import { ask } from "./ask";
import { PieceCard, PieceSkeleton } from "./PieceCard";
import { PieceEditor } from "./PieceEditor";
import { ScriptCard } from "./ScriptCard";

/**
 * The content workbench, laid out as the owner's Maryjane project lays out its run page:
 * the tools on the left, the pieces in the middle, the pieces actually used on the right.
 *
 * On a phone the three stack — tools first, because on this page nothing exists until the
 * tools are used; then the pieces; then the used list. After a round is written the page
 * scrolls to the pieces, so the long form is not what the owner has to scroll back past.
 *
 * A piece is รอตรวจ or ใช้จริง. Maryjane's workbench has a bin as well; the owner did not want
 * one, so ลบ deletes, after one confirmation. Marking a piece ใช้จริง also teaches the formula
 * library its hook.
 */

interface Props {
  products: { href: string; name: string }[];
  lengths: { id: Length; label: string }[];
  hooks: HookTemplate[];
  initialHook: string | null;
  initial: { items: ContentItem[]; counts: Record<ContentStatus, number> };
  initialUsed: ContentItem[];
  spend: { spent: number; cap: number };
  /** a piece to open in the editor on arrival, from the calendar's เปิดแก้ไข */
  initialOpen?: ContentItem | null;
  /** the people library, for ใส่บุคคลในภาพ */
  people: PersonOption[];
}

const FORMATS: Format[] = ["post", "script", "ad"];

const TABS: { id: ContentStatus; label: string }[] = [
  { id: "draft", label: "รอตรวจ" },
  { id: "used", label: "ใช้จริง" },
];

/** the models last picked, kept in this browser; a private window simply starts on the defaults */
const PICK_KEY = "content-models";
/** the reader last named: a page usually speaks to one niche, so it is kept for the next visit */
const READER_KEY = "content-reader";
/** the round's person and pose, kept per device like the reader */
const PERSON_KEY = "content-person";
/** the round's poster colour, kept per device like the reader */
const THEME_KEY = "content-poster-theme";
/** the owner's own direction for the round's pictures, kept per device like the reader */
const BRIEF_KEY = "content-picture-brief";
/** what drawBackground translates and keeps of a request */
const MAX_BRIEF = 300;

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)] hover:bg-[var(--ct-soft)]"}`;

const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

export function ContentStudio({ products, lengths, hooks, initialHook, initial, initialUsed, spend: initialSpend, initialOpen, people }: Props) {
  const [href, setHref] = useState(products[0]?.href ?? "");
  const [format, setFormat] = useState<Format>("post");
  const [writer, setWriter] = useState(DEFAULT_WRITER);
  const [painter, setPainter] = useState(DEFAULT_PAINTER);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PICK_KEY) ?? "{}") as { writer?: string; painter?: string };
      if (saved.writer === AUTO || WRITERS.some((w) => w.id === saved.writer)) setWriter(saved.writer!);
      if (saved.painter === AUTO || PAINTERS.some((p) => p.id === saved.painter)) setPainter(saved.painter!);
    } catch { /* storage unavailable: the defaults stand */ }
  }, []);
  const pick = (next: { writer?: string; painter?: string }) => {
    if (next.writer) setWriter(next.writer);
    if (next.painter) setPainter(next.painter);
    try { localStorage.setItem(PICK_KEY, JSON.stringify({ writer, painter, ...next })); } catch { /* not kept */ }
  };
  const [angle, setAngle] = useState<AngleId>("");
  // a pick the form no longer offers (the plan or the format changed) goes back to ให้ AI เลือก
  useEffect(() => {
    if (angle && angle !== "custom" && !anglesFor(format, href).some((a) => a.id === angle)) setAngle("");
  }, [angle, format, href]);
  const [reader, setReaderState] = useState("");
  useEffect(() => {
    try { setReaderState(localStorage.getItem(READER_KEY) ?? ""); } catch { /* storage unavailable */ }
  }, []);
  const setReader = (next: string) => {
    setReaderState(next);
    try { localStorage.setItem(READER_KEY, next); } catch { /* not kept */ }
  };
  const [theme, setThemeState] = useState<ThemeChoice>("navy");
  useEffect(() => {
    try {
      const kept = localStorage.getItem(THEME_KEY) ?? "";
      if (kept === AUTO_THEME || (THEMES as readonly string[]).includes(kept)) setThemeState(kept as ThemeChoice);
    } catch { /* storage unavailable */ }
  }, []);
  const setTheme = (next: ThemeChoice) => {
    setThemeState(next);
    try { localStorage.setItem(THEME_KEY, next); } catch { /* not kept */ }
  };
  const [person, setPersonState] = useState<PiecePerson | null>(null);
  useEffect(() => {
    try {
      const kept = JSON.parse(localStorage.getItem(PERSON_KEY) ?? "null") as PiecePerson | null;
      // someone since removed from the library is not offered back
      if (kept && people.some((p) => p.id === kept.id)) setPersonState(kept);
    } catch { /* storage unavailable */ }
    // the library does not change while the page is open
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setPerson = (next: PiecePerson | null) => {
    setPersonState(next);
    try { localStorage.setItem(PERSON_KEY, JSON.stringify(next)); } catch { /* not kept */ }
  };
  const [brief, setBriefState] = useState("");
  useEffect(() => {
    try { setBriefState(localStorage.getItem(BRIEF_KEY) ?? ""); } catch { /* storage unavailable */ }
  }, []);
  const setBrief = (next: string) => {
    setBriefState(next);
    try { localStorage.setItem(BRIEF_KEY, next); } catch { /* not kept */ }
  };
  const [goal, setGoal] = useState<GoalId>("");
  const [fact, setFact] = useState("");
  const [custom, setCustom] = useState("");
  const [length, setLength] = useState<Length>("60");
  const [count, setCount] = useState(3);
  const [adAngles, setAdAngles] = useState(2);
  const [adTones, setAdTones] = useState(2);
  const [hookId, setHookId] = useState(initialHook ?? "");
  const [error, setError] = useState<string>();
  const [spend, setSpend] = useState(initialSpend);

  const [tab, setTab] = useState<ContentStatus>("draft");
  const [plan, setPlan] = useState("");
  const [items, setItems] = useState(initial.items);
  const [counts, setCounts] = useState(initial.counts);
  const [used, setUsed] = useState(initialUsed);
  const [editing, setEditing] = useState<string | null>(initialOpen?.id ?? null);
  /** a piece opened from the calendar page (/content?open=…), which may be in neither tab's list */
  const [opened, setOpened] = useState<ContentItem | null>(initialOpen ?? null);
  /** pieces with a status change or a delete under way — one each, several at once */
  const [busy, setBusy] = useState<Set<string>>(() => new Set());
  const mark = (id: string, on: boolean) => setBusy((b) => { const n = new Set(b); if (on) n.add(id); else n.delete(id); return n; });
  /** a word for the owner that is not an error: a round that landed while an editor was open */
  const [notice, setNotice] = useState<string>();
  /** the ใช้จริง rail is every plan's, so its number is too — counts.used follows the filter */
  const [usedTotal, setUsedTotal] = useState(initial.counts.used);
  const [copied, setCopied] = useState<string | null>(null);
  const [drawing, setDrawing] = useState<Set<string>>(() => new Set());
  /**
   * How many pieces the round in progress asked for — fixed at the press, not the live
   * picker — and nought when no round is running. Its own state rather than a transition's
   * pending flag: that one stayed on while the pictures were drawing, so a skeleton sat
   * beside the finished card and read as a second piece being made.
   */
  const [making, setMaking] = useState(0);
  const [makingFormat, setMakingFormat] = useState<Format>("post");
  const pending = making > 0;
  /**
   * What is on screen now, for code that finishes long after it started: a round lands
   * twenty seconds after the press, and the closure it began in still sees that moment.
   */
  const view = useRef({ tab, plan, editing, items, used });
  useEffect(() => { view.current = { tab, plan, editing, items, used }; });
  const pieces = useRef<HTMLElement>(null);

  /**
   * The editor has the middle column to itself: it opened inline among the cards, and the
   * owner saw pieces they were not editing above and below it. Opening scrolls to the top of
   * the column; leaving scrolls back to the card that was open, so the list is where it was.
   */
  const returnTo = useRef<string | null>(null);
  function openEditor(id: string) {
    returnTo.current = id;
    setEditing(id);
  }
  useEffect(() => {
    if (editing) { pieces.current?.scrollIntoView({ block: "start" }); return; }
    if (returnTo.current) document.getElementById(`piece-${returnTo.current}`)?.scrollIntoView({ block: "center" });
    returnTo.current = null;
  }, [editing]);

  const nameOf = (h: string) => products.find((p) => p.href === h)?.name ?? h;
  // gone from the list — deleted, moved to the other tab, filtered out — and the list is back
  const editingItem = editing ? (items.find((x) => x.id === editing) ?? (opened?.id === editing ? opened : undefined)) : undefined;
  const chosenHook = hooks.find((h) => h.id === hookId) ?? null;

  async function reload(nextTab = tab, nextPlan = plan) {
    const wb = await contentWorkbench({ status: nextTab, planHref: nextPlan || undefined });
    setItems(wb.items);
    setCounts(wb.counts);
  }

  async function generate() {
    if (pending) return;
    setError(undefined);
    const asked = pieceCount;
    // อัตโนมัติ is settled at the press, on the money left then
    const paintWith = painterOf(painter, Math.max(0, spend.cap - spend.spent)).id;
    const pictureBrief = brief.trim();
    const pictureOf = person;
    setMaking(asked);
    setMakingFormat(format);
    setNotice(undefined);
    try {
      let res: GenerateResult;
      try {
        res = await generateRound({
          href, format, angle, custom, length: format === "script" ? length : null, count,
          hookTemplateId: format === "ad" ? null : hookId || null, adAngles, adTones, writer,
          reader, goal: format === "ad" ? "" : goal, fact: format === "ad" ? "" : fact, theme,
        });
      } catch {
        /**
         * The connection dropped mid-write — on a phone, usually because the owner switched
         * to another app during the wait. The server carries on and saves the pieces
         * regardless, so they are very likely already under รอตรวจ rather than lost.
         */
        setError("การเชื่อมต่อหลุดระหว่างรอ ชิ้นงานอาจสร้างเสร็จแล้ว ดูในแท็บ “รอตรวจ” ก่อนกดสร้างใหม่นะครับ");
        if (!view.current.editing) {
          setTab("draft");
          setPlan("");
          await reload("draft", "").catch(() => {});
        }
        return;
      }
      if (!res.ok) { setError(res.error); return; }
      if (res.missing > 0) setError(`ได้ ${res.items.length} จาก ${asked} ชิ้น — อีก ${res.missing} ชิ้นเขียนไม่สำเร็จ กดสร้างเพิ่มได้`);
      const now = view.current;
      if (now.editing) {
        /**
         * An editor is open — the owner used the wait. Closing it threw their unsaved
         * words away; the new pieces join the list instead, or wait under รอตรวจ.
         */
        if (now.tab === "draft" && !now.plan) {
          const fresh = new Set(res.items.map((i) => i.id));
          setItems((list) => [...res.items, ...list.filter((x) => !fresh.has(x.id))]);
          // the list is out of sight behind the editor
          setNotice(`สร้างเสร็จ ${res.items.length} ชิ้น รออยู่ในรายการ กด “กลับไปรายการ” เพื่อดู`);
        } else {
          setNotice(`สร้างเสร็จ ${res.items.length} ชิ้น อยู่ในแท็บ “รอตรวจ”`);
        }
        setCounts((c) => ({ ...c, draft: c.draft + res.items.length }));
        setMaking(0);
      } else {
        setTab("draft");
        setPlan("");
        await reload("draft", "").catch(() => {});
        setMaking(0);
        pieces.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      // the painter as it was at the press, even if the owner changes it while waiting
      // the brief too: what the box said at the press, not after
      if (paintWith !== "none") void drawPictures(res.items.filter((i) => i.format !== "script"), paintWith, pictureBrief, pictureOf);
      setSpend(await contentSpend().catch(() => spend));
    } finally {
      setMaking(0);
    }
  }

  /**
   * Every new post and ad gets its photograph ordered as soon as its card is up — the owner
   * asked not to press วาดภาพ piece by piece. The cards show their words first and the
   * pictures arrive on their own; one that fails keeps its plain poster and the button.
   */
  async function drawPictures(list: ContentItem[], paintWith: string, request: string, who: PiecePerson | null) {
    if (list.length === 0) return;
    // null rather than left out: a round without a person draws none, whatever a piece held
    const results = await Promise.all(list.map((item) => drawOne(item.id, request, paintWith, false, who)));
    const failed = results.flatMap((r) => (r.ok ? [] : [r.error]));
    if (failed.length > 0) setError(`วาดภาพไม่สำเร็จ ${failed.length} ชิ้น (${failed[0]}) — กด “แก้ไข” แล้ววาดใหม่ได้`);
    setSpend(await contentSpend().catch(() => spend));
  }

  /**
   * One picture, from the auto-draw or the editor alike: the card shows it drawing, the
   * editor's button waits even after the editor is closed and opened again — it was live
   * again then, and a second paid picture could be ordered — and the budget line follows.
   */
  async function drawOne(id: string, request: string, paintWith: string, refresh = true, who?: PiecePerson | null): Promise<DrawBackgroundResult> {
    setDrawing((d) => new Set(d).add(id));
    const res = await drawPicture(id, request, paintWith, who);
    if (res.ok && res.note) setError(res.note);
    setDrawing((d) => { const n = new Set(d); n.delete(id); return n; });
    if (res.ok) saved(res.item);
    if (refresh) setSpend(await contentSpend().catch(() => spend));
    return res;
  }

  /**
   * Pieces whose status is being changed right now. A second tap before the first had
   * answered — the busy state is not on screen until the next render — marked the same
   * piece used twice and put it in the ใช้จริง rail twice.
   */
  const moving = useRef(new Set<string>());

  async function changeStatus(item: ContentItem, status: ContentStatus) {
    // ✓ ใช้จริง on a piece opened from the ใช้จริง rail: it is used already
    if (item.status === status) { if (editing === item.id) setEditing(null); return; }
    if (moving.current.has(item.id)) return;
    moving.current.add(item.id);
    mark(item.id, true);
    const res = await setContentStatus(item.id, status).catch(() => ({ ok: false })).finally(() => moving.current.delete(item.id));
    mark(item.id, false);
    if (!res.ok) { setError("เปลี่ยนสถานะไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"); return; }
    setError(undefined);
    if (view.current.editing === item.id) setEditing(null);
    // the copy on screen now, not the one the button was drawn with: an edit saved or a
    // picture landed since, and the rail showed the old words and the plain poster
    const newest = [...view.current.items, ...view.current.used].find((x) => x.id === item.id) ?? item;
    setItems((list) => list.filter((x) => x.id !== item.id));
    setCounts((c) => ({ ...c, [item.status]: Math.max(0, c[item.status] - 1), [status]: c[status] + 1 }));
    setUsedTotal((n) => Math.max(0, n + (status === "used" ? 1 : -1)));
    // one row per piece in the rail, whatever order the updates arrive in
    setUsed((list) => {
      const others = list.filter((x) => x.id !== item.id);
      return status === "used" ? [{ ...newest, status }, ...others] : others;
    });
  }

  async function remove(item: ContentItem) {
    if (!(await ask("ลบชิ้นนี้ถาวร? ลบแล้วกู้คืนไม่ได้", "ลบ"))) return;
    mark(item.id, true);
    const res = await removeContent(item.id).catch(() => ({ ok: false }));
    mark(item.id, false);
    if (!res.ok) { setError("ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"); return; }
    setError(undefined);
    if (view.current.editing === item.id) setEditing(null);
    setItems((list) => list.filter((x) => x.id !== item.id));
    setUsed((list) => list.filter((x) => x.id !== item.id));
    setCounts((c) => ({ ...c, [item.status]: Math.max(0, c[item.status] - 1) }));
    if (item.status === "used") setUsedTotal((n) => Math.max(0, n - 1));
  }

  /**
   * Posted, scheduled or taken back from the editor. A piece on the Page leaves both lists
   * for the calendar (it stays open while being edited, and goes on close); one taken back
   * returns as ใช้จริง.
   */
  function published(next: ContentItem) {
    const before = [...view.current.items, ...view.current.used].find((x) => x.id === next.id);
    saved(next);
    const wasListed = before != null && !onPage(before.publish);
    const listed = !onPage(next.publish);
    if (wasListed === listed && before?.status === next.status) return;
    setCounts((c) => {
      const out = { ...c };
      if (wasListed && before) out[before.status] = Math.max(0, out[before.status] - 1);
      if (listed) out[next.status] += 1;
      return out;
    });
    setUsedTotal((n) => Math.max(0, n - (wasListed && before?.status === "used" ? 1 : 0) + (listed && next.status === "used" ? 1 : 0)));
    setUsed((list) => (listed && next.status === "used" ? [next, ...list.filter((x) => x.id !== next.id)] : list.filter((x) => x.id !== next.id)));
  }

  function saved(next: ContentItem) {
    setItems((list) => list.map((x) => (x.id === next.id ? next : x)));
    setUsed((list) => list.map((x) => (x.id === next.id ? next : x)));
    setOpened((o) => (o?.id === next.id ? next : o));
  }

  async function copy(item: ContentItem) {
    try {
      await navigator.clipboard.writeText(item.format === "ad" ? `${item.output.body}\n\n${footer(item.output)}` : fullText(item.output));
      setCopied(item.id);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      setError("คัดลอกไม่ได้ กด “แก้ไข” แล้วเลือกข้อความคัดลอกเองนะครับ");
    }
  }

  async function openUsed(item: ContentItem) {
    if (tab !== "used" || plan) {
      setTab("used");
      setPlan("");
      await reload("used", "").catch(() => setError("โหลดรายการไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"));
    }
    openEditor(item.id);
  }

  const pieceCount = format === "ad" ? adAngles * adTones : count;
  // what one piece costs with the picks made, the picture included (scripts have none)
  const left = Math.max(0, spend.cap - spend.spent);
  const writes = writerOf(writer, left);
  const paints = painterOf(painter, left);
  const perPiece = writes.thb + OVERHEAD_THB + (format === "script" ? 0 : paints.thb);
  const estimate = (pieceCount * perPiece).toFixed(1);
  const more = Math.floor(left / perPiece);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">สร้างคอนเทนต์</h1>
          <p className="mt-1 text-sm text-[var(--ct-mute)]">AI เขียนจากข้อมูลจริงของแบบประกัน ตัวเลขทุกตัวมาจากตารางเบี้ย อ่านทวนก่อนโพสต์ทุกครั้ง</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/content/calendar" className="rounded-full border border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-1.5 text-sm hover:bg-[var(--ct-soft)]">
            ปฏิทินโพสต์ →
          </Link>
          <Link href="/content/hooks" className="rounded-full border border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-1.5 text-sm hover:bg-[var(--ct-soft)]">
            คลังสูตรประโยคเปิด →
          </Link>
          <Link href="/content/people" className="rounded-full border border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-1.5 text-sm hover:bg-[var(--ct-soft)]">
            คลังบุคคล →
          </Link>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_240px]">
        {/* ---------------------------------- tools ---------------------------------- */}
        <aside className="space-y-4 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
          <div className="border-b border-[var(--ct-hair)] pb-3">
            <h2 className="font-semibold">เครื่องมือ</h2>
            <p className="mt-0.5 text-xs text-[var(--ct-mute)]">เลือกแล้วกดสร้าง ชิ้นงานจะไปอยู่ที่ “รอตรวจ”</p>
          </div>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">แบบประกัน</span>
            <select value={href} onChange={(e) => setHref(e.target.value)} className={field}>
              {products.map((p) => <option key={p.href} value={p.href}>{p.name}</option>)}
            </select>
          </label>

          <label className="block">
            <span className="mb-1 block text-sm font-medium">ทำอะไร</span>
            <select value={format} onChange={(e) => setFormat(e.target.value as Format)} className={field}>
              {FORMATS.map((f) => <option key={f} value={f}>{FORMAT_LABEL[f]}</option>)}
            </select>
          </label>

          {format === "script" && (
            <div>
              <span className="mb-1.5 block text-sm font-medium">ความยาวคลิป</span>
              <div className="flex flex-wrap gap-2">
                {lengths.map((l) => (
                  <button key={l.id} type="button" aria-pressed={length === l.id} onClick={() => setLength(l.id)} className={chip(length === l.id)}>{l.label}</button>
                ))}
              </div>
            </div>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium">มุมที่อยากเล่า <span className="font-normal text-[var(--ct-mute)]">(ไม่เลือกก็ได้)</span></span>
            <select value={angle} onChange={(e) => setAngle(e.target.value as AngleId)} className={field}>
              <option value="">ให้ AI เลือก</option>
              {anglesFor(format, href).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              <option value="custom">พิมพ์เอง…</option>
            </select>
            {angle === "custom" && (
              <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={120} placeholder="เช่น ทำไมยิ่งอายุมากยิ่งซื้อยาก" className={`${field} mt-2`} />
            )}
          </label>

          <div>
            <span className="mb-1.5 block text-sm font-medium">คนอ่านคือใคร <span className="font-normal text-[var(--ct-mute)]">(Niche · ระบบจำไว้ให้)</span></span>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={reader === ""} onClick={() => setReader("")} className={chip(reader === "")}>ทุกคน</button>
              {NICHES.map((n) => (
                <button key={n} type="button" aria-pressed={reader === n} onClick={() => setReader(n)} className={chip(reader === n)}>{n}</button>
              ))}
            </div>
            <input value={reader} onChange={(e) => setReader(e.target.value)} maxLength={MAX_READER} placeholder="หรือพิมพ์เอง เช่น พยาบาลกะดึก" className={`${field} mt-2`} />
          </div>

          {format !== "ad" && (
            <>
            <div>
              <span className="mb-1.5 block text-sm font-medium">อ่านจบแล้วอยากให้ทำอะไร</span>
              <div className="flex flex-wrap gap-2">
                <button type="button" aria-pressed={goal === ""} onClick={() => setGoal("")} className={chip(goal === "")}>ให้ AI เลือก</button>
                {GOALS.map((g) => (
                  <button key={g.id} type="button" aria-pressed={goal === g.id} onClick={() => setGoal(g.id)} className={chip(goal === g.id)}>{g.label}</button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium">เรื่องจริงจากคุณ <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้)</span></span>
              <textarea value={fact} onChange={(e) => setFact(e.target.value)} maxLength={MAX_FACT} rows={3}
                placeholder="เช่น เดือนที่แล้วลูกค้าเคลมค่ารักษาไป 8 หมื่น ตอนแรกเขาเกือบไม่ทำ — ไม่ต้องใส่ชื่อลูกค้า"
                className={field} />
              <span className="mt-1 block text-xs text-[var(--ct-mute)]">AI จะเล่าเป็นเรื่องจริงเฉพาะที่พิมพ์ไว้ ไม่เติมรายละเอียดเอง</span>
            </label>
            </>
          )}

          {format === "ad" ? (
            <div className="space-y-3 rounded-lg bg-[var(--ct-ground)] p-3">
              <p className="text-xs leading-relaxed text-[var(--ct-mute)]">
                ได้โฆษณาหลายแบบในรอบเดียว: แต่ละ “มุมขาย” เขียนด้วยหลาย “น้ำเสียง” เอาไปยิงเทียบกันใน Ads Manager ว่าแบบไหนได้ผล
              </p>
              <div>
                <span className="mb-1.5 block text-sm font-medium">มุมขาย</span>
                <div className="flex gap-2">
                  {Array.from({ length: MAX_ANGLES }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" aria-pressed={adAngles === n} onClick={() => setAdAngles(n)} className={`${chip(adAngles === n)} min-w-10`}>{n}</button>
                  ))}
                </div>
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-medium">น้ำเสียงต่อมุม</span>
                <div className="flex gap-2">
                  {Array.from({ length: MAX_TONES }, (_, i) => i + 1).map((n) => (
                    <button key={n} type="button" aria-pressed={adTones === n} onClick={() => setAdTones(n)} className={`${chip(adTones === n)} min-w-10`}>{n}</button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <>
            <label className="block">
              <span className="mb-1 block text-sm font-medium">สูตรประโยคเปิด <span className="font-normal text-[var(--ct-mute)]">(ไม่ใช้ก็ได้)</span></span>
              <select value={hookId} onChange={(e) => setHookId(e.target.value)} className={field}>
                <option value="">ไม่ใช้สูตร — ให้ AI คิดเอง</option>
                {hooks.map((h) => <option key={h.id} value={h.id}>{h.template}</option>)}
              </select>
              {chosenHook && (
                <span className="mt-1 block text-xs text-[var(--ct-mute)]">หมวด {HOOK_CATEGORY_LABEL[chosenHook.category]} · ใช้ไปแล้ว {chosenHook.useCount} ครั้ง</span>
              )}
            </label>

            <div>
              <span className="mb-1.5 block text-sm font-medium">จำนวนชิ้น <span className="font-normal text-[var(--ct-mute)]">(แต่ละชิ้นคนละมุม)</span></span>
              <div className="flex flex-wrap gap-2">
                {Array.from({ length: MAX_PIECES }, (_, i) => i + 1).map((n) => (
                  <button key={n} type="button" aria-pressed={count === n} onClick={() => setCount(n)} className={`${chip(count === n)} min-w-10`}>{n}</button>
                ))}
              </div>
            </div>
            </>
          )}

          <label className="block">
            <span className="mb-1 block text-sm font-medium">โมเดลเขียน</span>
            <select value={writer} onChange={(e) => pick({ writer: e.target.value })} className={field}>
              <option value={AUTO}>อัตโนมัติ</option>
              {WRITERS.map((w) => <option key={w.id} value={w.id}>{w.label} · ฿{w.thb.toFixed(2)} ต่อชิ้น</option>)}
            </select>
            <span className="mt-1 block text-xs text-[var(--ct-mute)]">
              {writer === AUTO
                ? `ตอนนี้ใช้ ${writes.short} — งบเหลือต่ำกว่า ฿${AUTO_FLOOR_THB} จะสลับเป็นแบบประหยัดเอง`
                : `${writes.short} · ราคาต่อชิ้น`}
            </span>
          </label>

          {format !== "script" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">ภาพประกอบ</span>
              <select value={painter} onChange={(e) => pick({ painter: e.target.value })} className={field}>
                <option value={AUTO}>อัตโนมัติ</option>
                {PAINTERS.map((p) => <option key={p.id} value={p.id}>{p.label}{p.thb > 0 ? ` · ฿${p.thb.toFixed(2)} ต่อภาพ` : ""}</option>)}
              </select>
              <span className="mt-1 block text-xs text-[var(--ct-mute)]">
                {painter === AUTO
                  ? `ตอนนี้${paints.modelId ? `วาดด้วย ${paints.short}` : "ไม่วาดภาพ"} — งบเหลือต่ำกว่า ฿${AUTO_FLOOR_THB} จะหยุดวาดเอง`
                  : painter === "none" ? "ใช้โปสเตอร์สีพื้น วาดทีหลังได้ในหน้าแก้ไข" : `${paints.short} · ราคาต่อภาพ วาดให้ทุกชิ้นหลังเขียนเสร็จ`}
              </span>
            </label>
          )}

          {format !== "script" && (
            <div>
              <span className="mb-1.5 block text-sm font-medium">โทนสีโปสเตอร์ <span className="font-normal text-[var(--ct-mute)]">(ระบบจำไว้ให้)</span></span>
              <ThemeSwatches value={theme} onChange={setTheme} allowAuto />
              <span className="mt-1 block text-xs text-[var(--ct-mute)]">
                {theme === AUTO_THEME ? "แต่ละชิ้นอาจได้คนละโทน ภาพ AI วาดตามโทนของชิ้นนั้น" : "ใช้กับทุกชิ้นในรอบนี้ และภาพ AI จะวาดในโทนเดียวกัน"} · เปลี่ยนทีละชิ้นได้ในหน้าแก้ไข
              </span>
            </div>
          )}

          {format !== "script" && painter !== "none" && (
            <div>
              <span className="mb-1.5 block text-sm font-medium">ใส่บุคคลในภาพ <span className="font-normal text-[var(--ct-mute)]">(ระบบจำไว้ให้)</span></span>
              <PersonPicker people={people} value={person} onChange={setPerson} />
              {person && <span className="mt-1 block text-xs text-[var(--ct-mute)]">วาดด้วย Gemini Image ซึ่งรักษาหน้าคนได้ดีที่สุด ราวภาพละ ฿2.4 · ชุดและสถานที่พิมพ์ในบรีฟภาพด้านล่าง</span>}
            </div>
          )}

          {/* the owner's free direction for every picture of the round, on top of the fixed rules */}
          {format !== "script" && painter !== "none" && (
            <label className="block">
              <span className="mb-1 block text-sm font-medium">บรีฟภาพเพิ่มเติม <span className="font-normal text-[var(--ct-mute)]">(ไม่ใส่ก็ได้ · ระบบจำไว้ให้)</span></span>
              <textarea
                value={brief} onChange={(e) => setBrief(e.target.value)} maxLength={MAX_BRIEF} rows={3}
                placeholder="เช่น โทนอบอุ่นแบบภาพยนตร์ ครอบครัวในสวนตอนเย็น มุมกว้าง ไม่เอาภาพในโรงพยาบาล"
                className={field}
              />
              <span className="mt-1 block text-xs text-[var(--ct-mute)]">ใช้กับภาพทุกชิ้นในรอบนี้ ภาพจะยังไม่มีตัวหนังสือและเว้นที่ให้ข้อความเสมอ · {brief.length}/{MAX_BRIEF}</span>
            </label>
          )}

          <div>
            <button type="button" onClick={generate} disabled={pending || !href} className="w-full rounded-lg bg-[var(--ct-solid)] px-4 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50">
              {pending
                ? `กำลังเขียน ${making} ${makingFormat === "ad" ? "แบบ" : "ชิ้น"}… (ราว 20–40 วินาที)`
                : format === "ad" ? `สร้างโฆษณา ${pieceCount} แบบ` : `สร้าง ${count} ชิ้น`}
            </button>
            <p className="mt-2 text-xs text-[var(--ct-mute)]">
              ราว ฿{estimate} · สร้างได้อีกราว {more} ชิ้น · งบคอนเทนต์เดือนนี้เหลือ ฿{left.toFixed(2)} จาก ฿{spend.cap}
            </p>
          </div>
        </aside>

        {/* ---------------------------------- pieces ---------------------------------- */}
        <section ref={pieces} className="@container min-w-0 scroll-mt-4 space-y-3 lg:row-span-2 xl:row-span-1">
          {editingItem ? (
            <>
              {pending && (
                <p role="status" className="flex items-center gap-2 text-sm font-medium text-[var(--ct-accent)]">
                  <span className="size-2.5 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
                  กำลังสร้าง {making} {makingFormat === "ad" ? "แบบ" : "ชิ้น"} อยู่เบื้องหลัง — แก้ชิ้นนี้ต่อได้เลย
                </p>
              )}
              <PieceEditor
                key={editingItem.id}
                item={editingItem}
                drawing={drawing.has(editingItem.id)}
                productName={nameOf(editingItem.planHref)}
                onSaved={saved}
                onDraw={(request, paintWith, who) => drawOne(editingItem.id, request, paintWith, true, who)}
                people={people}
                onStatus={(s) => changeStatus(editingItem, s)}
                onPublished={published}
                onClose={() => {
                  setEditing(null);
                  // a piece posted from here is ใช้จริง and on the calendar now: it leaves on the way out
                  setItems((list) => list.filter((x) => x.status === tab && !onPage(x.publish)));
                }}
              />
            </>
          ) : (
          <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="สถานะชิ้นงาน" className="inline-flex items-center gap-1 rounded-full border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-1">
              {TABS.map((t) => (
                <button
                  key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                  onClick={() => { setTab(t.id); setEditing(null); reload(t.id, plan).catch(() => setError("โหลดรายการไม่สำเร็จ ลองใหม่อีกครั้งนะครับ")); }}
                  className={`rounded-full px-3 py-1.5 text-sm ${tab === t.id ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}
                >
                  {t.label} <span className="tabular-nums">{counts[t.id]}</span>
                </button>
              ))}
            </div>
            <select
              value={plan} aria-label="กรองตามแบบประกัน"
              onChange={(e) => { setPlan(e.target.value); setEditing(null); reload(tab, e.target.value).catch(() => setError("โหลดรายการไม่สำเร็จ ลองใหม่อีกครั้งนะครับ")); }}
              className="rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-2 py-1.5 text-sm"
            >
              <option value="">ทุกแบบ</option>
              {products.map((p) => <option key={p.href} value={p.href}>{p.name}</option>)}
            </select>
          </div>

          {pending && (
            <div role="status" className="space-y-3">
              <p className="flex items-center gap-2 text-sm font-medium text-[var(--ct-accent)]">
                <span className="size-2.5 rounded-full bg-[var(--ct-accent)] motion-safe:animate-pulse" />
                กำลังสร้าง {making} {makingFormat === "ad" ? "แบบ" : "ชิ้น"}…
              </p>
              <div className="grid gap-4 @xl:grid-cols-2">
                {Array.from({ length: making }, (_, i) => <PieceSkeleton key={i} />)}
              </div>
              <p className="text-xs text-[var(--ct-mute)]">
                เปิดหน้านี้ไว้จนภาพขึ้นครบ — ถ้าออกไปก่อน ข้อความยังเก็บไว้ที่ “รอตรวจ” แต่ต้องกดวาดภาพเอง
              </p>
            </div>
          )}

          {items.length === 0 && !pending ? (
            <p className="rounded-xl border border-dashed border-[var(--ct-line)] px-4 py-10 text-center text-sm text-[var(--ct-mute)]">
              {tab === "draft" ? "ยังไม่มีชิ้นงานรอตรวจ — เลือกแบบประกันแล้วกดสร้างได้เลย" : "ยังไม่มีชิ้นงานที่ใช้จริง"}
            </p>
          ) : (
            <div className="grid gap-4 @xl:grid-cols-2">
              {items.map((item, i) => (
                // the id is where leaving the editor scrolls back to; a grid of one so the card still fills its row
                <div key={item.id} id={`piece-${item.id}`} className="grid scroll-mt-4">
                {item.format === "script" ? (
                  <ScriptCard
                    item={item}
                    index={i}
                    busy={busy.has(item.id)}
                    onEdit={() => openEditor(item.id)}
                    onStatus={(s) => changeStatus(item, s)}
                    onDelete={() => remove(item)}
                    onCopy={() => copy(item)}
                  />
                ) : (
                  <PieceCard
                    item={item}
                    index={i}
                    productName={nameOf(item.planHref)}
                    busy={busy.has(item.id)}
                    drawing={drawing.has(item.id)}
                    onEdit={() => openEditor(item.id)}
                    onStatus={(s) => changeStatus(item, s)}
                    onDelete={() => remove(item)}
                    onCopy={() => copy(item)}
                  />
                )}
                </div>
              ))}
            </div>
          )}
          </>
          )}
          {copied && <p role="status" className="text-sm text-[var(--ct-mute)]">คัดลอกแล้ว ✓</p>}
        </section>

        {/* ------------------------------- used rail ------------------------------- */}
        <aside className="rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] lg:col-start-1 lg:row-start-2 xl:sticky xl:top-4 xl:col-start-3 xl:row-start-1">
          <div className="flex items-end justify-between gap-2 border-b border-[var(--ct-hair)] p-4 pb-3">
            <div>
              <h2 className="font-semibold">ใช้จริง</h2>
              <p className="mt-0.5 text-xs text-[var(--ct-mute)]">ชิ้นที่เลือกไปโพสต์แล้ว</p>
            </div>
            <span className="text-2xl tabular-nums text-[var(--ct-accent)]">{usedTotal}</span>
          </div>
          {used.length === 0 ? (
            <p className="m-4 rounded-lg border border-dashed border-[var(--ct-line)] px-3 py-6 text-center text-xs text-[var(--ct-mute)]">
              กด “✓ ใช้จริง” ที่ชิ้นงาน แล้วจะย้ายมาอยู่ตรงนี้ — ระบบจะจำประโยคเปิดไว้เป็นสูตรใหม่ และไม่เขียนซ้ำ
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-[var(--ct-hair)] overflow-y-auto">
              {used.slice(0, 20).map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => openUsed(u)} className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-[var(--ct-ground)]">
                    {/* eslint-disable-next-line @next/next/no-img-element -- the card's own poster, from the browser cache */}
                    <img
                      src={posterUrl(u.output.poster ?? defaultPoster(u.output.hooks[0], nameOf(u.planHref)))}
                      alt=""
                      loading="lazy"
                      className="size-14 shrink-0 rounded-md border border-[var(--ct-hair)] bg-[var(--ct-ground)] object-cover"
                    />
                    <span className="min-w-0">
                      <span className="block text-xs text-[var(--ct-mute)]">{nameOf(u.planHref)} · {FORMAT_SHORT[u.format]}</span>
                      <span className="line-clamp-2 text-sm">{u.output.hooks[0]}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>

      {(error || notice) && (
        <div
          role={error ? "alert" : "status"}
          className={`fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-start gap-3 rounded-lg border px-3 py-2 text-sm shadow-lg ${error
            ? "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]"
            : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)]"}`}
        >
          <p className="flex-1">{error ?? notice}</p>
          <button type="button" onClick={() => { setError(undefined); setNotice(undefined); }} aria-label="ปิดข้อความ" className="-mr-1 px-1 text-base leading-none">✕</button>
        </div>
      )}
    </div>
  );
}
