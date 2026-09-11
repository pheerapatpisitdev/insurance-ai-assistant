# กราฟและตารางมูลค่ากรมธรรม์ Life Protect+ 100 — แผนลงมือ

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ต่อกราฟเปรียบเทียบเบี้ยสะสมกับมูลค่าเวนคืน และตารางรายปีแบบพับได้ เข้าไปในการ์ดผลลัพธ์ของหน้า `/lifeprotect`

**Architecture:** `lifeprotect-table.ts` เปลี่ยนจากส่งหมุดมูลค่าสี่จุด มาส่งตารางค่าต่อทุนพันทั้งชุด ฟังก์ชันล้วน `cash-projection.ts` แปลงตารางนั้นเป็นแถวรายปีพร้อมจุดเท่าทุน คอมโพเนนต์สองตัววาดกราฟ SVG กับตาราง แล้ว `LifeProtectCalculator` ต่อทั้งสองไว้ใต้สี่บรรทัดเดิมโดยไม่แตะของเดิม

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Tailwind v4, vitest

สเปก: `docs/superpowers/specs/2026-09-12-lifeprotect-cash-value-chart-design.md`

---

## โครงไฟล์

| ไฟล์ | หน้าที่ |
| --- | --- |
| `src/lib/cash-projection.ts` (สร้าง) | ฟังก์ชันล้วน ตารางค่าต่อทุนพัน → แถวรายปี + จุดเท่าทุน + จำนวนปีศูนย์ |
| `src/components/lifeprotect/CashValueChart.tsx` (สร้าง) | SVG สองเส้นกับหมุดจุดเท่าทุน |
| `src/components/lifeprotect/CashValueTable.tsx` (สร้าง) | `<details>` + ตารางหกคอลัมน์ + คำอธิบายใต้ตาราง |
| `src/lib/lifeprotect-table.ts` (แก้) | `cash` → `schedule` ส่งค่าต่อทุนพันทั้งชุด |
| `src/lib/lifeprotect-quote.ts` (แก้) | `cashAt()` อ่านหมุดจาก `schedule` |
| `src/components/LifeProtectCalculator.tsx` (แก้) | ต่อสองคอมโพเนนต์ใหม่ |
| `tests/calc/cash-projection.test.ts` (สร้าง) | ตัวเลขจริงจากตารางบริษัท |
| `tests/calc/lifeprotect-page-data.test.ts` (แก้) | `cash` → `schedule` |

ทุกจำนวนเงินในโค้ดใหม่เป็น **สตางค์** ตามที่ `src/calc/money.ts` ทำทั้งไฟล์
มูลค่าเวนคืนในตารางบริษัทเป็นบาทเต็ม จึงคูณร้อยตอนสร้างแถว

---

### Task 1: `lifeprotect-table.ts` ส่งตารางทั้งชุดแทนหมุดสี่จุด

**Files:**
- Modify: `src/lib/lifeprotect-table.ts`
- Modify: `src/lib/lifeprotect-quote.ts:72-79`
- Modify: `tests/calc/lifeprotect-page-data.test.ts:38-46`

- [ ] **Step 1: แก้เทสต์เดิมให้อ่าน `schedule` และพิสูจน์ว่าหมุดไม่เปลี่ยนค่า**

แทนที่ `it("carries cash-value factors only at the milestones still ahead of the insured", ...)` ทั้งบล็อกด้วย

```ts
  it("carries the whole cash-value schedule, one factor per policy year", () => {
    const t = lifeProtectTable(WHILE_CURRENT);
    const term19 = t.terms[1];
    // ชาย 35 มีอายุ 35 ถึง 98 อยู่ในตาราง คือ 64 ปีกรมธรรม์
    expect(term19.schedule.M[35]).toHaveLength(64);
    // ปีที่ 26 คือปีที่เริ่มตอนอายุ 60 และค่าท้ายสุดคือเงินตอนครบสัญญา
    expect(term19.schedule.M[35]![25]).toBe(504);
    expect(term19.schedule.M[35]![63]).toBe(1000);
    expect(term19.schedule.M[80]).toHaveLength(19);
  });

  it("still reads the same four milestones the card has always shown", () => {
    const t = lifeProtectTable(WHILE_CURRENT);
    expect(cashAt(t.terms[1], "M", 35, 1_000_000, t.ageMin)).toEqual([
      { age: 60, amount: 504_000 }, { age: 70, amount: 633_000 },
      { age: 80, amount: 777_000 }, { age: 99, amount: 1_000_000 },
    ]);
    expect(cashAt(t.terms[1], "M", 70, 1_000_000, t.ageMin).map((r) => r.age)).toEqual([80, 99]);
    expect(cashAt(t.terms[1], "M", 80, 1_000_000, t.ageMin).map((r) => r.age)).toEqual([99]);
  });
```

