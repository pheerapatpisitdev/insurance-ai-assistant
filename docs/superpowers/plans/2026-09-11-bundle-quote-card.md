# Bundle Quote Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The assistant hands a customer a picture of the ชุดมรดกเพื่อครอบครัว quote, the same way it already does for any single plan.

**Architecture:** `QuoteCard` stops naming its two sections and carries a list of them, so one drawing routine covers any arrangement. `CardInput` becomes a union of a plan card and a bundle card, `quoteCard()` dispatches on it, and `answerBundle()` attaches the resulting path. The three channels are untouched — each already sends a picture whenever `answer.card` is set.

**Tech Stack:** TypeScript, Next.js 15 App Router, `next/og` (Satori) for drawing, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-11-bundle-quote-card-design.md`

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `src/lib/quote-card.ts` | Modify | What a card says. Gains `CardSection`, the `CardInput` union, `bundleCard()`. |
| `src/app/api/card/route.tsx` | Modify | How a card is drawn. Loops over sections instead of naming two. |
| `src/lib/assistant/answer.ts` | Modify | Attaches the card path to a priced bundle answer. |
| `src/lib/assistant/format.ts` | Modify | The bundle reply's closing note says the premium is first-year. |
| `tests/calc/quote-card.test.ts` | Modify | Existing card tests, read through `sections`. |
| `tests/calc/bundle-card.test.ts` | Create | Everything specific to a bundle card. |
| `tests/calc/assistant-bundle.test.ts` | Modify | The answer carries a card when it priced, and none when it did not. |

`quote-card.ts` ends at roughly 300 lines. That is within what the rest of `src/lib` runs to, and splitting the plan card from the bundle card would separate two functions that must keep returning the same shape — they are easier to keep honest side by side.

---

## Task 1: A card carries a list of sections

Pure refactor. The drawn output must not change by one pixel.

**Files:**
- Modify: `src/lib/quote-card.ts`
- Modify: `src/app/api/card/route.tsx:53-62` and `:157-158`
- Test: `tests/calc/quote-card.test.ts`

- [ ] **Step 1: Rewrite the existing tests to read through `sections`**

Replace the whole of `describe("quoteCard", ...)` in `tests/calc/quote-card.test.ts` with this. Everything asserted is what the file asserted before; only the route to it changed.

```ts
const section = (card: QuoteCard, title: string) => card.sections.find((s) => s.title === title);

const DEATH = "ครอบครัวได้รับเมื่อเสียชีวิต";
const CASH = "มูลค่าเงินสดสะสม (หากเวนคืน)";

describe("quoteCard", () => {
  it("draws what the sales page shows for the same insured", () => {
    const card = quoteCard(MAN35, WHILE_CURRENT)!;
    expect(card.planLine).toBe("Life Protect x 2 · ชำระเบี้ย 19 ปี");
    expect(card.insuredLine).toBe("ชาย 35 ปี · ทุน 1,000,000 บาท");
    expect(card.premium).toEqual({ amount: "2,583", per: "ต่อเดือน" });
    expect(card.perDay).toBe("ตกวันละ 79 บาท");
    expect(card.others).toBe("รายปี 28,700 บาท · ราย 6 เดือน 14,924 บาท");
  });

  it("bands the death benefit the way every other surface does", () => {
    expect(section(quoteCard(MAN35, WHILE_CURRENT)!, DEATH)).toEqual({
      title: DEATH,
      rows: [
        { label: "เสียชีวิตก่อนอายุ 60 ปี", amount: "2,000,000" },
        { label: "อายุ 60 ปีขึ้นไป", amount: "1,000,000" },
      ],
    });
  });

  it("quotes the surrender value at the milestones still ahead", () => {
    expect(section(quoteCard(MAN35, WHILE_CURRENT)!, CASH)!.rows).toEqual([
      { label: "อายุ 60 ปี", amount: "504,000" },
      { label: "อายุ 70 ปี", amount: "633,000" },
      { label: "อายุ 80 ปี", amount: "777,000" },
      { label: "อายุ 99 ปี", amount: "1,000,000" },
    ]);
  });

  /** The order the bands are drawn in is the order the customer reads them. */
  it("puts what the family receives above what surrender would return", () => {
    expect(quoteCard(MAN35, WHILE_CURRENT)!.sections.map((s) => s.title)).toEqual([DEATH, CASH]);
  });

  it("leaves out the milestones an older insured has already passed", () => {
    const rows = section(quoteCard({ ...MAN35, age: 72 }, WHILE_CURRENT)!, CASH)!.rows;
    expect(rows.map((r) => r.label)).toEqual(["อายุ 80 ปี", "อายุ 99 ปี"]);
  });

  it("names the rate table it priced from", () => {
    expect(quoteCard(MAN35, WHILE_CURRENT)!.notes[0]).toBe("เบี้ยมาตรฐานโดยประมาณ · ตารางเบี้ยฉบับ A2026-1");
  });

  /** A card is a picture of a price, and a lapsed table has no price to show. */
  it("shows no premium once the rate table has lapsed", () => {
    const card = quoteCard(MAN35, new Date("2027-04-01"))!;
    expect(card.premium).toBeNull();
    expect(card.perDay).toBeNull();
    expect(card.notes[0]).toContain("หมดอายุ");
    // the benefits do not come from the rate table, so they are still true and still drawn
    expect(section(card, DEATH)!.rows[0].amount).toBe("2,000,000");
  });

  it("draws nothing for an arrangement the company will not issue", () => {
    // iShield stops at 5,000,000, so a card for ten million is a card for nothing
    expect(quoteCard(
      { kind: "plan", planCode: "ISHIELD", variant: "WLCI10", age: 35, sex: "M", sumAssured: 10_000_000 },
      WHILE_CURRENT,
    )).toBeUndefined();
  });

  it("prices a plan whose labels carry no product name", () => {
    const card = quoteCard(
      { kind: "plan", planCode: "PLB", variant: "PLB10", age: 35, sex: "F", sumAssured: 500_000 },
      WHILE_CURRENT,
    )!;
    expect(card.planLine).toBe("Protection Life (PLB) · Protection Life (ชำระเบี้ย 10 ปี)");
    // PLB has no cash-value table extracted, so the card simply has no such section
    expect(section(card, CASH)).toBeUndefined();
  });
});
```

Update the import line at the top of the file and the `MAN35` constant:

```ts
import { cardInputFrom, cardPath, cardUrl, quoteCard, type CardInput, type QuoteCard } from "@/lib/quote-card";

