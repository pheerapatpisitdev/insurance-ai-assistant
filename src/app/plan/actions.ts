"use server";
import { headers } from "next/headers";
import { clientIp, limiter } from "@/lib/assistant/rate-limit";
import { logRun } from "@/lib/plan/log";
import { cleanInput } from "@/lib/plan/needs";
import { FIXED_PICK, isOrder, pickOrder } from "@/lib/plan/order";
import { explain, FALLBACK_PROSE, type Prose } from "@/lib/plan/prose";
import { realPricer } from "@/lib/plan/pricer";
import { recommend, type PlanResult } from "@/lib/plan/recommend";

/**
 * The page's two calls. The plan first: the model picks the order (8 seconds at most, else the
 * fixed one), then the figures; the planner's words after, so a slow advice call never holds up
 * the numbers. Both recompute from the form rather than trust a result sent back from the
 * browser — only the order comes back, and only as a checked list of the four areas.
 */

const allowBuild = limiter(20, 60_000);
const allowExplain = limiter(6, 60_000);

export type BuildReply = { ok: true; result: PlanResult } | { ok: false; error: string };

export async function buildPlan(raw: unknown): Promise<BuildReply> {
  const p = cleanInput(raw);
  if (typeof p === "string") return { ok: false, error: p };
  if (!allowBuild(clientIp(await headers()))) return { ok: false, error: "กดถี่เกินไป รอสักครู่แล้วลองใหม่นะครับ" };
  const result = recommend(p, realPricer(p.age, p.sex), await pickOrder(p));
  await logRun(p, result);
  return { ok: true, result };
}

/** `order` is the one buildPlan used, so the words follow the same plan */
export async function explainPlan(raw: unknown, order?: unknown): Promise<Prose> {
  const p = cleanInput(raw);
  if (typeof p === "string") return FALLBACK_PROSE;
  if (!allowExplain(clientIp(await headers()))) return FALLBACK_PROSE;
  const pick = isOrder(order) ? { ...FIXED_PICK, order } : FIXED_PICK;
  return explain(p, recommend(p, realPricer(p.age, p.sex), pick));
}
