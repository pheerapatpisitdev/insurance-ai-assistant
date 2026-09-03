/**
 * The one place a quote starts: a single plan, or a ready-made bundle the agency arranged.
 * Bundle values are prefixed so a bundle code can never be read as a plan code.
 */
export const BUNDLE_PREFIX = "bundle:";

export interface PlanSelectProps {
  /** plan code, or `bundle:<code>` when a bundle is selected */
  value: string;
  plans: { code: string; name: string }[];
  bundles: { code: string; name: string }[];
  onChange: (value: string) => void;
}

export function PlanSelect({ value, plans, bundles, onChange }: PlanSelectProps) {
  return (
    <select className="w-full rounded border px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)}>
      {bundles.length > 0 && (
        <optgroup label="ชุดจัดเอง">
          {bundles.map((b) => <option key={b.code} value={`${BUNDLE_PREFIX}${b.code}`}>{b.name}</option>)}
        </optgroup>
      )}
      <optgroup label="แบบประกัน">
        {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
      </optgroup>
    </select>
  );
}
