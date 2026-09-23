import { quote } from "@/calc/quote";
import { quoteModePremiums, type ModePremium } from "@/calc/mode-premiums";
import { cashValueSchedule, maturityValue, type CashValueRow } from "@/calc/cash-value";
import { getPlan, type PlanBundle } from "@/calc/plans/registry";
import { getBundle } from "@/calc/bundles/registry";
import { bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
import { formatBaht } from "@/calc/money";
import { coverRows } from "@/lib/cover-rows";
import { PAY_MODE_LABEL, type DeathBenefit, type PayMode, type QuoteInput, type QuoteResult, type Sex } from "@/calc/types";
import type { BundleCardInput, CardInput, PlanCardInput } from "@/lib/card-link";
import { deathBenefitRows } from "@/lib/death-benefit";
import { cashProjection, type Projection } from "@/lib/cash-projection";
import { ageTicks } from "@/lib/age-ticks";
import { iShieldTable } from "@/lib/ishield-table";
import { illnessBenefit } from "@/lib/ishield-quote";
import { plbTable } from "@/lib/plb-table";
import { coverEndsAt } from "@/lib/plb-quote";
import { lifeTreasureTable } from "@/lib/lifetreasure-table";
import { easyProtectTable } from "@/lib/easyprotect-table";
import { displayPremium, perDayText } from "@/lib/legacy-cta";
import { riderDiseases } from "@/calc/riders/diseases";
import { ci123Stages } from "@/lib/ci123-table";
import { stagePays } from "@/lib/ci123-cta";

/**
 * The quote as a picture: what a customer can keep, and what a chat can send them.
 *
 * A card is described here and drawn in the route, so the figures on it are the engine's and
 * can be tested without rendering anything. It is also why the card is asked for by the
 * quote's own inputs rather than by its numbers — the price is recomputed from the rate
 * tables at draw time, so a link that has been edited by hand cannot make the company
 * advertise a premium it never quoted.
 */
export interface CardRow {
  label: string;
  /** already grouped, e.g. "2,000,000" */
  amount: string;
}

/**
 * A titled block of figures. Cards carry a list of these rather than a field per block,
 * because what a card has to show depends on what is being sold: a plan states a death
 * benefit and a surrender value, a bundle also has to say what it is made of and what it
 * pays on a diagnosis. The drawing routine reads the list and never names a block.
 */
export interface CardSection {
  title: string;
  /** Amount rows, retained for every section so existing card consumers stay simple. */
  rows: CardRow[];
  /** A compact numbered list for content such as covered diseases. */
  items?: string[];
}

/**
 * The chart as the drawing routine needs it: geometry only, in the viewBox's own units, with
 * the colours left to the drawing. Worked out here so the picture is the engine's answer and
 * can be tested without rendering anything, the same way every figure on the card is.
 */
export interface CardChart {
  title: string;
  width: number;
  height: number;
  /** polyline point strings */
  cover: string;
  premium: string | null;
  cash: string;
  /** the sum assured's own height, when it sits clear of the scale's top and floor */
  grid: { y: number; label: string } | null;
  /** ages along the bottom */
  ticks: { x: number; label: string }[];
  /** what the top of the scale is worth */
  topLabel: string;
  /** where the surrender value overtakes the premiums paid */
  breakEven: { x: number; y: number; label: string } | null;
  legend: { label: string; kind: "cash" | "premium" | "cover" }[];
}

export interface QuoteCard {
  /** the product and its payment term, e.g. "Life Protect x 2 · ชำระเบี้ย 19 ปี" */
  planLine: string;
  /**
   * Who the quote is for, e.g. "ชาย 35 ปี". Kept apart from the sum because it is the one
   * thing an agent has to check before forwarding a card — it is set large in the corner,
   * where a glance finds it without reading the card.
   */
  insuredWho: string;
  /** what was bought, e.g. "ทุน 1,000,000 บาท" — the insured is in insuredWho */
  insuredLine: string;
  /** the instalment in the largest type; null when no price may be shown */
  premium: { amount: string; per: string } | null;
  /** "ตกวันละ 48 บาท" */
  perDay: string | null;
  /** the instalments the headline did not take, smallest first, one to a line */
  others: string[];
  /** the titled blocks of figures, in the order they are read */
  sections: CardSection[];
  /** drawn under the figures, for the plans whose cover rule has been read off their sheet */
  chart?: CardChart;
}

/** How each instalment reads after the figure on the card. */
const PER_LABEL: Record<PayMode, string> = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" };
const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

/** The ages a card quotes a surrender value at, plus whatever the schedule ends on. */
const CASH_AGES = [60, 70, 80];

const money = (baht: number) => baht.toLocaleString("en-US");

export type { BundleCardInput, CardInput, PlanCardInput } from "@/lib/card-link";
export { cardPath, cardUrl } from "@/lib/card-link";

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

function planInputFrom(params: URLSearchParams): PlanCardInput | undefined {
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

/**
 * A card's parameters, read from a URL. Everything is checked against the registry, so a
 * hand-edited link either names a real arrangement or gets nothing at all.
 */
export function cardInputFrom(params: URLSearchParams): CardInput | undefined {
  const bundleCode = params.get("bundle");
  return bundleCode ? bundleInputFrom(bundleCode, params) : planInputFrom(params);
}


function quoteInput(input: PlanCardInput, mode: PayMode): QuoteInput {
  return {
    planCode: input.planCode,
    variant: input.variant,
    age: input.age,
    sex: input.sex,
    mode,
    sumAssured: input.sumAssured,
    riders: [],
  };
}

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
      .filter((x): x is { at: number; row: CashValueRow } => !!x.row && x.row.amount > 0)
      .map((x) => ({ label: `อายุ ${x.at} ปี`, amount: money(x.row.amount) })),
    ...(end && end.age > age && end.amount > 0
      ? [{ label: `อายุ ${end.age} ปี`, amount: money(end.amount) }]
      : []),
  ];
}

