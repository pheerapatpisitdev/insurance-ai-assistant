# มุม "ตัวเลขชัดๆ" — phase 1 (Life Protect x 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A new content angle "ตัวเลขชัดๆ" that writes short Facebook posts whose every figure comes from the rate engine, starting with Life Protect x 2.

**Architecture:** A pure module `src/lib/content/numbers.ts` turns a plan's preset cases into priced "sheets" and lays each sheet out as body text, poster and a yardstick for the number check. Plan adapters live in `src/lib/content/numbers-plans.ts` (Life Protect only in this phase). `generateContent` gets a branch for the angle: sheets → one cheap model call for digit-free headlines (fallback lines if not) → saved pieces with the usual checks.

**Tech Stack:** Next.js 15 server actions, TypeScript, vitest, the existing `chat()` client and Life Protect engine (`lifeprotect-table.ts`, `lifeprotect-quote.ts`, `legacy-cta.ts`).

Spec: `docs/superpowers/specs/2026-09-24-numbers-angle-design.md`.

---

## File map

| File | Responsibility |
|---|---|
| `src/lib/content/prompt.ts` (modify) | the angle entry, `NUMBERS_HREFS`, `anglesFor(format, href)` — client-safe |
| `src/lib/content/numbers.ts` (create) | types, sheet → body / poster / yardstick, headline prompt + parse + digit guard |
| `src/lib/content/numbers-plans.ts` (create) | per-plan cases, claim lines, pricing adapter; `numberSheets(href, count, today)` |
| `src/lib/content/write.ts` (modify) | `headlines()` — the one small-model call |
| `src/app/content/actions.ts` (modify) | the `angle === "numbers"` branch in `generateContent` |
| `src/app/content/ContentStudio.tsx` (modify) | the dropdown lists the angle only for a post on a supported plan |
| `tests/content/numbers.test.ts` (create) | all unit tests for the above |

---

### Task 1: The angle, and where it is offered

**Files:** Modify `src/lib/content/prompt.ts`; Test `tests/content/numbers.test.ts`

- [ ] **Step 1: failing test**

```ts
import { describe, expect, it } from "vitest";
import { anglesFor, NUMBERS_HREFS } from "@/lib/content/prompt";

describe("anglesFor", () => {
  it("offers ตัวเลขชัดๆ only for a post on a plan that has number cases", () => {
    expect(anglesFor("post", "/lifeprotect").some((a) => a.id === "numbers")).toBe(true);
    expect(anglesFor("ad", "/lifeprotect").some((a) => a.id === "numbers")).toBe(false);
    expect(anglesFor("script", "/lifeprotect").some((a) => a.id === "numbers")).toBe(false);
    expect(anglesFor("post", "/plb").some((a) => a.id === "numbers")).toBe(false);
  });
  it("keeps every other angle everywhere", () => {
    expect(anglesFor("ad", "/plb").map((a) => a.id)).toContain("family");
  });
  it("names Life Protect in phase 1", () => {
    expect(NUMBERS_HREFS).toEqual(["/lifeprotect"]);
  });
});
```

- [ ] **Step 2:** `npx vitest run tests/content/numbers.test.ts` → FAIL (`anglesFor` not exported).

- [ ] **Step 3: implement** — in `prompt.ts`, append to `ANGLES` (before `] as const`):

```ts
  {
    id: "numbers", label: "ตัวเลขชัดๆ (เบี้ยต่อเดือน/ต่อวัน)",
    say: "ตัวเลขชัดๆ — ระบบวางตัวเลขจากตารางเบี้ยให้เอง",
  },
```

and below `angleText`:

```ts
/**
 * The plans the ตัวเลขชัดๆ angle can price, kept here rather than read off numbers-plans.ts
 * because this file reaches the browser and the rate tables must not. A test holds the two
 * lists together.
 */
export const NUMBERS_HREFS = ["/lifeprotect"] as const;

/** The angles the form may offer: ตัวเลขชัดๆ is a post's, and only for a plan it can price. */
export function anglesFor(format: Format, href: string): (typeof ANGLES)[number][] {
  return ANGLES.filter((a) => a.id !== "numbers" || (format === "post" && (NUMBERS_HREFS as readonly string[]).includes(href)));
}
```