และเพิ่ม import ที่หัวไฟล์

```ts
import { cashAt } from "@/lib/lifeprotect-quote";
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run tests/calc/lifeprotect-page-data.test.ts`
Expected: FAIL — `term19.schedule` เป็น undefined

- [ ] **Step 3: เปลี่ยนรูปข้อมูลที่ `lifeprotect-table.ts`**

แทนที่ฟิลด์ `cash` ใน `LifeProtectTerm`

```ts
  /**
   * ค่ามูลค่าเวนคืนต่อทุน 1,000 บาท [sex][age - ageMin] → หนึ่งค่าต่อหนึ่งปี
   * กรมธรรม์ ตั้งแต่ปีแรก null เมื่อตารางบริษัทไม่มีตารางของอายุนั้น
   *
   * ส่งทั้งชุดแทนที่จะส่งเฉพาะหมุด เพราะกราฟกับตารางรายปีต้องใช้ทุกปี และ
   * หมุดเป็นส่วนย่อยของมันอยู่แล้ว การส่งทั้งสองอย่างคือข้อมูลชุดเดียว
   * สองทาง ซึ่งเพี้ยนจากกันได้
   */
  schedule: Record<Sex, (number[] | null)[]>;
```

แทนที่ `cashFor` ด้วย

```ts
  const scheduleFor = (variant: string, sex: Sex, age: number): number[] | null => {
    // คิดบนทุน 1,000 บาท จำนวนเงินของแต่ละแถวจึงเท่ากับค่าต่อทุนพันพอดี
    const rows = cashValueSchedule(PLAN_CODE, variant, sex, age, 1000);
    return rows.length ? rows.map((r) => r.amount) : null;
  };
```

และในการสร้าง `terms` เปลี่ยน

```ts
      cash: {
        M: ages.map((age) => cashFor(t.variant, "M", age)),
        F: ages.map((age) => cashFor(t.variant, "F", age)),
      },
```

เป็น

```ts
      schedule: {
        M: ages.map((age) => scheduleFor(t.variant, "M", age)),
        F: ages.map((age) => scheduleFor(t.variant, "F", age)),
      },
```

- [ ] **Step 4: ให้ `cashAt()` อ่านหมุดจากตารางทั้งชุด**

แทนที่ตัวฟังก์ชันที่ `src/lib/lifeprotect-quote.ts`

```ts
/**
 * มูลค่าเวนคืนที่หมุดแต่ละจุดที่ยังอยู่ข้างหน้า และที่ครบสัญญา คิดด้วย
 * ROUND(factor × sum / 1000) เดียวกับ cash-value.ts จำนวนเงินจึงเท่ากับ
 * ตารางบริษัท
 *
 * ค่าตัวสุดท้ายในตารางคือเงินตอนครบสัญญา ซึ่งบริษัทติดป้ายด้วยอายุถัดจาก
 * ปีกรมธรรม์สุดท้าย ไม่ใช่อายุต้นปีอย่างแถวอื่น
 */
export function cashAt(term: LifeProtectTerm, sex: Sex, age: number, sumAssured: number, ageMin: number): CashRow[] {
  const factors = term.schedule[sex][age - ageMin];
  if (!factors) return [];
  const baht = (factor: number) => Math.round((factor * sumAssured) / 1000);
  const rows = CASH_AGES
    .filter((at) => at > age && at - age < factors.length)
    .map((at) => ({ age: at, amount: baht(factors[at - age]) }));
  rows.push({ age: age + factors.length, amount: baht(factors[factors.length - 1]) });
  return rows.filter((r) => r.amount > 0);
}
```