/**
 * The premium as a card states it: one instalment in the largest type, the day rate under it,
 * and whatever instalments the headline did not take.
 *
 * Shared by both kinds of card because a card's price lines are the same question whatever is
 * being priced — and because when they were written twice, only one of the two remembered to
 * withhold the other instalments once the rate table had lapsed.
 */
function premiumLines(modes: ModePremium[] | undefined, expired: boolean): {
  premium: QuoteCard["premium"];
  perDay: string | null;
  others: string[];
} {
  const headline = displayPremium(modes, expired);
  const annual = modes?.find((m) => m.mode === "annual");
  // a lapsed table has no price to show, and the other instalments are prices too.
  // Smallest first, so with the day rate above them the block reads day, half-year, year.
  const others = expired ? [] : (modes ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .sort((a, b) => a.total - b.total)
    .map((m) => `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`);
  return {
    premium: headline ? { amount: formatBaht(headline.total), per: PER_LABEL[headline.mode] } : null,
    perDay: headline && annual && !expired ? `ตกวันละ ${perDayText(annual.total)} บาท` : null,
    others,
  };
}

/** 1,112,000 → "1.1 ล้าน", for the two labels the chart's vertical scale carries. */
function shortBaht(baht: number): string {
  if (baht >= 1_000_000) {
    const m = baht / 1_000_000;
    return `${m % 1 ? m.toFixed(1) : m.toFixed(0)} ล้าน`;
  }
  if (baht >= 100_000) return `${Math.round(baht / 100_000)} แสน`;
  return money(baht);
}

/** How many years the premium is paid, whichever way the plan's tables state it. */
function payYearsFor(plan: PlanBundle, variant: string, age: number): number {
  const pkg = plan.rates.base.packages?.find((p) => p.code === variant);
  if (pkg?.payTermToAge !== undefined) return Math.max(0, pkg.payTermToAge - age);
  if (pkg?.payTerm !== undefined) return pkg.payTerm;
  return plan.rates.base.payTerm?.[variant] ?? 0;
}

const CHART_W = 888, CHART_H = 300, CHART_LEFT = 86, CHART_RIGHT = 14, CHART_TOP = 18, CHART_BOTTOM = 44;

/** the least room between two ages under the card's drawing, in its own pixels */
const TICK_GAP = 46;

/**
 * The contract drawn as three lines: what the family would receive, what has been paid in,
 * and what surrendering would return. It is the one thing on the card that answers "and
 * then what" without the customer having to read a column of figures.
 *
 * Only for a plan whose cover rule has been read off its own benefit sheet — without that
 * rule the cover line would be a guess, and a guess drawn in gold is still a guess.
 */
function chartFor(
  plan: PlanBundle, input: PlanCardInput, death: DeathBenefit, annualSatang: number | null,
): CardChart | undefined {
  if (!plan.coverTopUp) return undefined;
  const factors = cashValueSchedule(input.planCode, input.variant, input.sex, input.age, 1000).map((r) => r.amount);
  if (factors.length < 2) return undefined;

  const p: Projection = cashProjection({
    factors, age: input.age, sumAssured: input.sumAssured, annualSatang,
    payYears: payYearsFor(plan, input.variant, input.age), death, topUp: plan.coverTopUp,
  });

  const top = Math.max(...p.rows.map((r) => Math.max(r.cover, r.cashValue, r.premiumPaid ?? 0))) || 1;
  const x = (at: number) => CHART_LEFT + ((at - input.age) / (p.maturityAge - input.age)) * (CHART_W - CHART_LEFT - CHART_RIGHT);
  const y = (satang: number) => CHART_H - CHART_BOTTOM - (satang / top) * (CHART_H - CHART_BOTTOM - CHART_TOP);
  const line = (pick: (r: Projection["rows"][number]) => number) =>
    p.rows.map((r) => `${x(r.age).toFixed(1)},${y(pick(r)).toFixed(1)}`).join(" ");

  // the cover holds all year and drops on one birthday, so it steps rather than slopes
  const cover = p.rows
    .flatMap((r) => [`${x(r.age).toFixed(1)},${y(r.cover).toFixed(1)}`, `${x(r.age + 1).toFixed(1)},${y(r.cover).toFixed(1)}`])
    .join(" ");

  const grid = p.coverFloor < top * 0.92 && p.coverFloor > top * 0.08
    ? { y: Number(y(p.coverFloor).toFixed(1)), label: shortBaht(Math.round(p.coverFloor / 100)) }
    : null;

  return {
    title: "ความคุ้มครอง เบี้ย และมูลค่าเงินสด",
    width: CHART_W,
    height: CHART_H,
    cover,
    premium: p.rows[0].premiumPaid === null ? null : line((r) => r.premiumPaid!),
    cash: line((r) => r.cashValue),
    grid,
    ticks: ageTicks(input.age, p.maturityAge, x, TICK_GAP)
      .map((a) => ({ x: Number(x(a).toFixed(1)), label: String(a) })),
    topLabel: shortBaht(Math.round(top / 100)),
    breakEven: p.breakEven
      ? {
        x: Number(x(p.breakEven.age).toFixed(1)),
        y: Number(y(p.breakEven.cashValue).toFixed(1)),
        label: `เท่าทุนอายุ ${p.breakEven.age}`,
      }
      : null,
    legend: [
      { label: "มูลค่าเวนคืน", kind: "cash" },
      { label: "เบี้ยสะสม (รายปี)", kind: "premium" },
      { label: "ความคุ้มครอง", kind: "cover" },
    ],
  };
}

/**
 * What a plan pays where the engine has no field for it. iShield's illnesses are a property
 * of the base contract rather than of a rider, and neither plan here has a booster for
 * `deathBenefitFor` to find, so that function returns nothing at all for them — without this
 * a PLB card would carry a price and not one word about what it buys.
 *
 * Written out per plan rather than inferred. "This contract pays X" is a claim about a
 * specific policy, and a plan whose benefit sheet has not been read gets no sentence put in
 * its mouth.
 */
function planBenefitSection(input: PlanCardInput): CardSection | undefined {
  if (input.planCode === "ISHIELD") {
    const table = iShieldTable();
    const benefit = illnessBenefit(table, input.sumAssured);
    const rows: CardRow[] = [
      { label: `ตรวจพบโรคร้ายแรงระยะรุนแรง (${table.illness.majorCount} โรค)`, amount: money(benefit.major) },
      { label: `ตรวจพบระยะเริ่มต้น (${table.illness.earlyCount} โรค) ต่อโรค`, amount: money(benefit.early) },
      { label: "เสียชีวิต", amount: money(input.sumAssured) },
    ];
    if (input.age < table.maturityAge) {
      rows.push({ label: `อยู่ครบสัญญาอายุ ${table.maturityAge} ปี`, amount: money(input.sumAssured) });
    }
    return { title: "รับเงินก้อนเมื่อ", rows };
  }
  if (input.planCode === "LIFETREASURE") {
    const table = lifeTreasureTable();
    return {
      title: "ครอบครัวได้รับเมื่อเสียชีวิต",
      rows: [{ label: `ทุกช่วงอายุ ถึงอายุ ${table.coverToAge}`, amount: money(input.sumAssured) }],
    };
  }
  if (input.planCode === "EASYPROTECT") {
    const table = easyProtectTable();
    return {
      title: "ครอบครัวได้รับเมื่อเสียชีวิต",
      rows: [{ label: `ทุกช่วงอายุ ถึงอายุ ${table.coverToAge}`, amount: money(input.sumAssured) }],
    };
  }
  if (input.planCode === "PLB") {
    const table = plbTable();
    const term = table.terms.find((t) => t.variant === input.variant);
    if (!term) return undefined;
    return {
      title: "ครอบครัวได้รับเมื่อเสียชีวิต",
      rows: [{
        label: `ตลอด ${term.years} ปีที่คุ้มครอง (ถึงอายุ ${coverEndsAt(term, input.age)})`,
        amount: money(input.sumAssured),
      }],
    };
  }
  return undefined;
}

/**
 * The card for an arrangement, or undefined when the company would not issue it — a card
 * that says nothing is worse than no card, and the chat still has its own words for why.
 */
export function quoteCard(input: CardInput, today: Date = new Date()): QuoteCard | undefined {
  return input.kind === "bundle" ? bundleCard(input, today) : planCard(input, today);
}

/**
 * The card for an arrangement, or undefined when the plan cannot be issued to that insured
 * at that sum — a card that says nothing is worse than no card, and the chat still has its
 * own words for why.
 */
function planCard(input: PlanCardInput, today: Date): QuoteCard | undefined {
  const plan = getPlan(input.planCode);
  if (!plan) return undefined;
  // priced yearly for the check, whatever instalment the customer is thinking in: the monthly
  // floor is a warning about an instalment, not about the arrangement, and the card answers it
  // by headlining the yearly figure instead
  const result = quote(quoteInput(input, "annual"), today);
  const base = result.items[0];
  if (!base?.eligible || result.sumAssured <= 0) return undefined;
  // a sum above the plan's maximum is only flagged by the engine, and a picture of a price
  // the company would refuse to issue is worse than no picture
  if (result.warnings.some((w) => w.level === "error")) return undefined;

  const modes = quoteModePremiums(quoteInput(input, "annual"), today);
  const { premium, perDay: perDayLine, others } = premiumLines(modes, result.meta.expired);

  const sections: CardSection[] = [];
  const ownBenefits = planBenefitSection(input);
  if (ownBenefits) sections.push(ownBenefits);
  if (result.deathBenefit) sections.push(deathSection(result.deathBenefit));
  const cashRows = cashRowsFor(input.planCode, input.variant, input.sex, input.age, input.sumAssured);
  if (cashRows.length) sections.push({ title: CASH_TITLE, rows: cashRows });

  // the same figures the sections carry, drawn: a cover the plan does not step down from is
  // still a line, and a card with no price still shows what the policy is worth
  const annual = modes?.find((m) => m.mode === "annual");
  const death = result.deathBenefit
    ?? { beforeAge: 0, sumBefore: result.sumAssured, sumFrom: result.sumAssured, alreadyPastAge: true };
  const chart = chartFor(plan, input, death, result.meta.expired || !annual ? null : annual.total);

  // the W-family labels its packages "<product> · <term>" already, and a plan label in front
  // of that reads "Life Protect x 1.5 / x 2 · Life Protect x 2 · ชำระเบี้ย…"
  const variantLabel = plan.variantLabels[input.variant];
  const planLabel = plan.planLabel ?? result.meta.planName;
  return {
    planLine: variantLabel.includes("·") ? variantLabel : `${planLabel} · ${variantLabel}`,
    insuredWho: `${SEX_WORD[input.sex]} ${input.age} ปี`,
    insuredLine: `ทุน ${money(result.sumAssured)} บาท`,
    premium,
    perDay: perDayLine,
    others,
    sections,
    ...(chart ? { chart } : {}),
  };
}

/** One policy year, as the value table states it. */
export interface ValueTableRow {
  year: number;
  age: number;
  /** the premium falling due that year, or "—" once the paying term is over */
  due: string;
  /** every premium paid up to and including this year; null when no price may be shown */
  paid: string | null;
  /** what surrendering returns; absent for a plan whose surrender table the company has not published */
  cash?: string;
  cover: string;
  /** the money handed back that year, for a plan that pays one; absent elsewhere */
  payout?: string;
  /** the first year the policy is worth what has gone into it */
  breakEven?: boolean;
  /** a year that would return nothing at all on surrender */
  empty?: boolean;
}

export interface ValueTableCard {
  planLine: string;
  /** who the quote is for, e.g. "ชาย 35 ปี"; drawn large in the corner */
  insuredWho: string;
  /** what was bought, e.g. "ทุน 1,000,000 บาท" */
  insuredLine: string;
  /** "เบี้ย 23,200 บาทต่อปี · ชำระ 53 ปี" */
  premiumLine: string;
  columns: string[];
  rows: ValueTableRow[];
}

/** The same headings as the table on the sales page, in the same order. */
const VALUE_COLUMNS = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"];
/**
 * A plan that is protection and nothing else, which has no surrender column to show.
 *
 * PLB is the one here: its cover runs exactly as long as its premium is paid, five, ten,
 * twelve or fifteen years, and then it is over. What the customer needs from a table of it
 * is not what it is worth — it is what they pay, what it covers, and the year it ends.
 */
const COVER_COLUMNS = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "คุ้มครอง"];
/**
 * The same table for a plan that pays money back while it runs.
 *
 * The payout goes next to the premium rather than at the end, because the two are read
 * against each other: what went out that year, and what came back.
 */
