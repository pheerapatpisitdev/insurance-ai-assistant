import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

/**
 * Whether the browser asking holds an agent's session. One boolean, and nothing else.
 *
 * It exists because of a trade the pages could not make. The calculator and five of the six
 * sales pages are built ahead of time and served without touching a server — which is the
 * right shape for pages an advertisement sends strangers to. Reading the session cookie while
 * rendering them would turn every one of them dynamic, and every customer's visit into a
 * round trip, for the sake of a menu they are not allowed to use.
 *
 * So the page stays static and the menu asks afterwards. The cost is that the back office
 * appears in the menu a moment after the page does, which is a cost paid by the handful of
 * people who have a session rather than by everybody who does not.
 *
 * It discloses nothing: the answer is about the cookie the caller already holds, and a
 * stranger is told "no", which they knew.
 */
export async function GET() {
  const signedIn = await isSignedIn().catch(() => false);
  return NextResponse.json({ signedIn }, { headers: { "cache-control": "no-store" } });
}
