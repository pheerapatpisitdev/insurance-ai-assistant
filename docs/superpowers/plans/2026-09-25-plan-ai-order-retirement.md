# /plan AI order + retirement questions — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The AI orders the four areas per customer and writes a digit-free summary on the card; the form asks four retirement questions that set the retirement need.

**Architecture:** A new `src/lib/plan/order.ts` asks the small model for `{order, summary}` and validates it, falling back to the fixed order. `recommend()` walks the areas in that order with a shared purse; retirement aims at its gap when not last and keeps today's "whatever is left" rule when last. `needs.ts` grows the retirement inputs and a `{should, have, gap}` retirement need.

**Tech Stack:** Next.js 15 server actions, TypeScript, Vitest; `chat()` from `src/lib/ai/client.ts`; pension engine `quotePension` (`basis: "premium" | "monthlyPension"`).

Spec: `docs/superpowers/specs/2026-09-25-plan-ai-order-retirement-design.md`.

Test fixtures that build a `PlanInput` literal (tests/plan/needs, recommend, pricer, prose) all gain
`retireAge: 60, retireMonthly: 17_500, pensionHave: 0, retireLump: 0` in Task 1.

---

### Task 1: Retirement inputs and need (needs.ts, assumptions.ts)

**Files:** Modify `src/lib/plan/assumptions.ts`, `src/lib/plan/needs.ts`; Test `tests/plan/needs.test.ts`

- [ ] **Step 1: Failing tests** in `tests/plan/needs.test.ts` (and add the four fields to every `PlanInput` fixture in tests/plan):

```ts
describe("retirement", () => {
  it("counts the expected pension and the lump sum spread to 85", () => {
    // 1,500,000 over (85 - 60) × 12 = 5,000 a month
    const n = retireNeed({ ...OWNER, retireMonthly: 20_000, pensionHave: 3_000, retireLump: 1_500_000 });
    expect(n).toEqual({ should: 20_000, have: 8_000, gap: 12_000 });
  });
  it("has no gap when what is there covers it", () => {
    expect(retireNeed({ ...OWNER, retireMonthly: 10_000, pensionHave: 12_000 }).gap).toBe(0);
  });
  it("cleanInput defaults the four answers", () => {
    const p = cleanInput({ age: 35, income: 50_000, expense: 25_000 }) as PlanInput;
    expect([p.retireAge, p.retireMonthly, p.pensionHave, p.retireLump]).toEqual([60, 17_500, 0, 0]);
    expect((cleanInput({ age: 35, income: 1, retireAge: 57 }) as PlanInput).retireAge).toBe(60);
    expect((cleanInput({ age: 35, income: 1, retireAge: 55, retireMonthly: 30_000 }) as PlanInput).retireMonthly).toBe(30_000);
  });
});
```
Replace the old `expect(retireNeed(OWNER)).toBe(17_500)` with `expect(retireNeed(OWNER).should).toBe(17_500)`.

- [ ] **Step 2:** `npx vitest run tests/plan/needs.test.ts` → FAIL (fields missing).

- [ ] **Step 3: Implement.** assumptions.ts:

```ts
/** อายุเกษียณที่ให้เลือก = อายุเริ่มรับบำนาญ สมาร์ท 95 ที่มี */
export const RETIRE_AGES = [55, 60, 65] as const;
export type RetireAge = (typeof RETIRE_AGES)[number];
/** เงินก้อนเพื่อเกษียณ หารให้พอใช้ถึงอายุนี้ ไม่คิดดอกผล */
export const LUMP_LASTS_TO_AGE = 85;
/** บำนาญที่ไม่ได้อยู่ท้ายลำดับ: ลดทีละเท่านี้ (บาท/เดือน) จนเบี้ยพอดีงบ */
export const PENSION_STEP = 1_000;
```
and type the existing default: `export const PENSION_FROM_AGE: RetireAge = 60;`

needs.ts: `PlanInput` gains `retireAge: RetireAge; retireMonthly: number; pensionHave: number; retireLump: number;`. `cleanInput` computes `const expense = money(r.expense)` once and adds

