# Self-Planner (/plan) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public page where a customer types rough figures, sees what cover they are missing in four areas, gets our plans priced from the real rate tables within their budget, and reads a planner-style explanation written by a cheap AI model.

**Architecture:** Pure formulas (`needs.ts`) → budget allocation over an injectable `Pricer` (`recommend.ts`) → a real pricer wired to the existing engines (`pricer.ts`) → digit-free prose (`prose.ts`). Two server actions: `buildPlan` returns figures at once, `explainPlan` returns prose after. Runs are logged anonymously to `ins_plan_runs` and shown on `/admin/crm`.

**Tech Stack:** Next.js App Router (server actions), TypeScript, vitest, Supabase (service role), existing `chat()` AI client.

Spec: `docs/superpowers/specs/2026-09-25-self-planner-design.md`.

**House rules for this repo (from memory):** commit straight to `main`; stage by path, never `git add -A` (other sessions edit the same worktree); chain commits behind `npm run verify &&` for code commits; commit email is `pheerapatpisit.dev@gmail.com` (already configured). All money inside `recommend` is **satang**; `PlanInput` money is **baht**.

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/plan/assumptions.ts` | every rule-of-thumb constant, owner-editable |
| `src/lib/plan/needs.ts` | `PlanInput`, `cleanInput`, need/gap formulas, budget default, tax |
| `src/lib/plan/recommend.ts` | `Pricer` interface, `recommend()` budget allocation → `PlanResult` |
| `src/lib/plan/pricer.ts` | `realPricer()` — Life Protect, iHealthy package, CI 123 set, Cancer set, Pension 95 |
| `src/lib/plan/prose.ts` | brief, prompt, digit guard, fallbacks, `explain()` |
| `src/app/plan/actions.ts` | `buildPlan`, `explainPlan`, anonymous log |
| `src/app/plan/{layout,page}.tsx`, `Planner.tsx`, `PlanView.tsx` | the page |
| `supabase/migrations/20260925_plan_runs.sql` | `ins_plan_runs` |
| `src/app/admin/crm/PlanRuns.tsx` + `page.tsx` | owner's view |
| `src/lib/shell/menu.ts` + `tests/calc/shell-menu.test.ts` | menu entry |
| `tests/plan/*.test.ts` | tests |

---

### Task 1: Assumptions and need formulas

**Files:** Create `src/lib/plan/assumptions.ts`, `src/lib/plan/needs.ts`, `tests/plan/needs.test.ts`

- [ ] **Step 1: Write `assumptions.ts`**

```ts
/**
 * Every rule of thumb the planner assumes, in one place, so the owner can change one without
 * reading the formulas. Agreed with the owner 2026-09-25 — see
 * docs/superpowers/specs/2026-09-25-self-planner-design.md.
 */

/** ดูแลลูกจนถึงอายุนี้ */
export const CHILD_SUPPORTED_UNTIL = 22;
/** ไม่มีลูก แต่มีพ่อแม่/คู่สมรสที่ต้องดูแล: ดูแลกี่ปี */
export const YEARS_FOR_OTHER_DEPENDANTS = 10;
/** ทุนการศึกษาต่อลูกหนึ่งคน ตั้งแต่เกิดจนอายุ 22 (ลดลงตามอายุลูก) */
export const EDUCATION_PER_CHILD = 1_000_000;
/** ค่าทำศพ */
export const FUNERAL = 100_000;
/** ทุนโรคร้ายแรงที่ควรมี = รายได้กี่ปี */
export const CI_YEARS_OF_INCOME = 3;
/** งบเบี้ยตั้งต้น = กี่ส่วนของเงินเดือน (ก่อนหักเบี้ยที่จ่ายอยู่) */
export const DEFAULT_BUDGET_SHARE = 0.1;
/** เงินที่ควรมีใช้ต่อเดือนหลังเกษียณ = กี่ส่วนของค่าใช้จ่ายวันนี้ */
export const RETIRE_SHARE_OF_EXPENSE = 0.7;
/** อายุเริ่มรับบำนาญที่อยากได้ (ถ้าอายุนี้เลือกไม่ได้ ใช้อายุถัดไปที่เลือกได้) */
export const PENSION_FROM_AGE = 60;
/** Life Protect x 2 จ่ายสองเท่าเมื่อเสียชีวิตก่อนอายุนี้ — the test checks it against the rate table */
export const LIFE_DOUBLE_BEFORE_AGE = 60;
/** อายุที่หน้านี้รับ */
export const PLANNER_AGE = { min: 20, max: 70 } as const;

export type Hospital = "public" | "private" | "premium";
export const HOSPITAL_LABEL: Record<Hospital, string> = {
  public: "โรงพยาบาลรัฐ",
  private: "เอกชนทั่วไป",
  premium: "เอกชนชั้นนำ",
};
/** โรงพยาบาลที่อยากใช้ → แผน iHealthy Ultra */
export const HOSPITAL_TIER: Record<Hospital, string> = { public: "SMART", private: "SILVER", premium: "GOLD" };

/** iHealthy Ultra's six plans, smallest first (data/riders/ihealthy-ultra.json) */
export const HEALTH_TIERS: { code: string; name: string; room: number }[] = [
  { code: "SMART", name: "สมาร์ท", room: 1_500 },
  { code: "BRONZE", name: "บรอนซ์", room: 3_000 },
  { code: "SILVER", name: "ซิลเวอร์", room: 5_500 },
  { code: "GOLD", name: "โกลด์", room: 9_000 },
  { code: "DIAMOND", name: "ไดมอนด์", room: 15_000 },
  { code: "PLATINUM", name: "แพลทินัม", room: 21_000 },
];

/** the sums the Life Protect page offers: every 500,000 to 10 million, then every million to 50 */
export const LIFE_SUMS: number[] = [
  ...Array.from({ length: 20 }, (_, i) => (i + 1) * 500_000),
  ...Array.from({ length: 40 }, (_, i) => (i + 11) * 1_000_000),
];

/** CI 123 set tiers (data/bundles/ci123.json) */
export const CI_TIERS = [
  { no: 1, sum: 500_000 }, { no: 2, sum: 1_000_000 }, { no: 3, sum: 2_000_000 }, { no: 4, sum: 3_000_000 },
  { no: 5, sum: 4_000_000 }, { no: 6, sum: 5_000_000 }, { no: 7, sum: 10_000_000 },
];

/** Cancer set tiers by cancer cover (data/bundles/cancer.json) */
export const CANCER_TIERS = [
  { no: 1, sum: 300_000 }, { no: 2, sum: 500_000 }, { no: 3, sum: 750_000 }, { no: 4, sum: 1_000_000 },
  { no: 5, sum: 2_000_000 }, { no: 6, sum: 3_000_000 }, { no: 7, sum: 4_000_000 }, { no: 8, sum: 5_000_000 },
];
```

- [ ] **Step 2: Write the failing tests `tests/plan/needs.test.ts`**

```ts
import { describe, expect, it } from "vitest";
import {
  ciNeed, cleanInput, defaultBudget, healthNeed, lifeNeed, marginalRate, retireNeed, taxSaved, type PlanInput,
} from "@/lib/plan/needs";

/** the owner's own example, 2026-09-25 */
const OWNER: PlanInput = {
  age: 35, sex: "M", income: 50_000, expense: 25_000, savings: 200_000, children: [5, 8],
  otherDependants: false, debts: 1_500_000, lifeCover: 500_000, ciCover: 0, healthNow: "public",
  healthRoom: 0, premiumsNow: 12_000, hospital: "private", budget: 4_000,
};

describe("lifeNeed", () => {
  it("works the owner's example to the baht", () => {
    const n = lifeNeed(OWNER);
    expect(n.years).toBe(17);
    expect(n.support).toBe(5_100_000);
    expect(n.education).toBe(770_000 + 640_000);
    expect(n.need).toBe(8_110_000);
    expect(n.gap).toBe(7_410_000);
    expect(n.doubled).toBe(true);
    expect(n.sumAssured).toBe(4_000_000);
  });

  it("covers debts and a funeral when nobody depends on you", () => {
    const n = lifeNeed({ ...OWNER, children: [], debts: 0, lifeCover: 0, savings: 0 });
    expect(n.years).toBe(0);
    expect(n.need).toBe(100_000);
    expect(n.sumAssured).toBe(500_000);
  });

  it("supports other dependants for ten years", () => {
    expect(lifeNeed({ ...OWNER, children: [], otherDependants: true }).years).toBe(10);
  });

  it("does not halve the sum when support runs past sixty", () => {
    const n = lifeNeed({ ...OWNER, age: 50, children: [5] });
    expect(n.doubled).toBe(false);
    expect(n.sumAssured).toBeGreaterThanOrEqual(n.gap);
  });

  it("ignores grown-up children", () => {
    expect(lifeNeed({ ...OWNER, children: [25] }).years).toBe(0);
  });

  it("recommends nothing when cover already exceeds the need", () => {
    const n = lifeNeed({ ...OWNER, lifeCover: 20_000_000 });
    expect(n.gap).toBe(0);
    expect(n.sumAssured).toBe(0);
  });
});

