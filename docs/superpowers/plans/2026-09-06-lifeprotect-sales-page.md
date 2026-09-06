# Life Protect+ 100 Sales Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second customer-facing sales page at `/lifeprotect` that sells the Life Protect+ 100 base plan on its own, with a calculator that prices any sum from 500,000 to 10,000,000 in all three payment terms instantly in the browser.

**Architecture:** The server builds a small table (rates per thousand for three variants × two sexes × 81 ages, plus cash-value factors at four milestone ages) and hands it to a client calculator that reproduces the engine's base-premium arithmetic with the same `money.ts` helpers. Sales copy takes every figure from the engine through a facts module, as `/legacy` does. The contact buttons and the page theme move out of `/legacy` into `src/components/sales/` so both pages share them.

**Tech Stack:** Next.js app router (server + client components), Tailwind v4 classes already used by `/legacy`, vitest.

Spec: `docs/superpowers/specs/2026-09-06-lifeprotect-sales-page-design.md`

**Repo conventions to keep:**
- Stage by path (`git add <files>`), never `git add -A` — other sessions share this checkout.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Run tests with `npx vitest run <file>`; full gate is `npm run verify` (tsc, lint, vitest, build).
- All premiums are integers in satang; `formatBaht()` turns them into whole baht for display.

---

## File map

| File | Responsibility |
|---|---|
| `src/components/sales/SalesTheme.tsx` (new) | Fonts + `theme-legacy` wrapper, shared by both sales pages |
| `src/components/sales/ContactButtons.tsx` (new) | The LINE / Messenger / AI buttons, moved out of `LegacyCalculator.tsx` |
| `src/components/sales/Blocks.tsx` (new) | `H2`, `Rule`, `Fold` primitives, moved out of `legacy/Sections.tsx` |
| `src/app/legacy/layout.tsx`, `src/components/LegacyCalculator.tsx`, `src/components/legacy/Sections.tsx` (edit) | Import the shared pieces; no visible change |
| `src/lib/legacy-cta.ts` (edit) | Export `PER` so the new page words instalments identically |
| `src/lib/lifeprotect-table.ts` (new) | Server: the slim rate + cash-factor table |
| `src/lib/lifeprotect-quote.ts` (new) | Pure: premiums, total paid, death benefit, cash values from the table |
| `src/lib/lifeprotect-cta.ts` (new) | Pure: the chat message |
| `src/lib/lifeprotect-facts.ts` (new) | Server: the figures the copy quotes |
| `src/components/LifeProtectCalculator.tsx` (new) | Client calculator |
| `src/components/lifeprotect/Hero.tsx`, `Sections.tsx` (new) | Copy blocks |
| `src/app/lifeprotect/layout.tsx`, `page.tsx` (new) | The route |
| `tests/calc/lifeprotect-quote.test.ts`, `lifeprotect-page-data.test.ts`, `lifeprotect-cta.test.ts` (new) | Tests |

---

### Task 1: Move the shared sales pieces out of `/legacy`

**Files:**
- Create: `src/components/sales/SalesTheme.tsx`
- Create: `src/components/sales/ContactButtons.tsx`
- Create: `src/components/sales/Blocks.tsx`
- Modify: `src/app/legacy/layout.tsx`
- Modify: `src/components/LegacyCalculator.tsx` (lines 230–266 move out; imports change)
- Modify: `src/components/legacy/Sections.tsx` (lines 4–38 move out)
- Modify: `src/lib/legacy-cta.ts` (line 33: export `PER`)

This task is a pure move. Nothing on `/legacy` may look different afterwards.

- [ ] **Step 1: Create `src/components/sales/SalesTheme.tsx`**

```tsx
import { IBM_Plex_Sans_Thai, Trirong } from "next/font/google";

/**
 * Trirong is a Thai serif: it has the weight of something printed and kept, which is what a
 * page about what you leave behind should sound like. Kanit and Prompt are what every Thai
 * landing page reaches for, and they would make this one look like every other one.
 */
const display = Trirong({
  subsets: ["thai", "latin"],
  weight: ["500", "600"],
  variable: "--lg-font-display",
  display: "swap",
});

/** The reading face: a Thai grotesque with open counters, legible small on a phone. */
const body = IBM_Plex_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--lg-font-body",
  display: "swap",
});

/**
 * The skin every customer-facing sales page wears (styles in globals.css under
 * `.theme-legacy`). Wrapping each sales route rather than the app leaves the agent's
 * calculator and the back office in the plain light theme they are worked in all day.
 */
export function SalesTheme({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${display.variable} ${body.variable} theme-legacy min-h-screen`}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Replace `src/app/legacy/layout.tsx` with**

```tsx
import { SalesTheme } from "@/components/sales/SalesTheme";

export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return <SalesTheme>{children}</SalesTheme>;
}
```

- [ ] **Step 3: Create `src/components/sales/ContactButtons.tsx`** (moved verbatim from the bottom of `LegacyCalculator.tsx`, now exported)

```tsx
import { chatUrl, lineUrl, messengerUrl } from "@/lib/legacy-cta";
import type { LegacyChannels } from "@/lib/legacy-channels";

/**
 * The way out of the page, in every channel that has been configured. A channel with no
 * setting is left out rather than shown broken, so a page with only the assistant wired up
 * still reads as finished.
 *
 * The message is prepared, never sent: pressing send stays the customer's own act.
 */
export function ContactButtons(
  { channels, message, compact = false }: { channels: LegacyChannels; message: string; compact?: boolean },
) {
  const shape = compact
    ? "rounded-sm px-3 py-2.5 text-center text-sm font-medium"
    : "rounded-sm px-5 py-3.5 text-center font-medium tracking-wide";
  return (
    <div className={compact ? "flex gap-2 [&>*]:flex-1" : "grid gap-2"}>
      {channels.lineOaId && (
        <a
          href={lineUrl(channels.lineOaId, message)} target="_blank" rel="noopener noreferrer"
          className={`${shape} lg-metal-face${compact ? "" : " lg-sheen"}`}
        >
          {compact ? "ทักไลน์" : "ทักไลน์ปรึกษาฟรี"}
        </a>
      )}
      {channels.messengerPage && (
        <a
          href={messengerUrl(channels.messengerPage, message)} target="_blank" rel="noopener noreferrer"
          className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`}
        >
          {compact ? "Messenger" : "ทัก Messenger"}
        </a>
      )}
      <a href={chatUrl(message)} className={`${shape} border border-[var(--lg-panel-line)] text-[var(--lg-mute)]`}>
        {compact ? "ถาม AI" : "ถาม AI ก่อนก็ได้"}
      </a>
    </div>
  );
}
```

- [ ] **Step 4: Edit `src/components/LegacyCalculator.tsx`**

Delete everything from the comment block `/** * The way out of the page…` (line 230) to the end of the file. Replace the import line

```ts
import { chatUrl, displayPremium, legacyMessage, lineUrl, messengerUrl, perDay } from "@/lib/legacy-cta";
```
with
```ts
import { displayPremium, legacyMessage, perDay } from "@/lib/legacy-cta";
import { ContactButtons } from "@/components/sales/ContactButtons";
```

- [ ] **Step 5: Create `src/components/sales/Blocks.tsx`** (moved verbatim from the top of `legacy/Sections.tsx`, now exported)

```tsx
/** A heading that reads at arm's length on a phone, without shouting on a desktop. */
export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[1.4rem] font-medium leading-snug text-[var(--lg-white)] sm:text-2xl">
      {children}
    </h2>
  );
}

