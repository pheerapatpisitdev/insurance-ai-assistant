"use client";
import { useEffect, useMemo, useState } from "react";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import type { IHealthyTable } from "@/lib/ihealthy-table";
import type { BenefitTableData } from "@/components/ihealthy/BenefitTable";
import { BenefitTable } from "@/components/ihealthy/BenefitTable";
import { RiderPanel } from "@/components/ihealthy/RiderPanel";
import { deathBenefitOf, iHealthyPricing, type IHealthyPricing } from "@/lib/ihealthy-quote";
import {
  baseFor, resolveArrangement, sumFor, sumsFor, type IHealthyInitial,
} from "@/lib/ihealthy-choice";
import { queryFrom } from "@/lib/ihealthy-link";
import { ContactButtons } from "@/components/sales/ContactButtons";
import { LinkButton } from "@/components/sales/LinkButton";
import { iHealthyMessage, iHealthyQuoteText, type IHealthyCtaFacts } from "@/lib/ihealthy-cta";

const COVERAGE_LABEL: Record<string, string> = {
  "Full Coverage": "เต็มจำนวน",
  Deductible: "มีความรับผิดส่วนแรก",
  "Co-Payment": "ร่วมจ่าย",
};

export interface IHealthyShown {
  /** all three in satang, as the pricing carries them */
  base: number;
  rider: number;
  total: number;
  belowMinimum: boolean;
  /** the two instalments the card is not showing, in the order the table prices them */
  others: { mode: PayMode; total: number }[];
}

/**
 * The three figures for the instalment on screen, or nothing at all.
 *
 * Nothing rather than a partial row: a mode the pricing turns out not to carry is a miss,
 * and a card that printed a total with no base line under it would read as a complete quote.
 */
export function shownAt(priced: IHealthyPricing | undefined, mode: PayMode): IHealthyShown | undefined {
  if (priced === undefined) return undefined;
  const base = priced.base.find((m) => m.mode === mode);
  const rider = priced.rider.find((m) => m.mode === mode);
  const total = priced.total.find((m) => m.mode === mode);
  if (!base || !rider || !total) return undefined;
  return {
    base: base.total,
    rider: rider.total,
    total: total.total,
    belowMinimum: total.belowMinimum,
    others: priced.total.filter((m) => m.mode !== mode).map((m) => ({ mode: m.mode, total: m.total })),
  };
}

export interface IHealthyCalculatorProps {
  table: IHealthyTable;
  /** only the benefit rows the browser draws; the contract's prose stays on the server */
  data: BenefitTableData;
  /** the one sentence from `terms` the table itself prints under its own scroll hint */
  sharedLimit: string;
  initial: IHealthyInitial;
  /** pin a copy of the contact buttons to the bottom of a phone screen */
  sticky?: boolean;
}

/**
 * The customer's own quote for the health rider and the plan it rides on.
 *
 * State holds what was asked for; every render resolves that to what the company sells at
 * the age on screen, so the panel is never showing a price for one arrangement while the
 * pickers show another.
 */
