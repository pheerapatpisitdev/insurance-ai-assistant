import { NextResponse } from "next/server";
import { grantedScopes, listPages, stateIsValid, subscribePage, tokenFromCode } from "@/lib/facebook/oauth";
import { clearPending, savePending, saveConnection } from "@/lib/facebook/connection";
import { requestOrigin } from "@/lib/facebook/origin";

export const dynamic = "force-dynamic";

/**
 * Where Facebook sends the admin back. One Page is connected outright; several means asking
 * which, so the user token waits in the database until they say.
 */
export async function GET(req: Request) {
  const origin = requestOrigin(req);
  const back = (outcome: string, detail?: string) => {
    const params = new URLSearchParams({ fb: outcome });
    if (detail) params.set("detail", detail.slice(0, 200));
    return NextResponse.redirect(`${origin}/admin/messenger?${params}`);
  };


  const params = new URL(req.url).searchParams;
  if (params.get("error")) return back("cancelled");
  if (!stateIsValid(params.get("state"))) return back("state");
  const code = params.get("code");
  if (!code) return back("state");

  try {
    const userToken = await tokenFromCode(code, origin);
    const [scopes, pages] = await Promise.all([grantedScopes(userToken), listPages(userToken)]);

    if (pages.length === 0) return back("nopages");
    if (pages.length > 1) {
      await savePending(userToken, scopes);
      return back("choose");
    }

    const page = pages[0];
    const fields = await subscribePage(page);
    await saveConnection({
      pageId: page.id, pageName: page.name, token: page.accessToken, scopes, fields,
    });
    await clearPending();
    return back("connected");
  } catch (e) {
    return back("failed", e instanceof Error ? e.message : String(e));
  }
}
