"use client";
import { useState, useTransition } from "react";
import { createKey, deleteKey, setKeyDisabled, type KeyRow } from "./actions";
import { Empty } from "../ui";

/**
 * The keys, and the one screen where a new one is readable.
 *
 * The new key is shown in the page rather than in an alert, and it stays until the next
 * action clears it, because copying from an alert on a phone is a gamble. What it must say
 * loudly is that this is the only time: the table keeps a hash, so a key closed without
 * copying is not a setting to look up again, it is a key to issue again.
 */
function Copy({ text }: { text: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); setDone(true); } catch { setDone(false); }
      }}
      className="shrink-0 rounded border border-amber-400 px-2 py-1 text-xs text-amber-900"
    >
      {done ? "คัดลอกแล้ว" : "คัดลอก"}
    </button>
  );
}

export function Keys({ rows, mcpBase }: { rows: KeyRow[]; mcpBase: string }) {
  const [name, setName] = useState("");
  const [quota, setQuota] = useState("");
  const [minted, setMinted] = useState<string>();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<void>) => start(async () => {
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
    }
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">
          ใครใช้กุญแจนี้
          <input
            value={name} onChange={(e) => setName(e.target.value)}
            placeholder="LINE OA ของทีม"
            className="mt-1 block w-56 rounded border px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
        <label className="text-xs text-slate-500">
          จำกัดกี่ครั้งต่อเดือน (เว้นว่าง = ไม่จำกัด)
          <input
            value={quota} onChange={(e) => setQuota(e.target.value.replace(/[^\d]/g, ""))}
            placeholder="5000" inputMode="numeric"
            className="mt-1 block w-44 rounded border px-2 py-1.5 text-sm text-slate-800"
          />
        </label>
        <button
          type="button" disabled={pending || !name.trim()}
          onClick={() => run(async () => {
            const { key } = await createKey(name, quota ? Number(quota) : null);
            setMinted(key);
            setCopied(false);
            setName(""); setQuota("");
          })}
          className="rounded bg-slate-900 px-3 py-2 text-sm text-white disabled:opacity-40"
        >
          {pending ? "กำลังสร้าง…" : "สร้างกุญแจ"}
        </button>
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {minted && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">
            คัดลอกเก็บไว้ตอนนี้เลย — กุญแจนี้จะไม่แสดงอีก
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            ระบบเก็บไว้แค่ค่าแฮช ถ้าทำหาย ต้องสร้างใหม่ (ของเก่าปิดทิ้งได้)
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="min-w-0 flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-xs text-slate-800">
              {minted}
            </code>
            <button
              type="button"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(minted);
                  setCopied(true);
                } catch { setCopied(false); }
              }}
              className="shrink-0 rounded border border-amber-400 px-2 py-1 text-xs text-amber-900"
            >
              {copied ? "คัดลอกแล้ว" : "คัดลอก"}
            </button>
            <button
              type="button" onClick={() => setMinted(undefined)}
              className="shrink-0 rounded px-2 py-1 text-xs text-amber-900 underline"
            >
              ปิด
            </button>
          </div>

          {/* the address Claude's connector settings can actually take, made here so the key
              is never pasted together by hand in the one place a typo is silent */}
          <div className="mt-3 border-t border-amber-200 pt-2">
            <p className="text-xs font-medium text-amber-900">
              สำหรับ Claude (Settings → Connectors → Add custom connector)
            </p>
            <div className="mt-1 flex items-center gap-2">
              <code className="min-w-0 flex-1 overflow-x-auto rounded bg-white px-2 py-1.5 text-xs text-slate-800">
                {`${mcpBase}/${minted}`}
              </code>
              <Copy text={`${mcpBase}/${minted}`} />
            </div>
            <p className="mt-1 text-xs text-amber-800">
              ที่อยู่นี้มีกุญแจอยู่ข้างใน — วางเฉพาะในช่อง connector ของ Claude
              ห้ามส่งต่อในแชทหรือใส่ในเอกสาร ถ้าหลุดให้กดปิดกุญแจนี้แล้วสร้างใหม่
            </p>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <Empty>ยังไม่มีกุญแจ — สร้างอันแรกด้านบนได้เลย</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-slate-500">
                <th className="py-2 pr-3">ชื่อ</th>
                <th className="py-2 pr-3">กุญแจ</th>
                <th className="py-2 pr-3 text-right">ใช้เดือนนี้</th>
                <th className="py-2 pr-3">ใช้ล่าสุด</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((k) => (
                <tr key={k.id} className={`border-b ${k.disabled ? "opacity-50" : ""}`}>
                  <td className="py-2 pr-3 font-medium text-slate-800">
                    {k.name}{k.disabled && <span className="ml-2 text-xs font-normal text-slate-500">ปิดอยู่</span>}
                  </td>
                  <td className="py-2 pr-3 font-mono text-xs text-slate-400">{k.prefix}…</td>
                  <td className="py-2 pr-3 text-right tabular-nums">
                    {k.usedMonth.toLocaleString("en-US")}
                    <span className="text-slate-400">{k.quotaMonth ? ` / ${k.quotaMonth.toLocaleString("en-US")}` : " / ไม่จำกัด"}</span>
                  </td>
                  <td className="py-2 pr-3 text-xs text-slate-500">
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "ยังไม่เคยใช้"}
                  </td>
                  <td className="py-2 text-right">
                    <button
                      type="button" disabled={pending}
                      onClick={() => run(() => setKeyDisabled(k.id, !k.disabled))}
                      className="rounded border px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
                    >
                      {k.disabled ? "เปิดใช้" : "ปิด"}
                    </button>
                    <button
                      type="button" disabled={pending}
                      onClick={() => run(() => deleteKey(k.id))}
                      className="ml-1.5 rounded border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      ลบ
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