export function IHealthyCalculator(
  { table, data, sharedLimit, initial, sticky = false }: IHealthyCalculatorProps,
) {
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [age, setAge] = useState(initial.age);
  const [sex, setSex] = useState<Sex>(initial.sex);
  const [wantBase, setWantBase] = useState(initial.base);
  const [wantSum, setWantSum] = useState(initial.sumAssured);
  const [wantPlan, setWantPlan] = useState(initial.plan);
  // Held but never set: the form does not ask for a territory, and an arrangement that
  // arrived by link carrying เอเชีย or ทั่วโลก keeps it rather than being quietly re-priced
  // for Thailand.
  const [wantTerritory] = useState(initial.territory);
  const [wantCoverage, setWantCoverage] = useState(initial.coverage);
  // Likewise: the card headlines the yearly instalment and prints the other two beneath it,
  // so there is nothing for a picker to choose that the card is not already showing.
  const [mode] = useState<PayMode>(initial.mode);

  const base = baseFor(table, wantBase);
  const sumOptions = sumsFor(base);
  const sumAssured = sumFor(base, wantSum);
  const { plan, plans, territory, coverage, coverages } = resolveArrangement(
    table, age, { plan: wantPlan, territory: wantTerritory, coverage: wantCoverage },
  );

  /**
   * What the whole arrangement costs a year under each of the six plans, so the benefit
   * table carries the figure every one of its rows is being weighed against. Everything but
   * the health plan is held still, which is what makes the six comparable: the same person,
   * the same base plan and sum, the same kind of cover.
   *
   * Undefined, not a row of dashes, when no price may be shown — a lapsed rate table has
   * nothing to say about price and the table still has plenty to say about cover.
   */
  const premiums = table.expired
    ? undefined
    : Object.fromEntries(
        table.plans.map((p) => {
          const priced = territory && coverage
            ? iHealthyPricing(table, {
                base: base.variant, sex, age, sumAssured, plan: p.code, territory, coverage,
              })
            : undefined;
          return [p.code, priced?.total.find((m) => m.mode === "annual")?.total ?? null];
        }),
      );

  /**
   * The address bar follows the card, so the link an agent copies opens on the arrangement
   * the agent is looking at. It is written from what was resolved and not from what was
   * asked for — ask for ซิลเวอร์ at eight and the address ends up saying สมาร์ท, which is the
   * plan on screen — and the three `??` are only for the age no rate table sells anything at,
   * where the card says so and the link may as well say what the form is still holding.
   */
  const link = queryFrom(table, {
    age, sex, base: base.variant, sumAssured, mode,
    plan: plan?.code ?? wantPlan,
    territory: territory ?? wantTerritory,
    coverage: coverage ?? wantCoverage,
  });
  useEffect(() => {
    // `replaceState` rather than `push`: a Back button that had to walk out through every
    // dropdown the reader touched would never reach the page they came from. And only when
    // the address would really change, so that a customer opening a link the page itself
    // wrote is not handed a rewritten one on first paint — the hash survives with it, since
    // this replaces the whole address and not only its query.
    if (window.location.search.replace(/^\?/, "") !== link) {
      window.history.replaceState(null, "", `?${link}${window.location.hash}`);
    }
  }, [link]);

  const priced = plan && territory && coverage
    ? iHealthyPricing(table, {
        base: base.variant, sex, age, sumAssured, plan: plan.code, territory, coverage,
      })
    : undefined;
  /** An expired rate set prices, but not at a figure anyone may be quoted. */
  const shown = table.expired ? undefined : shownAt(priced, mode);
  const death = deathBenefitOf(table, base.variant, age, sumAssured);

  /**
   * The quote the page hands over is the arrangement the card shows — the base plan and the
   * health rider, and nothing from the agent's fold below it. Those riders live in the
   * panel's own state, and lifting them up here would make the panel controlled for the sake
   * of a line of text; the fold's total stays inside the fold on purpose.
   */
  const cta: IHealthyCtaFacts = {
    arrangement: plan && territory && coverage
      ? {
          planName: plan.name, annualMax: plan.annualMax, deductible: plan.deductible,
          territory, coverage,
        }
      : undefined,
    copayPercent: data.copayPercent,
    age,
    sex,
    baseLabel: base.label,
    sumAssured,
    death,
    mode,
    minMonthly: table.minMonthly,
    shown,
  };
  const quoteText = iHealthyQuoteText(cta);
  const message = iHealthyMessage(cta);

  const label = "block text-sm text-[var(--lg-mute)]";
  const field =
    "mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-base text-[var(--lg-white)]";
  const hint = "mt-1 text-xs leading-relaxed text-[var(--lg-mute)]";
  const tool =
    "rounded-sm border border-[var(--lg-panel-line)] px-3 py-3 text-center text-sm text-[var(--lg-mute)]";
  const chip = (on: boolean) =>
    `rounded-sm border px-2 py-2.5 text-center text-sm transition-colors ${
      on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
    }`;

  return (
    <div className="space-y-6">
      {/* On paper the form is gone, so what it held has to be said in words: a premium and
          a benefit table with nothing naming who they are for is not a quote. */}
      <div className="hidden print:block">
        <h2 className="text-lg font-medium">
          ไอเฮลท์ตี้ อัลตร้า แผน{plan?.name ?? "—"} · {territory ?? "—"}
          {coverage && coverage !== "Full Coverage" ? ` · ${COVERAGE_LABEL[coverage]}` : ""}
        </h2>
        <p className="mt-1 text-sm">
          {sex === "M" ? "ชาย" : "หญิง"} {age} ปี · {base.label} ทุน{" "}
          {sumAssured.toLocaleString("en-US")} บาท · {PAY_MODE_LABEL[mode]}
        </p>
      </div>

      <div className="space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5 print:hidden">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="ihu-age" className={label}>อายุ</label>
            {/* Seventy-five options, and still a picker rather than a number field, for the
                reason its sibling on /lifeprotect gives: a phone opens the wheel instead of
                the keypad, and one flick covers a decade. The list is the company's own
                issue-age range for this rider, so an age it will not cover cannot be reached
                and then have to be explained away — which is worth more here than on the
                base plan, because half the arrangement changes with the age. */}
            <select id="ihu-age" className={field} value={age} onChange={(e) => setAge(Number(e.target.value))}>
              {AGES.map((a) => <option key={a} value={a}>{a} ปี</option>)}
            </select>
          </div>
          <div>
            <span className={label}>เพศ</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["M", "F"] as Sex[]).map((s) => (
                <button key={s} type="button" aria-pressed={sex === s} onClick={() => setSex(s)} className={chip(sex === s)}>
                  {s === "M" ? "ชาย" : "หญิง"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className={label}>สัญญาหลัก</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {table.bases.map((b) => (
              <button
                key={b.variant} type="button" aria-pressed={b.variant === base.variant}
                onClick={() => setWantBase(b.variant)} className={chip(b.variant === base.variant)}
              >
                <span className="block">{b.short}</span>
                {/* the package carries no note: its subtitle is its pinned sum, read from
                    the field itself so the two can never disagree */}
                <span className="mt-0.5 block text-xs opacity-80">
                  {b.note ?? `ทุน ${b.fixedSum?.toLocaleString("en-US")}`}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div>
          {/* The heading branches with the field under it. `htmlFor` would point at nothing
              once the select is gone — a paragraph is not labelable, so it cannot take the
              id and be named by it — and the pinned figure would be read out unnamed. */}
          {base.fixedSum !== undefined ? (
            <>
              <span id="ihu-sum-label" className={label}>ทุนสัญญาหลัก</span>
              <p
                aria-labelledby="ihu-sum-label"
                className="mt-1.5 rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-base tabular-nums text-[var(--lg-mute)]"
              >
                {base.fixedSum.toLocaleString("en-US")} บาท · แพ็กเกจกำหนดไว้ เปลี่ยนไม่ได้
              </p>
            </>
          ) : (
            <>
              <label htmlFor="ihu-sum" className={label}>ทุนสัญญาหลัก</label>
              <select id="ihu-sum" className={field} value={sumAssured} onChange={(e) => setWantSum(Number(e.target.value))}>
                {sumOptions.map((s) => <option key={s} value={s}>{s.toLocaleString("en-US")} บาท</option>)}
              </select>
            </>
          )}
        </div>

        <div>
          <span className={label}>แผนสุขภาพ</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {plans.map((p) => (
              <button
                key={p.code} type="button" aria-pressed={p.code === plan?.code}
                onClick={() => setWantPlan(p.code)} className={chip(p.code === plan?.code)}
              >
                <span className="block">{p.name}</span>
                <span className="mt-0.5 block text-xs tabular-nums opacity-80">
                  {(p.annualMax / 1_000_000).toLocaleString("en-US")} ล้าน
                </span>
              </button>
            ))}
          </div>
          {/* Which plans are short is the rate table's answer; why they are short is not, and
              a revision that withdrew a plan at 76 would have this blaming a 76-year-old for
              being a child. It names the age on screen and leaves the reason unsaid. */}
          {plans.length < table.plans.length && (
            <p className={hint}>
              ที่อายุ {age} ปี บริษัทขายเฉพาะแผน{plans.map((p) => p.name).join("และ")}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="ihu-cover" className={label}>ความคุ้มครอง</label>
          <select id="ihu-cover" className={field} value={coverage ?? ""} onChange={(e) => setWantCoverage(e.target.value)}>
            {coverages.map((c) => <option key={c} value={c}>{COVERAGE_LABEL[c] ?? c}</option>)}
          </select>
          {/* The territory is not asked for: this page sells cover in Thailand, which is the
              only territory five of the six plans are written for anyway. It stays in the
              state and in the link, so an arrangement written for เอเชีย or ทั่วโลก still
              prices if one arrives — there is simply no way to ask for one from here. */}
          {coverages.length === 1 && coverage && territory && (
            <p className={hint}>
              อาณาเขต{territory}มีเฉพาะความคุ้มครองแบบ{COVERAGE_LABEL[coverage] ?? coverage}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
        {plan === undefined || priced === undefined ? (
          // Nothing the pickers can reach lands here; a rate revision that took a rate away
          // from either half would, and the half it came from is not worth guessing at — so
          // the card names no ceiling and sends the reader back to the form rather than to
          // the health plan in particular.
          <p className="text-sm font-medium text-[var(--lg-gold)]">
            ที่อายุ {age} ปี บริษัทยังไม่เปิดขายแบบที่เลือกไว้ ลองเปลี่ยนสัญญาหลักหรือแผนสุขภาพ
          </p>
        ) : (
          <>
            {shown ? (
              <>
                <dl className="space-y-2 text-sm">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--lg-mute)]">
                      {base.label} ทุน {sumAssured.toLocaleString("en-US")}
                    </dt>
                    <dd className="lg-figure tabular-nums text-[var(--lg-white)]">{formatBaht(shown.base)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[var(--lg-mute)]">ไอเฮลท์ตี้ อัลตร้า แผน{plan.name}</dt>
                    <dd className="lg-figure tabular-nums text-[var(--lg-white)]">{formatBaht(shown.rider)}</dd>
                  </div>
                </dl>
                <div className="border-t border-[var(--lg-panel-line)] pt-4">
                  <div className="text-sm text-[var(--lg-mute)]">เบี้ยรวม {PAY_MODE_LABEL[mode]}</div>
                  <div className="lg-figure mt-1 text-[2.4rem] leading-none tabular-nums">
                    <span className="lg-metal-text">{formatBaht(shown.total)}</span>
                    <span className="ml-2 text-base text-[var(--lg-mute)]">บาท</span>
                  </div>
                  {shown.belowMinimum && (
                    <p className="mt-2 text-xs text-[var(--lg-gold)]">
                      ต่ำกว่าเบี้ยรายเดือนขั้นต่ำ {table.minMonthly.toLocaleString("en-US")} บาท ที่บริษัทรับชำระ
                    </p>
                  )}
                  {/* One instalment to a line, and laid out the way the two contract lines
                      above are: an agent reading a figure off the screen to a customer
                      should find it in the same place every time, not somewhere along a
                      sentence. */}
                  <dl className="mt-3 space-y-1.5 text-sm">
                    {shown.others.map((m) => (
                      <div key={m.mode} className="flex items-baseline justify-between gap-3">
                        <dt className="text-[var(--lg-mute)]">{PAY_MODE_LABEL[m.mode]}</dt>
                        <dd className="lg-figure tabular-nums text-[var(--lg-white)]">
                          {formatBaht(m.total)} <span className="text-xs text-[var(--lg-mute)]">บาท</span>
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </>
            ) : (
              // The rate set below this page has lapsed. What the contract pays is still
              // true; what it costs is not ours to say any more.
              <p className="text-sm font-medium text-[var(--lg-gold)]">
                ตารางเบี้ยชุดนี้หมดอายุแล้ว ขอเบี้ยปัจจุบันได้จากตัวแทน
              </p>
            )}
            <div className="border-t border-[var(--lg-panel-line)] pt-4 text-sm text-[var(--lg-mute)]">
              <p>
                วงเงินค่ารักษาต่อปี{" "}
                <span className="lg-figure tabular-nums text-[var(--lg-white)]">
                  {plan.annualMax.toLocaleString("en-US")}
                </span>{" "}
                บาท
                {coverage === "Deductible" && ` · รับผิดส่วนแรก ${plan.deductible.toLocaleString("en-US")} บาทต่อปี`}
                {coverage === "Co-Payment" && ` · ร่วมจ่าย ${data.copayPercent} เปอร์เซ็นต์ของค่าใช้จ่ายที่คุ้มครอง`}
              </p>
              {/* the rider covers the illness; this is the one thing the base plan is for,
                  and past the booster age it stops doubling rather than stops paying */}
              {death.alreadyPastAge ? (
                <p className="mt-1">
                  ครอบครัวได้รับ{" "}
                  <span className="lg-figure tabular-nums text-[var(--lg-white)]">
                    {death.sumFrom.toLocaleString("en-US")}
                  </span>{" "}
                  บาท · ตั้งแต่อายุ {death.beforeAge} คุ้มครองเท่าทุน
                </p>
              ) : (
                <p className="mt-1">
                  เสียชีวิตก่อนอายุ {death.beforeAge} ครอบครัวได้{" "}
                  <span className="lg-figure tabular-nums text-[var(--lg-white)]">
                    {death.sumBefore.toLocaleString("en-US")}
                  </span>{" "}
                  บาท
                </p>
              )}
              {shown && (
                <p className="mt-1 opacity-80">เบี้ยปีแรก ปีต่อไปคิดตามอายุที่เพิ่มขึ้น</p>
              )}
            </div>
          </>
        )}
      </div>

      {/* The agent's own half, under the customer's, and on exactly the condition the card
          above prices one: `shown` is the whole test — a current rate table, and a price for
          all three of base, rider and instalment. Anything weaker and the fold would go on
          quoting from a table the card has just called lapsed, or offer riders to attach to
          a base the company does not cover at this age. */}
      {shown && plan && territory && coverage && (
        <RiderPanel
          request={{
            base: base.variant, age, sex, sumAssured, mode,
            plan: plan.code, territory, coverage,
          }}
        />
      )}

      {/* On a wide screen the table steps out of the page's reading measure and takes the
          whole window: all six plans fit there, and scrolling sideways would be a cost with
          nothing to buy. The prose around it keeps the narrow measure, which is what makes
          prose readable. On a phone the table stays in the column and scrolls. */}
      <div className="sm:mx-[calc(50%-50vw)] sm:w-screen sm:px-6">
        <BenefitTable
          data={data} selected={plan?.code ?? ""} age={age} sharedLimit={sharedLimit}
          sellable={plans.map((p) => p.code)} premiums={premiums}
        />
      </div>

      {/* The way out of the page, and last of the three things on it: a health rider is
          bought on the twenty-eight rows above, so the buttons sit where a reader arrives
          having read them rather than above the table they came for. */}
      {/* The agent's two ways of handing this over, kept apart from the customer's own
          button below: one puts the arrangement on paper, the other puts its address on the
          clipboard. Both are the agent working, not the customer deciding. */}
      <div className="grid grid-cols-2 gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className={tool}>
          พิมพ์ หรือบันทึก PDF
        </button>
        <LinkButton className={tool} />
      </div>

      <div className="print:hidden">
        <ContactButtons message={message} copyText={quoteText} />
      </div>

      {sticky && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden print:hidden">
          <ContactButtons message={message} copyText={quoteText} compact />
        </div>
      )}
    </div>
  );
}
