# Legacy Calculator Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/legacy`, a customer-facing calculator that sells only the "มรดกเพื่อครอบครัว" bundle and hands the customer's figures to LINE, Messenger, or the in-app AI chat.

**Architecture:** All pricing comes from the existing bundle engine (`getBundle`, `bundleModePremiums`, `quoteBundle`) — nothing in `src/calc` changes. Message and URL building live in a pure module (`src/lib/legacy-cta.ts`) so the awkward cases — a monthly instalment under the company minimum, an expired rate table, an age the bundle refuses — are decided by tested functions rather than by JSX. The React component reads those decisions and renders them.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind 4, vitest.

Spec: [docs/superpowers/specs/2026-09-04-legacy-calculator-design.md](../specs/2026-09-04-legacy-calculator-design.md)

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/legacy-cta.ts` (create) | Pure: pick the instalment to headline, build the contact message, build the three URLs, work out the per-day figure. No React, no DOM. |
| `tests/calc/legacy-cta.test.ts` (create) | Covers every branch of the above. |
| `src/components/LegacyCalculator.tsx` (create) | The client component: slider, age, sex, result card, contact buttons. Drops into the future sales page unchanged. |
| `src/app/legacy/page.tsx` (create) | The `/legacy` route: Thai metadata, mounts the calculator. |
| `src/app/chat/ChatClient.tsx` (modify) | Read `?q=` once on mount into the draft box. |
| `.env.example` (modify) | Document `NEXT_PUBLIC_LINE_OA_ID` and `NEXT_PUBLIC_FB_PAGE`. |

Reference figures used throughout (verified against the engine on 2026-09-04, all in satang):

| case | annual | semi | monthly | belowMinimum (monthly) | sumFrom | sumBefore |
|---|---|---|---|---|---|---|
| ชาย 38 · 3 ล้าน | 1,668,750 | 867,750 | 150,187 | no | 3,000,000 | 3,150,000 |
| หญิง 30 · 1 ล้าน | 412,300 | 214,396 | 37,107 | **yes** | 1,000,000 | 1,150,000 |
| ชาย 35 · 1 ล้าน | 600,550 | 312,286 | 54,049 | **yes** | 1,000,000 | 1,150,000 |

---

### Task 1: `legacy-cta.ts` — the instalment to headline

**Files:**
- Create: `src/lib/legacy-cta.ts`
- Test: `tests/calc/legacy-cta.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/legacy-cta.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ModePremium } from "@/calc/mode-premiums";
import { displayPremium } from "@/lib/legacy-cta";

/** ชาย 38 ปี มรดก 3 ล้าน — every mode is issuable */
const AFFORDABLE: ModePremium[] = [
  { mode: "annual", total: 1_668_750, belowMinimum: false },
  { mode: "semi", total: 867_750, belowMinimum: false },
  { mode: "monthly", total: 150_187, belowMinimum: false },
];

/** หญิง 30 ปี มรดก 1 ล้าน — the monthly instalment is under the company's 1,000 baht floor */
const UNDER_FLOOR: ModePremium[] = [
  { mode: "annual", total: 412_300, belowMinimum: false },
  { mode: "semi", total: 214_396, belowMinimum: false },
  { mode: "monthly", total: 37_107, belowMinimum: true },
];

