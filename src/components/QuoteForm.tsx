"use client";
import type { Availability, PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import type { PlanBundle } from "@/calc/plans/registry";
import { baseAgeRange, baseSumAssuredLimits, packageSeq, requiredRiders } from "@/calc/rules";
import { RiderRow, type PayerState, type SubSelect } from "./RiderRow";
import { MoneyInput } from "./MoneyInput";
import { InsuredFields } from "./InsuredFields";
import { PlanSelect } from "./PlanSelect";

export interface RiderState {
  enabled: boolean;
  value: number | "";
  option: string;
  territory: string;
  coverage: string;
}
export interface FormState {
  planCode: string;
  /** set when the quote comes from a ready-made bundle instead of a plan picked apart by hand */
  bundleCode: string | null;
  /** which tier of that bundle */
  tier: number;
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
  bundles: { code: string; name: string }[];
  onChange: (next: FormState) => void;
  onPlanChange: (value: string) => void;
}

export function QuoteForm({ state, plan, plans, availability, bundles, onChange, onPlanChange }: QuoteFormProps) {
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
        <div className="mt-1">
          <PlanSelect value={state.planCode} plans={plans} bundles={bundles} onChange={onPlanChange} />
        </div>
        <select className="mt-2 w-full rounded border px-3 py-2" value={state.variant} onChange={(e) => set({ variant: e.target.value })}>
          {plan.rates.base.variants.map((v) => <option key={v} value={v}>{plan.variantLabels[v] ?? v}</option>)}
        </select>
      </div>

      <InsuredFields
        age={state.age} sex={state.sex} mode={state.mode} ageRange={ageRange}
        onChange={(patch) => set(patch)}
      />

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
          <MoneyInput className="mt-1 w-full rounded border px-3 py-2" value={state.targetPremium}
                      onChange={(targetPremium) => set({ targetPremium })}
                      hint="ระบบจะหาทุนประกันสูงสุดที่เบี้ยนี้ซื้อได้" />
        </div>
      ) : (
        <div>
          <label className="block text-sm font-medium">จำนวนเงินเอาประกันภัย (สัญญาหลัก)</label>
          <MoneyInput
            className="mt-1 w-full rounded border px-3 py-2"
            value={state.sumAssured}
            onChange={(sumAssured) => set({ sumAssured })}
            hint={saExact
              ? `แพ็กเกจนี้กำหนดทุน ${saMin.toLocaleString("en-US")} บาทเท่านั้น`
              : `ขั้นต่ำ ${saMin.toLocaleString("en-US")} บาท${saMax ? ` สูงสุด ${saMax.toLocaleString("en-US")} บาท` : ""}`}
          />
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
