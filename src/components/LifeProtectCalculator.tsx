"use client";
import { useMemo, useState } from "react";
import type { Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER, displayPremium, perDay } from "@/lib/legacy-cta";
import type { LegacyChannels } from "@/lib/legacy-channels";
import type { LifeProtectTable } from "@/lib/lifeprotect-table";
import { cashAt, deathBenefitOf, lifeProtectModes, payYears, termAt, totalPaid } from "@/lib/lifeprotect-quote";
import { ageWord, lifeProtectMessage, type LifeProtectAge } from "@/lib/lifeprotect-cta";
import { deathBenefitRows } from "@/lib/death-benefit";
import { ContactButtons } from "@/components/sales/ContactButtons";

/** How each instalment reads on the card, where it labels a figure rather than follows it. */
const PER_LABEL = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" } as const;

const SUM_MIN = 500_000;
const SUM_MAX = 10_000_000;
const SUM_STEP = 500_000;
const SUM_START = 1_000_000;
/** the term the page opens on: the middle one, and the one the copy recommends */
const TERM_START = "WLF19H";
/** the last age the "bought for a child" note shows at */
const CHILD_MAX_AGE = 15;

export interface LifeProtectCalculatorProps {
  /** the rates and factors the browser prices from; the engine never leaves the server */
  table: LifeProtectTable;
  /** where the contact buttons point, resolved on the server */
  channels: LegacyChannels;
  /** pin a copy of the contact buttons to the bottom of a phone screen */
  sticky?: boolean;
}

/**
 * The customer's calculator for the base plan on its own. Four choices — sum, term, age, sex —
 * and every figure on the card follows from them at once, in the browser, from the table.
 */
export function LifeProtectCalculator({ table, channels, sticky = false }: LifeProtectCalculatorProps) {
  const AGES = useMemo(
    () => Array.from({ length: table.ageMax - table.ageMin + 1 }, (_, i) => table.ageMin + i),
    [table.ageMin, table.ageMax],
  );
  const [sumAssured, setSum] = useState(SUM_START);
  const [variant, setVariant] = useState(TERM_START);
  const [age, setAge] = useState<LifeProtectAge>("");
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
  const years = who ? payYears(term, who.age) : undefined;
  const death = who ? deathBenefitOf(table, who.age, sumAssured) : undefined;
  const cash = who ? cashAt(term, sex, who.age, sumAssured, table.ageMin) : [];

  const message = lifeProtectMessage({ sumAssured, termLabel: term.label, age, sex, ageMax: table.ageMax, premium: headline });

  /** the figure on a term button: that term's own headline instalment, once there is an age */
  const buttonPrice = (v: string): string | undefined => {
    if (!who) return undefined;
    const p = displayPremium(lifeProtectModes(table, termAt(table, v), who), table.expired);
    return p ? `${formatBaht(p.total)}${PER[p.mode]}` : undefined;
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
            id="lp-sum" type="range" min={SUM_MIN} max={SUM_MAX} step={SUM_STEP} value={sumAssured}
            onChange={(e) => setSum(Number(e.target.value))}
            className="mt-4 w-full accent-[var(--lg-gold)]"
          />
          <div className="mt-1 flex justify-between text-xs text-[var(--lg-mute)] opacity-70">
            <span>5 แสน</span>
            <span>10 ล้าน</span>
          </div>
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
                  <span className="block text-sm">{t.label}</span>
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
              onChange={(e) => setAge(e.target.value === "" || e.target.value === "over"
                ? (e.target.value as LifeProtectAge)
                : Number(e.target.value))}
              className="mt-1.5 w-full appearance-none rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] px-3 py-2.5 text-lg tabular-nums text-[var(--lg-white)]"
            >
              <option value="">เลือกอายุ</option>
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

      {age === "" ? (
        <p className="rounded-sm border border-dashed border-[var(--lg-panel-line)] px-5 py-7 text-center text-sm text-[var(--lg-mute)]">
          เลือกอายุเพื่อดูเบี้ยของคุณ
        </p>
      ) : !inRange || !modes ? (
        <div className="rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] px-5 py-7 text-center text-sm leading-relaxed text-[var(--lg-white)]">
          แบบนี้รับถึงอายุ {table.ageMax} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
        </div>
      ) : (
        <div className="space-y-5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] p-5">
          {headline && annual && years !== undefined ? (
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
              <p className="mt-3 text-sm leading-relaxed text-[var(--lg-white)]">
                จ่ายทั้งหมด {years} ปี รวมประมาณ{" "}
                <span className="lg-figure tabular-nums text-[var(--lg-gold)]">{formatBaht(totalPaid(annual.total, years))}</span> บาท
                {" "}· คุ้มครอง {sumAssured.toLocaleString("en-US")} บาทถึงอายุ {table.coverToAge}
              </p>
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

      <ContactButtons channels={channels} message={message} />

      {sticky && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-[var(--lg-hair)] bg-[var(--lg-ground)]/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons channels={channels} message={message} compact />
        </div>
      )}
    </div>
  );
}
