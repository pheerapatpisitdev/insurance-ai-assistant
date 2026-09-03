"use client";
import type { Bundle } from "@/calc/types";
import { bundleAgeRange, describeTier } from "@/calc/bundles/quote";
import type { FormState } from "./QuoteForm";
import { InsuredFields } from "./InsuredFields";
import { PlanSelect } from "./PlanSelect";

export interface BundleFormProps {
  state: FormState;
  bundle: Bundle;
  plans: { code: string; name: string }[];
  bundles: { code: string; name: string }[];
  onChange: (next: FormState) => void;
  onPlanChange: (value: string) => void;
}

/**
 * A bundle is already arranged, so the only questions left are who is insured and how they
 * pay. Sums assured are shown in the tier picker rather than edited.
 */
export function BundleForm({ state, bundle, plans, bundles, onChange, onPlanChange }: BundleFormProps) {
  return (
    <form className="space-y-5" onSubmit={(e) => e.preventDefault()}>
      <div>
        <label className="block text-sm font-medium">แบบประกันหลัก</label>
        <div className="mt-1">
          <PlanSelect value={`bundle:${bundle.code}`} plans={plans} bundles={bundles} onChange={onPlanChange} />
        </div>
        <select className="mt-2 w-full rounded border px-3 py-2" value={state.tier}
                onChange={(e) => onChange({ ...state, tier: Number(e.target.value) })}>
          {bundle.tiers.map((t) => <option key={t.no} value={t.no}>{describeTier(bundle, t.no)}</option>)}
        </select>
      </div>

      <InsuredFields
        age={state.age} sex={state.sex} mode={state.mode} ageRange={bundleAgeRange(bundle)}
        onChange={(patch) => onChange({ ...state, ...patch })}
      />

      <p className="text-xs text-slate-500">
        ชุดนี้กำหนดทุนและสัญญาเพิ่มเติมไว้แล้ว แก้ไม่ได้ — ดูรายการที่คุ้มครองได้จากตารางเบี้ยด้านขวา
      </p>
    </form>
  );
}
