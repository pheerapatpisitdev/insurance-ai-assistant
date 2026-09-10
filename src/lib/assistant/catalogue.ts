import { getPlan, listPlans, trimSuffix } from "@/calc/plans/registry";
import { listBundles, getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange } from "@/calc/bundles/quote";
import { riderDiseases } from "@/calc/riders/diseases";
import { cashValueSchedule, hasCashValues, maturityValue } from "@/calc/cash-value";
import { baseAgeRange, baseSumAssuredLimits } from "@/calc/rules";
import type { PlanBundle } from "@/calc/plans/registry";

/**
 * A short description of everything we sell, small enough to sit in every prompt.
 * The model picks a plan code from here; it never invents one, because anything it
 * returns is checked against the registry before we calculate.
 */
export function planCatalogue(): string {
  const lines: string[] = [];
  for (const { code, name } of listPlans()) {
    const plan = getPlan(code)!;
    const thai = plan.rates.planName;
    lines.push(`${code} — ${name}${thai && thai !== name ? ` (ภาษาไทย: ${trimSuffix(thai)})` : ""}`);
    for (const [variant, label] of Object.entries(plan.variantLabels)) {
      const age = baseAgeRange(plan.rules, variant, plan.rates);
      const sa = baseSumAssuredLimits(plan.rules, variant);
      const saText = sa.exact ? `ทุนคงที่ ${sa.min.toLocaleString("en-US")}` : `ทุนขั้นต่ำ ${sa.min.toLocaleString("en-US")}`;
      lines.push(`  · ${variant} = ${label} (อายุ ${age.min}-${age.max} ปี, ${saText})`);
    }
  }
  return lines.join("\n");
}

/** The riders a plan sells, by name. Codes are left out so the model cannot echo one. */
export function riderCatalogue(planCode: string): string {
  const plan = getPlan(planCode);
  if (!plan) return "";
  return plan.riderOrder
    .map((code) => {
      const r = plan.rules.riders[code];
      if (!r) return null;
      const illnesses = riderDiseases(code);
      const covers = illnesses ? ` คุ้มครอง ${illnesses.diseases.length} โรค: ${illnesses.diseases.join(", ")}` : "";
      return `  · ${r.name} รับอายุ ${r.ageMin}-${r.ageMax} ปี${covers}`;
    })
    .filter(Boolean)
    .join("\n");
}

/** The age a plan's cover runs to, where its surrender table says; undefined where none does. */
function coverToAge(planCode: string, variant: string, issueAge: number): number | undefined {
  if (!hasCashValues(planCode)) return undefined;
  return maturityValue(cashValueSchedule(planCode, variant, "M", issueAge, 1000))?.age ?? undefined;
}

/** An example sum, because "2 เท่า" is a claim and "1 ล้านได้ 2 ล้าน" is the same claim checked. */
const EXAMPLE_SUM = 1_000_000;

/**
 * What one package pays when the insured dies, in the words the adverts and the sales page
 * use — including the multiple itself.
 *
 * The facts used to say only "ผลประโยชน์กรณีเสียชีวิตจะเปลี่ยนเมื่ออายุครบ 60 ปี", which does
 * not say what it changes to. A customer arriving from an advert built on "ทุน 1 ล้าน
 * ครอบครัวได้ 2 ล้าน" and asking whether that is true was told the assistant had no
 * information — the engine knew the figure all along, it was never handed to the model.
 */
function deathBenefitFact(plan: PlanBundle, planCode: string, variant: string, issueAge: number): string | null {
  const before = plan.rules.base.extraDeathBenefitBeforeAge;
  const booster = plan.rates.base.packages?.find((p) => p.code === variant)?.booster;
  if (!before || !booster) return null;
  const times = Number((1 + booster).toFixed(2));
  const to = coverToAge(planCode, variant, issueAge);
  return [
    `เสียชีวิตก่อนอายุ ${before} ปี จ่าย ${times} เท่าของทุนประกัน`,
    `(ทุน ${EXAMPLE_SUM.toLocaleString("en-US")} บาท ครอบครัวได้รับ ${(EXAMPLE_SUM * times).toLocaleString("en-US")} บาท)`,
    `ตั้งแต่อายุ ${before} ปีขึ้นไป จ่ายเต็มทุนประกัน${to ? ` คุ้มครองถึงอายุ ${to} ปี` : ""}`,
  ].join(" ");
}