```ts
    retireAge: RETIRE_AGES.find((a) => a === Number(r.retireAge)) ?? PENSION_FROM_AGE,
    retireMonthly: money(r.retireMonthly) || defaultRetireMonthly(expense),
    pensionHave: money(r.pensionHave),
    retireLump: money(r.retireLump),
```
Replace `retireNeed`:

```ts
/** baht a month, the 70% rule to the hundred — the retirement field's starting value */
export function defaultRetireMonthly(expense: number): number {
  return Math.round((expense * RETIRE_SHARE_OF_EXPENSE) / 100) * 100;
}

/** baht a month: what the customer wants after work, what is already coming, and the gap */
export function retireNeed(p: PlanInput): { should: number; have: number; gap: number } {
  const months = Math.max(1, LUMP_LASTS_TO_AGE - p.retireAge) * 12;
  const have = p.pensionHave + Math.round(p.retireLump / months / 100) * 100;
  return { should: p.retireMonthly, have, gap: Math.max(0, p.retireMonthly - have) };
}
```

- [ ] **Step 4:** `npx vitest run tests/plan/needs.test.ts` → PASS.

### Task 2: Pension priced by start age and by premium or monthly pension (pricer.ts)

**Files:** Modify `src/lib/plan/recommend.ts` (Pricer type), `src/lib/plan/pricer.ts`; Test `tests/plan/pricer.test.ts`

- [ ] **Step 1: Failing tests:**

```ts
  it("prices the pension from the wanted start age, by premium or by monthly pension", () => {
    expect(pr.pension(60, { premium: 3_000_000 })?.from).toBe(60);
    expect(pr.pension(55, { premium: 3_000_000 })?.from).toBe(55);
    const m = pr.pension(60, { monthly: 10_000 });
    expect(m?.monthlyPension).toBeGreaterThanOrEqual(9_900);
    expect(m?.monthlyPension).toBeLessThanOrEqual(10_100);
  });
```
and `realPricer(66, "M").pension(60, { premium: 3_000_000 })` is undefined.

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** Pricer type:

```ts
  /** start: the wanted age, the pension begins then or at the next age the plan issues;
   *  by: a premium in satang a year, or a pension in baht a month */
  pension(start: number, by: { premium: number } | { monthly: number }): { annual: number; monthlyPension: number; from: number } | undefined;
```
realPricer:

```ts
    pension(start, by) {
      const from = availablePensionAges(age, "untilAnnuity").find((a) => a >= start);
      if (from === undefined) return undefined;
      const q = quotePension({
        age, sex, annuityAge: from, pay: "untilAnnuity", mode: "annual",
        ...("premium" in by ? { basis: "premium" as const, amount: by.premium / 100 } : { basis: "monthlyPension" as const, amount: by.monthly }),
      });
      return q.ok ? { annual: Math.round(q.quote.annualPremium * 100), monthlyPension: q.quote.monthlyPension, from } : undefined;
    },
```
Drop the `PENSION_FROM_AGE` import from pricer.ts.

- [ ] **Step 4:** run → PASS.

### Task 3: The order pick (order.ts)

**Files:** Create `src/lib/plan/order.ts`; export `HEALTH_NOW_WORD` from `src/lib/plan/prose.ts`; Test `tests/plan/order.test.ts`

- [ ] **Step 1: Failing tests** (mock `chat` as prose.test.ts does):