const MAN35: CardInput = {
  kind: "plan",
  planCode: "LIFEPROTECT", variant: "WLF19H", age: 35, sex: "M", sumAssured: 1_000_000, mode: "monthly",
};
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/calc/quote-card.test.ts`

Expected: FAIL. TypeScript rejects `kind` on `CardInput`, and `card.sections` is not a property.

- [ ] **Step 3: Give `QuoteCard` a section list**

In `src/lib/quote-card.ts`, add the type beside `CardRow`:

```ts
/**
 * A titled block of figures. Cards carry a list of these rather than a field per block,
 * because what a card has to show depends on what is being sold: a plan states a death
 * benefit and a surrender value, a bundle also has to say what it is made of and what it
 * pays on a diagnosis. The drawing routine reads the list and never names a block.
 */
export interface CardSection {
  title: string;
  rows: CardRow[];
}
```

Then in `interface QuoteCard`, delete the `death` and `cash` fields and put this in their place:

```ts
  /** the titled blocks of figures, in the order they are read */
  sections: CardSection[];
```

- [ ] **Step 4: Build the list instead of the two fields**

Still in `src/lib/quote-card.ts`, inside `quoteCard()`, replace the `const death = ...` block and the `const cashRows: CardRow[] = ...` block and the `death` / `cash` properties of the returned object.

Delete this:

```ts
  const death = result.deathBenefit
    ? {
      title: "ครอบครัวได้รับเมื่อเสียชีวิต",
      rows: deathBenefitRows(result.deathBenefit).map((r) => ({ label: r.label, amount: money(r.amount) })),
    }
    : null;

  const schedule = cashValueSchedule(input.planCode, input.variant, input.sex, input.age, result.sumAssured);
  const end = maturityValue(schedule);
  const cashRows: CardRow[] = [
    ...CASH_AGES
      .filter((at) => at > input.age)
      .map((at) => ({ at, row: schedule.find((r) => r.age === at) }))
      .filter((x): x is { at: number; row: { age: number; policyYear: number; amount: number } } => !!x.row && x.row.amount > 0)
      .map((x) => ({ label: `อายุ ${x.at} ปี`, amount: money(x.row.amount) })),
    ...(end && end.age > input.age && end.amount > 0
      ? [{ label: `อายุ ${end.age} ปี`, amount: money(end.amount) }]
      : []),
  ];
```

Put this in its place:

```ts
  const sections: CardSection[] = [];
  if (result.deathBenefit) sections.push(deathSection(result.deathBenefit));
  const cashRows = cashRowsFor(input.planCode, input.variant, input.sex, input.age, result.sumAssured);
  if (cashRows.length) sections.push({ title: CASH_TITLE, rows: cashRows });
```

And in the returned object, replace the two lines

```ts
    death,
    cash: cashRows.length ? { title: "มูลค่าเงินสดสะสม (หากเวนคืน)", rows: cashRows } : null,
```

with

```ts
    sections,
```

- [ ] **Step 5: Add the two shared builders**

In `src/lib/quote-card.ts`, above `quoteCard()`, add:

```ts
const CASH_TITLE = "มูลค่าเงินสดสะสม (หากเวนคืน)";

/**
 * The death benefit as a card block. Shared rather than written per card, because the bands
 * come from deathBenefitRows and a second hand-written copy is a second chance to promise
 * cover that has ended.
 */
function deathSection(db: DeathBenefit): CardSection {
  return {
    title: "ครอบครัวได้รับเมื่อเสียชีวิต",
    rows: deathBenefitRows(db).map((r) => ({ label: r.label, amount: money(r.amount) })),
  };
}

