"use client";
import { useState, useTransition } from "react";
import { fullText } from "@/lib/content/output";
import type { Fix } from "@/lib/content/proofread";
import type { AngleId, Format, Length } from "@/lib/content/prompt";
import type { ContentItem } from "@/lib/content/store";
import { contentHistory, generateContent, proofreadContent, starContent } from "./actions";

/**
 * Pick a product, pick post or script, press one button, get a piece to read and paste.
 *
 * The piece arrives editable, because the owner's name goes under it. The checks sit beside
 * it rather than inside it: a sand panel listing any amount the tables never had, any word on
 * the owner's list, and the proofreader's suggestions — each of those last two one click to
 * accept. Nothing is changed without that click.
 */

interface Props {
  products: { href: string; name: string }[];
  angles: { id: string; label: string }[];
  lengths: { id: Length; label: string }[];
  initialHistory: ContentItem[];
}

interface Draft {
  hooks: string[];
  body: string;
  closing: string;
  tags: string;
}

const FORMATS: { id: Format; label: string }[] = [
  { id: "post", label: "โพสต์เฟซบุ๊ก" },
  { id: "script", label: "สคริปต์วิดีโอ" },
];

const draftOf = (item: ContentItem): Draft => ({
  hooks: [...item.output.hooks],
  body: item.output.body,
  closing: item.output.closing,
  tags: item.output.hashtags.join(" "),
});

/** the first place `find` occurs, replaced; a fix that no longer matches changes nothing */
function applyTo(d: Draft, fix: { find: string; replace: string }): Draft {
  const i = d.hooks.findIndex((h) => h.includes(fix.find));
  if (i >= 0) return { ...d, hooks: d.hooks.map((h, j) => (j === i ? h.replace(fix.find, fix.replace) : h)) };
  if (d.body.includes(fix.find)) return { ...d, body: d.body.replace(fix.find, fix.replace) };
  if (d.closing.includes(fix.find)) return { ...d, closing: d.closing.replace(fix.find, fix.replace) };
  return d;
}

const chip = (on: boolean) =>
  `rounded-full border px-3 py-1.5 text-sm ${on
    ? "border-[var(--ct-solid)] bg-[var(--ct-solid)] text-[var(--ct-solid-ink)]"
    : "border-[var(--ct-line)] bg-[var(--ct-panel)] text-[var(--ct-ink)] hover:bg-[var(--ct-soft)]"}`;

const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--ct-accent)]";