```ts
describe("parseOrder", () => {
  it("takes a full order and a clean summary", () => {
    const p = parseOrder(JSON.stringify({ order: ["health", "life", "ci", "retire"], summary: "เริ่มที่สุขภาพก่อนครับ" }));
    expect(p).toEqual({ order: ["health", "life", "ci", "retire"], by: "ai", summary: "เริ่มที่สุขภาพก่อนครับ" });
  });
  it.each([
    [["life", "life", "ci", "retire"]], [["life", "health", "ci"]], [["life", "health", "ci", "tax"]], ["life"],
  ])("falls back to the fixed order on %j", (order) => {
    expect(parseOrder(JSON.stringify({ order, summary: "ดี" }))).toEqual(FIXED_PICK);
  });
  it("keeps a good order but replaces a summary with a digit or too long", () => {
    const withDigit = parseOrder(JSON.stringify({ order: ["ci", "life", "health", "retire"], summary: "ทุน 3 ล้าน" }));
    expect(withDigit.by).toBe("ai");
    expect(withDigit.summary).toBe(fixedSummary("ci"));
    expect(parseOrder(JSON.stringify({ order: ["ci", "life", "health", "retire"], summary: "ก".repeat(301) })).summary).toBe(fixedSummary("ci"));
  });
  it("falls back on junk", () => expect(parseOrder("not json")).toEqual(FIXED_PICK));
});

describe("pickOrder", () => {
  it("asks the small model as JSON", async () => {
    vi.mocked(chat).mockResolvedValueOnce({ text: JSON.stringify({ order: ["retire", "health", "ci", "life"], summary: "ก" }) } as never);
    expect((await pickOrder(P)).order[0]).toBe("retire");
    expect(vi.mocked(chat).mock.calls.at(-1)![0]).toMatchObject({ tier: "small", task: "plan-order", json: true });
  });
  it("falls back when the model fails", async () => {
    vi.mocked(chat).mockRejectedValueOnce(new Error("down"));
    expect(await pickOrder(P)).toEqual(FIXED_PICK);
  });
  it("falls back when the model is too slow", async () => {
    vi.useFakeTimers();
    vi.mocked(chat).mockReturnValueOnce(new Promise(() => {}));
    const pending = pickOrder(P);
    await vi.advanceTimersByTimeAsync(ORDER_TIMEOUT_MS);
    expect(await pending).toEqual(FIXED_PICK);
    vi.useRealTimers();
  });
});

describe("orderBrief", () => {
  it("gives the model each area's gap and the retirement answers", () => {
    const b = orderBrief(P);
    expect(b).toContain("retire:");
    expect(b).toContain("อยากเกษียณอายุ 60");
  });
});
```

- [ ] **Step 2:** run → FAIL (module missing).
- [ ] **Step 3: Implement** `src/lib/plan/order.ts`:

