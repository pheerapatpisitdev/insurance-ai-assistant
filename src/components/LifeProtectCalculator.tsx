"use client";
import { useMemo, useState } from "react";
import type { Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, displayPremium, perDay } from "@/lib/legacy-cta";
import type { LifeProtectTable } from "@/lib/lifeprotect-table";
import { cashAt, deathBenefitOf, lifeProtectModes, payYears, termAt } from "@/lib/lifeprotect-quote";
import { cashProjection } from "@/lib/cash-projection";
import { CashValueChart } from "@/components/lifeprotect/CashValueChart";
import { CashValueTable } from "@/components/lifeprotect/CashValueTable";
import { ageWord, lifeProtectMessage, lifeProtectQuoteText, type LifeProtectAge } from "@/lib/lifeprotect-cta";
import { cardPath } from "@/lib/quote-card";
import { deathBenefitRows } from "@/lib/death-benefit";
import { ContactButtons } from "@/components/sales/ContactButtons";

/** How each instalment reads on the card, where it labels a figure rather than follows it. */
const PER_LABEL = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" } as const;

/**
 * The sums the slider offers: every half million up to ten, then every million up to fifty.
 * One step the whole way would be a hundred stops on a thumb-wide track; the coarser upper
 * half keeps the slider usable where the extra half-millions matter least.
 */
const SUMS = [
  ...Array.from({ length: 20 }, (_, i) => 500_000 * (i + 1)),
  ...Array.from({ length: 40 }, (_, i) => 11_000_000 + 1_000_000 * i),
];
const SUM_START_INDEX = SUMS.indexOf(1_000_000);
/**
 * The term the page opens on: the one that puts the smallest number in front of a stranger.
 * The other two are a tap away with their own prices already on them, so opening cheap costs
 * nothing — and the figure the hero quotes comes from this term too, so the page does not
 * promise one price above the fold and show another below it.
 */
const TERM_START = "WLF99H";
/**
 * The age the page opens on. A visitor arriving from an ad sees a real price before touching
 * anything — an empty card asking to be filled in is one more thing to do before the number
 * they came for. 35 is the age the hero already quotes and the middle of who buys this.
 */
const AGE_START = 35;
/** the last age the "bought for a child" note shows at */
const CHILD_MAX_AGE = 15;

export interface LifeProtectCalculatorProps {
  /** the rates and factors the browser prices from; the engine never leaves the server */
  table: LifeProtectTable;
  /** pin a copy of the contact buttons to the bottom of a phone screen */
  sticky?: boolean;
}

/**
 * The customer's calculator for the base plan on its own. Four choices — sum, term, age, sex —
 * and every figure on the card follows from them at once, in the browser, from the table.
 */
