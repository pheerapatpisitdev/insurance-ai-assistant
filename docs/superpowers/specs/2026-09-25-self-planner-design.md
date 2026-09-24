# หน้าวางแผนประกันด้วยตัวเอง (/plan) — design

Owner request, 2026-09-25. A customer types in rough figures about their life, the page works
out what they are missing, prices the plans we sell to fill the gaps, and an AI writes the
explanation the way a financial planner would say it.

## Decisions (owner, in this order)

1. **No contact gate.** The full plan shows at once; nobody is asked for a phone number. Each
   recommended plan links to its sales page. No ทักเพจ / m.me button (owner rule, 2026-09-23).
2. **Code computes, AI explains.** Needs, gaps, chosen plans and premiums come from formulas and
   the real rate tables. The model writes prose only, and that prose may carry no digit.
3. **Four areas:** family if I die, hospital bills, critical illness / cancer, retirement + tax.
4. **The customer sets the budget.** The field opens pre-filled at 10% of monthly income minus
   what they already pay in premiums.
5. **One long page**, not a wizard.
6. Figures entered are **stored anonymously** so the owner can see use (no name, no phone).

## The form (one page, phone-first)

| Group | Fields |
|---|---|
| ตัวคุณ | อายุ, เพศ |
| รายได้–รายจ่าย | เงินเดือน (ต่อเดือน), ค่าใช้จ่ายครอบครัวส่วนที่คุณจ่าย (ต่อเดือน), เงินออม/ลงทุนที่มี |
| ครอบครัว–หนี้ | อายุลูกแต่ละคน (0–4 คน, ปุ่ม + เพิ่มลูก), มีคนอื่นที่ต้องดูแลไหม (พ่อแม่/คู่สมรส: มี/ไม่มี), หนี้คงเหลือรวม (บ้าน รถ อื่นๆ) |
| ประกันที่มีอยู่ | ทุนประกันชีวิตรวม, ทุนโรคร้ายแรงรวม, สิทธิ์ค่ารักษา (ไม่มี / ประกันสังคม-บัตรทอง / สวัสดิการบริษัท / ประกันสุขภาพส่วนตัว + ค่าห้องต่อวัน), เบี้ยที่จ่ายอยู่ต่อปี |
| โรงพยาบาลที่อยากใช้ | รพ.รัฐ / เอกชนทั่วไป / เอกชนชั้นนำ |
| งบ | อยากจ่ายเบี้ยเพิ่มเดือนละไม่เกิน (pre-filled, editable) |

Money fields take digits with or without commas (numeric keypad; Thai words like "5 หมื่น"
are not parsed). Empty
optional fields count as 0. Age 20–70 is accepted (below 20 has no income to plan; plans'
own age limits still apply per area).

## Assumptions — one file the owner can change

`src/lib/plan/assumptions.ts`, every constant named and commented in Thai:

| Name | Value |
|---|---|
| Child supported until age | 22 |
| Years of support when no children but someone else depends on you | 10 |
| Education fund per child (from birth to 22) | 1,000,000 |
| Funeral cost | 100,000 |
| Critical-illness cover = years of income | 3 |
| Default budget share of income | 10% |
| Hospital → iHealthy tier | รัฐ → SMART (1,500/วัน), เอกชนทั่วไป → SILVER (5,500), ชั้นนำ → GOLD (9,000) |
| Pension start age | 60 (or the earliest the engine allows for this age) |

## Formulas (`src/lib/plan/needs.ts`, pure)

**1. Family if I die**
- `years` = children ? `22 − youngest child's age` : (someone depends on you ? 10 : 0)
- `support` = family expense × 12 × `years`
- `education` = Σ over children under 22 of `1,000,000 × (22 − age) / 22`, rounded to 10,000
- `need` = debts + support + education + funeral
- `gap` = max(0, need − existing life cover − savings)
- Life Protect x 2 pays **double the sum before 60**. When `age + years ≤ 60` the sum
  assured needed is `gap / 2`; otherwise `gap`. Rounded **up** to the page's sum steps
  (every 500,000 to 10M, then every 1M), minimum 150,000.

**2. Hospital bills**
- Target tier from the hospital choice. No recommendation if a private health policy already
  pays a room rate ≥ the target. Company welfare still gets a recommendation (it ends with the
  job), and the prose says so.
- Priced as the Health Ultra Package: Life Protect WLF99HX at 50,000 + iHealthy Ultra, Thailand,
  Full Coverage — the same arrangement as `IHEALTHY_OPENING`. Ages 6–80.

**3. Critical illness / cancer**
- `gap` = max(0, annual income × 3 − existing CI cover)
- CI 123 set, smallest option ≥ gap from {500k, 1M, 2M, 3M, 4M, 5M, 10M}. Ages 0–75.
- If even CI 123's smallest option does not fit the budget and age ≤ 65, offer the Cancer set
  at the largest tier that fits instead.

**4. Retirement + tax**
- Takes whatever budget is left after areas 1–3. Pension Smart 95 via `quotePension`, basis
  `premium`, pay `untilAnnuity`, annuity age 60 (or the earliest available). Ages 20–65.
  Skipped, with a sentence, if the leftover is below the plan's minimum.