/** The engraved hairline that separates one part of the page from the next. */
export function Rule() {
  return <hr className="lg-rule" />;
}

/**
 * A folding block. `<details>` is the browser's own — it opens with no JavaScript at all,
 * which on a phone over mobile data is the difference between a list that works and a list
 * that waits for a bundle to arrive.
 */
export function Fold({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group border-b border-[var(--lg-panel-line)] last:border-b-0">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 text-sm font-medium text-[var(--lg-white)] marker:hidden">
        {summary}
        <span
          aria-hidden
          className="shrink-0 text-lg leading-none text-[var(--lg-gold)] transition-transform duration-300 group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-5 text-sm leading-[1.85] text-[var(--lg-mute)]">{children}</div>
    </details>
  );
}
```

- [ ] **Step 6: Edit `src/components/legacy/Sections.tsx`**

Delete lines 4–38 (the `H2`, `Rule`, `Fold` definitions and their comments) and add after the existing imports:

```ts
import { Fold, H2, Rule } from "@/components/sales/Blocks";
```

- [ ] **Step 7: Edit `src/lib/legacy-cta.ts` line 33** — export the instalment words:

```ts
/** How each instalment reads after a figure, where the customer says it out loud. */
export const PER: Record<PayMode, string> = { annual: "/ปี", semi: "/6 เดือน", monthly: "/เดือน" };
```

- [ ] **Step 8: Type-check, lint, run the existing tests**

Run: `npx tsc --noEmit && npx next lint && npx vitest run tests/calc/legacy-cta.test.ts tests/calc/legacy-page-data.test.ts`
Expected: no type errors, no lint errors, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/components/sales/SalesTheme.tsx src/components/sales/ContactButtons.tsx src/components/sales/Blocks.tsx src/app/legacy/layout.tsx src/components/LegacyCalculator.tsx src/components/legacy/Sections.tsx src/lib/legacy-cta.ts
git commit -m "refactor(sales): lift the theme, contact buttons and blocks out of /legacy for a second page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: The slim table the browser prices from

**Files:**
- Create: `src/lib/lifeprotect-table.ts`
- Test: `tests/calc/lifeprotect-page-data.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/calc/lifeprotect-page-data.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { getPlan } from "@/calc/plans/registry";

