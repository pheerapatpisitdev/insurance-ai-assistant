import { supabaseAdmin } from "@/lib/supabase/admin";
import { productNamedIn, type Product } from "@/lib/assistant/choose";
import type { Referral } from "@/lib/facebook/events";

/**
 * Which plan the advertisement was about.
 *
 * A customer who pressed "ส่งข้อความ" under a Life Protect advertisement has already said
 * what they came for. Asking them "สนใจแบบไหนครับ" in the first reply spends their patience
 * on a question the advertisement answered — and spends the click that was paid for.
 *
 * Three readings, in the order of how much each can be trusted:
 *
 *  1. `ref` — what the m.me link called itself. The agency writes it, so it says what was
 *     meant: m.me/<page>?ref=lifeprotect.
 *  2. the postback payload — the same thing, when the customer arrived by pressing a button
 *     on the page rather than through a link.
 *  3. `ad_id` in the advertisement figures the system already syncs, where the advertisement
 *     carries the name its author gave it.
 *
 * None of them needs anything configured: an agency that names its advertisements after the
 * plan they sell — which is what naming an advertisement is for — is understood without
 * keeping a second list in step with the first.
 *
 * There was a fourth, and it outranked these: a table the owner filled in by hand for the
 * advertisement called "โปรโมชั่นเดือนนี้". The page that filled it is gone, so the table
 * cannot be written to any more, and a reading nothing can set is a reading that only costs
 * every customer a database round trip on their way in. An advertisement these three misread
 * is fixed by renaming the advertisement.
 */

/** The plan a piece of text names, using the recogniser the bot already routes on. */
function productIn(text: string | undefined): Product | undefined {
  return text ? productNamedIn(text) : undefined;
}

/**
 * The advertisement's own name, from the figures Meta sends back about it.
 *
 * Fails soft and fails quiet: an unknown advertisement is a conversation that begins by
 * asking which plan, which is exactly where it began before any of this existed.
 */
async function nameOfAd(adId: string): Promise<string | undefined> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("ins_ad_daily")
      .select("ad_name, campaign_name, adset_name")
      .eq("ad_id", adId)
      .order("date", { ascending: false })
      .limit(1);
    if (error) throw new Error(error.message);
    const row = data?.[0] as { ad_name?: string; campaign_name?: string; adset_name?: string } | undefined;
    if (!row) return undefined;
    return [row.ad_name, row.adset_name, row.campaign_name].filter(Boolean).join(" ");
  } catch (e) {
    console.error("อ่านชื่อโฆษณาไม่สำเร็จ:", e);
    return undefined;
  }
}

export interface AdOrigin {
  product: Product;
  /** which of the three said so, for the log that has to explain a wrong guess afterwards */
  from: "ref" | "payload" | "ad_name";
}

/** What the advertisement that sent this customer was selling, as far as it can be known. */
export async function productFromAd(
  referral: Referral | undefined, payload: string | undefined,
): Promise<AdOrigin | undefined> {
  const byRef = productIn(referral?.ref);
  if (byRef) return { product: byRef, from: "ref" };

  const byPayload = productIn(payload);
  if (byPayload) return { product: byPayload, from: "payload" };

  if (referral?.ad_id) {
    const byName = productIn(await nameOfAd(referral.ad_id));
    if (byName) return { product: byName, from: "ad_name" };
  }
  return undefined;
}
