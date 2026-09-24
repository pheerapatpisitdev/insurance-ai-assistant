# /plan — AI picks the order, and four retirement questions — design

Owner request, 2026-09-25, on top of the self-planner (`2026-09-25-self-planner-design.md`),
the one-card result (a8eef23) and the life question (de1cd22).

Until now the model only wrote the folded advice. The owner wants it to help plan: decide which
area the budget goes to first for this person, and say why on the card. The owner also wants
the form to ask about retirement instead of assuming it.

## Decisions (owner)

1. **The AI orders all four areas** — life, health, CI, retirement — per customer, and writes a
   short summary of why, shown at the top of the card.
2. **Figures stay code.** The order only decides who is served first from the budget; every
   need, sum and premium still comes from the formulas and the rate tables.
3. **Four retirement questions**, in a new form group "เกษียณและบำนาญ":
   retirement age, money wanted a month after retiring, pension already expected a month, and
   a lump sum kept for retirement.

## The form: new group "เกษียณและบำนาญ"

Placed after "ประกันที่มีอยู่แล้ว", before the hospital question.

| Field | Input | Default |
|---|---|---|
| อยากเกษียณอายุเท่าไหร่ | buttons 55 / 60 / 65 | 60 |
| หลังเกษียณอยากมีเงินใช้เดือนละ (บาท) | money, pre-filled like the budget field | 70% of the monthly expense, to the hundred; follows the expense field until the customer edits it |
| บำนาญที่คาดว่าจะได้แล้ว เดือนละ (บาท) | money; hint: บำนาญข้าราชการ ประกันสังคม ประกันบำนาญที่มีอยู่ | 0 |
| เงินก้อนที่เก็บไว้เพื่อเกษียณ (บาท) | money; hint: PVD RMF เงินออมเพื่อเกษียณ — ไม่รวมเงินออมข้างบน | 0 |

`PlanInput` gains `retireAge: 55 | 60 | 65`, `retireMonthly`, `pensionHave`, `retireLump`.
`cleanInput` defaults them (60, 70% rule, 0, 0) so old callers and stored runs still parse.

## Retirement need, reworked

- **should** = `retireMonthly` (the customer's figure, or the 70% rule when left blank).
- **have** = `pensionHave` + `retireLump / ((LUMP_LASTS_TO_AGE − retireAge) × 12)`, rounded to the
  hundred. `LUMP_LASTS_TO_AGE = 85`, no investment return — new constants in `assumptions.ts`.
  `retireLump` is not counted in the life need; the existing "เงินออม" field still is.
- **covered** when have ≥ should → status "covered", no pension offered.
- **Pension start age** = `retireAge` if บำนาญ สมาร์ท 95 issues it at this age, else the next
  available one (55 → 60 → 65); the card already shows "ตั้งแต่อายุ X".

## How the budget meets the order

`recommend(p, pricer, order)` walks the areas in `order` instead of the fixed sequence.
Life, health and CI keep their current rules. Retirement:

- **Last in the order** → as today: whatever budget is left, to the thousand baht, buys the pension.
  So the default order gives exactly today's plan.
- **Not last** → aim for the gap (should − have) as a monthly pension, priced with the engine's
  pension basis; if it does not fit, step down 1,000 baht a month at a time to the largest that
  fits (the same `fit` rule the other areas use). Nothing fits → "short" with the smallest option.

The card lists the areas in the order used, numbered 1–4.

## The AI call

One small-tier call (`task: "plan-order"`, `json: true`, `timeoutMs: 8000`), made in
`buildPlan` **before** the figures, given the same brief as the advice (every answer, plus the
four needs and gaps as figures — figures may go in, none may come out).

Reply: `{"order":["health","life","ci","retire"],"summary":"..."}`.

Accepted only if `order` is exactly the four keys once each, and `summary` is non-empty, at most
300 characters and digit-free. Otherwise:

- bad or missing order → the fixed order life → health → CI → retire;
- bad summary with a good order → a fixed sentence naming the first area
  ("แผนนี้เริ่มจากด้าน … ก่อน เพราะเป็นจุดที่ครอบครัวของคุณยังเสี่ยงที่สุด");
- timeout, no key, error → both fallbacks.

The prompt gives the model the rules a planner uses (dependants and debts → life early; no
private health cover → health early; age near retirement with little saved → retirement early;
an area already covered → last) so the same customer tends to get the same order. The AI client
has no temperature setting, so repeat presses can still differ; accepted.

`PlanResult` gains `order: AreaKey[]`, `orderedBy: "ai" | "fixed"` and `summary: string`, so
`ins_plan_runs` records who decided. `/admin/crm`'s plan table gets a column for the order and
who set it.

The folded advice (`explainPlan`) is unchanged except that its brief carries the order and the
new retirement answers.

## Loading

The figures now wait for the order call (about 3–5 s, 8 s at most). The button reads
"กำลังวางแผน…" meanwhile, as today. Cost: one extra small-tier call, about ฿0.05 a press.

## Testing

- `recommend` with each of a few orders: budget served in that order; default order equals
  today's result; retirement not-last aims at the gap and steps down; covered retirement offers
  nothing.
- Retirement need: lump sum spread to 85; expected pension counted; start age moves up when the
  chosen one is not issued.
- Order parsing: valid, duplicate key, missing key, unknown key, digit in summary, too long,
  junk JSON → the right fallback.
- `buildPlan` with the model failing → fixed order, fixed summary, figures still returned.
- Browser at phone size: new form group, card with summary and numbered areas, admin column.