/** The surrender values still ahead of this insured, plus whatever the schedule ends on. */
function cashRowsFor(
  planCode: string, variant: string, sex: Sex, age: number, sumAssured: number,
): CardRow[] {
  const schedule = cashValueSchedule(planCode, variant, sex, age, sumAssured);
  const end = maturityValue(schedule);
  return [
    ...CASH_AGES
      .filter((at) => at > age)
      .map((at) => ({ at, row: schedule.find((r) => r.age === at) }))
      .filter((x): x is { at: number; row: { age: number; policyYear: number; amount: number } } => !!x.row && x.row.amount > 0)
      .map((x) => ({ label: `อายุ ${x.at} ปี`, amount: money(x.row.amount) })),
    ...(end && end.age > age && end.amount > 0
      ? [{ label: `อายุ ${end.age} ปี`, amount: money(end.amount) }]
      : []),
  ];
}
```

Add `DeathBenefit` to the type import from `@/calc/types`, so that line reads:

```ts
import { PAY_MODE_LABEL, type DeathBenefit, type PayMode, type QuoteInput, type Sex } from "@/calc/types";
```

- [ ] **Step 6: Add `kind` to the plan input**

In `src/lib/quote-card.ts`, `interface CardInput` becomes:

```ts
export interface PlanCardInput {
  kind: "plan";
  planCode: string;
  variant: string;
  age: number;
  sex: Sex;
  sumAssured: number;
  /** the instalment the customer is thinking in; the card still shows the others */
  mode?: PayMode;
}

export type CardInput = PlanCardInput;
```

`CardInput` stays a single-member union for now; Task 2 adds the other member. Then in `cardInputFrom()`, change the returned object to carry the tag:

```ts
  return { kind: "plan", planCode, variant, age, sex, sumAssured, mode };
```

- [ ] **Step 7: Draw the list instead of the two blocks**

In `src/app/api/card/route.tsx`, replace the two section lines in `heightOf()`:

```ts
    + sectionHeight(card.death?.rows)
    + sectionHeight(card.cash?.rows)
```

with

```ts
    + card.sections.reduce((h, s) => h + sectionHeight(s.rows), 0)
```

and replace the two render lines:

```tsx
        {card.death && <Rows title={card.death.title} rows={card.death.rows} />}
        {card.cash && <Rows title={card.cash.title} rows={card.cash.rows} />}
```

with

```tsx
        {card.sections.map((s) => <Rows key={s.title} title={s.title} rows={s.rows} />)}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/calc/quote-card.test.ts`

Expected: PASS, 11 tests.

- [ ] **Step 9: Check the whole suite and the types**

Run: `npx tsc --noEmit && npx vitest run`

Expected: no type errors, every test passing.

- [ ] **Step 10: Confirm the drawn card is unchanged**

The dev server is already running on port 3000. Draw the same card the conversation drew before the refactor and compare byte counts:

```bash
curl -s "http://localhost:3000/api/card?plan=LIFEPROTECT&variant=WLF99H&age=35&sex=M&sum=1000000&mode=annual" \
  -o /tmp/card-after.png -w "%{http_code} %{size_download}\n"
```

Expected: `200` and a size within a few hundred bytes of 105495. A large difference means the layout moved and the refactor was not pure — stop and find out why before committing.

- [ ] **Step 11: Commit**

```bash
git add src/lib/quote-card.ts src/app/api/card/route.tsx tests/calc/quote-card.test.ts
git commit -m "refactor(card): a card carries its sections as a list

The drawing routine named the two blocks a plan happens to have, so a
card for anything else could not be drawn without editing it. The
agency's own bundles need four blocks, and the four plans still to come
will each want their own.

QuoteCard now carries sections in the order they are read and the route
loops over them. Nothing drawn changes."
```

---

## Task 2: A card can be asked for by bundle and tier

**Files:**
- Modify: `src/lib/quote-card.ts`
- Test: `tests/calc/bundle-card.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/calc/bundle-card.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cardInputFrom, cardPath, type BundleCardInput } from "@/lib/quote-card";

const MAN40: BundleCardInput = {
  kind: "bundle", bundleCode: "LEGACY_FAMILY", tier: 1, age: 40, sex: "M", mode: "annual",
};

const params = (q: string) => new URLSearchParams(q);

describe("cardInputFrom, for a bundle", () => {
  it("reads a bundle and tier the registry knows", () => {
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=annual"))).toEqual(MAN40);
  });

  /**
   * A card is a public URL. Everything in it is checked before anything is drawn, so a
   * hand-edited link either names an arrangement the agency sells or gets nothing.
   */
  it("refuses anything the registry does not recognise", () => {
    expect(cardInputFrom(params("bundle=NOPE&tier=1&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=11&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=0&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1.5&age=40&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=120&sex=M"))).toBeUndefined();
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=40&sex=X"))).toBeUndefined();
  });

  it("ignores a payment mode it does not sell", () => {
    expect(cardInputFrom(params("bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=weekly"))?.mode)
      .toBeUndefined();
  });
});

