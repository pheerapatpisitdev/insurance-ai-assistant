"use client";
import { useState, useTransition } from "react";
import { Card, Empty } from "../ui";
import {
  checkKeys, saveApiKey, setModelEnabled, saveSettings,
  type KeyRow, type ModelRow, type ProviderCheck, type Settings,
} from "./actions";

/**
 * The result of the last test, or a space where one has not been run.
 *
 * The reason a failure gives is shown rather than summarised. "ตัวไหนหยุดทำงาน" is only half
 * the question — a key that has expired and a provider that is briefly down want different
 * things done about them, and only the provider's own words tell them apart.
 */
function Status({ check }: { check?: ProviderCheck }) {
  if (!check) return <span className="w-28 text-xs text-slate-300">ยังไม่ได้ทดสอบ</span>;
  const chip = "inline-block rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap";
  if (check.state === "ok") {
    return (
      <span className="flex w-28 items-baseline gap-1.5">
        <span className={`${chip} bg-emerald-100 text-emerald-800`}>ใช้ได้</span>
        <span className="text-[0.65rem] tabular-nums text-slate-400">{(check.ms / 1000).toFixed(1)}s</span>
      </span>
    );
  }
  if (check.state === "no-key") return <span className="w-28 text-xs text-slate-400">ยังไม่ได้ตั้งกุญแจ</span>;
  if (check.state === "no-model") {
    return <span className={`${chip} w-28 bg-amber-100 text-amber-800`}>ไม่มีโมเดล</span>;
  }
  return (
    <span className="flex w-28 flex-col gap-0.5">
      <span className={`${chip} self-start bg-red-100 text-red-700`}>หยุดทำงาน</span>
      {check.error && <span className="break-words text-[0.65rem] leading-tight text-red-600">{check.error}</span>}
    </span>
  );
}

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT)", google: "Google (Gemini)", xai: "xAI (Grok)", zai: "Z.ai (GLM)",
};