describe("healthNeed", () => {
  it("counts a private policy's room as cover", () => {
    expect(healthNeed({ ...OWNER, healthNow: "private", healthRoom: 6_000 }).covered).toBe(true);
  });
  it("does not count employer welfare", () => {
    const h = healthNeed({ ...OWNER, healthNow: "employer" });
    expect(h.covered).toBe(false);
    expect(h.plan).toBe("SILVER");
    expect(h.room).toBe(5_500);
  });
});

describe("ciNeed, retireNeed", () => {
  it("wants three years of income", () => {
    expect(ciNeed({ ...OWNER, ciCover: 500_000 })).toEqual({ need: 1_800_000, have: 500_000, gap: 1_300_000 });
  });
  it("wants seventy percent of today's spending", () => {
    expect(retireNeed(OWNER)).toBe(17_500);
  });
});

describe("budget and tax", () => {
  it("opens the budget at ten percent less what is already paid", () => {
    expect(defaultBudget(50_000, 12_000)).toBe(4_000);
    expect(defaultBudget(10_000, 50_000)).toBe(0);
  });
  it("finds the marginal rate", () => {
    expect(marginalRate(50_000)).toBe(0.1);
    expect(marginalRate(15_000)).toBe(0);
  });
  it("counts health to 25,000 inside 100,000, pension to 15% of income", () => {
    expect(taxSaved(OWNER, { life: 30_000, health: 30_000, pension: 20_000 })).toBe(7_500);
  });
});

describe("cleanInput", () => {
  it("refuses an age outside 20–70 and a missing income", () => {
    expect(typeof cleanInput({ ...OWNER, age: 19 })).toBe("string");
    expect(typeof cleanInput({ ...OWNER, income: 0 })).toBe("string");
  });
  it("keeps four children at most and defaults unknown choices", () => {
    const p = cleanInput({ ...OWNER, children: [1, 2, 3, 4, 5], hospital: "x", healthNow: "y" });
    if (typeof p === "string") throw new Error(p);
    expect(p.children).toEqual([1, 2, 3, 4]);
    expect(p.hospital).toBe("private");
    expect(p.healthNow).toBe("none");
  });
  it("turns junk money into zero", () => {
    const p = cleanInput({ ...OWNER, debts: "abc", savings: -5 });
    if (typeof p === "string") throw new Error(p);
    expect(p.debts).toBe(0);
    expect(p.savings).toBe(0);
  });
});
```

- [ ] **Step 3: Run — expect FAIL (module not found)**

Run: `npx vitest run tests/plan/needs.test.ts`

- [ ] **Step 4: Write `needs.ts`**

```ts
import {
  CHILD_SUPPORTED_UNTIL, CI_YEARS_OF_INCOME, DEFAULT_BUDGET_SHARE, EDUCATION_PER_CHILD, FUNERAL, HEALTH_TIERS,
  HOSPITAL_TIER, LIFE_DOUBLE_BEFORE_AGE, LIFE_SUMS, PLANNER_AGE, RETIRE_SHARE_OF_EXPENSE,
  YEARS_FOR_OTHER_DEPENDANTS, type Hospital,
} from "./assumptions";

/**
 * What a customer tells the planner, and the need in each area worked out from it.
 * Pure: no rate tables and no I/O, so every figure here is testable to the baht.
 * All money is baht; income and expense are a month, premiumsNow a year.
 */

export type Sex = "M" | "F";
export type HealthNow = "none" | "public" | "employer" | "private";

export interface PlanInput {
  age: number;
  sex: Sex;
  income: number;
  /** the part of the family's monthly spending this person pays */
  expense: number;
  savings: number;
  /** each child's age */
  children: number[];
  /** parents or a spouse who live on this income */
  otherDependants: boolean;
  debts: number;
  lifeCover: number;
  ciCover: number;
  healthNow: HealthNow;
  /** the room a day the customer's own health policy pays; read only when healthNow is "private" */
  healthRoom: number;
  premiumsNow: number;
  hospital: Hospital;
  /** baht a month the customer will add */
  budget: number;
}

const MAX_MONEY = 1_000_000_000;
const HEALTH_NOW: HealthNow[] = ["none", "public", "employer", "private"];
const HOSPITALS: Hospital[] = ["public", "private", "premium"];

function money(v: unknown): number {
  const n = Math.floor(Number(v));
  return Number.isFinite(n) && n > 0 ? Math.min(n, MAX_MONEY) : 0;
}

/** The form's values made safe, or the sentence to show when they cannot be. */
export function cleanInput(raw: unknown): PlanInput | string {
  const r = (raw ?? {}) as Record<string, unknown>;
  const age = Math.floor(Number(r.age));
  if (!Number.isFinite(age) || age < PLANNER_AGE.min || age > PLANNER_AGE.max) {
    return `กรอกอายุ ${PLANNER_AGE.min}–${PLANNER_AGE.max} ปี`;
  }
  const income = money(r.income);
  if (!income) return "กรอกเงินเดือนก่อนนะครับ";
  const kids = Array.isArray(r.children) ? r.children : [];
  return {
    age,
    sex: r.sex === "F" ? "F" : "M",
    income,
    expense: money(r.expense),
    savings: money(r.savings),
    children: kids.slice(0, 4).map((k) => Math.floor(Number(k))).filter((k) => Number.isFinite(k) && k >= 0 && k <= 40),
    otherDependants: r.otherDependants === true,
    debts: money(r.debts),
    lifeCover: money(r.lifeCover),
    ciCover: money(r.ciCover),
    healthNow: HEALTH_NOW.find((h) => h === r.healthNow) ?? "none",
    healthRoom: money(r.healthRoom),
    premiumsNow: money(r.premiumsNow),
    hospital: HOSPITALS.find((h) => h === r.hospital) ?? "private",
    budget: money(r.budget),
  };
}

/** the first step at or above x, or the last step when x is past them all */
export function roundUpTo(steps: readonly number[], x: number): number {
  return steps.find((s) => s >= x) ?? steps[steps.length - 1];
}

export interface LifeNeed {
  years: number;
  support: number;
  education: number;
  debts: number;
  funeral: number;
  need: number;
  /** life cover plus savings */
  have: number;
  gap: number;
  /** Life Protect's double cover lasts through every year of support */
  doubled: boolean;
  /** the Life Protect sum that closes the gap; 0 when there is none */
  sumAssured: number;
}

export function lifeNeed(p: PlanInput): LifeNeed {
  const young = p.children.filter((a) => a < CHILD_SUPPORTED_UNTIL);
  const years = young.length
    ? CHILD_SUPPORTED_UNTIL - Math.min(...young)
    : p.otherDependants ? YEARS_FOR_OTHER_DEPENDANTS : 0;
  const support = p.expense * 12 * years;
  const education = young.reduce(
    (s, a) => s + Math.round((EDUCATION_PER_CHILD * (CHILD_SUPPORTED_UNTIL - a)) / CHILD_SUPPORTED_UNTIL / 10_000) * 10_000,
    0,
  );
  const need = p.debts + support + education + FUNERAL;
  const have = p.lifeCover + p.savings;
  const gap = Math.max(0, need - have);
  const doubled = p.age < LIFE_DOUBLE_BEFORE_AGE && p.age + years <= LIFE_DOUBLE_BEFORE_AGE;
  const sumAssured = gap === 0 ? 0 : roundUpTo(LIFE_SUMS, doubled ? gap / 2 : gap);
  return { years, support, education, debts: p.debts, funeral: FUNERAL, need, have, gap, doubled, sumAssured };
}

export interface HealthNeed {
  plan: string;
  room: number;
  haveRoom: number;
  covered: boolean;
}

/** Employer welfare is not counted: it ends with the job. */
export function healthNeed(p: PlanInput): HealthNeed {
  const plan = HOSPITAL_TIER[p.hospital];
  const room = HEALTH_TIERS.find((t) => t.code === plan)!.room;
  const haveRoom = p.healthNow === "private" ? p.healthRoom : 0;
  return { plan, room, haveRoom, covered: haveRoom >= room };
}

