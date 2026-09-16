import { getPlan, listPlans } from "@/calc/plans/registry";
import { baseSumAssuredLimits } from "@/calc/rules";

/**
 * Questions offered as buttons, so that nobody has to guess what this can be asked.
 *
 * An empty box with a cursor in it is itself a question — what does this thing know? — and
 * most people who arrive here are customers rather than agents, who do not know the plans by
 * name and will not invent "iHealthy มีระยะเวลารอคอยกี่วัน" on their own.
 *
 * The rule the whole file is built around: **a button must lead somewhere**. One that comes
 * back "ข้อมูลนี้ไม่มีในระบบ" is worse than no button at all, because the reader learns the
 * assistant is useless from the one question the page itself put in their hand. So every
 * button here is exercised by a test that asserts a real answer comes back, and everything
 * that can be read off the registry — the plan names, the packages, the minimum sums — is
 * read off it rather than typed out, so that adding a plan cannot leave a stale button behind.
 */

export interface GuideItem {
  /** what the button says */
  label: string;
  /** what pressing it asks, which is always a whole question */
  ask: string;
}

export interface GuideGroup {
  title: string;
  items: GuideItem[];
}

const SEX_WORD = { M: "ชาย", F: "หญิง" } as const;

/** A sum written the way the buttons say it, in millions where that reads better. */
function millions(sum: number): string {
  return `${(sum / 1_000_000).toLocaleString("en-US")} ล้าน`;
}

/** The years a package is paid for, off the company's own label. */
function yearsOf(label: string | undefined): number | undefined {
  const m = label?.match(/ชำระเบี้ย\s*(\d{1,2})\s*ปี/);
  return m ? Number(m[1]) : undefined;
}

/**
 * An example that this plan will actually accept.
 *
 * Life Treasure starts at ten million, so the one-million example every plan used to carry
 * sent the reader straight into a refusal — from a button the page offered them.
 */
function exampleSum(code: string, variant: string): number {
  const plan = getPlan(code);
  if (!plan) return 1_000_000;
  const { min } = baseSumAssuredLimits(plan.rules, variant);
  return min && min > 1_000_000 ? min : 1_000_000;
}

/** The whole question a priced example is asked as, so the button needs no memory behind it. */
function priceAsk(
  code: string, label: string, age: number, sex: "M" | "F", sum: number, years?: number,
): string {
  const term = years ? ` จ่าย ${years} ปี` : "";
  return `${label} ${SEX_WORD[sex]} ${age} ทุน ${millions(sum)}${term} เบี้ยเท่าไหร่`;
}

/**
 * The buttons shown before anything has been asked.
 *
 * Grouped by what the reader wants rather than by how the system is built — a customer knows
 * they want to know the price, and does not know that two of these plans are answered by a
 * dispatcher and four by a registry lookup.
 */
export function openingGuide(): GuideGroup[] {
  const priceItems: GuideItem[] = [];
  for (const { code, name } of listPlans()) {
    const plan = getPlan(code);
    if (!plan) continue;

    /**
     * iShield is asked the other way round — a premium in, a sum back — so it gets a button
     * that says what it is rather than one that quotes a sum it would refuse.
     */
    if (plan.rules.base.premiumBasis) {
      priceItems.push({ label: `${name} — คิดยังไง`, ask: `${name} คิดเบี้ยยังไง` });
      continue;
    }

    const variants = plan.rates.base.variants ?? [];
    const variant = plan.defaultVariant ?? variants[0];
    if (!variant) continue;
    const sum = exampleSum(code, variant);
    /** the age the example is for; inside every plan's range, and the one agents quote most */
    const age = code === "LIFETREASURE" ? 40 : 35;
    const years = variants.length > 1 ? yearsOf(plan.variantLabels[variant]) : undefined;
    priceItems.push({
      label: `${name} · ชาย ${age} ทุน ${millions(sum)}`,
      ask: priceAsk(code, name, age, "M", sum, years),
    });
  }

  return [
    { title: "อยากรู้เบี้ยประกัน", items: priceItems },
    {
      title: "เงื่อนไขแบบประกัน",
      items: [
        { label: "Life Protect ทุนขั้นต่ำเท่าไหร่", ask: "Life Protect ทุนขั้นต่ำเท่าไหร่" },
        { label: "Life Protect รับประกันถึงอายุเท่าไหร่", ask: "Life Protect รับประกันถึงอายุเท่าไหร่" },
        { label: "iHealthy Ultra คุ้มครองอะไรบ้าง", ask: "iHealthy Ultra คุ้มครองอะไรบ้าง" },
      ],
    },
    {
      title: "สัญญาเพิ่มเติม — ค่ารักษาและโรคร้าย",
      items: [
        { label: "DCI ซื้อได้ถึงอายุเท่าไหร่", ask: "DCI ซื้อได้ถึงอายุเท่าไหร่" },
        { label: "HIC ซื้อคู่กับ MEB ได้ไหม", ask: "HIC ซื้อคู่กับ MEB ได้ไหม" },
        { label: "iHealthy มีระยะเวลารอคอยกี่วัน", ask: "iHealthy มีระยะเวลารอคอยกี่วัน" },
      ],
    },
  ];
}