describe("cardPath, for a bundle", () => {
  it("writes the arrangement into the address", () => {
    expect(cardPath(MAN40)).toBe("/api/card?bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=annual");
  });

  it("survives the round trip back into an input", () => {
    expect(cardInputFrom(new URLSearchParams(cardPath(MAN40).split("?")[1]))).toEqual(MAN40);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/bundle-card.test.ts`

Expected: FAIL — `BundleCardInput` is not exported from `@/lib/quote-card`.

- [ ] **Step 3: Add the input type to the union**

In `src/lib/quote-card.ts`, beside `PlanCardInput`:

```ts
/**
 * A card for an arrangement the agency sells under its own name. It is named by bundle and
 * tier rather than by sums assured, because the sums are the bundle's business — a link
 * that could set them would be a link that could invent an arrangement the agency does not
 * sell.
 */
export interface BundleCardInput {
  kind: "bundle";
  bundleCode: string;
  tier: number;
  age: number;
  sex: Sex;
  /** the instalment the customer is thinking in; the card still shows the others */
  mode?: PayMode;
}

export type CardInput = PlanCardInput | BundleCardInput;
```

Add the registry import at the top of the file:

```ts
import { getBundle } from "@/calc/bundles/registry";
```

- [ ] **Step 4: Read a bundle out of the query**

In `src/lib/quote-card.ts`, add above `cardInputFrom()`:

```ts
/** The instalment named in a query, or undefined when it is one the company does not sell. */
function modeFrom(params: URLSearchParams): PayMode | undefined {
  const raw = params.get("mode");
  return raw === "annual" || raw === "semi" || raw === "monthly" ? raw : undefined;
}

/** The insured named in a query, or undefined when either half is missing or impossible. */
function insuredFrom(params: URLSearchParams): { age: number; sex: Sex } | undefined {
  const age = Number(params.get("age"));
  if (!Number.isInteger(age) || age < 0 || age > 99) return undefined;
  const sex = params.get("sex");
  if (sex !== "M" && sex !== "F") return undefined;
  return { age, sex };
}

function bundleInputFrom(code: string, params: URLSearchParams): BundleCardInput | undefined {
  const bundle = getBundle(code);
  if (!bundle) return undefined;
  const tier = Number(params.get("tier"));
  if (!bundle.tiers.some((t) => t.no === tier)) return undefined;
  const who = insuredFrom(params);
  if (!who) return undefined;
  return { kind: "bundle", bundleCode: code, tier, ...who, mode: modeFrom(params) };
}
```

Then rewrite `cardInputFrom()` to try the bundle first and to use the two new helpers:

```ts
export function cardInputFrom(params: URLSearchParams): CardInput | undefined {
  const bundleCode = params.get("bundle");
  if (bundleCode) return bundleInputFrom(bundleCode, params);

  const planCode = params.get("plan") ?? "";
  const plan = getPlan(planCode);
  if (!plan) return undefined;
  const variant = params.get("variant") ?? plan.defaultVariant ?? "";
  if (!(variant in plan.variantLabels)) return undefined;
  const who = insuredFrom(params);
  if (!who) return undefined;
  const sumAssured = Number(params.get("sum"));
  if (!Number.isInteger(sumAssured) || sumAssured <= 0) return undefined;
  return { kind: "plan", planCode, variant, ...who, sumAssured, mode: modeFrom(params) };
}
```

- [ ] **Step 5: Write a bundle into the address**

In `src/lib/quote-card.ts`, replace the body of `cardPath()`:

```ts
export function cardPath(input: CardInput): string {
  const q = input.kind === "bundle"
    ? new URLSearchParams({
      bundle: input.bundleCode,
      tier: String(input.tier),
      age: String(input.age),
      sex: input.sex,
    })
    : new URLSearchParams({
      plan: input.planCode,
      variant: input.variant,
      age: String(input.age),
      sex: input.sex,
      sum: String(input.sumAssured),
    });
  if (input.mode) q.set("mode", input.mode);
  return `/api/card?${q.toString()}`;
}
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run tests/calc/bundle-card.test.ts tests/calc/quote-card.test.ts`

Expected: PASS. The plan-card tests must still pass untouched — `cardPath` for a plan produces the same string as before.

- [ ] **Step 7: Commit**

```bash
git add src/lib/quote-card.ts tests/calc/bundle-card.test.ts
git commit -m "feat(card): address a card by bundle and tier

A bundle card is named by what the agency sells rather than by sums
assured. A link that could set the sums could describe an arrangement
the agency does not sell, which is the same reason a card has never
carried its own premium."
```

---

## Task 3: The bundle card itself

**Files:**
- Modify: `src/lib/quote-card.ts`
- Test: `tests/calc/bundle-card.test.ts`

Every figure below is the engine's, taken from a run against the committed rate tables. They agree with `tests/golden/legacy-family.test.ts`, where ชาย 40 มรดก 1 ล้าน is 7,752 บาท a year.

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/bundle-card.test.ts`. Extend the first import line to bring in `quoteCard` and `QuoteCard`:

```ts
import { cardInputFrom, cardPath, quoteCard, type BundleCardInput, type QuoteCard } from "@/lib/quote-card";
```

Then append:

```ts
/** The rate table behind these figures lapses on 2027-03-31. */
const WHILE_CURRENT = new Date("2026-09-05");

const section = (card: QuoteCard, title: string) => card.sections.find((s) => s.title === title);

const PARTS = "ชุดนี้ประกอบด้วย";
const DEATH = "ครอบครัวได้รับเมื่อเสียชีวิต";
const ILLNESS = "ตรวจพบโรคร้ายแรง รับเงินก้อน";
const CASH = "มูลค่าเงินสดสะสม (หากเวนคืน)";

describe("quoteCard, for a bundle", () => {
  it("names the bundle and the tier the customer picked", () => {
    const card = quoteCard(MAN40, WHILE_CURRENT)!;
    expect(card.planLine).toBe("ชุดมรดกเพื่อครอบครัว");
    expect(card.insuredLine).toBe("ชาย 40 ปี · มรดก 1 ล้าน");
  });

  /**
   * 7,752 a year is the figure the golden test reads off the rate tables. The monthly
   * instalment is 698, under the company's 1,000 minimum, so it is neither the headline nor
   * offered among the others.
   */
  it("headlines the yearly premium when the monthly one cannot be paid", () => {
    const card = quoteCard(MAN40, WHILE_CURRENT)!;
    expect(card.premium).toEqual({ amount: "7,752", per: "ต่อปี" });
    expect(card.perDay).toBe("ตกวันละ 22 บาท");
    expect(card.others).toBe("ราย 6 เดือน 4,031 บาท");
  });

  it("says what the arrangement is made of", () => {
    expect(section(quoteCard(MAN40, WHILE_CURRENT)!, PARTS)).toEqual({
      title: PARTS,
      rows: [
        { label: "Life Protect x 2 — ชำระเบี้ยครบอายุ 99 ปี", amount: "150,000" },
        { label: "สัญญาเพิ่มเติมโรคร้ายแรง (DCI)", amount: "850,000" },
      ],
    });
  });

  /**
   * Three bands, not two: the base doubles before 60, and the rider stops at 75. A card that
   * said "อายุ 60 ปีขึ้นไป — 1,000,000" would promise cover that has ended.
   */
  it("bands the death benefit around both the doubling and the rider's end", () => {
    expect(section(quoteCard(MAN40, WHILE_CURRENT)!, DEATH)).toEqual({
      title: DEATH,
      rows: [
        { label: "เสียชีวิตก่อนอายุ 60 ปี", amount: "1,150,000" },
        { label: "อายุ 60–74 ปี", amount: "1,000,000" },
        { label: "อายุ 75 ปีขึ้นไป", amount: "150,000" },
      ],
    });
  });

  it("states the lump sum a diagnosis pays", () => {
    expect(section(quoteCard(MAN40, WHILE_CURRENT)!, ILLNESS)).toEqual({
      title: ILLNESS,
      rows: [{ label: "จ่ายครั้งเดียว", amount: "850,000" }],
    });
  });

  /** The surrender value belongs to the 150,000 base alone, which is why it reads small. */
  it("quotes the surrender value of the base plan", () => {
    expect(section(quoteCard(MAN40, WHILE_CURRENT)!, CASH)!.rows).toEqual([
      { label: "อายุ 60 ปี", amount: "31,500" },
      { label: "อายุ 70 ปี", amount: "64,050" },
      { label: "อายุ 80 ปี", amount: "101,250" },
      { label: "อายุ 99 ปี", amount: "182,400" },
    ]);
  });

  it("reads the four blocks in the order the customer needs them", () => {
    expect(quoteCard(MAN40, WHILE_CURRENT)!.sections.map((s) => s.title))
      .toEqual([PARTS, DEATH, ILLNESS, CASH]);
  });

  /**
   * DCI is priced on attained age, so the premium climbs every year. A picture outlives the
   * sentence that framed it, so the card has to say so itself.
   */
  it("says the premium is a first-year premium, and why it rises", () => {
    const notes = quoteCard(MAN40, WHILE_CURRENT)!.notes;
    expect(notes[0]).toBe("เบี้ยปีแรกโดยประมาณ · ตารางเบี้ยฉบับ A2026-1");
    expect(notes[1]).toBe("สัญญาโรคร้ายแรงคิดตามอายุ เบี้ยจึงปรับขึ้นในปีถัดไป");
    expect(notes[2]).toBe("ไม่ใช่ใบเสนอราคา ผลประโยชน์เป็นไปตามที่ระบุในกรมธรรม์");
  });

  it("draws no card for an insured the bundle cannot be issued to", () => {
    // DCI leaves the bundle a 20-65 window
    expect(quoteCard({ ...MAN40, age: 19 }, WHILE_CURRENT)).toBeUndefined();
    expect(quoteCard({ ...MAN40, age: 66 }, WHILE_CURRENT)).toBeUndefined();
  });

  it("draws no card for a tier the bundle does not sell", () => {
    expect(quoteCard({ ...MAN40, tier: 99 }, WHILE_CURRENT)).toBeUndefined();
  });

  it("draws no card for a bundle the registry does not hold", () => {
    expect(quoteCard({ ...MAN40, bundleCode: "NOPE" }, WHILE_CURRENT)).toBeUndefined();
  });

  /** A lapsed table has no price, but the cover it was priced against is still what it is. */
  it("keeps the benefits and drops the price once the rate table has lapsed", () => {
    const card = quoteCard(MAN40, new Date("2027-04-01"))!;
    expect(card.premium).toBeNull();
    expect(card.perDay).toBeNull();
    expect(card.others).toBeNull();
    expect(card.notes[0]).toContain("หมดอายุ");
    expect(section(card, DEATH)!.rows[0].amount).toBe("1,150,000");
  });

  /** Every tier is the same 150,000 base, so only the rider and the totals move. */
  it("prices the top tier off the same base", () => {
    const card = quoteCard({ ...MAN40, tier: 10 }, WHILE_CURRENT)!;
    expect(card.insuredLine).toBe("ชาย 40 ปี · มรดก 10 ล้าน");
    expect(card.premium).toEqual({ amount: "5,168", per: "ต่อเดือน" });
    expect(section(card, ILLNESS)!.rows[0].amount).toBe("9,850,000");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/bundle-card.test.ts`

Expected: FAIL — `quoteCard` rejects a `BundleCardInput`.

- [ ] **Step 3: Split `quoteCard` into a dispatcher and the plan builder**

In `src/lib/quote-card.ts`, rename the existing `quoteCard` to `planCard`, narrow its parameter, and make it private:

```ts
function planCard(input: PlanCardInput, today: Date): QuoteCard | undefined {
```

Its body is unchanged. Then add the public entry point directly above it:

```ts
/**
 * The card for an arrangement, or undefined when the company would not issue it — a card
 * that says nothing is worse than no card, and the chat still has its own words for why.
 */
export function quoteCard(input: CardInput, today: Date = new Date()): QuoteCard | undefined {
  return input.kind === "bundle" ? bundleCard(input, today) : planCard(input, today);
}
```

- [ ] **Step 4: Write the bundle builder**

In `src/lib/quote-card.ts`, below `planCard()`:

```ts
/**
 * The rider a bundle pays a critical-illness lump sum through. Named here rather than
 * inferred, because "what this pays on a diagnosis" is a claim about a specific contract and
 * a bundle built on some other rider must not inherit the sentence.
 */
const CI_RIDER = "DCI";

/**
 * The card for one tier of an agency bundle.
 *
 * A bundle is sold whole, so it is drawn whole: what it is made of, what the family receives,
 * what a diagnosis pays, and what surrender would return. The premium is priced from the rate
 * tables at draw time exactly as a plan's is, so the link cannot make the company advertise a
 * figure it never quoted.
 */
function bundleCard(input: BundleCardInput, today: Date): QuoteCard | undefined {
  const bundle = getBundle(input.bundleCode);
  const tier = bundle?.tiers.find((t) => t.no === input.tier);
  if (!bundle || !tier) return undefined;

  const who = { age: input.age, sex: input.sex };
  const result = quoteBundle(bundle, input.tier, { ...who, mode: "annual" }, today);
  if (!result) return undefined;
  // a bundle that cannot be issued whole is no longer the arrangement the agency designed,
  // and a picture of it would be a picture of something nobody can buy. MIN_MONTHLY is not
  // that: it is a fact about one instalment, and the card answers it by headlining the year.
  if (result.warnings.some((w) => w.level === "error" && w.code !== "MIN_MONTHLY")) return undefined;

  const modes = bundleModePremiums(bundle, input.tier, who, today);
  const headline = displayPremium(modes, result.meta.expired)
    ?? (input.mode && !result.meta.expired ? modes?.find((m) => m.mode === input.mode) : undefined);
  const annual = modes?.find((m) => m.mode === "annual");
  const others = (modes ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .map((m) => `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`);

  const covered = result.items.filter((it) => it.eligible);
  const ci = covered.find((it) => it.code === CI_RIDER);

  const sections: CardSection[] = [];
  if (covered.length) {
    sections.push({
      title: "ชุดนี้ประกอบด้วย",
      rows: covered.map((it) => ({ label: it.name, amount: money(it.amount) })),
    });
  }
  if (result.deathBenefit) sections.push(deathSection(result.deathBenefit));
  if (ci) {
    sections.push({
      title: "ตรวจพบโรคร้ายแรง รับเงินก้อน",
      rows: [{ label: "จ่ายครั้งเดียว", amount: money(ci.amount) }],
    });
  }
  const cashRows = cashRowsFor(bundle.planCode, bundle.variant, input.sex, input.age, tier.sumAssured);
  if (cashRows.length) sections.push({ title: CASH_TITLE, rows: cashRows });

  return {
    planLine: `ชุด${bundle.name}`,
    insuredLine: `${SEX_WORD[input.sex]} ${input.age} ปี · ${tier.name}`,
    premium: headline ? { amount: formatBaht(headline.total), per: PER_LABEL[headline.mode] } : null,
    perDay: headline && annual && !result.meta.expired ? `ตกวันละ ${perDay(annual.total)} บาท` : null,
    others: others.length ? others.join(" · ") : null,
    sections,
    notes: result.meta.expired
      ? ["ตารางเบี้ยชุดนี้หมดอายุแล้ว ขอราคาปัจจุบันได้ทางแชท", "ไม่ใช่ใบเสนอราคา และไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย"]
      : [
        // DCI is priced on attained age, so every figure here is a first-year figure. A
        // picture outlives the sentence that framed it, so it has to carry the caveat itself.
        `เบี้ยปีแรกโดยประมาณ · ตารางเบี้ยฉบับ ${result.meta.version}`,
        ...(ci ? ["สัญญาโรคร้ายแรงคิดตามอายุ เบี้ยจึงปรับขึ้นในปีถัดไป"] : []),
        "ไม่ใช่ใบเสนอราคา ผลประโยชน์เป็นไปตามที่ระบุในกรมธรรม์",
      ],
  };
}
```

Extend the bundle imports at the top of the file:

```ts
import { getBundle } from "@/calc/bundles/registry";
import { bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/calc/bundle-card.test.ts`

Expected: PASS, 18 tests.

- [ ] **Step 6: Run the whole suite and the types**

Run: `npx tsc --noEmit && npx vitest run`

Expected: no type errors, every test passing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/quote-card.ts tests/calc/bundle-card.test.ts
git commit -m "feat(card): draw the card for an agency bundle

A bundle is sold whole, so it is drawn whole — what it is made of, what
the family receives, what a diagnosis pays, what surrender returns.

The notes carry the one thing a picture has to say for itself: DCI is
priced on attained age, so the figure is a first-year figure and will
not be the price next year. The death bands come from deathBenefitRows,
which is what makes the card say อายุ 60–74 ปี over a sum the rider
stops paying at 75."
```

---

## Task 4: The chat's bundle answer carries the card

**Files:**
- Modify: `src/lib/assistant/answer.ts:131-182`
- Test: `tests/calc/assistant-bundle.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/assistant-bundle.test.ts`. Check the file's existing imports first and add only what is missing:

```ts
describe("the bundle answer's card", () => {
  it("carries a card once it has priced the arrangement", () => {
    const answer = answerBundle({
      intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 1, age: 40, sex: "M",
    });
    expect(answer.priced).toBe(true);
    expect(answer.card).toBe("/api/card?bundle=LEGACY_FAMILY&tier=1&age=40&sex=M");
  });

  it("passes on the instalment the customer asked in", () => {
    const answer = answerBundle({
      intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 1, age: 40, sex: "M", mode: "monthly",
    });
    expect(answer.card).toBe("/api/card?bundle=LEGACY_FAMILY&tier=1&age=40&sex=M&mode=monthly");
  });

  /** While the chat is still collecting the insured there is nothing to draw. */
  it("sends no card while it is still asking who the customer is", () => {
    expect(answerBundle({ intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 1 }).card).toBeUndefined();
    expect(answerBundle({ intent: "quote", bundleCode: "LEGACY_FAMILY", age: 40, sex: "M" }).card)
      .toBeUndefined();
  });

  it("sends no card for an age the bundle cannot be issued at", () => {
    expect(answerBundle({
      intent: "quote", bundleCode: "LEGACY_FAMILY", tier: 1, age: 70, sex: "M",
    }).card).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/assistant-bundle.test.ts`

Expected: FAIL — `answer.card` is `undefined` where a path was expected.

- [ ] **Step 3: Attach the path**

In `src/lib/assistant/answer.ts`, the final `return` of `answerBundle()` becomes:

```ts
  return {
    reply: bundleReply(bundle.name, tierName, who, result, bundleModePremiums(bundle, slots.tier, who)),
    sources: [], priced: true,
    card: cardPath({
      kind: "bundle", bundleCode: bundle.code, tier: slots.tier, age: who.age, sex: who.sex,
      mode: slots.mode,
    }),
  };
```

`cardPath` is already imported at the top of the file for the single-plan answer, so no import changes.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/assistant-bundle.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the whole suite and the types**

Run: `npx tsc --noEmit && npx vitest run`

Expected: no type errors, every test passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/assistant/answer.ts tests/calc/assistant-bundle.test.ts
git commit -m "feat(assistant): send the bundle's card with its price

The chat handed a customer a picture of any single plan it priced and
nothing at all for the one product the agency sells under its own name.
The three channels needed no change: each already sends a picture
whenever the answer carries one."
```

---

## Task 5: The written answer says the premium is a first-year premium

The card now says it. The sentence the customer reads above the card still does not, and the same omission is the same problem in both places.

**Files:**
- Modify: `src/lib/assistant/format.ts:106-145`
- Test: `tests/calc/assistant-format.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/assistant-format.test.ts`. Check the file's existing imports and helpers first — it already builds a `QuoteResult` for `bundleReply`; reuse that rather than writing a second fixture.

```ts
describe("bundleReply's closing note", () => {
  /**
   * DCI is priced on attained age. A customer who is told "7,752 บาท" and not told it is a
   * first-year figure has been told the wrong thing, whether it arrives as words or a picture.
   */
  it("says the premium is a first-year premium when a rider is priced on age", () => {
    const bundle = getBundle("LEGACY_FAMILY")!;
    const who = { age: 40, sex: "M" as const };
    const result = quoteBundle(bundle, 1, { ...who, mode: "annual" })!;
    const reply = bundleReply(bundle.name, "มรดก 1 ล้าน", who, result, undefined);
    expect(reply).toContain("เบี้ยปีแรก");
    expect(reply).toContain("ปรับขึ้นในปีถัดไป");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/calc/assistant-format.test.ts`

Expected: FAIL — the reply ends "เบี้ยประมาณการจากตารางเบี้ยบริษัท ไม่ใช่ใบเสนอราคา".

- [ ] **Step 3: Say it**

In `src/lib/assistant/format.ts`, replace the closing line of `bundleReply()`:

```ts
  blocks.push("· เบี้ยประมาณการจากตารางเบี้ยบริษัท ไม่ใช่ใบเสนอราคา");
```

with:

```ts
  // A rider priced on attained age makes every figure above a first-year figure. Saying so
  // is not small print: it is the difference between a quote and a promise the premium holds.
  const risesWithAge = result.items.some((it) => it.eligible && it.code === "DCI");
  blocks.push(risesWithAge
    ? "· เบี้ยปีแรกโดยประมาณ สัญญาโรคร้ายแรงคิดตามอายุ เบี้ยจึงปรับขึ้นในปีถัดไป ไม่ใช่ใบเสนอราคา"
    : "· เบี้ยประมาณการจากตารางเบี้ยบริษัท ไม่ใช่ใบเสนอราคา");
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/calc/assistant-format.test.ts`

Expected: PASS.

- [ ] **Step 5: Run the whole suite and the types**

Run: `npx tsc --noEmit && npx vitest run`

Expected: no type errors, every test passing.

- [ ] **Step 6: Commit**

```bash
git add src/lib/assistant/format.ts tests/calc/assistant-format.test.ts
git commit -m "fix(assistant): call the bundle's premium a first-year premium

The sales page has always said DCI is priced on attained age and climbs.
The chat quoted the same arrangement and said only เบี้ยประมาณการ, which
reads as a price that holds. Same omission the card was about to repeat."
```

---

## Task 6: Look at the picture before it ships

Tests prove the figures. Only looking proves the card is worth sending.

**Files:** none — this task changes nothing.

- [ ] **Step 1: Draw the three cards that matter**

The dev server runs on port 3000. Save into the session scratchpad, not the repo:

```bash
D=/private/tmp/claude-501/-Users-pheerapatpisit-Documents-APP-Ai-Assis/52e941de-40bb-4cf4-b5af-301dff51cef6/scratchpad
curl -s "http://localhost:3000/api/card?bundle=LEGACY_FAMILY&tier=1&age=40&sex=M" -o $D/bundle-t1.png -w "t1  %{http_code} %{size_download}\n"
curl -s "http://localhost:3000/api/card?bundle=LEGACY_FAMILY&tier=10&age=40&sex=M" -o $D/bundle-t10.png -w "t10 %{http_code} %{size_download}\n"
curl -s "http://localhost:3000/api/card?bundle=LEGACY_FAMILY&tier=5&age=55&sex=F" -o $D/bundle-t5f.png -w "t5f %{http_code} %{size_download}\n"
```

Expected: three `200`s.

- [ ] **Step 2: Check the refusals return 400, not a broken picture**

```bash
curl -s -o /dev/null -w "age 19   %{http_code}\n" "http://localhost:3000/api/card?bundle=LEGACY_FAMILY&tier=1&age=19&sex=M"
curl -s -o /dev/null -w "tier 99  %{http_code}\n" "http://localhost:3000/api/card?bundle=LEGACY_FAMILY&tier=99&age=40&sex=M"
curl -s -o /dev/null -w "no such  %{http_code}\n" "http://localhost:3000/api/card?bundle=NOPE&tier=1&age=40&sex=M"
```

Expected: `400` on all three.

- [ ] **Step 3: Read the three images**

Open each PNG with the Read tool and check, by eye:

- nothing overlaps — the tallest card is the four-section one, and Satori will stack text on top of itself rather than grow the canvas if `heightOf()` and the bands disagree
- the Thai renders as letters, not boxes
- the first-year note is legible at the foot
- tier 10 headlines a monthly figure (5,168) while tier 1 headlines a yearly one — the monthly minimum is doing its job

- [ ] **Step 4: Show the user and ask**

Send the three images and ask whether to keep them. Nothing merges before that answer.

---

## Self-Review

**Spec coverage**

| Spec section | Task |
|---|---|
| การ์ดหน้าตาเป็นยังไง | 3 |
| เบี้ยปีแรก — on the card | 3 |
| เบี้ยปีแรก — in the reply | 5 |
| ช่องบนการ์ด (4 sections incl. cash) | 3 |
| ช่วงอายุบนช่องเสียชีวิต | 1 (`deathSection`), 3 |
| หนึ่ง — sections list | 1 |
| สอง — CardInput union | 2 |
| สาม — bundleCard | 3 |
| สี่ — answerBundle | 4 |
| การ์ดจะไม่ออกเมื่อไหร่ (7 rows) | 2 (400s), 3 (undefined), 4 (no card) |
| ความปลอดภัยของลิงก์ | 2 |
| การทดสอบ | every task |
| ไม่ทำในรอบนี้ | nothing in this plan touches them |

**MIN_MONTHLY** appears in the spec as the one error that must not suppress a card. Task 3 covers it twice: the `!== "MIN_MONTHLY"` guard, and the tier-1 test whose headline is yearly because 698 is under the minimum.

**Type consistency**

- `CardSection { title, rows }` — defined Task 1, used Tasks 1 and 3.
- `PlanCardInput` / `BundleCardInput` / `CardInput` — defined Tasks 1 and 2, used 2, 3, 4.
- `planCard(input, today)` private, `quoteCard(input, today?)` exported — Tasks 1 and 3 agree.
- `deathSection(db)` and `cashRowsFor(planCode, variant, sex, age, sumAssured)` — defined Task 1 Step 5, called Task 1 Step 4 and Task 3 Step 4 with those exact signatures.
- `CASH_TITLE` and `CI_RIDER` — module constants, used only in the file that defines them.
- `cardPath` takes the union in Task 2 and is called with a `kind: "bundle"` object in Task 4.

**One thing the plan cannot promise:** Task 1 Step 10 compares byte counts against a card drawn earlier in the conversation. If the dev server has restarted, or a font or rate table has since changed, the number will differ for reasons unrelated to the refactor. Read the image rather than trusting the byte count if it disagrees.