และเปลี่ยน import ที่หัวไฟล์จาก type-only เป็น

```ts
import { CASH_AGES, type LifeProtectTable, type LifeProtectTerm } from "@/lib/lifeprotect-table";
```

- [ ] **Step 5: รันเทสต์ทั้งชุดให้ผ่าน**

Run: `npx vitest run`
Expected: PASS ทั้งหมด รวม `lifeprotect-quote.test.ts`, `lifeprotect-cta.test.ts` และ `quote-card.test.ts``cash-projection.test.ts` ของ Task 1 ที่ยังค้างอยู่

- [ ] **Step 6: commit**

```bash
git add src/lib/lifeprotect-table.ts src/lib/lifeprotect-quote.ts tests/calc/lifeprotect-page-data.test.ts
git commit -m "refactor(lifeprotect): send the whole surrender schedule, and read the milestones off it"
```

---

### Task 2: `cashProjection` ฟังก์ชันล้วน

**Files:**
- Create: `src/lib/cash-projection.ts`
- Test: `tests/calc/cash-projection.test.ts`

- [ ] **Step 1: เขียนเทสต์ที่ยังไม่ผ่าน**

```ts
import { describe, expect, it } from "vitest";
import { cashProjection } from "@/lib/cash-projection";
import { lifeProtectTable } from "@/lib/lifeprotect-table";
import { deathBenefitOf, lifeProtectModes, payYears, termAt } from "@/lib/lifeprotect-quote";

const table = lifeProtectTable(new Date("2026-09-05"));
const SUM = 1_000_000;

/** ชาย 35 ทุน 1 ล้าน ตามแบบชำระที่ขอ */
function project(variant: string, withPrice = true) {
  const term = termAt(table, variant);
  const factors = term.schedule.M[35 - table.ageMin]!;
  const annual = withPrice
    ? lifeProtectModes(table, term, { sex: "M", age: 35, sumAssured: SUM })!
        .find((m) => m.mode === "annual")!.total
    : null;
  return cashProjection({
    factors, age: 35, sumAssured: SUM, annualSatang: annual,
    payYears: payYears(term, 35), death: deathBenefitOf(table, 35, SUM),
  });
}

describe("cashProjection · จ่าย 9 ปี", () => {
  const p = project("WLF09H");

  it("นับปีกรมธรรม์ อายุ และมูลค่าเวนคืนตามตารางบริษัท", () => {
    expect(p.rows).toHaveLength(64);
    expect(p.maturityAge).toBe(99);
    expect(p.rows[0]).toEqual({
      policyYear: 1, age: 35, cover: 200_000_000,
      premiumDue: 5_460_000, premiumPaid: 5_460_000, cashValue: 0,
    });
    expect(p.rows[8]).toEqual({
      policyYear: 9, age: 43, cover: 200_000_000,
      premiumDue: 5_460_000, premiumPaid: 49_140_000, cashValue: 36_500_000,
    });
  });

  it("หยุดเก็บเบี้ยเมื่อพ้นกำหนดชำระ", () => {
    expect(p.rows[9]).toEqual({
      policyYear: 10, age: 44, cover: 200_000_000,
      premiumDue: 0, premiumPaid: 49_140_000, cashValue: 37_300_000,
    });
    expect(p.rows[p.rows.length - 1].premiumPaid).toBe(49_140_000);
  });

  it("ความคุ้มครองลดลงเมื่อถึงอายุ 60", () => {
    expect(p.rows.find((r) => r.age === 59)!.cover).toBe(200_000_000);
    expect(p.rows.find((r) => r.age === 60)!.cover).toBe(100_000_000);
  });

  it("เท่าทุนปีที่ 25 อายุ 59", () => {
    expect(p.breakEven).toMatchObject({ policyYear: 25, age: 59, cashValue: 49_200_000 });
  });

  it("ปีแรกปีเดียวที่ยังไม่มีมูลค่าเวนคืน", () => {
    expect(p.zeroYears).toBe(1);
  });
});

describe("cashProjection · อีกสองแบบชำระ", () => {
  it("จ่าย 19 ปี เท่าทุนปีที่ 30 และเป็นศูนย์สามปีแรก", () => {
    const p = project("WLF19H");
    expect(p.zeroYears).toBe(3);
    expect(p.breakEven).toMatchObject({ policyYear: 30, age: 64 });
    expect(p.rows[p.rows.length - 1].premiumPaid).toBe(54_530_000);
  });

  it("ถึงอายุ 99 เท่าทุนปีสุดท้าย และเป็นศูนย์แปดปีแรก", () => {
    const p = project("WLF99H");
    expect(p.zeroYears).toBe(8);
    expect(p.rows[8].cashValue).toBe(1_100_000);
    expect(p.breakEven).toMatchObject({ policyYear: 64, age: 98, cashValue: 111_200_000 });
    expect(p.rows[p.rows.length - 1].premiumPaid).toBe(110_080_000);
  });
});

describe("cashProjection เมื่อไม่มีราคาให้แสดง", () => {
  const p = project("WLF99H", false);

  it("ไม่มีเบี้ยและไม่มีจุดเท่าทุน แต่มูลค่าเวนคืนยังอยู่", () => {
    expect(p.rows.every((r) => r.premiumDue === null && r.premiumPaid === null)).toBe(true);
    expect(p.breakEven).toBeNull();
    expect(p.zeroYears).toBe(8);
    expect(p.rows[8].cashValue).toBe(1_100_000);
  });
});
```

