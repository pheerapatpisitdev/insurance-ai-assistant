import { authorise } from "@/lib/api/key";
import { badRequest, cannotIssue, ok, refuse } from "@/lib/api/respond";
import { healthCatalogue, quoteHealth } from "@/lib/api/service";

export const dynamic = "force-dynamic";

/**
 * Health cover over HTTP, so that a caller who is not a model gets the same answer.
 *
 * GET lists the plans this age can buy; POST prices one. Two methods rather than two paths
 * because they are one question — which plan, and what does it cost — and a caller that has
 * to discover a second address is a caller who guesses a plan code instead.
 */

export async function GET(request: Request) {
  const auth = await authorise(request);
  if ("refused" in auth) return refuse(auth.refused);

  const raw = new URL(request.url).searchParams.get("age");
  const age = raw === null ? undefined : Number(raw);
  if (age !== undefined && !Number.isInteger(age)) return badRequest("age ต้องเป็นจำนวนเต็ม");

  const { version, expiresOn, expired, ...rest } = healthCatalogue(age);
  return ok(auth.caller, { version, expiresOn, expired }, rest);
}

export async function POST(request: Request) {
  const auth = await authorise(request);
  if ("refused" in auth) return refuse(auth.refused);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return badRequest("อ่าน JSON ไม่ได้");
  }

  const outcome = quoteHealth((body ?? {}) as Record<string, unknown>);
  if (outcome.kind === "unreadable") {
    return badRequest(outcome.message, outcome.field ? { [outcome.field]: outcome.message } : undefined);
  }
  if (outcome.kind === "not_issuable") return cannotIssue(outcome.reasons);
  return ok(auth.caller, outcome.meta, outcome.quote);
}