/** Facts about one plan, for answering "what is this plan" without guessing. */
export function planFacts(planCode: string): string | null {
  const plan = getPlan(planCode);
  if (!plan) return null;
  const name = plan.planLabel ?? plan.rates.planName ?? planCode;
  // the adverts and the sales page call this plan by its Thai name; a question that uses that
  // name has to land on these facts rather than on "ไม่มีข้อมูลแบบประกันนี้ในระบบ"
  const thai = plan.rates.planName ? trimSuffix(plan.rates.planName) : undefined;
  const lines = [
    `แบบประกัน: ${name}${thai && thai !== name ? ` (ภาษาไทย: ${thai})` : ""}`,
    "แผน/ระยะเวลาชำระเบี้ย:",
  ];
  let saidBenefit = false;
  for (const [variant, label] of Object.entries(plan.variantLabels)) {
    const age = baseAgeRange(plan.rules, variant, plan.rates);
    const sa = baseSumAssuredLimits(plan.rules, variant);
    lines.push(`  · ${label} รับอายุ ${age.min}-${age.max} ปี ${sa.exact ? "ทุน" : "ทุนขั้นต่ำ"} ${sa.min.toLocaleString("en-US")} บาท`);
    // stated per package, because this plan sells the double and the one-and-a-half side by
    // side and a customer told the wrong multiple is a customer told the wrong price
    const benefit = deathBenefitFact(plan, planCode, variant, age.min);
    if (benefit) {
      lines.push(`      ${benefit}`);
      saidBenefit = true;
    }
  }
  const extra = plan.rules.base.extraDeathBenefitBeforeAge;
  if (extra && !saidBenefit) lines.push(`ผลประโยชน์กรณีเสียชีวิตจะเปลี่ยนเมื่ออายุครบ ${extra} ปี`);
  if (plan.rules.minMonthlyTotal) {
    lines.push(`ชำระรายเดือนได้เมื่อเบี้ยรวมต่องวดถึง ${plan.rules.minMonthlyTotal.toLocaleString("en-US")} บาท`);
  }
  const riders = riderCatalogue(planCode);
  if (riders) lines.push("สัญญาเพิ่มเติมที่ซื้อแนบได้:", riders);
  return lines.join("\n");
}

/**
 * What the agency sells under its own names. A bundle is not on the company's plan list, so
 * without this the assistant would answer "ประกันมรดก" with whatever plan looked closest.
 */
export function bundleFacts(): string {
  const out: string[] = [];
  for (const { code } of listBundles()) {
    const bundle = getBundle(code)!;
    const plan = getPlan(bundle.planCode);
    const range = bundleAgeRange(bundle);
    const riders = new Set(bundle.tiers.flatMap((t) => t.riders.map((r) => plan?.rules.riders[r.code]?.name ?? r.code)));
    out.push([
      `ชุดจัดเอง: ${bundle.name}`,
      `  ประกอบจาก ${plan?.variantLabels[bundle.variant] ?? bundle.planCode} คู่กับ ${[...riders].join(", ")}`,
      `  รับอายุ ${range.min}-${range.max} ปี`,
      `  ระดับที่ขาย: ${bundle.tiers.map((t) => t.name).join(", ")}`,
    ].join("\n"));
  }
  return out.join("\n\n");
}

/** Facts for every plan and every bundle, used when the question does not name one. */
export function allPlanFacts(): string {
  const plans = listPlans().map((p) => planFacts(p.code)).filter(Boolean).join("\n\n");
  const bundles = bundleFacts();
  return bundles ? `${bundles}\n\n${plans}` : plans;
}