- [ ] **Step 2: รันให้เห็นว่าไม่ผ่าน**

Run: `npx vitest run tests/calc/cash-projection.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/cash-projection"`

- [ ] **Step 3: เขียนโค้ดให้น้อยที่สุดที่ทำให้ผ่าน**

```ts
import type { DeathBenefit } from "@/calc/types";

/**
 * กรมธรรม์หนึ่งฉบับเดินไปข้างหน้าทีละปี — จ่ายไปเท่าไร ครอบครัวได้เท่าไร
 * เวนคืนได้เท่าไร
 *
 * ทุกจำนวนเงินเป็นสตางค์ ตามที่ calc/money.ts ทำทั้งไฟล์ ตารางบริษัทให้
 * มูลค่าเวนคืนเป็นบาทเต็ม จึงคูณร้อยตอนสร้างแถว เพื่อให้เทียบกับเบี้ยได้ตรง ๆ
 * โดยไม่ต้องปัดเศษฝ่ายใดฝ่ายหนึ่งก่อน
 */
export interface ProjectionRow {
  policyYear: number;
  /** อายุต้นปีกรมธรรม์ ตามที่ตารางบริษัทกำกับ */
  age: number;
  /** ครอบครัวได้รับถ้าเสียชีวิตในปีนั้น */
  cover: number;
  /** เบี้ยที่ถึงกำหนดชำระปีนั้น 0 เมื่อพ้นกำหนดแล้ว null เมื่อไม่มีราคาให้แสดง */
  premiumDue: number | null;
  /** เบี้ยทุกงวดรวมถึงปีนี้ */
  premiumPaid: number | null;
  /** เวนคืนตอนปลายปีนั้นได้เท่าไร */
  cashValue: number;
}

export interface Projection {
  rows: ProjectionRow[];
  /** ปีแรกที่กรมธรรม์มีค่าอย่างน้อยเท่าที่ใส่เงินเข้าไป */
  breakEven: ProjectionRow | null;
  /** กี่ปีแรกที่เวนคืนไม่ได้เลย */
  zeroYears: number;
  /** อายุที่แถวสุดท้ายหมายถึง — ตารางบริษัทติดป้ายแถวนั้นด้วยอายุถัดไป */
  maturityAge: number;
}

export interface ProjectionInput {
  /** ค่าต่อทุน 1,000 บาท หนึ่งค่าต่อหนึ่งปีกรมธรรม์ ตั้งแต่ปีแรก */
  factors: number[];
  /** อายุตอนทำประกัน */
  age: number;
  sumAssured: number;
  /** เบี้ยรายปีเป็นสตางค์ null เมื่อตารางเบี้ยหมดอายุ */
  annualSatang: number | null;
  /** จ่ายเบี้ยกี่ปี */
  payYears: number;
  death: DeathBenefit;
}

export function cashProjection(
  { factors, age, sumAssured, annualSatang, payYears, death }: ProjectionInput,
): Projection {
  let paid = 0;
  const rows: ProjectionRow[] = factors.map((factor, i) => {
    const at = age + i;
    const due = annualSatang === null ? null : i < payYears ? annualSatang : 0;
    if (due !== null) paid += due;
    return {
      policyYear: i + 1,
      age: at,
      cover: (at < death.beforeAge ? death.sumBefore : death.sumFrom) * 100,
      premiumDue: due,
      premiumPaid: annualSatang === null ? null : paid,
      // ROUND(factor × sum / 1000) บาท เท่ากับที่ cash-value.ts ทำ แล้วจึงเป็นสตางค์
      cashValue: Math.round((factor * sumAssured) / 1000) * 100,
    };
  });

  let zeroYears = 0;
  while (zeroYears < rows.length && rows[zeroYears].cashValue === 0) zeroYears += 1;

  const breakEven = rows.find((r) => r.premiumPaid !== null && r.cashValue >= r.premiumPaid) ?? null;
  return { rows, breakEven, zeroYears, maturityAge: age + factors.length };
}
```