- [ ] **Step 4:** re-run → PASS.
- [ ] **Step 5:** commit `feat(content): the ตัวเลขชัดๆ angle, offered for a Life Protect post`.

---

### Task 2: A sheet laid out — body, yardstick, poster, headline guard

**Files:** Create `src/lib/content/numbers.ts`; Test `tests/content/numbers.test.ts`

- [ ] **Step 1: failing tests** (append)

```ts
import { numbersBody, numbersPoster, numbersYardstick, safeHeadline, type NumberSheet } from "@/lib/content/numbers";
import { strayNumbers } from "@/lib/content/check";
import { MAX_CHARS } from "@/lib/content/poster";

const sheet: NumberSheet = {
  product: "Life Protect x 2",
  sumLine: "ประกันชีวิตทุน 1,000,000 บาท",
  premiumLine: "เบี้ย 1,548 บาท ต่อเดือน",
  perDayLine: "ตกวันละ 48 บาท",
  claims: ["เบี้ยไม่เพิ่ม", "เสียชีวิตก่อน 60 รับ 2,000,000 บาท"],
  who: "ชาย 35 ปี จ่ายถึงอายุ 99",
  poster: { big: "เบี้ย 1,548 บาท/เดือน", small: "ทุน 1,000,000 บาท · ตกวันละ 48 บาท" },
};

describe("a number sheet", () => {
  it("reads as the owner's example", () => {
    expect(numbersBody(sheet)).toBe(
      "ประกันชีวิตทุน 1,000,000 บาท\nเบี้ย 1,548 บาท ต่อเดือน\nตกวันละ 48 บาท\nเบี้ยไม่เพิ่ม\nเสียชีวิตก่อน 60 รับ 2,000,000 บาท\n(ชาย 35 ปี จ่ายถึงอายุ 99)",
    );
  });
  it("hands the number check every figure it wrote", () => {
    expect(strayNumbers(numbersBody(sheet) + "\n" + sheet.poster.big + "\n" + sheet.poster.small, numbersYardstick([sheet]))).toEqual([]);
  });
  it("fits the poster's line limits", () => {
    const p = numbersPoster(sheet);
    for (const b of p.blocks) expect(b.text.length).toBeLessThanOrEqual(MAX_CHARS[b.kind]);
    expect(p.blocks.find((b) => b.kind === "headline")?.text).toBe("เบี้ย 1,548 บาท/เดือน");
  });
});

describe("safeHeadline", () => {
  it("keeps a headline without digits", () => {
    expect(safeHeadline("ความคุ้มครองก้อนใหญ่ ในเบี้ยที่จ่ายไหว", "สำรอง")).toBe("ความคุ้มครองก้อนใหญ่ ในเบี้ยที่จ่ายไหว");
  });
  it("falls back on any digit, Thai digits too, or on nothing", () => {
    expect(safeHeadline("วันละ 48 บาทเอง", "สำรอง")).toBe("สำรอง");
    expect(safeHeadline("วันละ ๔๘ บาท", "สำรอง")).toBe("สำรอง");
    expect(safeHeadline("  ", "สำรอง")).toBe("สำรอง");
  });
});
```

- [ ] **Step 2:** run → FAIL (module missing).

- [ ] **Step 3: implement** `src/lib/content/numbers.ts`:

```ts
import type { PosterSpec } from "./poster";

/**
 * The ตัวเลขชัดๆ angle (owner, 2026-09-24): a post that sells on figures alone.
 *
 * Every figure on it is written here from an engine's answer, never by a model — a model
 * writes only the headline above them, and a headline with a digit in it is thrown away for a
 * fixed one. The claim lines come from a list per plan the owner approved, so a "เบี้ยไม่เพิ่ม"
 * never reaches a plan whose premium rises.
 */

export interface NumberSheet {
  product: string;
  /** "ประกันชีวิตทุน 1,000,000 บาท" */
  sumLine: string;
  /** "เบี้ย 1,548 บาท ต่อเดือน", or ต่อปี under the monthly floor, or เบี้ยปีแรก … for a rising premium */
  premiumLine: string;
  /** "ตกวันละ 48 บาท": the yearly premium ÷ 365, rounded up, as the sales pages say it */
  perDayLine: string;
  claims: string[];
  /** "ชาย 35 ปี จ่ายถึงอายุ 99", shown in brackets: the premium is this person's */
  who: string;
  poster: { big: string; small: string };
}

export const NUMBERS_CLOSING = "ทักแชทเช็กเบี้ยตามอายุคุณ";

export function numbersBody(s: NumberSheet): string {
  return [s.sumLine, s.premiumLine, s.perDayLine, ...s.claims, `(${s.who})`].join("\n");
}

/** Everything the code wrote, as the number check's yardstick: it wrote them, so they are allowed. */
export function numbersYardstick(sheets: NumberSheet[]): string {
  return sheets.flatMap((s) => [numbersBody(s), s.poster.big, s.poster.small]).join("\n");
}

export function numbersPoster(s: NumberSheet): PosterSpec {
  return {
    layout: "bottom",
    theme: "navy",
    blocks: [
      { kind: "badge", text: s.product },
      { kind: "headline", text: s.poster.big },
      { kind: "sub", text: s.poster.small },
      { kind: "footer", text: s.who },
    ],
  };
}

/** Arabic or Thai digits: a headline carrying any is not the model's to write. */
const DIGIT = /[0-9๐-๙]/;

export function safeHeadline(text: string, fallback: string): string {
  const t = text.trim();
  return t && !DIGIT.test(t) ? t : fallback;
}
```

