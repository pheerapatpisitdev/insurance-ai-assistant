"use client";
import { useMemo, useState } from "react";
import type { PayMode, Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange, bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
import { formatBaht } from "@/calc/money";
import type { LegacyAge } from "@/lib/legacy-cta";
import { chatUrl, displayPremium, legacyMessage, lineUrl, messengerUrl, perDay } from "@/lib/legacy-cta";
import type { LegacyChannels } from "@/lib/legacy-channels";
import { deathBenefitRows } from "@/lib/death-benefit";

const BUNDLE = getBundle("LEGACY_FAMILY")!;
const RANGE = bundleAgeRange(BUNDLE);

/** How each instalment reads on the card, where it labels a figure rather than follows it. */
const PER_LABEL: Record<PayMode, string> = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" };

/** Every age the bundle issues at, so the picker offers them rather than trusting typing. */
const AGES = Array.from({ length: RANGE.max - RANGE.min + 1 }, (_, i) => RANGE.min + i);

export interface LegacyCalculatorProps {
  /**
   * Where the contact buttons point. Resolved on the server from the channels the bot
   * already answers on, so the page cannot end up offering a Page nobody is listening to.
   */
  channels: LegacyChannels;
  /**
   * Pin a copy of the contact buttons to the bottom of a phone screen. The bar has to be
   * rendered from here rather than by the page, because this is the only place that knows
   * which sum and age the customer has landed on.
   */
  sticky?: boolean;
}

/**
 * The customer's calculator. It sells one arrangement, so there is nothing to choose but the
 * sum, the age and the sex — every other decision was made when the bundle was designed, and
 * the agent's own calculator is where the rest of them can still be changed.
 */
export function LegacyCalculator({ channels, sticky = false }: LegacyCalculatorProps) {
  const [millions, setMillions] = useState(1);
  const [age, setAge] = useState<LegacyAge>("");
  const [sex, setSex] = useState<Sex>("M");

  // The picker only offers ages the bundle takes, so a number here is always one of them;
  // everyone else picks the way out and is answered rather than quoted.
  const inRange = typeof age === "number";

  const result = useMemo(
    () => (typeof age === "number" ? quoteBundle(BUNDLE, millions, { age, sex, mode: "annual" }) : undefined),
    [age, sex, millions],
  );
  const modes = useMemo(
    () => (typeof age === "number" ? bundleModePremiums(BUNDLE, millions, { age, sex }) : undefined),
    [age, sex, millions],
  );

  const expired = result?.meta.expired ?? false;
  const headline = displayPremium(modes, expired);
  const annual = modes?.find((m) => m.mode === "annual");
  // the instalments the headline did not take, minus any the company will not accept
  const others = (modes ?? []).filter((m) => m !== headline && !m.belowMinimum);
  const death = result?.deathBenefit;

  const message = legacyMessage({ millions, age, sex, range: RANGE, premium: headline });

  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <label htmlFor="legacy-sum" className="block text-sm font-medium text-slate-600">
            อยากให้ครอบครัวได้รับเท่าไหร่
          </label>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {(millions * 1_000_000).toLocaleString("en-US")}{" "}
            <span className="text-lg font-normal text-slate-500">บาท</span>
          </div>
          <input
            id="legacy-sum" type="range" min={1} max={BUNDLE.tiers.length} step={1} value={millions}
            onChange={(e) => setMillions(Number(e.target.value))}
            className="mt-3 w-full accent-emerald-600"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>1 ล้าน</span>
            <span>{BUNDLE.tiers.length} ล้าน</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="legacy-age" className="block text-sm font-medium text-slate-600">อายุ</label>
            {/* a picker rather than a number field: on a phone it opens the wheel instead of
                the keypad, and there is no way to arrive at an age nobody is */}
            <select
              id="legacy-age" value={age}
              onChange={(e) => setAge(e.target.value === "" || e.target.value === "other"
                ? (e.target.value as LegacyAge)
                : Number(e.target.value))}
              className="mt-1 w-full appearance-none rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-lg tabular-nums text-slate-900"
            >
              <option value="">เลือกอายุ</option>
              {AGES.map((a) => <option key={a} value={a}>{a} ปี</option>)}
              <option value="other">อายุอื่น</option>
            </select>
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-600">เพศ</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["M", "F"] as Sex[]).map((s) => (
                <button
                  key={s} type="button" onClick={() => setSex(s)} aria-pressed={sex === s}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    sex === s
                      ? "border-emerald-600 bg-emerald-50 font-medium text-emerald-900"
                      : "border-slate-300 text-slate-600"
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
        <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-6 text-center text-sm text-slate-500">
          กรอกอายุเพื่อดูเบี้ยของคุณ
        </p>
      ) : !inRange || !result ? (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-6 text-center text-sm text-amber-900">
          ชุดนี้รับอายุ {RANGE.min}–{RANGE.max} ปี ทักมาให้เราช่วยหาแบบที่เหมาะกับคุณ
        </div>
      ) : (
        <div className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          {headline && annual ? (
            <div>
              <div className="text-sm text-emerald-800">เบี้ยประกัน</div>
              <div className="text-4xl font-bold tabular-nums text-emerald-900">
                {formatBaht(headline.total)}
                <span className="ml-2 text-base font-normal text-emerald-800">
                  บาท {PER_LABEL[headline.mode]}
                </span>
              </div>
              <div className="mt-0.5 text-sm text-emerald-800">ตกวันละ {perDay(annual.total)} บาท</div>
              {others.length > 0 && (
                <div className="mt-2 text-sm text-emerald-800">
                  {others.map((m) => `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`).join(" · ")}
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-emerald-900">ขอราคาปัจจุบันได้ทางแชทด้านล่าง</div>
          )}

          {death && (
            <div className="border-t border-emerald-200 pt-4">
              <div className="text-sm text-emerald-800">ครอบครัวได้รับ</div>
              {/* every band at the same size: the one that shrinks is the one a customer
                  most needs to see, so it does not get to be the small print */}
              <dl className="mt-1 space-y-1">
                {deathBenefitRows(death).map((row) => (
                  <div key={row.label} className="flex items-baseline justify-between gap-3">
                    <dt className="text-sm text-emerald-800">{row.label}</dt>
                    <dd className="text-lg font-semibold tabular-nums text-emerald-900">
                      {row.amount.toLocaleString("en-US")} บาท
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          <p className="border-t border-emerald-200 pt-3 text-xs leading-relaxed text-emerald-800">
            เบี้ยปีแรก ส่วนสัญญาโรคร้ายแรงคิดตามอายุ จึงปรับขึ้นในปีถัดไป · จ่ายเมื่อเสียชีวิต
            หรือเมื่อตรวจพบ 1 ใน 31 โรคร้ายแรงตามคำนิยามในกรมธรรม์
          </p>
        </div>
      )}

      <ContactButtons channels={channels} message={message} />

      {sticky && (
        <div className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-200 bg-white/95 p-3 backdrop-blur sm:hidden">
          <ContactButtons channels={channels} message={message} compact />
        </div>
      )}
    </div>
  );
}

/**
 * The way out of the page, in every channel that has been configured. A channel with no
 * setting is left out rather than shown broken, so a page with only the assistant wired up
 * still reads as finished.
 *
 * The message is prepared, never sent: pressing send stays the customer's own act.
 */
function ContactButtons(
  { channels, message, compact = false }: { channels: LegacyChannels; message: string; compact?: boolean },
) {
  const shape = compact
    ? "rounded-lg px-3 py-2.5 text-center text-sm font-medium"
    : "rounded-xl px-5 py-3 text-center font-medium";
  return (
    <div className={compact ? "flex gap-2 [&>*]:flex-1" : "grid gap-2"}>
      {channels.lineOaId && (
        <a
          href={lineUrl(channels.lineOaId, message)} target="_blank" rel="noopener noreferrer"
          className={`${shape} bg-emerald-600 text-white`}
        >
          {compact ? "ทักไลน์" : "ทักไลน์ปรึกษาฟรี"}
        </a>
      )}
      {channels.messengerPage && (
        <a
          href={messengerUrl(channels.messengerPage, message)} target="_blank" rel="noopener noreferrer"
          className={`${shape} bg-blue-600 text-white`}
        >
          {compact ? "Messenger" : "ทัก Messenger"}
        </a>
      )}
      <a href={chatUrl(message)} className={`${shape} border border-slate-300 text-slate-700`}>
        {compact ? "ถาม AI" : "ถาม AI ก่อนก็ได้"}
      </a>
    </div>
  );
}
