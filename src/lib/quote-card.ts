import { quote } from "@/calc/quote";
import { quoteModePremiums } from "@/calc/mode-premiums";
import { cashValueSchedule, maturityValue, type CashValueRow } from "@/calc/cash-value";
import { getPlan } from "@/calc/plans/registry";
import { formatBaht } from "@/calc/money";
import { PAY_MODE_LABEL, type DeathBenefit, type PayMode, type QuoteInput, type Sex } from "@/calc/types";
import { deathBenefitRows } from "@/lib/death-benefit";
import { displayPremium, perDay } from "@/lib/legacy-cta";

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
  rows: CardRow[];
}

export interface QuoteCard {
  /** the product and its payment term, e.g. "Life Protect x 2 · ชำระเบี้ย 19 ปี" */
  planLine: string;
  /** the insured and the sum, e.g. "ชาย 35 ปี · ทุน 1,000,000 บาท" */
  insuredLine: string;
  /** the instalment in the largest type; null when no price may be shown */
  premium: { amount: string; per: string } | null;
  /** "ตกวันละ 48 บาท" */
  perDay: string | null;
  /** the instalments the headline did not take */
  others: string | null;
  /** the titled blocks of figures, in the order they are read */
  sections: CardSection[];
  /** the small print, one line per entry */
  notes: string[];
}

/** How each instalment reads after the figure on the card. */
const PER_LABEL: Record<PayMode, string> = { annual: "ต่อปี", semi: "ต่อ 6 เดือน", monthly: "ต่อเดือน" };
const SEX_WORD: Record<Sex, string> = { M: "ชาย", F: "หญิง" };

/** The ages a card quotes a surrender value at, plus whatever the schedule ends on. */
const CASH_AGES = [60, 70, 80];

const money = (baht: number) => baht.toLocaleString("en-US");

/**
 * What a card can be asked for. It is the quote's own input minus everything a customer
 * never picks in a chat: riders, a payer, the premium basis.
 */
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

/** A union of one for now — the agency's own bundle joins it here next. */
export type CardInput = PlanCardInput;

/**
 * A card's parameters, read from a URL. Everything is checked against the registry, so a
 * hand-edited link either names a real arrangement or gets nothing at all.
 */
export function cardInputFrom(params: URLSearchParams): CardInput | undefined {
  const planCode = params.get("plan") ?? "";
  const plan = getPlan(planCode);
  if (!plan) return undefined;
  const variant = params.get("variant") ?? plan.defaultVariant ?? "";
  if (!(variant in plan.variantLabels)) return undefined;
  const age = Number(params.get("age"));
  if (!Number.isInteger(age) || age < 0 || age > 99) return undefined;
  const sex = params.get("sex");
  if (sex !== "M" && sex !== "F") return undefined;
  const sumAssured = Number(params.get("sum"));
  if (!Number.isInteger(sumAssured) || sumAssured <= 0) return undefined;
  const raw = params.get("mode");
  const mode = raw === "annual" || raw === "semi" || raw === "monthly" ? raw : undefined;
  return { kind: "plan", planCode, variant, age, sex, sumAssured, mode };
}

/** The path a card is drawn at, with the arrangement it draws written into it. */
export function cardPath(input: CardInput): string {
  const q = new URLSearchParams({
    plan: input.planCode,
    variant: input.variant,
    age: String(input.age),
    sex: input.sex,
    sum: String(input.sumAssured),
  });
  if (input.mode) q.set("mode", input.mode);
  return `/api/card?${q.toString()}`;
}

/** The same path against a host, for the channels that can only send an absolute URL. */
export function cardUrl(origin: string, input: CardInput): string {
  return new URL(cardPath(input), origin).toString();
}

function quoteInput(input: CardInput, mode: PayMode): QuoteInput {
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
 * The card for an arrangement, or undefined when the plan cannot be issued to that insured
 * at that sum — a card that says nothing is worse than no card, and the chat still has its
 * own words for why.
 */
export function quoteCard(input: CardInput, today: Date = new Date()): QuoteCard | undefined {
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
  const headline = displayPremium(modes, result.meta.expired)
    ?? (input.mode && !result.meta.expired ? modes?.find((m) => m.mode === input.mode) : undefined);
  const annual = modes?.find((m) => m.mode === "annual");
  const others = (modes ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .map((m) => `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`);

  const sections: CardSection[] = [];
  if (result.deathBenefit) sections.push(deathSection(result.deathBenefit));
  const cashRows = cashRowsFor(input.planCode, input.variant, input.sex, input.age, input.sumAssured);
  if (cashRows.length) sections.push({ title: CASH_TITLE, rows: cashRows });

  // the W-family labels its packages "<product> · <term>" already, and a plan label in front
  // of that reads "Life Protect x 1.5 / x 2 · Life Protect x 2 · ชำระเบี้ย…"
  const variantLabel = plan.variantLabels[input.variant];
  const planLabel = plan.planLabel ?? result.meta.planName;
  return {
    planLine: variantLabel.includes("·") ? variantLabel : `${planLabel} · ${variantLabel}`,
    insuredLine: `${SEX_WORD[input.sex]} ${input.age} ปี · ทุน ${money(result.sumAssured)} บาท`,
    premium: headline ? { amount: formatBaht(headline.total), per: PER_LABEL[headline.mode] } : null,
    perDay: headline && annual && !result.meta.expired ? `ตกวันละ ${perDay(annual.total)} บาท` : null,
    others: others.length ? others.join(" · ") : null,
    sections,
    notes: result.meta.expired
      ? ["ตารางเบี้ยชุดนี้หมดอายุแล้ว ขอราคาปัจจุบันได้ทางแชท", "ไม่ใช่ใบเสนอราคา และไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย"]
      : [
        `เบี้ยมาตรฐานโดยประมาณ · ตารางเบี้ยฉบับ ${result.meta.version}`,
        "ไม่ใช่ใบเสนอราคา ผลประโยชน์เป็นไปตามที่ระบุในกรมธรรม์",
      ],
  };
}