- [ ] **Step 4:** run → PASS. (If the footer `who` could exceed 50 chars for a later plan, the plan adapter must keep it short; Life Protect's longest is "หญิง 30 ปี จ่าย 19 ปี".)
- [ ] **Step 5:** commit `feat(content): a number sheet laid out as a post and a poster`.

---

### Task 3: Life Protect's cases, claims and prices

**Files:** Create `src/lib/content/numbers-plans.ts`; Test `tests/content/numbers.test.ts`

- [ ] **Step 1: failing tests** (append)

```ts
import { NUMBERS_PLANS, numberSheets } from "@/lib/content/numbers-plans";

describe("Life Protect's number sheets", () => {
  const today = new Date("2026-09-24T12:00:00+07:00");
  it("prices the owner's example exactly", () => {
    const [first] = numberSheets("/lifeprotect", 1, today);
    expect(first.sumLine).toBe("ประกันชีวิตทุน 1,000,000 บาท");
    expect(first.premiumLine).toBe("เบี้ย 1,548 บาท ต่อเดือน");
    expect(first.perDayLine).toBe("ตกวันละ 48 บาท");
    expect(first.who).toBe("ชาย 35 ปี จ่ายถึงอายุ 99");
  });
  it("gives each piece of a round a different person, wrapping past three", () => {
    const sheets = numberSheets("/lifeprotect", 4, today);
    expect(sheets.map((s) => s.who)).toEqual([
      "ชาย 35 ปี จ่ายถึงอายุ 99", "หญิง 30 ปี จ่าย 19 ปี", "ชาย 45 ปี จ่าย 19 ปี", "ชาย 35 ปี จ่ายถึงอายุ 99",
    ]);
  });
  it("takes two claim lines a piece, only from the approved list", () => {
    const approved = NUMBERS_PLANS["/lifeprotect"].claims;
    for (const s of numberSheets("/lifeprotect", 3, today)) {
      expect(s.claims).toHaveLength(2);
      for (const c of s.claims) expect(approved.some((a) => a.startsWith(c.slice(0, 8)))).toBe(true);
    }
  });
  it("says the doubled sum from the engine", () => {
    const all = numberSheets("/lifeprotect", 3, today).flatMap((s) => s.claims).join("\n");
    expect(all).toMatch(/เสียชีวิตก่อน 60 รับ \d{1,3}(,\d{3})+ บาท/);
  });
  it("writes nothing once the rate table has lapsed", () => {
    expect(numberSheets("/lifeprotect", 3, new Date("2100-01-01"))).toEqual([]);
  });
  it("has a registry the form's list agrees with", async () => {
    const { NUMBERS_HREFS } = await import("@/lib/content/prompt");
    expect(Object.keys(NUMBERS_PLANS).sort()).toEqual([...NUMBERS_HREFS].sort());
  });
});
```

- [ ] **Step 2:** run → FAIL (module missing).

- [ ] **Step 3: implement** `src/lib/content/numbers-plans.ts`:

```ts
import { formatBaht } from "@/calc/money";
import type { Sex } from "@/calc/types";
import { displayPremium, perDay } from "@/lib/legacy-cta";
import { deathBenefitOf, lifeProtectModes } from "@/lib/lifeprotect-quote";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import type { NumberSheet } from "./numbers";

/**
 * Each plan the ตัวเลขชัดๆ angle can price: three people, the claim lines the owner approved
 * (spec 2026-09-24), and how to price one person. A person the engine cannot price today —
 * an age off the table, a lapsed rate table — is skipped, and a plan with nobody left gives
 * no sheets, so the angle says so instead of writing a post without figures.
 */

interface Person { sex: Sex; age: number; sum: number; term: string }

interface NumbersPlan {
  product: string;
  cases: Person[];
  /** fixed wording; a {double} is filled from the engine */
  claims: string[];
  price: (p: Person, claims: string[], today: Date) => NumberSheet | null;
}

const sexWord = (s: Sex) => (s === "F" ? "หญิง" : "ชาย");
const money = (baht: number) => baht.toLocaleString("en-US");

/** piece i's two claims: consecutive pairs round the list, so a round of three differs */
export function claimsFor(list: string[], i: number): string[] {
  return [list[(i * 2) % list.length], list[(i * 2 + 1) % list.length]];
}

export const NUMBERS_PLANS: Record<string, NumbersPlan> = {
  "/lifeprotect": {
    product: "Life Protect x 2",
    cases: [
      { sex: "M", age: 35, sum: 1_000_000, term: "WLF99H" },
      { sex: "F", age: 30, sum: 500_000, term: "WLF19H" },
      { sex: "M", age: 45, sum: 1_000_000, term: "WLF19H" },
    ],
    claims: [
      "เบี้ยไม่เพิ่ม",
      "เบี้ยไม่ทิ้ง คุ้มครองถึงอายุ 99",
      "เสียชีวิตก่อน 60 รับ {double} บาท",
      "จ่ายจบได้ใน 9 หรือ 19 ปี",
    ],
    price: (p, claims, today) => {
      const table = lifeProtectTable(today);
      const term = table.terms.find((t) => t.variant === p.term);
      if (!term || table.expired) return null;
      const modes = lifeProtectModes(table, term, { sex: p.sex, age: p.age, sumAssured: p.sum });
      const shown = displayPremium(modes, table.expired);
      const annual = modes?.find((m) => m.mode === "annual");
      if (!shown || !annual) return null;
      const per = shown.mode === "monthly" ? "ต่อเดือน" : "ต่อปี";
      const perShort = shown.mode === "monthly" ? "/เดือน" : "/ปี";
      const double = money(deathBenefitOf(table, p.age, p.sum).sumBefore);
      // the doubled sum is only true while the insured is under the booster age
      const usable = claims.filter((c) => !c.includes("{double}") || p.age < table.boosterBeforeAge);
      return {
        product: "Life Protect x 2",
        sumLine: `ประกันชีวิตทุน ${money(p.sum)} บาท`,
        premiumLine: `เบี้ย ${formatBaht(shown.total)} บาท ${per}`,
        perDayLine: `ตกวันละ ${money(perDay(annual.total))} บาท`,
        claims: usable.map((c) => c.replace("{double}", double)),
        who: `${sexWord(p.sex)} ${p.age} ปี ${term.label}`,
        poster: {
          big: `เบี้ย ${formatBaht(shown.total)} บาท${perShort}`,
          small: `ทุน ${money(p.sum)} บาท · ตกวันละ ${money(perDay(annual.total))} บาท`,
        },
      };
    },
  },
};

/** `count` sheets for a round, one person each in turn; empty when nobody can be priced. */
export function numberSheets(href: string, count: number, today: Date = new Date()): NumberSheet[] {
  const plan = NUMBERS_PLANS[href];
  if (!plan) return [];
  const priced = plan.cases
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => plan.price(c, plan.claims, today) !== null);
  if (priced.length === 0) return [];
  return Array.from({ length: count }, (_, n) => {
    const { c } = priced[n % priced.length];
    return plan.price(c, claimsFor(plan.claims, n), today)!;
  });
}
```

Note the claims test checks a claim is from the list by its opening 8 characters, because `{double}` is filled in.

- [ ] **Step 4:** run → PASS. If "1,548" is not what the engine gives on the test date, stop and check the rate table's expiry before touching any number — the owner's example is the spec.
- [ ] **Step 5:** commit `feat(content): Life Protect's number sheets, priced by its engine`.

---

### Task 4: The headlines — one small call, digit-free or replaced

**Files:** Modify `src/lib/content/numbers.ts`, `src/lib/content/write.ts`; Test `tests/content/numbers.test.ts`

- [ ] **Step 1: failing tests** (append)

```ts
import { headlineMessages, parseHeadlines, FALLBACK_HEADLINES } from "@/lib/content/numbers";

describe("headlines", () => {
  it("asks for one digit-free headline per sheet", () => {
    const msgs = headlineMessages([sheet, sheet]);
    const all = msgs.map((m) => m.content).join("\n");
    expect(all).toContain("ห้ามมีตัวเลข");
    expect(all).toContain("2 ชิ้น");
  });
  it("reads the reply, replacing a headline with digits and filling a missing one", () => {
    const reply = JSON.stringify({ pieces: [
      { headline: "ตัวเลขจริง ไม่ต้องเดา", imagePrompt: "a Thai man at a desk" },
      { headline: "วันละ 48 บาท", imagePrompt: "" },
    ] });
    const out = parseHeadlines(reply, 3);
    expect(out[0]).toEqual({ headline: "ตัวเลขจริง ไม่ต้องเดา", imagePrompt: "a Thai man at a desk" });
    expect(FALLBACK_HEADLINES).toContain(out[1].headline);
    expect(FALLBACK_HEADLINES).toContain(out[2].headline);
    expect(out[2].imagePrompt.length).toBeGreaterThan(0);
  });
  it("survives an unreadable reply", () => {
    expect(parseHeadlines("not json", 2)).toHaveLength(2);
  });
});
```

- [ ] **Step 2:** run → FAIL.

- [ ] **Step 3: implement** — append to `numbers.ts`:

```ts
import { parseJsonReply, type ChatMessage } from "@/lib/ai/client";

/** used in turn when the model's headline has a digit or is missing */
export const FALLBACK_HEADLINES = [
  "ตัวเลขจริง ไม่ต้องเดา",
  "ความคุ้มครองก้อนใหญ่ ในเบี้ยที่จ่ายไหว",
  "เช็กให้ชัด ก่อนตัดสินใจ",
];
const FALLBACK_PICTURE = "A Thai adult at home reviewing household paperwork at a wooden table, natural window light, calm and hopeful mood, no text";

export function headlineMessages(sheets: NumberSheet[]): ChatMessage[] {
  const list = sheets.map((s, i) => `ชิ้นที่ ${i + 1}: ${s.product} · ${s.who} · ${s.claims.join(" · ")}`).join("\n");
  return [
    {
      role: "system",
      content: [
        "คุณเขียนพาดหัวโพสต์เฟซบุ๊กภาษาไทยให้ตัวแทนประกันชีวิต",
        "ใต้พาดหัว ระบบจะวางตัวเลขเบี้ยและทุนให้เอง พาดหัวมีหน้าที่ทำให้คนหยุดอ่านตัวเลข",
        "กติกา: ห้ามมีตัวเลขใดๆ ทั้งเลขอารบิกและเลขไทย · ยาวไม่เกิน 60 ตัวอักษร · ห้ามสัญญาเกินข้อมูลที่ให้ · ห้ามใช้คำว่าถูกที่สุด ดีที่สุด การันตี",
        "imagePrompt: คำบรรยายภาพประกอบเป็นภาษาอังกฤษ 1–2 ประโยค คนไทย แสงธรรมชาติ ห้ามมีตัวหนังสือในภาพ",
        'ตอบเป็น JSON เท่านั้น: {"pieces":[{"headline":"…","imagePrompt":"…"}]}',
      ].join("\n"),
    },
    { role: "user", content: `เขียน ${sheets.length} ชิ้น ชิ้นละหนึ่งพาดหัว ไม่ซ้ำกัน\n${list}` },
  ];
}

export function parseHeadlines(reply: string, count: number): { headline: string; imagePrompt: string }[] {
  const raw = parseJsonReply<{ pieces?: unknown }>(reply);
  const list = Array.isArray(raw?.pieces) ? (raw!.pieces as { headline?: unknown; imagePrompt?: unknown }[]) : [];
  return Array.from({ length: count }, (_, i) => {
    const p = list[i] ?? {};
    const fallback = FALLBACK_HEADLINES[i % FALLBACK_HEADLINES.length];
    const picture = typeof p.imagePrompt === "string" && p.imagePrompt.trim() ? p.imagePrompt.trim() : FALLBACK_PICTURE;
    return { headline: safeHeadline(typeof p.headline === "string" ? p.headline : "", fallback), imagePrompt: picture };
  });
}
```

(Check `ChatMessage` is exported from `@/lib/ai/client`; if it is exported from another module, import it from there — `grep -n "export.*ChatMessage" src/lib/ai/*.ts`.)

Append to `write.ts`:

```ts
/**
 * The ตัวเลขชัดๆ angle's one call: a headline and a picture line per sheet, from the cheap
 * model. Any failure gives the fallback headlines — the figures under them are the post.
 */
export async function headlines(sheets: NumberSheet[]): Promise<{ lines: { headline: string; imagePrompt: string }[]; model: string; costThb: number }> {
  const r = await chat({ tier: "small", task: "content-headline", messages: headlineMessages(sheets), maxTokens: 800, json: true })
    .catch((e) => { console.error("content headlines failed:", e); return null; });
  return { lines: parseHeadlines(r?.text ?? "", sheets.length), model: r?.model ?? "fallback", costThb: r?.costThb ?? 0 };
}
```

with imports `import { headlineMessages, parseHeadlines, type NumberSheet } from "./numbers";`.

- [ ] **Step 4:** run → PASS; `npx tsc --noEmit` clean.
- [ ] **Step 5:** commit `feat(content): digit-free headlines for the ตัวเลขชัดๆ angle`.

---

### Task 5: `generateContent` writes the angle

**Files:** Modify `src/app/content/actions.ts`

- [ ] **Step 1: implement** — after `const told = angleText(angle, custom);` and before the `if (input.format === "ad")` branch:

```ts
    if (angle === "numbers") {
      if (input.format !== "post") return { ok: false, error: "มุมตัวเลขชัดๆ ใช้ได้กับโพสต์เฟซบุ๊กเท่านั้น" };
      const sheets = numberSheets(brief.product.href, count);
      if (sheets.length === 0) return { ok: false, error: "แบบนี้ยังคำนวณตัวเลขไม่ได้ในตอนนี้ (ตารางเบี้ยอาจหมดอายุ) ลองมุมอื่นก่อนนะครับ" };
      const heads = await headlines(sheets);
      const yard = `${brief.text}\n${numbersYardstick(sheets)}`;
      const items: ContentItem[] = [];
      for (const [i, s] of sheets.entries()) {
        const output: ContentOutput = {
          hooks: [heads.lines[i].headline],
          angle: `ตัวเลขชัดๆ · ${s.who}`,
          body: numbersBody(s),
          closing: NUMBERS_CLOSING,
          hashtags: [],
          imagePrompt: heads.lines[i].imagePrompt,
          disclaimer: DISCLAIMER,
          poster: numbersPoster(s),
        };
        items.push(await saveContent({
          planHref: brief.product.href, format: "post", angle, length: null, output,
          flags: flagsFor(output, yard, words, null),
          rateVersion: brief.rateVersion, model: heads.model, costThb: heads.costThb / sheets.length, hookTemplateId: null,
        }));
      }
      return { ok: true, items, costThb: heads.costThb, missing: count - items.length };
    }
```

Imports: `numberSheets` from `@/lib/content/numbers-plans`; `NUMBERS_CLOSING, numbersBody, numbersPoster, numbersYardstick` from `@/lib/content/numbers`; `headlines` added to the existing `@/lib/content/write` import; `DISCLAIMER` and `ContentOutput` from `@/lib/content/write` if not already imported (check the file's import block).

- [ ] **Step 2:** `npx tsc --noEmit` clean; `npx vitest run tests/content` all pass.
- [ ] **Step 3:** commit `feat(content): generateContent writes the ตัวเลขชัดๆ angle from the engine`.

---

### Task 6: The form offers it only where it works

**Files:** Modify `src/app/content/page.tsx`, `src/app/content/ContentStudio.tsx`

- [ ] **Step 1:** in `page.tsx` keep passing `angles` (now including numbers). In `ContentStudio.tsx`, replace the dropdown's `angles.map(...)` with the filtered list and reset a stale pick:

```tsx
import { anglesFor } from "@/lib/content/prompt";
// …inside the component, beside the other derived values:
const offered = anglesFor(format, href);
// a pick the form no longer offers (the plan or the format changed) goes back to ให้ AI เลือก
useEffect(() => {
  if (angle && angle !== "custom" && !offered.some((a) => a.id === angle)) setAngle("");
}, [angle, offered]);
// …in the <select>:
{offered.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
```

If `anglesFor` returns a new array each render, depend on `format` and `href` instead of `offered` in the effect. Check the component's existing `href` state name (`grep -n "const \[href" src/app/content/ContentStudio.tsx`) and the `angles` prop can then be dropped from `page.tsx` and the props interface if nothing else uses it.

- [ ] **Step 2:** `npx tsc --noEmit` clean.
- [ ] **Step 3:** commit `feat(content): the form offers ตัวเลขชัดๆ for a Life Protect post only`.

---

### Task 7: Live check, then ship

- [ ] **Step 1:** `preview_start` dev; open `/content`; pick Life Protect x 2 → โพสต์เฟซบุ๊ก → มุม "ตัวเลขชัดๆ"; จำนวน 3; press สร้าง.
- [ ] **Step 2:** confirm with `read_page`/JS: 3 cards; first body starts `ประกันชีวิตทุน 1,000,000 บาท\nเบี้ย 1,548 บาท ต่อเดือน\nตกวันละ 48 บาท`; no card shows a number warning; headlines have no digits; posters show "เบี้ย … บาท/เดือน". Switch to โฆษณา and to Protection Life: the option disappears.
- [ ] **Step 3:** `npm run verify && git push origin main` (stage by path; commit email pheerapatpisit.dev@gmail.com).
- [ ] **Step 4:** tell the owner, with a screenshot of one card, and ask whether to roll out to the other nine plans (their cases and claims are already approved in the spec).