```ts
import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { HOSPITAL_LABEL, LIFE_WANT_LABEL } from "./assumptions";
import { ciNeed, healthNeed, lifeNeed, retireNeed, type PlanInput } from "./needs";
import { HEALTH_NOW_WORD } from "./prose";
import type { AreaKey } from "./recommend";

/**
 * Which area the budget serves first, for this person — the one planning call the model makes.
 * Figures go in; none may come out. Anything off (a missing or repeated area, a digit in the
 * summary, a slow or failed model) falls back to the owner's fixed order.
 */

export type OrderedBy = "ai" | "fixed";
export interface OrderPick { order: AreaKey[]; by: OrderedBy; summary: string }

export const AREA_KEYS: AreaKey[] = ["life", "health", "ci", "retire"];
const AREA_NAME: Record<AreaKey, string> = { life: "ประกันชีวิต", health: "ค่ารักษาพยาบาล", ci: "โรคร้ายแรง", retire: "เกษียณ" };
const DIGIT = /[0-9๐-๙]/;
const MAX_SUMMARY = 300;
export const ORDER_TIMEOUT_MS = 8_000;

export function fixedSummary(first: AreaKey): string {
  return `แผนนี้เริ่มจากด้าน${AREA_NAME[first]}ก่อน เพราะเป็นจุดที่คุณยังเสี่ยงที่สุดตอนนี้`;
}
export const FIXED_PICK: OrderPick = { order: AREA_KEYS, by: "fixed", summary: fixedSummary("life") };

/** exactly the four areas, each once */
export function isOrder(v: unknown): v is AreaKey[] {
  return Array.isArray(v) && v.length === AREA_KEYS.length && AREA_KEYS.every((k) => v.includes(k));
}

export function parseOrder(reply: string): OrderPick {
  const got = parseJsonReply<{ order?: unknown; summary?: unknown }>(reply) ?? {};
  if (!isOrder(got.order)) return FIXED_PICK;
  const order = [...got.order];
  const s = typeof got.summary === "string" ? got.summary.trim() : "";
  const summary = s && s.length <= MAX_SUMMARY && !DIGIT.test(s) ? s : fixedSummary(order[0]);
  return { order, by: "ai", summary };
}

export function orderBrief(p: PlanInput): string {
  const life = lifeNeed(p), health = healthNeed(p), ci = ciNeed(p), retire = retireNeed(p);
  const kids = p.children.length ? `ลูก ${p.children.length} คน อายุ ${p.children.join(", ")} ปี` : "ไม่มีลูก";
  return [
    `ลูกค้า: ${p.sex === "F" ? "หญิง" : "ชาย"} อายุ ${p.age} ปี เงินเดือน ${p.income} ค่าใช้จ่ายครอบครัว ${p.expense}/เดือน งบเบี้ยเพิ่ม ${p.budget}/เดือน`,
    `${kids}; ${p.otherDependants ? "มีพ่อแม่/คู่สมรสที่ต้องดูแล" : "ไม่มีคนอื่นที่ต้องดูแล"}; หนี้ ${p.debts}; เงินออม ${p.savings}`,
    `life: ควรมีทุน ${life.need} มีอยู่ ${life.have} ขาด ${life.gap}; อยากได้แบบ${LIFE_WANT_LABEL[p.lifeWant].title}`,
    `health: ${HEALTH_NOW_WORD[p.healthNow]}; อยากใช้${HOSPITAL_LABEL[p.hospital]}; ${health.covered ? "มีพอแล้ว" : `ควรมีค่าห้อง ${health.room}/วัน มี ${health.haveRoom}`}`,
    `ci: ควรมีทุน ${ci.need} มีอยู่ ${ci.have} ขาด ${ci.gap}`,
    `retire: อยากเกษียณอายุ ${p.retireAge} อยากมีใช้ ${retire.should}/เดือน มีแล้ว ${retire.have}/เดือน ขาด ${retire.gap}/เดือน`,
  ].join("\n");
}

export function orderMessages(p: PlanInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "คุณคือนักวางแผนการเงิน จัดลำดับว่าลูกค้าคนนี้ควรเอางบเบี้ยไปใส่ด้านไหนก่อน จากสี่ด้าน:",
        "life (ครอบครัวถ้าลูกค้าเสียชีวิต), health (ค่ารักษาพยาบาล), ci (โรคร้ายแรง/มะเร็ง), retire (เงินใช้หลังเกษียณ)",
        "หลักที่ใช้:",
        "- ด้านที่ไม่ขาดแล้ว ไว้ท้ายสุด",
        "- มีลูกที่ยังเล็ก มีคนต้องดูแล หรือมีหนี้ก้อนใหญ่ ให้ life มาก่อน",
        "- ไม่มีประกันสุขภาพส่วนตัว หรือมีแค่สวัสดิการบริษัท ให้ health มาก่อนหรือรองจาก life",
        "- ใกล้อายุที่อยากเกษียณ เหลือไม่ถึงสิบห้าปี และยังขาดเงินเกษียณมาก ให้ retire ขึ้นมาก่อน",
        "- โสด ไม่มีคนต้องดูแล ไม่มีหนี้ ให้ health และ ci มาก่อน life",
        "ตอบเป็น JSON เท่านั้น: {\"order\":[\"...\",\"...\",\"...\",\"...\"],\"summary\":\"...\"}",
        "order ต้องมี life, health, ci, retire ครบ คนละครั้ง",
        "summary สองถึงสามประโยค คุยกับลูกค้าโดยตรงด้วยคำว่า \"คุณ\" บอกว่าควรเริ่มจากด้านไหนและเพราะอะไรในชีวิตของเขา",
        "ห้ามมีตัวเลข จำนวนเงิน อายุ หรือเปอร์เซ็นต์ใดๆ ใน summary เด็ดขาด ห้ามรับประกันผลตอบแทน ห้ามกดดันให้ซื้อ",
      ].join("\n"),
    },
    { role: "user", content: orderBrief(p) },
  ];
}

export async function pickOrder(p: PlanInput): Promise<OrderPick> {
  const ask = chat({ tier: "small", task: "plan-order", messages: orderMessages(p), maxTokens: 600, json: true, timeoutMs: 6_000 })
    .then((res) => parseOrder(res.text))
    .catch(() => FIXED_PICK);
  const late = new Promise<OrderPick>((resolve) => setTimeout(() => resolve(FIXED_PICK), ORDER_TIMEOUT_MS));
  return Promise.race([ask, late]);
}
```
In prose.ts change `const HEALTH_NOW_WORD` to `export const HEALTH_NOW_WORD`.

