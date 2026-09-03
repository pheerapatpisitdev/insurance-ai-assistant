"use client";
import { useState, useTransition } from "react";
import { Card, Empty } from "../ui";
import { saveApiKey, setModelEnabled, saveSettings, type KeyRow, type ModelRow, type Settings } from "./actions";

const PROVIDER_LABEL: Record<string, string> = {
  anthropic: "Anthropic (Claude)", openai: "OpenAI (GPT)", google: "Google (Gemini)", xai: "xAI (Grok)", zai: "Z.ai (GLM)",
};

export function AiClient({ keys, models, settings, providers }: { keys: KeyRow[]; models: ModelRow[]; settings: Settings | null; providers: string[] }) {
  const [pending, start] = useTransition();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string>();
  const tailOf = (p: string) => keys.find((k) => k.provider === p)?.tail;
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

      <Card title="กุญแจ API" hint="แสดงเฉพาะ 4 ตัวท้าย ใส่ค่าใหม่เพื่อแทนที่ทั้งหมด">
        <div className="space-y-2">
          {providers.map((p) => (
            <div key={p} className="flex flex-wrap items-center gap-2 rounded-md border p-2">
              <span className="w-44 text-sm">{PROVIDER_LABEL[p] ?? p}</span>
              <span className="w-24 text-xs text-slate-500">{tailOf(p) ? `••••${tailOf(p)}` : "ยังไม่ได้ตั้ง"}</span>
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

      <Card title="ค่าเริ่มต้น" hint="โมเดลที่ใช้ตอบคำถาม และเพดานค่าใช้จ่ายต่อเดือน">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            const budget = String(f.get("budget") ?? "").trim();
            run(() => saveSettings(String(f.get("model")), budget === "" ? null : Number(budget)), "บันทึกค่าเริ่มต้นแล้ว");
          }}
        >
          <label className="text-sm">
            <span className="block text-xs text-slate-500">โมเดลเริ่มต้น</span>
            <select name="model" defaultValue={settings?.default_text_model ?? ""} className="mt-1 rounded border px-2 py-1">
              {textModels.map((m) => <option key={m.id} value={m.model_name}>{m.model_name}</option>)}
            </select>
          </label>
          <label className="text-sm">
            <span className="block text-xs text-slate-500">งบต่อเดือน (บาท)</span>
            <input name="budget" type="number" min={0} step={50} defaultValue={settings?.monthly_budget_thb ?? ""}
                   className="mt-1 w-32 rounded border px-2 py-1" placeholder="ไม่จำกัด" />
          </label>
          <button disabled={pending} className="rounded bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40">บันทึก</button>
        </form>
      </Card>
    </>
  );
}