const PAYOUT_COLUMNS = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "จ่ายคืน", "เวนคืนได้", "คุ้มครอง"];

/**
 * Whole baht, dropped rather than rounded — the same ROUNDDOWN the premiums themselves are
 * built on, and the same rule `formatBaht` follows everywhere else a price is printed.
 *
 * It rounded, and the quotation card beside it did not. An iShield premium of 54,996.80 was
 * "54,996 บาท" on the quote and "54,997 บาทต่อปี" on the table of the very same arrangement,
 * sent one after the other into the same inbox. A baht is nothing; two figures for one
 * premium, in two pictures the customer keeps, is not nothing.
 *
 * Only premiums move. Cash values and cover reach this already whole, so the two roundings
 * never differed on them.
 */
const baht = (satang: number) => formatBaht(satang);

/**
 * The same contract for a plan that is protection and nothing else.
 *
 * PLB has no surrender column because PLB has no surrender value — คุ้มครองล้วน ไม่มีมูลค่า
 * เวนคืนและไม่มีเงินคืนเมื่อครบสัญญา, which is the note the quote card has carried all along.
 * Its workbook is no help either: the CV sheets in that file belong to PR60, a retirement
 * plan it was copied from, and the summary sheet still answers #REF! where PR60's savings
 * figures used to be. Borrowing a neighbouring product's numbers to fill the column is the
 * one thing that must never happen here.
 *
 * What the table has instead is the thing customers of a term plan most often get wrong: the
 * year the cover stops. สรุปผลประโยชน์!D36 and E36 are the same formula, so cover and premium
 * run together — five, ten, twelve or fifteen years, and then it is over.
 */
