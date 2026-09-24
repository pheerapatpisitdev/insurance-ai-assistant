"use client";
import { useRef, useState, useTransition } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { HOSPITAL_LABEL, LIFE_WANT_LABEL, PLANNER_AGE, type Hospital, type LifeWant } from "@/lib/plan/assumptions";
import { defaultBudget, type HealthNow } from "@/lib/plan/needs";
import type { Prose } from "@/lib/plan/prose";
import type { PlanResult } from "@/lib/plan/recommend";
import { buildPlan, explainPlan } from "./actions";
import { PlanView } from "./PlanView";

type Money = number | "";

const INPUT =
  "mt-1.5 w-full rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]";
const LABEL = "block text-sm text-[var(--lg-mute)]";
const PANEL = "space-y-4 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5";

function Choice<T extends string>({ value, options, onChange }: {
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

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {children}
    </label>
  );
}

function MoneyField({ label, value, onChange, hint }: { label: string; value: Money; onChange: (v: Money) => void; hint?: string }) {
  return (
    <div>
      <span className={LABEL}>{label}</span>
      <MoneyInput value={value} onChange={onChange} className={INPUT} placeholder="0" hint={hint} />
    </div>
  );
}

const HEALTH_NOW: [HealthNow, string][] = [
  ["none", "ไม่มี"], ["public", "ประกันสังคม/บัตรทอง"], ["employer", "สวัสดิการบริษัท"], ["private", "ประกันสุขภาพส่วนตัว"],
];

