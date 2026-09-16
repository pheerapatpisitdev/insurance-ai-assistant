import { authorise } from "@/lib/api/key";
import { badRequest, cannotIssue, ok, refuse } from "@/lib/api/respond";
import { quote } from "@/calc/quote";
import { quoteModePremiums } from "@/calc/mode-premiums";
import { getPlan } from "@/calc/plans/registry";
import { cardUrl, valueTablePath } from "@/lib/card-link";
import { siteUrl } from "@/lib/site-url";
import type { PayMode, Sex } from "@/calc/types";

export const dynamic = "force-dynamic";

/**
 * One premium, from the same engine the website and the page's inbox quote from.
 *
 * Nothing here computes anything: `quote()` is the calculator, and every figure this returns
 * is the figure the sales page would print for the same arrangement. That is the point of
 * having an API at all — a partner or a model that works this out for itself will work it out
 * differently, and the difference will be a price somebody was quoted.
 *
 * Amounts are whole baht. The engine works in satang because a sixth of a premium has to add
 * back up; a caller who is shown satang will eventually divide by a hundred twice.
 */

const MODES: PayMode[] = ["annual", "semi", "monthly"];

interface Body {
  plan?: string;
  variant?: string;
  age?: number;
  sex?: string;
  sumAssured?: number;
  mode?: string;
}

export async function POST(request: Request) {
  const auth = await authorise(request);
  if ("refused" in auth) return refuse(auth.refused);

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return badRequest("อ่าน JSON ไม่ได้");
  }

  const plan = body.plan ? getPlan(body.plan) : undefined;
  if (!plan) return badRequest("ไม่รู้จักแบบประกันนี้ ดูรายการได้ที่ GET /api/v1/plans", { plan: "required" });

  const variants = plan.rates.base.variants ?? [];
  const variant = body.variant ?? plan.defaultVariant ?? (variants.length === 1 ? variants[0] : undefined);
  if (!variant || !variants.includes(variant)) {
    return badRequest(
      `ต้องระบุ variant ของแบบนี้: ${variants.join(", ")}`,
      { variant: "required" },
    );
  }

  const age = body.age;
  if (!Number.isInteger(age) || age! < 0 || age! > 99) {
    return badRequest("age ต้องเป็นจำนวนเต็ม 0-99", { age: "required" });
  }
  const sex = body.sex?.toUpperCase();
  if (sex !== "M" && sex !== "F") return badRequest("sex ต้องเป็น M หรือ F", { sex: "required" });

  const sumAssured = body.sumAssured;
  if (!Number.isFinite(sumAssured) || sumAssured! <= 0) {
    return badRequest("sumAssured ต้องเป็นจำนวนเงินที่มากกว่า 0", { sumAssured: "required" });
  }

  const mode = (body.mode ?? "annual") as PayMode;
  if (!MODES.includes(mode)) return badRequest(`mode ต้องเป็น ${MODES.join(", ")}`, { mode: "invalid" });

  const input = {
    planCode: body.plan!, variant, age: age!, sex: sex as Sex, mode,
    sumAssured: sumAssured!, riders: [],
  };
  const result = quote(input);

  /**
   * A refusal is an answer, and it is not a zero.
   *
   * The engine voids an arrangement the company will not write, which on the sales page shows
   * as the reason rather than a price. Returning that as a 200 with 0 in it is how a partner
   * ends up advertising free insurance, and how a model ends up calling it a bargain.
   */
  const blocking = result.warnings.filter((w) => w.level === "error").map((w) => w.message);
  if (blocking.length || result.totalAnnual <= 0) {
    return cannotIssue(blocking.length ? blocking : ["อยู่นอกเงื่อนไขที่แบบนี้รับประกัน"]);
  }

  const baht = (satang: number) => Math.round(satang / 100);
  const byMode = (quoteModePremiums(input) ?? []).map((m) => ({
    mode: m.mode,
    amount: baht(m.total),
    /** the company will not take this instalment, however the arithmetic comes out */
    belowMinimum: m.belowMinimum,
  }));

  const card = { kind: "plan" as const, planCode: input.planCode, variant, age: age!, sex: sex as Sex, sumAssured: result.sumAssured };
  return ok(auth.caller, result.meta, {
    plan: { code: input.planCode, name: plan.planLabel ?? result.meta.planName, variant, label: plan.variantLabels[variant] ?? variant },
    insured: { age: age!, sex },
    sumAssured: result.sumAssured,
    premium: { annual: baht(result.totalAnnual), byMode },
    ...(result.deathBenefit ? {
      deathBenefit: {
        beforeAge: result.deathBenefit.beforeAge,
        sumBefore: result.deathBenefit.sumBefore,
        sumFrom: result.deathBenefit.sumFrom,
      },
    } : {}),
    ...(result.maturityBenefit ? { maturityBenefit: result.maturityBenefit } : {}),
    /** the same pictures the bot sends a customer, ready to embed */
    images: {
      quote: cardUrl(siteUrl(""), card),
      ...(plan.coverTopUp ? { valueTable: siteUrl(valueTablePath(card)) } : {}),
    },
  });
}