export function ciNeed(p: PlanInput): { need: number; have: number; gap: number } {
  const need = p.income * 12 * CI_YEARS_OF_INCOME;
  return { need, have: p.ciCover, gap: Math.max(0, need - p.ciCover) };
}

/** baht a month to live on after work, rounded to the hundred */
export function retireNeed(p: PlanInput): number {
  return Math.round((p.expense * RETIRE_SHARE_OF_EXPENSE) / 100) * 100;
}

/** baht a month: ten percent of income less what is already paid, down to the hundred */
export function defaultBudget(income: number, premiumsNow: number): number {
  return Math.max(0, Math.floor((income * DEFAULT_BUDGET_SHARE - premiumsNow / 12) / 100) * 100);
}

/** Thai personal income tax, on net income a year */
const BRACKETS: [upTo: number, rate: number][] = [
  [150_000, 0], [300_000, 0.05], [500_000, 0.1], [750_000, 0.15],
  [1_000_000, 0.2], [2_000_000, 0.25], [5_000_000, 0.3], [Infinity, 0.35],
];

/** An estimate: salary only, the expense deduction and the personal allowance, nothing else. */
export function marginalRate(monthlyIncome: number): number {
  const annual = monthlyIncome * 12;
  const net = annual - Math.min(annual * 0.5, 100_000) - 60_000;
  return BRACKETS.find(([upTo]) => net <= upTo)![1];
}

/** baht a year of new premium, by the deduction each counts under */
export interface NewPremiums {
  life: number;
  health: number;
  pension: number;
}

/**
 * The tax the new premiums save a year, estimated. Life and health share 100,000 (health alone
 * 25,000), with what is already paid counted first; pension counts to 15% of income or 200,000.
 */
export function taxSaved(p: PlanInput, add: NewPremiums): number {
  const annual = p.income * 12;
  const before = Math.min(p.premiumsNow, 100_000);
  const after = Math.min(p.premiumsNow + add.life + Math.min(add.health, 25_000), 100_000);
  const pension = Math.min(add.pension, annual * 0.15, 200_000);
  return Math.round((after - before + pension) * marginalRate(p.income));
}
```

- [ ] **Step 5: Run — expect PASS**

Run: `npx vitest run tests/plan/needs.test.ts`

- [ ] **Step 6: Commit**

```bash
git add src/lib/plan/assumptions.ts src/lib/plan/needs.ts tests/plan/needs.test.ts
git commit -m "feat(plan): need formulas for the self-planner"
```

---

### Task 2: Budget allocation (`recommend.ts`)

**Files:** Create `src/lib/plan/recommend.ts`, `tests/plan/recommend.test.ts`

- [ ] **Step 1: Write the failing tests** with a fake pricer so every price is known

```ts
import { describe, expect, it } from "vitest";
import { recommend, type Pricer } from "@/lib/plan/recommend";
import type { PlanInput } from "@/lib/plan/needs";

const OWNER: PlanInput = {
  age: 35, sex: "M", income: 50_000, expense: 25_000, savings: 200_000, children: [5, 8],
  otherDependants: false, debts: 1_500_000, lifeCover: 500_000, ciCover: 0, healthNow: "public",
  healthRoom: 0, premiumsNow: 12_000, hospital: "private", budget: 100_000,
};

/** satang a year: life 10 baht per 1,000; health 20,000 × tier index; CI 3,000 × tier; cancer 1,000 × tier */
const FAKE: Pricer = {
  life: (sum) => sum * 1,
  health: (plan) => (["SMART", "BRONZE", "SILVER", "GOLD"].indexOf(plan) + 1) * 2_000_000,
  ci: (tier) => tier * 300_000,
  cancer: (tier) => tier * 100_000,
  pension: (annual) => (annual >= 1_000_000 ? { annual, monthlyPension: annual / 10_000, from: 60 } : undefined),
};

const area = (r: ReturnType<typeof recommend>, key: string) => r.areas.find((a) => a.key === key)!;