- [ ] **Step 4:** run → PASS.

### Task 4: recommend walks the order; retirement aims at its gap (recommend.ts)

**Files:** Modify `src/lib/plan/recommend.ts`; Test `tests/plan/recommend.test.ts`

- [ ] **Step 1: Failing tests.** FAKE pension becomes

```ts
  pension: (start, by) => "premium" in by
    ? (by.premium >= 1_000_000 ? { annual: by.premium, monthlyPension: by.premium / 10_000, from: start } : undefined)
    : { annual: by.monthly * 1_000, monthlyPension: by.monthly, from: start },
```
and new tests:

```ts
  it("serves the budget in the order given", () => {
    const order: OrderPick = { order: ["health", "life", "ci", "retire"], by: "ai", summary: "ก" };
    const r = recommend({ ...OWNER, budget: 500 }, FAKE, order); // 600,000 satang a year
    expect(r.areas.map((a) => a.key)).toEqual(["health", "life", "ci", "retire"]);
    expect(area(r, "health").status).toBe("reduced"); // SMART 2,000,000 does not fit either → short
    expect(r.order).toEqual(order.order);
    expect(r.orderedBy).toBe("ai");
  });

  it("aims the pension at the gap when it is not last, stepping down to fit", () => {
    const order: OrderPick = { order: ["retire", "life", "health", "ci"], by: "ai", summary: "ก" };
    const r = recommend({ ...OWNER, retireMonthly: 20_000, budget: 1_000 }, FAKE, order); // 1,200,000 satang
    const retire = area(r, "retire");
    expect(retire.status).toBe("reduced");
    expect(retire.offer?.cover).toBe(1_000); // 1,000 × 1,000 = 1,000,000 fits; 2,000 does not
  });

  it("offers no pension when what the customer has covers it", () => {
    const r = recommend({ ...OWNER, pensionHave: 20_000 }, FAKE);
    expect(area(r, "retire").status).toBe("covered");
    expect(area(r, "retire").offer).toBeUndefined();
  });

  it("gives the default order the owner's fixed sequence", () => {
    const r = recommend(OWNER, FAKE);
    expect(r.order).toEqual(["life", "health", "ci", "retire"]);
    expect(r.orderedBy).toBe("fixed");
  });
```
(Fix the first test's expectation after running: with 600,000 satang and SMART at 2,000,000, health is "short"; write the expectation the budget actually gives — health short, life reduced to the largest sum under 600,000 satang.)

- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3: Implement.** Restructure `recommend` into `lifeArea`, `healthArea`, `ciArea`, `retireArea`, each taking `(p, pr, purse)` where

```ts
interface Purse { left: number; life: number; health: number; pension: number }
function spend(purse: Purse, kind: "life" | "health" | "pension", annual: number) {
  purse.left -= annual;
  purse[kind] += annual;
}
```
The life, health and CI bodies are today's code with `left` → `purse.left` and `spent.x += / left -=` → `spend(...)`. `PlanResult` gains `order: AreaKey[]; orderedBy: OrderedBy; summary: string`.

```ts
export function recommend(p: PlanInput, pr: Pricer, pick: OrderPick = FIXED_PICK): PlanResult {
  const start = p.budget * 12 * 100;
  const purse: Purse = { left: start, life: 0, health: 0, pension: 0 };
  const areas = pick.order.map((key, i) => {
    if (key === "life") return lifeArea(p, pr, purse);
    if (key === "health") return healthArea(p, pr, purse);
    if (key === "ci") return ciArea(p, pr, purse);
    return retireArea(p, pr, purse, i === pick.order.length - 1);
  });
  return {
    areas, budget: p.budget, usedAnnual: start - purse.left,
    taxSaved: taxSaved(p, { life: purse.life / 100, health: purse.health / 100, pension: purse.pension / 100 }),
    order: pick.order, orderedBy: pick.by, summary: pick.summary,
  };
}

function pensionOffer(q: { annual: number; monthlyPension: number; from: number }): Offer {
  return { product: "บำนาญ สมาร์ท 95", href: "/bumnan95", sum: q.annual, cover: q.monthlyPension, annual: q.annual, firstYear: false, fromAge: q.from };
}

/** Last: whatever is left buys the pension, as before. Earlier: the gap, stepped down to fit. */
function retireArea(p: PlanInput, pr: Pricer, purse: Purse, last: boolean): Area {
  const need = retireNeed(p);
  const area: Area = { key: "retire", unit: "pension", have: need.have, should: need.should, status: "covered" };
  if (need.gap === 0) return area;
  if (p.age > PENSION_LIMITS.ageMax) return { ...area, status: "unavailable" };
  if (last) {
    const spendable = Math.floor(purse.left / 100_000) * 100_000;
    const q = spendable > 0 ? pr.pension(p.retireAge, { premium: spendable }) : undefined;
    if (!q) return { ...area, status: "short" };
    spend(purse, "pension", q.annual);
    return { ...area, status: q.monthlyPension >= need.gap ? "fits" : "reduced", offer: pensionOffer(q) };
  }
  const quotes = new Map<number, NonNullable<ReturnType<Pricer["pension"]>>>();
  const top = Math.ceil(need.gap / PENSION_STEP) * PENSION_STEP;
  const steps: number[] = [];
  for (let m = top; m >= PENSION_STEP; m -= PENSION_STEP) {
    const q = pr.pension(p.retireAge, { monthly: m });
    if (q) { quotes.set(m, q); steps.push(m); }
  }
  if (!steps.length) return { ...area, status: "unavailable" };
  const r = fit(steps, (m) => quotes.get(m)!.annual, purse.left);
  const q = r.option !== undefined ? quotes.get(r.option) : undefined;
  if (spends(r.status) && q) spend(purse, "pension", q.annual);
  const status = r.status === "fits" && steps[0] < top ? "reduced" : r.status;
  return { ...area, status, offer: q ? pensionOffer(q) : undefined };
}
```

- [ ] **Step 4:** `npx vitest run tests/plan` → PASS (all plan tests).

### Task 5: Server actions, prose brief, admin column

**Files:** Modify `src/app/plan/actions.ts`, `src/lib/plan/prose.ts`, `src/app/admin/crm/PlanRuns.tsx`; Test `tests/plan/prose.test.ts`

- [ ] **Step 1:** prose fixture `R` gains `order: ["life","health","ci","retire"], orderedBy: "fixed", summary: "ก"`; add

```ts
  it("tells the model the order used and the retirement answers", () => {
    const b = planBrief(P, { ...R, order: ["health", "life", "ci", "retire"] });
    expect(b).toContain("ค่ารักษาพยาบาล → ครอบครัวถ้าลูกค้าเสียชีวิต");
    expect(b).toContain("อยากเกษียณอายุ 60");
  });
```
- [ ] **Step 2:** run → FAIL.
- [ ] **Step 3:** `planBrief` adds

```ts
    `เกษียณ: อยากเกษียณอายุ ${p.retireAge} อยากมีใช้เดือนละ ${p.retireMonthly} มีบำนาญแล้ว ${p.pensionHave}/เดือน เงินก้อนเพื่อเกษียณ ${p.retireLump}`,
    `ลำดับที่แผนนี้ใช้งบ: ${r.order.map((k) => AREA_WORD[k]).join(" → ")}`,
```
actions.ts:

```ts
export async function buildPlan(raw: unknown): Promise<BuildReply> {
  const p = cleanInput(raw);
  if (typeof p === "string") return { ok: false, error: p };
  if (!allowBuild(clientIp(await headers()))) return { ok: false, error: "กดถี่เกินไป รอสักครู่แล้วลองใหม่นะครับ" };
  const result = recommend(p, realPricer(p.age, p.sex), await pickOrder(p));
  await keep(p, result);
  return { ok: true, result };
}

/** `order` is the one buildPlan used, so the words follow the same plan; anything else is ignored */
export async function explainPlan(raw: unknown, order?: unknown): Promise<Prose> {
  const p = cleanInput(raw);
  if (typeof p === "string") return FALLBACK_PROSE;
  if (!allowExplain(clientIp(await headers()))) return FALLBACK_PROSE;
  const pick = isOrder(order) ? { ...FIXED_PICK, order } : FIXED_PICK;
  return explain(p, recommend(p, realPricer(p.age, p.sex), pick));
}
```
PlanRuns.tsx: add a `ลำดับ` column after `ที่เสนอ`:

```tsx
<td className="pr-3 whitespace-nowrap">
  {r.result.order ? `${r.result.order.map((k) => AREA[k]).join("→")}${r.result.orderedBy === "ai" ? " (AI)" : ""}` : "—"}
</td>
```
- [ ] **Step 4:** `npx vitest run tests/plan && npx tsc --noEmit` → PASS.

### Task 6: Form group and card (Planner.tsx, PlanView.tsx)

**Files:** Modify `src/app/plan/Planner.tsx`, `src/app/plan/PlanView.tsx`

- [ ] **Step 1:** Planner state: `retireAge` ("60"), `retireMonthly` + `retireTouched` (like the budget), `pensionHave`, `retireLump`; `shownRetire = retireTouched ? retireMonthly : defaultRetireMonthly(n(expense)) || ""`. The form object gains `retireAge: Number(retireAge), retireMonthly: n(shownRetire), pensionHave: n(pensionHave), retireLump: n(retireLump)`. `explainPlan(form, reply.result.order)`.

New section after "ประกันที่มีอยู่แล้ว":

```tsx
<section className={PANEL}>
  <h2 className="text-base font-medium text-[var(--lg-white)]">เกษียณและบำนาญ</h2>
  <div>
    <span className={LABEL}>อยากเกษียณอายุเท่าไหร่</span>
    <Choice value={retireAge} onChange={setRetireAge} options={RETIRE_AGES.map((a) => [String(a), `${a} ปี`] as [string, string])} />
  </div>
  <MoneyField label="หลังเกษียณอยากมีเงินใช้เดือนละ (บาท)" value={shownRetire}
    onChange={(v) => { setRetireTouched(true); setRetireMonthly(v); }}
    hint="ตั้งไว้ให้ที่ 70% ของค่าใช้จ่ายตอนนี้ แก้ได้ตามสะดวก" />
  <MoneyField label="บำนาญที่คาดว่าจะได้แล้ว เดือนละ (บาท)" value={pensionHave} onChange={setPensionHave}
    hint="เช่น บำนาญข้าราชการ บำนาญประกันสังคม ประกันบำนาญที่มีอยู่" />
  <MoneyField label="เงินก้อนที่เก็บไว้เพื่อเกษียณ (บาท)" value={retireLump} onChange={setRetireLump}
    hint="เช่น PVD RMF เงินออมเพื่อเกษียณ ไม่รวมเงินออมที่กรอกข้างบน" />
</section>
```
- [ ] **Step 2:** PlanView: under `<h2>แผนของคุณ</h2>` add `<p className="mt-1.5 text-sm leading-relaxed text-[var(--lg-white)]">{result.summary}</p>`; `AreaRow` takes `n` and titles `{n}. {TITLE[area.key]}`; rows render in `result.areas` order (already ordered).
- [ ] **Step 3:** `npx tsc --noEmit` → clean.

### Task 7: Verify, browser check, commit, push

- [ ] `npm run verify && git add <each file by path> && git commit && git push` (commit email pheerapatpisit.dev@gmail.com).
- [ ] Browser at 375×812: fill the form (35, 40,000 / 25,000, debts 1,500,000), both life answers, a 50-year-old with no retirement savings; confirm the summary, numbered areas, retirement group, and `/admin/crm` column.
