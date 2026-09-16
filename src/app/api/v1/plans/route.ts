import { authorise } from "@/lib/api/key";
import { ok, refuse } from "@/lib/api/respond";
import { planCatalogue, tablesMeta } from "@/lib/api/service";

export const dynamic = "force-dynamic";

/**
 * Everything the caller needs before asking for a premium.
 *
 * One request is enough to build a form or to brief a model: what is sold, who it may be sold
 * to, what it may be written for, and the exact strings the quote endpoint expects back. A
 * caller that has to guess a variant code will guess wrong.
 */
export async function GET(request: Request) {
  const auth = await authorise(request);
  if ("refused" in auth) return refuse(auth.refused);
  return ok(auth.caller, tablesMeta(), { plans: planCatalogue() });
}