describe("recommend", () => {
  it("gives every area in full when the budget allows, and the rest to the pension", () => {
    const r = recommend(OWNER, FAKE);
    expect(area(r, "life").status).toBe("fits");
    expect(area(r, "life").offer?.sum).toBe(4_000_000);
    expect(area(r, "life").offer?.cover).toBe(8_000_000);
    expect(area(r, "health").offer?.product).toContain("ซิลเวอร์");
    expect(area(r, "ci").offer?.sum).toBe(2_000_000);
    expect(area(r, "retire").status).toBe("fits");
    expect(r.usedAnnual).toBeLessThanOrEqual(OWNER.budget * 12 * 100);
  });

  it("steps life down to the largest sum the budget reaches", () => {
    const pr = { ...FAKE, life: (sum: number) => sum / 100 };
    const r = recommend({ ...OWNER, budget: 25 }, pr); // 300 baht a year = 30,000 satang
    expect(area(r, "life").status).toBe("reduced");
    expect(area(r, "life").offer?.sum).toBe(3_000_000);
  });

  it("says short, with the smallest price, when nothing fits", () => {
    const r = recommend({ ...OWNER, budget: 0 }, FAKE);
    expect(area(r, "life").status).toBe("short");
    expect(area(r, "life").offer?.sum).toBe(500_000);
    expect(r.usedAnnual).toBe(0);
  });

  it("falls back to the cancer set when CI 123 does not fit", () => {
    const left = { ...FAKE, life: () => 0, health: () => 0 };
    const r = recommend({ ...OWNER, budget: 200 }, left); // 240,000 satang a year
    expect(area(r, "ci").status).toBe("reduced");
    expect(area(r, "ci").offer?.product).toContain("มะเร็ง");
  });

  it("marks an area covered when nothing is missing", () => {
    const r = recommend({ ...OWNER, lifeCover: 50_000_000, healthNow: "private", healthRoom: 9_000, ciCover: 5_000_000 }, FAKE);
    expect(["life", "health", "ci"].map((k) => area(r, k).status)).toEqual(["covered", "covered", "covered"]);
  });

  it("marks an area unavailable when the plan will not take this age", () => {
    const r = recommend({ ...OWNER, age: 66 }, { ...FAKE, pension: () => undefined });
    expect(area(r, "retire").status).toBe("unavailable");
  });

  it("estimates the tax the new premiums save", () => {
    expect(recommend(OWNER, FAKE).taxSaved).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/plan/recommend.test.ts`

- [ ] **Step 3: Write `recommend.ts`**

```ts
import { PENSION_LIMITS } from "@/calc/pension/engine";
import { CANCER_TIERS, CI_TIERS, HEALTH_TIERS, LIFE_SUMS } from "./assumptions";
import { ciNeed, healthNeed, lifeNeed, retireNeed, roundUpTo, taxSaved, type PlanInput, type Sex } from "./needs";

/**
 * The plan: each area's need met as far as the budget goes, in the owner's order —
 * life, health, critical illness, then whatever is left to the pension.
 *
 * Prices come from a Pricer so this can be tested with prices anyone can check by eye;
 * the real one (pricer.ts) reads the rate tables. Every premium here is satang a year.
 */

export type AreaKey = "life" | "health" | "ci" | "retire";
export type Status = "fits" | "reduced" | "short" | "covered" | "unavailable";

export interface Offer {
  product: string;
  href: string;
  /** the contract's own amount: the sum assured, the tier's CI sum, the pension's premium */
  sum: number;
  /** what it pays: double the sum before sixty, the room a day, the pension a month */
  cover: number;
  /** satang a year */
  annual: number;
  /** premium rises with age, so it is the first year's */
  firstYear: boolean;
  /** the pension's starting age */
  fromAge?: number;
}

export interface Area {
  key: AreaKey;
  /** how have / should / cover read: baht, baht a day, baht a month */
  unit: "sum" | "room" | "pension";
  have: number;
  should: number;
  status: Status;
  /** for "short", the smallest option — shown, not counted */
  offer?: Offer;
}

export interface PlanResult {
  areas: Area[];
  /** baht a month, as the customer set it */
  budget: number;
  /** satang a year actually spent */
  usedAnnual: number;
  /** baht a year, estimated */
  taxSaved: number;
}

export interface Pricer {
  life(sum: number): number | undefined;
  health(plan: string): number | undefined;
  ci(tier: number): number | undefined;
  cancer(tier: number): number | undefined;
  pension(annual: number): { annual: number; monthlyPension: number; from: number } | undefined;
}

interface Fit<T> {
  status: "fits" | "reduced" | "short" | "unavailable";
  option?: T;
  annual?: number;
}

/** From the wanted option down: the wanted one if it fits, else the largest that does. */
function fit<T>(wanted: T[], price: (o: T) => number | undefined, left: number): Fit<T> {
  const first = price(wanted[0]);
  if (first === undefined) return { status: "unavailable" };
  if (first <= left) return { status: "fits", option: wanted[0], annual: first };
  for (const o of wanted.slice(1)) {
    const a = price(o);
    if (a !== undefined && a <= left) return { status: "reduced", option: o, annual: a };
  }
  const last = wanted[wanted.length - 1];
  return { status: "short", option: last, annual: price(last) };
}

const spends = (s: Fit<unknown>["status"]) => s === "fits" || s === "reduced";

export function healthHref(age: number, sex: Sex, plan: string): string {
  return `/ihealthy-ultra?age=${age}&sex=${sex}&plan=${plan}`;
}

export function recommend(p: PlanInput, pr: Pricer): PlanResult {
  const start = p.budget * 12 * 100;
  let left = start;
  const spent = { life: 0, health: 0, pension: 0 };

  // 1. life
  const life = lifeNeed(p);
  const lifeArea: Area = { key: "life", unit: "sum", have: life.have, should: life.need, status: "covered" };
  if (life.sumAssured > 0) {
    const wanted = LIFE_SUMS.filter((s) => s <= life.sumAssured).reverse();
    const r = fit(wanted, (s) => pr.life(s), left);
    lifeArea.status = r.status;
    if (r.option !== undefined && r.annual !== undefined) {
      lifeArea.offer = {
        product: "Life Protect x 2", href: "/lifeprotect", sum: r.option,
        cover: life.doubled ? r.option * 2 : r.option, annual: r.annual, firstYear: false,
      };
      if (spends(r.status)) { left -= r.annual; spent.life += r.annual; }
    }
  }

  // 2. health
  const health = healthNeed(p);
  const healthArea: Area = { key: "health", unit: "room", have: health.haveRoom, should: health.room, status: "covered" };
  if (!health.covered) {
    const upTo = HEALTH_TIERS.findIndex((t) => t.code === health.plan);
    const wanted = HEALTH_TIERS.slice(0, upTo + 1).reverse();
    const r = fit(wanted, (t) => pr.health(t.code), left);
    healthArea.status = r.status;
    if (r.option && r.annual !== undefined) {
      healthArea.offer = {
        product: `iHealthy Ultra แผน${r.option.name}`, href: healthHref(p.age, p.sex, r.option.code),
        sum: r.option.room, cover: r.option.room, annual: r.annual, firstYear: true,
      };
      if (spends(r.status)) { left -= r.annual; spent.health += r.annual; }
    }
  }

  // 3. critical illness, then the cancer set if CI 123 cannot fit
  const ci = ciNeed(p);
  const ciArea: Area = { key: "ci", unit: "sum", have: ci.have, should: ci.need, status: "covered" };
  if (ci.gap > 0) {
    const target = roundUpTo(CI_TIERS.map((t) => t.sum), ci.gap);
    const r = fit(CI_TIERS.filter((t) => t.sum <= target).reverse(), (t) => pr.ci(t.no), left);
    const ciOffer = (t: { sum: number }, annual: number): Offer => ({
      product: "CI 123", href: "/ci123", sum: t.sum, cover: t.sum, annual, firstYear: true,
    });
    if (spends(r.status) && r.option && r.annual !== undefined) {
      ciArea.status = r.status;
      ciArea.offer = ciOffer(r.option, r.annual);
      left -= r.annual; spent.health += r.annual;
    } else {
      const c = fit(CANCER_TIERS.slice().reverse(), (t) => pr.cancer(t.no), left);
      if (spends(c.status) && c.option && c.annual !== undefined) {
        ciArea.status = "reduced";
        ciArea.offer = {
          product: "ชุดประกันมะเร็ง", href: "/cancer", sum: c.option.sum, cover: c.option.sum,
          annual: c.annual, firstYear: true,
        };
        left -= c.annual; spent.health += c.annual;
      } else {
        ciArea.status = r.status;
        if (r.option && r.annual !== undefined) ciArea.offer = ciOffer(r.option, r.annual);
      }
    }
  }

  // 4. retirement takes what is left, to the thousand baht
  const retireArea: Area = { key: "retire", unit: "pension", have: 0, should: retireNeed(p), status: "short" };
  if (p.age > PENSION_LIMITS.ageMax) {
    retireArea.status = "unavailable";
  } else {
    const spend = Math.floor(left / 100_000) * 100_000;
    const q = spend > 0 ? pr.pension(spend) : undefined;
    if (q) {
      retireArea.status = "fits";
      retireArea.offer = {
        product: "บำนาญ สมาร์ท 95", href: "/bumnan95", sum: q.annual, cover: q.monthlyPension,
        annual: q.annual, firstYear: false, fromAge: q.from,
      };
      left -= q.annual; spent.pension += q.annual;
    }
  }

  return {
    areas: [lifeArea, healthArea, ciArea, retireArea],
    budget: p.budget,
    usedAnnual: start - left,
    taxSaved: taxSaved(p, { life: spent.life / 100, health: spent.health / 100, pension: spent.pension / 100 }),
  };
}
```

Note: the "unavailable" test uses age 66 with `cleanInput`-free input; `PENSION_LIMITS.ageMax` is 65, so it is `unavailable` regardless of the fake.

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/plan/recommend.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/recommend.ts tests/plan/recommend.test.ts
git commit -m "feat(plan): fit each area's need into the customer's budget"
```

---

### Task 3: The real pricer

**Files:** Create `src/lib/plan/pricer.ts`, `tests/plan/pricer.test.ts`

- [ ] **Step 1: Write the failing test** (real rate tables)

```ts
import { describe, expect, it } from "vitest";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { getBundle } from "@/calc/bundles/registry";
import { realPricer } from "@/lib/plan/pricer";
import { recommend } from "@/lib/plan/recommend";
import { CANCER_TIERS, CI_TIERS, HEALTH_TIERS, LIFE_DOUBLE_BEFORE_AGE } from "@/lib/plan/assumptions";

describe("assumptions match the rate tables", () => {
  it("doubles before the table's own age", () => {
    expect(lifeProtectTable().boosterBeforeAge).toBe(LIFE_DOUBLE_BEFORE_AGE);
  });
  it("lists iHealthy's plans in the table's order", () => {
    expect(iHealthyTable().plans.map((p) => p.code)).toEqual(HEALTH_TIERS.map((t) => t.code));
  });
  it("lists the CI 123 and cancer tiers the bundles hold", () => {
    const sums = (code: string, rider: string) =>
      getBundle(code)!.tiers.map((t) => ({ no: t.no, sum: t.riders.find((r) => r.code === rider)!.sumAssured }));
    expect(sums("CI123_SET", "CI123")).toEqual(CI_TIERS);
    expect(sums("CANCER_SET", "CPR")).toEqual(CANCER_TIERS);
  });
});

describe("realPricer", () => {
  const pr = realPricer(35, "M");
  it("prices Life Protect in proportion to the sum", () => {
    expect(pr.life(4_000_000)).toBe(4 * pr.life(1_000_000)!);
  });
  it("prices every area for a 35-year-old", () => {
    expect(pr.health("SILVER")).toBeGreaterThan(0);
    expect(pr.ci(2)).toBeGreaterThan(0);
    expect(pr.cancer(1)).toBeGreaterThan(0);
    expect(pr.pension(3_000_000)?.from).toBe(60);
  });
  it("refuses ages a plan does not take", () => {
    expect(realPricer(70, "M").cancer(1)).toBeUndefined();
    expect(realPricer(66, "M").pension(3_000_000)).toBeUndefined();
  });
  it("plans the owner's example with a generous budget", () => {
    const r = recommend({
      age: 35, sex: "M", income: 50_000, expense: 25_000, savings: 200_000, children: [5, 8],
      otherDependants: false, debts: 1_500_000, lifeCover: 500_000, ciCover: 0, healthNow: "public",
      healthRoom: 0, premiumsNow: 12_000, hospital: "private", budget: 30_000,
    }, pr);
    expect(r.areas[0].offer?.sum).toBe(4_000_000);
    expect(r.areas[0].status).toBe("fits");
    expect(r.usedAnnual).toBeLessThanOrEqual(30_000 * 12 * 100);
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/plan/pricer.test.ts`

- [ ] **Step 3: Write `pricer.ts`**

```ts
import type { ModePremium } from "@/calc/mode-premiums";
import { getBundle } from "@/calc/bundles/registry";
import { quoteBundle } from "@/calc/bundles/quote";
import { availablePensionAges, quotePension } from "@/calc/pension/engine";
import { IHEALTHY_OPENING } from "@/lib/ihealthy-choice";
import { baseAt, iHealthyPricing } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { lifeProtectModes, termAt } from "@/lib/lifeprotect-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { PENSION_FROM_AGE } from "./assumptions";
import type { Sex } from "./needs";
import type { Pricer } from "./recommend";

/**
 * Premiums from the rate tables, the same arrangements the sales pages and the ตัวเลขชัดๆ
 * angle quote: Life Protect x 2 paying to 99; the Health Ultra Package (WLF99HX at its fixed
 * sum, Thailand, full coverage); the CI 123 and cancer sets; บำนาญ สมาร์ท 95 paid until it
 * starts. Satang a year; undefined where the plan will not take this person.
 */

const LIFE_TERM = "WLF99H";
const HEALTH_BASE = "WLF99HX";

const annualOf = (modes: ModePremium[] | undefined) => modes?.find((m) => m.mode === "annual")?.total;

function bundleAnnual(code: string, tier: number, age: number, sex: Sex, today: Date): number | undefined {
  const bundle = getBundle(code);
  if (!bundle) return undefined;
  const q = quoteBundle(bundle, tier, { age, sex, mode: "annual" }, today);
  return q && q.totalAnnual && !q.meta.expired ? q.totalAnnual : undefined;
}

export function realPricer(age: number, sex: Sex, today: Date = new Date()): Pricer {
  const lp = lifeProtectTable(today);
  const ih = iHealthyTable(today);
  return {
    life(sum) {
      if (lp.expired || age < lp.ageMin || age > lp.ageMax) return undefined;
      return annualOf(lifeProtectModes(lp, termAt(lp, LIFE_TERM), { sex, age, sumAssured: sum }));
    },
    health(plan) {
      if (ih.expired || age < ih.ageMin || age > ih.ageMax) return undefined;
      const base = baseAt(ih, HEALTH_BASE);
      const priced = iHealthyPricing(ih, {
        base: HEALTH_BASE, sex, age, sumAssured: base.fixedSum ?? base.saMin, plan,
        territory: IHEALTHY_OPENING.territory, coverage: IHEALTHY_OPENING.coverage,
      });
      return annualOf(priced?.total);
    },
    ci: (tier) => bundleAnnual("CI123_SET", tier, age, sex, today),
    cancer: (tier) => bundleAnnual("CANCER_SET", tier, age, sex, today),
    pension(annual) {
      const ages = availablePensionAges(age, "untilAnnuity");
      const from = ages.find((a) => a >= PENSION_FROM_AGE) ?? ages[ages.length - 1];
      if (from === undefined) return undefined;
      const q = quotePension({
        age, sex, annuityAge: from, pay: "untilAnnuity", mode: "annual", basis: "premium", amount: annual / 100,
      });
      return q.ok ? { annual: Math.round(q.quote.annualPremium * 100), monthlyPension: q.quote.monthlyPension, from } : undefined;
    },
  };
}
```

If `lp.ageMax` / `ih.ageMin` are named differently on those table types, read `src/lib/lifeprotect-table.ts:83` and `src/lib/ihealthy-table.ts:68` and use the real field names (IHealthyTable has `ageMin`/`ageMax`).

- [ ] **Step 4: Run — expect PASS.** If "refuses ages" fails because `quoteBundle` returns a non-zero total for an unsold age, guard with `bundleAgeRange(bundle)` from `@/calc/bundles/quote`.

Run: `npx vitest run tests/plan/pricer.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/pricer.ts tests/plan/pricer.test.ts
git commit -m "feat(plan): price the planner's picks from the rate tables"
```

---

### Task 4: Planner prose (`prose.ts`)

**Files:** Create `src/lib/plan/prose.ts`, `tests/plan/prose.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ai/client")>()),
  chat: vi.fn(),
}));

import { chat } from "@/lib/ai/client";
import { explain, FALLBACK_PROSE, parseProse, planBrief } from "@/lib/plan/prose";
import type { PlanInput } from "@/lib/plan/needs";
import type { PlanResult } from "@/lib/plan/recommend";

const P: PlanInput = {
  age: 35, sex: "M", income: 50_000, expense: 25_000, savings: 0, children: [5], otherDependants: false,
  debts: 0, lifeCover: 0, ciCover: 0, healthNow: "none", healthRoom: 0, premiumsNow: 0, hospital: "private", budget: 4_000,
};
const R: PlanResult = {
  budget: 4_000, usedAnnual: 0, taxSaved: 0,
  areas: [
    { key: "life", unit: "sum", have: 0, should: 1, status: "fits" },
    { key: "health", unit: "room", have: 0, should: 1, status: "short" },
    { key: "ci", unit: "sum", have: 0, should: 1, status: "covered" },
    { key: "retire", unit: "pension", have: 0, should: 1, status: "unavailable" },
  ],
};

describe("parseProse", () => {
  it("keeps clean fields and replaces a field with a digit", () => {
    const p = parseProse(JSON.stringify({ intro: "สวัสดีครับ", life: "ทุน 4 ล้าน", health: "ดีครับ", ci: "ดี", retire: "ดี" }));
    expect(p.intro).toBe("สวัสดีครับ");
    expect(p.life).toBe(FALLBACK_PROSE.life);
    expect(p.health).toBe("ดีครับ");
  });
  it("falls back entirely on junk", () => {
    expect(parseProse("not json")).toEqual(FALLBACK_PROSE);
  });
});

describe("explain", () => {
  it("falls back when the model fails", async () => {
    vi.mocked(chat).mockRejectedValueOnce(new Error("down"));
    expect(await explain(P, R)).toEqual(FALLBACK_PROSE);
  });
  it("asks the small model once, as JSON", async () => {
    vi.mocked(chat).mockResolvedValueOnce({ text: JSON.stringify({ intro: "ก", life: "ข", health: "ค", ci: "ง", retire: "จ" }) } as never);
    const p = await explain(P, R);
    expect(p.retire).toBe("จ");
    expect(vi.mocked(chat).mock.calls.at(-1)![0]).toMatchObject({ tier: "small", task: "plan-advice", json: true });
  });
});

describe("planBrief", () => {
  it("says each area's status in words", () => {
    const b = planBrief(P, R);
    expect(b).toContain("มีพอแล้ว");
    expect(b).toContain("อายุเกินเกณฑ์");
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

Run: `npx vitest run tests/plan/prose.test.ts`

- [ ] **Step 3: Write `prose.ts`**

```ts
import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { HOSPITAL_LABEL } from "./assumptions";
import type { PlanInput } from "./needs";
import type { AreaKey, PlanResult, Status } from "./recommend";

/**
 * The planner's words. The page lays down every figure; the model writes only why each area
 * matters to this person, and may carry no digit — a field that does is replaced by a fixed
 * sentence, the rule the ตัวเลขชัดๆ angle keeps (content/numbers.ts).
 */

export type ProseKey = "intro" | AreaKey;
export type Prose = Record<ProseKey, string>;

const KEYS: ProseKey[] = ["intro", "life", "health", "ci", "retire"];
const DIGIT = /[0-9๐-๙]/;
const MAX_CHARS = 600;

export const FALLBACK_PROSE: Prose = {
  intro: "แผนนี้เริ่มจากสิ่งที่ครอบครัวของคุณต้องใช้จริง แล้วค่อยเลือกแบบประกันให้พอดีกับงบที่คุณตั้งไว้",
  life: "ถ้าวันหนึ่งคุณไม่อยู่ รายได้ของคุณหายไปทันที แต่หนี้และค่าใช้จ่ายของครอบครัวยังเดินต่อ ทุนประกันชีวิตคือเงินที่มาทำหน้าที่แทนคุณ",
  health: "ค่ารักษาในโรงพยาบาลเอกชนสูงขึ้นทุกปี ประกันสุขภาพช่วยให้คุณเลือกโรงพยาบาลได้ โดยไม่ต้องดึงเงินออมมาจ่าย",
  ci: "โรคร้ายแรงไม่ได้มีแค่ค่ารักษา แต่ยังทำให้ต้องหยุดงานนาน เงินก้อนจากประกันโรคร้ายแรงช่วยให้ครอบครัวมีรายได้ระหว่างรักษาตัว",
  retire: "เงินบำนาญคือรายได้ที่ยังเข้ามาทุกเดือนหลังเกษียณ และเบี้ยที่จ่ายยังนำไปลดหย่อนภาษีได้ตามเงื่อนไขสรรพากร",
};

const STATUS_WORD: Record<Status, string> = {
  fits: "เสนอเต็มตามที่ควรมี",
  reduced: "งบไม่พอ เสนอน้อยกว่าที่ควรมี",
  short: "งบที่เหลือไม่พอสำหรับด้านนี้",
  covered: "มีพอแล้ว ไม่ต้องเพิ่ม",
  unavailable: "อายุเกินเกณฑ์ของแบบที่มี",
};

const AREA_WORD: Record<AreaKey, string> = {
  life: "ครอบครัวถ้าลูกค้าเสียชีวิต",
  health: "ค่ารักษาพยาบาล",
  ci: "โรคร้ายแรง/มะเร็ง",
  retire: "เกษียณและภาษี",
};

const HEALTH_NOW_WORD: Record<PlanInput["healthNow"], string> = {
  none: "ไม่มีสิทธิ์ค่ารักษา",
  public: "ใช้ประกันสังคมหรือบัตรทอง",
  employer: "มีสวัสดิการบริษัท (หมดเมื่อออกจากงาน)",
  private: "มีประกันสุขภาพส่วนตัว",
};

/** The facts, for the model only; figures may appear here but must not come back. */
export function planBrief(p: PlanInput, r: PlanResult): string {
  const kids = p.children.length ? `ลูก ${p.children.length} คน อายุ ${p.children.join(", ")} ปี` : "ไม่มีลูก";
  const lines = [
    `ลูกค้า: ${p.sex === "F" ? "หญิง" : "ชาย"} อายุ ${p.age} ปี เงินเดือน ${p.income} บาท ค่าใช้จ่ายครอบครัว ${p.expense} บาท/เดือน`,
    `${kids}; ${p.otherDependants ? "มีพ่อแม่/คู่สมรสที่ต้องดูแล" : "ไม่มีคนอื่นที่ต้องดูแล"}; หนี้ ${p.debts} บาท; เงินออม ${p.savings} บาท`,
    `ค่ารักษา: ${HEALTH_NOW_WORD[p.healthNow]}; อยากใช้${HOSPITAL_LABEL[p.hospital]}`,
    ...r.areas.map((a) => `ด้าน${AREA_WORD[a.key]}: ${STATUS_WORD[a.status]}${a.offer ? ` (${a.offer.product})` : ""}`),
  ];
  return lines.join("\n");
}

export function proseMessages(p: PlanInput, r: PlanResult): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "คุณคือนักวางแผนการเงินที่อบอุ่นและตรงไปตรงมา เขียนภาษาไทยคุยกับลูกค้าโดยตรง ใช้คำว่า \"คุณ\"",
        "ตอบเป็น JSON เท่านั้น: {\"intro\":\"...\",\"life\":\"...\",\"health\":\"...\",\"ci\":\"...\",\"retire\":\"...\"}",
        "แต่ละช่อง 2–3 ประโยค อธิบายว่าด้านนั้นสำคัญกับชีวิตของลูกค้าคนนี้อย่างไร",
        "ห้ามมีตัวเลข จำนวนเงิน อายุ หรือเปอร์เซ็นต์ใดๆ เด็ดขาด หน้าเว็บแสดงตัวเลขเอง",
        "ห้ามพูดถึงผลประโยชน์ที่ไม่มีในข้อมูล ห้ามรับประกันผลตอบแทน ห้ามกดดันให้ซื้อ",
        "ด้านที่มีพอแล้ว ให้ชมว่าเตรียมไว้ดี ด้านที่งบไม่พอ ให้อธิบายอย่างให้กำลังใจว่าเริ่มจากเท่าที่ทำได้ก่อน",
        "ด้านที่อายุเกินเกณฑ์ ให้บอกสั้นๆ ว่าแบบที่มีรับไม่ได้ และแนะนำให้ปรึกษาตัวแทน",
      ].join("\n"),
    },
    { role: "user", content: planBrief(p, r) },
  ];
}

