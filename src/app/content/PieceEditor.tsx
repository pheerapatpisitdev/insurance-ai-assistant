"use client";
import { useEffect, useState } from "react";
import { atFold, FOLD, footer, fullText } from "@/lib/content/output";
import { defaultPoster, type PosterSpec } from "@/lib/content/poster";
import type { Fix } from "@/lib/content/proofread";
import { FORMAT_LABEL } from "@/lib/content/prompt";
import { AD_LIMITS } from "@/lib/content/ads";
import type { ContentItem } from "@/lib/content/store";
import { proofreadContent, saveContentEdits, type DrawBackgroundResult } from "./actions";
import { PosterPanel } from "./PosterPanel";
import { PublishPanel } from "./PublishPanel";
import { ask } from "./ask";

/**
 * One piece opened across the workbench: every part editable, the checks beside it.
 *
 * The checks sit beside the words rather than inside them: amounts the tables never had, words
 * on the owner's list, Facebook's rules, and the proofreader's suggestions. The last two kinds
 * that carry a fix are one click to accept. Nothing changes without that click, and the checks
 * are run again on every save, because an edit can add a number as easily as a model can.
 */

interface Draft {
  hooks: string[];
  body: string;
  closing: string;
  tags: string;
  poster: PosterSpec;
}

const draftOf = (item: ContentItem, productName: string): Draft => ({
  hooks: [...item.output.hooks],
  body: item.output.body,
  closing: item.output.closing,
  tags: item.output.hashtags.join(" "),
  poster: item.output.poster ?? defaultPoster(item.output.hooks[0], productName),
});

/** the first place `find` occurs, replaced; a fix that no longer matches changes nothing */
function applyTo(d: Draft, fix: { find: string; replace: string }): Draft {
  const i = d.hooks.findIndex((h) => h.includes(fix.find));
  if (i >= 0) return { ...d, hooks: d.hooks.map((h, j) => (j === i ? h.replace(fix.find, fix.replace) : h)) };
  if (d.body.includes(fix.find)) return { ...d, body: d.body.replace(fix.find, fix.replace) };
  if (d.closing.includes(fix.find)) return { ...d, closing: d.closing.replace(fix.find, fix.replace) };
  return d;
}

const field = "w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm leading-relaxed outline-none focus:border-[var(--ct-accent)]";
const smallBtn = "rounded border border-[var(--ct-warn-line)] bg-[var(--ct-panel)] px-2 py-0.5 text-xs";

interface Props {
  item: ContentItem;
  productName: string;
  /** the page is drawing this piece's photograph already */
  drawing?: boolean;
  onSaved: (item: ContentItem) => void;
  /** orders a picture through the page, which shows it drawing on the card and in here */
  onDraw: (request: string, painter: string) => Promise<DrawBackgroundResult>;
  onStatus: (status: ContentItem["status"]) => void;
  /** posted, scheduled or taken back: the piece as it now stands */
  onPublished: (item: ContentItem) => void;
  onClose: () => void;
}

