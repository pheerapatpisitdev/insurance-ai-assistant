"use client";
import type { Availability, PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { RiderRow } from "./RiderRow";

export interface RiderState {
  enabled: boolean;
  value: number | "";
}
export interface FormState {
  planCode: string;
  variant: string;
  age: number | "";
  sex: Sex;
  mode: PayMode;
  sumAssured: number | "";
  riders: Record<string, RiderState>;
}

export interface QuoteFormProps {
  state: FormState;
  plans: { code: string; name: string }[];
  variants: { code: string; label: string }[];
  baseAgeRange: { min: number; max: number };
  baseSaMin: number;
  availability: Availability[];
  onChange: (next: FormState) => void;
}

export function QuoteForm({ state, plans, variants, baseAgeRange, baseSaMin, availability, onChange }: QuoteFormProps) {
  const set = (patch: Partial<FormState>) => onChange({ ...state, ...patch });
  const setRider = (code: string, patch: Partial<RiderState>) =>
    onChange({ ...state, riders: { ...state.riders, [code]: { ...(state.riders[code] ?? { enabled: false, value: "" }), ...patch } } });
  const num = (v: string): number | "" => (v === "" ? "" : Number(v));

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <div>
        <label className="block text-sm font-medium">แบบประกันหลัก</label>
        <select className="mt-1 w-full rounded border px-3 py-2" value={state.planCode} onChange={(e) => set({ planCode: e.target.value })}>
          {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        <select className="mt-2 w-full rounded border px-3 py-2" value={state.variant} onChange={(e) => set({ variant: e.target.value })}>
          {variants.map((v) => <option key={v.code} value={v.code}>{v.label}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium">อายุ</label>
          <input type="number" inputMode="numeric" min={baseAgeRange.min} max={baseAgeRange.max} className="mt-1 w-full rounded border px-3 py-2"
                 value={state.age} onChange={(e) => set({ age: num(e.target.value) })} />
          <p className="mt-1 text-xs text-slate-500">{baseAgeRange.min} - {baseAgeRange.max} ปี</p>
        </div>
        <div>
          <label className="block text-sm font-medium">เพศ</label>
          <select className="mt-1 w-full rounded border px-3 py-2" value={state.sex} onChange={(e) => set({ sex: e.target.value as Sex })}>
            <option value="M">ชาย</option>
            <option value="F">หญิง</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium">งวดชำระ</label>
          <select className="mt-1 w-full rounded border px-3 py-2" value={state.mode} onChange={(e) => set({ mode: e.target.value as PayMode })}>
            {(Object.keys(PAY_MODE_LABEL) as PayMode[]).map((m) => <option key={m} value={m}>{PAY_MODE_LABEL[m]}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium">จำนวนเงินเอาประกันภัย (สัญญาหลัก)</label>
        <input type="number" inputMode="numeric" min={baseSaMin} step={10000} className="mt-1 w-full rounded border px-3 py-2"
               value={state.sumAssured} onChange={(e) => set({ sumAssured: num(e.target.value) })} />
        <p className="mt-1 text-xs text-slate-500">ขั้นต่ำ {baseSaMin.toLocaleString("en-US")} บาท</p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">สัญญาเพิ่มเติม</p>
        {availability.map((a) => (
          <RiderRow
            key={a.code}
            availability={a}
            enabled={state.riders[a.code]?.enabled ?? false}
            value={state.riders[a.code]?.value ?? ""}
            onToggle={(enabled) => setRider(a.code, { enabled })}
            onChange={(value) => setRider(a.code, { value })}
          />
        ))}
      </div>
    </form>
  );
}
