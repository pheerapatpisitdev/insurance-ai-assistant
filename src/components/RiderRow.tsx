"use client";
import type { Availability, Sex } from "@/calc/types";

export interface PayerState {
  age: number | "";
  sex: Sex;
}
export interface RiderRowProps {
  availability: Availability;
  enabled: boolean;
  value: number | "";
  option: string;
  payer: PayerState;
  onToggle: (enabled: boolean) => void;
  onChange: (value: number | "") => void;
  onOptionChange: (option: string) => void;
  onPayerChange: (payer: PayerState) => void;
}

const num = (v: string): number | "" => (v === "" ? "" : Number(v));

export function RiderRow({ availability: a, enabled, value, option, payer, onToggle, onChange, onOptionChange, onPayerChange }: RiderRowProps) {
  const disabled = !a.eligible;
  const isPlan = a.plans !== undefined;
  return (
    <div className={`rounded-md border p-3 ${disabled ? "border-slate-200 bg-slate-100 text-slate-400" : "border-slate-300 bg-white"}`}>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-4 w-4" checked={enabled && !disabled} disabled={disabled} onChange={(e) => onToggle(e.target.checked)} />
        <span className="flex-1 text-sm font-medium">{a.name}</span>
        <span className="text-xs">{a.ageRange}</span>
      </label>
      {disabled && <p className="mt-1 text-xs">{a.reason}</p>}
      {!disabled && enabled && (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {a.options && (
            <select className="rounded border px-2 py-1 text-sm" value={option} onChange={(e) => onOptionChange(e.target.value)}>
              <option value="">เลือกแบบ</option>
              {a.options.map((o) => (
                <option key={o.code} value={o.code}>{o.name}</option>
              ))}
            </select>
          )}
          {a.needsPayer ? (
            <>
              <span className="text-xs text-slate-600">ผู้ชำระเบี้ย</span>
              <input
                type="number" inputMode="numeric" min={20} max={70} className="w-20 rounded border px-2 py-1 text-sm" placeholder="อายุ"
                value={payer.age} onChange={(e) => onPayerChange({ ...payer, age: num(e.target.value) })}
              />
              <select className="rounded border px-2 py-1 text-sm" value={payer.sex} onChange={(e) => onPayerChange({ ...payer, sex: e.target.value as Sex })}>
                <option value="M">ชาย</option>
                <option value="F">หญิง</option>
              </select>
              <span className="text-xs text-slate-500">อายุผู้ชำระเบี้ย 20 - 70 ปี</span>
            </>
          ) : isPlan ? (
            <select className="rounded border px-2 py-1 text-sm" value={value} onChange={(e) => onChange(num(e.target.value))}>
              <option value="">เลือกแผน</option>
              {a.plans!.map((p) => (
                <option key={p} value={p}>{p.toLocaleString("en-US")}</option>
              ))}
            </select>
          ) : (
            <>
              <input
                type="number" inputMode="numeric" min={a.saMin} max={a.saMax} step={1000}
                className="w-40 rounded border px-2 py-1 text-sm" placeholder="ทุนประกัน"
                value={value} onChange={(e) => onChange(num(e.target.value))}
              />
              <span className="text-xs text-slate-500">
                {a.saMin?.toLocaleString("en-US")} – {a.saMax?.toLocaleString("en-US")}
              </span>
            </>
          )}
        </div>
      )}
    </div>
  );
}