- **Tax saved** (estimate): marginal rate from Thai PIT brackets on
  `income×12 − min(50% , 100,000) expense deduction − 60,000 personal`. Life + health premiums
  deductible to 100,000 (health ≤ 25,000, counting what they already pay); pension through
  the existing `pensionTax()`. Shown as "ประหยัดภาษีได้ประมาณ … บาท/ปี".

## Fitting the budget (`src/lib/plan/recommend.ts`, server)

Budget is compared as annual premium ÷ 12 ("เฉลี่ยเดือนละ"). Areas are filled in priority
order **life → health → CI → retirement**. Each area takes its full recommendation if it fits
the budget still left; otherwise it steps down to the largest sum/tier that fits; if even the
smallest does not fit, the area shows the smallest option's price and "ยังไม่พอในงบนี้".
Every area reports three figures: **มีอยู่ / ควรมี / แผนนี้ให้**.

Worked example (owner's): age 35 ชาย, เงินเดือน 50,000, ค่าใช้จ่าย 25,000, ลูกอายุ 5 และ 8,
หนี้ 1,500,000, ทุนชีวิตเดิม 500,000, เงินออม 200,000 →
support 25,000×12×17 = 5,100,000; education 770,000 + 640,000; need 8,110,000;
gap 7,410,000; 35+17 = 52 ≤ 60 so sum assured 3,705,000 → **Life Protect 4,000,000**.
Default budget 5,000/เดือน minus existing premiums.

## Result screen

1. Summary strip: งบ / ใช้ไป / เหลือ, and the tax saved.
2. One card per area: the three figures as a small bar (มีอยู่ · แผนนี้ให้ · ควรมี), the plan
   name, sum, "เบี้ยปีแรก … บาท/ปี (เฉลี่ยเดือนละ …)", the planner paragraph, and a link to the
   plan's sales page (`/lifeprotect`, `/ihealthy-ultra` with `queryFrom()` prefill, `/ci123`,
   `/cancer`, `/bumnan95`). Card highlighter on the price line (existing rule).
3. Footer disclaimer: ตัวเลขเป็นการประมาณเบื้องต้นจากข้อมูลที่กรอก ไม่ใช่ข้อเสนอขาย
   เบี้ยจริงขึ้นกับการพิจารณารับประกันของบริษัท; the insurer named as กรุงไทย-แอกซ่า ประกันชีวิต.

Figures appear first; the planner paragraphs fill in a moment later (two server actions:
`buildPlan` returns numbers, `explainPlan` returns prose), so a slow or failed model never
blocks the numbers.

## AI prose (`src/lib/plan/prose.ts`)

- One `chat({ tier: "small", task: "plan-advice", json: true })` call returning
  `{ intro, life, health, ci, retire }`, each 2–3 sentences in Thai, warm planner voice
  ("คุณ…"), explaining *why* the area matters for this person's situation.
- The brief is the computed facts in words ("ลูก 2 คน คนเล็กยังเล็ก", "งบไม่พอด้านเกษียณ").
- Any field containing a digit (`/[0-9๐-๙]/`, reused from `content/numbers.ts`) is replaced by
  a fixed per-area fallback sentence. Model failure or `BudgetExceeded` → all fallbacks.
- Rate-limited per IP with the existing `assistant/rate-limit.ts`. Cost ≈ ฿0.3 per plan,
  recorded in the usage ledger like every other call.

## Storage and the owner's view

- New table `public.ins_plan_runs (id uuid, created_at, input jsonb, result jsonb)`, RLS on,
  no policies — written by the server with the service role, like every other `ins_*` table.
  No IP, no name.
- `/admin/crm` gets a small card: plans built in the last 7 / 30 days and the last 20 runs
  (age, income, which areas were recommended, total premium).

## Menu

Added to `SALES_SECTIONS` as "วางแผนประกัน" (icon `calc`); `tests/calc/shell-menu.test.ts`'s
on-disk list updated.

## Files

```
src/lib/plan/assumptions.ts   constants the owner can change
src/lib/plan/needs.ts         pure formulas → needs, gaps, tax
src/lib/plan/recommend.ts     server: needs + budget + rate tables → chosen plans and premiums
src/lib/plan/prose.ts         server: model call + digit guard + fallbacks
src/app/plan/layout.tsx       SalesTheme
src/app/plan/page.tsx         server shell + metadata
src/app/plan/Planner.tsx      client form + result cards
src/app/plan/actions.ts       buildPlan, explainPlan (+ insert ins_plan_runs)
supabase migration            ins_plan_runs
src/app/admin/crm/PlanRuns.tsx
```

## Tests

- `needs.test.ts`: the worked example above to the baht; no children; no dependents (gap =
  debts + funeral only); over-60 (no halving); existing cover larger than need (gap 0).
- `recommend.test.ts`: full plan fits; budget too small steps life down; budget covers only
  life; CI falls back to Cancer set; pension skipped when leftover is below minimum; each
  plan's age limits (health at 5, CI at 76, pension at 66 all drop out with a reason).
- `prose.test.ts`: digit in a field → that field's fallback, others kept; model error → all
  fallbacks.
- Existing `palette.test.ts` and `shell-menu.test.ts` pass.

## Out of scope (phase 1)

Prefilled links into the other sales pages, attaching iHealthy to the recommended Life Protect
instead of its own 50,000 base, inflation, investment returns, a PDF of the plan, and
collecting contact details.