export function AiClient({ keys, models, settings, providers, spentThisMonth }: {
  keys: KeyRow[]; models: ModelRow[]; settings: Settings | null; providers: string[]; spentThisMonth: number;
}) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const tailOf = (p: string) => keys.find((k) => k.provider === p)?.tail;
  /**
   * What the last test said, until the page is reloaded. Nothing is shown before one is run:
   * a key's health is not knowable without asking, and a guess dressed as a status is worse
   * than an empty column.
   */
  const [checks, setChecks] = useState<ProviderCheck[]>();
  const [testing, setTesting] = useState(false);
  const checkOf = (p: string) => checks?.find((c) => c.provider === p);
  const textModels = models.filter((m) => m.kind === "text");

  const run = (fn: () => Promise<void>, ok: string) =>
    start(async () => {
      try {
        await fn();
        setMessage(ok);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "บันทึกไม่สำเร็จ");
      }
    });

  return (
    <>
      {message && <p className="mb-4 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">{message}</p>}

      <Card title="กุญแจ API" hint="เก็บแยกจากระบบอื่น เข้ารหัสไว้ในฐานข้อมูล แสดงเฉพาะ 4 ตัวท้าย">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <button
            type="button" disabled={testing}
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40"
            onClick={async () => {
              setTesting(true);
              setMessage(undefined);
              try {
                setChecks(await checkKeys());
              } catch (err) {
                setMessage(err instanceof Error ? err.message : "ทดสอบไม่สำเร็จ");
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? "กำลังทดสอบ…" : "ทดสอบกุญแจทั้งหมด"}
          </button>
          <span className="text-xs text-slate-500">
            {checks
              ? `ตอบได้ ${checks.filter((c) => c.state === "ok").length} จาก ${checks.length} ค่าย`
              : "ส่งคำถามสั้นๆ ไปทุกค่ายเพื่อดูว่ากุญแจไหนยังใช้ได้ — ราคาไม่ถึงหนึ่งสตางค์"}
          </span>
        </div>
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <span className="w-44 text-sm">{PROVIDER_LABEL[p] ?? p}</span>
              <span className="w-24 text-xs text-slate-500">{tailOf(p) ? `••••${tailOf(p)}` : "ยังไม่ได้ตั้ง"}</span>
              <Status check={checkOf(p)} />
              <input
                type="password" placeholder="วางกุญแจใหม่" autoComplete="off"
                className="min-w-48 flex-1 rounded border px-2 py-1 text-sm"
                value={draft[p] ?? ""} onChange={(e) => setDraft({ ...draft, [p]: e.target.value })}
              />
              <button
                type="button" disabled={pending || !(draft[p] ?? "").trim()}
                className="rounded bg-slate-900 px-3 py-1 text-xs text-white disabled:opacity-40"
                onClick={() => run(async () => { await saveApiKey(p, draft[p]); setDraft({ ...draft, [p]: "" }); }, `บันทึกกุญแจ ${PROVIDER_LABEL[p] ?? p} แล้ว`)}
              >
                บันทึก
              </button>
            </div>
          ))}
        </div>
      </Card>

      <Card title="โมเดล" hint="ปิดโมเดลที่ไม่ต้องการให้ระบบเลือกใช้">
        {models.length === 0 ? <Empty>ยังไม่มีโมเดลในระบบ</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-slate-500"><th className="py-2">ค่าย</th><th className="py-2 pl-3">ประเภท</th><th className="py-2 pl-3">โมเดล</th><th className="py-2 pl-3">ใช้งาน</th></tr></thead>
              <tbody>
                {models.map((m) => (
                  <tr key={m.id} className="border-b">
                    <td className="py-1.5">{m.provider}</td>
                    <td className="py-1.5 pl-3">{m.kind === "text" ? "ข้อความ" : "รูปภาพ"}</td>
                    <td className="py-1.5 pl-3 font-mono text-xs">{m.model_name}</td>
                    <td className="py-1.5 pl-3">
                      <input type="checkbox" checked={m.enabled} disabled={pending}
                             onChange={(e) => run(() => setModelEnabled(m.id, e.target.checked), "อัปเดตโมเดลแล้ว")} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="ค่าเริ่มต้นและงบ" hint="โมเดลเล็กใช้แยกข้อความและตอบสั้น โมเดลใหญ่ใช้ตอบจากเอกสาร">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const budget = String(f.get("budget") ?? "").trim();
            run(() => saveSettings(String(f.get("small")), String(f.get("large")), budget === "" ? null : Number(budget)),
                "บันทึกค่าเริ่มต้นแล้ว");
          }}
        >
          <label className="text-sm">
            <span className="block text-xs text-slate-500">โมเดลเล็ก</span>
            <select name="small" defaultValue={settings?.small_model ?? ""} className="mt-1 rounded border px-2 py-1">
              <option value="">เลือกอัตโนมัติ</option>
              {textModels.map((m) => <option key={m.id} value={m.model_name}>{m.model_name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-slate-500">โมเดลใหญ่</span>
            <select name="large" defaultValue={settings?.large_model ?? ""} className="mt-1 rounded border px-2 py-1">
              <option value="">เลือกอัตโนมัติ</option>
              {textModels.map((m) => <option key={m.id} value={m.model_name}>{m.model_name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-slate-500">งบต่อเดือน (บาท)</span>
            <input name="budget" type="number" min={0} step={50} defaultValue={settings?.monthly_budget_thb ?? ""}
                   className="mt-1 w-32 rounded border px-2 py-1" placeholder="ไม่จำกัด" />
          </label>
          <button disabled={pending} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">บันทึก</button>
          <span className="text-xs text-slate-500">
            ใช้ไปเดือนนี้ {spentThisMonth.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท
          </span>
        </form>
      </Card>
    </>
  );
}