- [ ] **Step 4: รันให้ผ่าน**

Run: `npx vitest run tests/calc/cash-projection.test.ts`
Expected: PASS ทั้ง 8 เทสต์

- [ ] **Step 5: commit**

```bash
git add src/lib/cash-projection.ts tests/calc/cash-projection.test.ts
git commit -m "feat(lifeprotect): walk one policy forward a year at a time"
```

---

### Task 3: กราฟ

**Files:**
- Create: `src/components/lifeprotect/CashValueChart.tsx`

- [ ] **Step 1: เขียนคอมโพเนนต์**

```tsx
import type { Projection } from "@/lib/cash-projection";

const W = 340, H = 190, LEFT = 46, RIGHT = 8, TOP = 12, BOTTOM = 24;

/** 1,112,000 → "1.1 ล้าน" — แกนตั้งมีป้ายเดียว จึงต้องสั้นและอ่านออกทันที */
function short(baht: number): string {
  if (baht >= 1_000_000) {
    const m = baht / 1_000_000;
    return `${m % 1 ? m.toFixed(1) : m.toFixed(0)} ล้าน`;
  }
  if (baht >= 100_000) return `${Math.round(baht / 100_000)} แสน`;
  return baht.toLocaleString("en-US");
}

export interface CashValueChartProps {
  projection: Projection;
  /** อายุตอนทำประกัน — จุดเริ่มของแกนนอน */
  age: number;
}

/**
 * เส้นทองคือมูลค่าเวนคืน เส้นเทาคือเบี้ยที่จ่ายไปแล้ว จุดที่เส้นทองแซงคือ
 * คำตอบของคำถามที่ลูกค้าถามจริง
 *
 * ตารางใต้กราฟคือข้อมูลฉบับที่โปรแกรมอ่านหน้าจออ่านได้ กราฟจึงเป็น
 * role="img" ที่มีคำบรรยายประโยคเดียว ไม่ต้องให้ไล่อ่านทีละจุด
 */
export function CashValueChart({ projection, age }: CashValueChartProps) {
  const { rows, breakEven, maturityAge } = projection;
  if (!rows.length) return null;

  const top = Math.max(...rows.map((r) => Math.max(r.cashValue, r.premiumPaid ?? 0))) || 1;
  const x = (at: number) => LEFT + ((at - age) / (maturityAge - age)) * (W - LEFT - RIGHT);
  const y = (satang: number) => H - BOTTOM - (satang / top) * (H - BOTTOM - TOP);
  const path = (pick: (r: typeof rows[number]) => number) =>
    rows.map((r) => `${x(r.age).toFixed(1)},${y(pick(r)).toFixed(1)}`).join(" ");

  const ticks = [...new Set([age, 60, 80, maturityAge])].filter((a) => a >= age && a <= maturityAge);
  // ป้ายจุดเท่าทุนใกล้ขอบขวาต้องพลิกมาทางซ้าย ไม่งั้นตัวอักษรหลุดกรอบ
  const flip = breakEven ? x(breakEven.age) > W * 0.62 : false;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={`กราฟเปรียบเทียบเบี้ยที่จ่ายสะสมกับมูลค่าเวนคืนเงินสด${
        breakEven ? ` มูลค่าเวนคืนเท่ากับเบี้ยที่จ่ายเมื่ออายุ ${breakEven.age} ปี` : ""
      }`}
      className="mt-2.5 block overflow-visible"
    >
      <line x1={LEFT} y1={H - BOTTOM} x2={W - RIGHT} y2={H - BOTTOM} stroke="var(--lg-panel-line)" />
      <line x1={LEFT} y1={TOP} x2={LEFT} y2={H - BOTTOM} stroke="var(--lg-panel-line)" />
      <text x={LEFT - 6} y={y(top) + 4} fill="var(--lg-mute)" fontSize="10" textAnchor="end">
        {short(Math.round(top / 100))}
      </text>
      <text x={LEFT - 6} y={H - BOTTOM + 4} fill="var(--lg-mute)" fontSize="10" textAnchor="end">0</text>
      {ticks.map((at) => (
        <text key={at} x={x(at)} y={H - 8} fill="var(--lg-mute)" fontSize="10" textAnchor="middle">{at}</text>
      ))}
      {rows[0].premiumPaid !== null && (
        <polyline fill="none" stroke="rgba(245,245,245,.5)" strokeWidth="1.5" strokeLinejoin="round"
          points={path((r) => r.premiumPaid!)} />
      )}
      <polyline fill="none" stroke="var(--lg-gold)" strokeWidth="2" strokeLinejoin="round"
        points={path((r) => r.cashValue)} />
      {breakEven && (
        <>
          <circle cx={x(breakEven.age)} cy={y(breakEven.cashValue)} r="4"
            fill="var(--lg-gold-lit)" stroke="var(--lg-ground-deep)" strokeWidth="1.5" />
          <text x={x(breakEven.age) + (flip ? -8 : 8)} y={y(breakEven.cashValue) - 9}
            fill="var(--lg-gold-lit)" fontSize="11" textAnchor={flip ? "end" : "start"}>
            เท่าทุนอายุ {breakEven.age}
          </text>
        </>
      )}
    </svg>
  );
}
```

