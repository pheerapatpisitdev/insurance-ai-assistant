import { quote } from "@/calc/quote";
import { quoteModePremiums, type ModePremium } from "@/calc/mode-premiums";
import { cashValueSchedule, maturityValue, type CashValueRow } from "@/calc/cash-value";
import { getPlan } from "@/calc/plans/registry";
import { getBundle } from "@/calc/bundles/registry";
import { bundleModePremiums, quoteBundle } from "@/calc/bundles/quote";
import { formatBaht } from "@/calc/money";
import { PAY_MODE_LABEL, type DeathBenefit, type PayMode, type QuoteInput, type Sex } from "@/calc/types";
import type { BundleCardInput, CardInput, PlanCardInput } from "@/lib/card-link";
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
  others: string | null;
} {
  const headline = displayPremium(modes, expired);
  const annual = modes?.find((m) => m.mode === "annual");
  // a lapsed table has no price to show, and the other instalments are prices too
  const others = expired ? [] : (modes ?? [])
    .filter((m) => m.mode !== headline?.mode && !m.belowMinimum)
    .map((m) => `${PAY_MODE_LABEL[m.mode]} ${formatBaht(m.total)} บาท`);
  return {
    premium: headline ? { amount: formatBaht(headline.total), per: PER_LABEL[headline.mode] } : null,
    perDay: headline && annual && !expired ? `ตกวันละ ${perDay(annual.total)} บาท` : null,
    others: others.length ? others.join(" · ") : null,
  };
}

/**
 * The small print, which is the same small print whatever was priced. Written once because
 * the two builders had already drifted apart on the expired case once, and the words a card
 * ends on are the words a customer quotes back.
 */
function cardNotes(expired: boolean, version: string, headline: string, extra: string[] = []): string[] {
  return expired
    ? ["ตารางเบี้ยชุดนี้หมดอายุแล้ว ขอราคาปัจจุบันได้ทางแชท", "ไม่ใช่ใบเสนอราคา และไม่ใช่ส่วนหนึ่งของสัญญาประกันภัย"]
    : [`${headline} · ตารางเบี้ยฉบับ ${version}`, ...extra, "ไม่ใช่ใบเสนอราคา ผลประโยชน์เป็นไปตามที่ระบุในกรมธรรม์"];
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
    premium,
    perDay: perDayLine,
    others,
    sections,
    notes: cardNotes(result.meta.expired, result.meta.version, "เบี้ยมาตรฐานโดยประมาณ"),
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
    premium,
    perDay: perDayLine,
    others,
    sections,
    // DCI is priced on attained age, so every figure here is a first-year figure. A picture
    // outlives the sentence that framed it, so it has to carry the caveat itself.
    notes: cardNotes(
      result.meta.expired, result.meta.version, "เบี้ยปีแรกโดยประมาณ",
      ci ? ["สัญญาโรคร้ายแรงคิดตามอายุ เบี้ยจึงปรับขึ้นในปีถัดไป"] : [],
    ),
  };
}