function coverTableCard(
  plan: PlanBundle, input: PlanCardInput, result: QuoteResult, today: Date,
): ValueTableCard | undefined {
  const years = plan.rates.base.coverTerm?.[input.variant];
  if (!years) return undefined;

  const annual = quoteModePremiums(quoteInput(input, "annual"), today)?.find((m) => m.mode === "annual");
  const annualSatang = result.meta.expired || !annual ? null : annual.total;
  const payYears = payYearsFor(plan, input.variant, input.age);
  const cover = (result.deathBenefit?.sumFrom ?? result.sumAssured) * 100;

  // built by the same function the page's own table is built by, so the picture a customer
  // saves and the table they are looking at cannot come to differ by a baht or a year
  const rows: ValueTableRow[] = coverRows({
    years, payYears, age: input.age, annualSatang, coverSatang: cover,
  });

  const variantLabel = plan.variantLabels[input.variant];
  const planLabel = plan.planLabel ?? result.meta.planName;
  return {
    planLine: variantLabel.includes("·") ? variantLabel : `${planLabel} · ${variantLabel}`,
    insuredWho: `${SEX_WORD[input.sex]} ${input.age} ปี`,
    insuredLine: `ทุน ${money(result.sumAssured)} บาท`,
    premiumLine: annualSatang === null
      ? "ขอราคาปัจจุบันได้ทางแชท"
      : `เบี้ย ${baht(annualSatang)} บาทต่อปี · ชำระ ${payYears} ปี`,
    columns: COVER_COLUMNS,
    rows,
  };
}