- [ ] **Step 2: ตรวจว่าคอมไพล์ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add src/components/lifeprotect/CashValueChart.tsx
git commit -m "feat(lifeprotect): draw what the policy is worth against what it cost"
```

---

### Task 4: ตารางรายปี

**Files:**
- Create: `src/components/lifeprotect/CashValueTable.tsx`

- [ ] **Step 1: เขียนคอมโพเนนต์**

```tsx
"use client";
import { useState } from "react";
import { formatBaht } from "@/calc/money";
import type { Projection, ProjectionRow } from "@/lib/cash-projection";

export interface CashValueTableProps {
  projection: Projection;
  /** บรรทัดสรุปเหนือตาราง เช่น "ทุนประกัน 1,000,000 บาท · ชาย 35 ปี · ถึงอายุ 99" */
  caption: string;
}

const HEAD = ["ปีที่", "อายุ", "คุ้มครอง", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้"];

/**
 * ทุกปีของสัญญา พับไว้ตอนเปิดหน้า — หกสิบสี่แถวกางค้างบนจอมือถือจะดันปุ่ม
 * ทักแชทหลุดจอ
 *
 * แถวที่ยังเวนคืนไม่ได้แสดงตามจริง ไม่กรองทิ้ง และมีคำอธิบายใต้ตารางที่นับ
 * จำนวนปีเอง ลูกค้าควรรู้ก่อนเซ็น ไม่ใช่ตอนจะเวนคืน
 */
export function CashValueTable({ projection, caption }: CashValueTableProps) {
  const [open, setOpen] = useState(false);
  const { rows, breakEven, zeroYears, maturityAge } = projection;
  if (!rows.length) return null;

  const cell = (r: ProjectionRow) => (r.cashValue === 0 ? "opacity-55" : "");
  return (
    <details
      open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="mt-3.5 border-t border-[var(--lg-panel-line)] pt-3"
    >
      <summary className="cursor-pointer list-none text-sm text-[var(--lg-gold)] [&::-webkit-details-marker]:hidden">
        {open ? "▾" : "▸"} ดูมูลค่าทุกปี
      </summary>

      <p className="mt-2.5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-gold-glow)] px-3 py-2.5 text-xs leading-[1.75] tabular-nums text-[var(--lg-gold-lit)]">
        {caption}
      </p>

      <div className="-mx-2.5 mt-2.5 max-h-[56vh] w-[calc(100%+1.25rem)] overflow-auto rounded-sm border border-[var(--lg-panel-line)]">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr>
              {HEAD.map((h, i) => (
                <th
                  key={h} scope="col"
                  className={`sticky top-0 z-[2] whitespace-nowrap border-b border-[var(--lg-hair)] bg-[var(--lg-ground-deep)] px-[5px] py-[7px] text-[11px] font-normal text-[var(--lg-mute)] ${
                    i < 2 ? "text-left" : "text-right"
                  } ${i === HEAD.length - 1 ? "pr-3" : ""} ${i > 0 ? "border-l border-l-white/10" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.policyYear} className={breakEven?.policyYear === r.policyYear ? "bg-[var(--lg-gold-glow)] text-[var(--lg-gold-lit)]" : ""}>
                <td className="whitespace-nowrap border-b border-white/5 px-[5px] py-1.5 text-left text-[var(--lg-mute)]">{r.policyYear}</td>
                <td className="whitespace-nowrap border-b border-l border-white/5 border-l-white/10 px-[5px] py-1.5 text-left text-[var(--lg-mute)]">{r.age}</td>
                <td className="whitespace-nowrap border-b border-l border-white/5 border-l-white/10 px-[5px] py-1.5 text-right text-[var(--lg-white)]">{formatBaht(r.cover)}</td>
                <td className={`whitespace-nowrap border-b border-l border-white/5 border-l-white/10 px-[5px] py-1.5 text-right ${cell(r)}`}>
                  {r.premiumDue ? formatBaht(r.premiumDue) : "—"}
                </td>
                <td className={`whitespace-nowrap border-b border-l border-white/5 border-l-white/10 px-[5px] py-1.5 text-right ${cell(r)}`}>
                  {r.premiumPaid === null ? "—" : formatBaht(r.premiumPaid)}
                </td>
                <td className={`whitespace-nowrap border-b border-l border-white/5 border-l-white/10 px-[5px] py-1.5 pr-3 text-right ${cell(r)}`}>
                  {formatBaht(r.cashValue)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {zeroYears > 0 && (
        <p className="mt-2.5 border-l-2 border-[var(--lg-gold-deep)] py-2 pl-3 text-xs leading-[1.8] text-[var(--lg-mute)]">
          <span className="font-medium text-[var(--lg-gold-lit)]">
            {zeroYears === 1 ? "ปีที่ 1" : `ปีที่ 1–${zeroYears}`} ยังไม่มีมูลค่าเวนคืน
          </span>{" "}
          เบี้ยช่วงต้นถูกใช้ไปกับค่าใช้จ่ายในการออกกรมธรรม์ เป็นปกติของประกันตลอดชีพทุกบริษัท
          แบบนี้เน้นความคุ้มครอง ไม่ใช่การออมระยะสั้น
        </p>
      )}
      <p className="mt-2 px-0.5 text-[11.5px] leading-[1.7] text-[var(--lg-mute)] opacity-80">
        แถวสุดท้าย (ปีที่ {rows.length}) คือเงินที่ได้รับเมื่อครบสัญญาอายุ {maturityAge} ปี
      </p>
    </details>
  );
}
```

- [ ] **Step 2: ตรวจว่าคอมไพล์ผ่าน**

Run: `npx tsc --noEmit`
Expected: ไม่มี error

- [ ] **Step 3: commit**

```bash
git add src/components/lifeprotect/CashValueTable.tsx
git commit -m "feat(lifeprotect): list every year of the contract behind one tap"
```

---

### Task 5: ต่อเข้าการ์ดผลลัพธ์

**Files:**
- Modify: `src/components/LifeProtectCalculator.tsx`

- [ ] **Step 1: เพิ่ม import**

```tsx
import { cashProjection } from "@/lib/cash-projection";
import { CashValueChart } from "@/components/lifeprotect/CashValueChart";
import { CashValueTable } from "@/components/lifeprotect/CashValueTable";
import { payYears } from "@/lib/lifeprotect-quote";
```

- [ ] **Step 2: สร้าง projection ถัดจากบรรทัด `const cash = ...`**

```tsx
  // ค่าทุกตัวคูณตรงตามทุนประกัน การลากสไลเดอร์จึงไม่ต้องขอข้อมูลใหม่
  const factors = who ? term.schedule[sex][who.age - table.ageMin] : null;
  const projection = who && death && factors
    ? cashProjection({
        factors, age: who.age, sumAssured,
        annualSatang: table.expired || !annual ? null : annual.total,
        payYears: payYears(term, who.age), death,
      })
    : undefined;
  const tableCaption = who
    ? `ทุนประกัน ${sumAssured.toLocaleString("en-US")} บาท · ${sex === "M" ? "ชาย" : "หญิง"} ${
        who.age === 0 ? "แรกเกิด" : `${who.age} ปี`} · ${term.short}${
        annual && !table.expired ? ` · เบี้ย ${formatBaht(annual.total)} บาท/ปี` : ""}`
    : "";
```

- [ ] **Step 3: วางสองคอมโพเนนต์ต่อท้ายบล็อก `{cash.length > 0 && ...}`**

ภายใน `<div>` ของบล็อกนั้น ต่อจาก `</dl>` ให้เพิ่ม

```tsx
              {projection && (
                <>
                  <div className="mt-4 text-sm text-[var(--lg-mute)]">เบี้ยที่จ่าย เทียบกับ มูลค่าเงินสด</div>
                  <CashValueChart projection={projection} age={who!.age} />
                  <div className="mt-1.5 flex gap-4 text-xs text-[var(--lg-mute)]">
                    <span><i className="mr-1.5 inline-block h-0.5 w-3.5 align-middle bg-[var(--lg-gold)]" />มูลค่าเวนคืน</span>
                    <span><i className="mr-1.5 inline-block h-0.5 w-3.5 align-middle bg-white/50" />เบี้ยสะสม (รายปี)</span>
                  </div>
                  <CashValueTable projection={projection} caption={tableCaption} />
                </>
              )}
```

- [ ] **Step 4: ลบไฟล์ตัวอย่างและตรวจทั้งชุด**

```bash
rm -f public/_mock-cashvalue.html
npm run verify
```

Expected: `tsc --noEmit` เงียบ, `next lint` เงียบ, vitest ผ่านทั้งหมด, `next build` สำเร็จ

- [ ] **Step 5: ดูด้วยตาบนเบราว์เซอร์**

เปิด `/lifeprotect` กว้าง 375 จุด ตรวจว่า
- สี่บรรทัดมูลค่าเงินสดเดิมยังอยู่และตัวเลขไม่เปลี่ยน (243,000 / 444,000 / 671,000 / 1,112,000 สำหรับชาย 35 ทุน 1 ล้าน ถึงอายุ 99)
- กราฟขึ้นสองเส้นและมีหมุดเท่าทุน
- กางตารางแล้วหัวตารางไม่ถูกแถวทะลุขึ้นมาซ้อน และไม่ต้องเลื่อนซ้ายขวา
- คอลัมน์คุ้มครองลดจาก 2,000,000 เป็น 1,000,000 ที่แถวอายุ 60
- ลากสไลเดอร์ทุนแล้วทั้งกราฟและตารางขยับทันที

- [ ] **Step 6: commit**

```bash
git add src/components/LifeProtectCalculator.tsx
git rm --cached public/_mock-cashvalue.html 2>/dev/null || true
git commit -m "feat(lifeprotect): show the customer every year of what they are buying"
```