export function Planner() {
  const [age, setAge] = useState<Money>(35);
  const [sex, setSex] = useState<"M" | "F">("M");
  const [income, setIncome] = useState<Money>("");
  const [expense, setExpense] = useState<Money>("");
  const [savings, setSavings] = useState<Money>("");
  const [children, setChildren] = useState<Money[]>([]);
  const [otherDependants, setOtherDependants] = useState(false);
  const [debts, setDebts] = useState<Money>("");
  const [lifeCover, setLifeCover] = useState<Money>("");
  const [ciCover, setCiCover] = useState<Money>("");
  const [healthNow, setHealthNow] = useState<HealthNow>("public");
  const [healthRoom, setHealthRoom] = useState<Money>("");
  const [premiumsNow, setPremiumsNow] = useState<Money>("");
  const [hospital, setHospital] = useState<Hospital>("private");
  const [lifeWant, setLifeWant] = useState<LifeWant>("cover");
  const [budget, setBudget] = useState<Money>("");
  const [budgetTouched, setBudgetTouched] = useState(false);

  const [result, setResult] = useState<PlanResult | null>(null);
  const [prose, setProse] = useState<Prose | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const [editing, setEditing] = useState(true);
  const seq = useRef(0);

  const n = (v: Money) => (v === "" ? 0 : v);
  const shownBudget = budgetTouched ? budget : defaultBudget(n(income), n(premiumsNow)) || "";

  function submit() {
    const form = {
      age: n(age), sex, income: n(income), expense: n(expense), savings: n(savings),
      children: children.filter((c) => c !== ""), otherDependants, debts: n(debts), lifeCover: n(lifeCover),
      ciCover: n(ciCover), healthNow, healthRoom: n(healthRoom), premiumsNow: n(premiumsNow), hospital, lifeWant,
      budget: n(shownBudget),
    };
    setError("");
    setProse(null);
    const mine = ++seq.current;
    start(async () => {
      const reply = await buildPlan(form);
      if (mine !== seq.current) return;
      if (!reply.ok) { setError(reply.error); return; }
      setResult(reply.result);
      setEditing(false);
      requestAnimationFrame(() => document.getElementById("plan-result")?.scrollIntoView({ behavior: "smooth" }));
      const words = await explainPlan(form);
      if (mine === seq.current) setProse(words);
    });
  }

  if (result && !editing) {
    return (
      <div id="plan-result" className="scroll-mt-20 space-y-4">
        <PlanView result={result} prose={prose} />
        <button
          type="button" onClick={() => { setEditing(true); window.scrollTo({ top: 0 }); }}
          className="w-full rounded-sm border border-[var(--lg-panel-line)] py-3 text-sm text-[var(--lg-mute)]"
        >
          แก้ข้อมูลแล้ววางแผนใหม่
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className={PANEL}>
        <h2 className="text-base font-medium text-[var(--lg-white)]">ตัวคุณ</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="อายุ (ปี)">
            <input
              type="text" inputMode="numeric" className={INPUT} value={age}
              onChange={(e) => { const d = e.target.value.replace(/\D/g, ""); setAge(d === "" ? "" : Math.min(Number(d), 99)); }}
            />
          </Field>
          <div>
            <span className={LABEL}>เพศ</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["M", "F"] as const).map((s) => (
                <button
                  key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(s)}
                  className={`rounded-sm border py-2.5 text-sm transition-colors ${
                    sex === s ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                  }`}
                >
                  {s === "M" ? "ชาย" : "หญิง"}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className={PANEL}>
        <h2 className="text-base font-medium text-[var(--lg-white)]">รายได้และรายจ่าย</h2>
        <MoneyField label="เงินเดือน (บาท/เดือน)" value={income} onChange={setIncome} />
        <MoneyField label="ค่าใช้จ่ายครอบครัว ส่วนที่คุณเป็นคนจ่าย (บาท/เดือน)" value={expense} onChange={setExpense} />
        <MoneyField label="เงินออมและเงินลงทุนที่มีตอนนี้ (บาท)" value={savings} onChange={setSavings} />
      </section>

      <section className={PANEL}>
        <h2 className="text-base font-medium text-[var(--lg-white)]">ครอบครัวและหนี้</h2>
        <div>
          <span className={LABEL}>ลูก (อายุแต่ละคน)</span>
          <div className="mt-1.5 space-y-2">
            {children.map((c, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  type="text" inputMode="numeric" aria-label={`อายุลูกคนที่ ${i + 1}`} placeholder="อายุ"
                  className={`${INPUT} mt-0`} value={c}
                  onChange={(e) => {
                    const d = e.target.value.replace(/\D/g, "");
                    setChildren(children.map((x, j) => (j === i ? (d === "" ? "" : Math.min(Number(d), 40)) : x)));
                  }}
                />
                <button
                  type="button" onClick={() => setChildren(children.filter((_, j) => j !== i))}
                  className="shrink-0 rounded-sm border border-[var(--lg-panel-line)] px-3 py-2.5 text-sm text-[var(--lg-mute)]"
                >
                  ลบ
                </button>
              </div>
            ))}
            {children.length < 4 && (
              <button
                type="button" onClick={() => setChildren([...children, ""])}
                className="w-full rounded-sm border border-dashed border-[var(--lg-panel-line)] py-2.5 text-sm text-[var(--lg-mute)]"
              >
                + เพิ่มลูก
              </button>
            )}
          </div>
        </div>
        <div>
          <span className={LABEL}>มีพ่อแม่หรือคู่สมรสที่ใช้เงินของคุณไหม</span>
          <Choice value={otherDependants ? "yes" : "no"} options={[["no", "ไม่มี"], ["yes", "มี"]]} onChange={(v) => setOtherDependants(v === "yes")} />
        </div>
        <MoneyField label="หนี้คงเหลือรวม เช่น บ้าน รถ บัตร (บาท)" value={debts} onChange={setDebts} />
      </section>

      <section className={PANEL}>
        <h2 className="text-base font-medium text-[var(--lg-white)]">ประกันที่มีอยู่แล้ว</h2>
        <MoneyField label="ทุนประกันชีวิตรวมทุกกรมธรรม์ (บาท)" value={lifeCover} onChange={setLifeCover} />
        <MoneyField label="ทุนประกันโรคร้ายแรงรวม (บาท)" value={ciCover} onChange={setCiCover} />
        <div>
          <span className={LABEL}>ค่ารักษาพยาบาลตอนนี้ใช้สิทธิ์อะไร</span>
          <Choice value={healthNow} options={HEALTH_NOW} onChange={setHealthNow} />
        </div>
        {healthNow === "private" && <MoneyField label="ค่าห้องที่ประกันสุขภาพจ่าย (บาท/วัน)" value={healthRoom} onChange={setHealthRoom} />}
        <MoneyField label="เบี้ยประกันที่จ่ายอยู่ทุกกรมธรรม์ (บาท/ปี)" value={premiumsNow} onChange={setPremiumsNow} />
      </section>

      <section className={PANEL}>
        <h2 className="text-base font-medium text-[var(--lg-white)]">ถ้าต้องนอนโรงพยาบาล อยากใช้ที่ไหน</h2>
        <Choice
          value={hospital} onChange={setHospital}
          options={(Object.keys(HOSPITAL_LABEL) as Hospital[]).map((h) => [h, HOSPITAL_LABEL[h]])}
        />
      </section>

      <section className={PANEL}>
        <h2 className="text-base font-medium text-[var(--lg-white)]">ประกันชีวิต อยากได้แบบไหนมากกว่ากัน</h2>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(LIFE_WANT_LABEL) as LifeWant[]).map((w, i) => (
            <button
              key={w} type="button" aria-pressed={lifeWant === w} onClick={() => setLifeWant(w)}
              className={`rounded-sm border px-3 py-3 text-left transition-colors ${
                lifeWant === w ? "lg-metal-face border-[var(--lg-gold)]" : "border-[var(--lg-panel-line)]"
              }`}
            >
              <span className={`block text-sm ${lifeWant === w ? "font-medium" : "text-[var(--lg-white)]"}`}>
                {i + 1}. {LIFE_WANT_LABEL[w].title}
              </span>
              <span className={`mt-0.5 block text-xs ${lifeWant === w ? "opacity-80" : "text-[var(--lg-mute)]"}`}>{LIFE_WANT_LABEL[w].note}</span>
            </button>
          ))}
        </div>
      </section>

      <section className={PANEL}>
        <h2 className="text-base font-medium text-[var(--lg-white)]">งบเบี้ยที่อยากเพิ่ม</h2>
        <MoneyField
          label="เพิ่มได้เดือนละไม่เกิน (บาท)" value={shownBudget}
          onChange={(v) => { setBudgetTouched(true); setBudget(v); }}
          hint="ตั้งไว้ให้ที่ 10% ของเงินเดือน หักเบี้ยที่จ่ายอยู่แล้ว แก้ได้ตามสะดวก"
        />
      </section>

      {error && <p className="text-center text-sm text-[var(--lg-gold)]">{error}</p>}
      <button
        type="button" onClick={submit} disabled={pending}
        className="lg-metal-face w-full rounded-sm border border-[var(--lg-gold)] py-3.5 text-base font-medium disabled:opacity-60"
      >
        {pending ? "กำลังวางแผน…" : "วางแผนให้ฉัน"}
      </button>
      <p className="text-center text-xs text-[var(--lg-mute)]">อายุที่วางแผนได้ {PLANNER_AGE.min}–{PLANNER_AGE.max} ปี</p>

    </div>
  );
}