export function parseProse(reply: string): Prose {
  const got = parseJsonReply<Partial<Record<ProseKey, unknown>>>(reply) ?? {};
  const out = { ...FALLBACK_PROSE };
  for (const k of KEYS) {
    const v = got[k];
    if (typeof v === "string" && v.trim() && !DIGIT.test(v) && v.length <= MAX_CHARS) out[k] = v.trim();
  }
  return out;
}

export async function explain(p: PlanInput, r: PlanResult): Promise<Prose> {
  try {
    const res = await chat({ tier: "small", task: "plan-advice", messages: proseMessages(p, r), maxTokens: 1200, json: true });
    return parseProse(res.text);
  } catch {
    return FALLBACK_PROSE;
  }
}
```

- [ ] **Step 4: Run — expect PASS**

Run: `npx vitest run tests/plan/prose.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/plan/prose.ts tests/plan/prose.test.ts
git commit -m "feat(plan): planner prose from the small model, digit-free"
```

---

### Task 5: Storage table and server actions

**Files:** Create `supabase/migrations/20260925_plan_runs.sql`, `src/app/plan/actions.ts`

- [ ] **Step 1: Write the migration**

```sql
-- /plan: every plan a customer builds, kept anonymously so the owner can see use.
--
-- No name, no phone, no IP — only the figures typed and the plan shown. Rows older than
-- thirty days are deleted by the page itself on each insert (src/app/plan/actions.ts), the
-- privacy page's promise for everything else. Server-only, like every ins_* table.

