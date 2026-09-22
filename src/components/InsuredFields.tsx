import type { Sex } from "@/calc/types";

export interface InsuredFieldsProps {
  age: number | "";
  sex: Sex;
  ageRange: { min: number; max: number };
  onChange: (patch: { age?: number | ""; sex?: Sex }) => void;
}

/**
 * อายุ / เพศ — what every quote needs to know, however the plan was chosen.
 *
 * There is no งวดชำระ picker: every quote prices all three instalments at once, so choosing
 * one up front decided nothing. The one place the instalment still changes an answer is a
 * quote worked backwards from a premium, and that picker sits beside that input.
 */
export function InsuredFields({ age, sex, ageRange, onChange }: InsuredFieldsProps) {
  const ages = Array.from({ length: ageRange.max - ageRange.min + 1 }, (_, i) => ageRange.min + i);
  return (
    <div className="grid grid-cols-2 gap-3">
      <div>
        <label className="block text-sm font-medium">อายุ</label>
        <select className="mt-1 w-full rounded border px-3 py-2" value={age}
                onChange={(e) => onChange({ age: e.target.value === "" ? "" : Number(e.target.value) })}>
          {age === "" && <option value="">เลือกอายุ</option>}
          {ages.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <p className="mt-1 text-xs text-[var(--bot-ink-mute)]">รับประกัน {ageRange.min} - {ageRange.max} ปี</p>
      </div>
      <div>
        <label className="block text-sm font-medium">เพศ</label>
        <select className="mt-1 w-full rounded border px-3 py-2" value={sex} onChange={(e) => onChange({ sex: e.target.value as Sex })}>
          <option value="M">ชาย</option>
          <option value="F">หญิง</option>
        </select>
      </div>
    </div>
  );
}
