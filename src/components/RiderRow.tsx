"use client";
import type { Availability } from "@/calc/types";

export interface RiderRowProps {
  availability: Availability;
  enabled: boolean;
  value: number | "";
  onToggle: (enabled: boolean) => void;
  onChange: (value: number | "") => void;
}

export function RiderRow({ availability: a, enabled, value, onToggle, onChange }: RiderRowProps) {
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
        <div className="mt-2 flex items-center gap-2">
          {isPlan ? (
            <select className="rounded border px-2 py-1 text-sm" value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}>
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
                value={value} onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
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
