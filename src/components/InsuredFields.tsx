import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";

export interface InsuredFieldsProps {
  age: number | "";
  sex: Sex;
  mode: PayMode;
  ageRange: { min: number; max: number };
  onChange: (patch: { age?: number | ""; sex?: Sex; mode?: PayMode }) => void;
}

/** อายุ / เพศ / งวดชำระ — the three answers every quote needs, however the plan was chosen. */
export function InsuredFields({ age, sex, mode, ageRange, onChange }: InsuredFieldsProps) {
  const ages = Array.from({ length: ageRange.max - ageRange.min + 1 }, (_, i) => ageRange.min + i);
  return (
    <div className="grid grid-cols-3 gap-3">
      <div>
        <label className="block text-sm font-medium">อายุ</label>
        <select className="mt-1 w-full rounded border px-3 py-2" value={age}
                onChange={(e) => onChange({ age: e.target.value === "" ? "" : Number(e.target.value) })}>
          {age === "" && <option value="">เลือกอายุ</option>}
          {ages.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <p className="mt-1 text-xs text-slate-500">รับประกัน {ageRange.min} - {ageRange.max} ปี</p>
      </div>
      <div>
        <label className="block text-sm font-medium">เพศ</label>
        <select className="mt-1 w-full rounded border px-3 py-2" value={sex} onChange={(e) => onChange({ sex: e.target.value as Sex })}>
          <option value="M">ชาย</option>
          <option value="F">หญิง</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium">งวดชำระ</label>
        <select className="mt-1 w-full rounded border px-3 py-2" value={mode} onChange={(e) => onChange({ mode: e.target.value as PayMode })}>
          {(Object.keys(PAY_MODE_LABEL) as PayMode[]).map((m) => <option key={m} value={m}>{PAY_MODE_LABEL[m]}</option>)}
        </select>
      </div>
    </div>
  );
}
