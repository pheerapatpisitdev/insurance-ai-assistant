import { authorise } from "@/lib/api/key";
import { badRequest, cannotIssue, ok, refuse } from "@/lib/api/respond";
import { quotePremium, type QuoteAsk } from "@/lib/api/service";

export const dynamic = "force-dynamic";

/**
 * One premium, from the same engine the website and the page's inbox quote from.
 *
 * This route decides nothing — `quotePremium` does, and the MCP tool calls the same function,
 * so the three doors cannot drift into quoting a customer two different figures. What is left
 * here is the HTTP of it: which status each outcome deserves.
 */
export async function POST(request: Request) {
  const auth = await authorise(request);
  if ("refused" in auth) return refuse(auth.refused);

  let ask: QuoteAsk;
  try {
    ask = (await request.json()) as QuoteAsk;
  } catch {
    return badRequest("อ่าน JSON ไม่ได้");
  }

  const outcome = quotePremium(ask);
  if (outcome.kind === "unreadable") {
    return badRequest(outcome.message, outcome.field ? { [outcome.field]: "required" } : undefined);
  }
  if (outcome.kind === "not_issuable") return cannotIssue(outcome.reasons);
  return ok(auth.caller, outcome.meta, outcome.quote);
}
