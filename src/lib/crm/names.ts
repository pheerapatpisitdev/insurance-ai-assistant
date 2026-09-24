import { pageToken } from "@/lib/facebook/connection";

/**
 * A customer's name and picture, asked of the Page they wrote to.
 *
 * Every lead on /admin/crm said "ไม่ทราบชื่อ", and the reason was the token, not Meta. The
 * name was asked for with `pageToken()` and no Page named, which is the newest Page connected
 * — ประกันเพื่อคนวัยทำงาน, since three were connected on 2026-09-24. But the id a customer has
 * is scoped to the Page they wrote to: the same person has a different id on every Page, and
 * one Page's token asking about another Page's id is refused. Both leads at the time had come
 * through LuckyPlanner and ประกัน Talk, so every lookup failed, and the failure was read as
 * "Meta would not say" because the answer's error was never looked at.
 *
 * So the lead's own Page is named, and a refusal is written to the log with Meta's own words.
 * Stored nowhere, like the lookup it replaces in src/lib/facebook/profile.ts: a report that
 * leaks should be a report of figures, not of who asked about life insurance.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

export interface Profile {
  name: string;
  picture?: string;
}

/** For the life of one render: the same person in two lists is one call to Meta. */
const seen = new Map<string, Profile | null>();

/**
 * Who this page-scoped id belongs to, or null when Meta will not say.
 *
 * Never throws. A row without a name is still a lead worth calling; a page that errors because
 * a name could not be fetched helps nobody.
 */
export async function profileOn(pageId: string | null, psid: string): Promise<Profile | null> {
  const key = `${pageId ?? ""}:${psid}`;
  if (seen.has(key)) return seen.get(key)!;
  let profile: Profile | null = null;
  try {
    const token = await pageToken(pageId || undefined);
    if (!token) {
      console.error(`อ่านชื่อลูกค้าไม่ได้: ไม่มีสิทธิ์ของเพจ ${pageId || "(ไม่ทราบเพจ)"}`);
    } else {
      const url = `${GRAPH}/${encodeURIComponent(psid)}?fields=name,profile_pic`;
      const res = await fetch(url, { cache: "no-store", headers: { authorization: `Bearer ${token}` } });
      const body = (await res.json().catch(() => ({}))) as {
        name?: string;
        profile_pic?: string;
        error?: { message?: string; code?: number; error_subcode?: number };
      };
      if (res.ok && body.name) {
        profile = { name: body.name, ...(body.profile_pic ? { picture: body.profile_pic } : {}) };
      } else if (body.error) {
        // Meta's words, so whoever reads the log can tell a missing permission from a stale id
        console.error(
          `อ่านชื่อลูกค้าไม่ได้ (เพจ ${pageId || "?"}): ${body.error.code ?? res.status}` +
          `${body.error.error_subcode ? `/${body.error.error_subcode}` : ""} ${body.error.message ?? ""}`,
        );
      }
    }
  } catch (e) {
    console.error("อ่านชื่อลูกค้าไม่สำเร็จ:", e);
  }
  // a refusal is not remembered: the next render asks again rather than repeating a failure
  if (profile) seen.set(key, profile);
  return profile;
}

/** Forget what was borrowed. Called between renders in tests. */
export function forgetProfiles(): void {
  seen.clear();
}

/**
 * The customer's own thread in Meta Business Suite, or its inbox when the thread cannot be
 * named.
 *
 * "เปิดแชท" opened the inbox and left the owner to find the person in it, which with three
 * Pages and no name on the row was a search with nothing to search for. Business Suite opens a
 * thread given the Page and the customer's id on that Page; both are known here, and nothing
 * else goes into the address.
 */
export function inboxLink(pageId: string | null, psid: string | null): string {
  const base = "https://business.facebook.com/latest/inbox/all";
  if (!pageId || !psid) return base;
  return `${base}?asset_id=${encodeURIComponent(pageId)}&selected_item_id=${encodeURIComponent(psid)}`;
}