function when(iso: string): string {
  return new Date(iso).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function ContentStudio({ products, angles, lengths, initialHistory }: Props) {
  const [href, setHref] = useState(products[0]?.href ?? "");
  const [format, setFormat] = useState<Format>("post");
  const [angle, setAngle] = useState<AngleId>("");
  const [custom, setCustom] = useState("");
  const [length, setLength] = useState<Length>("60");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const [item, setItem] = useState<ContentItem | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hook, setHook] = useState(0);
  const [fixes, setFixes] = useState<Fix[] | null>(null);
  const [proofing, setProofing] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState(false);

  const [history, setHistory] = useState(initialHistory);
  const [histPlan, setHistPlan] = useState("");
  const [histStarred, setHistStarred] = useState(false);

  const nameOf = (h: string) => products.find((p) => p.href === h)?.name ?? h;

  async function runProofread(id: string) {
    setProofing(true);
    try {
      setFixes(await proofreadContent(id));
    } finally {
      setProofing(false);
    }
  }

  function open(next: ContentItem) {
    setItem(next);
    setDraft(draftOf(next));
    setHook(0);
    setApplied(new Set());
    setCopied(false);
    setFixes(next.flags.fixes);
    if (!next.flags.fixes) void runProofread(next.id);
  }

  function generate() {
    setError(undefined);
    start(async () => {
      let res: Awaited<ReturnType<typeof generateContent>>;
      try {
        res = await generateContent({ href, format, angle, custom, length: format === "script" ? length : null });
      } catch {
        /**
         * The connection dropped mid-write — on a phone, usually because the owner switched to
         * another app during the half-minute wait. The server carries on and saves the piece
         * regardless, so it is very likely already in the history rather than lost.
         */
        setError("การเชื่อมต่อหลุดระหว่างรอ ชิ้นงานอาจสร้างเสร็จแล้ว ลองดูใน “ที่เคยสร้าง” ด้านล่างก่อนกดสร้างใหม่นะครับ");
        setHistory(await contentHistory({ planHref: histPlan || undefined, starred: histStarred }).catch(() => history));
        return;
      }
      if (!res.ok) { setError(res.error); return; }
      open(res.item);
      setHistory((list) => [res.item, ...list.filter((x) => x.id !== res.item.id)]);
    });
  }

  function accept(fix: { find: string; replace: string }) {
    setDraft((d) => (d ? applyTo(d, fix) : d));
    setApplied((s) => new Set(s).add(fix.find));
  }

  async function copy() {
    if (!item || !draft) return;
    const text = fullText({
      ...item.output,
      hooks: draft.hooks, body: draft.body, closing: draft.closing,
      hashtags: draft.tags.split(/\s+/).filter(Boolean),
    }, hook);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("คัดลอกไม่ได้ ลองเลือกข้อความแล้วคัดลอกเองนะครับ");
    }
  }

  async function toggleStar(target: ContentItem) {
    const starred = !target.starred;
    await starContent(target.id, starred);
    const flip = (x: ContentItem) => (x.id === target.id ? { ...x, starred } : x);
    setHistory((list) => list.map(flip));
    setItem((x) => (x ? flip(x) : x));
  }

  async function filterHistory(plan: string, starred: boolean) {
    setHistPlan(plan);
    setHistStarred(starred);
    setHistory(await contentHistory({ planHref: plan || undefined, starred }));
  }

  const flagged = item && (item.flags.numbers.length > 0 || item.flags.words.length > 0);
  const openFixes = (fixes ?? []).filter((f) => !applied.has(f.find));

  return (
    <div>
      <h1 className="text-xl font-semibold">สร้างคอนเทนต์</h1>
      <p className="mt-1 text-sm text-[var(--ct-mute)]">
        เลือกแบบประกัน แล้วให้ AI เขียนโพสต์หรือสคริปต์จากข้อมูลจริงของแบบนั้น ตัวเลขทุกตัวมาจากตารางเบี้ย อ่านทวนก่อนโพสต์ทุกครั้ง
      </p>

      <section className="mt-5 space-y-4 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
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
              <button key={f.id} type="button" aria-pressed={format === f.id} onClick={() => setFormat(f.id)} className={chip(format === f.id)}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {format === "script" && (
          <div>
            <span className="mb-1.5 block text-sm font-medium">ความยาวคลิป</span>
            <div className="flex flex-wrap gap-2">
              {lengths.map((l) => (
                <button key={l.id} type="button" aria-pressed={length === l.id} onClick={() => setLength(l.id)} className={chip(length === l.id)}>
                  {l.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-sm font-medium">มุมที่อยากเล่า <span className="font-normal text-[var(--ct-mute)]">(ไม่เลือกก็ได้)</span></span>
          <div className="flex flex-wrap gap-2">
            <button type="button" aria-pressed={angle === ""} onClick={() => setAngle("")} className={chip(angle === "")}>ให้ AI เลือก</button>
            {angles.map((a) => (
              <button key={a.id} type="button" aria-pressed={angle === a.id} onClick={() => setAngle(a.id as AngleId)} className={chip(angle === a.id)}>
                {a.label}
              </button>
            ))}
            <button type="button" aria-pressed={angle === "custom"} onClick={() => setAngle("custom")} className={chip(angle === "custom")}>พิมพ์เอง</button>
          </div>
          {angle === "custom" && (
            <input
              value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={120}
              placeholder="เช่น คนทำงานฟรีแลนซ์ที่ไม่มีสวัสดิการ"
              className={`${field} mt-2`}
            />
          )}
        </div>

        {error && (
          <p role="alert" className="rounded-lg border border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] px-3 py-2 text-sm text-[var(--ct-alert)]">{error}</p>
        )}

        <button
          type="button" onClick={generate} disabled={pending || !href}
          className="w-full rounded-lg bg-[var(--ct-solid)] px-4 py-2.5 text-sm font-medium text-[var(--ct-solid-ink)] disabled:opacity-50 sm:w-auto"
        >
          {pending ? "กำลังเขียน… (ราว 20–40 วินาที)" : "สร้างคอนเทนต์"}
        </button>
      </section>

      {item && draft && (
        <section className="mt-5 rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)] p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-base font-semibold">
              {nameOf(item.planHref)} · {item.format === "post" ? "โพสต์เฟซบุ๊ก" : "สคริปต์วิดีโอ"}
            </h2>
            <span className="text-xs text-[var(--ct-mute)]">{item.model} · ฿{item.costThb.toFixed(2)}</span>
          </div>

          <fieldset className="mt-4">
            <legend className="mb-1.5 text-sm font-medium">ประโยคเปิด — เลือก 1 แบบ</legend>
            <div className="space-y-2">
              {draft.hooks.map((h, i) => (
                <label key={i} className={`flex gap-2 rounded-lg border p-2 ${hook === i ? "border-[var(--ct-accent)] bg-[var(--ct-soft)]" : "border-[var(--ct-hair)]"}`}>
                  <input type="radio" name="hook" checked={hook === i} onChange={() => setHook(i)} className="mt-2.5" />
                  <textarea
                    value={h} rows={2} aria-label={`ประโยคเปิดแบบที่ ${i + 1}`}
                    onChange={(e) => setDraft({ ...draft, hooks: draft.hooks.map((x, j) => (j === i ? e.target.value : x)) })}
                    className="w-full resize-y bg-transparent text-sm leading-relaxed outline-none"
                  />
                </label>
              ))}
            </div>
          </fieldset>

          <label className="mt-4 block">
            <span className="mb-1 block text-sm font-medium">เนื้อหา</span>
            <textarea value={draft.body} rows={item.format === "script" ? 14 : 10} onChange={(e) => setDraft({ ...draft, body: e.target.value })} className={field} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium">ประโยคปิด</span>
            <textarea value={draft.closing} rows={2} onChange={(e) => setDraft({ ...draft, closing: e.target.value })} className={field} />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-sm font-medium">แฮชแท็ก</span>
            <input value={draft.tags} onChange={(e) => setDraft({ ...draft, tags: e.target.value })} className={field} />
          </label>
          <p className="mt-3 whitespace-pre-line text-xs text-[var(--ct-mute)]">
            ต่อท้ายให้อัตโนมัติ: {item.output.disclaimer}
          </p>

          {(flagged || proofing || openFixes.length > 0) && (
            <div className="mt-4 space-y-3 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
              {item.flags.numbers.length > 0 && (
                <div>
                  <p className="font-medium">ตัวเลขที่ไม่มีในข้อมูลของแบบนี้ — ตรวจก่อนโพสต์</p>
                  <p className="mt-0.5">{item.flags.numbers.join(" · ")}</p>
                </div>
              )}
              {item.flags.words.length > 0 && (
                <div>
                  <p className="font-medium">คำที่ควรเลี่ยงหรือสะกดผิด</p>
                  <ul className="mt-1 space-y-1">
                    {item.flags.words.map((w) => (
                      <li key={w.word} className="flex flex-wrap items-center gap-2">
                        <span>{w.kind === "banned" ? `“${w.word}” — คำโฆษณาที่ควรเลี่ยง` : `“${w.word}” → “${w.fix}”`}</span>
                        {w.fix && !applied.has(w.word) && (
                          <button type="button" onClick={() => accept({ find: w.word, replace: w.fix! })} className="rounded border border-[var(--ct-warn-line)] bg-[var(--ct-panel)] px-2 py-0.5 text-xs">แก้</button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {proofing && <p>กำลังตรวจภาษา…</p>}
              {openFixes.length > 0 && (
                <div>
                  <p className="font-medium">AI ตรวจภาษาเสนอแก้</p>
                  <ul className="mt-1 space-y-1">
                    {openFixes.map((f) => (
                      <li key={f.find} className="flex flex-wrap items-center gap-2">
                        <span>“{f.find}” → “{f.replace}”{f.why ? <span className="opacity-75"> ({f.why})</span> : null}</span>
                        <button type="button" onClick={() => accept(f)} className="rounded border border-[var(--ct-warn-line)] bg-[var(--ct-panel)] px-2 py-0.5 text-xs">รับ</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={copy} className="rounded-lg bg-[var(--ct-solid)] px-4 py-2 text-sm font-medium text-[var(--ct-solid-ink)]">
              {copied ? "คัดลอกแล้ว ✓" : "คัดลอกทั้งชิ้น"}
            </button>
            <button type="button" onClick={generate} disabled={pending} className="rounded-lg border border-[var(--ct-line)] px-4 py-2 text-sm disabled:opacity-50">
              สร้างใหม่
            </button>
            <button type="button" onClick={() => toggleStar(item)} aria-pressed={item.starred} className="rounded-lg border border-[var(--ct-line)] px-4 py-2 text-sm">
              {item.starred ? "★ ติดดาวแล้ว" : "☆ ติดดาว"}
            </button>
          </div>

          {item.output.imagePrompt && (
            <details className="mt-4 text-sm">
              <summary className="cursor-pointer text-[var(--ct-mute)]">คำสั่งวาดรูปประกอบ (ใช้กับเครื่องมือสร้างรูป)</summary>
              <p className="mt-2 rounded-lg bg-[var(--ct-ground)] p-2 text-xs">{item.output.imagePrompt}</p>
            </details>
          )}
        </section>
      )}

      <section className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-semibold">ที่เคยสร้าง</h2>
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <select value={histPlan} onChange={(e) => filterHistory(e.target.value, histStarred)} aria-label="กรองตามแบบประกัน" className="rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-2 py-1">
              <option value="">ทุกแบบ</option>
              {products.map((p) => <option key={p.href} value={p.href}>{p.name}</option>)}
            </select>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={histStarred} onChange={(e) => filterHistory(histPlan, e.target.checked)} />
              เฉพาะที่ติดดาว
            </label>
          </div>
        </div>
        {history.length === 0 ? (
          <p className="mt-3 rounded-lg border border-dashed border-[var(--ct-line)] px-3 py-6 text-center text-sm text-[var(--ct-mute)]">ยังไม่มีชิ้นงาน</p>
        ) : (
          <ul className="mt-3 divide-y divide-[var(--ct-hair)] rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
            {history.map((h) => (
              <li key={h.id} className="flex items-start gap-3 p-3">
                <button type="button" onClick={() => { open(h); window.scrollTo({ top: 0, behavior: "smooth" }); }} className="min-w-0 flex-1 text-left">
                  <p className="text-xs text-[var(--ct-mute)]">
                    {when(h.createdAt)} · {nameOf(h.planHref)} · {h.format === "post" ? "โพสต์" : "สคริปต์"}
                    {(h.flags.numbers.length > 0 || h.flags.words.length > 0) && " · มีจุดต้องตรวจ"}
                  </p>
                  <p className="mt-0.5 truncate text-sm">{h.output.hooks[0]}</p>
                </button>
                <button type="button" onClick={() => toggleStar(h)} aria-label={h.starred ? "เอาดาวออก" : "ติดดาว"} className="shrink-0 text-lg leading-none text-[var(--ct-accent)]">
                  {h.starred ? "★" : "☆"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
