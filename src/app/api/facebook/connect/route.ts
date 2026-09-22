import { NextResponse } from "next/server";
import { authorizeUrl, makeState, oauthIsConfigured, type LoginPurpose } from "@/lib/facebook/oauth";
import { requestOrigin } from "@/lib/facebook/origin";

export const dynamic = "force-dynamic";

/**
 * Sends the owner to Facebook's own login screen. Nothing is stored until they come back.
 *
 * `?for=ads` is the same screen for the advertising account; where the person lands on the
 * way back depends on it, so the purpose is signed into the state rather than trusted from
 * the callback's query string.
 */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const purpose: LoginPurpose = new URL(req.url).searchParams.get("for") === "ads" ? "ads" : "pages";
  const home = purpose === "ads" ? "/admin/ads" : "/admin/messenger";
  if (!oauthIsConfigured()) {
    return NextResponse.redirect(`${origin}${home}?fb=unconfigured`);
  }
  return NextResponse.redirect(authorizeUrl(origin, makeState(purpose), purpose));
}