/** The rate table behind the page lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");

describe("lifeProtectTable", () => {
  it("carries the three payment terms in the order the page shows them", () => {
    const t = lifeProtectTable(WHILE_CURRENT);
    expect(t).toMatchObject({
      ageMin: 0, ageMax: 80, expired: false, rateVersion: "A2026-1", minMonthly: 1000,
      boosterBeforeAge: 60, booster: 1, coverToAge: 99,
      modeFactors: { annual: 1, semi: 0.52, monthly: 0.09 },
    });
    expect(t.terms.map((x) => [x.variant, x.label, x.payTerm, x.payToAge])).toEqual([
      ["WLF09H", "จ่าย 9 ปี", 9, undefined],
      ["WLF19H", "จ่าย 19 ปี", 19, undefined],
      ["WLF99H", "จ่ายถึงอายุ 99", undefined, 99],
    ]);
  });

  it("has a rate for every age and sex in every term", () => {
    const t = lifeProtectTable(WHILE_CURRENT);
    const rates = getPlan("LIFEPROTECT")!.rates;
    for (const term of t.terms) {
      for (const sex of ["M", "F"] as const) {
        expect(term.rates[sex]).toHaveLength(81);
        expect(term.rates[sex].every((r) => typeof r === "number")).toBe(true);
        // ชาย 35 · จ่าย 19 ปี is 28.70 per thousand in the workbook
        expect(term.rates[sex][35]).toBe(rates.base.rates[term.variant][sex]["35"]);
      }
    }
  });

  it("carries cash-value factors only at the milestones still ahead of the insured", () => {
    const t = lifeProtectTable(WHILE_CURRENT);
    const term19 = t.terms[1];
    // ชาย 35: the company table gives 504 / 633 / 777 per thousand at 60 / 70 / 80, 1000 at 99
    expect(term19.cash.M[35]).toEqual({ 60: 504, 70: 633, 80: 777, 99: 1000 });
    // ชาย 70 has passed 60 and 70
    expect(Object.keys(term19.cash.M[70]!)).toEqual(["80", "99"]);
    // ชาย 80 has only the end left
    expect(Object.keys(term19.cash.M[80]!)).toEqual(["99"]);
  });
});

/** Same defence as legacyTable: a warm cache must not keep telling customers the table is current. */
describe("once the rate table has lapsed", () => {
  const AFTER = new Date("2027-04-01");

  it("the table says so, even to a process that started while it was current", () => {
    lifeProtectTable(WHILE_CURRENT);
    expect(lifeProtectTable(AFTER).expired).toBe(true);
    expect(lifeProtectTable(WHILE_CURRENT).expired).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/calc/lifeprotect-page-data.test.ts`
Expected: FAIL — cannot resolve `@/lib/lifeprotect-table`.

- [ ] **Step 3: Create `src/lib/lifeprotect-table.ts`**

```ts
import { getPlan } from "@/calc/plans/registry";
import { baseRate } from "@/calc/lookup";
import { baseAgeRange } from "@/calc/rules";
import { cashValueSchedule, maturityValue } from "@/calc/cash-value";
import type { PayMode, Sex } from "@/calc/types";

/**
 * Everything the Life Protect+ 100 page needs to price itself in the browser.
 *
 * /legacy sells one arrangement over a closed domain, so the server prices all of it. This
 * page lets the customer pick any of twenty sums in three terms, and a table of every answer
 * would run to 200 kB. The base plan has no riders, so its premium is one rate per thousand
 * times the sum, rounded the way money.ts rounds — the browser can do that itself from about
 * five hundred rates, and the plan registry (with every other plan's tables) stays on the
 * server.
 */
export interface LifeProtectTerm {
  variant: string;
  /** what the term is called on the button and in the chat message, e.g. "จ่าย 19 ปี" */
  label: string;
  /** premium-paying years, when fixed */
  payTerm?: number;
  /** the age premiums are paid to, when the term runs to an age instead */
  payToAge?: number;
  /** rate per thousand, [sex][age - ageMin]; null where the workbook has no rate */
  rates: Record<Sex, (number | null)[]>;
  /**
   * cash-value factors per thousand of sum assured, [sex][age - ageMin] → milestone age →
   * factor. Only milestones still ahead of the insured are carried. Null where the company
   * table has no schedule for that issue age.
   */
  cash: Record<Sex, (Record<number, number> | null)[]>;
}

export interface LifeProtectTable {
  planCode: string;
  ageMin: number;
  ageMax: number;
  /** true when the rate table has lapsed; then no price may be shown */
  expired: boolean;
  rateVersion: string;
  /** the smallest monthly instalment the company accepts, in baht */
  minMonthly: number;
  /** death before this age pays the extra multiple */
  boosterBeforeAge: number;
  /** the extra multiple of the sum assured (1 = pays double) */
  booster: number;
  /** the age cover runs to */
  coverToAge: number;
  modeFactors: Record<PayMode, number>;
  terms: LifeProtectTerm[];
}

const PLAN_CODE = "LIFEPROTECT";

/** The three payment terms of ไลฟ์ โพรเทค+ 100, in the order the page offers them. */
const TERMS: { variant: string; label: string }[] = [
  { variant: "WLF09H", label: "จ่าย 9 ปี" },
  { variant: "WLF19H", label: "จ่าย 19 ปี" },
  { variant: "WLF99H", label: "จ่ายถึงอายุ 99" },
];

/** The ages the page quotes a cash value at, besides the end of the contract. */
export const CASH_AGES = [60, 70, 80];

/** Built once per process; `expired` is asked again on every call, as in legacy-table.ts. */
let cached: Omit<LifeProtectTable, "expired"> | undefined;

export function lifeProtectTable(today: Date = new Date()): LifeProtectTable {
  const plan = getPlan(PLAN_CODE)!;
  const expired = today.toISOString().slice(0, 10) > plan.rates.expiresOn;
  if (cached) return { ...cached, expired };

  const { rates, rules } = plan;
  const packages = TERMS.map((t) => rates.base.packages!.find((p) => p.code === t.variant)!);
  // every term issues at the same ages; the widest would be wrong for the narrowest
  const ageMin = Math.max(...packages.map((p) => baseAgeRange(rules, p.code, rates).min));
  const ageMax = Math.min(...packages.map((p) => baseAgeRange(rules, p.code, rates).max));
  const ages = Array.from({ length: ageMax - ageMin + 1 }, (_, i) => ageMin + i);
  // the company's cash-value table stops the year before cover ends
  const coverToAge = maturityValue(cashValueSchedule(PLAN_CODE, TERMS[2].variant, "M", ageMin, 1000))!.age;

  const cashFor = (variant: string, sex: Sex, age: number): Record<number, number> | null => {
    // priced on a sum of 1,000 so each row's amount is the factor itself
    const rows = cashValueSchedule(PLAN_CODE, variant, sex, age, 1000);
    if (!rows.length) return null;
    const out: Record<number, number> = {};
    for (const at of CASH_AGES) {
      const row = rows.find((r) => r.age === at);
      if (row && at > age) out[at] = row.amount;
    }
    const end = maturityValue(rows);
    if (end && end.age > age) out[end.age] = end.amount;
    return out;
  };

  const terms: LifeProtectTerm[] = TERMS.map((t, i) => {
    const pkg = packages[i];
    return {
      variant: t.variant,
      label: t.label,
      ...(pkg.payTermToAge !== undefined ? { payToAge: pkg.payTermToAge } : { payTerm: pkg.payTerm }),
      rates: {
        M: ages.map((age) => baseRate(rates, t.variant, "M", age) ?? null),
        F: ages.map((age) => baseRate(rates, t.variant, "F", age) ?? null),
      },
      cash: {
        M: ages.map((age) => cashFor(t.variant, "M", age)),
        F: ages.map((age) => cashFor(t.variant, "F", age)),
      },
    };
  });

  cached = {
    planCode: PLAN_CODE,
    ageMin,
    ageMax,
    rateVersion: rates.version,
    minMonthly: rules.minMonthlyTotal,
    boosterBeforeAge: rules.base.extraDeathBenefitBeforeAge!,
    booster: packages[0].booster ?? 0,
    coverToAge,
    modeFactors: rates.modeFactors,
    terms,
  };
  return { ...cached, expired };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/lifeprotect-page-data.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lifeprotect-table.ts tests/calc/lifeprotect-page-data.test.ts
git commit -m "feat(lifeprotect): pack the rates and cash factors the page prices from

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Pricing in the browser, proven against the engine

**Files:**
- Create: `src/lib/lifeprotect-quote.ts`
- Test: `tests/calc/lifeprotect-quote.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/calc/lifeprotect-quote.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { quote } from "@/calc/quote";
import { cashValueSchedule, maturityValue } from "@/calc/cash-value";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { cashAt, deathBenefitOf, lifeProtectModes, payYears, termAt, totalPaid } from "@/lib/lifeprotect-quote";
import type { Sex } from "@/calc/types";

const WHILE_CURRENT = new Date("2026-09-05");
const table = lifeProtectTable(WHILE_CURRENT);

/** A small seeded generator, so a failing case can be re-run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SUMS = Array.from({ length: 20 }, (_, i) => 500_000 * (i + 1));

describe("lifeProtectModes", () => {
  it("prices ชาย 35 · 1 ล้าน · จ่าย 19 ปี as the workbook does", () => {
    const modes = lifeProtectModes(table, termAt(table, "WLF19H"), { sex: "M", age: 35, sumAssured: 1_000_000 })!;
    // 28.70 per thousand: 28,700 a year, 14,924 a half-year, 2,583 a month
    expect(modes).toEqual([
      { mode: "annual", total: 2_870_000, belowMinimum: false },
      { mode: "semi", total: 1_492_400, belowMinimum: false },
      { mode: "monthly", total: 258_300, belowMinimum: false },
    ]);
  });

  /**
   * The browser's arithmetic is the page's only source of prices, so it has to be the
   * engine's arithmetic. Two hundred random arrangements across every term, sex, age and
   * sum are priced both ways and must agree to the satang.
   */
  it("agrees with the engine in every mode across random arrangements", () => {
    const next = rng(20260906);
    const pick = <T,>(xs: readonly T[]) => xs[Math.floor(next() * xs.length)];
    for (let i = 0; i < 200; i++) {
      const term = pick(table.terms);
      const sex = pick(["M", "F"] as const);
      const age = table.ageMin + Math.floor(next() * (table.ageMax - table.ageMin + 1));
      const sumAssured = pick(SUMS);
      const modes = lifeProtectModes(table, term, { sex, age, sumAssured })!;
      for (const m of modes) {
        const q = quote({
          planCode: "LIFEPROTECT", variant: term.variant, age, sex, mode: m.mode, sumAssured, riders: [],
        }, WHILE_CURRENT);
        const label = `${term.variant} ${sex} ${age} ${sumAssured} ${m.mode}`;
        expect(q.totalModal, label).toBe(m.total);
        expect(q.warnings.some((w) => w.code === "MIN_MONTHLY"), label).toBe(m.belowMinimum);
      }
    }
  });

  it("flags the monthly instalment the company will not take", () => {
    // แรกเกิด · 1 ล้าน · ถึง 99: 540 a month, under the 1,000 baht floor
    const modes = lifeProtectModes(table, termAt(table, "WLF99H"), { sex: "M", age: 0, sumAssured: 1_000_000 })!;
    expect(modes.find((m) => m.mode === "monthly")).toEqual({ mode: "monthly", total: 54_000, belowMinimum: true });
  });
});

describe("payYears and totalPaid", () => {
  it("counts a fixed term as itself and a to-age term from the insured's age", () => {
    expect(payYears(termAt(table, "WLF09H"), 35)).toBe(9);
    expect(payYears(termAt(table, "WLF99H"), 35)).toBe(64);
    expect(payYears(termAt(table, "WLF99H"), 80)).toBe(19);
  });

  it("adds the level premium up over the term", () => {
    // 28,700 × 19 = 545,300 baht
    expect(totalPaid(2_870_000, 19)).toBe(54_530_000);
  });
});

describe("deathBenefitOf", () => {
  it("matches the engine on both sides of the booster age", () => {
    for (const [age, sum] of [[35, 1_000_000], [59, 500_000], [60, 2_500_000], [80, 10_000_000]] as const) {
      const q = quote({
        planCode: "LIFEPROTECT", variant: "WLF19H", age, sex: "F", mode: "annual", sumAssured: sum, riders: [],
      }, WHILE_CURRENT);
      expect(deathBenefitOf(table, age, sum)).toEqual(q.deathBenefit);
    }
  });

  it("pays double before 60 and the sum from then on", () => {
    expect(deathBenefitOf(table, 35, 1_000_000)).toMatchObject({
      beforeAge: 60, sumBefore: 2_000_000, sumFrom: 1_000_000, alreadyPastAge: false,
    });
  });
});

describe("cashAt", () => {
  it("matches the company's schedule at the milestone ages and at the end", () => {
    for (const [variant, sex, age, sum] of [
      ["WLF19H", "M", 35, 1_000_000], ["WLF09H", "F", 0, 500_000], ["WLF99H", "M", 72, 3_000_000],
    ] as [string, Sex, number, number][]) {
      const rows = cashValueSchedule("LIFEPROTECT", variant, sex, age, sum);
      const expected = [60, 70, 80]
        .filter((at) => at > age)
        .map((at) => ({ age: at, amount: rows.find((r) => r.age === at)!.amount }))
        .concat([{ age: maturityValue(rows)!.age, amount: maturityValue(rows)!.amount }])
        .filter((r) => r.amount > 0);
      expect(cashAt(termAt(table, variant), sex, age, sum, table.ageMin)).toEqual(expected);
    }
  });

  it("reads ชาย 35 · 1 ล้าน · จ่าย 19 ปี as 504,000 at 60 and 1,000,000 at 99", () => {
    expect(cashAt(termAt(table, "WLF19H"), "M", 35, 1_000_000, table.ageMin)).toEqual([
      { age: 60, amount: 504_000 }, { age: 70, amount: 633_000 }, { age: 80, amount: 777_000 }, { age: 99, amount: 1_000_000 },
    ]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/calc/lifeprotect-quote.test.ts`
Expected: FAIL — cannot resolve `@/lib/lifeprotect-quote`.

- [ ] **Step 3: Create `src/lib/lifeprotect-quote.ts`**

This file is imported by the client component, so it must not import `quote.ts`, `mode-premiums.ts` or the plan registry — only `money.ts` and types.

```ts
import type { ModePremium } from "@/calc/mode-premiums";
import { applyModeFactor, toHundredths } from "@/calc/money";
import type { DeathBenefit, PayMode, Sex } from "@/calc/types";
import type { LifeProtectTable, LifeProtectTerm } from "@/lib/lifeprotect-table";

/** Same order as calc/mode-premiums; repeated here so the browser does not import the engine. */
const MODES: PayMode[] = ["annual", "semi", "monthly"];

export interface Insured {
  sex: Sex;
  age: number;
  sumAssured: number;
}

export function termAt(table: LifeProtectTable, variant: string): LifeProtectTerm {
  const term = table.terms.find((t) => t.variant === variant);
  if (!term) throw new Error(`Unknown term: ${variant}`);
  return term;
}

/**
 * The base plan's premium in every payment mode, worked out the way base-premium.ts does:
 * rate per thousand, no discount (this plan's discount table is all zeros), each instalment
 * rounded down on its own in satang. The test suite prices random arrangements both ways.
 *
 * Undefined when the workbook has no rate for the age, which the picker already prevents.
 */
export function lifeProtectModes(
  table: LifeProtectTable, term: LifeProtectTerm, who: Insured,
): ModePremium[] | undefined {
  const rate = term.rates[who.sex][who.age - table.ageMin];
  if (rate === null || rate === undefined) return undefined;
  const rate100 = toHundredths(rate);
  return MODES.map((mode) => {
    const total = applyModeFactor(rate100, who.sumAssured, toHundredths(table.modeFactors[mode]));
    return { mode, total, belowMinimum: mode === "monthly" && total < table.minMonthly * 100 };
  });
}

/** How many years the premium is paid: the term itself, or the years left to the paying age. */
export function payYears(term: LifeProtectTerm, age: number): number {
  if (term.payToAge !== undefined) return Math.max(0, term.payToAge - age);
  return term.payTerm ?? 0;
}

/** Every yearly premium added up, in satang. Honest only because this plan's premium is level. */
export function totalPaid(annualSatang: number, years: number): number {
  return annualSatang * years;
}

/** What quote.ts returns for this plan with no riders: double before the booster age, the sum after. */
export function deathBenefitOf(table: LifeProtectTable, age: number, sumAssured: number): DeathBenefit {
  const alreadyPastAge = age >= table.boosterBeforeAge;
  return {
    beforeAge: table.boosterBeforeAge,
    sumBefore: alreadyPastAge ? sumAssured : sumAssured + Math.round(sumAssured * table.booster),
    sumFrom: sumAssured,
    alreadyPastAge,
  };
}

export interface CashRow {
  age: number;
  /** baht */
  amount: number;
}

/**
 * The cash value at each milestone still ahead of the insured, worth something. The same
 * ROUND(factor × sum / 1000) as cash-value.ts, so the figure equals the company's table.
 */
export function cashAt(term: LifeProtectTerm, sex: Sex, age: number, sumAssured: number, ageMin: number): CashRow[] {
  const factors = term.cash[sex][age - ageMin];
  if (!factors) return [];
  return Object.entries(factors)
    .map(([at, factor]) => ({ age: Number(at), amount: Math.round((factor * sumAssured) / 1000) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => a.age - b.age);
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/lifeprotect-quote.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lifeprotect-quote.ts tests/calc/lifeprotect-quote.test.ts
git commit -m "feat(lifeprotect): price the base plan in the browser with the engine's arithmetic

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: The chat message

**Files:**
- Create: `src/lib/lifeprotect-cta.ts`
- Test: `tests/calc/lifeprotect-cta.test.ts`

- [ ] **Step 1: Write the failing test** — `tests/calc/lifeprotect-cta.test.ts`

```ts
import { describe, expect, it } from "vitest";
import type { ModePremium } from "@/calc/mode-premiums";
import { lifeProtectMessage } from "@/lib/lifeprotect-cta";

const MONTHLY: ModePremium = { mode: "monthly", total: 258_300, belowMinimum: false };
const ANNUAL: ModePremium = { mode: "annual", total: 600_000, belowMinimum: false };
const base = { sumAssured: 1_000_000, termLabel: "จ่าย 19 ปี", sex: "M" as const, ageMax: 80 };

describe("lifeProtectMessage", () => {
  it("carries the sum, the term, the insured and the headline premium", () => {
    expect(lifeProtectMessage({ ...base, age: 35, premium: MONTHLY }))
      .toBe("สนใจ Life Protect+ 100 ทุน 1,000,000 จ่าย 19 ปี อายุ 35 ชาย เบี้ยประมาณ 2,583 บาท/เดือน");
  });

  it("names the yearly premium when that is what is on the card", () => {
    expect(lifeProtectMessage({ ...base, termLabel: "จ่ายถึงอายุ 99", age: 0, premium: ANNUAL }))
      .toBe("สนใจ Life Protect+ 100 ทุน 1,000,000 จ่ายถึงอายุ 99 อายุแรกเกิด ชาย เบี้ยประมาณ 6,000 บาท/ปี");
  });

  it("asks about the sum and term before an age has been picked", () => {
    expect(lifeProtectMessage({ ...base, age: "", premium: undefined }))
      .toBe("สนใจ Life Protect+ 100 ทุน 1,000,000 จ่าย 19 ปี");
  });

  it("asks for something else for an age past the plan's last", () => {
    expect(lifeProtectMessage({ ...base, sex: "F", age: "over", premium: undefined }))
      .toBe("สนใจ Life Protect+ 100 ทุน 1,000,000 อายุเกิน 80 ปี ขอแบบที่เหมาะกับอายุนี้");
  });

  it("asks for the current price when no premium may be shown", () => {
    expect(lifeProtectMessage({ ...base, sex: "F", age: 42, premium: undefined }))
      .toBe("สนใจ Life Protect+ 100 ทุน 1,000,000 จ่าย 19 ปี อายุ 42 หญิง ขอราคาปัจจุบัน");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/calc/lifeprotect-cta.test.ts`
Expected: FAIL — cannot resolve `@/lib/lifeprotect-cta`.

- [ ] **Step 3: Create `src/lib/lifeprotect-cta.ts`**

```ts
import type { ModePremium } from "@/calc/mode-premiums";
import type { Sex } from "@/calc/types";
import { formatBaht } from "@/calc/money";
import { PER } from "@/lib/legacy-cta";

/** The age picker's value: an age the plan takes, "over" for everyone past it, "" before one is picked. */
export type LifeProtectAge = number | "over" | "";

export interface LifeProtectCtaFacts {
  sumAssured: number;
  /** the term as the button words it, e.g. "จ่าย 19 ปี" */
  termLabel: string;
  age: LifeProtectAge;
  sex: Sex;
  /** the last age the plan issues at, named in the message an older customer sends */
  ageMax: number;
  /** the instalment on the card, or undefined when no price is being shown */
  premium: ModePremium | undefined;
}

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

/** Age zero is a newborn, not "0 ปี", everywhere a person reads it. */
export function ageWord(age: number): string {
  return age === 0 ? "แรกเกิด" : String(age);
}

/**
 * What the customer's chat opens with — the same sentence for LINE, Messenger and the
 * assistant, so whoever answers starts from the figures already on screen.
 */
export function lifeProtectMessage(f: LifeProtectCtaFacts): string {
  const head = `สนใจ Life Protect+ 100 ทุน ${f.sumAssured.toLocaleString("en-US")}`;
  if (f.age === "over") return `${head} อายุเกิน ${f.ageMax} ปี ขอแบบที่เหมาะกับอายุนี้`;
  const withTerm = `${head} ${f.termLabel}`;
  if (f.age === "") return withTerm;
  const who = `${withTerm} อายุ${f.age === 0 ? "" : " "}${ageWord(f.age)} ${SEX_WORD[f.sex]}`;
  if (!f.premium) return `${who} ขอราคาปัจจุบัน`;
  return `${who} เบี้ยประมาณ ${formatBaht(f.premium.total)} บาท${PER[f.premium.mode]}`;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/lifeprotect-cta.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lifeprotect-cta.ts tests/calc/lifeprotect-cta.test.ts
git commit -m "feat(lifeprotect): word the chat message the buttons open with

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: The figures the sales copy quotes

**Files:**
- Create: `src/lib/lifeprotect-facts.ts`
- Modify: `tests/calc/lifeprotect-page-data.test.ts` (append)

- [ ] **Step 1: Append the failing tests** to `tests/calc/lifeprotect-page-data.test.ts`

Add to the imports at the top:
```ts
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
```
Append at the end of the file:
```ts
describe("lifeProtectFacts", () => {
  it("takes the sales copy's figures from the engine", () => {
    const f = lifeProtectFacts(WHILE_CURRENT);
    expect(f).toMatchObject({
      expired: false, rateVersion: "A2026-1", ageMin: 0, ageMax: 80, boosterBeforeAge: 60, coverToAge: 99,
      // หญิง 35 · ทุน 500,000 · ถึง 99: 7,100 บาท/ปี ÷ 365 = 19.5 → 20
      fromAge: 35, fromSum: "500,000", fromPerDay: 20,
      // ลูกชายแรกเกิด · 1 ล้าน · จ่าย 19 ปี: 14.00 per thousand → 1,260 a month
      newborn: { sum: "1,000,000", termLabel: "จ่าย 19 ปี", years: 19, premium: "1,260", per: "/เดือน" },
      double: { sum: "1,000,000", before: "2,000,000" },
      cash60: "504,000",
    });
  });

  it("compares the three terms for ชาย 35 · 1 ล้าน", () => {
    const f = lifeProtectFacts(WHILE_CURRENT);
    expect(f.example).toMatchObject({ age: 35, sum: "1,000,000" });
    expect(f.example.terms).toEqual([
      { label: "จ่าย 9 ปี", years: 9, premium: "4,914", per: "/เดือน", total: "491,400" },
      { label: "จ่าย 19 ปี", years: 19, premium: "2,583", per: "/เดือน", total: "545,300" },
      { label: "จ่ายถึงอายุ 99", years: 64, premium: "1,548", per: "/เดือน", total: "1,100,800" },
    ]);
  });

  it("stops quoting a premium once the rate table has lapsed, but still states the benefits", () => {
    const f = lifeProtectFacts(new Date("2027-04-01"));
    expect(f.expired).toBe(true);
    expect(f.fromPerDay).toBeNull();
    expect(f.newborn.premium).toBeNull();
    expect(f.example.terms.every((t) => t.premium === null && t.total === null)).toBe(true);
    expect(f.example.terms.map((t) => t.years)).toEqual([9, 19, 64]);
    expect(f.double.before).toBe("2,000,000");
    expect(f.cash60).toBe("504,000");
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx vitest run tests/calc/lifeprotect-page-data.test.ts`
Expected: FAIL — cannot resolve `@/lib/lifeprotect-facts`.

- [ ] **Step 3: Create `src/lib/lifeprotect-facts.ts`**

```ts
import type { ModePremium } from "@/calc/mode-premiums";
import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { PER, displayPremium, perDay } from "@/lib/legacy-cta";
import { cashAt, deathBenefitOf, lifeProtectModes, payYears, totalPaid } from "@/lib/lifeprotect-quote";
import { lifeProtectTable, type LifeProtectTerm } from "@/lib/lifeprotect-table";

/**
 * The figures the sales copy quotes, taken from the engine rather than typed into the JSX —
 * the same rule legacy-facts.ts follows, for the same reason: a number in prose has no idea
 * the table behind it has moved, and the calculator already goes silent when the rate table
 * lapses. Every price here is null then, and the copy says something else instead.
 */
export interface TermExample {
  label: string;
  years: number;
  /** the headline instalment, or null when no price may be shown */
  premium: string | null;
  /** "/เดือน" or "/ปี", matching `premium` */
  per: string | null;
  /** every premium over the term, or null */
  total: string | null;
}

export interface LifeProtectCopyFacts {
  expired: boolean;
  rateVersion: string;
  ageMin: number;
  ageMax: number;
  boosterBeforeAge: number;
  coverToAge: number;
  /** the cheapest honest opening figure: a woman of `fromAge` on the smallest sum, paying to 99 */
  fromAge: number;
  fromSum: string;
  fromPerDay: number | null;
  /** the block that compares the three terms */
  example: { age: number; sex: Sex; sum: string; terms: TermExample[] };
  /** the block about buying for a child */
  newborn: { sum: string; termLabel: string; years: number; premium: string | null; per: string | null };
  /** the block about paying double */
  double: { sum: string; before: string };
  /** the cash value the FAQ quotes: the example insured, 19-year term, at 60 */
  cash60: string;
}

const FROM = { age: 35, sex: "F" as Sex, sum: 500_000 };
const EXAMPLE = { age: 35, sex: "M" as Sex, sum: 1_000_000 };
const NEWBORN = { age: 0, sex: "M" as Sex, sum: 1_000_000 };
const CHILD_TERM = "WLF19H";

const money = (baht: number) => baht.toLocaleString("en-US");

export function lifeProtectFacts(today: Date = new Date()): LifeProtectCopyFacts {
  const table = lifeProtectTable(today);
  const to99 = table.terms[table.terms.length - 1];
  const childTerm = table.terms.find((t) => t.variant === CHILD_TERM)!;

  const headline = (term: LifeProtectTerm, who: { age: number; sex: Sex; sum: number }): ModePremium | undefined =>
    displayPremium(lifeProtectModes(table, term, { sex: who.sex, age: who.age, sumAssured: who.sum }), table.expired);
  const annualOf = (term: LifeProtectTerm, who: { age: number; sex: Sex; sum: number }) =>
    lifeProtectModes(table, term, { sex: who.sex, age: who.age, sumAssured: who.sum })?.find((m) => m.mode === "annual");

  const from = annualOf(to99, FROM);
  const child = headline(childTerm, NEWBORN);
  const death = deathBenefitOf(table, EXAMPLE.age, EXAMPLE.sum);
  const cash60 = cashAt(childTerm, EXAMPLE.sex, EXAMPLE.age, EXAMPLE.sum, table.ageMin).find((r) => r.age === 60)!;

  return {
    expired: table.expired,
    rateVersion: table.rateVersion,
    ageMin: table.ageMin,
    ageMax: table.ageMax,
    boosterBeforeAge: table.boosterBeforeAge,
    coverToAge: table.coverToAge,
    fromAge: FROM.age,
    fromSum: money(FROM.sum),
    fromPerDay: table.expired || !from ? null : perDay(from.total),
    example: {
      age: EXAMPLE.age,
      sex: EXAMPLE.sex,
      sum: money(EXAMPLE.sum),
      terms: table.terms.map((term) => {
        const shown = headline(term, EXAMPLE);
        const annual = annualOf(term, EXAMPLE);
        const years = payYears(term, EXAMPLE.age);
        return {
          label: term.label,
          years,
          premium: shown ? formatBaht(shown.total) : null,
          per: shown ? PER[shown.mode] : null,
          total: shown && annual ? formatBaht(totalPaid(annual.total, years)) : null,
        };
      }),
    },
    newborn: {
      sum: money(NEWBORN.sum),
      termLabel: childTerm.label,
      years: payYears(childTerm, NEWBORN.age),
      premium: child ? formatBaht(child.total) : null,
      per: child ? PER[child.mode] : null,
    },
    double: { sum: money(EXAMPLE.sum), before: money(death.sumBefore) },
    cash60: money(cash60.amount),
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/lifeprotect-page-data.test.ts`
Expected: PASS (7 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lifeprotect-facts.ts tests/calc/lifeprotect-page-data.test.ts
git commit -m "feat(lifeprotect): take the sales copy's figures from the engine

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: The calculator

**Files:**
- Create: `src/components/LifeProtectCalculator.tsx`

No unit test: the arithmetic it renders is tested in Task 3 and the message in Task 4. It is checked in the browser in Task 8.

- [ ] **Step 1: Create `src/components/LifeProtectCalculator.tsx`**

```tsx
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
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit && npx next lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/components/LifeProtectCalculator.tsx
git commit -m "feat(lifeprotect): a calculator that asks the customer four questions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The page and its copy

**Files:**
- Create: `src/components/lifeprotect/Hero.tsx`
- Create: `src/components/lifeprotect/Sections.tsx`
- Create: `src/app/lifeprotect/layout.tsx`
- Create: `src/app/lifeprotect/page.tsx`

- [ ] **Step 1: Create `src/components/lifeprotect/Hero.tsx`**

```tsx
import type { LifeProtectCopyFacts } from "@/lib/lifeprotect-facts";

/**
 * The first three seconds. The promise is a sum that arrives for certain and a premium that
 * stops, which is the opposite pitch to /legacy — and the page says so before the fold, with
 * the one figure a stranger can hold and the reassurance that nothing will be asked of them.
 */
export function Hero({ facts }: { facts: LifeProtectCopyFacts }) {
  return (
    <header className="pt-14 pb-12">
      <p className="lg-rise text-xs font-medium uppercase tracking-[0.22em] text-[var(--lg-gold)]" style={{ animationDelay: "0ms" }}>
        ประกันชีวิตตลอดชีพ Life Protect+ 100
      </p>

      <h1
        className="lg-rise mt-5 text-[2rem] font-medium leading-[1.28] text-[var(--lg-white)] sm:text-[2.6rem]"
        style={{ animationDelay: "90ms" }}
      >
        มรดกที่แน่นอน
        <br />
        <span className="lg-metal-text">จ่ายจบ ไม่ต้องจ่ายทั้งชีวิต</span>
      </h1>

      <p className="lg-rise mt-5 text-base leading-[1.85] text-[var(--lg-mute)]" style={{ animationDelay: "180ms" }}>
        เลือกจ่าย 9 ปี 19 ปี หรือถึงอายุ {facts.coverToAge} เบี้ยเท่าเดิมทุกปี คุ้มครองถึงอายุ {facts.coverToAge}{" "}
        <span className="font-medium text-[var(--lg-white)]">
          เสียชีวิตก่อน {facts.boosterBeforeAge} ครอบครัวได้ 2 เท่า
        </span>
      </p>

      <div className="lg-rise" style={{ animationDelay: "270ms" }}>
        <a
          href="#calc"
          className="lg-metal-face lg-sheen mt-9 block rounded-sm px-5 py-4 text-center text-lg font-medium tracking-wide"
        >
          ดูเบี้ยของฉัน ↓
        </a>
        <p className="mt-4 text-center text-xs leading-relaxed text-[var(--lg-mute)]">
          {facts.fromPerDay !== null && (
            <>อายุ {facts.fromAge} เริ่มต้นวันละ {facts.fromPerDay} บาท · </>
          )}
          รับแรกเกิด–{facts.ageMax} ปี · ไม่ต้องกรอกเบอร์
        </p>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Create `src/components/lifeprotect/Sections.tsx`**

```tsx
import Link from "next/link";
import { Fold, H2, Rule } from "@/components/sales/Blocks";
import type { LifeProtectCopyFacts } from "@/lib/lifeprotect-facts";

/**
 * What sets a level-premium, limited-pay whole life apart from the cover people think they
 * already have. Three counted points, as on /legacy: a reckoning, not a feature list.
 */
export function WhySection() {
  const points = [
    { title: "เบี้ยเท่าเดิมทุกปี", body: "คิดจากอายุวันที่เริ่ม ไม่ขึ้นตามอายุ ไม่ต้องลุ้นทุกปีว่าจะจ่ายไหวไหม" },
    { title: "จ่าย 9 หรือ 19 ปีแล้วจบ", body: "แต่ความคุ้มครองอยู่ถึงอายุ 99 จ่ายจบตอนยังทำงานอยู่ ไม่ต้องจ่ายตอนเกษียณ" },
    { title: "ไม่ใช่จ่ายทิ้ง", body: "กรมธรรม์มีมูลค่าเงินสดสะสม ต้องใช้ฉุกเฉินก็เวนคืนหรือกู้ได้ตามเงื่อนไข" },
  ];
  return (
    <section className="py-12">
      <H2>ประกันที่จ่ายจบ แล้วอยู่กับครอบครัวไปตลอด</H2>
      <div className="mt-7 space-y-6">
        {points.map((p, i) => (
          <div key={p.title} className="flex gap-4">
            <span className="lg-figure shrink-0 text-sm tabular-nums text-[var(--lg-gold)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <div>
              <div className="font-medium text-[var(--lg-white)]">{p.title}</div>
              <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">{p.body}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The secondary promise, in the page's only framed panel. */
export function DoubleSection({ facts }: { facts: LifeProtectCopyFacts }) {
  return (
    <section className="relative overflow-hidden rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-raise)] px-6 py-9">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 -top-24 h-48 bg-[radial-gradient(60%_100%_at_50%_100%,var(--lg-gold-glow),transparent_70%)]"
      />
      <h2 className="relative text-[1.4rem] font-medium leading-snug sm:text-2xl">
        <span className="text-[var(--lg-mute)]">ช่วงที่ครอบครัวพึ่งคุณที่สุด</span>
        <br />
        <span className="lg-metal-text">ก่อนอายุ {facts.boosterBeforeAge} ครอบครัวได้ 2 เท่าของทุน</span>
      </h2>
      <p className="relative mt-5 text-sm leading-[1.9] text-[var(--lg-mute)]">
        ช่วงที่ลูกยังเรียน บ้านยังผ่อน คือช่วงที่การจากไปกระทบหนักที่สุด แบบนี้จึงจ่ายสองเท่าในช่วงนั้น
      </p>
      <p className="relative mt-4 text-sm leading-[1.9] text-[var(--lg-mute)]">
        ทุน {facts.double.sum} บาท → เสียชีวิตก่อนอายุ {facts.boosterBeforeAge} ได้{" "}
        <span className="font-medium text-[var(--lg-gold)]">{facts.double.before} บาท</span>{" "}
        ตั้งแต่อายุ {facts.boosterBeforeAge} ถึง {facts.coverToAge} ได้ {facts.double.sum} บาท
      </p>
    </section>
  );
}

/**
 * The three terms side by side for one insured, so the choice the calculator asks for has
 * something to lean on. The figures are the engine's; when the table has lapsed the block
 * keeps its advice and drops its numbers.
 */
export function TermsSection({ facts }: { facts: LifeProtectCopyFacts }) {
  const advice = [
    "เหมาะกับคนที่อยากปิดภาระเร็ว จ่ายรวมน้อยที่สุด",
    "ตรงกลาง จ่ายจบก่อนเกษียณ — แบบที่เราแนะนำ",
    "เบี้ยต่อเดือนต่ำสุด สำหรับคนที่ต้องการทุนสูงด้วยงบต่อเดือนจำกัด",
  ];
  return (
    <section className="py-12">
      <H2>เลือกงวดชำระแบบไหนดี</H2>
      <p className="mt-2 text-sm text-[var(--lg-mute)]">
        ตัวอย่าง{facts.example.sex === "M" ? "ชาย" : "หญิง"}อายุ {facts.example.age} ทุน {facts.example.sum} บาท
      </p>
      <div className="mt-7 space-y-6">
        {facts.example.terms.map((t, i) => (
          <div key={t.label} className="border-b border-[var(--lg-panel-line)] pb-5 last:border-b-0">
            <div className="flex items-baseline justify-between gap-3">
              <div className="font-medium text-[var(--lg-white)]">{t.label}</div>
              {t.premium && (
                <div className="lg-figure text-lg tabular-nums text-[var(--lg-white)]">
                  {t.premium} <span className="text-sm text-[var(--lg-mute)]">บาท{t.per}</span>
                </div>
              )}
            </div>
            <p className="mt-1.5 text-sm leading-[1.85] text-[var(--lg-mute)]">
              จ่าย {t.years} ปี{t.total ? ` รวมประมาณ ${t.total} บาท` : ""} · {advice[i]}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The second buyer: a parent, for whom the level premium is at its cheapest. */
export function ChildSection({ facts }: { facts: LifeProtectCopyFacts }) {
  const n = facts.newborn;
  return (
    <section className="pb-12">
      <Rule />
      <div className="pt-8">
        <H2>ของขวัญที่จ่ายจบก่อนลูกเรียนจบ</H2>
        <p className="mt-5 text-sm leading-[1.9] text-[var(--lg-mute)]">
          ลูกชายแรกเกิด ทุน {n.sum} บาท {n.termLabel}
          {n.premium ? (
            <> ราว <span className="font-medium text-[var(--lg-white)]">{n.premium} บาท{n.per}</span></>
          ) : null}
          {" "}เบี้ยล็อกที่อายุแรกเกิดตลอด {n.years} ปี พอลูกอายุ {n.years} พ่อแม่จ่ายจบ ลูกมีประกันชีวิตติดตัวถึงอายุ{" "}
          {facts.coverToAge} พร้อมมูลค่าเงินสดที่โตขึ้นทุกปี
        </p>
        <p className="mt-3 text-xs text-[var(--lg-mute)] opacity-75">ผู้เยาว์ต้องมีผู้ชำระเบี้ย ทักมาให้เราจัดให้</p>
      </div>
    </section>
  );
}

/** The objections, answered before they are raised. Whether the premium rises leads. */
export function FaqSection({ facts }: { facts: LifeProtectCopyFacts }) {
  const faqs: { q: string; a: React.ReactNode }[] = [
    {
      q: "เบี้ยจะขึ้นไหม",
      a: "ไม่ขึ้น เบี้ยของแบบหลักคิดจากอายุวันที่เริ่ม และคงที่ตลอดระยะเวลาชำระ ต่างจากสัญญาเพิ่มเติมโรคร้ายแรงที่ปรับตามอายุ",
    },
    {
      q: "ต้องตรวจสุขภาพไหม",
      a: "ขึ้นกับอายุ ทุน และประวัติสุขภาพ ตัวแทนเช็กให้ได้ก่อนสมัคร เบี้ยที่แสดงในหน้านี้เป็นเบี้ยมาตรฐาน",
    },
    {
      q: "จ่ายจบแล้วยังคุ้มครองอยู่ไหม",
      a: `อยู่ถึงอายุ ${facts.coverToAge} ปี ไม่ต้องจ่ายอะไรเพิ่ม`,
    },
    {
      q: "เวนคืนได้ไหม ได้เท่าไหร่",
      a: `ได้ตามตารางมูลค่าเวนคืนในกรมธรรม์ เช่น ชายอายุ ${facts.example.age} ทุน ${facts.example.sum} บาท จ่าย 19 ปี ที่อายุ 60 มีมูลค่าเงินสดราว ${facts.cash60} บาท เวนคืนแล้วความคุ้มครองสิ้นสุด`,
    },
    {
      q: "ต่างจาก “มรดกเพื่อครอบครัว” ยังไง",
      a: (
        <>
          ชุดนั้นใช้แบบเดียวกันนี้เป็นฐาน แล้วเพิ่มสัญญาโรคร้ายแรง ได้เงินก้อนตอนป่วยหนักด้วย
          แต่เบี้ยส่วนโรคร้ายแรงขึ้นทุกปีและคุ้มครองถึงอายุ 75 แบบนี้ไม่มีโรคร้ายแรง แต่เบี้ยไม่ขยับและจ่ายจบได้{" "}
          <Link href="/legacy" className="text-[var(--lg-gold)] underline underline-offset-4">ดูชุดมรดกเพื่อครอบครัว</Link>
        </>
      ),
    },
    {
      q: "จ่ายไม่ไหวกลางทางทำยังไง",
      a: "ปรับลดทุนได้ หรือใช้มูลค่าเงินสดตามเงื่อนไขของกรมธรรม์ คุยกับตัวแทนก่อนขาดส่ง อย่าปล่อยให้กรมธรรม์สิ้นผลไปเอง",
    },
    {
      q: "สมัครยังไง",
      a: "ทักแชท บอกอายุ ทุน และงวดที่ต้องการ ตัวแทนส่งใบเสนอฉบับเต็มให้ดูก่อนตัดสินใจ ปรึกษาไม่มีค่าใช้จ่าย",
    },
  ];
  return (
    <section className="pb-12">
      <H2>คำถามที่พบบ่อย</H2>
      <div className="mt-5 border-t border-[var(--lg-panel-line)]">
        {faqs.map((f) => (
          <Fold key={f.q} summary={f.q}>{f.a}</Fold>
        ))}
      </div>
    </section>
  );
}

/** What the figures on this page are and are not. Required of any insurance advertisement. */
export function Disclaimer({ facts }: { facts: LifeProtectCopyFacts }) {
  return (
    <footer className="pb-10">
      <Rule />
      <div className="pt-7 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
        <p>
          {facts.expired
            ? "ตารางเบี้ยชุดที่ใช้คำนวณหมดอายุแล้ว หน้านี้จึงไม่แสดงเบี้ย ขอราคาปัจจุบันได้ทางแชท"
            : `เบี้ยที่แสดงเป็นเบี้ยมาตรฐานโดยประมาณ คำนวณจากตารางเบี้ยฉบับ ${facts.rateVersion} ใช้ประกอบการตัดสินใจเบื้องต้นเท่านั้น ไม่ใช่ใบเสนอราคาและไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย`}
        </p>
        <p className="mt-2.5">
          มูลค่าเวนคืนเป็นไปตามตารางในกรมธรรม์ ความคุ้มครองและข้อยกเว้นเป็นไปตามที่ระบุในกรมธรรม์
          การพิจารณารับประกันเป็นไปตามหลักเกณฑ์ของบริษัท
        </p>
        <p className="mt-2.5 font-medium text-[var(--lg-white)]">
          ผู้ซื้อควรทำความเข้าใจรายละเอียดความคุ้มครองและเงื่อนไขก่อนตัดสินใจทำประกันภัยทุกครั้ง
        </p>
      </div>
    </footer>
  );
}
```

- [ ] **Step 3: Create `src/app/lifeprotect/layout.tsx`**

```tsx
import { SalesTheme } from "@/components/sales/SalesTheme";

export default function LifeProtectLayout({ children }: { children: React.ReactNode }) {
  return <SalesTheme>{children}</SalesTheme>;
}
```

- [ ] **Step 4: Create `src/app/lifeprotect/page.tsx`**

```tsx
import { LifeProtectCalculator } from "@/components/LifeProtectCalculator";
import { legacyChannels } from "@/lib/legacy-channels";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { lifeProtectFacts } from "@/lib/lifeprotect-facts";
import { Hero } from "@/components/lifeprotect/Hero";
import {
  ChildSection, Disclaimer, DoubleSection, FaqSection, TermsSection, WhySection,
} from "@/components/lifeprotect/Sections";

export const metadata = {
  title: "Life Protect+ 100 — มรดกที่แน่นอน จ่ายจบ ไม่ต้องจ่ายทั้งชีวิต",
  description:
    "ประกันชีวิตตลอดชีพ เลือกจ่าย 9 ปี 19 ปี หรือถึงอายุ 99 เบี้ยคงที่ คุ้มครองถึงอายุ 99 เสียชีวิตก่อน 60 ครอบครัวได้ 2 เท่า คำนวณเบี้ยของคุณเองได้ทันที",
};

/** Regenerated hourly, as /legacy is: the contact channels are read from LINE and the database. */
export const revalidate = 3600;

/**
 * Same order of questions as /legacy — what is this, what does it cost, why would I need it,
 * what else does it do, which term, who else is it for, what am I still worried about.
 */
export default async function LifeProtectPage() {
  const channels = await legacyChannels();
  const table = lifeProtectTable();
  const facts = lifeProtectFacts();
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:pb-10">
      <Hero facts={facts} />
      <section id="calc" className="scroll-mt-4">
        <LifeProtectCalculator table={table} channels={channels} sticky />
      </section>
      <WhySection />
      <DoubleSection facts={facts} />
      <TermsSection facts={facts} />
      <ChildSection facts={facts} />
      <FaqSection facts={facts} />
      <Disclaimer facts={facts} />
    </main>
  );
}
```

- [ ] **Step 5: Type-check, lint, all tests**

Run: `npx tsc --noEmit && npx next lint && npx vitest run`
Expected: clean; every test passes.

- [ ] **Step 6: Commit**

```bash
git add src/components/lifeprotect/Hero.tsx src/components/lifeprotect/Sections.tsx src/app/lifeprotect/layout.tsx src/app/lifeprotect/page.tsx
git commit -m "feat(lifeprotect): wrap the calculator in the Life Protect+ 100 sales page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Verify in the browser and ship

**Files:** none new.

- [ ] **Step 1: Full gate**

Run: `npm run verify`
Expected: tsc, lint, vitest and the production build all succeed.

- [ ] **Step 2: Open the dev server** (via the Browser pane's `preview_start`, config name from `.claude/launch.json`) at `/lifeprotect`, viewport 375×812, and check:

1. ชาย 35 · ทุน 1,000,000 · จ่าย 19 ปี → headline **2,583 บาท ต่อเดือน**, "ตกวันละ 79 บาท", "จ่ายทั้งหมด 19 ปี รวมประมาณ 545,300 บาท", term buttons read 4,914/เดือน · 2,583/เดือน · 1,548/เดือน, family receives 2,000,000 / 1,000,000, cash 504,000 / 633,000 / 777,000 / 1,000,000 at 60 / 70 / 80 / 99.
2. Open `/` (the agent's calculator), pick Life Protect x 2 · ชำระเบี้ย 19 ปี, ทุน 1,000,000, ชาย 35, รายเดือน → the same 2,583.
3. แรกเกิด · 1,000,000 · จ่ายถึงอายุ 99 → headline is the **yearly** 6,000, no monthly figure anywhere; the gold "เบี้ยล็อกที่อายุแรกเกิด" note shows.
4. 81 ปีขึ้นไป → the gold-framed message; contact buttons still there; the message in the AI link says "อายุเกิน 80 ปี".
5. No horizontal scroll at any point; the bottom bar does not cover the disclaimer's last line; every FAQ opens and closes.
6. Widen the window: content centred, bottom bar gone.
7. Open `/legacy`: buttons, theme and copy unchanged.

Take a screenshot of the priced card for the user.

- [ ] **Step 3: Land on `main`** (the user's standing rule: no lingering branches)

```bash
git fetch origin && git rebase origin/main && npm run verify && git push origin HEAD:main
```
Expected: push accepted; Vercel deploys from `main`. Then tell the user the page is at `https://www.advisortool.app/lifeprotect` once the deploy finishes.