/**
 * Every year of the contract as a picture: what has been paid in by then, what surrendering
 * would return, and what the family would receive.
 *
 * The sales page shows this table and customers ask the chat for it by name. The quote card
 * carries four milestone ages, which answers "is it worth anything" but not "worth what, in
 * the year I retire" — and a customer who wants that wants all of it, not a better-chosen
 * four.
 *
 * Undefined for a plan whose cover rule has not been read off its own benefit sheet: the
 * cover column would be a guess, and a guess in a table reads as a fact.
 */
export function valueTableCard(input: PlanCardInput, today: Date = new Date()): ValueTableCard | undefined {
  const plan = getPlan(input.planCode);
  if (!plan) return undefined;

  const result = quote(quoteInput(input, "annual"), today);
  const base = result.items[0];
  if (!base?.eligible || result.sumAssured <= 0) return undefined;
  if (result.warnings.some((w) => w.level === "error")) return undefined;

  const factors = cashValueSchedule(input.planCode, input.variant, input.sex, input.age, 1000).map((r) => r.amount);
  if (!plan.coverTopUp || factors.length < 2) return coverTableCard(plan, input, result, today);

  const annual = quoteModePremiums(quoteInput(input, "annual"), today)?.find((m) => m.mode === "annual");
  const annualSatang = result.meta.expired || !annual ? null : annual.total;
  const payYears = payYearsFor(plan, input.variant, input.age);
  const death = result.deathBenefit
    ?? { beforeAge: 0, sumBefore: result.sumAssured, sumFrom: result.sumAssured, alreadyPastAge: true };
  const payout = plan.rules.base.maturity?.survivalPayout;
  const p = cashProjection({
    factors, age: input.age, sumAssured: input.sumAssured, annualSatang, payYears, death,
    topUp: plan.coverTopUp, payout,
    ...(payout?.length ? { maturityPercent: plan.rules.base.maturity?.percentOfSumAssured } : {}),
  });

  const variantLabel = plan.variantLabels[input.variant];
  const planLabel = plan.planLabel ?? result.meta.planName;
  return {
    planLine: variantLabel.includes("·") ? variantLabel : `${planLabel} · ${variantLabel}`,
    insuredWho: `${SEX_WORD[input.sex]} ${input.age} ปี`,
    insuredLine: `ทุน ${money(result.sumAssured)} บาท`,
    premiumLine: annualSatang === null
      ? "ขอราคาปัจจุบันได้ทางแชท"
      : `เบี้ย ${baht(annualSatang)} บาทต่อปี · ชำระ ${payYears} ปี`,
    columns: payout?.length ? PAYOUT_COLUMNS : VALUE_COLUMNS,
    rows: p.rows.map((r) => ({
      year: r.policyYear,
      age: r.age,
      // a dash rather than a nought: the year is not worth nothing, there is nothing to pay
      due: r.premiumDue ? baht(r.premiumDue) : "—",
      paid: r.premiumPaid === null ? null : baht(r.premiumPaid),
      cash: baht(r.cashValue),
      cover: baht(r.cover),
      // a dash in the last year: what maturity pays is the surrender column's own last figure
      ...(payout?.length ? { payout: r.payout ? baht(r.payout) : "—" } : {}),
      ...(p.breakEven?.policyYear === r.policyYear ? { breakEven: true } : {}),
      ...(r.cashValue === 0 ? { empty: true } : {}),
    })),
  };
}