/** What the pricing path could not work out from the message, so the buttons can supply it. */
export interface PriceGap {
  planCode: string;
  planLabel: string;
  /** the package, once it is known */
  variant?: string;
  age?: number;
  sex?: "M" | "F";
  sumAssured?: number;
  needs: ("person" | "sum" | "term")[];
}

/**
 * The next questions worth asking, given where a quotation got to.
 *
 * Each button carries the whole question rather than the missing piece alone, because a plan
 * without a brain keeps nothing between turns: "10 ปี" on its own is a sentence about
 * nothing. Rebuilding the question from the facts also means the reader's own phrasing —
 * however they wrote it — cannot carry a mistake forward.
 */
export function priceFollowUps(gap: PriceGap): GuideItem[] {
  const plan = getPlan(gap.planCode);
  if (!plan) return [];
  const variants = plan.rates.base.variants ?? [];

  const asked = (over: Partial<PriceGap>) => {
    const g = { ...gap, ...over };
    const years = g.variant ? yearsOf(plan.variantLabels[g.variant]) : undefined;
    return priceAsk(
      g.planCode, g.planLabel, g.age ?? 35, g.sex ?? "M",
      g.sumAssured ?? exampleSum(g.planCode, g.variant ?? variants[0] ?? ""),
      variants.length > 1 ? years : undefined,
    );
  };

  // one gap at a time, in the order the quotation needs them: who, then how much, then how long
  if (gap.needs.includes("person")) {
    return [35, 45].flatMap((age) => (["M", "F"] as const).map((sex) => ({
      label: `${SEX_WORD[sex]} ${age} ปี`,
      ask: asked({ age, sex }),
    })));
  }

  if (gap.needs.includes("sum")) {
    const base = exampleSum(gap.planCode, gap.variant ?? variants[0] ?? "");
    return [base, base * 2, base * 5].map((sumAssured) => ({
      label: `ทุน ${millions(sumAssured)}`,
      ask: asked({ sumAssured }),
    }));
  }

  if (gap.needs.includes("term")) {
    return variants
      .map((v) => ({ v, years: yearsOf(plan.variantLabels[v]) }))
      .filter((x): x is { v: string; years: number } => x.years !== undefined)
      .map(({ v, years }) => ({ label: `ชำระเบี้ย ${years} ปี`, ask: asked({ variant: v }) }));
  }

  /**
   * Nothing is missing, so the quotation is on the screen. What a person wants next is the
   * same contract at the other lengths — the single comparison that changes the number most.
   */
  return variants
    .filter((v) => v !== gap.variant)
    .map((v) => ({ v, years: yearsOf(plan.variantLabels[v]) }))
    .filter((x): x is { v: string; years: number } => x.years !== undefined)
    .map(({ v, years }) => ({ label: `ถ้าจ่าย ${years} ปีล่ะ`, ask: asked({ variant: v }) }));
}

/**
 * After the dispatcher has priced something.
 *
 * Only questions the brains recognise themselves — these are the exact phrasings their own
 * readers match, which is what keeps a button from landing on a model that cannot draw a
 * table.
 */
export const PRICED_FOLLOW_UPS: GuideItem[] = [
  { label: "ขอตารางมูลค่า", ask: "ขอดูตารางมูลค่าหน่อย" },
  { label: "มีแบบถูกกว่านี้ไหม", ask: "มีแบบถูกกว่านี้ไหม" },
];
