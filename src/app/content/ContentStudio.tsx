"use client";
import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { HOOK_CATEGORY_LABEL, type HookTemplate } from "@/lib/content/hooks";
import { fullText } from "@/lib/content/output";
import { MAX_PIECES } from "@/lib/content/plan";
import type { AngleId, Format, Length } from "@/lib/content/prompt";
import type { ContentItem, ContentStatus } from "@/lib/content/store";
import { contentSpend, contentWorkbench, generateContent, removeContent, setContentStatus } from "./actions";
import { PieceCard } from "./PieceCard";
import { PieceEditor } from "./PieceEditor";

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
  angles: { id: string; label: string }[];
  lengths: { id: Length; label: string }[];
  hooks: HookTemplate[];
  initialHook: string | null;
  initial: { items: ContentItem[]; counts: Record<ContentStatus, number> };
  initialUsed: ContentItem[];
  spend: { spent: number; cap: number };
}

const FORMATS: { id: Format; label: string }[] = [
  { id: "post", label: "โพสต์เฟซบุ๊ก" },
  { id: "script", label: "สคริปต์วิดีโอ" },
];

const TABS: { id: ContentStatus; label: string }[] = [
  { id: "draft", label: "รอตรวจ" },
  { id: "used", label: "ใช้จริง" },
];

/** what a piece has cost on average so far (Sonnet ≈ ฿0.69 on 2026-09-23), for the estimate */
const PER_PIECE_THB = 0.7;

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)] hover:bg-[var(--ct-soft)]"}`;

const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm outline-none focus:border-[var(--ct-accent)]";

