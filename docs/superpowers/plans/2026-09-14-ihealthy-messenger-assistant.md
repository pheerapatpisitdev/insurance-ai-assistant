# Health-Insurance Brain for the Messenger Bot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the live Messenger bot a second brain that sells ไอเฮลท์ตี้ อัลตร้า — a keyword step that settles which plan a message is about, a menu of the three phone plans as a picture, and a quotation whose words and figures are the sales page's own.

**Architecture:** `conversation.ts` stops calling `answerQuestion()` and calls `answerAny()` in a new `dispatch.ts`. `dispatch` reads `slots.product`, asks `choose.ts` when it is unset, and hands the turn to one of two brains: the existing Life Protect one (moved unchanged to `assistant/lifeprotect/`) or a new `assistant/ihealthy/` one. Everything both brains share moves to `assistant/common.ts`. No number is ever worded by a model: the menu comes from `iHealthyPricing()`, the quotation from `iHealthyQuoteText()`, the pictures from `/api/ihealthy-card`.

**Tech Stack:** Next.js 15 App Router · React 19 · TypeScript · vitest · `next/og` (`ImageResponse`) for the pictures · Supabase for sessions.

**Spec:** `docs/superpowers/specs/2026-09-14-ihealthy-messenger-assistant-design.md`

---

## Ground rules for every task

- **Verify before every commit.** The whole ship step is one `&&` chain, never two lines:
  `npm run verify && git add <paths> && git commit …`. A commit that is not the right-hand
  side of a passing `npm run verify` has reached `main` red before.
- **Stage by explicit path.** Other Claude sessions edit this same worktree. Read
  `git status --short` before each commit and account for every entry; anything you did not
  touch stays unstaged.
- **Commit email.** The repo is configured with `pheerapatpisit.dev@gmail.com`; Vercel blocks
  deploys from any other address. Do not override it.
- **Run one test file while iterating:** `npx vitest run tests/calc/<file>.test.ts`
- Commit messages end with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`.

## File structure

**New**

| File | Responsibility |
| --- | --- |
| `src/lib/ihealthy-phone.ts` | Which plans and rows a phone-width surface shows. One definition for the web page, the pictures and the bot. |
| `src/lib/assistant/common.ts` | What both brains share: the reply shape, the application form, the stall, the insurer answer. |
| `src/lib/assistant/slots.ts` | The union of what a session can be carrying, so `chat/session.ts` needs to know only one type. |
| `src/lib/assistant/choose.ts` | Which plan a message is about, and the two-button question when it does not say. |
| `src/lib/assistant/dispatch.ts` | `answerAny()` — the one entry point the webhook calls. |
| `src/lib/assistant/ihealthy/route.ts` | `HealthSlots`, the model that reads a health message into it, and the patterns read without a model. |
| `src/lib/assistant/ihealthy/menu.ts` | The three-plan menu: its words, its picture and its buttons. |
| `src/lib/assistant/ihealthy/quote.ts` | One plan quoted: the sales page's own text, the card, and every reason there is no price. |
| `src/lib/assistant/ihealthy/prompts.ts` | What the model is told on the two health routes, and the facts it is told them with. |
| `src/lib/assistant/ihealthy/faq.ts` | The health answers written by hand — the tax relief and the rising premium differ from Life Protect's. |
| `src/lib/assistant/ihealthy/answer.ts` | `answerHealth()` — picks the route and assembles the reply. |
| `src/app/api/ihealthy-card/draw.tsx` | The palette, the bands and the table primitives both pictures draw with. |
| `src/app/api/ihealthy-card/table/route.tsx` | The comparison table on its own, for the menu. |

**Moved** (`git mv`, behaviour unchanged) — `src/lib/assistant/{answer,route,faq}.ts` and the two
Life Protect prompts → `src/lib/assistant/lifeprotect/`.

**Modified** — `src/lib/ihealthy-quote.ts` (gains `shownAt`), `src/lib/ihealthy-card.ts` (`fit=phone`,
`iHealthyTableCard`), `src/app/api/ihealthy-card/route.tsx` (uses `draw.tsx`),
`src/components/ihealthy/BenefitTable.tsx` and `src/components/IHealthyCalculator.tsx` (import the
moved constants), `src/lib/facebook/conversation.ts` (one line), `src/lib/chat/session.ts` (slot type),
`tests/calc/chat-harness.test.ts` (rehearses either brain).

---

## Task 1: One definition of what a phone shows

`PHONE_PLANS` and `PHONE_ROW_LABEL` live in a React file that `src/lib/ihealthy-card.ts` already
reaches into. The bot needs them too, and it needs a third thing beside them: which columns a
phone-width picture carries for a given age and choice.

**Files:**
- Create: `src/lib/ihealthy-phone.ts`
- Modify: `src/components/ihealthy/BenefitTable.tsx:59-76` (delete the two constants, import them)
- Modify: `src/lib/ihealthy-card.ts:3` (import from the new module)
- Modify: `src/components/IHealthyCalculator.tsx:9` (import `PHONE_PLANS` from the new module)
- Test: `tests/calc/ihealthy-phone.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-phone.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { phoneColumns, PHONE_PLANS } from "@/lib/ihealthy-phone";

/** The six plans in the order the company's own sheet lists them. */
const ORDER = ["SMART", "BRONZE", "SILVER", "GOLD", "DIAMOND", "PLATINUM"];
const ADULT = ORDER;
/** Ages 6–10 buy only these two; the rate table says so and `plansFor` reads it off. */
const CHILD = ["SMART", "BRONZE"];

