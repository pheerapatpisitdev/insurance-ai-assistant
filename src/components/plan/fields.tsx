"use client";
import { MoneyInput } from "@/components/MoneyInput";
import type { HealthNow } from "@/lib/plan/needs";

/** The pieces the /plan and /fhc forms are built from, in the sales theme's tokens. */

export type Money = number | "";

export const INPUT =
  "mt-1.5 w-full rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]";
export const LABEL = "block text-sm text-[var(--lg-mute)]";
export const PANEL = "space-y-4 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5";

export const n = (v: Money) => (v === "" ? 0 : v);

export function Choice<T extends string>({ value, options, onChange }: {
  value: T; options: [T, string][]; onChange: (v: T) => void;
}) {
  return (
    <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {options.map(([v, label]) => (
        <button
          key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}
          className={`rounded-sm border px-2 py-2.5 text-sm transition-colors ${
            value === v ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

export function MoneyField({ label, value, onChange, hint }: { label: string; value: Money; onChange: (v: Money) => void; hint?: string }) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <MoneyInput value={value} onChange={onChange} className={INPUT} placeholder="0" hint={hint} />
    </div>
  );
}

export const HEALTH_NOW: [HealthNow, string][] = [
  ["none", "ไม่มี"], ["public", "ประกันสังคม/บัตรทอง"], ["employer", "สวัสดิการบริษัท"], ["private", "ประกันสุขภาพส่วนตัว"],
];
