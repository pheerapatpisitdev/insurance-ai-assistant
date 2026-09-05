"use client";
import { useState, useTransition } from "react";
import { sendTestAlert, setLeadsMode, setMonthlyCap, startRegistration, stopAlerts } from "./actions";
import type { LeadsMode } from "@/lib/alerts/settings";

const MODES: { value: LeadsMode; label: string; hint: string }[] = [
  { value: "quote", label: "เฉพาะคนที่ขอดูเบี้ย", hint: "คนที่ถามราคาแล้วเท่านั้น ประหยัดโควตาที่สุด" },
  { value: "all", label: "ทุกคนที่ทักเข้ามา", hint: "รวมคนที่ทักมาถามเฉย ๆ ใช้โควตาเร็วขึ้น" },
  { value: "off", label: "ไม่ต้องแจ้ง", hint: "ปิดการแจ้งลูกค้าใหม่ ยังแจ้งเรื่องระบบล่มอยู่" },
];

export function RegisterPanel({ connected, pending }: { connected: boolean; pending: string | null }) {
  const [code, setCode] = useState<string | null>(pending);
  const [busy, start] = useTransition();

  if (connected) {
    return (
      <button type="button" disabled={busy}
              onClick={() => { if (confirm("เลิกรับแจ้งเตือนทาง LINE ใช่ไหม")) start(() => { void stopAlerts(); }); }}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50">
        เลิกรับแจ้งเตือน
      </button>
    );
  }
  return (
    <div>
      {code ? (
        <div className="rounded-md bg-slate-50 p-3">
          <p className="text-sm text-slate-700">เปิดแชท LINE กับ <b>advisortool.app</b> แล้วส่งข้อความนี้ภายใน 10 นาที</p>
          <p className="mt-2 select-all font-mono text-xl tracking-wider">{code}</p>
          <p className="mt-2 text-xs text-slate-500">ส่งแล้วบอทจะตอบยืนยัน จากนั้นกดรีเฟรชหน้านี้</p>
        </div>
      ) : (
        <p className="text-sm text-slate-700">
          ผูกบัญชี LINE ของคุณไว้ ระบบจะส่งข้อความหาคุณเมื่อมีลูกค้าใหม่ หรือเมื่อบอทหยุดตอบ
        </p>
      )}
      <button type="button" disabled={busy}
              onClick={() => start(async () => setCode(await startRegistration()))}
              className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm text-white hover:bg-slate-700 disabled:opacity-50">
        {busy ? "กำลังสร้างรหัส…" : code ? "ขอรหัสใหม่" : "ขอรหัสผูกบัญชี"}
      </button>
    </div>
  );
}

export function ModePicker({ value }: { value: LeadsMode }) {
  const [busy, start] = useTransition();
  return (
    <div className="space-y-2">
      {MODES.map((m) => (
        <label key={m.value} className="flex cursor-pointer items-start gap-2 text-sm">
          <input type="radio" name="leads" className="mt-1" checked={value === m.value} disabled={busy}
                 onChange={() => start(() => { void setLeadsMode(m.value); })} />
          <span>
            <span className="font-medium">{m.label}</span>
            <span className="block text-xs text-slate-500">{m.hint}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function CapField({ value }: { value: number }) {
  const [cap, setCap] = useState(String(value));
  const [busy, start] = useTransition();
  return (
    <div className="flex items-end gap-2">
      <label className="text-sm">
        <span className="block text-slate-500">จำกัดไม่เกิน (ข้อความ/เดือน)</span>
        <input type="number" min={0} max={300} value={cap} onChange={(e) => setCap(e.target.value)}
               className="mt-1 w-28 rounded-md border px-3 py-2" />
      </label>
      <button type="button" disabled={busy}
              onClick={() => start(() => { void setMonthlyCap(Number(cap)); })}
              className="rounded-md border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50">
        บันทึก
      </button>
    </div>
  );
}

export function TestButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      <button type="button" disabled={busy}
              onClick={() => start(async () => setMsg(await sendTestAlert()))}
              className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50">
        {busy ? "กำลังส่ง…" : "ส่งข้อความทดสอบ"}
      </button>
      {msg && <span className="text-sm text-slate-600">{msg}</span>}
    </div>
  );
}