/**
 * The rider a bundle pays a critical-illness lump sum through. Named here rather than
 * inferred, because "what this pays on a diagnosis" is a claim about a specific contract and
 * a bundle built on some other rider must not inherit the sentence. In practice: a bundle
 * built on some other critical-illness rider comes out with no diagnosis section and no
 * rate-rises note, silently — whoever adds such a bundle has to notice that and decide then
 * whether the rider should declare this itself, in its own data, instead of here.
 */
const CI_RIDER = "DCI";

/**
 * CI 123, which pays by the stage of an illness rather than once, so it is drawn as the six
 * amounts a diagnosis can pay instead of the single lump sum DCI's section says.
 */
const STAGED_CI_RIDER = "CI123";

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
  const { premium, perDay: perDayLine, others } = premiumLines(modes, result.meta.expired);

  // CI 123's benefit components are rows of the quote (the workbook itemises them) but not
  // contracts of their own, so "what this is made of" names the rider once
  const covered = result.items.filter((it) => it.eligible && !it.code.includes(":"));
  const ci = covered.find((it) => it.code === CI_RIDER);
  const staged = covered.find((it) => it.code === STAGED_CI_RIDER);

  const sections: CardSection[] = [];
  if (covered.length) {
    sections.push({
      title: "ชุดนี้ประกอบด้วย",
      rows: covered.map((it) => ({ label: it.name, amount: money(it.amount) })),
    });
  }
  // what a diagnosis pays is what this set is bought for, so it comes before the death benefit
  if (staged) {
    sections.push({
      title: "ตรวจพบโรคร้ายแรง รับเงินก้อนตามระยะของโรค",
      rows: ci123Stages().map((st) => ({ label: st.label, amount: money(stagePays(st, staged.amount)) })),
    });
  }
  if (result.deathBenefit) sections.push(deathSection(result.deathBenefit));
  if (ci) {
    sections.push({
      title: "ตรวจพบโรคร้ายแรง รับเงินก้อน",
      rows: [{ label: "จ่ายครั้งเดียว", amount: money(ci.amount) }],
    });
    const diseases = riderDiseases(ci.code)?.diseases ?? [];
    if (diseases.length) {
      sections.push({
        title: `คุ้มครองโรคร้ายแรง ${diseases.length} โรค`,
        rows: [],
        items: diseases,
      });
    }
  }
  const cashRows = cashRowsFor(bundle.planCode, bundle.variant, input.sex, input.age, tier.sumAssured);
  // The Legacy sales card is about the immediate family and critical-illness protection.
  // Its surrender figures are not part of the shared quote, while other bundle cards may
  // still use the common cash-value block.
  // The CI 123 set is the same: its base is the smallest Life Protect+ 100, there to carry the rider.
  if (input.bundleCode !== "LEGACY_FAMILY" && input.bundleCode !== "CI123_SET" && cashRows.length) {
    sections.push({ title: CASH_TITLE, rows: cashRows });
  }

  return {
    planLine: `ชุด${bundle.name}`,
    insuredWho: `${SEX_WORD[input.sex]} ${input.age} ปี`,
    insuredLine: tier.name,
    premium,
    perDay: perDayLine,
    others,
    sections,
  };
}