export function ContentStudio({ products, angles, lengths, hooks, initialHook, initial, initialUsed, spend: initialSpend }: Props) {
  const [href, setHref] = useState(products[0]?.href ?? "");
  const [format, setFormat] = useState<Format>("post");
  const [angle, setAngle] = useState<AngleId>("");
  const [custom, setCustom] = useState("");
  const [length, setLength] = useState<Length>("60");
  const [count, setCount] = useState(3);
  const [hookId, setHookId] = useState(initialHook ?? "");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const [spend, setSpend] = useState(initialSpend);

  const [tab, setTab] = useState<ContentStatus>("draft");
  const [plan, setPlan] = useState("");
  const [items, setItems] = useState(initial.items);
  const [counts, setCounts] = useState(initial.counts);
  const [used, setUsed] = useState(initialUsed);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const pieces = useRef<HTMLElement>(null);

  const nameOf = (h: string) => products.find((p) => p.href === h)?.name ?? h;
  const chosenHook = hooks.find((h) => h.id === hookId) ?? null;

  async function reload(nextTab = tab, nextPlan = plan) {
    const wb = await contentWorkbench({ status: nextTab, planHref: nextPlan || undefined });
    setItems(wb.items);
    setCounts(wb.counts);
  }

  function generate() {
    setError(undefined);
    start(async () => {
      let res: Awaited<ReturnType<typeof generateContent>>;
      try {
        res = await generateContent({
          href, format, angle, custom, length: format === "script" ? length : null, count, hookTemplateId: hookId || null,
        });
      } catch {
        /**
         * The connection dropped mid-write — on a phone, usually because the owner switched
         * to another app during the wait. The server carries on and saves the pieces
         * regardless, so they are very likely already under รอตรวจ rather than lost.
         */
        setError("การเชื่อมต่อหลุดระหว่างรอ ชิ้นงานอาจสร้างเสร็จแล้ว ดูในแท็บ “รอตรวจ” ก่อนกดสร้างใหม่นะครับ");
        setTab("draft");
        await reload("draft", "").catch(() => {});
        return;
      }
      if (!res.ok) { setError(res.error); return; }
      if (res.missing > 0) setError(`ได้ ${res.items.length} จาก ${count} ชิ้น — อีก ${res.missing} ชิ้นเขียนไม่สำเร็จ กดสร้างเพิ่มได้`);
      setTab("draft");
      setPlan("");
      setEditing(null);
      await reload("draft", "");
      setSpend(await contentSpend());
      pieces.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  async function changeStatus(item: ContentItem, status: ContentStatus) {
    setBusy(item.id);
    const res = await setContentStatus(item.id, status);
    setBusy(null);
    if (!res.ok) { setError("เปลี่ยนสถานะไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"); return; }
    if (editing === item.id) setEditing(null);
    setItems((list) => list.filter((x) => x.id !== item.id));
    setCounts((c) => ({ ...c, [item.status]: Math.max(0, c[item.status] - 1), [status]: c[status] + 1 }));
    if (status === "used") setUsed((list) => [{ ...item, status }, ...list]);
    if (item.status === "used") setUsed((list) => list.filter((x) => x.id !== item.id));
  }

  async function remove(item: ContentItem) {
    if (!window.confirm("ลบชิ้นนี้ถาวร? ลบแล้วกู้คืนไม่ได้")) return;
    setBusy(item.id);
    const res = await removeContent(item.id);
    setBusy(null);
    if (!res.ok) { setError("ลบไม่สำเร็จ ลองใหม่อีกครั้งนะครับ"); return; }
    if (editing === item.id) setEditing(null);
    setItems((list) => list.filter((x) => x.id !== item.id));
    setUsed((list) => list.filter((x) => x.id !== item.id));
    setCounts((c) => ({ ...c, [item.status]: Math.max(0, c[item.status] - 1) }));
  }

  function saved(next: ContentItem) {
    setItems((list) => list.map((x) => (x.id === next.id ? next : x)));
    setUsed((list) => list.map((x) => (x.id === next.id ? next : x)));
  }

  async function copy(item: ContentItem) {
    try {
      await navigator.clipboard.writeText(fullText(item.output));
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
      await reload("used", "");
    }
    setEditing(item.id);
    pieces.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const estimate = (count * PER_PIECE_THB).toFixed(1);
  const left = Math.max(0, spend.cap - spend.spent);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">สร้างคอนเทนต์</h1>
          <p className="mt-1 text-sm text-[var(--ct-mute)]">AI เขียนจากข้อมูลจริงของแบบประกัน ตัวเลขทุกตัวมาจากตารางเบี้ย อ่านทวนก่อนโพสต์ทุกครั้ง</p>
        </div>
        <Link href="/content/hooks" className="rounded-full border border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-1.5 text-sm hover:bg-[var(--ct-soft)]">
          คลังสูตรประโยคเปิด →
        </Link>
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

          <div>
            <span className="mb-1.5 block text-sm font-medium">ทำอะไร</span>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <button key={f.id} type="button" aria-pressed={format === f.id} onClick={() => setFormat(f.id)} className={chip(format === f.id)}>{f.label}</button>
              ))}
            </div>
          </div>

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

          <div>
            <span className="mb-1.5 block text-sm font-medium">มุมที่อยากเล่า <span className="font-normal text-[var(--ct-mute)]">(ไม่เลือกก็ได้)</span></span>
            <div className="flex flex-wrap gap-2">
              <button type="button" aria-pressed={angle === ""} onClick={() => setAngle("")} className={chip(angle === "")}>ให้ AI เลือก</button>
              {angles.map((a) => (
                <button key={a.id} type="button" aria-pressed={angle === a.id} onClick={() => setAngle(a.id as AngleId)} className={chip(angle === a.id)}>{a.label}</button>
              ))}
              <button type="button" aria-pressed={angle === "custom"} onClick={() => setAngle("custom")} className={chip(angle === "custom")}>พิมพ์เอง</button>
            </div>
            {angle === "custom" && (
              <input value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={120} placeholder="เช่น คนทำงานฟรีแลนซ์ที่ไม่มีสวัสดิการ" className={`${field} mt-2`} />
            )}
          </div>

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

          {error && (
            <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">{error}</p>
          )}

          <div>
            <button type="button" onClick={generate} disabled={pending || !href} className="w-full rounded-lg bg-[var(--ct-solid)] px-4 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50">
              {pending ? `กำลังเขียน ${count} ชิ้น… (ราว 20–40 วินาที)` : `สร้าง ${count} ชิ้น`}
            </button>
            <p className="mt-2 text-xs text-[var(--ct-mute)]">
              ราว ฿{estimate} · งบคอนเทนต์เดือนนี้เหลือ ฿{left.toFixed(2)} จาก ฿{spend.cap}
            </p>
          </div>
        </aside>

        {/* ---------------------------------- pieces ---------------------------------- */}
        <section ref={pieces} className="@container min-w-0 scroll-mt-4 space-y-3 lg:row-span-2 xl:row-span-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div role="tablist" aria-label="สถานะชิ้นงาน" className="inline-flex items-center gap-1 rounded-full border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-1">
              {TABS.map((t) => (
                <button
                  key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                  onClick={() => { setTab(t.id); setEditing(null); void reload(t.id, plan); }}
                  className={`rounded-full px-3 py-1.5 text-sm ${tab === t.id ? "bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`}
                >
                  {t.label} <span className="tabular-nums">{counts[t.id]}</span>
                </button>
              ))}
            </div>
            <select
              value={plan} aria-label="กรองตามแบบประกัน"
              onChange={(e) => { setPlan(e.target.value); setEditing(null); void reload(tab, e.target.value); }}
              className="rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-2 py-1.5 text-sm"
            >
              <option value="">ทุกแบบ</option>
              {products.map((p) => <option key={p.href} value={p.href}>{p.name}</option>)}
            </select>
          </div>

          {pending && (
            <div className="rounded-xl border border-dashed border-[var(--ct-line)] bg-[var(--ct-panel)] px-4 py-6 text-center text-sm text-[var(--ct-mute)]">
              AI กำลังวางแผนมุม แล้วเขียน {count} ชิ้น… ไปทำอย่างอื่นก่อนได้ ชิ้นงานจะถูกเก็บไว้ที่ “รอตรวจ”
            </div>
          )}

          {items.length === 0 && !pending ? (
            <p className="rounded-xl border border-dashed border-[var(--ct-line)] px-4 py-10 text-center text-sm text-[var(--ct-mute)]">
              {tab === "draft" ? "ยังไม่มีชิ้นงานรอตรวจ — เลือกแบบประกันแล้วกดสร้างได้เลย" : "ยังไม่มีชิ้นงานที่ใช้จริง"}
            </p>
          ) : (
            <div className="grid gap-4 @xl:grid-cols-2">
              {items.map((item, i) =>
                editing === item.id ? (
                  <div key={item.id} className="@xl:col-span-2">
                    <PieceEditor
                      key={item.id}
                      item={item}
                      productName={nameOf(item.planHref)}
                      onSaved={saved}
                      onStatus={(s) => changeStatus(item, s)}
                      onClose={() => setEditing(null)}
                    />
                  </div>
                ) : (
                  <PieceCard
                    key={item.id}
                    item={item}
                    index={i}
                    productName={nameOf(item.planHref)}
                    busy={busy === item.id}
                    onEdit={() => setEditing(item.id)}
                    onStatus={(s) => changeStatus(item, s)}
                    onDelete={() => remove(item)}
                    onCopy={() => copy(item)}
                  />
                ),
              )}
            </div>
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
            <span className="text-2xl tabular-nums text-[var(--ct-accent)]">{counts.used}</span>
          </div>
          {used.length === 0 ? (
            <p className="m-4 rounded-lg border border-dashed border-[var(--ct-line)] px-3 py-6 text-center text-xs text-[var(--ct-mute)]">
              กด “✓ ใช้จริง” ที่ชิ้นงาน แล้วจะย้ายมาอยู่ตรงนี้ — ระบบจะจำประโยคเปิดไว้เป็นสูตรใหม่ และไม่เขียนซ้ำ
            </p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-[var(--ct-hair)] overflow-y-auto">
              {used.slice(0, 20).map((u) => (
                <li key={u.id}>
                  <button type="button" onClick={() => openUsed(u)} className="block w-full px-4 py-2.5 text-left hover:bg-[var(--ct-ground)]">
                    <span className="block text-xs text-[var(--ct-mute)]">{nameOf(u.planHref)} · {u.format === "post" ? "โพสต์" : "สคริปต์"}</span>
                    <span className="line-clamp-2 text-sm">{u.output.hooks[0]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