export function LifeProtectCalculator({ table, sticky = false }: LifeProtectCalculatorProps) {
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [sumIndex, setSumIndex] = useState(SUM_START_INDEX);
  const sumAssured = SUMS[sumIndex];
  const [variant, setVariant] = useState(TERM_START);
  const [age, setAge] = useState<LifeProtectAge>(AGE_START);
  const [sex, setSex] = useState<Sex>("M");

  const term = termAt(table, variant);
  // the picker only offers ages the plan takes, so a number here is always one of them
  const ageNum = typeof age === "number" ? age : undefined;
  const inRange = ageNum !== undefined;
  const who = ageNum !== undefined ? { sex, age: ageNum, sumAssured } : undefined;

  const modes = who ? lifeProtectModes(table, term, who) : undefined;
  const headline = displayPremium(modes, table.expired);
  const annual = modes?.find((m) => m.mode === "annual");
  const others = (modes ?? []).filter((m) => m.mode !== headline?.mode && !m.belowMinimum);
  const death = who ? deathBenefitOf(table, who.age, sumAssured) : undefined;
  const cash = who ? cashAt(term, sex, who.age, sumAssured, table.ageMin) : [];
  /**
   * Every figure below scales straight off the sum assured, so dragging the slider redraws
   * the chart and the table without asking the server for anything.
   */
  const factors = who ? term.schedule[sex][who.age - table.ageMin] : null;
  const projection = who && death && factors
    ? cashProjection({
        factors, age: who.age, sumAssured,
        annualSatang: table.expired || !annual ? null : annual.total,
        payYears: payYears(term, who.age), death,
        // the proposal's footnote: the multiple of the sum, the surrender value, or 101% of premiums
        topUp: { premiumPercent: 101, includeCashValue: true },
      })
    : undefined;
  const tableCaption = who
    ? `ทุนประกัน ${sumAssured.toLocaleString("en-US")} บาท · ${sex === "M" ? "ชาย" : "หญิง"} `
      + `${who.age === 0 ? "แรกเกิด" : `${who.age} ปี`} · ${term.short}`
      + (annual && !table.expired ? ` · เบี้ย ${formatBaht(annual.total)} บาท/ปี` : "")
    : "";

  const message = lifeProtectMessage({ sumAssured, termLabel: term.label, age, sex, ageMax: table.ageMax, premium: headline });
  // the same figures the card is showing, or nothing: a copied quote must never say more than the page
  const card = who && headline
    ? cardPath({ kind: "plan", planCode: table.planCode, variant, age: who.age, sex, sumAssured, mode: headline.mode })
    : undefined;
  const quoteText = who && headline && death
    ? lifeProtectQuoteText({ sumAssured, termLabel: term.label, age: who.age, sex, modes: [headline, ...others], death, cash })
    : undefined;

  /**
   * The figure on a term button: that term's yearly premium, once there is an age. Yearly on
   * every button, whatever the card headlines — a row that mixed months and years (because
   * one term fell under the monthly floor) could not be compared at a glance.
   */
  const buttonPrice = (v: string): string | undefined => {
    if (!who || table.expired) return undefined;
    const yearly = lifeProtectModes(table, termAt(table, v), who)?.find((m) => m.mode === "annual");
    return yearly ? `${formatBaht(yearly.total)}${PER.annual}` : undefined;
  };

  return (
    <div className="space-y-6">
      <div className="space-y-6 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
        <div>
          <label htmlFor="lp-sum" className="block text-sm text-[var(--lg-mute)]">ทุนประกัน</label>
          <div className="lg-figure mt-1.5 text-3xl tabular-nums">
            <span className="lg-metal-text">{sumAssured.toLocaleString("en-US")}</span>{" "}
            <span className="text-lg text-[var(--lg-mute)]">บาท</span>
          </div>
          <input
            id="lp-sum" type="range" min={0} max={SUMS.length - 1} step={1} value={sumIndex}
            onChange={(e) => setSumIndex(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--lg-gold)]"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--lg-mute)] opacity-70">
            <span>5 แสน</span>
            <span>50 ล้าน</span>
          </div>
          {/* the doubled sum sits under the sum being chosen, because it is the reason to choose
              it; once the insured is past the booster age the line tells the plain truth instead */}
          {ageNum !== undefined && ageNum >= table.boosterBeforeAge ? (
            <p className="mt-4 text-sm leading-relaxed text-[var(--lg-mute)]">
              ครอบครัวได้รับ{" "}
              <span className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">{sumAssured.toLocaleString("en-US")}</span> บาท
              {" "}· ตั้งแต่อายุ {table.boosterBeforeAge} คุ้มครองเท่าทุน
            </p>
          ) : (
            <p className="mt-4 text-sm leading-relaxed text-[var(--lg-mute)]">
              เสียชีวิตก่อนอายุ {table.boosterBeforeAge} ครอบครัวได้{" "}
              <span className="lg-figure text-lg tabular-nums text-[var(--lg-gold)]">
                {deathBenefitOf(table, 0, sumAssured).sumBefore.toLocaleString("en-US")}
              </span>{" "}
              บาท <span className="opacity-70">(2 เท่าของทุน)</span>
            </p>
          )}
        </div>

        <div>
          <span className="block text-sm text-[var(--lg-mute)]">งวดชำระเบี้ย</span>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {table.terms.map((t) => {
              const on = t.variant === variant;
              const price = buttonPrice(t.variant);
              return (
                <button
                  key={t.variant} type="button" onClick={() => setVariant(t.variant)} aria-pressed={on}
                  className={`rounded-sm border px-2 py-2.5 text-center transition-colors ${
                    on ? "lg-metal-face border-[var(--lg-gold)] font-medium" : "border-[var(--lg-panel-line)] text-[var(--lg-mute)]"
                  }`}
                >
                  <span className="block text-sm">{t.short}</span>
                  {price && <span className="mt-0.5 block text-xs tabular-nums opacity-80">{price}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="lp-age" className="block text-sm text-[var(--lg-mute)]">อายุ</label>
            {/* a picker rather than a number field: on a phone it opens the wheel instead of
                the keypad, and there is no way to arrive at an age nobody is */}
            <select
              id="lp-age" value={age}
              onChange={(e) => setAge(e.target.value === "over" ? "over" : Number(e.target.value))}
              className="mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]"
            >
              {AGES.map((a) => <option key={a} value={a}>{a === 0 ? "แรกเกิด" : `${a} ปี`}</option>)}
              <option value="over">{table.ageMax + 1} ปีขึ้นไป</option>
            </select>
          </div>
          <div>
            <span className="block text-sm text-[var(--lg-mute)]">เพศ</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {(["M", "F"] as Sex[]).map((s) => (
                <button
                  key={s} type="button" onClick={() => setSex(s)} aria-pressed={sex === s}
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
      </div>

      {!inRange || !modes ? (
        <div className="rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] px-5 py-7 text-center text-sm leading-relaxed text-[var(--lg-white)]">
          แบบนี้รับถึงอายุ {table.ageMax} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
        </div>
      ) : (
        <div className="space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
          {headline && annual ? (
            <div>
              <div className="text-sm text-[var(--lg-mute)]">เบี้ยประกัน · {term.label}</div>
              <div className="lg-figure mt-1 text-[2.6rem] leading-none tabular-nums">
                <span className="lg-metal-text">{formatBaht(headline.total)}</span>
                <span className="ml-2 text-base text-[var(--lg-mute)]">บาท {PER_LABEL[headline.mode]}</span>
              </div>
              <div className="mt-2.5 text-sm text-[var(--lg-mute)]">ตกวันละ {perDay(annual.total)} บาท</div>
              {others.length > 0 && (
                <div className="mt-1 text-sm text-[var(--lg-mute)] opacity-80">
                  {others.map((m) => `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`).join(" · ")}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-[var(--lg-gold)]">ขอราคาปัจจุบันได้ทางแชทด้านล่าง</div>
          )}

          {death && (
            <div className="pt-1">
              <hr className="lg-rule" />
              <div className="pt-4 text-sm text-[var(--lg-mute)]">ครอบครัวได้รับเมื่อเสียชีวิต</div>
              <dl className="mt-2 space-y-2">
                {deathBenefitRows(death).map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-[var(--lg-mute)]">{row.label}</dt>
                    <dd className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">
                      {row.amount.toLocaleString("en-US")} บาท
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {cash.length > 0 && (
            <div className="pt-1">
              <hr className="lg-rule" />
              <div className="pt-4 text-sm text-[var(--lg-mute)]">มูลค่าเงินสดสะสม (หากเวนคืน)</div>
              <dl className="mt-2 space-y-2">
                {cash.map((row) => (
                  <div key={row.age} className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-[var(--lg-mute)]">อายุ {row.age} ปี</dt>
                    <dd className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">
                      {row.amount.toLocaleString("en-US")} บาท
                    </dd>
                  </div>
                ))}
              </dl>

              {projection && (
                <>
                  <div className="mt-4 text-sm text-[var(--lg-mute)]">ความคุ้มครอง เบี้ย และมูลค่าเงินสด</div>
                  {/* a new term, age or sex is a different contract, so the readout goes back
                      to its break-even year; dragging the sum alone keeps the year in view */}
                  <CashValueChart key={`${variant}-${sex}-${who!.age}`} projection={projection} age={who!.age} />
                  <CashValueTable projection={projection} caption={tableCaption} />
                </>
              )}
            </div>
          )}

          {ageNum !== undefined && ageNum <= CHILD_MAX_AGE && (
            <p className="text-sm leading-relaxed text-[var(--lg-gold)]">
              ✦ เบี้ยล็อกที่อายุ{ageNum === 0 ? "" : " "}{ageWord(ageNum)} ตลอดระยะเวลาชำระ ยิ่งเริ่มเร็วยิ่งถูก
            </p>
          )}

          <p className="border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.8] text-[var(--lg-mute)] opacity-80">
            เบี้ยคงที่ตลอดระยะเวลาชำระ · เบี้ยมาตรฐาน อาจต่างไปตามผลพิจารณารับประกัน
          </p>
        </div>
      )}

      <ContactButtons message={message} copyText={quoteText} cardPath={card} />

      {sticky && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons message={message} copyText={quoteText} cardPath={card} compact />
        </div>
      )}
    </div>
  );
}