create table if not exists public.ins_plan_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  input jsonb not null,
  result jsonb not null
);

alter table public.ins_plan_runs enable row level security;
revoke all on public.ins_plan_runs from anon, authenticated;

create index if not exists ins_plan_runs_created_idx on public.ins_plan_runs (created_at desc);

comment on table public.ins_plan_runs is
  'Plans built on /plan: input = what the customer typed, result = PlanResult shown. Anonymous; kept 30 days.';
```

- [ ] **Step 2: Apply it** with the Supabase MCP `apply_migration` on project `tmbbxahyxwkshxuxphcb`, name `plan_runs`, the SQL above. Then confirm with `execute_sql`: `select count(*) from public.ins_plan_runs;` → `0`.

- [ ] **Step 3: Write `src/app/plan/actions.ts`**

```ts
"use server";
import { headers } from "next/headers";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { cleanInput, type PlanInput } from "@/lib/plan/needs";
import { explain, FALLBACK_PROSE, type Prose } from "@/lib/plan/prose";
import { realPricer } from "@/lib/plan/pricer";
import { recommend, type PlanResult } from "@/lib/plan/recommend";
import { serviceKeyIsConfigured, supabaseAdmin } from "@/lib/supabase/admin";

/**
 * The page's two calls. Figures first, at once; the planner's words after, so a slow or
 * failed model never holds up the numbers. Both recompute from the form rather than trust a
 * result sent back from the browser.
 */

const allowBuild = limiter(20, 60_000);
const allowExplain = limiter(6, 60_000);
const KEEP_MS = 30 * 24 * 60 * 60 * 1000;

export type BuildReply = { ok: true; result: PlanResult } | { ok: false; error: string };

export async function buildPlan(raw: unknown): Promise<BuildReply> {
  const p = cleanInput(raw);
  if (typeof p === "string") return { ok: false, error: p };
  if (!allowBuild(clientIp(await headers()))) return { ok: false, error: "กดถี่เกินไป รอสักครู่แล้วลองใหม่นะครับ" };
  const result = recommend(p, realPricer(p.age, p.sex));
  await keep(p, result);
  return { ok: true, result };
}

export async function explainPlan(raw: unknown): Promise<Prose> {
  const p = cleanInput(raw);
  if (typeof p === "string") return FALLBACK_PROSE;
  if (!allowExplain(clientIp(await headers()))) return FALLBACK_PROSE;
  return explain(p, recommend(p, realPricer(p.age, p.sex)));
}

/** a plan is shown whether or not the log can be written */
async function keep(input: PlanInput, result: PlanResult): Promise<void> {
  if (!serviceKeyIsConfigured()) return;
  try {
    const db = supabaseAdmin();
    await db.from("ins_plan_runs").insert({ input, result });
    await db.from("ins_plan_runs").delete().lt("created_at", new Date(Date.now() - KEEP_MS).toISOString());
  } catch {
    // nothing to tell the customer
  }
}
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "src/(app/plan|lib/plan)" ; echo done`
Expected: only `done` (no errors in these paths).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260925_plan_runs.sql src/app/plan/actions.ts
git commit -m "feat(plan): server actions and the anonymous run log"
```

---

### Task 6: The page

**Files:** Create `src/app/plan/layout.tsx`, `src/app/plan/page.tsx`, `src/app/plan/Planner.tsx`, `src/app/plan/PlanView.tsx`

- [ ] **Step 1: `layout.tsx`**

```tsx
import { SalesTheme } from "@/components/sales/SalesTheme";

export default function PlanLayout({ children }: { children: React.ReactNode }) {
  return <SalesTheme>{children}</SalesTheme>;
}
```