export function PieceEditor({ item, productName, drawing, onSaved, onDraw, onStatus, onPublished, onClose }: Props) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(item, productName));
  const [hook, setHook] = useState(0);
  const [fixes, setFixes] = useState<Fix[] | null>(item.flags.fixes);
  const [proofing, setProofing] = useState(false);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState<string>();
  // the owner chose the plain colour over a photograph; until then a save keeps the photograph
  const [plain, setPlain] = useState(false);

  /**
   * A photograph that lands while the editor is open joins the draft. Without this the draft
   * still held the poster from before it, and the next save wrote that back — a paid picture
   * dropped by pressing บันทึก.
   */
  const landed = item.output.poster?.background;
  useEffect(() => {
    if (landed && !plain) setDraft((d) => (d.poster.background === landed ? d : { ...d, poster: { ...d.poster, background: landed } }));
  }, [landed, plain]);

  // the proofreader runs on first opening and is kept: one small call per piece, ever
  useEffect(() => {
    if (item.flags.fixes) return;
    let live = true;
    setProofing(true);
    proofreadContent(item.id).then((f) => { if (live) setFixes(f); }).catch(() => {}).finally(() => { if (live) setProofing(false); });
    return () => { live = false; };
  }, [item.id, item.flags.fixes]);

  const edit = (next: Draft) => { setDraft(next); setDirty(true); setNote(undefined); };
  const accept = (fix: { find: string; replace: string }) => {
    edit(applyTo(draft, fix));
    setApplied((s) => new Set(s).add(fix.find));
  };

  const output = {
    ...item.output,
    hooks: draft.hooks, body: draft.body, closing: draft.closing,
    hashtags: draft.tags.split(/\s+/).filter(Boolean),
    poster: draft.poster,
  };
  const isAd = item.format === "ad";
  // an ad is pasted into Ads Manager field by field; its primary text carries the regulator's line
  const text = isAd ? `${draft.body}\n\n${footer(output)}` : fullText(output, hook);
  const fold = atFold(isAd ? draft.body : text);

  async function save(): Promise<boolean> {
    if (!dirty) return true;
    setSaving(true);
    const res = await saveContentEdits(item.id, output, { plain }).catch(() => null);
    setSaving(false);
    if (!res || !res.ok) { setNote(res?.error ?? "บันทึกไม่สำเร็จ"); return false; }
    setDirty(false);
    onSaved(res.item);
    setNote("บันทึกแล้ว — ตรวจตัวเลขและกฎใหม่แล้ว");
    return true;
  }

  /**
   * The clipboard first, straight from the tap — iPhone Safari refuses a write that waits on
   * the network — then the save; a save that fails says so instead of "คัดลอกแล้ว".
   */
  async function copy(what = text, label = "คัดลอกแล้ว ✓ วางในเฟซบุ๊กได้เลย") {
    let copied = true;
    await navigator.clipboard.writeText(what).catch(() => { copied = false; });
    const kept = await save();
    if (!kept) return; // save() has put its error in the note
    setNote(copied ? label : "คัดลอกไม่ได้ ลองเลือกข้อความแล้วคัดลอกเองนะครับ");
  }

  /** back to the list; unsaved words are asked about, not dropped */
  async function leave() {
    if (dirty && !(await ask("ยังไม่ได้บันทึกการแก้ไข ออกโดยไม่บันทึกไหม?", "ออกโดยไม่บันทึก"))) return;
    onClose();
  }

  const flags = item.flags;
  const policy = flags.policy ?? [];
  const openFixes = (fixes ?? []).filter((f) => !applied.has(f.find));
  const words = flags.words.filter((w) => !applied.has(w.word));
  const anything = flags.numbers.length > 0 || words.length > 0 || policy.length > 0 || proofing || openFixes.length > 0;

  return (
    <section className="rounded-xl border-2 border-[var(--ct-accent)] bg-[var(--ct-panel)] p-4">
      <button type="button" onClick={leave} className="-ml-1 rounded-lg px-1 py-1 text-sm font-medium text-[var(--ct-accent)] hover:bg-[var(--ct-soft)]">
        ← กลับไปรายการ
      </button>
      <div className="mt-2">
        <h2 className="text-base font-semibold">{productName} · {FORMAT_LABEL[item.format]}</h2>
        {item.output.angle && <p className="mt-0.5 text-xs text-[var(--ct-mute)]">มุม: {item.output.angle}</p>}
      </div>

      {item.format !== "script" && <div className="mt-4">
        <p className="mb-1.5 text-sm font-medium">รูปโพสต์</p>
        <PosterPanel
          value={draft.poster}
          onChange={(poster) => {
            if (draft.poster.background && !poster.background) setPlain(true);
            if (poster.background) setPlain(false);
            edit({ ...draft, poster });
          }}
          busy={drawing}
          onDraw={async (request, painter) => {
            const res = await onDraw(request, painter);
            if (!res.ok) return res.error;
            // the picture is saved already; only the background joins the draft, so poster
            // words the owner has typed but not yet saved are kept
            const background = res.item.output.poster?.background;
            setPlain(false);
            setDraft((d) => ({ ...d, poster: { ...d.poster, background } }));
            return null;
          }}
        />
      </div>}

      {isAd ? (
        <div className="mt-4 space-y-3">
          <p className="text-xs text-[var(--ct-mute)]">3 ช่องนี้ตรงกับช่องใน Facebook Ads Manager — กดคัดลอกทีละช่องไปวางได้เลย</p>
          {([
            ["ข้อความหลัก (Primary text)", draft.body, (v: string) => edit({ ...draft, body: v }), null, 8],
            ["พาดหัว (Headline) — ใต้ภาพ ข้างปุ่ม", draft.hooks[0] ?? "", (v: string) => edit({ ...draft, hooks: [v] }), AD_LIMITS.headline, 1],
            ["คำอธิบาย (Description)", draft.closing, (v: string) => edit({ ...draft, closing: v }), AD_LIMITS.description, 1],
          ] as const).map(([label, value, set, limit, rows]) => {
            const n = [...value].length;
            return (
              <label key={label} className="block">
                <span className="mb-1 flex items-center justify-between gap-2 text-sm font-medium">
                  <span>{label}</span>
                  <span className="flex items-center gap-2">
                    {limit && <span className={`text-xs font-normal ${n > limit ? "text-[var(--ct-alert)]" : "text-[var(--ct-mute)]"}`}>{n}/{limit}</span>}
                    <button type="button" onClick={() => copy(label.startsWith("ข้อความหลัก") ? text : value, "คัดลอกแล้ว ✓ วางใน Ads Manager ได้เลย")} className="rounded border border-[var(--ct-line)] px-2 py-0.5 text-xs font-normal">คัดลอก</button>
                  </span>
                </span>
                {rows > 1
                  ? <textarea value={value} rows={rows} onChange={(e) => set(e.target.value)} className={field} />
                  : <input value={value} onChange={(e) => set(e.target.value)} className={field} />}
              </label>
            );
          })}
        </div>
      ) : (
        <>
        <fieldset className="mt-4">
          <legend className="mb-1.5 text-sm font-medium">ประโยคเปิด{draft.hooks.length > 1 ? " — เลือก 1 แบบ" : ""}</legend>
          <div className="space-y-2">
            {draft.hooks.map((h, i) => (
              <label key={i} className={`flex gap-2 rounded-lg border p-2 ${hook === i ? "border-[var(--ct-accent)] bg-[var(--ct-soft)]" : "border-[var(--ct-hair)]"}`}>
                {draft.hooks.length > 1 && <input type="radio" name={`hook-${item.id}`} checked={hook === i} onChange={() => setHook(i)} className="mt-2.5" />}
                <textarea
                  value={h} rows={2} aria-label={`ประโยคเปิดแบบที่ ${i + 1}`}
                  onChange={(e) => edit({ ...draft, hooks: draft.hooks.map((x, j) => (j === i ? e.target.value : x)) })}
                  className="w-full resize-y bg-transparent text-sm font-medium leading-relaxed outline-none"
                />
              </label>
            ))}
          </div>
        </fieldset>

        <label className="mt-4 block">
          <span className="mb-1 block text-sm font-medium">เนื้อหา</span>
          <textarea value={draft.body} rows={item.format === "script" ? 14 : 10} onChange={(e) => edit({ ...draft, body: e.target.value })} className={field} />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium">ประโยคปิด</span>
          <textarea value={draft.closing} rows={2} onChange={(e) => edit({ ...draft, closing: e.target.value })} className={field} />
        </label>
        <label className="mt-3 block">
          <span className="mb-1 block text-sm font-medium">แฮชแท็ก</span>
          <input value={draft.tags} onChange={(e) => edit({ ...draft, tags: e.target.value })} className={field} />
        </label>
        </>
      )}
      <p className="mt-3 whitespace-pre-line text-xs text-[var(--ct-mute)]">ต่อท้ายให้อัตโนมัติ:{"\n"}{footer(output)}</p>

      {item.format !== "script" && (
        <div className="mt-4 rounded-lg bg-[var(--ct-ground)] p-3 text-sm">
          <p className="mb-1 text-xs font-medium text-[var(--ct-mute)]">
            คนเห็นก่อนกด “ดูเพิ่มเติม” ({Math.min(fold.length, FOLD)}/{FOLD} ตัวอักษรแรก)
          </p>
          <p className="whitespace-pre-line leading-relaxed">
            {fold.shown}
            {fold.hidden && <span className="text-[var(--ct-mute)]">… ดูเพิ่มเติม</span>}
          </p>
        </div>
      )}

      {anything && (
        <div className="mt-4 space-y-3">
          {policy.length > 0 && (
            <div className="space-y-2">
              {policy.map((f) => (
                <div key={f.code} className={`rounded-lg border p-3 text-sm ${f.severity === "block"
                  ? "border-[var(--ct-alert-line)] bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]"
                  : "border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
                  <p className="font-medium">{f.severity === "block" ? "ผิดกฎโฆษณา Facebook" : "เสี่ยงผิดกฎ Facebook"}: “{f.match}”</p>
                  <p className="mt-0.5">{f.message}</p>
                  <p className="mt-0.5 opacity-80">แก้โดย: {f.fix}</p>
                </div>
              ))}
            </div>
          )}

          {(flags.numbers.length > 0 || words.length > 0 || proofing || openFixes.length > 0) && (
            <div className="space-y-3 rounded-lg border border-[var(--ct-warn-line)] bg-[var(--ct-warn-bg)] p-3 text-sm text-[var(--ct-warn-ink)]">
              {flags.numbers.length > 0 && (
                <div>
                  <p className="font-medium">ตัวเลขที่ไม่มีในข้อมูลของแบบนี้ — ตรวจก่อนโพสต์</p>
                  <p className="mt-0.5">{flags.numbers.join(" · ")}</p>
                </div>
              )}
              {words.length > 0 && (
                <div>
                  <p className="font-medium">คำที่ควรเลี่ยงหรือสะกดผิด</p>
                  <ul className="mt-1 space-y-1">
                    {words.map((w) => (
                      <li key={w.word} className="flex flex-wrap items-center gap-2">
                        <span>{w.kind === "banned" ? `“${w.word}” — คำโฆษณาที่ควรเลี่ยง` : `“${w.word}” → “${w.fix}”`}</span>
                        {w.fix && <button type="button" onClick={() => accept({ find: w.word, replace: w.fix! })} className={smallBtn}>แก้</button>}
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
                        <button type="button" onClick={() => accept(f)} className={smallBtn}>รับ</button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {item.format === "post" && <PublishPanel item={item} hook={hook} beforePublish={save} onPublished={onPublished} />}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => copy()} className="rounded-lg bg-[var(--ct-solid)] px-4 py-2 text-sm font-medium text-[var(--ct-solid-ink)]">
          {isAd ? "คัดลอกข้อความหลัก" : "คัดลอกทั้งชิ้น"}
        </button>
        <button type="button" onClick={save} disabled={!dirty || saving} className="rounded-lg border border-[var(--ct-line)] px-4 py-2 text-sm disabled:opacity-50">
          {saving ? "กำลังบันทึก…" : dirty ? "บันทึกการแก้ไข" : "บันทึกแล้ว"}
        </button>
        {item.status === "draft" && (
          <button type="button" onClick={async () => { if (await save()) onStatus("used"); }} className="rounded-lg border border-[var(--ct-line)] px-4 py-2 text-sm text-[var(--ct-accent)]">
            ✓ ใช้จริง
          </button>
        )}
        {note && <span role="status" className="text-sm text-[var(--ct-mute)]">{note}</span>}
        <button type="button" onClick={leave} className="ml-auto rounded-lg border border-[var(--ct-line)] px-4 py-2 text-sm">กลับไปรายการ</button>
      </div>

      <p className="mt-3 text-xs text-[var(--ct-mute)]">{item.model} · ฿{item.costThb.toFixed(2)}</p>

      {item.output.imagePrompt && (
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-[var(--ct-mute)]">คำสั่งวาดรูปประกอบ (ใช้กับเครื่องมือสร้างรูป)</summary>
          <p className="mt-2 rounded-lg bg-[var(--ct-ground)] p-2 text-xs">{item.output.imagePrompt}</p>
        </details>
      )}
    </section>
  );
}
