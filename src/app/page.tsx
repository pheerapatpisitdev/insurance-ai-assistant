"use client";
import { useMemo, useState } from "react";
import { quote } from "@/calc/quote";
import { getPlan, listPlans } from "@/calc/plans/registry";
import { packageSeq, requiredRiders } from "@/calc/rules";
import type { QuoteInput, RiderInput } from "@/calc/types";
import { QuoteForm, type FormState } from "@/components/QuoteForm";
import { QuoteResultPanel } from "@/components/QuoteResultPanel";
import { ExpiryBanner } from "@/components/ExpiryBanner";
import { summaryText } from "@/lib/summary";

const INITIAL: FormState = {
  planCode: "PLB", variant: "PLB12", age: 35, sex: "M", mode: "annual",
  basis: "sumAssured", sumAssured: 1_000_000, targetPremium: "",
  payer: { age: "", sex: "M" }, riders: {},
};

/** Build engine input; riders the current age cannot buy are dropped even if still ticked. */
function toQuoteInput(s: FormState, eligibleCodes: Set<string>): QuoteInput | null {
  const plan = getPlan(s.planCode);
  if (!plan || s.age === "") return null;
  const premiumBasis = s.basis === "premium" && plan.rules.base.premiumBasis;
  if (premiumBasis ? s.targetPremium === "" : s.sumAssured === "") return null;
  const riders: RiderInput[] = [];
  const required = new Set(requiredRiders(plan.rules, packageSeq(s.variant, plan.rates)));
  for (const code of plan.riderOrder) {
    const r = s.riders[code];
    const on = (r?.enabled ?? false) || required.has(code);
    if (!on || !eligibleCodes.has(code)) continue;
    const rider = plan.rates.riders[code];
    const kind = rider?.kind;
    const value = r?.value ?? "";
    const option = r?.option || undefined;
    if (kind === "payorBenefit" || kind === "premiumBased") riders.push({ code, option });
    else if (kind === "fixedByKeyAge") riders.push({ code, option, territory: r?.territory, coverage: r?.coverage });
    else if (value === "") continue;
    else if (kind === "fixedByAgePlan") riders.push({ code, plan: value });
    else if (kind === "ratePerThousandByVariantAgeSex") riders.push({ code, option, sumAssured: value });
    else riders.push({ code, sumAssured: value });
  }
  return {
    planCode: s.planCode, variant: s.variant, age: s.age, sex: s.sex, mode: s.mode,
    sumAssured: premiumBasis ? 0 : (s.sumAssured as number),
    basis: premiumBasis ? "premium" : "sumAssured",
    targetPremium: premiumBasis ? (s.targetPremium as number) : undefined,
    payer: s.payer.age === "" ? undefined : { age: s.payer.age, sex: s.payer.sex },
    riders,
  };
}

export default function Home() {
  const [state, setStateRaw] = useState<FormState>(INITIAL);
  const plan = getPlan(state.planCode)!;

  /** Switching plan resets variant and riders so stale codes never leak across plans. */
  const setState = (next: FormState) => {
    if (next.planCode !== state.planCode) {
      const p = getPlan(next.planCode)!;
      next = { ...next, variant: p.rates.base.variants[0], riders: {}, basis: "sumAssured" };
    }
    setStateRaw(next);
  };

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
      <p className="mb-4 text-sm text-slate-500">{plan.planLabel ?? plan.rates.planName} · ตารางเบี้ย {plan.rates.version}</p>
      <ExpiryBanner expired={result?.meta.expired ?? false} expiresOn={plan.rates.expiresOn} version={plan.rates.version} />
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border bg-white p-4">
          <QuoteForm state={state} plan={plan} plans={listPlans()} availability={availability} onChange={setState} />
        </div>
        <div className="rounded-lg border bg-white p-4">
          {result && input ? (
            <QuoteResultPanel result={result} mode={input.mode} summary={summary} derivedSumAssured={input.basis === "premium"} />
          ) : (
            <p className="text-sm text-slate-500">กรอกอายุและจำนวนเงินเอาประกันภัย (หรือเบี้ยที่ต้องการ) เพื่อคำนวณ</p>
          )}
        </div>
      </div>
    </main>
  );
}
