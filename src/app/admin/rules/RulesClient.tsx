"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Card } from "../ui";
import { EDITABLE_BASE_FIELDS, EDITABLE_RIDER_FIELDS, type RuleOverride } from "@/calc/plans/overrides";
import { saveOverride, clearOverride, type RulesPageData } from "./actions";

type Draft = Record<string, string>;
const keyOf = (section: string, field: string) => `${section}.${field}`;
const show = (v: unknown) => (v === undefined || v === null ? "" : String(v));

export function RulesClient({ data }: { data: RulesPageData }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string>();
  const [draft, setDraft] = useState<Draft>({});

  const baseRules = data.baseline as unknown as Record<string, Record<string, unknown>>;
  const effRules = data.effective as unknown as Record<string, Record<string, unknown>>;

  const current = (section: string, field: string) => {
    const k = keyOf(section, field);
    if (k in draft) return draft[k];
    const src = section === "base" ? effRules.base : (effRules.riders as Record<string, Record<string, unknown>>)[section];
    return show(src?.[field]);
  };
  const original = (section: string, field: string) => {
    const src = section === "base" ? baseRules.base : (baseRules.riders as Record<string, Record<string, unknown>>)[section];
    return show(src?.[field]);
  };
  const changed = (section: string, field: string) => current(section, field) !== original(section, field);

  function buildPatch(): RuleOverride {
    const patch: RuleOverride = {};
    for (const f of EDITABLE_BASE_FIELDS) {
      if (changed("base", f.key)) {
        const v = current("base", f.key);
        patch.base = { ...(patch.base ?? {}), [f.key]: v === "" ? undefined : Number(v) };
      }
    }
    for (const code of Object.keys(data.effective.riders)) {
      for (const f of EDITABLE_RIDER_FIELDS) {
        if (changed(code, f.key)) {
          const v = current(code, f.key);
          patch.riders = { ...(patch.riders ?? {}), [code]: { ...(patch.riders?.[code] ?? {}), [f.key]: v === "" ? undefined : Number(v) } };
        }
      }
    }
    return patch;
  }

  const diffCount = () => {
    const p = buildPatch();
    return Object.keys(p.base ?? {}).length + Object.values(p.riders ?? {}).reduce((s, r) => s + Object.keys(r).length, 0);
  };

  function save() {
    const patch = buildPatch();
    const n = diffCount();
    if (n === 0) { setMessage("ยังไม่มีอะไรเปลี่ยน"); return; }
    if (!confirm(`ยืนยันบันทึกกฎ ${n} รายการ\n\nตัวเลขที่ตัวแทนใช้เสนอลูกค้าจะเปลี่ยนทันที`)) return;
    start(async () => {
      try {
        await saveOverride(data.planCode, patch);
        setDraft({});
        setMessage("บันทึกแล้ว เว็บคำนวณใช้ค่าใหม่ทันที");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });
  }

  function reset() {
    if (!confirm("คืนค่ากฎทั้งหมดของแบบนี้กลับเป็นค่าเดิมในโค้ด?")) return;
    start(async () => {
      try {
        await clearOverride(data.planCode);
        setDraft({});
        setMessage("คืนค่าเดิมแล้ว");
        router.refresh();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "คืนค่าไม่สำเร็จ");
      }
    });
  }

  const field = (section: string, f: { key: string; label: string }) => {
    const isChanged = changed(section, f.key);
    return (
      <label key={f.key} className="text-sm">
        <span className="block text-xs text-slate-500">{f.label}</span>
        <input
          type="number"
          className={`mt-1 w-36 rounded border px-2 py-1 ${isChanged ? "border-amber-500 bg-amber-50" : ""}`}
          value={current(section, f.key)}
          onChange={(e) => setDraft({ ...draft, [keyOf(section, f.key)]: e.target.value })}
        />
        {isChanged && <span className="mt-0.5 block text-xs text-amber-700">เดิม {original(section, f.key) || "—"}</span>}
      </label>
    );
  };

  return (
    <>
      {message && <p className="mb-4 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">{message}</p>}

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select value={data.planCode} className="rounded border px-2 py-1 text-sm"
                onChange={(e) => router.push(`/admin/rules?plan=${e.target.value}`)}>
          {data.plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        {data.hasOverride && <span className="rounded bg-amber-100 px-2 py-1 text-xs text-amber-800">แบบนี้ถูกแก้จากค่าเดิม</span>}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={reset} disabled={pending || !data.hasOverride}
                  className="rounded border px-3 py-1.5 text-sm disabled:opacity-40">คืนค่าเดิม</button>
          <button type="button" onClick={save} disabled={pending}
                  className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">บันทึก</button>
        </div>
      </div>

      <Card title="สัญญาหลัก">
        <div className="flex flex-wrap gap-4">{EDITABLE_BASE_FIELDS.map((f) => field("base", f))}</div>
      </Card>

      {Object.entries(data.effective.riders).map(([code, rule]) => (
        <Card key={code} title={`${rule.name} (${code})`}>
          <div className="flex flex-wrap gap-4">{EDITABLE_RIDER_FIELDS.map((f) => field(code, f))}</div>
        </Card>
      ))}

      <Card title="ประวัติการแก้ไข" hint="10 รายการล่าสุด">
        {data.history.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่เคยแก้</p>
        ) : (
          <ul className="space-y-1 text-sm">
            {data.history.map((h, i) => (
              <li key={i} className="text-slate-600">
                {new Date(h.created_at).toLocaleString("th-TH")} — {h.changed_by ?? "ไม่ทราบผู้แก้"}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