- [ ] **Step 2: `page.tsx`**

```tsx
import { Planner } from "./Planner";

export const metadata = {
  title: "วางแผนประกันด้วยตัวเอง — ครอบครัวคุณยังขาดความคุ้มครองตรงไหน",
  description:
    "กรอกรายได้ รายจ่าย ลูก หนี้ และประกันที่มีอยู่ ดูทันทีว่ายังขาดความคุ้มครองด้านไหน พร้อมแบบประกันและเบี้ยจริงที่พอดีกับงบของคุณ ไม่ต้องให้เบอร์โทร",
};

export default function PlanPage() {
  return (
    <main className="mx-auto max-w-lg px-4 pb-28 sm:max-w-2xl sm:pb-10">
      <header className="pb-6 pt-8">
        <p className="text-sm text-[var(--lg-mute)]">วางแผนประกันด้วยตัวเอง</p>
        <h1 className="lg-figure mt-2 text-3xl leading-tight text-[var(--lg-white)]">
          ครอบครัวของคุณ<br />ยังขาดความคุ้มครองตรงไหน
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-[var(--lg-mute)]">
          กรอกตัวเลขคร่าวๆ ก็พอ ระบบคิดให้ว่าแต่ละด้านควรมีเท่าไหร่ ขาดเท่าไหร่ และแบบไหนพอดีกับงบของคุณ
          ไม่ต้องให้เบอร์โทร
        </p>
      </header>
      <Planner />
    </main>
  );
}
```

- [ ] **Step 3: `Planner.tsx`** (client: form, calls, hands the result to PlanView)

```tsx
"use client";
import { useState, useTransition } from "react";
import { MoneyInput } from "@/components/MoneyInput";
import { HOSPITAL_LABEL, PLANNER_AGE, type Hospital } from "@/lib/plan/assumptions";
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
  const [budget, setBudget] = useState<Money>("");
  const [budgetTouched, setBudgetTouched] = useState(false);

  const [result, setResult] = useState<PlanResult | null>(null);
  const [prose, setProse] = useState<Prose | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const n = (v: Money) => (v === "" ? 0 : v);
  const shownBudget = budgetTouched ? budget : defaultBudget(n(income), n(premiumsNow)) || "";

  function submit() {
    const form = {
      age: n(age), sex, income: n(income), expense: n(expense), savings: n(savings),
      children: children.filter((c) => c !== ""), otherDependants, debts: n(debts), lifeCover: n(lifeCover),
      ciCover: n(ciCover), healthNow, healthRoom: n(healthRoom), premiumsNow: n(premiumsNow), hospital,
      budget: n(shownBudget),
    };
    setError("");
    setProse(null);
    start(async () => {
      const reply = await buildPlan(form);
      if (!reply.ok) { setError(reply.error); return; }
      setResult(reply.result);
      requestAnimationFrame(() => document.getElementById("plan-result")?.scrollIntoView({ behavior: "smooth" }));
      setProse(await explainPlan(form));
    });
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

      {result && <div id="plan-result" className="scroll-mt-4"><PlanView result={result} prose={prose} /></div>}
    </div>
  );
}
```

- [ ] **Step 4: `PlanView.tsx`**

```tsx
import Link from "next/link";
import { Highlighted } from "@/components/Highlighted";
import { formatBaht } from "@/calc/money";
import { INSURER } from "@/lib/insurer";
import type { Prose } from "@/lib/plan/prose";
import type { Area, AreaKey, PlanResult } from "@/lib/plan/recommend";

const TITLE: Record<AreaKey, string> = {
  life: "ถ้าคุณจากไปกะทันหัน",
  health: "ค่ารักษาพยาบาล",
  ci: "โรคร้ายแรงและมะเร็ง",
  retire: "เกษียณและลดหย่อนภาษี",
};
const UNIT: Record<Area["unit"], string> = { sum: "บาท", room: "บาท/วัน", pension: "บาท/เดือน" };
const baht = (n: number) => Math.round(n).toLocaleString("en-US");

function Bar({ area }: { area: Area }) {
  const gives = area.status === "fits" || area.status === "reduced" ? area.offer?.cover ?? 0 : 0;
  const top = Math.max(area.should, area.have + gives, 1);
  const pct = (x: number) => `${Math.min(100, (x / top) * 100)}%`;
  return (
    <div className="space-y-2">
      <div className="relative h-3 overflow-hidden rounded-sm bg-[var(--lg-raise)]">
        <div className="absolute inset-y-0 left-0 bg-[var(--lg-mute)]" style={{ width: pct(area.have) }} />
        <div className="absolute inset-y-0 bg-[var(--lg-gold)]" style={{ left: pct(area.have), width: pct(gives) }} />
        <div className="absolute inset-y-0 w-0.5 bg-[var(--lg-white)]" style={{ left: pct(area.should) }} />
      </div>
      <dl className="grid grid-cols-3 gap-2 text-xs text-[var(--lg-mute)]">
        <div><dt>มีอยู่</dt><dd className="lg-figure text-sm tabular-nums text-[var(--lg-white)]">{baht(area.have)}</dd></div>
        <div><dt>แผนนี้เพิ่ม</dt><dd className="lg-figure text-sm tabular-nums text-[var(--lg-gold)]">{baht(gives)}</dd></div>
        <div><dt>ควรมี</dt><dd className="lg-figure text-sm tabular-nums text-[var(--lg-white)]">{baht(area.should)}</dd></div>
      </dl>
      <p className="text-xs text-[var(--lg-mute)]">หน่วย: {UNIT[area.unit]}</p>
    </div>
  );
}

function statusLine(a: Area): string {
  switch (a.status) {
    case "covered": return "ที่มีอยู่พอแล้ว ด้านนี้ไม่ต้องเพิ่ม";
    case "fits": return "แผนนี้ปิดช่องว่างได้ครบ";
    case "reduced": return "งบนี้ทำได้เท่านี้ก่อน ถ้าเพิ่มงบจะเข้าใกล้ที่ควรมี";
    case "short": return a.offer ? "งบที่เหลือยังไม่พอ แบบเล็กที่สุดของด้านนี้ราคาตามนี้" : "งบหมดที่ด้านก่อนหน้าแล้ว";
    case "unavailable": return "อายุนี้แบบที่เรามีรับไม่ได้ ปรึกษาตัวแทนเพื่อหาทางเลือกอื่น";
  }
}

function coverText(a: Area): string {
  const o = a.offer!;
  if (a.key === "life") return o.cover > o.sum ? `ทุน ${baht(o.sum)} บาท คุ้มครอง ${baht(o.cover)} บาท ก่อนอายุ 60` : `ทุน ${baht(o.sum)} บาท`;
  if (a.key === "health") return `ค่าห้อง ${baht(o.cover)} บาท/วัน`;
  if (a.key === "retire") return `บำนาญเดือนละ ${baht(o.cover)} บาท ตั้งแต่อายุ ${o.fromAge}`;
  return `ทุน ${baht(o.sum)} บาท`;
}

function AreaCard({ area, prose }: { area: Area; prose: string | null }) {
  const o = area.offer;
  return (
    <section className="space-y-4 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5">
      <h3 className="text-lg font-medium text-[var(--lg-white)]">{TITLE[area.key]}</h3>
      <Bar area={area} />
      <p className="text-sm text-[var(--lg-white)]">{statusLine(area)}</p>
      {o && (
        <div className="space-y-1.5 rounded-sm border border-[var(--lg-panel-line)] bg-[var(--lg-raise)] p-4">
          <div className="text-sm font-medium text-[var(--lg-white)]">{o.product}</div>
          <div className="text-sm text-[var(--lg-mute)]">{coverText(area)}</div>
          <div className="text-sm text-[var(--lg-white)]">
            {o.firstYear ? "เบี้ยปีแรก " : "เบี้ย "}
            <Highlighted>{formatBaht(o.annual)}</Highlighted> บาท/ปี
            <span className="text-[var(--lg-mute)]"> (เฉลี่ยเดือนละ {formatBaht(Math.round(o.annual / 12))} บาท)</span>
          </div>
          <Link href={o.href} className="inline-block pt-1 text-sm text-[var(--lg-gold)] underline underline-offset-4">
            ดูรายละเอียดแบบนี้ →
          </Link>
        </div>
      )}
      <p className="text-sm leading-relaxed text-[var(--lg-mute)]">{prose ?? "กำลังเขียนคำแนะนำ…"}</p>
    </section>
  );
}

export function PlanView({ result, prose }: { result: PlanResult; prose: Prose | null }) {
  const used = Math.round(result.usedAnnual / 12);
  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-sm border border-[var(--lg-gold)] bg-[var(--lg-panel)] p-5">
        <h2 className="text-xl font-medium text-[var(--lg-white)]">แผนของคุณ</h2>
        <p className="text-sm leading-relaxed text-[var(--lg-mute)]">{prose?.intro ?? "กำลังเขียนคำแนะนำ…"}</p>
        <dl className="grid grid-cols-3 gap-2 text-xs text-[var(--lg-mute)]">
          <div><dt>งบต่อเดือน</dt><dd className="lg-figure text-base tabular-nums text-[var(--lg-white)]">{baht(result.budget)}</dd></div>
          <div><dt>แผนนี้ใช้ (เฉลี่ย/เดือน)</dt><dd className="lg-figure text-base tabular-nums text-[var(--lg-gold)]">{formatBaht(used)}</dd></div>
          <div><dt>ประหยัดภาษีราว (บาท/ปี)</dt><dd className="lg-figure text-base tabular-nums text-[var(--lg-white)]">{baht(result.taxSaved)}</dd></div>
        </dl>
      </section>
      {result.areas.map((a) => <AreaCard key={a.key} area={a} prose={prose ? prose[a.key] : null} />)}
      <p className="text-xs leading-relaxed text-[var(--lg-mute)]">
        ตัวเลขเป็นการประมาณเบื้องต้นจากข้อมูลที่กรอก ไม่ใช่ข้อเสนอขาย เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท
        ภาษีที่ประหยัดได้เป็นการประมาณจากเงินเดือนอย่างเดียว · รับประกันโดย {INSURER}
      </p>
    </div>
  );
}
```