describe("displayPremium", () => {
  it("headlines the monthly instalment when the company will take it", () => {
    expect(displayPremium(AFFORDABLE, false)).toEqual(AFFORDABLE[2]);
  });

  it("falls back to the yearly premium when the monthly instalment is under the minimum", () => {
    expect(displayPremium(UNDER_FLOOR, false)).toEqual(UNDER_FLOOR[0]);
  });

  it("shows no price at all once the rate table has expired", () => {
    expect(displayPremium(AFFORDABLE, true)).toBeUndefined();
  });

  it("shows no price when the bundle could not be quoted", () => {
    expect(displayPremium(undefined, false)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/legacy-cta.test.ts`
Expected: FAIL — cannot resolve `@/lib/legacy-cta`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/lib/legacy-cta.ts`:

```ts
import type { ModePremium } from "@/calc/mode-premiums";

/**
 * The instalment to put in the largest type. A customer reads a monthly figure as what the
 * plan costs, so it is preferred — but only while the company will actually take it. Under
 * its monthly floor the instalment is not a price anyone can pay, so the yearly premium
 * takes the headline rather than a number the application would be refused for.
 *
 * Undefined means no price may be shown: the rate table has expired, or the arrangement
 * could not be priced at all.
 */
export function displayPremium(
  modes: ModePremium[] | undefined, expired: boolean,
): ModePremium | undefined {
  if (!modes || expired) return undefined;
  const monthly = modes.find((m) => m.mode === "monthly");
  if (monthly && !monthly.belowMinimum) return monthly;
  return modes.find((m) => m.mode === "annual");
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/legacy-cta.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/legacy-cta.ts tests/calc/legacy-cta.test.ts
git commit -m "feat(legacy): headline the monthly instalment only when the company takes it

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: `legacy-cta.ts` — the per-day figure

**Files:**
- Modify: `src/lib/legacy-cta.ts`
- Test: `tests/calc/legacy-cta.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/legacy-cta.test.ts`:

```ts
import { perDay } from "@/lib/legacy-cta";

describe("perDay", () => {
  it("turns a yearly premium into whole baht a day", () => {
    // ชาย 38 · 3 ล้าน: 16,687.50 บาท/ปี ÷ 365 = 45.7 → 46
    expect(perDay(1_668_750)).toBe(46);
  });

  it("rounds up, so the figure is never one the premium undershoots", () => {
    // หญิง 30 · 1 ล้าน: 4,123 บาท/ปี ÷ 365 = 11.3 → 12
    expect(perDay(412_300)).toBe(12);
  });
});
```

Move the `import { displayPremium }` line and this new import into a single import statement at the top of the file rather than leaving two.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/legacy-cta.test.ts`
Expected: FAIL — `perDay is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `src/lib/legacy-cta.ts`:

```ts
/**
 * The yearly premium as whole baht a day — the figure that makes a five-digit number
 * feel like something. Rounded up rather than down: a day rate the premium does not
 * actually reach would be an understatement of the price.
 */
export function perDay(annualSatang: number): number {
  return Math.ceil(annualSatang / 100 / 365);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/legacy-cta.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/legacy-cta.ts tests/calc/legacy-cta.test.ts
git commit -m "feat(legacy): express the yearly premium as baht a day

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: `legacy-cta.ts` — the contact message

**Files:**
- Modify: `src/lib/legacy-cta.ts`
- Test: `tests/calc/legacy-cta.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/legacy-cta.test.ts` (add `legacyMessage` and the `LegacyFacts` type to the existing import from `@/lib/legacy-cta`):

```ts
describe("legacyMessage", () => {
  it("carries the sum, the insured and the headline premium", () => {
    expect(legacyMessage({ millions: 3, age: 38, sex: "M", inRange: true, premium: AFFORDABLE[2] }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน อายุ 38 ชาย เบี้ยประมาณ 1,501 บาท/เดือน");
  });

  it("names the yearly premium when that is what is on the card", () => {
    expect(legacyMessage({ millions: 1, age: 30, sex: "F", inRange: true, premium: UNDER_FLOOR[0] }))
      .toBe("สนใจมรดกเพื่อครอบครัว 1 ล้าน อายุ 30 หญิง เบี้ยประมาณ 4,123 บาท/ปี");
  });

  it("asks about the sum alone before an age has been entered", () => {
    expect(legacyMessage({ millions: 3, age: "", sex: "M", inRange: false, premium: undefined }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน");
  });

  it("asks for something else when the age is outside what the bundle takes", () => {
    expect(legacyMessage({ millions: 3, age: 68, sex: "F", inRange: false, premium: undefined }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน อายุ 68 หญิง ขอแบบที่เหมาะกับอายุนี้");
  });

  it("asks for the current price when no premium may be shown", () => {
    expect(legacyMessage({ millions: 3, age: 38, sex: "M", inRange: true, premium: undefined }))
      .toBe("สนใจมรดกเพื่อครอบครัว 3 ล้าน อายุ 38 ชาย ขอราคาปัจจุบัน");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/legacy-cta.test.ts`
Expected: FAIL — `legacyMessage is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `src/lib/legacy-cta.ts` (add `import type { PayMode, Sex } from "@/calc/types";` to the top of the file):

```ts
/** How each instalment reads after a figure, where the customer says it out loud. */
const PER: Record<PayMode, string> = { annual: "/ปี", semi: "/6 เดือน", monthly: "/เดือน" };

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

export interface LegacyFacts {
  /** the tier, as the round number of millions the family receives */
  millions: number;
  age: number | "";
  sex: Sex;
  /** whether the bundle will take this age at all */
  inRange: boolean;
  /** the instalment on the card, or undefined when no price is being shown */
  premium: ModePremium | undefined;
}

/**
 * What the customer's chat opens with. The same sentence goes to LINE, to Messenger and to
 * the assistant, so whoever answers starts from the figures already on screen instead of
 * asking for them again.
 *
 * Each shortfall says what it wants instead of falling silent: no age yet asks about the
 * sum, an age the bundle refuses asks for a plan that fits it, and a withheld price asks
 * for the current one.
 */
export function legacyMessage(facts: LegacyFacts): string {
  const head = `สนใจมรดกเพื่อครอบครัว ${facts.millions} ล้าน`;
  if (facts.age === "") return head;
  const who = `${head} อายุ ${facts.age} ${SEX_WORD[facts.sex]}`;
  if (!facts.inRange) return `${who} ขอแบบที่เหมาะกับอายุนี้`;
  if (!facts.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(facts.premium.total)} บาท${PER[facts.premium.mode]}`;
}
```

Add `import { formatBaht } from "@/calc/money";` to the top of the file.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/legacy-cta.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/legacy-cta.ts tests/calc/legacy-cta.test.ts
git commit -m "feat(legacy): open the customer's chat with the figures already on screen

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: `legacy-cta.ts` — the three contact URLs

**Files:**
- Modify: `src/lib/legacy-cta.ts`
- Test: `tests/calc/legacy-cta.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/legacy-cta.test.ts` (add `chatUrl`, `lineUrl`, `messengerUrl` to the existing import):

```ts
describe("contact links", () => {
  const text = "สนใจมรดกเพื่อครอบครัว 3 ล้าน";

  it("opens the LINE official account with the message ready to send", () => {
    expect(lineUrl("@luckyplanner", text))
      .toBe("https://line.me/R/oaMessage/%40luckyplanner/?" + encodeURIComponent(text));
  });

  it("opens Messenger with the message ready to send", () => {
    expect(messengerUrl("LuckyPlanner", text))
      .toBe("https://m.me/LuckyPlanner?text=" + encodeURIComponent(text));
  });

  it("opens the in-app assistant with the question in the box", () => {
    expect(chatUrl(text)).toBe("/chat?q=" + encodeURIComponent(text));
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/legacy-cta.test.ts`
Expected: FAIL — `lineUrl is not a function`.

- [ ] **Step 3: Write the minimal implementation**

Append to `src/lib/legacy-cta.ts`:

```ts
/**
 * Every channel is opened with the message waiting in the input box, never sent for the
 * customer: the first thing they do in the chat should still be their own doing.
 */
export function lineUrl(oaId: string, text: string): string {
  return `https://line.me/R/oaMessage/${encodeURIComponent(oaId)}/?${encodeURIComponent(text)}`;
}

export function messengerUrl(page: string, text: string): string {
  return `https://m.me/${encodeURIComponent(page)}?text=${encodeURIComponent(text)}`;
}

export function chatUrl(text: string): string {
  return `/chat?q=${encodeURIComponent(text)}`;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/legacy-cta.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/legacy-cta.ts tests/calc/legacy-cta.test.ts
git commit -m "feat(legacy): build the LINE, Messenger and assistant links

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: The calculator component

**Files:**
- Create: `src/components/LegacyCalculator.tsx`

No test: this is presentation over functions that are already covered, and the project has no component-test setup. It is checked in the browser in Task 8.

- [ ] **Step 1: Write the component**

Create `src/components/LegacyCalculator.tsx`:

```tsx
"use client";
import { useMemo, useState } from "react";
import type { Sex } from "@/calc/types";
import { PAY_MODE_LABEL } from "@/calc/types";
import { getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange, bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
import { formatBaht } from "@/calc/money";
import { chatUrl, displayPremium, legacyMessage, lineUrl, messengerUrl, perDay } from "@/lib/legacy-cta";

const BUNDLE = getBundle("LEGACY_FAMILY")!;
const RANGE = bundleAgeRange(BUNDLE);
const LINE_OA = process.env.NEXT_PUBLIC_LINE_OA_ID ?? "";
const FB_PAGE = process.env.NEXT_PUBLIC_FB_PAGE ?? "";

/** How each instalment reads on the card, where it labels a figure rather than follows it. */
const PER_LABEL: Record<string, string> = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" };

/**
 * The customer's calculator. It sells one arrangement, so there is nothing to choose but the
 * sum, the age and the sex — every other decision was made when the bundle was designed.
 */
export function LegacyCalculator() {
  const [millions, setMillions] = useState(1);
  const [age, setAge] = useState<number | "">("");
  const [sex, setSex] = useState<Sex>("M");

  const inRange = age !== "" && age >= RANGE.min && age <= RANGE.max;
  const who = inRange ? { age: age as number, sex } : undefined;

  const result = useMemo(
    () => (who ? quoteBundle(BUNDLE, millions, { ...who, mode: "annual" }) : undefined),
    [who?.age, who?.sex, millions], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const modes = useMemo(
    () => (who ? bundleModePremiums(BUNDLE, millions, who) : undefined),
    [who?.age, who?.sex, millions], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const expired = result?.meta.expired ?? false;
  const headline = displayPremium(modes, expired);
  const annual = modes?.find((m) => m.mode === "annual");
  const others = (modes ?? []).filter((m) => m !== headline && !m.belowMinimum);
  const death = result?.deathBenefit;

  const message = legacyMessage({ millions, age, sex, inRange, premium: headline });

  return (
    <div className="space-y-6">
      <div className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
        <div>
          <label htmlFor="legacy-sum" className="block text-sm font-medium text-slate-600">
            อยากให้ครอบครัวได้รับเท่าไหร่
          </label>
          <div className="mt-1 text-3xl font-semibold tabular-nums text-slate-900">
            {(millions * 1_000_000).toLocaleString("en-US")} <span className="text-lg font-normal text-slate-500">บาท</span>
          </div>
          <input
            id="legacy-sum" type="range" min={1} max={BUNDLE.tiers.length} step={1} value={millions}
            onChange={(e) => setMillions(Number(e.target.value))}
            className="mt-3 w-full accent-emerald-600"
          />
          <div className="flex justify-between text-xs text-slate-400">
            <span>1 ล้าน</span><span>{BUNDLE.tiers.length} ล้าน</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="legacy-age" className="block text-sm font-medium text-slate-600">อายุ</label>
            <input
              id="legacy-age" type="number" inputMode="numeric" value={age} placeholder="เช่น 38"
              onChange={(e) => setAge(e.target.value === "" ? "" : Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-lg tabular-nums"
            />
          </div>
          <div>
            <span className="block text-sm font-medium text-slate-600">เพศ</span>
            <div className="mt-1 grid grid-cols-2 gap-2">
              {(["M", "F"] as Sex[]).map((s) => (
                <button
                  key={s} type="button" onClick={() => setSex(s)}
                  aria-pressed={sex === s}
                  className={`rounded-lg border px-3 py-2 text-sm ${
                    sex === s ? "border-emerald-600 bg-emerald-50 font-medium text-emerald-900" : "border-slate-300 text-slate-600"
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
                <span className="ml-2 text-base font-normal text-emerald-800">บาท {PER_LABEL[headline.mode]}</span>
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
              <div className="text-2xl font-semibold tabular-nums text-emerald-900">
                {death.sumFrom.toLocaleString("en-US")} <span className="text-base font-normal">บาท</span>
              </div>
              {!death.alreadyPastAge && (
                <div className="mt-1 text-sm text-emerald-800">
                  ✦ เสียชีวิตก่อนอายุ {death.beforeAge} ปี ได้ {death.sumBefore.toLocaleString("en-US")} บาท
                </div>
              )}
            </div>
          )}

          <p className="border-t border-emerald-200 pt-3 text-xs leading-relaxed text-emerald-800">
            เบี้ยปีแรก ส่วนสัญญาโรคร้ายแรงคิดตามอายุ จึงปรับขึ้นในปีถัดไป · จ่ายเมื่อเสียชีวิต
            หรือเมื่อตรวจพบ 1 ใน 31 โรคร้ายแรงตามคำนิยามในกรมธรรม์
          </p>
        </div>
      )}

      <div className="grid gap-2">
        {LINE_OA && (
          <a href={lineUrl(LINE_OA, message)} target="_blank" rel="noopener noreferrer"
             className="rounded-xl bg-emerald-600 px-5 py-3 text-center font-medium text-white hover:bg-emerald-700">
            ทักไลน์ปรึกษาฟรี
          </a>
        )}
        {FB_PAGE && (
          <a href={messengerUrl(FB_PAGE, message)} target="_blank" rel="noopener noreferrer"
             className="rounded-xl bg-blue-600 px-5 py-3 text-center font-medium text-white hover:bg-blue-700">
            ทัก Messenger
          </a>
        )}
        <a href={chatUrl(message)}
           className="rounded-xl border border-slate-300 px-5 py-3 text-center font-medium text-slate-700 hover:bg-slate-50">
          ถาม AI ก่อนก็ได้
        </a>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Check it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/LegacyCalculator.tsx
git commit -m "feat(legacy): a calculator that asks the customer three questions

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: The `/legacy` route

**Files:**
- Create: `src/app/legacy/page.tsx`

- [ ] **Step 1: Write the page**

Create `src/app/legacy/page.tsx`:

```tsx
import { LegacyCalculator } from "@/components/LegacyCalculator";

export const metadata = {
  title: "มรดกเพื่อครอบครัว — คำนวณเบี้ย",
  description: "เตรียมเงินก้อน 1–10 ล้านบาทให้ครอบครัว จ่ายทั้งกรณีเสียชีวิตและโรคร้ายแรง",
};

export default function LegacyPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">มรดกเพื่อครอบครัว</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        เตรียมเงินก้อนให้คนข้างหลัง จ่ายทั้งวันที่คุณจากไป และวันที่คุณป่วยหนักแต่ยังอยู่
      </p>
      <LegacyCalculator />
    </main>
  );
}
```

- [ ] **Step 2: Check it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/legacy/page.tsx
git commit -m "feat(legacy): serve the calculator at /legacy

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: The assistant accepts a prepared question

**Files:**
- Modify: `src/app/chat/ChatClient.tsx`

The "ถาม AI" button links to `/chat?q=…`. The chat page must put that text in the draft box — and leave it there, unsent, so the customer still presses send themselves.

`window.location.search` is read in an effect rather than through `useSearchParams`, which would force the page into a Suspense boundary for a value only the browser has.

- [ ] **Step 1: Add the effect**

In `src/app/chat/ChatClient.tsx`, immediately after the existing scroll effect

```tsx
  useEffect(() => bottom.current?.scrollIntoView({ behavior: "smooth" }), [turns, busy]);
```

add:

```tsx
  /**
   * A question handed over by another page (the legacy calculator's "ถาม AI" button) lands
   * in the box rather than in the conversation: the customer sees what is about to be asked
   * on their behalf, and sends it themselves.
   */
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q");
    if (q) setDraft(q);
  }, []);
```

- [ ] **Step 2: Check it compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/chat/ChatClient.tsx
git commit -m "feat(chat): accept a question prepared by another page

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Configuration, full verification, browser check

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Document the two new settings**

Append to `.env.example`:

```
# The public contact buttons on /legacy. Each button is hidden until its value is set.
# LINE: the official account's ID, including the @ (LINE Official Account Manager →
# Settings → Account info → LINE ID).
NEXT_PUBLIC_LINE_OA_ID=

# Messenger: the Page's username or numeric ID, the part after m.me/.
NEXT_PUBLIC_FB_PAGE=
```

- [ ] **Step 2: Run the whole verification**

Run: `npm run verify`
Expected: PASS — typecheck, lint, every vitest file, and the production build.

- [ ] **Step 3: Look at the page**

Start the dev server through the browser preview tooling (never `npm run dev` in a shell) and open `/legacy` at a mobile width. Check each case:

| input | expected |
|---|---|
| no age yet | "กรอกอายุเพื่อดูเบี้ยของคุณ", only the "ถาม AI" button below it |
| ชาย 38 · slider at 3 | **1,501 บาท ต่อเดือน**, "ตกวันละ 46 บาท", รายปี 16,687 · ราย 6 เดือน 8,677, ครอบครัวได้รับ 3,000,000, ก่อนอายุ 60 ได้ 3,150,000 |
| หญิง 30 · slider at 1 | **4,123 บาท ต่อปี**, "ตกวันละ 12 บาท", ราย 6 เดือน 2,143 only — no monthly figure anywhere |
| อายุ 68 | the amber "ชุดนี้รับอายุ 20–65 ปี" card, contact button still present |

Then follow the "ถาม AI" link and confirm the draft box is pre-filled and nothing has been sent.

- [ ] **Step 4: Commit**

```bash
git add .env.example
git commit -m "docs(legacy): document the public contact settings

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Out of scope, deliberately

- The sales copy around the calculator (hero, the three truths, the 31 illnesses, FAQ) — its own spec and plan.
- Anything under `src/calc` and the agent's `/` page: untouched by every task above.
