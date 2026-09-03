"use client";
import { useMemo, useState } from "react";
import { quote } from "@/calc/quote";
import { getPlan, listPlans } from "@/calc/plans/registry";
import type { QuoteInput, RiderInput } from "@/calc/types";
import { QuoteForm, type FormState } from "@/components/QuoteForm";
import { QuoteResultPanel } from "@/components/QuoteResultPanel";
import { ExpiryBanner } from "@/components/ExpiryBanner";
import { summaryText } from "@/lib/summary";

const INITIAL: FormState = {
  planCode: "PLB", variant: "PLB12", age: 35, sex: "M", mode: "annual", sumAssured: 1_000_000, riders: {},
};

/** Build engine input; riders the current age cannot buy are dropped even if still ticked. */
function toQuoteInput(s: FormState, eligibleCodes: Set<string>): QuoteInput | null {
  if (s.age === "" || s.sumAssured === "") return null;
  const riders: RiderInput[] = [];
  const plan = getPlan(s.planCode);
  if (!plan) return null;
  for (const code of plan.riderOrder) {
    const r = s.riders[code];
    if (!r?.enabled || r.value === "" || !eligibleCodes.has(code)) continue;
    const isPlan = plan.rates.riders[code]?.kind === "fixedByAgePlan";
    riders.push(isPlan ? { code, plan: r.value } : { code, sumAssured: r.value });
  }
  return { planCode: s.planCode, variant: s.variant, age: s.age, sex: s.sex, mode: s.mode, sumAssured: s.sumAssured, riders };
}

export default function Home() {
  const [state, setState] = useState<FormState>(INITIAL);
  const plan = getPlan(state.planCode)!;

  // availability for the form must exist even when the input is incomplete
  const availability = useMemo(() => {
    const probe: QuoteInput = {
      planCode: state.planCode, variant: state.variant, sex: state.sex, mode: state.mode,
      age: state.age === "" ? plan.rules.base.ageMin : state.age,
      sumAssured: state.sumAssured === "" ? plan.rules.base.saMin : state.sumAssured,
      riders: [],
    };
    return quote(probe).availability;
  }, [state, plan]);
  const eligibleCodes = useMemo(() => new Set(availability.filter((a) => a.eligible).map((a) => a.code)), [availability]);
  const input = useMemo(() => toQuoteInput(state, eligibleCodes), [state, eligibleCodes]);
  const result = useMemo(() => (input ? quote(input) : null), [input]);
  const summary = useMemo(() => (input && result ? summaryText(input, result) : ""), [input, result]);

  return (
    <main className="mx-auto max-w-5xl p-4 sm:p-6">
      <h1 className="mb-1 text-2xl font-semibold">คำนวณเบี้ยประกัน</h1>
      <p className="mb-4 text-sm text-slate-500">{plan.rates.planName} · ตารางเบี้ย {plan.rates.version}</p>
      <ExpiryBanner expired={result?.meta.expired ?? false} expiresOn={plan.rates.expiresOn} version={plan.rates.version} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <QuoteForm
            state={state}
            plans={listPlans()}
            variants={plan.rates.base.variants.map((v) => ({ code: v, label: plan.variantLabels[v] ?? v }))}
            baseAgeRange={{ min: plan.rules.base.ageMin, max: plan.rules.base.ageMax }}
            baseSaMin={plan.rules.base.saMin}
            availability={availability}
            onChange={setState}
          />
        </div>
        <div className="rounded-lg border bg-white p-4">
          {result && input ? (
            <QuoteResultPanel result={result} mode={input.mode} summary={summary} />
          ) : (
            <p className="text-sm text-slate-500">กรอกอายุและจำนวนเงินเอาประกันภัยเพื่อคำนวณ</p>
          )}
        </div>
      </div>
    </main>
  );
}
