import { NextResponse } from "next/server";
import { authorizeUrl, makeState, oauthIsConfigured } from "@/lib/facebook/oauth";
import { requestOrigin } from "@/lib/facebook/origin";

export const dynamic = "force-dynamic";

/** Sends the owner to Facebook's own login screen. Nothing is stored until they come back. */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  if (!oauthIsConfigured()) {
    return NextResponse.redirect(`${origin}/admin/messenger?fb=unconfigured`);
  }
  return NextResponse.redirect(authorizeUrl(origin, makeState()));
}