describe("the columns a phone-width picture carries", () => {
  it("is the three the sales page shows on a phone", () => {
    expect(phoneColumns(ORDER, ADULT)).toEqual(PHONE_PLANS);
    expect(PHONE_PLANS).toEqual(["BRONZE", "SILVER", "GOLD"]);
  });

  it("keeps a chosen plan that is not one of the three, in the sheet's order", () => {
    expect(phoneColumns(ORDER, ADULT, "PLATINUM")).toEqual(["BRONZE", "SILVER", "GOLD", "PLATINUM"]);
    expect(phoneColumns(ORDER, ADULT, "SMART")).toEqual(["SMART", "BRONZE", "SILVER", "GOLD"]);
  });

  it("does not repeat a chosen plan that is already one of the three", () => {
    expect(phoneColumns(ORDER, ADULT, "GOLD")).toEqual(["BRONZE", "SILVER", "GOLD"]);
  });

  it("falls back to every plan on sale when fewer than two of the three are", () => {
    expect(phoneColumns(ORDER, CHILD)).toEqual(CHILD);
    expect(phoneColumns(ORDER, CHILD, "SMART")).toEqual(CHILD);
  });

  it("never carries a plan the company will not sell at this age", () => {
    expect(phoneColumns(ORDER, CHILD, "PLATINUM")).toEqual(CHILD);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/ihealthy-phone.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/ihealthy-phone"`.

- [ ] **Step 3: Create the module**

Create `src/lib/ihealthy-phone.ts`. The two constants are **cut verbatim** from
`src/components/ihealthy/BenefitTable.tsx` (lines 47–76 there, comments included) so that the
wording the page was written with travels with them:

```ts
/**
 * What a phone shows of a table built for a sheet of paper.
 *
 * It began in the benefit table's own file, which is a React module — and `ihealthy-card.ts`,
 * which draws the same table as a picture, was reaching into it for these. The bot draws it
 * too now, so the answer to "which plans and which rows fit a narrow surface" lives on its
 * own rather than inside whichever surface asked first.
 */

/**
 * Three plans and three figures, chosen by the user. Six columns of Thai do not fit a phone
 * at a size worth reading, and forty-one rows of them is a document rather than a
 * comparison — so a phone gets the middle three plans and the three figures that separate
 * them, and the whole table waits on a wider screen.
 *
 * The plan being quoted is always kept, whichever it is: a link can arrive carrying
 * แพลทินั่ม and a child is sold สมาร์ท, and the column the card is pricing must not be the
 * one column missing from the table under it.
 */
export const PHONE_PLANS = ["BRONZE", "SILVER", "GOLD"];

/**
 * The rows a phone shows, and what to call them there.
 *
 * The company's own wording runs to thirteen lines in a column a phone can spare for it,
 * which is a paragraph where a label is wanted. The short form is the page's own and is only
 * ever a label: a wide screen and a printed sheet both keep the contract's words.
 */
export const PHONE_ROW_LABEL: Record<number, { icon: string; label: string }> = {
  1: { icon: "🛏️", label: "ค่าห้องและค่าอาหาร" },
  5: { icon: "🏥", label: "Day Surgery" },
  7: { icon: "🚑", label: "อุบัติเหตุ OPD 24 ชม" },
  10: { icon: "🎗️", label: "มะเร็ง รังสีรักษา" },
  18: { icon: "💊", label: "ผู้ป่วยนอก OPD" },
};

/**
 * The columns a phone-width picture carries, in the sheet's own order.
 *
 * `sellable` is what `plansFor` says the company writes at this age, and nothing outside it
 * is ever returned — a picture with a column the customer cannot buy is an advertisement for
 * something that does not exist. Ages 6–10 are sold two plans in total, which is fewer than
 * the three a phone shows, so they get both rather than a single column with nothing to
 * compare it against.
 */
export function phoneColumns(
  order: readonly string[], sellable: readonly string[], selected?: string,
): string[] {
  const sold = order.filter((code) => sellable.includes(code));
  const three = sold.filter((code) => PHONE_PLANS.includes(code));
  const shown = three.length >= 2 ? three : sold;
  const keep = selected && sold.includes(selected) && !shown.includes(selected)
    ? [...shown, selected]
    : shown;
  return order.filter((code) => keep.includes(code));
}
```

- [ ] **Step 4: Point the three existing readers at it**

In `src/components/ihealthy/BenefitTable.tsx`, delete the `PHONE_PLANS` and `PHONE_ROW_LABEL`
declarations together with their doc comments, and add to the imports at the top:

```ts
import { PHONE_PLANS, PHONE_ROW_LABEL } from "@/lib/ihealthy-phone";
```

In `src/lib/ihealthy-card.ts` line 3, split the import so the label comes from the new module:

```ts
import { benefitCell } from "@/components/ihealthy/BenefitTable";
import { PHONE_ROW_LABEL } from "@/lib/ihealthy-phone";
```

In `src/components/IHealthyCalculator.tsx` line 9, drop `PHONE_PLANS` from the `BenefitTable`
import and add it to the new one:

```ts
import { BenefitTable } from "@/components/ihealthy/BenefitTable";
import { PHONE_PLANS } from "@/lib/ihealthy-phone";
```

- [ ] **Step 5: Run the new test and the ones that could notice**

Run: `npx vitest run tests/calc/ihealthy-phone.test.ts tests/calc/ihealthy-card.test.ts tests/calc/ihealthy-page-data.test.ts`
Expected: PASS, all three files.

- [ ] **Step 6: Commit**

```bash
npm run verify && git add src/lib/ihealthy-phone.ts src/components/ihealthy/BenefitTable.tsx src/lib/ihealthy-card.ts src/components/IHealthyCalculator.tsx tests/calc/ihealthy-phone.test.ts && git commit -m "$(cat <<'MSG'
refactor(ihealthy): what a phone shows, said in one place

The two constants lived in the benefit table's React file and the picture
route was reaching in for them. The bot is about to draw the same table, so
they move to a module of their own, with the question the bot actually asks:
which columns fit a narrow surface at this age, with this plan chosen.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 2: Move `shownAt` off the client component

`shownAt()` and `IHealthyShown` sit in `IHealthyCalculator.tsx`, which is marked `"use client"`.
`ihealthy-cta.ts` already imports the type from there (type-only, so it is erased). The bot needs
the **function** on the server, and importing a value out of a client module from server code is
how a page ends up in the wrong bundle. It belongs beside the pricing it summarises.

**Files:**
- Modify: `src/lib/ihealthy-quote.ts` (add the interface and the function at the end)
- Modify: `src/components/IHealthyCalculator.tsx:32-81` (delete both, import them)
- Modify: `src/lib/ihealthy-cta.ts:6` (import the type from the new home)
- Test: `tests/calc/ihealthy-quote.test.ts` (existing file, add one describe block)

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/ihealthy-quote.test.ts`:

```ts
describe("the three figures a card headlines", () => {
  it("comes from the pricing, and drops an instalment the company refuses", async () => {
    const { iHealthyPricing, shownAt } = await import("@/lib/ihealthy-quote");
    const { iHealthyTable } = await import("@/lib/ihealthy-table");
    const table = iHealthyTable(new Date("2026-01-01"));
    const priced = iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 35, sumAssured: 150_000,
      plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    const shown = shownAt(priced, "annual")!;

    expect(shown.total).toBe(priced.total.find((m) => m.mode === "annual")!.total);
    expect(shown.base).toBe(priced.base.find((m) => m.mode === "annual")!.total);
    expect(shown.rider).toBe(priced.rider.find((m) => m.mode === "annual")!.total);
    // every other instalment is either offered or named as refused, never silently dropped
    expect(shown.others.length + shown.refused.length).toBe(2);
  });

  it("is nothing at all for an instalment the pricing does not carry", async () => {
    const { shownAt } = await import("@/lib/ihealthy-quote");
    expect(shownAt(undefined, "annual")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/ihealthy-quote.test.ts`
Expected: FAIL — `shownAt is not a function` (the module does not export it yet).

- [ ] **Step 3: Move the code**

Cut `IHealthyShown` (the interface with its doc comments) and `shownAt` from
`src/components/IHealthyCalculator.tsx` lines 32–81 and paste them verbatim at the end of
`src/lib/ihealthy-quote.ts`, adding one sentence to the function's comment:

```ts
/**
 * The three figures for the instalment on screen, or nothing at all.
 *
 * Nothing rather than a partial row: a mode the pricing turns out not to carry is a miss,
 * and a card that printed a total with no base line under it would read as a complete quote.
 *
 * It lived in the calculator until the bot needed it. The calculator is a client component,
 * and a server module importing a value out of one drags the whole component after it.
 */
```

Then in `src/components/IHealthyCalculator.tsx`, add `shownAt` and the type to the existing
import from `@/lib/ihealthy-quote` (line 11–13) and re-export the type, because
`IHealthyCalculatorProps` and `ihealthy-cta.ts` both name it:

```ts
import {
  MODES, dailyCashLabel, deathBenefitOf, iHealthyPricing, shownAt,
  type IHealthyPricing, type IHealthyShown,
} from "@/lib/ihealthy-quote";
export type { IHealthyShown };
```

And in `src/lib/ihealthy-cta.ts` line 6, take the type from its new home:

```ts
import type { IHealthyShown } from "@/lib/ihealthy-quote";
```

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/calc/ihealthy-quote.test.ts tests/calc/ihealthy-page-data.test.ts tests/calc/ihealthy-cta.test.ts`
Expected: PASS, all three.

- [ ] **Step 5: Commit**

```bash
npm run verify && git add src/lib/ihealthy-quote.ts src/components/IHealthyCalculator.tsx src/lib/ihealthy-cta.ts tests/calc/ihealthy-quote.test.ts && git commit -m "$(cat <<'MSG'
refactor(ihealthy): the card's three figures move beside the pricing

shownAt summarised a pricing from inside a "use client" component. The bot
needs it on the server, and a server module that imports a value out of a
client one drags the component along with it.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 3: Lift the drawing primitives out of the card route

Two routes are about to draw the same table. Move the shared half out first, changing nothing
about what is drawn.

**Files:**
- Create: `src/app/api/ihealthy-card/draw.tsx`
- Modify: `src/app/api/ihealthy-card/route.tsx` (keep only `GET` and the layout)
- Test: none of its own — `tests/calc/ihealthy-card.test.ts` already covers the description, and
  `next build` in `npm run verify` compiles the route.

- [ ] **Step 1: Create `draw.tsx` with the pieces moved verbatim**

Cut from `src/app/api/ihealthy-card/route.tsx`, keeping every doc comment: the eleven palette
constants (`GROUND` … `TINT`, lines 11–21), the canvas constants (`PAD`, `TITLE_W`, `COL_W`,
lines 31–33), the `H` band map (lines 37–65), `band`, `spacer`, `Line`, `Cell`, `Row`
(lines 80–152), and the two font lines (`FONT_DIR`, `loadFont`, lines 154–162). Paste them into
`src/app/api/ihealthy-card/draw.tsx`, `export` each one, and add this header plus two new
helpers in place of the deleted `COLUMNS`/`WIDTH` constants:

```tsx
import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The ink both health pictures are drawn with: the palette, the bands, and the three
 * primitives that put a table on a fixed canvas.
 *
 * It is a module rather than a second copy because the quote card and the comparison table
 * are the same table under two different headings — and a palette that drifted between them
 * would have the agency send two pictures that do not look like each other.
 */
```

```tsx
/**
 * How wide a canvas with this many plan columns has to be.
 *
 * It was a constant for six. A phone gets three, and a canvas still sized for six would
 * print them against half a page of empty ground — which in a chat is a picture the reader
 * has to pinch to read the small half of.
 */
export function widthOf(columns: number): number {
  return PAD * 2 + TITLE_W + COL_W * columns;
}

/** The three faces, loaded once per request, in the shape `ImageResponse` wants them. */
export async function loadFonts() {
  const [regular, semibold, display] = await Promise.all([
    loadFont("IBMPlexSansThai-Regular.ttf"),
    loadFont("IBMPlexSansThai-SemiBold.ttf"),
    loadFont("Trirong-SemiBold.ttf"),
  ]);
  return [
    { name: "Plex", data: regular, weight: 400 as const, style: "normal" as const },
    { name: "Plex", data: semibold, weight: 600 as const, style: "normal" as const },
    { name: "Trirong", data: display, weight: 600 as const, style: "normal" as const },
  ];
}

/** One day at the edge, an hour in a browser — the same as every other card here. */
export const CARD_HEADERS = {
  "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400",
};
```

- [ ] **Step 2: Rewrite the head and tail of `route.tsx`**

Replace the deleted block with one import, and keep `heightOf` in the route (it is this
picture's own arithmetic):

```tsx
import { readFile } from "node:fs/promises";   // ← delete, now unused
import path from "node:path";                   // ← delete, now unused
```

The file's imports become:

```tsx
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { iHealthyCard, type IHealthyCard } from "@/lib/ihealthy-card";
import {
  CARD_HEADERS, Cell, GOLD, GOLD_LIT, GRID, GROUND, GROUND_DEEP, H, Line, MUTE, PAD, Row,
  RULE, TINT, TITLE_W, COL_W, WHITE, band, loadFonts, spacer, widthOf,
} from "./draw";
```

Delete the `const [regular, semibold, display] = await Promise.all([...])` block from `GET` and
replace the `ImageResponse` options with:

```tsx
    {
      width: widthOf(card.columns.length),
      height: heightOf(card),
      fonts: await loadFonts(),
      headers: CARD_HEADERS,
    },
```

Delete any import left unused (`CardCell` stays if `Cell`'s signature still needs it — check the
compiler, not your memory).

- [ ] **Step 3: Prove the picture still renders**

Run: `npm run verify`
Expected: PASS — `tsc --noEmit` reports no unused or missing imports, and `next build` compiles
both routes.

- [ ] **Step 4: Commit**

```bash
npm run verify && git add src/app/api/ihealthy-card/draw.tsx src/app/api/ihealthy-card/route.tsx && git commit -m "$(cat <<'MSG'
refactor(card): the health picture's ink, in a module of its own

A second picture is about to draw the same table under a different heading.
The palette, the bands and the three table primitives move out first, with no
change to what is drawn — and the canvas width becomes a function of how many
plan columns there are, instead of a constant six.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 4: A phone-width quote card

**Files:**
- Modify: `src/lib/ihealthy-card.ts` (read `fit`, narrow the columns)
- Test: `tests/calc/ihealthy-card.test.ts` (existing file, add one describe block)

- [ ] **Step 1: Write the failing test**

Append to `tests/calc/ihealthy-card.test.ts`:

```ts
describe("a card sized for a chat", () => {
  const at = (params: Record<string, string>) =>
    iHealthyCard(new URLSearchParams({ age: "35", sex: "F", plan: "GOLD", ...params }));

  it("carries six plans when nothing asks for fewer", () => {
    expect(at({}).columns).toHaveLength(6);
  });

  it("carries the three a phone shows when it does", () => {
    const card = at({ fit: "phone" });
    expect(card.columns.map((c) => c.name)).toEqual(["บรอนซ์", "ซิลเวอร์", "โกลด์"]);
    expect(card.columns.filter((c) => c.selected)).toHaveLength(1);
  });

  it("keeps the plan it is pricing, even outside the three", () => {
    const card = at({ plan: "PLATINUM", fit: "phone" });
    expect(card.columns.map((c) => c.name)).toEqual(["บรอนซ์", "ซิลเวอร์", "โกลด์", "แพลทินั่ม"]);
    expect(card.columns.find((c) => c.selected)!.name).toBe("แพลทินั่ม");
  });

  it("carries only what a child may buy", () => {
    const card = iHealthyCard(new URLSearchParams({ age: "8", sex: "M", plan: "SMART", fit: "phone" }));
    expect(card.columns.map((c) => c.name)).toEqual(["สมาร์ท", "บรอนซ์"]);
    expect(card.columns.every((c) => c.sold)).toBe(true);
  });

  it("prices every column it carries", () => {
    const card = at({ fit: "phone" });
    for (const row of card.premiumRows) expect(row.cells).toHaveLength(card.columns.length);
    for (const row of card.rows) {
      if (row.span === undefined) expect(row.cells).toHaveLength(card.columns.length);
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/ihealthy-card.test.ts`
Expected: FAIL — the `fit: "phone"` card still has 6 columns.

- [ ] **Step 3: Narrow the columns in `iHealthyCard`**

In `src/lib/ihealthy-card.ts`, add the import:

```ts
import { PHONE_ROW_LABEL, phoneColumns } from "@/lib/ihealthy-phone";
```

Inside `iHealthyCard()`, immediately after `const sellable = plansFor(table, v.age).map((p) => p.code);`
insert:

```ts
  /**
   * The plans this picture has room for.
   *
   * `fit=phone` is asked for by the bot and never by the page: six columns of Thai on a
   * canvas a chat scales to the width of a phone is a table nobody reads without pinching.
   * The plan being priced is always among them, so the column the headline belongs to is
   * never the one left out.
   */
  const order = facts.plans.map((p) => p.code);
  const shown = query.get("fit") === "phone"
    ? phoneColumns(order, sellable, v.plan)
    : order;
  const drawn = facts.plans.filter((p) => shown.includes(p.code));
```

Then replace the three places that walk every plan — the `columns` map, `cellsOf`, and the
`rows` lookup — with `drawn`:

```ts
  const columns: CardColumn[] = drawn.map((p) => ({
    name: planLabel(p.code),
    ceiling: MILLIONS(p.annualMax),
    selected: p.code === v.plan,
    sold: sellable.includes(p.code),
  }));
  const cellsOf = (get: (code: string) => string): CardCell[] =>
    drawn.map((p) => ({ text: get(p.code), dim: !sellable.includes(p.code) }));
```

and inside the first `rows` entry:

```ts
    { label: "วงเงินค่ารักษาต่อปี", cells: cellsOf((code) => {
      const plan = drawn.find((p) => p.code === code)!;
      return MILLIONS(plan.annualMax);
    }) },
```

`byPlan` and `premiumRows` need no change: `premiumRows` is built with `cellsOf`, and `byPlan`
pricing a plan the picture does not draw costs nothing.

- [ ] **Step 4: Run the tests**

Run: `npx vitest run tests/calc/ihealthy-card.test.ts`
Expected: PASS, including every test that was there before (`fit` absent still means six).

- [ ] **Step 5: Commit**

```bash
npm run verify && git add src/lib/ihealthy-card.ts tests/calc/ihealthy-card.test.ts && git commit -m "$(cat <<'MSG'
feat(card): a health card that fits the phone it is read on

fit=phone narrows the table under the quote to the three plans the sales page
shows on a phone, plus whichever one is being priced. The page asks for no
fit and still gets all six.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 5: The comparison table as a picture of its own

The menu sends a table with no quotation over it: no headline premium, no death benefit, no
highlighted column — six lines of Thai in a chat is not something a customer reads, and a table is.

**Files:**
- Modify: `src/lib/ihealthy-card.ts` (add `IHealthyTableCard` and `iHealthyTableCard`)
- Create: `src/app/api/ihealthy-card/table/route.tsx`
- Test: `tests/calc/ihealthy-table-card.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-table-card.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { iHealthyCard, iHealthyTableCard } from "@/lib/ihealthy-card";

const query = (extra: Record<string, string> = {}) =>
  new URLSearchParams({ age: "35", sex: "F", plan: "GOLD", fit: "phone", ...extra });

describe("the comparison table on its own", () => {
  it("says who it is for and what it rides on", () => {
    const card = iHealthyTableCard(query());
    expect(card.headLine).toBe("iHealthy Ultra · เปรียบเทียบแผน");
    expect(card.insuredLine).toContain("หญิง 35 ปี");
    expect(card.insuredLine).toContain("150,000");
    expect(card.insuredLine).toContain("ประเทศไทย");
  });

  it("singles out no plan, because none has been chosen", () => {
    const card = iHealthyTableCard(query());
    expect(card.columns.map((c) => c.name)).toEqual(["บรอนซ์", "ซิลเวอร์", "โกลด์"]);
    expect(card.columns.every((c) => c.selected === false)).toBe(true);
  });

  it("says the same thing as the table under a quote card", () => {
    const q = query();
    const quote = iHealthyCard(new URLSearchParams(q));
    const table = iHealthyTableCard(new URLSearchParams(q));
    expect(table.rows).toEqual(quote.rows);
    expect(table.premiumRows).toEqual(quote.premiumRows);
  });

  it("says what the premium rows are made of", () => {
    const card = iHealthyTableCard(query());
    expect(card.notes[0]).toContain("เบี้ยรวมสัญญาหลัก ค่ารักษา และค่าชดเชยรายวัน");
    expect(card.notes.some((n) => n.includes("เบี้ยปีแรก"))).toBe(true);
    expect(card.notes.some((n) => n.includes("ไม่ใช่ใบเสนอราคา"))).toBe(true);
  });

  it("shows a child only the plans a child may buy", () => {
    const card = iHealthyTableCard(query({ age: "8", plan: "SMART" }));
    expect(card.columns.map((c) => c.name)).toEqual(["สมาร์ท", "บรอนซ์"]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/ihealthy-table-card.test.ts`
Expected: FAIL — `iHealthyTableCard is not a function`.

- [ ] **Step 3: Describe the picture**

Append to `src/lib/ihealthy-card.ts`:

```ts
/**
 * The comparison table with nothing over it.
 *
 * The quote card answers "what does this plan cost me"; this answers the question before it,
 * "which of these am I buying" — so it carries no headline premium, no death benefit and no
 * highlighted column, and its premium rows are the whole of its point rather than a footnote
 * under one.
 *
 * Every figure is `iHealthyCard`'s, taken from the same call: two pictures sent one after the
 * other that disagreed about a premium would be worse than sending neither.
 */
export interface IHealthyTableCard {
  headLine: string;
  /** who it is for and what it rides on */
  insuredLine: string;
  columns: CardColumn[];
  rows: CardTableRow[];
  premiumRows: { label: string; cells: CardCell[] }[];
  notes: string[];
}

export function iHealthyTableCard(query: URLSearchParams, today: Date = new Date()): IHealthyTableCard {
  const card = iHealthyCard(query, today);
  const hidden = card.notes[0];
  return {
    headLine: "iHealthy Ultra · เปรียบเทียบแผน",
    insuredLine: card.insuredLine,
    // nothing is chosen yet, so nothing is lit
    columns: card.columns.map((c) => ({ ...c, selected: false })),
    rows: card.rows,
    premiumRows: card.premiumRows,
    notes: [
      "เบี้ยรวมสัญญาหลัก ค่ารักษา และค่าชดเชยรายวัน" + (hidden ? ` · ${hidden}` : ""),
      ...card.notes.slice(1),
    ],
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/ihealthy-table-card.test.ts`
Expected: PASS.

- [ ] **Step 5: Draw it**

Create `src/app/api/ihealthy-card/table/route.tsx`. It is the quote route's lower half with the
upper half removed — copy the table section (the header row, `card.rows`, the section rule, and
`card.premiumRows`) out of `../route.tsx` verbatim, and wrap it in this shell:

```tsx
import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";
import { iHealthyTableCard, type IHealthyTableCard } from "@/lib/ihealthy-card";
import {
  CARD_HEADERS, Cell, COL_W, GOLD, GRID, GROUND, GROUND_DEEP, H, MUTE, PAD, Row, RULE,
  TITLE_W, WHITE, band, loadFonts, spacer, widthOf,
} from "../draw";

export const runtime = "nodejs";
/** The figures come from a dated rate table, so a day of caching is as far as it can go. */
export const revalidate = 86400;

/** Heading, table, notes — and the bands between them, as on the card. */
function heightOf(card: IHealthyTableCard): number {
  const table = H.head + card.rows.length * H.row
    + (card.premiumRows.length > 0 ? H.section + card.premiumRows.length * H.row : 0);
  return PAD * 2
    + H.plan + H.insured
    + H.gap + H.hairline + H.afterHairline + table
    + H.gap + H.hairline + H.afterHairline + card.notes.length * H.note;
}

/**
 * The six plans side by side, before the customer has picked one.
 *
 * The bot sends it the moment it knows an age and a sex: a menu of plans as six lines of Thai
 * in a chat is something nobody reads, and the same six as a table is something they compare.
 * `fit=phone` narrows it to three, which is what the adverts sell.
 */
export async function GET(req: NextRequest) {
  const card = iHealthyTableCard(req.nextUrl.searchParams);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: PAD,
          background: `linear-gradient(160deg, ${GROUND} 0%, ${GROUND_DEEP} 82%)`,
          fontFamily: "Plex",
          color: WHITE,
        }}
      >
        <div style={{ ...band(H.plan), fontSize: 30, fontWeight: 600, color: GOLD }}>{card.headLine}</div>
        <div style={{ ...band(H.insured), fontSize: 25, color: MUTE }}>{card.insuredLine}</div>

        {/* the table section, copied from ../route.tsx with `selected` always -1 */}

        <div style={{ display: "flex", flexDirection: "column", flexShrink: 0 }}>
          <div style={spacer(H.gap)} />
          <div style={spacer(H.hairline, RULE)} />
          <div style={spacer(H.afterHairline)} />
          {card.notes.map((n) => (
            <div key={n} style={{ ...band(H.note), fontSize: 21, color: MUTE }}>{n}</div>
          ))}
        </div>
      </div>
    ),
    {
      width: widthOf(card.columns.length),
      height: heightOf(card),
      fonts: await loadFonts(),
      headers: CARD_HEADERS,
    },
  );
}
```

Where the comment says *the table section*, paste the block from `../route.tsx` that begins with
the `H.gap`/hairline spacers before the table and ends with the table's own bottom edge
(`<div style={spacer(H.hairline, GRID)} />`), passing `selected={-1}` to every `Row` and using
`-1` for the header row's tint test.

- [ ] **Step 6: Check it compiles and renders**

Run: `npm run verify`
Expected: PASS, with `/api/ihealthy-card/table` listed among the dynamic routes in the build output.

- [ ] **Step 7: Commit**

```bash
npm run verify && git add src/lib/ihealthy-card.ts src/app/api/ihealthy-card/table/route.tsx tests/calc/ihealthy-table-card.test.ts && git commit -m "$(cat <<'MSG'
feat(card): the health plans compared, as a picture on its own

Before a customer has picked a plan there is nothing to headline, so the quote
card's table gets a route of its own: no premium over it, no column lit, and
its premium rows as the point rather than as a footnote. Every figure is the
quote card's, from the same call, so two pictures sent in a row cannot disagree.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 6: What both brains share

The Life Protect brain is the only brain, so everything it knows about being a bot at all —
the shape of a reply, the application form, how to answer a customer stepping back — is
tangled with everything it knows about Life Protect. Pull the first out, then move the rest
into a folder of its own.

**Files:**
- Create: `src/lib/assistant/common.ts`
- Move: `src/lib/assistant/answer.ts` → `src/lib/assistant/lifeprotect/answer.ts`
- Move: `src/lib/assistant/route.ts` → `src/lib/assistant/lifeprotect/route.ts`
- Move: `src/lib/assistant/faq.ts` → `src/lib/assistant/lifeprotect/faq.ts`
- Move: `src/lib/assistant/prompts.ts` → `src/lib/assistant/lifeprotect/prompts.ts`
- Create: `src/lib/assistant/prompts.ts` (the shared voice only)
- Modify: `src/lib/facebook/conversation.ts:6`, `tests/calc/assistant-{answer,route,faq,prompts}.test.ts`,
  `tests/calc/messenger-webhook.test.ts`, `tests/calc/chat-harness.test.ts`, `src/lib/chat/session.ts:3`

This task must not change a single thing the bot says. The existing tests are the proof.

- [ ] **Step 1: Move the four files**

```bash
mkdir -p src/lib/assistant/lifeprotect
git mv src/lib/assistant/answer.ts src/lib/assistant/lifeprotect/answer.ts
git mv src/lib/assistant/route.ts src/lib/assistant/lifeprotect/route.ts
git mv src/lib/assistant/faq.ts src/lib/assistant/lifeprotect/faq.ts
git mv src/lib/assistant/prompts.ts src/lib/assistant/lifeprotect/prompts.ts
```

- [ ] **Step 2: Split the voice out of the Life Protect prompts**

Cut the `VOICE` constant, with its whole doc comment, out of
`src/lib/assistant/lifeprotect/prompts.ts` into a new `src/lib/assistant/prompts.ts`:

```ts
/**
 * How the bot sounds, whichever plan it is selling.
 *
 * Neither brain's prompts may state a figure of its own. A premium, a death benefit and a
 * surrender value are all arithmetic the engine has already done against the company's own
 * tables, and a model that paraphrases one is a model that can get it wrong in a customer's
 * screenshot.
 *
 * The voice is a person's: the owner wants a customer unable to tell the bot from the admin.
 * What that does not license is a lie — asked outright, it says it is the page's assistant.
 */
export const VOICE = `คุณคือแอดมินเพจประกันชีวิต กำลังพิมพ์ตอบลูกค้าใน Messenger
…(the existing text, unchanged)…`;
```

`lifeprotect/prompts.ts` then begins `import { VOICE } from "../prompts";` and keeps
`PLAN_INFO_SYSTEM` and `SMALL_TALK_SYSTEM` exactly as they are.

- [ ] **Step 3: Create `common.ts` by moving, not rewriting**

Create `src/lib/assistant/common.ts` with this header, then move into it — verbatim, doc
comments included — from `lifeprotect/route.ts`: `recentTurns`, `peopleIn` (with `SEX_WORD`
and `PERSON_RE`), `ageFromBirthdate` (with `ageFromBirthYear`), `stalls` (with `STALLS`,
`ASKS`), `affirms` (with `AFFIRMS`), `wantsToBuy` (with `BUYS`, `NOT_BUYING`, `COMMITS`),
`saysFormDone` (with `FORM_DONE`), `asksCheaper` (with `TOO_EXPENSIVE`), `asksAboutCompany`
and `asksAboutTrust` (with `INSURER_QUESTION`, `TRUST_QUESTION`); and from
`lifeprotect/answer.ts`: `Said`, `MAX_BUBBLES`, `INSURER`, `AGENTS`, `ABOUT_INSURER`,
`ABOUT_AGENTS`, `ABOUT_TRUST`, `aboutCompany`, `APPLICATION_FORM`, `FORM_NEXT`,
`FORM_RECEIVED`, `WANTS_IN`.

```ts
/**
 * What a bot on this page is, before it is a bot about any particular plan.
 *
 * The shape of a reply, the words a customer hears when they step back or decide to go ahead,
 * and the questions that are answered the same way whatever is being sold — who insures this,
 * is the price negotiable, is the form filled in. All of it was inside the Life Protect brain
 * because there was only one brain. A second one would otherwise have had to answer the same
 * questions in its own words, and two bots in one inbox that word the same answer differently
 * is a customer noticing they are talking to a machine.
 */
```

Four things change shape as they move, because they may no longer see `Routed`:

```ts
/** One message the bot sends, and the picture that follows it. */
export interface Said {
  text: string;
  /** where the quote is drawn as a picture, as a path on this site */
  card?: string;
}

/**
 * Everything an answer is except which plan it was about.
 *
 * The slots are the one part that differs between brains, so each brain adds its own:
 * `type Answer = Reply & { slots: Routed }`.
 */
export interface Reply {
  /**
   * What the bot sends, in the order it sends it.
   *
   * A list rather than one string because a customer pricing a couple — "ผญ 32 ผช33ค่ะ" —
   * is owed a quote each, and two quotes in one bubble is a wall of figures nobody can read
   * back to their partner.
   */
  messages: Said[];
  /** the answer carries a premium — the moment a browser turns into someone worth calling */
  priced?: boolean;
  /**
   * Buttons offered under the last thing sent.
   *
   * A quotation ends with an invitation nobody acts on — it is the last line of twenty, under
   * a picture. The same invitation as a row of buttons is one tap, and a tap arrives as the
   * words themselves, so every title here is a sentence the bot already answers.
   */
  replies?: string[];
}

/** The usual case: the bot says one thing. */
export function one(text: string, card?: string): Reply {
  return { messages: [card ? { text, card } : { text }] };
}

/** A person does not send one long block; the model's paragraphs go out as separate bubbles. */
export function spoken(text: string, fallback: string): Reply {
  const parts = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return one(fallback);
  if (parts.length <= MAX_BUBBLES) return { messages: parts.map((t) => ({ text: t })) };
  // more than fits: the last bubble carries the rest, so nothing is dropped and none is empty
  const head = parts.slice(0, MAX_BUBBLES - 1);
  const tail = parts.slice(MAX_BUBBLES - 1).join("\n\n");
  return { messages: [...head, tail].map((t) => ({ text: t })) };
}

/**
 * Handing over the form: three bubbles, the link on its own so it is one tap. Someone who
 * asks how to apply before hearing a price is also told the price is a message away — the
 * only time the bot volunteers that, because here it knows nothing has been quoted.
 *
 * `quoted` rather than the slots themselves: what counts as a quote differs between plans
 * (a sum assured on one, a chosen health plan on the other) and neither answer differs.
 */
export function handOverForm(quoted: boolean): Reply {
  const next = quoted ? FORM_NEXT : `${FORM_NEXT} ถ้าอยากทราบเบี้ยก่อน บอกเพศกับอายุมาได้เลยครับ เดี๋ยวคิดให้`;
  return { messages: [{ text: "ยินดีครับ 😊 รบกวนกรอกข้อมูลตามฟอร์มนี้ได้เลยครับ" }, { text: APPLICATION_FORM }, { text: next }] };
}

/**
 * What the bot says when the customer steps back. One line, no question, and — once they
 * have a quotation in hand — the door left open by name: the owner's choice, over silence
 * and over a follow-up.
 */
export function stallReply(quoted: boolean): string {
  return quoted
    ? "ได้เลยครับ ถ้าตัดสินใจแล้วหรืออยากได้ใบเสนออย่างเป็นทางการ ทักมาได้เลยนะครับ"
    : "ได้เลยครับ สะดวกเมื่อไหร่ทักมาได้เลยนะครับ";
}

/**
 * Someone who says they have a condition must not be told they will be accepted, whichever
 * plan they are asking about. It is the first answer both FAQ lists check for that reason.
 */
export const HEALTH_DECLARATION =
  "มีโรคประจำตัวยื่นขอทำประกันได้ครับ แต่ต้องแถลงข้อมูลสุขภาพตามจริงในใบคำขอ "
  + "แล้วบริษัทจะพิจารณาเป็นรายบุคคล — อาจรับตามปกติ มีเบี้ยเพิ่ม หรือมีข้อยกเว้นเฉพาะโรค\n"
  + "ผลพิจารณาผมตอบแทนบริษัทไม่ได้ครับ ขอให้ตัวแทนดูให้ เดี๋ยวมีคนมาตอบในแชทนี้ 🙏\n"
  + "และไม่ต้องส่งรายละเอียดสุขภาพหรือผลตรวจมาในแชทนะครับ";

/** How each condition a health-declaration question is recognised by. */
export const HEALTH_QUESTION =
  /โรคประจำตัว|มีโรค|เป็นโรค|ป่วยเป็น|เบาหวาน|ความดัน|ไทรอยด์|หอบ|ภูมิแพ้|มะเร็ง|หัวใจ|ผ่าตัด|ตรวจสุขภาพ|แถลงสุขภาพ|สุขภาพไม่ดี|กินยา|รักษาตัว/i;
```

- [ ] **Step 4: Make the Life Protect brain import them**

In `lifeprotect/route.ts`: delete everything moved, add
`export { peopleIn, ageFromBirthdate } from "../common";` (the existing tests import them from
the route), and `import { asksCheaper, peopleIn, ageFromBirthdate } from "../common";` for the
code that still uses them (`wantsToBuy` moved, `clean` still calls `peopleIn` and
`ageFromBirthdate`).

In `lifeprotect/answer.ts`: delete everything moved and add

```ts
import {
  APPLICATION_FORM, FORM_RECEIVED, HEALTH_DECLARATION, MAX_BUBBLES, Reply, Said, WANTS_IN,
  aboutCompany, affirms, handOverForm, one, recentTurns, saysFormDone, spoken, stallReply,
  stalls, wantsToBuy, asksAboutCompany, asksCheaper,
} from "../common";

/** One answer, and what the bot should remember about this customer next turn. */
export type Answer = Reply & { slots: Routed };
```

Then, mechanically:
- every `Omit<Answer, "slots">` becomes `Reply`
- every `spoken(x)` becomes `spoken(x, ASK_FOR_DETAILS)`
- `handOverForm(known)` becomes `handOverForm(hasQuote(known))`
- `stallReply(kept)` becomes `stallReply(hasQuote(kept))`

In `lifeprotect/faq.ts`, the `health` entry's `match` and `answer` become
`HEALTH_QUESTION` and `HEALTH_DECLARATION` imported from `../common`.

- [ ] **Step 5: Repoint every importer**

```bash
grep -rln "@/lib/assistant/\(answer\|route\|faq\|prompts\)" src tests
```

Change each hit to `@/lib/assistant/lifeprotect/…`, except `prompts` where only `VOICE` is
wanted. The files are `src/lib/facebook/conversation.ts`, `src/lib/chat/session.ts`,
`tests/calc/assistant-answer.test.ts`, `tests/calc/assistant-route.test.ts`,
`tests/calc/assistant-faq.test.ts`, `tests/calc/assistant-prompts.test.ts`,
`tests/calc/messenger-webhook.test.ts`, `tests/calc/chat-harness.test.ts`.

- [ ] **Step 6: Prove nothing the bot says has changed**

Run: `npx vitest run tests/calc/assistant-answer.test.ts tests/calc/assistant-route.test.ts tests/calc/assistant-faq.test.ts tests/calc/assistant-prompts.test.ts tests/calc/messenger-webhook.test.ts`
Expected: PASS, every test, with no test edited except its import lines.

- [ ] **Step 7: Commit**

```bash
npm run verify && git add src/lib/assistant tests/calc/assistant-answer.test.ts tests/calc/assistant-route.test.ts tests/calc/assistant-faq.test.ts tests/calc/assistant-prompts.test.ts tests/calc/messenger-webhook.test.ts tests/calc/chat-harness.test.ts src/lib/facebook/conversation.ts src/lib/chat/session.ts && git commit -m "$(cat <<'MSG'
refactor(assistant): separate being a bot from selling one plan

A second brain is coming. The shape of a reply, the application form, the
customer stepping back, who insures this — none of that is about Life Protect,
and all of it was inside the Life Protect brain because there was only one.
It moves to common.ts; the plan's own half moves to lifeprotect/, unchanged.

No test needed editing beyond its import line, which is the point.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 7: Which plan is this message about

**Files:**
- Create: `src/lib/assistant/choose.ts`
- Test: `tests/calc/assistant-choose.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/assistant-choose.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { CHOOSE_HEALTH, CHOOSE_LIFE, productByTopic, productNamedIn } from "@/lib/assistant/choose";

describe("a message that names a plan", () => {
  it("recognises the health one", () => {
    for (const said of ["สนใจประกันสุขภาพค่ะ", "ไอเฮลท์ตี้ อัลตร้า ราคาเท่าไหร่", "iHealthy Ultra"]) {
      expect(productNamedIn(said)).toBe("ihealthy");
    }
  });

  it("recognises the life one", () => {
    for (const said of ["Life Protect x 2", "ไลฟ์โพรเทค", "สนใจประกันมรดก ทุน 1,000,000", "ประกันชีวิต"]) {
      expect(productNamedIn(said)).toBe("lifeprotect");
    }
  });

  it("recognises the two buttons it offers", () => {
    expect(productNamedIn(CHOOSE_HEALTH)).toBe("ihealthy");
    expect(productNamedIn(CHOOSE_LIFE)).toBe("lifeprotect");
  });

  it("names nothing when a message names both", () => {
    expect(productNamedIn("ประกันสุขภาพกับประกันชีวิต ต่างกันยังไง")).toBeUndefined();
  });

  it("names nothing when a message names neither", () => {
    for (const said of ["สนใจค่ะ", "สวัสดีครับ", "หญิง 35", "เท่าไหร่"]) {
      expect(productNamedIn(said)).toBeUndefined();
    }
  });
});

describe("a message that names no plan but says what it is about", () => {
  it("hears the health topics", () => {
    for (const said of ["ค่ารักษาเท่าไหร่", "ค่าห้องวันละเท่าไหร่", "เหมาจ่ายไหม", "OPD ได้ไหม", "แอดมิทเบิกได้ไหม"]) {
      expect(productByTopic(said)).toBe("ihealthy");
    }
  });

  it("hears the life ones", () => {
    for (const said of ["ทุน 1 ล้าน เท่าไหร่", "ขอทุน 5 แสน", "จ่าย 19 ปี", "เวนคืนได้เท่าไหร่"]) {
      expect(productByTopic(said)).toBe("lifeprotect");
    }
  });

  it("does not mistake a health declaration for a health plan", () => {
    // someone buying life cover is asked to declare, and asks about it
    for (const said of ["ต้องตรวจสุขภาพไหม", "แถลงสุขภาพยังไง", "สุขภาพไม่ดีทำได้ไหม"]) {
      expect(productByTopic(said)).toBeUndefined();
      expect(productNamedIn(said)).toBeUndefined();
    }
  });

  it("says nothing about a greeting", () => {
    for (const said of ["สนใจค่ะ", "สวัสดีครับ", "หญิง 35"]) {
      expect(productByTopic(said)).toBeUndefined();
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/assistant-choose.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/choose"`.

- [ ] **Step 3: Write the module**

Create `src/lib/assistant/choose.ts`:

```ts
import { one, type Reply } from "./common";

/** The two things this page sells, as the session records which one a customer came for. */
export type Product = "lifeprotect" | "ihealthy";

/**
 * A plan named outright — the only signal strong enough to move a conversation already under
 * way. "ประกันสุขภาพ" is that; a bare "สุขภาพ" is not, because a customer buying life cover is
 * asked to declare their health and then asks about the declaration.
 */
const NAMES: [Product, RegExp][] = [
  ["ihealthy", /ประกันสุขภาพ|ไอเฮลท์ตี้|ไอเฮลตี้|i\s*-?\s*healthy/i],
  ["lifeprotect", /life\s*protect|ไลฟ์\s*โพรเทค|ไลฟ์โปรเทค|ประกันชีวิต|ประกันมรดก|มรดก/i],
];

/**
 * What a message is about when it says so in as many words, or nothing when it says neither —
 * or both, which is a question about the difference and belongs to whoever is already answering.
 */
export function productNamedIn(text: string): Product | undefined {
  const named = NAMES.filter(([, re]) => re.test(text));
  return named.length === 1 ? named[0][0] : undefined;
}

/**
 * What a message is about from its subject alone.
 *
 * Weaker than a name, and only ever consulted before a conversation has settled on a plan: a
 * customer three turns into a health quote who asks "ทุนเท่าไหร่" means the sum on the base
 * contract, not a change of subject.
 */
const TOPICS: [Product, RegExp][] = [
  ["ihealthy", /ค่ารักษา|ค่าห้อง|เหมาจ่าย|ค่าหมอ|ผู้ป่วยใน|ผู้ป่วยนอก|\bopd\b|\bipd\b|แอดมิท|นอนโรงพยาบาล|นอน\s*รพ|ค่าผ่าตัด|วงเงินค่ารักษา/i],
  ["lifeprotect", /ทุน\s*\d|ทุนประกัน|\d+\s*ล้าน|\d+\s*แสน|(?:จ่าย|ชำระ)\s*(?:เบี้ย)?\s*\d+\s*ปี|อายุ\s*99|เวนคืน|เสียชีวิต|มรดก/i],
];

/** The subject of a message, when only one of the two recognises it. */
export function productByTopic(text: string): Product | undefined {
  const found = TOPICS.filter(([, re]) => re.test(text));
  return found.length === 1 ? found[0][0] : undefined;
}

/**
 * The words on the two buttons.
 *
 * A tapped button arrives as its own title, so each one has to be a message `productNamedIn`
 * reads back — which is why they say the plans' names rather than "อันแรก" and "อันที่สอง".
 */
export const CHOOSE_HEALTH = "🏥 ประกันสุขภาพ";
export const CHOOSE_LIFE = "🛡️ Life Protect x 2";

/**
 * The one question the bot asks before it knows what it is selling.
 *
 * Only when the message itself says nothing: the adverts open with buttons that name the plan
 * and most customers type a sum or a symptom, and a lead the campaign paid for should not have
 * to tap twice to be answered.
 */
export function askWhich(): Reply {
  return { ...one("สวัสดีครับ 🙏 สนใจแบบไหนครับ"), replies: [CHOOSE_HEALTH, CHOOSE_LIFE] };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/assistant-choose.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run verify && git add src/lib/assistant/choose.ts tests/calc/assistant-choose.test.ts && git commit -m "$(cat <<'MSG'
feat(assistant): read which plan a message is about, before paying a model

Two layers, because one word decides too much: a named plan can turn a
conversation around mid-way, a subject can only settle one that has not begun.
"ต้องตรวจสุขภาพไหม" is neither — it is a life customer asking about the
declaration, and a bot that switched brains there would answer the wrong thing.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 8: The health answers written by hand

**Files:**
- Create: `src/lib/assistant/ihealthy/faq.ts`
- Test: `tests/calc/ihealthy-assistant-faq.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-assistant-faq.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { healthFaqAnswer } from "@/lib/assistant/ihealthy/faq";
import { iHealthyFacts } from "@/lib/ihealthy-facts";

describe("the health answers the agent types by hand", () => {
  it("puts the declaration first, before anything about a price", () => {
    const answer = healthFaqAnswer("เป็นเบาหวาน ทำได้ไหม เบี้ยขึ้นทุกปีด้วยหรือเปล่า")!;
    expect(answer).toContain("แถลงข้อมูลสุขภาพตามจริง");
    expect(answer).not.toContain("ตามอายุที่เพิ่มขึ้น");
  });

  it("says the health relief, which is not the life one", () => {
    const answer = healthFaqAnswer("ลดหย่อนภาษีได้ไหม")!;
    expect(answer).toContain("25,000");
    expect(answer).toContain("100,000");
  });

  it("says the premium rises, because on this contract it does", () => {
    const answer = healthFaqAnswer("เบี้ยขึ้นตามอายุไหม")!;
    expect(answer).toContain("ปรับตามอายุ");
    expect(answer).toContain("เบี้ยปีแรก");
  });

  it("takes the waiting periods from the contract rather than from memory", () => {
    const { terms } = iHealthyFacts();
    const answer = healthFaqAnswer("ซื้อแล้วใช้ได้เลยไหม")!;
    expect(answer).toContain(String(terms.waitingDays));
    expect(answer).toContain(String(terms.specialWaitingDays));
    expect(answer).toContain(terms.specialWaitingDiseases[0]);
  });

  it("answers nothing it was not asked", () => {
    expect(healthFaqAnswer("สวัสดีครับ")).toBeUndefined();
    expect(healthFaqAnswer("โกลด์เท่าไหร่")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/ihealthy-assistant-faq.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/ihealthy/faq"`.

- [ ] **Step 3: Write the module**

Create `src/lib/assistant/ihealthy/faq.ts`:

```ts
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { HEALTH_DECLARATION, HEALTH_QUESTION } from "../common";

/**
 * The answers the agent types by hand about the health contract.
 *
 * A separate list from Life Protect's rather than a shared one with exceptions, because the
 * two contracts disagree about the two questions customers ask most: the life plan's premium
 * is level for the whole paying term and relieves tax up to a hundred thousand; this one
 * re-prices at every birthday and relieves twenty-five. A bot answering a health customer out
 * of the life list would be wrong about both, in writing, on the page's own letterhead.
 */
interface Entry {
  key: string;
  match: RegExp;
  answer: () => string;
}

/**
 * Order matters: the declaration is first because a message that mentions a condition and
 * asks a price is, above everything else, a message that must not be told it will be accepted.
 */
const FAQ: Entry[] = [
  { key: "health", match: HEALTH_QUESTION, answer: () => HEALTH_DECLARATION },
  {
    key: "tax",
    match: /ลดหย่อน|ภาษี|\btax\b/i,
    answer: () =>
      "เบี้ยสัญญาเพิ่มเติมสุขภาพใช้ลดหย่อนภาษีได้ตามที่จ่ายจริง สูงสุด 25,000 บาทต่อปีครับ\n"
      + "และเมื่อรวมกับเบี้ยประกันชีวิตแล้วต้องไม่เกิน 100,000 บาทต่อปี ตามหลักเกณฑ์ของกรมสรรพากร",
  },
  {
    key: "rises",
    match: /เบี้ยขึ้น|เบี้ยเพิ่ม|เบี้ยคงที่|ขึ้นตามอายุ|ปรับขึ้น|ปีหน้า[^\n]{0,10}เบี้ย|เบี้ย[^\n]{0,10}ปีหน้า/i,
    answer: () =>
      "เบี้ยส่วนค่ารักษาพยาบาลปรับตามอายุที่เพิ่มขึ้นทุกปีครับ ตัวเลขที่คิดให้เป็นเบี้ยปีแรก\n"
      + "ส่วนเบี้ยของสัญญาหลักคงที่ตลอดระยะเวลาชำระ",
  },
  {
    key: "waiting",
    match: /รอคอย|ระยะรอ|เริ่มคุ้มครอง|คุ้มครองเมื่อไ|ซื้อแล้ว[^\n]{0,8}(?:ใช้|เคลม)|เคลมได้เลย/i,
    answer: () => {
      const { terms } = iHealthyFacts();
      return `สัญญาเพิ่มเติมนี้มีระยะเวลารอคอย ${terms.waitingDays} วันนับจากวันเริ่มคุ้มครองครับ\n`
        + `ส่วนโรคเหล่านี้รอ ${terms.specialWaitingDays} วัน — ${terms.specialWaitingDiseases.join(" · ")}\n`
        + "อุบัติเหตุคุ้มครองทันที ไม่มีระยะรอคอย";
    },
  },
  {
    key: "monthly",
    match: /รายเดือน|จ่ายยังไง|ชำระยังไง|ผ่อน|ตัดบัตร|หักบัญชี|เป็นงวด|งวดแรก/i,
    answer: () =>
      "จ่ายรายเดือนได้ครับ งวดแรกชำระ 2 งวด แล้วระบบจะตัดอัตโนมัติอีกครั้งในงวดที่ 3\n"
      + "จะเลือกจ่ายราย 6 เดือน หรือรายปีก็ได้เหมือนกันครับ",
  },
];

/** The written answer for a message, or undefined when it asks none of these. */
export function healthFaqAnswer(text: string): string | undefined {
  return FAQ.find((e) => e.match.test(text))?.answer();
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/ihealthy-assistant-faq.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run verify && git add src/lib/assistant/ihealthy/faq.ts tests/calc/ihealthy-assistant-faq.test.ts && git commit -m "$(cat <<'MSG'
feat(assistant): the health answers, which are not the life ones

Two of the five differ on the facts: this contract re-prices every birthday
and relieves tax to twenty-five thousand, where Life Protect is level and
relieves to a hundred. Answering a health customer out of the life list would
be wrong about both in writing. The waiting periods are read off the contract
sheet rather than typed.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 9: Reading a health message

**Files:**
- Create: `src/lib/assistant/ihealthy/route.ts`
- Test: `tests/calc/ihealthy-assistant-route.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-assistant-route.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async (_: ChatOptions) => ({
  text: JSON.stringify(routed), model: "stub", provider: "stub",
  inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const {
  asksFullTable, asksOtherPlans, asksShareOfBill, planNamedIn, routeHealth, territoryNamedIn,
} = await import("@/lib/assistant/ihealthy/route");

const said = (content: string) => [{ role: "user" as const, content }];
beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("a plan named in a message", () => {
  it("is read in Thai and in English", () => {
    expect(planNamedIn("เอาโกลด์")).toBe("GOLD");
    expect(planNamedIn("ขอ platinum")).toBe("PLATINUM");
    expect(planNamedIn("ไดมอนด์เท่าไหร่")).toBe("DIAMOND");
    expect(planNamedIn("สมาร์ทพอ")).toBe("SMART");
    expect(planNamedIn("บรอนซ์")).toBe("BRONZE");
    expect(planNamedIn("ซิลเวอร์")).toBe("SILVER");
  });

  it("is not guessed from a word that is not a plan", () => {
    expect(planNamedIn("แผนกลางๆ")).toBeUndefined();
    expect(planNamedIn("ถูกสุดเลย")).toBeUndefined();
  });
});

describe("a territory named in a message", () => {
  it("is read as the label the rate table spells", () => {
    expect(territoryNamedIn("คุ้มครองเอเชียด้วยไหม")).toBe("เอเชีย");
    expect(territoryNamedIn("อยากได้ทั่วโลก")).toBe("ทั่วโลก");
    expect(territoryNamedIn("รักษาต่างประเทศได้ไหม")).toBe("ทั่วโลก");
    expect(territoryNamedIn("ในไทยพอ")).toBe("ประเทศไทย");
  });

  it("is nothing when the message names none", () => {
    expect(territoryNamedIn("โกลด์เท่าไหร่")).toBeUndefined();
  });
});

describe("the questions answered without a model", () => {
  it("hears someone asking to share the bill", () => {
    for (const s of ["มีแบบรับผิดส่วนแรกไหม", "แบบร่วมจ่ายถูกกว่าไหม", "deductible เท่าไหร่", "copay"]) {
      expect(asksShareOfBill(s)).toBe(true);
    }
    expect(asksShareOfBill("โกลด์เท่าไหร่")).toBe(false);
  });

  it("hears someone asking for the whole benefit sheet", () => {
    for (const s of ["ขอตารางเต็ม", "ดูทุกหมวด", "ตารางผลประโยชน์ทั้งหมด"]) {
      expect(asksFullTable(s)).toBe(true);
    }
  });

  it("hears someone asking what else there is", () => {
    for (const s of ["ดูแผนอื่น", "มีแผนอื่นไหม", "แผนอื่นล่ะ"]) expect(asksOtherPlans(s)).toBe(true);
    expect(asksOtherPlans("โกลด์เท่าไหร่")).toBe(false);
  });
});

describe("what the model is allowed to fill in", () => {
  it("keeps the age and sex the message itself names, over the model's", () => {
    routed = { intent: "quote", age: 99, sex: "M" };
    return routeHealth(said("หญิง 35 สนใจค่ะ"), null).then((slots) => {
      expect(slots).toMatchObject({ product: "ihealthy", age: 35, sex: "F" });
    });
  });

  it("keeps the plan the message names, over the model's", async () => {
    routed = { intent: "quote", plan: "SMART" };
    const slots = await routeHealth(said("เอาไดมอนด์"), null);
    expect(slots.plan).toBe("DIAMOND");
  });

  it("refuses a plan the company does not sell", async () => {
    routed = { intent: "quote", plan: "TITANIUM" };
    const slots = await routeHealth(said("ขอราคา"), null);
    expect(slots.plan).toBeUndefined();
  });

  it("carries the age and sex forward, and lets a new plan replace an old one", async () => {
    routed = { intent: "quote" };
    const slots = await routeHealth(said("โกลด์"), {
      product: "ihealthy", intent: "quote", age: 35, sex: "F", plan: "BRONZE",
    });
    expect(slots).toMatchObject({ age: 35, sex: "F", plan: "GOLD" });
  });

  it("reads an age out of a birthdate rather than trusting the model with the arithmetic", async () => {
    routed = { intent: "quote", age: 43 };
    const slots = await routeHealth(said("เกิด 14/12/2523 ผู้หญิง"), null);
    expect(slots.age).toBe(45);
    expect(slots.sex).toBe("F");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/ihealthy-assistant-route.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/ihealthy/route"`.

- [ ] **Step 3: Write the module**

Create `src/lib/assistant/ihealthy/route.ts`:

```ts
import { chat, parseJsonReply } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { iHealthyFacts } from "@/lib/ihealthy-facts";
import { ageFromBirthdate, peopleIn, recentTurns } from "../common";

/**
 * What the bot knows about a customer buying health cover.
 *
 * A different set of fields from the life plan's, not a superset of it: this contract is
 * chosen by plan and territory, where that one is chosen by a sum assured and a paying term.
 * `product` is what tells them apart in a session row that holds either.
 */
export interface HealthSlots {
  product: "ihealthy";
  intent: "quote" | "plan_info" | "other";
  age?: number;
  sex?: "M" | "F";
  /** a plan code the rate table sells, e.g. "GOLD" */
  plan?: string;
  /** a territory label the rate table spells; absent means ประเทศไทย, which is what it opens on */
  territory?: string;
  /** a stand-alone rewrite of the question, with pronouns from earlier turns filled in */
  question?: string;
  /** the application form has been handed over; "กรอกแล้ว" after this is about that form */
  formSent?: true;
}

/**
 * How the six plans are asked for, in both scripts.
 *
 * Read here rather than left to the model for the same reason the paying term is on the life
 * plan: the plan is the price. A customer who taps โกลด์ and is quoted ซิลเวอร์ has been shown
 * a figure eleven thousand baht from the one they asked for, and the picture under it would
 * disagree with the words over it.
 */
const PLAN_WORDS: [string, RegExp][] = [
  ["PLATINUM", /แพลทินั่ม|แพลตตินั่ม|แพลทินัม|platinum/i],
  ["DIAMOND", /ไดมอนด์|ไดม่อน|diamond/i],
  ["GOLD", /โกลด์|โกล์ด|\bgold\b/i],
  ["SILVER", /ซิลเวอร์|silver/i],
  ["BRONZE", /บรอนซ์|บรอนซ|bronze/i],
  ["SMART", /สมาร์ท|สมาร์ต|\bsmart\b/i],
];

/** The plan a message asks for by name, or nothing where it names none. */
export function planNamedIn(text: string): string | undefined {
  return PLAN_WORDS.find(([, re]) => re.test(text))?.[0];
}

/**
 * The territory a message asks for, as the rate table spells it.
 *
 * "ต่างประเทศ" reads as ทั่วโลก rather than as เอเชีย: it is the wider of the two, and a
 * customer quoted the narrower one would find out at a hospital.
 */
const TERRITORY_WORDS: [string, RegExp][] = [
  ["ทั่วโลก", /ทั่วโลก|ทั้งโลก|ต่างประเทศ|เมืองนอก|worldwide|global/i],
  ["เอเชีย", /เอเชีย|asia/i],
  ["ประเทศไทย", /ในไทย|ในประเทศไทย|เฉพาะไทย|แค่ไทย/i],
];

export function territoryNamedIn(text: string): string | undefined {
  return TERRITORY_WORDS.find(([, re]) => re.test(text))?.[0];
}

/**
 * Asking to carry part of the bill in exchange for a smaller premium. Both arrangements are
 * real and both are sold in Thailand only — and neither is priced in this chat, so the
 * question is answered in words and handed on rather than routed to a quote.
 */
const SHARE_OF_BILL = /รับผิดส่วนแรก|ส่วนแรก|ร่วมจ่าย|มีส่วนร่วม|deductible|co\s*-?\s*pay/i;
export function asksShareOfBill(text: string): boolean {
  return SHARE_OF_BILL.test(text);
}

/** Asking for the whole benefit sheet, which is a web page and not a picture. */
const FULL_TABLE = /ตาราง(?:ผลประโยชน์)?(?:เต็ม|ทั้งหมด|ครบ)|เต็มๆ|ทุกหมวด|ครบทุกหมวด|ผลประโยชน์ทั้งหมด|ดูรายละเอียดทั้งหมด/;
export function asksFullTable(text: string): boolean {
  return FULL_TABLE.test(text);
}

/** Asking what else there is besides the ones already on the table. */
const OTHER_PLANS = /แผนอื่น|แบบอื่น|อันอื่น|มีอีกไหม|ตัวอื่น|ที่เหลือ/;
export function asksOtherPlans(text: string): boolean {
  return OTHER_PLANS.test(text);
}

const SYSTEM = `คุณเป็นตัวช่วยของตัวแทนประกัน อ่านข้อความล่าสุดแล้วบอกว่าลูกค้าต้องการอะไร ตอบเป็น JSON เท่านั้น

ตอนนี้กำลังคุยเรื่อง "ประกันสุขภาพ ไอเฮลท์ตี้ อัลตร้า" (iHealthy Ultra) สัญญาเพิ่มเติมค่ารักษาพยาบาลแบบเหมาจ่าย

intent มี 3 แบบ
- "quote" = ขอเบี้ยประกัน อยากรู้ราคา เลือกแผน
- "plan_info" = ถามว่าคุ้มครองอะไร ค่าห้องเท่าไหร่ OPD ได้ไหม รอคอยกี่วัน ต่ออายุถึงอายุเท่าไหร่ แผนไหนต่างกันยังไง
- "other" = ทักทาย หรือเรื่องอื่นที่ไม่ใช่สองข้อบน

ฟิลด์ที่ต้องเติมถ้ามีในข้อความ
- age เป็นตัวเลขปี
- sex เป็น "M" (ชาย) หรือ "F" (หญิง)
- plan เป็นรหัสแผน "SMART" "BRONZE" "SILVER" "GOLD" "DIAMOND" "PLATINUM"
- territory เป็น "ประเทศไทย" "เอเชีย" หรือ "ทั่วโลก"
- question เขียนคำถามใหม่ให้เข้าใจได้ด้วยตัวเอง โดยเติมสิ่งที่อ้างถึงจากบทสนทนาก่อนหน้า

ถ้าไม่มีข้อมูลให้ละฟิลด์นั้นไป ห้ามเดา`;

/** Reads the conversation and returns what the customer is asking for. Cheap model, strict JSON. */
export async function routeHealth(
  history: ChatMessage[], previous: HealthSlots | null,
): Promise<HealthSlots> {
  const messages: ChatMessage[] = [{ role: "system", content: SYSTEM }, ...recentTurns(history, 6)];
  const r = await chat({ tier: "small", task: "route_health", messages, maxTokens: 250, json: true });
  const parsed = parseJsonReply<Partial<HealthSlots>>(r.text) ?? {};
  return merge(previous, clean(parsed, history));
}

/** Anything the model returns is checked here, so an invented plan never reaches the engine. */
function clean(raw: Partial<HealthSlots>, history: ChatMessage[]): HealthSlots {
  const last = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const out: HealthSlots = {
    product: "ihealthy",
    intent: raw.intent && ["quote", "plan_info", "other"].includes(raw.intent) ? raw.intent : "other",
  };

  // the plan written in the message wins over the model's: it is the one the customer tapped
  const codes = new Set(iHealthyFacts().plans.map((p) => p.code));
  const plan = planNamedIn(last) ?? raw.plan;
  if (plan && codes.has(plan)) out.plan = plan;

  const territory = territoryNamedIn(last) ?? raw.territory;
  if (territory && TERRITORY_WORDS.some(([label]) => label === territory)) out.territory = territory;

  // a birthdate in the message beats whatever age the model worked out from it, and a sex and
  // age standing next to each other beat both
  const named = peopleIn(last);
  const born = ageFromBirthdate(last);
  if (born !== undefined) out.age = born;
  else if (named.length) out.age = named[0].age;
  else if (typeof raw.age === "number" && raw.age >= 0 && raw.age <= 99) out.age = Math.trunc(raw.age);

  if (named.length) out.sex = named[0].sex;
  else if (raw.sex === "M" || raw.sex === "F") out.sex = raw.sex;

  // a message that names a plan is asking what it costs, whatever the model called it
  if (out.plan !== undefined && out.intent === "other") out.intent = "quote";
  out.question = typeof raw.question === "string" && raw.question.trim() ? raw.question.trim() : last;
  return out;
}

/**
 * Slots carry over between turns: someone who gave an age and a sex and then taps a plan is
 * still the same customer. The newer turn always wins.
 */
function merge(previous: HealthSlots | null, current: HealthSlots): HealthSlots {
  if (!previous) return current;
  const merged: HealthSlots = { ...current };
  // filling in what the quote was waiting for is still asking for the quote
  if (previous.intent === "quote" && (current.age !== undefined || current.sex !== undefined || current.plan !== undefined)) {
    merged.intent = "quote";
  }
  if (merged.age === undefined) merged.age = previous.age;
  if (merged.sex === undefined) merged.sex = previous.sex;
  if (merged.plan === undefined) merged.plan = previous.plan;
  if (merged.territory === undefined) merged.territory = previous.territory;
  if (merged.formSent === undefined) merged.formSent = previous.formSent;
  return merged;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/ihealthy-assistant-route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run verify && git add src/lib/assistant/ihealthy/route.ts tests/calc/ihealthy-assistant-route.test.ts && git commit -m "$(cat <<'MSG'
feat(assistant): read a health message into the fields that price it

Plan and territory rather than a sum assured and a paying term — a different
set of fields, not a superset. The plan is read off the text rather than left
to the model for the same reason the term is on Life Protect: the plan is the
price, and a tapped โกลด์ quoted as ซิลเวอร์ is eleven thousand baht wrong.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 10: One plan quoted

**Files:**
- Create: `src/lib/assistant/ihealthy/quote.ts`
- Test: `tests/calc/ihealthy-assistant-quote.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-assistant-quote.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { healthQuote, HEALTH_HAND_OVER } from "@/lib/assistant/ihealthy/quote";
import { iHealthyQuoteText } from "@/lib/ihealthy-cta";
import { iHealthyFacts, planLabel } from "@/lib/ihealthy-facts";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { deathBenefitOf, iHealthyPricing, shownAt } from "@/lib/ihealthy-quote";
import { initialFrom } from "@/lib/ihealthy-link";

const WHO = { product: "ihealthy" as const, intent: "quote" as const, age: 35, sex: "F" as const, plan: "GOLD" };

describe("the quotation the bot sends", () => {
  it("says exactly what the sales page would say", () => {
    const reply = healthQuote(WHO);
    const table = iHealthyTable();
    const facts = iHealthyFacts();
    const plan = facts.plans.find((p) => p.code === "GOLD")!;
    const priced = iHealthyPricing(table, {
      base: "WLF99H", sex: "F", age: 35, sumAssured: 150_000,
      plan: "GOLD", territory: "ประเทศไทย", coverage: "Full Coverage",
    })!;
    const expected = iHealthyQuoteText({
      arrangement: {
        planName: planLabel("GOLD"), annualMax: plan.annualMax, deductible: plan.deductible,
        territory: "ประเทศไทย", coverage: "Full Coverage",
      },
      copayPercent: facts.copayPercent,
      age: 35, sex: "F",
      baseLabel: table.bases.find((b) => b.variant === "WLF99H")!.label,
      sumAssured: 150_000,
      death: deathBenefitOf(table, "WLF99H", 35, 150_000),
      mode: "annual",
      minMonthly: table.minMonthly,
      shown: shownAt(priced, "annual"),
    })!;
    expect(reply.messages[0].text).toBe(expected);
    expect(reply.priced).toBe(true);
  });

  it("sends a picture of the same arrangement, sized for a phone", () => {
    const card = healthQuote(WHO).messages[0].card!;
    expect(card).toContain("/api/ihealthy-card?");
    expect(card).toContain("fit=phone");
    const chosen = initialFrom(iHealthyTable(), Object.fromEntries(new URLSearchParams(card.split("?")[1])));
    expect(chosen).toMatchObject({ age: 35, sex: "F", plan: "GOLD", territory: "ประเทศไทย" });
  });

  it("offers the way on under the picture", () => {
    expect(healthQuote(WHO).replies).toEqual(["ดูแผนอื่น", "ผลประโยชน์แผนนี้", "สนใจสมัคร"]);
  });

  it("quotes a territory the plan is written for", () => {
    const reply = healthQuote({ ...WHO, plan: "DIAMOND", territory: "เอเชีย" });
    expect(reply.messages[0].text).toContain("เอเชีย");
    expect(reply.messages[0].card).toBeDefined();
  });

  it("will not price an age the company does not write this rider at", () => {
    for (const age of [5, 81]) {
      const reply = healthQuote({ ...WHO, age });
      expect(reply.messages[0].card).toBeUndefined();
      expect(reply.messages[0].text).toContain("6-80");
      expect(reply.messages[0].text).toContain(HEALTH_HAND_OVER);
      expect(reply.priced).toBeUndefined();
    }
  });

  it("will not price a plan the company does not sell at this age", () => {
    const reply = healthQuote({ ...WHO, age: 8, plan: "PLATINUM" });
    expect(reply.messages[0].card).toBeUndefined();
    expect(reply.messages[0].text).toContain("อายุ 8");
  });

  it("shows no price at all once the rate table has lapsed", () => {
    const reply = healthQuote(WHO, new Date("2099-01-01"));
    expect(reply.messages[0].card).toBeUndefined();
    expect(reply.messages[0].text).toContain("ขอราคาปัจจุบัน");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/ihealthy-assistant-quote.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/ihealthy/quote"`.

- [ ] **Step 3: Write the module**

Create `src/lib/assistant/ihealthy/quote.ts`:

```ts
import type { Sex } from "@/calc/types";
import { iHealthyQuoteText } from "@/lib/ihealthy-cta";
import { iHealthyFacts, planLabel } from "@/lib/ihealthy-facts";
import { IHEALTHY_OPENING, type IHealthyInitial } from "@/lib/ihealthy-choice";
import { cardPath } from "@/lib/ihealthy-link";
import { deathBenefitOf, iHealthyPricing, plansFor, shownAt, territoriesFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { WANTS_IN, one, type Reply } from "../common";
import type { HealthSlots } from "./route";

/** What the bot says when only a person can answer. */
export const HEALTH_HAND_OVER =
  "เดี๋ยวตัวแทนมาคุยต่อในแชทนี้ครับ ระหว่างนี้ถามเรื่องไอเฮลท์ตี้ อัลตร้าได้เลย";

/** The words a tapped button sends, which are the words the bot reads back. */
export const SEE_OTHER_PLANS = "ดูแผนอื่น";
export const THIS_PLAN_BENEFITS = "ผลประโยชน์แผนนี้";

/**
 * The arrangement a quote is priced on.
 *
 * Everything but the age, the sex, the plan and the territory is the page's own opening: the
 * base contract, the sum it is written for, full cover, and the daily-cash rider the agency
 * attaches as standard. A chat is not the place to choose a life contract to hang health cover
 * on, and a page and a chat that opened on different ones would quote the same customer two
 * different totals.
 */
export function arrangementFor(slots: {
  age: number; sex: Sex; plan: string; territory?: string;
}): IHealthyInitial {
  return {
    ...IHEALTHY_OPENING,
    age: slots.age,
    sex: slots.sex,
    plan: slots.plan,
    territory: slots.territory ?? IHEALTHY_OPENING.territory,
  };
}

/** The buttons under a quotation. Titles stay under twenty characters, which is all Messenger shows. */
const QUOTE_REPLIES = [SEE_OTHER_PLANS, THIS_PLAN_BENEFITS, WANTS_IN];

/**
 * One plan quoted: the sales page's own words, its own picture, and every reason there is no
 * price said in the customer's terms rather than as a silence.
 *
 * The arrangement is rebuilt from the engine for both the text and the card, so the figures in
 * the message and the figures in the picture are one calculation rather than two that agree.
 *
 * The age is checked here and not left to the card: `initialFrom` pulls an age onto the rider's
 * range rather than refusing it, so a link for a five-year-old would quietly draw a six-year-old.
 */
export function healthQuote(
  slots: HealthSlots & { age: number; sex: Sex; plan: string }, today: Date = new Date(),
): Reply {
  const table = iHealthyTable(today);
  const { age, sex } = slots;

  if (age < table.ageMin || age > table.ageMax) {
    return one(`ไอเฮลท์ตี้ อัลตร้า รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ อายุ ${age} ปีอยู่นอกช่วงนี้ ${HEALTH_HAND_OVER}`);
  }
  if (table.expired) {
    return one(`ตารางเบี้ยชุดนี้หมดอายุแล้วครับ ขอราคาปัจจุบันจากตัวแทนได้เลย ${HEALTH_HAND_OVER}`);
  }

  const sellable = plansFor(table, age);
  const chosen = sellable.find((p) => p.code === slots.plan);
  if (!chosen) {
    const names = sellable.map((p) => planLabel(p.code)).join(" · ");
    return {
      ...one(`อายุ ${age} ปี บริษัทเขียนแผนนี้ไว้ให้เลือก ${names} ครับ สนใจแผนไหนบอกได้เลย`),
      replies: sellable.map((p) => planLabel(p.code)),
    };
  }

  // a territory the plan is not written for is not quoted in it; the caller has already told
  // the customer, and quoting Thailand under a heading that says เอเชีย would be worse
  const territories = territoriesFor(table, chosen.code, age);
  const territory = slots.territory && territories.includes(slots.territory)
    ? slots.territory
    : IHEALTHY_OPENING.territory;

  const v = arrangementFor({ age, sex, plan: chosen.code, territory });
  const priced = iHealthyPricing(table, {
    base: v.base, sex, age, sumAssured: v.sumAssured,
    plan: v.plan, territory: v.territory, coverage: v.coverage,
  });
  const shown = shownAt(priced, v.mode);
  const facts = iHealthyFacts();
  const text = iHealthyQuoteText({
    arrangement: {
      planName: planLabel(chosen.code),
      annualMax: chosen.annualMax,
      deductible: chosen.deductible,
      territory: v.territory,
      coverage: v.coverage,
    },
    copayPercent: facts.copayPercent,
    age,
    sex,
    baseLabel: table.bases.find((b) => b.variant === v.base)?.label ?? v.base,
    sumAssured: v.sumAssured,
    death: deathBenefitOf(table, v.base, age, v.sumAssured),
    mode: v.mode,
    minMonthly: table.minMonthly,
    shown,
  });

  // no text means no price may be shown; the card would say the same thing in a picture
  if (!text) {
    return one(`ตอนนี้ยังคิดราคาแผนนี้ให้ไม่ได้ครับ ขอราคาปัจจุบันจากตัวแทนได้เลย ${HEALTH_HAND_OVER}`);
  }

  return {
    messages: [{ text, card: `${cardPath(table, v)}&fit=phone` }],
    priced: true,
    replies: QUOTE_REPLIES,
  };
}

/** Whether this customer has been quoted: the three things a price needs. */
export function hasHealthQuote(slots: HealthSlots): boolean {
  return slots.age !== undefined && slots.sex !== undefined && slots.plan !== undefined;
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/ihealthy-assistant-quote.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run verify && git add src/lib/assistant/ihealthy/quote.ts tests/calc/ihealthy-assistant-quote.test.ts && git commit -m "$(cat <<'MSG'
feat(assistant): quote one health plan in the sales page's own words

The text is iHealthyQuoteText and the picture is the page's own card, both
built from one call to the engine, so the words and the picture cannot
disagree. The age is refused here rather than at the card, because a link for
a five-year-old is quietly drawn as a six-year-old.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 11: The menu of three plans

**Files:**
- Create: `src/lib/assistant/ihealthy/menu.ts`
- Test: `tests/calc/ihealthy-assistant-menu.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-assistant-menu.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { healthMenu, otherPlansReply } from "@/lib/assistant/ihealthy/menu";
import { formatBaht } from "@/calc/money";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { iHealthyPricing } from "@/lib/ihealthy-quote";
import { initialFrom } from "@/lib/ihealthy-link";

const priceOf = (plan: string, age = 35, sex: "M" | "F" = "F") => {
  const table = iHealthyTable();
  const priced = iHealthyPricing(table, {
    base: "WLF99H", sex, age, sumAssured: 150_000,
    plan, territory: "ประเทศไทย", coverage: "Full Coverage",
  })!;
  return formatBaht(priced.total.find((m) => m.mode === "annual")!.total);
};

describe("the menu an age and a sex earn", () => {
  it("offers the three plans the adverts sell, priced by the engine", () => {
    const reply = healthMenu(35, "F");
    const text = reply.messages[0].text;
    expect(reply.replies).toEqual(["บรอนซ์", "ซิลเวอร์", "โกลด์"]);
    for (const [name, code] of [["บรอนซ์", "BRONZE"], ["ซิลเวอร์", "SILVER"], ["โกลด์", "GOLD"]]) {
      expect(text).toContain(`${name} ${priceOf(code)}`);
    }
    expect(text).toContain("หญิง 35 ปี");
  });

  it("says what the total is made of, because the menu is a total", () => {
    expect(healthMenu(35, "F").messages[0].text).toContain("รวมสัญญาหลัก");
  });

  it("sends the comparison table as a picture of the same three", () => {
    const card = healthMenu(35, "F").messages[0].card!;
    expect(card).toContain("/api/ihealthy-card/table?");
    expect(card).toContain("fit=phone");
    const asked = initialFrom(iHealthyTable(), Object.fromEntries(new URLSearchParams(card.split("?")[1])));
    expect(asked).toMatchObject({ age: 35, sex: "F" });
  });

  it("offers a child only the two plans a child may buy", () => {
    const reply = healthMenu(8, "M");
    expect(reply.replies).toEqual(["สมาร์ท", "บรอนซ์"]);
    expect(reply.messages[0].text).toContain(`สมาร์ท ${priceOf("SMART", 8, "M")}`);
  });

  it("never carries a price, and never a picture, for an age off the table", () => {
    for (const age of [5, 81]) {
      const reply = healthMenu(age, "F");
      expect(reply.messages[0].card).toBeUndefined();
      expect(reply.messages[0].text).toContain("6-80");
    }
  });

  it("shows no price at all once the rate table has lapsed", () => {
    const reply = healthMenu(35, "F", new Date("2099-01-01"));
    expect(reply.messages[0].card).toBeUndefined();
    expect(reply.messages[0].text).toContain("ขอราคาปัจจุบัน");
  });
});

describe("the plans the menu did not offer", () => {
  it("names them with their prices and puts them on buttons", () => {
    const reply = otherPlansReply(35, "F");
    expect(reply.replies).toEqual(["สมาร์ท", "ไดมอนด์", "แพลทินั่ม"]);
    expect(reply.messages[0].text).toContain(`สมาร์ท ${priceOf("SMART")}`);
  });

  it("says so plainly when an age has no others", () => {
    const reply = otherPlansReply(8, "M");
    expect(reply.replies).toEqual(["สมาร์ท", "บรอนซ์"]);
    expect(reply.messages[0].text).toContain("อายุ 8");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/ihealthy-assistant-menu.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/ihealthy/menu"`.

- [ ] **Step 3: Write the module**

Create `src/lib/assistant/ihealthy/menu.ts`:

```ts
import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { planLabel } from "@/lib/ihealthy-facts";
import { queryFrom } from "@/lib/ihealthy-link";
import { phoneColumns } from "@/lib/ihealthy-phone";
import { iHealthyPricing, plansFor } from "@/lib/ihealthy-quote";
import { iHealthyTable, type IHealthyTable } from "@/lib/ihealthy-table";
import { one, type Reply } from "../common";
import { HEALTH_HAND_OVER, arrangementFor } from "./quote";

const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

/**
 * What one plan costs this customer a year, in baht, or nothing where it has no price.
 *
 * The yearly instalment rather than the monthly: it is the one every plan has — the company
 * refuses a monthly instalment under its own floor — and a menu with a gap in it reads as a
 * plan that cannot be bought.
 */
function yearly(table: IHealthyTable, age: number, sex: Sex, plan: string): string | undefined {
  const v = arrangementFor({ age, sex, plan });
  const priced = iHealthyPricing(table, {
    base: v.base, sex, age, sumAssured: v.sumAssured,
    plan, territory: v.territory, coverage: v.coverage,
  });
  const annual = priced?.total.find((m) => m.mode === "annual");
  return annual ? formatBaht(annual.total) : undefined;
}

/** What the customer is told the totals are made of, once, under the list. */
const WHAT_IS_IN_IT =
  "(รวมสัญญาหลักทุน 150,000 กับค่าชดเชยรายวันแล้ว · ค่ารักษาที่เหลือจ่ายตามจริงทุกแผน)";

/**
 * The three plans the adverts sell, priced, with the comparison table as a picture.
 *
 * Six plans as six lines of Thai in a chat is a list nobody reads; the same plans as a table
 * is something a customer compares, and they compare it on a phone — so the picture carries
 * the three the sales page shows on one, and the buttons under it are those three by name.
 */
export function healthMenu(age: number, sex: Sex, today: Date = new Date()): Reply {
  const table = iHealthyTable(today);
  if (age < table.ageMin || age > table.ageMax) {
    return one(`ไอเฮลท์ตี้ อัลตร้า รับประกันอายุ ${table.ageMin}-${table.ageMax} ปีครับ อายุ ${age} ปีอยู่นอกช่วงนี้ ${HEALTH_HAND_OVER}`);
  }
  if (table.expired) {
    return one(`ตารางเบี้ยชุดนี้หมดอายุแล้วครับ ขอราคาปัจจุบันจากตัวแทนได้เลย ${HEALTH_HAND_OVER}`);
  }

  const sellable = plansFor(table, age).map((p) => p.code);
  const order = table.plans.map((p) => p.code);
  const shown = phoneColumns(order, sellable);
  const priced = shown
    .map((code) => ({ code, amount: yearly(table, age, sex, code) }))
    .filter((row): row is { code: string; amount: string } => row.amount !== undefined);

  if (priced.length === 0) {
    return one(`ตอนนี้ยังคิดราคาให้ไม่ได้ครับ ขอราคาปัจจุบันจากตัวแทนได้เลย ${HEALTH_HAND_OVER}`);
  }

  const lines = priced.map((row) => `${planLabel(row.code)} ${row.amount} บาท`).join("\n");
  // the picture opens on the first of them; nothing is highlighted, so which one only decides
  // the arrangement the table is priced from, and all of them share it
  const v = arrangementFor({ age, sex, plan: priced[0].code });
  return {
    messages: [{
      text: `${SEX_WORD[sex]} ${age} ปี เบี้ยรวมต่อปีครับ 🏥\n${lines}\n${WHAT_IS_IN_IT}`,
      card: `/api/ihealthy-card/table?${queryFrom(table, v)}&fit=phone`,
    }],
    replies: priced.map((row) => planLabel(row.code)),
  };
}

/**
 * The plans the menu left out, by name and price.
 *
 * The adverts sell three of six. The other three are real and the company writes them, so a
 * customer who asks what else there is gets them rather than a shrug — and an age that has no
 * others is told that in one line instead of being shown an empty list.
 */
export function otherPlansReply(age: number, sex: Sex, today: Date = new Date()): Reply {
  const table = iHealthyTable(today);
  if (age < table.ageMin || age > table.ageMax || table.expired) return healthMenu(age, sex, today);

  const sellable = plansFor(table, age).map((p) => p.code);
  const order = table.plans.map((p) => p.code);
  const inMenu = phoneColumns(order, sellable);
  const rest = sellable.filter((code) => !inMenu.includes(code));

  if (rest.length === 0) {
    const names = sellable.map(planLabel).join(" กับ ");
    return {
      ...one(`อายุ ${age} ปี บริษัทเขียนไว้ให้เลือกสองแผนนี้ครับ — ${names}`),
      replies: sellable.map(planLabel),
    };
  }

  const priced = rest
    .map((code) => ({ code, amount: yearly(table, age, sex, code) }))
    .filter((row): row is { code: string; amount: string } => row.amount !== undefined);
  const lines = priced.map((row) => `${planLabel(row.code)} ${row.amount} บาท`).join("\n");
  return {
    ...one(`อีกสามแผนที่มีครับ เบี้ยรวมต่อปี\n${lines}`),
    replies: priced.map((row) => planLabel(row.code)),
  };
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/ihealthy-assistant-menu.test.ts`
Expected: PASS. If the `otherPlansReply` line about "อีกสามแผน" does not match the number the
rate table actually leaves over, count it from `priced.length` rather than writing three.

- [ ] **Step 5: Commit**

```bash
npm run verify && git add src/lib/assistant/ihealthy/menu.ts tests/calc/ihealthy-assistant-menu.test.ts && git commit -m "$(cat <<'MSG'
feat(assistant): the three plans the adverts sell, as a table and three buttons

Six plans as six lines of Thai in a chat is a list nobody reads. The same
three the sales page shows on a phone, priced by the engine and drawn as a
comparison table, is something a customer compares — and the buttons under it
are the plans by name, so a tap arrives as a plan the bot already quotes.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 12: What the model is told about the health contract

**Files:**
- Create: `src/lib/assistant/ihealthy/prompts.ts`
- Test: `tests/calc/ihealthy-assistant-prompts.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-assistant-prompts.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  HEALTH_PLAN_INFO_SYSTEM, HEALTH_SMALL_TALK_SYSTEM, healthFactsFor,
} from "@/lib/assistant/ihealthy/prompts";
import { iHealthyFacts } from "@/lib/ihealthy-facts";

const WHO = { product: "ihealthy" as const, intent: "plan_info" as const, age: 35, sex: "F" as const };

describe("what the model is forbidden", () => {
  for (const [name, prompt] of [
    ["plan info", HEALTH_PLAN_INFO_SYSTEM], ["small talk", HEALTH_SMALL_TALK_SYSTEM],
  ] as const) {
    it(`${name} never judges whether a person will be accepted`, () => {
      expect(prompt).toContain("ห้ามประเมินว่าโรค");
    });
    it(`${name} never gives medical advice`, () => {
      expect(prompt).toContain("ห้ามวินิจฉัย");
    });
    it(`${name} tells the truth when asked outright whether it is a person`, () => {
      expect(prompt).toContain("ระบบช่วยตอบของเพจ");
    });
    it(`${name} never states a figure of its own`, () => {
      expect(prompt).toContain("ห้ามคิดตัวเลขเอง");
    });
  }

  it("sends the claim and the underwriting to a person", () => {
    expect(HEALTH_PLAN_INFO_SYSTEM).toContain("การเคลม");
    expect(HEALTH_PLAN_INFO_SYSTEM).toContain("โรงพยาบาลในเครือ");
  });
});

describe("the facts the model is given", () => {
  it("carries the contract's own terms", () => {
    const { terms } = iHealthyFacts();
    const text = healthFactsFor(WHO);
    expect(text).toContain(String(terms.waitingDays));
    expect(text).toContain(String(terms.renewalToAge));
    expect(text).toContain(String(terms.noClaimDiscountPercent));
  });

  it("carries every benefit row of the plan that was chosen, and no other plan's", () => {
    const text = healthFactsFor({ ...WHO, plan: "GOLD" });
    expect(text).toContain("โกลด์");
    expect(text).toContain("หมวดที่ 1");
    expect(text).not.toContain("แพลทินั่ม");
  });

  it("carries the headline rows of the menu plans before one is chosen", () => {
    const text = healthFactsFor(WHO);
    expect(text).toContain("บรอนซ์");
    expect(text).toContain("โกลด์");
  });

  it("hands over the premium it already sent, to be copied and never recomputed", () => {
    const text = healthFactsFor({ ...WHO, plan: "GOLD" });
    expect(text).toContain("รายปี");
    expect(text).toContain("ห้ามคำนวณเอง");
  });

  it("says nothing about a premium before one has been sent", () => {
    expect(healthFactsFor({ product: "ihealthy", intent: "other" })).not.toContain("ห้ามคำนวณเอง");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/ihealthy-assistant-prompts.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/ihealthy/prompts"`.

- [ ] **Step 3: Write the module**

Create `src/lib/assistant/ihealthy/prompts.ts`:

```ts
import { formatBaht } from "@/calc/money";
import { PAY_MODE_LABEL } from "@/calc/types";
import { benefitValue, isHeading, iHealthyFacts, planLabel } from "@/lib/ihealthy-facts";
import { PHONE_ROW_LABEL, phoneColumns } from "@/lib/ihealthy-phone";
import { iHealthyPricing, plansFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { VOICE } from "../prompts";
import { arrangementFor } from "./quote";
import type { HealthSlots } from "./route";

/**
 * What the model may say about a medical contract, on top of the voice both brains share.
 *
 * The three extra prohibitions are the ones this contract invites and the life one does not:
 * a customer describing a symptom wants to be told they are covered, and neither this code
 * nor a model may say so — whether a condition is accepted is the underwriter's answer, what
 * to do about it is a doctor's, and which hospitals settle a bill directly changes without
 * anyone here being told.
 */
const HEALTH_RULES = `ห้ามประเมินว่าโรค อาการ หรือประวัติการรักษาใดจะได้รับความคุ้มครองหรือรับประกันได้หรือไม่ นั่นเป็นผลการพิจารณาของบริษัท
ห้ามวินิจฉัยอาการ ห้ามแนะนำการรักษา ห้ามแนะนำว่าควรไปโรงพยาบาลไหน
เรื่องการเคลม การใช้สิทธิ โรงพยาบาลในเครือ และการพิจารณารับประกัน ให้บอกว่าตัวแทนจะมาตอบในแชทนี้
ถ้าพูดถึงเบี้ย ให้บอกว่าเป็นเบี้ยปีแรกและปรับตามอายุที่เพิ่มขึ้นทุกปี`;

export const HEALTH_PLAN_INFO_SYSTEM = `${VOICE}

${HEALTH_RULES}

ข้อมูล: ตอบจากข้อมูลที่ให้ไว้ด้านล่างเท่านั้น ห้ามเดา ห้ามคิดตัวเลขเอง
ห้ามบอกให้ลูกค้าไปถามตัวแทนเรื่องเบี้ยประกัน ระบบนี้คิดเบี้ยให้ได้เองทุกอายุทุกเพศ
ถ้าลูกค้าอยากรู้เบี้ย ให้ขอเพศกับอายุ แล้วบอกว่าเดี๋ยวคิดให้
ไม่ต้องปิดท้ายทุกข้อความด้วยการให้ไปถามตัวแทน`;

export const HEALTH_SMALL_TALK_SYSTEM = `${VOICE}

${HEALTH_RULES}

ห้ามคิดตัวเลขเอง ห้ามบอกตัวเลขเบี้ยหรือผลประโยชน์ใดๆ เอง
ถ้าเป็นการทักทายครั้งแรก: ทักกลับสั้นๆ แล้วชวนเข้าเรื่องด้วยการขอ อายุ กับ เพศ เพื่อคิดเบี้ยให้
ถ้าลูกค้าขอบคุณ รับทราบ บอกว่าขอคิดดูก่อน หรือจะติดต่อกลับ: ตอบสั้นๆ บรรทัดเดียวแล้วจบ ห้ามขอข้อมูล ห้ามชวนคุยต่อ ห้ามขาย
ห้ามขอข้อมูลที่ทราบแล้ว (ดูด้านล่าง ถ้ามี)
ความยาวไม่เกิน 2 บรรทัด`;

/**
 * The contract as the company wrote it, for the model to answer out of.
 *
 * Built from the benefit sheet and the rate tables on every call, so a rate revision or a
 * re-extracted sheet reaches the chat without anyone retyping a figure — and so the model has
 * no reason to reach for one of its own.
 */
export function healthFactsFor(slots: HealthSlots, today: Date = new Date()): string {
  const facts = iHealthyFacts();
  const table = iHealthyTable(today);
  const { terms } = facts;

  const contract = [
    "ชื่อสัญญา: สัญญาเพิ่มเติมค่ารักษาพยาบาล ไอเฮลท์ตี้ อัลตร้า (iHealthy Ultra) แบบเหมาจ่ายต่อรอบปีกรมธรรม์",
    `รับประกันอายุ ${table.ageMin}-${table.ageMax} ปี ต่ออายุได้ถึงอายุ ${terms.renewalToAge} ปี`,
    "เป็นสัญญาเพิ่มเติม ต้องแนบกับสัญญาประกันชีวิตเสมอ",
    `ระยะเวลารอคอย ${terms.waitingDays} วัน · โรคเหล่านี้รอ ${terms.specialWaitingDays} วัน: ${terms.specialWaitingDiseases.join(" · ")}`,
    "อุบัติเหตุคุ้มครองทันที ไม่มีระยะเวลารอคอย",
    `ไม่เคลมตลอดปีกรมธรรม์ ได้ส่วนลดเบี้ยปีถัดไป ${terms.noClaimDiscountPercent} เปอร์เซ็นต์`,
    `รักษานอกอาณาเขตที่เลือก คุ้มครองได้ไม่เกิน ${terms.outOfTerritoryDays} วันต่อครั้ง`,
    `เงื่อนไขการต่ออายุของบริษัท: ${terms.renewalCopay}`,
    "เบี้ยส่วนค่ารักษาปรับตามอายุที่เพิ่มขึ้นทุกปี ส่วนเบี้ยสัญญาหลักคงที่",
  ].join("\n");

  return `\n\nข้อมูลสัญญา\n${contract}\n\nผลประโยชน์\n${benefits(slots, today)}${known(slots, today)}`;
}

/**
 * The benefit rows, narrowed to what this turn is about.
 *
 * A chosen plan gets its whole column — thirty-six rows of the company's own wording, which is
 * what a question like "ทำฟันได้ไหม" is actually asking about. Before a plan is chosen only the
 * five headline rows of the plans on the menu go in: the whole sheet for six plans is a prompt
 * six times the size, for a customer who has not yet said which one they mean.
 */
function benefits(slots: HealthSlots, today: Date): string {
  const facts = iHealthyFacts();
  const table = iHealthyTable(today);
  const age = slots.age ?? table.ageMin;
  const sellable = plansFor(table, age).map((p) => p.code);

  if (slots.plan && sellable.includes(slots.plan)) {
    const rows = facts.rows
      .filter((entry) => !isHeading(entry))
      .map((entry) => {
        const row = entry as Exclude<typeof entry, { heading: string }>;
        const value = benefitValue(row, slots.plan!, age);
        return value ? `${row.title}: ${value}` : "";
      })
      .filter(Boolean);
    return `แผน${planLabel(slots.plan)} (วงเงินค่ารักษาต่อปี ${facts.plans.find((p) => p.code === slots.plan)!.annualMax.toLocaleString("en-US")} บาท)\n${rows.join("\n")}`;
  }

  const shown = phoneColumns(table.plans.map((p) => p.code), sellable);
  const head = shown.map((code) => {
    const plan = facts.plans.find((p) => p.code === code)!;
    const cells = facts.rows
      .filter((entry) => !isHeading(entry))
      .filter((entry) => {
        const no = (entry as { no: number | null }).no;
        return no !== null && no in PHONE_ROW_LABEL;
      })
      .map((entry) => {
        const row = entry as Exclude<typeof entry, { heading: string }>;
        return `${PHONE_ROW_LABEL[row.no!].label} ${benefitValue(row, code, age) ?? "-"}`;
      });
    return `${planLabel(code)} · วงเงิน ${plan.annualMax.toLocaleString("en-US")} บาทต่อปี · ${cells.join(" · ")}`;
  });
  return `แผนที่เสนออยู่\n${head.join("\n")}\nยังมีแผนอื่นอีก ถ้าลูกค้าถามให้บอกว่าขอดูแผนอื่นได้`;
}

/**
 * What is already known about this customer, and the premium they have already been sent.
 *
 * A figure the model can copy is a figure it cannot invent: on the life plan, asked whether the
 * premium was level, it answered 3,790 a month where the quotation it had sent five messages
 * earlier said 3,861.
 */
function known(slots: HealthSlots, today: Date): string {
  const table = iHealthyTable(today);
  const bits: string[] = [];
  if (slots.sex) bits.push(slots.sex === "M" ? "ชาย" : "หญิง");
  if (slots.age !== undefined) bits.push(`อายุ ${slots.age} ปี`);
  if (slots.plan) bits.push(`แผน${planLabel(slots.plan)}`);
  if (slots.territory) bits.push(`อาณาเขต${slots.territory}`);
  if (bits.length === 0) return "";

  const quoted = quotedFigures(slots, today);
  return `\n\nข้อมูลของลูกค้ารายนี้ที่ทราบแล้ว: ${bits.join(" · ")}\n`
    + "ห้ามขอข้อมูลที่ทราบแล้วซ้ำอีก\n"
    + (quoted
      ? `เบี้ยที่คิดและส่งให้ลูกค้าไปแล้วคือ ${quoted}\n`
        + "ถ้าจะพูดถึงตัวเลขเบี้ย ให้ใช้ตัวเลขชุดนี้เท่านั้น คัดลอกมาตรงๆ ห้ามคำนวณเอง ห้ามประมาณ ห้ามปัดเศษ\n"
        + "ถ้าลูกค้าอยากได้เบี้ยของอายุหรือแผนอื่น ห้ามตอบเป็นตัวเลข ให้บอกว่าเดี๋ยวคิดให้"
      : "ถ้าลูกค้าอยากได้เบี้ย ให้ขอเฉพาะข้อมูลที่ยังขาด ห้ามตอบตัวเลขเบี้ยเอง");
}

/** The premium this customer has already been sent, as the engine computed it. */
function quotedFigures(slots: HealthSlots, today: Date): string | undefined {
  const table = iHealthyTable(today);
  const { age, sex, plan } = slots;
  if (age === undefined || sex === undefined || plan === undefined || table.expired) return undefined;
  if (!plansFor(table, age).some((p) => p.code === plan)) return undefined;

  const v = arrangementFor({ age, sex, plan, territory: slots.territory });
  const priced = iHealthyPricing(table, {
    base: v.base, sex, age, sumAssured: v.sumAssured,
    plan, territory: v.territory, coverage: v.coverage,
  });
  if (!priced) return undefined;
  return priced.total
    .filter((m) => !m.belowMinimum)
    .map((m) => `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`)
    .join(" · ");
}
```

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/ihealthy-assistant-prompts.test.ts`
Expected: PASS. `isHeading` narrows a `BenefitEntry`; if TypeScript will not accept the casts
above, filter with `facts.rows.filter((e): e is BenefitRow => !isHeading(e))` and import
`type BenefitRow` from `@/lib/ihealthy-facts` instead.

- [ ] **Step 5: Commit**

```bash
npm run verify && git add src/lib/assistant/ihealthy/prompts.ts tests/calc/ihealthy-assistant-prompts.test.ts && git commit -m "$(cat <<'MSG'
feat(assistant): tell the model the contract, and what it may not say about it

Three prohibitions this contract invites and the life one does not: whether a
condition is covered is the underwriter's answer, what to do about it is a
doctor's, and which hospitals settle directly changes without anyone here
being told. The facts are built from the benefit sheet on every call, and the
premium already sent goes in so the model copies it instead of inventing one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 13: The health brain

**Files:**
- Create: `src/lib/assistant/ihealthy/answer.ts`
- Test: `tests/calc/ihealthy-assistant-answer.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/ihealthy-assistant-answer.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

let routed: Record<string, unknown> = { intent: "other" };
let worded = "ยินดีครับ";
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task === "route_health" ? JSON.stringify(routed) : worded,
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerHealth } = await import("@/lib/assistant/ihealthy/answer");
const { healthQuote } = await import("@/lib/assistant/ihealthy/quote");

const said = (content: string) => [{ role: "user" as const, content }];
const KNOWN = { product: "ihealthy" as const, intent: "quote" as const, age: 35, sex: "F" as const };

beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; worded = "ยินดีครับ"; });

describe("before it knows who it is quoting", () => {
  it("asks for what is missing and nothing else", async () => {
    routed = { intent: "quote" };
    const answer = await answerHealth(said("ขอราคาหน่อย"), null);
    expect(answer.messages[0].text).toContain("อายุ");
    expect(answer.messages[0].text).toContain("เพศ");
    expect(answer.messages[0].card).toBeUndefined();
  });

  it("asks only for the sex when the age is already in", async () => {
    routed = { intent: "quote", age: 35 };
    const answer = await answerHealth(said("35"), null);
    expect(answer.messages[0].text).toContain("เพศ");
    expect(answer.messages[0].text).not.toContain("ขออายุ");
  });
});

describe("once it knows an age and a sex", () => {
  it("sends the menu, not a quote", async () => {
    routed = { intent: "quote", age: 35, sex: "F" };
    const answer = await answerHealth(said("หญิง 35"), null);
    expect(answer.replies).toEqual(["บรอนซ์", "ซิลเวอร์", "โกลด์"]);
    expect(answer.messages[0].card).toContain("/api/ihealthy-card/table?");
  });

  it("quotes the plan that is tapped, exactly as the quote module words it", async () => {
    routed = { intent: "quote" };
    const answer = await answerHealth(said("โกลด์"), KNOWN);
    const expected = healthQuote({ ...KNOWN, plan: "GOLD" });
    expect(answer.messages[0].text).toBe(expected.messages[0].text);
    expect(answer.messages[0].card).toBe(expected.messages[0].card);
    expect(answer.priced).toBe(true);
    expect(answer.slots.plan).toBe("GOLD");
  });
});

describe("the answers it gives without paying a model", () => {
  const quoted = { ...KNOWN, plan: "GOLD" };

  it("offers the plans the menu left out", async () => {
    const answer = await answerHealth(said("ดูแผนอื่น"), quoted);
    expect(answer.replies).toEqual(["สมาร์ท", "ไดมอนด์", "แพลทินั่ม"]);
    expect(chat).not.toHaveBeenCalled();
  });

  it("points at the cheaper plan when the price is called too high", async () => {
    const answer = await answerHealth(said("แพงไป"), { ...quoted, plan: "SILVER" });
    expect(answer.replies).toContain("บรอนซ์");
    expect(chat).not.toHaveBeenCalled();
  });

  it("says so when there is nothing cheaper left", async () => {
    const answer = await answerHealth(said("แพงไป"), { ...quoted, plan: "SMART" });
    expect(answer.messages[0].text).toContain("ถูกที่สุด");
  });

  it("turns down a territory the plan is not written for, and names the two that are", async () => {
    const answer = await answerHealth(said("คุ้มครองเอเชียด้วยไหม"), quoted);
    expect(answer.messages[0].text).toContain("ไดมอนด์");
    expect(answer.replies).toEqual(["ไดมอนด์", "แพลทินั่ม"]);
    expect(answer.messages[0].card).toBeUndefined();
  });

  it("re-prices in a territory the plan is written for", async () => {
    const answer = await answerHealth(said("เอเชียล่ะ"), { ...quoted, plan: "DIAMOND" });
    expect(answer.messages[0].text).toContain("เอเชีย");
    expect(answer.messages[0].card).toBeDefined();
    expect(answer.slots.territory).toBe("เอเชีย");
  });

  it("describes the two ways of sharing a bill without pricing either", async () => {
    const answer = await answerHealth(said("มีแบบรับผิดส่วนแรกไหม"), quoted);
    expect(answer.messages[0].text).toContain("เฉพาะประเทศไทย");
    expect(answer.messages[0].card).toBeUndefined();
    expect(chat).not.toHaveBeenCalled();
  });

  it("sends the whole sheet as a link to the page, opened where the customer is", async () => {
    const answer = await answerHealth(said("ขอตารางเต็ม"), quoted);
    const link = answer.messages.map((m) => m.text).join("\n");
    expect(link).toContain("/ihealthy-ultra?");
    expect(link).toContain("plan=GOLD");
    expect(chat).not.toHaveBeenCalled();
  });

  it("hands over the form when the customer decides", async () => {
    const answer = await answerHealth(said("สมัครยังไง"), quoted);
    expect(answer.messages.some((m) => m.text.includes("ktaxaform"))).toBe(true);
    expect(answer.slots.formSent).toBe(true);
    expect(chat).not.toHaveBeenCalled();
  });

  it("lets a customer leave without being sold to", async () => {
    const answer = await answerHealth(said("ขอคิดดูก่อนนะคะ"), quoted);
    expect(answer.messages).toHaveLength(1);
    expect(chat).not.toHaveBeenCalled();
  });

  it("answers the health declaration before anything else", async () => {
    const answer = await answerHealth(said("เป็นเบาหวาน ทำได้ไหม"), quoted);
    expect(answer.messages[0].text).toContain("แถลงข้อมูลสุขภาพตามจริง");
    expect(chat).not.toHaveBeenCalled();
  });
});

describe("what it asks a model for", () => {
  it("reads the message, then words a benefit answer from the sheet", async () => {
    routed = { intent: "plan_info" };
    worded = "โกลด์ได้ OPD 12,000 บาทต่อปีครับ";
    const answer = await answerHealth(said("OPD ได้ไหม"), { ...KNOWN, plan: "GOLD" });
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route_health", "plan_info_health"]);
    const system = String(chat.mock.calls[1][0].messages[0].content);
    expect(system).toContain("โกลด์");
    expect(system).not.toContain("แพลทินั่ม");
    expect(answer.messages[0].text).toBe(worded);
  });

  it("never words a premium itself", async () => {
    routed = { intent: "quote" };
    await answerHealth(said("โกลด์"), KNOWN);
    expect(chat.mock.calls.map((c) => c[0].task)).toEqual(["route_health"]);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/ihealthy-assistant-answer.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/ihealthy/answer"`.

- [ ] **Step 3: Write the module**

Create `src/lib/assistant/ihealthy/answer.ts`:

```ts
import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import type { Sex } from "@/calc/types";
import { planLabel } from "@/lib/ihealthy-facts";
import { queryFrom } from "@/lib/ihealthy-link";
import { plansFor, territoriesFor } from "@/lib/ihealthy-quote";
import { iHealthyTable } from "@/lib/ihealthy-table";
import { siteUrl } from "@/lib/site-url";
import {
  WANTS_IN, aboutCompany, affirms, asksAboutCompany, asksCheaper, handOverForm, one,
  recentTurns, saysFormDone, spoken, stallReply, stalls, wantsToBuy, type Reply,
} from "../common";
import { healthFaqAnswer } from "./faq";
import { healthMenu, otherPlansReply } from "./menu";
import { HEALTH_PLAN_INFO_SYSTEM, HEALTH_SMALL_TALK_SYSTEM, healthFactsFor } from "./prompts";
import { HEALTH_HAND_OVER, SEE_OTHER_PLANS, THIS_PLAN_BENEFITS, hasHealthQuote, healthQuote } from "./quote";
import {
  asksFullTable, asksOtherPlans, asksShareOfBill, routeHealth, territoryNamedIn, type HealthSlots,
} from "./route";

/** One answer from the health brain, and what it should remember next turn. */
export type HealthAnswer = Reply & { slots: HealthSlots };

const ASK_FOR_DETAILS = 'ขออายุกับเพศหน่อยครับ เดี๋ยวดูเบี้ยให้เลย (เช่น "หญิง 35")';

/**
 * What is still needed, named one field at a time. A bot that asks again for something the
 * customer has already given reads as one that did not listen.
 */
function askForMissing(slots: HealthSlots): string {
  const missing: string[] = [];
  if (slots.age === undefined) missing.push("อายุ");
  if (slots.sex === undefined) missing.push("เพศ");
  if (missing.length === 0 || missing.length === 2) return ASK_FOR_DETAILS;
  const example = missing[0] === "อายุ" ? "35" : "หญิง";
  return `ขอ${missing[0]}ด้วยครับ เดี๋ยวดูเบี้ยให้เลย (เช่น "${example}")`;
}

/**
 * The two arrangements that lower the premium by moving part of the bill to the customer.
 *
 * Described and not priced: both are sold in Thailand only and neither is quoted in this chat,
 * so the honest answer names them and hands the figure to someone who will work it out.
 */
const SHARE_OF_BILL_ANSWER =
  "มีทั้งแบบมีความรับผิดส่วนแรกและแบบร่วมจ่ายครับ เบี้ยถูกลงพอสมควร แลกกับที่เราออกค่ารักษาส่วนแรกเอง\n"
  + `สองแบบนี้บริษัทขายเฉพาะอาณาเขตประเทศไทย และตัวเลขขอให้ตัวแทนคิดให้นะครับ ${HEALTH_HAND_OVER}`;

/** What the customer said this turn. */
function lastAsked(history: ChatMessage[]): string {
  return [...history].reverse().find((m) => m.role === "user")?.content ?? "";
}

/**
 * The health brain.
 *
 * Everything answerable from the engine or from a written sentence is answered before a model
 * is paid for anything, and the model is never asked to word a premium — the order of the
 * checks below is the whole of that guarantee.
 */
export async function answerHealth(
  history: ChatMessage[], previous: HealthSlots | null,
): Promise<HealthAnswer> {
  const asked = lastAsked(history);
  const known: HealthSlots = previous ?? { product: "ihealthy", intent: "other" };
  const quoted = hasHealthQuote(known);

  // leaving to think it over needs no model and changes nothing the bot knows
  if (stalls(asked)) return { ...one(stallReply(quoted)), slots: known };
  // the form is out and they say it is filled in: the agent takes it from here
  if (known.formSent && saysFormDone(asked)) {
    return { ...one("ขอบคุณครับ 🙏 เดี๋ยวตัวแทนเช็กข้อมูลแล้วติดต่อกลับในแชทนี้ครับ"), slots: known };
  }
  if (wantsToBuy(asked, quoted) && !affirms(asked)) {
    return { ...handOverForm(quoted), slots: { ...known, formSent: true } };
  }
  // a question about the company is answered by the agency's own sentence, whatever else the
  // turn was about
  if (asksAboutCompany(asked)) return { ...one(aboutCompany(asked)), slots: known };
  // one of the answers the agency writes out by hand: the declaration, the tax relief, the
  // rising premium, the waiting periods
  const faq = healthFaqAnswer(asked);
  if (faq) return { ...one(faq), slots: known };
  if (asksShareOfBill(asked)) return { ...one(SHARE_OF_BILL_ANSWER), slots: known };

  const table = iHealthyTable();
  if (asksFullTable(asked) && known.age !== undefined && known.sex !== undefined) {
    return { ...fullTableLink(known), slots: known };
  }
  if ((asksOtherPlans(asked) || asked === SEE_OTHER_PLANS) && known.age !== undefined && known.sex !== undefined) {
    return { ...otherPlansReply(known.age, known.sex), slots: known };
  }
  if (asksCheaper(asked) && known.age !== undefined && known.sex !== undefined) {
    return { ...cheaper(known.age, known.sex, known.plan), slots: known };
  }
  // a territory named while a plan is on the table either re-prices it or is turned down
  const wanted = territoryNamedIn(asked);
  if (wanted && known.plan && known.age !== undefined && known.sex !== undefined) {
    return territoryAnswer({ ...known, age: known.age, sex: known.sex, plan: known.plan }, wanted);
  }

  const slots = await routeHealth(history, previous);

  if (asked === THIS_PLAN_BENEFITS || slots.intent === "plan_info") {
    return { ...(await planInfo(history, slots)), slots };
  }
  if (slots.age === undefined || slots.sex === undefined) {
    return { ...one(askForMissing(slots)), slots };
  }
  if (slots.plan) {
    return { ...healthQuote({ ...slots, age: slots.age, sex: slots.sex, plan: slots.plan }), slots };
  }
  if (slots.intent === "quote") return { ...healthMenu(slots.age, slots.sex), slots };
  return { ...(await smallTalk(history, slots)), slots };
}

/**
 * The plan one step down, priced by the menu the customer has already seen.
 *
 * The cheapest plan has nothing under it, and saying so is better than offering the same plan
 * again — what is left after that is the share-of-bill arrangements, which is the next thing
 * this says.
 */
function cheaper(age: number, sex: Sex, plan?: string): Reply {
  const table = iHealthyTable();
  const sellable = plansFor(table, age).map((p) => p.code);
  if (!plan) return healthMenu(age, sex);
  const below = sellable.slice(0, sellable.indexOf(plan));
  if (below.length === 0) {
    return one(`แผน${planLabel(plan)} เป็นแผนที่เบี้ยถูกที่สุดของสัญญานี้แล้วครับ\n${SHARE_OF_BILL_ANSWER}`);
  }
  const next = below[below.length - 1];
  return {
    ...one(`ถ้าอยากให้เบาลง มีแผน${planLabel(next)} ครับ วงเงินน้อยกว่าแต่เบี้ยถูกกว่า อยากดูราคาไหมครับ`),
    replies: [planLabel(next), SEE_OTHER_PLANS],
  };
}

/** A territory re-prices the plan, or is turned down by name with the plans that do sell it. */
function territoryAnswer(
  slots: HealthSlots & { age: number; sex: Sex; plan: string }, wanted: string,
): HealthAnswer {
  const table = iHealthyTable();
  if (territoriesFor(table, slots.plan, slots.age).includes(wanted)) {
    const next = { ...slots, territory: wanted };
    return { ...healthQuote(next), slots: next };
  }
  const sold = plansFor(table, slots.age)
    .map((p) => p.code)
    .filter((code) => territoriesFor(table, code, slots.age).includes(wanted));
  if (sold.length === 0) {
    return { ...one(`อาณาเขต${wanted} สัญญานี้ไม่มีให้เลือกครับ ${HEALTH_HAND_OVER}`), slots };
  }
  return {
    ...one(`อาณาเขต${wanted} บริษัทเขียนไว้เฉพาะแผน${sold.map(planLabel).join("กับแผน")} ครับ อยากดูราคาแผนไหนบอกได้เลย`),
    replies: sold.map(planLabel),
    slots,
  };
}

/**
 * The whole benefit sheet is twenty-eight categories; a picture of it is a document. The page
 * already draws it, so the customer is sent there with their own arrangement already filled in.
 */
function fullTableLink(slots: HealthSlots & { age: number; sex: Sex }): Reply {
  const table = iHealthyTable();
  const sellable = plansFor(table, slots.age).map((p) => p.code);
  const plan = slots.plan && sellable.includes(slots.plan) ? slots.plan : sellable[sellable.length - 1];
  const query = queryFrom(table, {
    ...{ base: "WLF99H", sumAssured: 150_000, coverage: "Full Coverage", mode: "annual" as const },
    age: slots.age,
    sex: slots.sex,
    plan,
    territory: slots.territory ?? "ประเทศไทย",
  });
  return {
    messages: [
      { text: "ตารางผลประโยชน์เต็มทั้ง 28 หมวดอยู่ในหน้านี้ครับ เปิดมาจะกรอกอายุกับแผนไว้ให้แล้ว" },
      { text: siteUrl(`/ihealthy-ultra?${query}`) },
    ],
    replies: [SEE_OTHER_PLANS, WANTS_IN],
  };
}

async function planInfo(history: ChatMessage[], slots: HealthSlots): Promise<Reply> {
  const r = await chat({
    tier: "small",
    task: "plan_info_health",
    maxTokens: 400,
    messages: [
      { role: "system", content: `${HEALTH_PLAN_INFO_SYSTEM}${healthFactsFor(slots)}` },
      ...recentTurns(history, 6),
    ],
  });
  return spoken(r.text.trim(), ASK_FOR_DETAILS);
}

async function smallTalk(history: ChatMessage[], slots: HealthSlots): Promise<Reply> {
  const r = await chat({
    tier: "small",
    task: "small_talk_health",
    maxTokens: 200,
    messages: [
      { role: "system", content: `${HEALTH_SMALL_TALK_SYSTEM}${healthFactsFor(slots)}` },
      ...recentTurns(history, 6),
    ],
  });
  return spoken(r.text.trim(), ASK_FOR_DETAILS);
}
```

The `fullTableLink` spread of base/sum/coverage/mode is there only because `queryFrom` needs a
whole `IHealthyInitial`; import `arrangementFor` from `./quote` and use it instead if that reads
better once the compiler has had its say.

- [ ] **Step 4: Run the test**

Run: `npx vitest run tests/calc/ihealthy-assistant-answer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
npm run verify && git add src/lib/assistant/ihealthy/answer.ts tests/calc/ihealthy-assistant-answer.test.ts && git commit -m "$(cat <<'MSG'
feat(assistant): a brain that sells the health contract

Everything answerable from the engine or from a written sentence is answered
before a model is paid for anything, and no model ever words a premium — the
order of the checks is the whole of that guarantee. A territory the plan is not
written for is turned down by name rather than quietly quoted in Thailand.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 14: One door into two brains

**Files:**
- Create: `src/lib/assistant/slots.ts`
- Create: `src/lib/assistant/dispatch.ts`
- Modify: `src/lib/chat/session.ts` (the slot type)
- Modify: `src/lib/facebook/conversation.ts` (one call)
- Modify: `tests/calc/messenger-webhook.test.ts` (mock the new door)
- Modify: `tests/calc/chat-harness.test.ts` (rehearse either brain)
- Test: `tests/calc/assistant-dispatch.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/calc/assistant-dispatch.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatOptions } from "@/lib/ai/client";

let routed: Record<string, unknown> = { intent: "other" };
const chat = vi.fn(async ({ task }: ChatOptions) => ({
  text: task.startsWith("route") ? JSON.stringify(routed) : "ยินดีครับ",
  model: "stub", provider: "stub", inputTokens: 0, outputTokens: 0, costThb: 0,
}));
vi.mock("@/lib/ai/client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/client")>("@/lib/ai/client");
  return { ...actual, chat };
});

const { answerAny } = await import("@/lib/assistant/dispatch");
const { CHOOSE_HEALTH, CHOOSE_LIFE } = await import("@/lib/assistant/choose");

const said = (content: string) => [{ role: "user" as const, content }];
beforeEach(() => { chat.mockClear(); routed = { intent: "other" }; });

describe("a customer who has not said what they came for", () => {
  it("is asked, with two buttons, and no model is paid", async () => {
    const answer = await answerAny(said("สนใจค่ะ"), null);
    expect(answer.replies).toEqual([CHOOSE_HEALTH, CHOOSE_LIFE]);
    expect(answer.slots).toMatchObject({ product: "undecided" });
    expect(chat).not.toHaveBeenCalled();
  });

  it("is remembered by age and sex while it asks", async () => {
    const answer = await answerAny(said("หญิง 35"), null);
    expect(answer.slots).toMatchObject({ product: "undecided", age: 35, sex: "F" });
  });

  it("goes straight on once the button is tapped, without asking again", async () => {
    routed = { intent: "quote" };
    const answer = await answerAny(said(CHOOSE_HEALTH), { product: "undecided", age: 35, sex: "F" });
    expect(answer.slots).toMatchObject({ product: "ihealthy", age: 35, sex: "F" });
    expect(answer.messages[0].card).toContain("/api/ihealthy-card/table?");
  });
});

describe("a customer whose message says what they came for", () => {
  it("is answered in the same turn, with no button in the way", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerAny(said("สนใจประกันมรดก ทุน 1,000,000"), null);
    expect(answer.slots).toMatchObject({ product: "lifeprotect" });
    expect(answer.priced).toBe(true);
  });

  it("is heard from the subject alone when no plan is named", async () => {
    routed = { intent: "quote", age: 35, sex: "F" };
    const answer = await answerAny(said("ค่าห้องวันละเท่าไหร่ หญิง 35"), null);
    expect(answer.slots.product).toBe("ihealthy");
  });
});

describe("a conversation already under way", () => {
  it("treats a session from before this existed as the life plan", async () => {
    routed = { intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000 };
    const answer = await answerAny(said("ชาย 35 ล้านนึง"), { intent: "quote" } as never);
    expect(answer.slots.product).toBe("lifeprotect");
  });

  it("switches when the other plan is named, carrying only the person", async () => {
    routed = { intent: "other" };
    const answer = await answerAny(said("แล้ว Life Protect ล่ะ"), {
      product: "ihealthy", intent: "quote", age: 35, sex: "F", plan: "GOLD", territory: "เอเชีย",
    });
    expect(answer.slots).toMatchObject({ product: "lifeprotect", age: 35, sex: "F" });
    expect(JSON.stringify(answer.slots)).not.toContain("GOLD");
    expect(JSON.stringify(answer.slots)).not.toContain("เอเชีย");
  });

  it("does not switch on a health declaration asked of a life customer", async () => {
    routed = { intent: "plan_info" };
    const answer = await answerAny(said("ต้องตรวจสุขภาพไหม"), {
      product: "lifeprotect", intent: "quote", age: 35, sex: "M", coverWanted: 1_000_000,
    });
    expect(answer.slots.product).toBe("lifeprotect");
  });

  it("does not switch on a subject when a plan is already settled", async () => {
    routed = { intent: "plan_info" };
    const answer = await answerAny(said("ทุนเท่าไหร่"), {
      product: "ihealthy", intent: "quote", age: 35, sex: "F", plan: "GOLD",
    });
    expect(answer.slots.product).toBe("ihealthy");
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx vitest run tests/calc/assistant-dispatch.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/assistant/dispatch"`.

- [ ] **Step 3: Write the slot union**

Create `src/lib/assistant/slots.ts`:

```ts
import type { HealthSlots } from "./ihealthy/route";
import type { Routed } from "./lifeprotect/route";

/**
 * A customer the bot has asked which plan they came for, and who has not yet said.
 *
 * It carries a person because the question and the answer are two turns: someone who opens
 * with "หญิง 35" has already given the two things either brain would ask for next, and being
 * asked for them again after tapping a button is the bot admitting it was not listening.
 */
export interface Undecided {
  product: "undecided";
  age?: number;
  sex?: "M" | "F";
}

/**
 * Everything a session row can be holding.
 *
 * A row written before the health brain existed has no `product` at all; `answerAny` reads
 * that as the life plan, which is the only thing it can have been.
 */
export type AnySlots = Routed | HealthSlots | Undecided;
```

- [ ] **Step 4: Write the door**

Create `src/lib/assistant/dispatch.ts`:

```ts
import type { ChatMessage } from "@/lib/ai/types";
import { askWhich, productByTopic, productNamedIn, type Product } from "./choose";
import { peopleIn, type Reply } from "./common";
import { answerHealth } from "./ihealthy/answer";
import type { HealthSlots } from "./ihealthy/route";
import { answerQuestion } from "./lifeprotect/answer";
import type { Routed } from "./lifeprotect/route";
import type { AnySlots, Undecided } from "./slots";

/** One answer, and everything the bot should remember about this customer next turn. */
export type AnyAnswer = Reply & { slots: AnySlots };

/**
 * Which plan a stored session was about.
 *
 * A row with no `product` was written before there was more than one plan to be about, so it
 * can only have been the life one. Guessing anything else would take a customer mid-quotation
 * and start them over.
 */
function settled(slots: AnySlots | null): Product | "undecided" | undefined {
  if (!slots) return undefined;
  if ("product" in slots && slots.product) return slots.product;
  return "lifeprotect";
}

/**
 * The one door the webhook knocks on.
 *
 * Which plan the message is about is decided before any model is paid, and the decision is
 * made from the strongest evidence available: a plan named outright can turn a conversation
 * around; a subject can only settle one that has not begun; and where neither says anything,
 * the customer is asked with two buttons rather than guessed at.
 */
export async function answerAny(history: ChatMessage[], stored: AnySlots | null): Promise<AnyAnswer> {
  const asked = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
  const now = settled(stored);
  const named = productNamedIn(asked);

  // a conversation under way, and the customer has named the other plan
  if ((now === "lifeprotect" || now === "ihealthy") && named && named !== now) {
    // only the person travels: the sum, the plan, the territory and any offer on the table all
    // belong to the contract being left behind
    const person = { age: (stored as Routed | HealthSlots).age, sex: (stored as Routed | HealthSlots).sex };
    return run(named, history, person);
  }
  if (now === "lifeprotect" || now === "ihealthy") return run(now, history, stored);

  // nothing settled yet: the name first, then the subject
  const product = named ?? productByTopic(asked);
  if (product) {
    const carried = now === "undecided" ? (stored as Undecided) : undefined;
    return run(product, history, { age: carried?.age, sex: carried?.sex });
  }

  // the customer has not said, so the customer is asked — and what they did say is kept
  const person = peopleIn(asked)[0];
  const undecided: Undecided = {
    product: "undecided",
    ...(person ? { age: person.age, sex: person.sex } : {}),
    ...(now === "undecided" && !person
      ? { age: (stored as Undecided).age, sex: (stored as Undecided).sex }
      : {}),
  };
  return { ...askWhich(), slots: undecided };
}

/** Hand the turn to one brain, with whatever of the person is worth carrying into it. */
async function run(
  product: Product,
  history: ChatMessage[],
  carried: { age?: number; sex?: "M" | "F" } | AnySlots | null,
): Promise<AnyAnswer> {
  if (product === "ihealthy") {
    const previous = carried && "product" in carried && carried.product === "ihealthy"
      ? (carried as HealthSlots)
      : startHealth(carried);
    const answer = await answerHealth(history, previous);
    return { ...answer, slots: answer.slots };
  }
  const previous = carried && (!("product" in carried) || carried.product === "lifeprotect")
    ? (carried as Routed)
    : startLife(carried);
  const answer = await answerQuestion(history, previous);
  return { ...answer, slots: { ...answer.slots, product: "lifeprotect" } };
}

/** A health conversation begun from whatever the last one knew about the person. */
function startHealth(carried: { age?: number; sex?: "M" | "F" } | AnySlots | null): HealthSlots | null {
  const age = carried && "age" in carried ? carried.age : undefined;
  const sex = carried && "sex" in carried ? carried.sex : undefined;
  if (age === undefined && sex === undefined) return null;
  return { product: "ihealthy", intent: "quote", ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}

/** The same, the other way round. */
function startLife(carried: { age?: number; sex?: "M" | "F" } | AnySlots | null): Routed | null {
  const age = carried && "age" in carried ? carried.age : undefined;
  const sex = carried && "sex" in carried ? carried.sex : undefined;
  if (age === undefined && sex === undefined) return null;
  return { intent: "quote", product: "lifeprotect", ...(age !== undefined ? { age } : {}), ...(sex ? { sex } : {}) };
}
```

`Routed` needs the optional marker so a stored life session can be told from a health one — add
to `src/lib/assistant/lifeprotect/route.ts`, inside `interface Routed`:

```ts
  /**
   * Which brain these slots belong to. Optional because rows written before the health brain
   * existed have none, and those can only have been this plan's.
   */
  product?: "lifeprotect";
```

- [ ] **Step 5: Wire it to the inbox**

In `src/lib/chat/session.ts`, replace the `Routed` import and the two places it is named:

```ts
import type { AnySlots } from "@/lib/assistant/slots";
```
```ts
  slots: AnySlots | null;
```
```ts
  const slots = fresh && data.slots && Object.keys(data.slots).length ? (data.slots as AnySlots) : null;
```

and in `saveSession`, `slots: AnySlots | null`.

In `src/lib/facebook/conversation.ts`, change the import and the two calls:

```ts
import { answerAny } from "@/lib/assistant/dispatch";
```
```ts
async function answered(history: ChatMessage[], slots: Parameters<typeof answerAny>[1]) {
  try {
    return await answerAny(history, slots);
  } catch (e) {
    if (e instanceof BudgetExceeded) throw e;
    console.error("answer failed, trying once more:", e);
    return await answerAny(history, slots);
  }
}
```

In `tests/calc/messenger-webhook.test.ts`, change the mock target:

```ts
vi.mock("@/lib/assistant/dispatch", () => ({ answerAny: answer }));
```

In `tests/calc/chat-harness.test.ts`, import `answerAny` instead of `answerQuestion` and call it
the same way, so one rehearsal command drives either brain.

- [ ] **Step 6: Run everything**

Run: `npx vitest run`
Expected: PASS, every file — including the five Life Protect ones, unchanged in substance.

- [ ] **Step 7: Commit**

```bash
npm run verify && git add src/lib/assistant/slots.ts src/lib/assistant/dispatch.ts src/lib/assistant/lifeprotect/route.ts src/lib/chat/session.ts src/lib/facebook/conversation.ts tests/calc/assistant-dispatch.test.ts tests/calc/messenger-webhook.test.ts tests/calc/chat-harness.test.ts && git commit -m "$(cat <<'MSG'
feat(assistant): one inbox, two brains, and a question when it cannot tell

The webhook now knocks on one door. Which plan a message is about is decided
before a model is paid: a named plan can turn a conversation around, a subject
can only settle one that has not begun, and where neither says anything the
customer is asked with two buttons. A session written before today has no
product and can only have been Life Protect, so it stays there mid-quotation.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>
MSG
)"
```

---

## Task 15: Rehearse it, then watch it answer a stranger

Nothing here changes code. It is the gate between a green suite and a bot the advertising
budget is pointed at.

- [ ] **Step 1: Rehearse the health conversation against the real model**

```bash
CHAT_RESET=1 CHAT_MSG="สนใจค่ะ" npx vitest run tests/calc/chat-harness.test.ts
```

Then, one at a time, without `CHAT_RESET`: `"🏥 ประกันสุขภาพ"`, `"หญิง 35"`, `"โกลด์"`,
`"OPD ได้ไหม"`, `"ทำฟันได้ไหม"`, `"แพงไป"`, `"เอเชียล่ะ"`, `"แล้ว Life Protect ล่ะ"`.

Read every reply. Three things fail the rehearsal: a figure that is not the engine's, a
sentence that promises a person will be accepted, and a request for anything the privacy page
says is never asked for.

- [ ] **Step 2: Rehearse that the advert's own path is untouched**

```bash
CHAT_RESET=1 CHAT_MSG="สนใจประกันมรดก ทุน 1,000,000" npx vitest run tests/calc/chat-harness.test.ts
CHAT_MSG="ชาย 35" npx vitest run tests/calc/chat-harness.test.ts
```

Expected: the Life Protect quotation, with no button asking which plan, exactly as today.

- [ ] **Step 3: Look at both pictures**

Open them in a browser at the deployed origin, or `npm run dev` and locally:

```
/api/ihealthy-card/table?age=35&sex=F&base=WLF99H&sa=150000&plan=GOLD&area=&cover=&mode=annual&fit=phone
/api/ihealthy-card?age=35&sex=F&base=WLF99H&sa=150000&plan=GOLD&area=&cover=&mode=annual&fit=phone
```

Check: three plan columns, no text wrapped or clipped inside a row, and the premium rows agree
with what the rehearsal printed.

- [ ] **Step 4: Confirm the one fact this code cannot check**

The tax answer in `ihealthy/faq.ts` says 25,000 baht of relief for the health rider, within a
100,000 combined ceiling. Ask the owner to confirm that is how the agency answers it today. It
is a claim about a customer's tax return, made in writing on the page's own letterhead — if it
is wrong, correct the string before the bot is pointed at an advert.

- [ ] **Step 5: Ship**

```bash
npm run verify && git -C "/Users/pheerapatpisit/Documents/APP/Ai Assis" merge --ff-only claude/ai-chat-health-insurance-c61385 && git -C "/Users/pheerapatpisit/Documents/APP/Ai Assis" push origin main
```

Check the main worktree is clean before merging, and re-run `npm run verify` inside it
afterwards — that is the tree `main` is actually checked out in.

- [ ] **Step 6: Message the page from a Facebook account with no role in the app**

The whole point, and the only test that covers Meta:

1. "สนใจค่ะ" → two buttons
2. tap 🏥 ประกันสุขภาพ → asked for an age and a sex
3. "หญิง 35" → the comparison picture, readable on the phone without pinching, three buttons
4. tap โกลด์ → the quotation and the card, and the figures match the sales page at
   `/ihealthy-ultra?age=35&sex=F&plan=GOLD`
5. "OPD ได้ไหม" → an answer out of the benefit sheet
6. "แล้ว Life Protect ล่ะ" → the life brain, still knowing she is 35 and female
7. reply from the Page's own inbox by hand → the bot goes quiet; write again as the customer →
   it answers again

---

## Self-review

**Spec coverage** — every section of the design has a task: the `product` slot and the keyword
layers (7, 14), the two buttons (7, 14), old sessions reading as Life Protect (14), the health
slots (9), the page's defaults (10), menu plans versus quotable plans (10, 11), each row of the
"เหตุการณ์" table (10, 11, 13), the context given to the model (12), the health FAQ (8), the
shared answers (6), both pictures (3, 4, 5), the file list (all), cost and privacy (12, 13 —
nothing new is stored and no model is asked for a premium), the testing section (every task's
tests plus 15).

**Not in the plan, because the spec puts them out of scope** — deductible and co-payment
pricing, changing the base contract or its sum, other riders, two people in one health message,
the Health Ultra Package, `referral`, more than one Page, comments, LINE, and the six-column
card on the web page.

**One thing the spec did not foresee** — `shownAt` lives in a `"use client"` module, so Task 2
moves it. Without that the health quote could not be built on the server at all.
