import type { NextRequest } from "next/server";
import { cronCallerIsOurs } from "@/lib/chat/cron-token";
import { prune } from "@/lib/chat/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The forgetting, once a day.
 *
 * `ins_prune()` drops sessions nobody came back to, empties the page-scoped id of a lead long
 * closed, and clears the hash of a conversation untouched for ninety days. It has existed
 * since the tables did and has never been called once — so every promise this project makes
 * about forgetting has, until now, been kept by nothing at all.
 *
 * The caller proves itself with the same token the follow-up minute hand uses: a word that
 * lives in the database and nowhere else.
 */
export async function POST(req: NextRequest) {
  if (!(await cronCallerIsOurs(req.headers.get("authorization")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const pruned = await prune();
  return Response.json({ pruned });
}
