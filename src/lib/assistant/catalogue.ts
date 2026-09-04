import { getPlan, listPlans, trimSuffix } from "@/calc/plans/registry";
import { listBundles, getBundle } from "@/calc/bundles/registry";
import { bundleAgeRange } from "@/calc/bundles/quote";
import { baseAgeRange, baseSumAssuredLimits } from "@/calc/rules";

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
      return `  · ${r.name} รับอายุ ${r.ageMin}-${r.ageMax} ปี`;
    })
    .filter(Boolean)
    .join("\n");
}

/** Facts about one plan, for answering "what is this plan" without guessing. */
export function planFacts(planCode: string): string | null {
  const plan = getPlan(planCode);
  if (!plan) return null;
  const name = plan.planLabel ?? plan.rates.planName ?? planCode;
  const lines = [`แบบประกัน: ${name}`, "แผน/ระยะเวลาชำระเบี้ย:"];
  for (const [variant, label] of Object.entries(plan.variantLabels)) {
    const age = baseAgeRange(plan.rules, variant, plan.rates);
    const sa = baseSumAssuredLimits(plan.rules, variant);
    lines.push(`  · ${label} รับอายุ ${age.min}-${age.max} ปี ${sa.exact ? "ทุน" : "ทุนขั้นต่ำ"} ${sa.min.toLocaleString("en-US")} บาท`);
  }
  const extra = plan.rules.base.extraDeathBenefitBeforeAge;
  if (extra) lines.push(`ผลประโยชน์กรณีเสียชีวิตจะเปลี่ยนเมื่ออายุครบ ${extra} ปี`);
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
