"use client";
import type { Availability, PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import type { PlanBundle } from "@/calc/plans/registry";
import { baseAgeRange, baseSumAssuredLimits, packageSeq, requiredRiders } from "@/calc/rules";
import { RiderRow, type PayerState, type SubSelect } from "./RiderRow";

export interface RiderState {
  enabled: boolean;
  value: number | "";
  option: string;
  territory: string;
  coverage: string;
}
export interface FormState {
  planCode: string;
  variant: string;
  age: number | "";
  sex: Sex;
  mode: PayMode;
  basis: "sumAssured" | "premium";
  sumAssured: number | "";
  targetPremium: number | "";
  payer: PayerState;
  riders: Record<string, RiderState>;
}

export const EMPTY_RIDER: RiderState = { enabled: false, value: "", option: "", territory: "ประเทศไทย", coverage: "Full Coverage" };

export interface QuoteFormProps {
  state: FormState;
  plan: PlanBundle;
  plans: { code: string; name: string }[];
  availability: Availability[];
  onChange: (next: FormState) => void;
}

const num = (v: string): number | "" => (v === "" ? "" : Number(v));

export function QuoteForm({ state, plan, plans, availability, onChange }: QuoteFormProps) {
  const set = (patch: Partial<FormState>) => onChange({ ...state, ...patch });
  const setRider = (code: string, patch: Partial<RiderState>) =>
    onChange({ ...state, riders: { ...state.riders, [code]: { ...(state.riders[code] ?? EMPTY_RIDER), ...patch } } });
  const ageRange = baseAgeRange(plan.rules, state.variant, plan.rates);
  const { min: saMin, max: saMax, exact: saExact } = baseSumAssuredLimits(plan.rules, state.variant);
  const { premiumBasis } = plan.rules.base;
  const required = new Set(requiredRiders(plan.rules, packageSeq(state.variant, plan.rates)));

  /** iHealthy Ultra needs territory and coverage on top of the plan; PLS needs a sum assured beside its variant. */
  const riderExtras = (code: string): { subSelects: SubSelect[]; optionNeedsSumAssured: boolean } => {
    const rider = plan.rates.riders[code];
    if (rider?.kind === "fixedByKeyAge" && rider.keyBy === "ihealthyUltra") {
      return {
        optionNeedsSumAssured: false,
        subSelects: [
          { key: "territory", label: "อาณาเขต", choices: Object.keys(rider.territory ?? {}) },
          { key: "coverage", label: "ลักษณะความคุ้มครอง", choices: Object.keys(rider.coverage ?? {}) },
        ],
      };
    }
    return { subSelects: [], optionNeedsSumAssured: rider?.kind === "ratePerThousandByVariantAgeSex" };
  };

  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <div>
        <label className="block text-sm font-medium">แบบประกันหลัก</label>
        <select className="mt-1 w-full rounded border px-3 py-2" value={state.planCode} onChange={(e) => set({ planCode: e.target.value })}>
          {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
        </select>
        <select className="mt-2 w-full rounded border px-3 py-2" value={state.variant} onChange={(e) => set({ variant: e.target.value })}>
          {plan.rates.base.variants.map((v) => <option key={v} value={v}>{plan.variantLabels[v] ?? v}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium">อายุ</label>
          <input type="number" inputMode="numeric" min={ageRange.min} max={ageRange.max} className="mt-1 w-full rounded border px-3 py-2"
                 value={state.age} onChange={(e) => set({ age: num(e.target.value) })} />
          <p className="mt-1 text-xs text-slate-500">{ageRange.min} - {ageRange.max} ปี</p>
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

      {premiumBasis && (
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="radio" name="basis" checked={state.basis === "sumAssured"} onChange={() => set({ basis: "sumAssured" })} />
            คำนวณจากทุนประกัน
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" name="basis" checked={state.basis === "premium"} onChange={() => set({ basis: "premium" })} />
            คำนวณจากเบี้ยที่ต้องการ
          </label>
        </div>
      )}

      {state.basis === "premium" && premiumBasis ? (
        <div>
          <label className="block text-sm font-medium">เบี้ยประกันภัยที่ต้องการชำระ ({PAY_MODE_LABEL[state.mode]})</label>
          <input type="number" inputMode="numeric" min={0} step={100} className="mt-1 w-full rounded border px-3 py-2"
                 value={state.targetPremium} onChange={(e) => set({ targetPremium: num(e.target.value) })} />
          <p className="mt-1 text-xs text-slate-500">ระบบจะหาทุนประกันสูงสุดที่เบี้ยนี้ซื้อได้</p>
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium">จำนวนเงินเอาประกันภัย (สัญญาหลัก)</label>
          <input type="number" inputMode="numeric" min={saMin} max={saMax} step={10000} className="mt-1 w-full rounded border px-3 py-2"
                 value={state.sumAssured} onChange={(e) => set({ sumAssured: num(e.target.value) })} />
          <p className="mt-1 text-xs text-slate-500">
            {saExact
              ? `แพ็กเกจนี้กำหนดทุน ${saMin.toLocaleString("en-US")} บาทเท่านั้น`
              : `ขั้นต่ำ ${saMin.toLocaleString("en-US")} บาท${saMax ? ` สูงสุด ${saMax.toLocaleString("en-US")} บาท` : ""}`}
          </p>
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm font-medium">สัญญาเพิ่มเติม</p>
        {availability.map((a) => {
          const r = state.riders[a.code] ?? EMPTY_RIDER;
          const extras = riderExtras(a.code);
          return (
            <RiderRow
              key={a.code}
              availability={a}
              enabled={r.enabled}
              value={r.value}
              option={r.option}
              territory={r.territory}
              coverage={r.coverage}
              payer={state.payer}
              optionNeedsSumAssured={extras.optionNeedsSumAssured}
              subSelects={extras.subSelects}
              required={required.has(a.code)}
              onToggle={(enabled) => setRider(a.code, { enabled })}
              onChange={(value) => setRider(a.code, { value })}
              onOptionChange={(option) => setRider(a.code, { option })}
              onSubSelectChange={(key, v) => setRider(a.code, { [key]: v })}
              onPayerChange={(payer) => set({ payer })}
            />
          );
        })}
      </div>
    </form>
  );
}
