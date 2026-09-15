import { pageToken } from "./connection";

/**
 * A customer's name and picture, fetched for the render and kept nowhere.
 *
 * The database holds an encrypted page-scoped id and no name at all, which is the design the
 * tables were given and worth keeping: a report that leaks is then a report of figures rather
 * than a list of who asked about life insurance and how much cover they wanted.
 *
 * So the name is borrowed from Meta at the moment someone looks at the page, for the rows on
 * that screen only, and is gone again when the response is sent.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

export interface Profile {
  name: string;
  picture?: string;
}

/**
 * Memoised for the life of one render.
 *
 * Module scope rather than a request-scoped cache because a serverless invocation is already
 * the boundary this needs, and the same person appearing in two tabs of one page should not
 * be two calls to Meta.
 */
const seen = new Map<string, Profile | null>();

/**
 * Who this page-scoped id belongs to, or null when Meta will not say.
 *
 * Never throws. A page that cannot reach Meta shows its rows without names rather than an
 * error: the figures are the part that had to be right, and a lead nobody can put a face to
 * is still a lead worth calling.
 */
export async function profileOf(psid: string): Promise<Profile | null> {
  if (seen.has(psid)) return seen.get(psid)!;
  let profile: Profile | null = null;
  try {
    const token = await pageToken();
    if (token) {
      const url = `${GRAPH}/${encodeURIComponent(psid)}?fields=name,profile_pic&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const body = (await res.json()) as { name?: string; profile_pic?: string };
        if (body.name) profile = { name: body.name, ...(body.profile_pic ? { picture: body.profile_pic } : {}) };
      }
    }
  } catch (e) {
    console.error("อ่านโปรไฟล์ลูกค้าไม่สำเร็จ:", e);
  }
  seen.set(psid, profile);
  return profile;
}

/** Forget what was borrowed. Called between renders in tests. */
export function forgetProfiles(): void {
  seen.clear();
}