`INSURER` is `"บมจ. กรุงไทย-แอกซ่า ประกันชีวิต"` (`src/lib/insurer.ts:7`).

- [ ] **Step 5: Type-check the new files**

Run: `npx tsc --noEmit -p . 2>&1 | grep -E "src/(app/plan|lib/plan)" ; echo done` → only `done`.

- [ ] **Step 6: Commit**

```bash
git add src/app/plan/layout.tsx src/app/plan/page.tsx src/app/plan/Planner.tsx src/app/plan/PlanView.tsx
git commit -m "feat(plan): the /plan page — form, plan cards, planner words"
```

---

### Task 7: Menu entry

**Files:** Modify `src/lib/shell/menu.ts` (`SALES_SECTIONS`, line ~119), `tests/calc/shell-menu.test.ts:32-35`

- [ ] **Step 1: Update the test's on-disk list** — add `"plan"`:

```ts
    const onDisk = [
      "lifeprotect", "legacy", "plb", "easyprotect", "lifetreasure", "ishield", "ihealthy-ultra",
      "group-insurance", "bumnan95", "ci123", "cancer", "plan",
    ];
```

- [ ] **Step 2: Run — expect FAIL** (`/plan` missing from `SALES_PAGES`)

Run: `npx vitest run tests/calc/shell-menu.test.ts`

- [ ] **Step 3: Add the section first in `SALES_SECTIONS`** (label must be English — the menu test forbids Thai labels; the heading stays Thai):

```ts
export const SALES_SECTIONS: { title: string; links: MenuLink[] }[] = [
  {
    // the customer's own planner: which of the plans below, and how much, from their own figures
    title: "วางแผนประกัน",
    links: [
      { href: "/plan", label: "Insurance Planner", icon: "calc", hue: "#3a2b73" },
    ],
  },
  {
    title: "ประกันชีวิต",
```

- [ ] **Step 4: Run menu and palette tests — expect PASS**

Run: `npx vitest run tests/calc/shell-menu.test.ts tests/calc/palette.test.ts`

- [ ] **Step 5: Commit**

```bash
git add src/lib/shell/menu.ts tests/calc/shell-menu.test.ts
git commit -m "feat(plan): /plan in the menu"
```

---

### Task 8: Owner's view on /admin/crm

**Files:** Create `src/app/admin/crm/PlanRuns.tsx`; modify `src/app/admin/crm/page.tsx` (after `<Charts … />`, inside the `summary &&` fragment or just below it)

- [ ] **Step 1: Write `PlanRuns.tsx`**

```tsx
import { formatBaht } from "@/calc/money";
import type { PlanInput } from "@/lib/plan/needs";
import type { PlanResult } from "@/lib/plan/recommend";
import { supabaseAdmin } from "@/lib/supabase/admin";

const DAY = 24 * 60 * 60 * 1000;
const AREA: Record<string, string> = { life: "ชีวิต", health: "สุขภาพ", ci: "โรคร้าย", retire: "บำนาญ" };

/** Plans customers built on /plan in the last thirty days: how many, and the latest twenty. */
export async function PlanRuns() {
  const { data, error } = await supabaseAdmin()
    .from("ins_plan_runs")
    .select("created_at,input,result")
    .gte("created_at", new Date(Date.now() - 30 * DAY).toISOString())
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) return <p className="text-sm text-[var(--bot-ink-mute)]">อ่านข้อมูลการวางแผนไม่ได้: {error.message}</p>;
  const rows = (data ?? []) as { created_at: string; input: PlanInput; result: PlanResult }[];
  const week = rows.filter((r) => Date.parse(r.created_at) > Date.now() - 7 * DAY).length;
  return (
    <section className="space-y-3 rounded-lg border border-[var(--bot-line)] bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--bot-ink)]">ลูกค้าวางแผนเอง (/plan)</h2>
        <p className="text-sm text-[var(--bot-ink-mute)]">7 วัน {week} ครั้ง · 30 วัน {rows.length} ครั้ง</p>
      </div>
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-[var(--bot-ink-mute)]">
              <tr><th className="py-1.5 pr-3">เวลา</th><th className="pr-3">อายุ</th><th className="pr-3">เงินเดือน</th><th className="pr-3">ที่เสนอ</th><th>เบี้ยรวม/ปี</th></tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r) => (
                <tr key={r.created_at} className="border-t border-[var(--bot-line)] text-[var(--bot-ink)]">
                  <td className="whitespace-nowrap py-1.5 pr-3">
                    {new Date(r.created_at).toLocaleString("th-TH", { timeZone: "Asia/Bangkok", dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td className="pr-3 tabular-nums">{r.input.age}</td>
                  <td className="pr-3 tabular-nums">{r.input.income.toLocaleString("en-US")}</td>
                  <td className="pr-3">
                    {r.result.areas.filter((a) => a.status === "fits" || a.status === "reduced").map((a) => AREA[a.key]).join(" · ") || "—"}
                  </td>
                  <td className="tabular-nums">{formatBaht(r.result.usedAnnual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Render it in `page.tsx`** — import `import { PlanRuns } from "./PlanRuns";` and add `<PlanRuns />` on the line after the `summary && (<>…</>)` block closes (before the tabs `<div>`).

- [ ] **Step 3: Type-check** — `npx tsc --noEmit -p . 2>&1 | grep -E "admin/crm/(PlanRuns|page)" ; echo done` → only `done`.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/crm/PlanRuns.tsx src/app/admin/crm/page.tsx
git commit -m "feat(plan): plans built by customers on /admin/crm"
```

(`page.tsx` may carry other sessions' uncommitted edits — check `git diff src/app/admin/crm/page.tsx` first; if it has hunks that are not ours, stage only ours with `git add -p` is unavailable, so instead commit PlanRuns.tsx alone and report the page edit to the owner.)

---

### Task 9: Verify in the browser, full check, deploy

- [ ] **Step 1: Full test run of our files** — `npx vitest run tests/plan tests/calc/shell-menu.test.ts tests/calc/palette.test.ts` → all PASS.
- [ ] **Step 2: Start the dev server** with `preview_start` name `dev`, open `/plan`.
- [ ] **Step 3: Fill the owner's example** (35 ชาย, 50,000 / 25,000, ลูก 5 และ 8, หนี้ 1,500,000, ทุนชีวิต 500,000, เงินออม 200,000, เบี้ย 12,000/ปี, เอกชนทั่วไป), press วางแผนให้ฉัน. Check: budget pre-fills 4,000; life card shows ควรมี 8,110,000 and a Life Protect offer; prose arrives with no digits; no console errors; every "ดูรายละเอียด" link opens its page (iHealthy opens on the right plan and age).
- [ ] **Step 4: Phone width** — `resize_window` mobile; no horizontal scroll; screenshot for the owner.
- [ ] **Step 5: `/admin/crm`** shows the run just made.
- [ ] **Step 6: Checkpoint with the owner** — screenshot + summary; ask before pushing.
- [ ] **Step 7: On approval:** `npm run verify && git push origin main`. If verify fails on files other sessions left uncommitted, report which files and do not push.
