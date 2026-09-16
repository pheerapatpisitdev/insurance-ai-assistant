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
 * Four readings, in the order of how much each can be trusted:
 *
 *  1. the pairing table — this advertisement, named by hand at /admin/ads. The most specific
 *     statement there is, and the only one that can fix an advertisement the rest misread.
 *  2. `ref` — what the m.me link called itself. The agency writes it, so it says what was
 *     meant: m.me/<page>?ref=lifeprotect.
 *  3. the postback payload — the same thing, when the customer arrived by pressing a button
 *     on the page rather than through a link.
 *  4. `ad_id` in the advertisement figures the system already syncs, where the advertisement
 *     carries the name its author gave it.
 *
 * The last three need nothing configured: an agency that names its advertisements after the
 * plan they sell — which is what naming an advertisement is for — is understood without
 * keeping a second list in step with the first. The table is for the advertisement called
 * "โปรโมชั่นเดือนนี้", which is a perfectly ordinary name and says nothing at all.
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
  /** which of the four said so, for the log that has to explain a wrong guess afterwards */
  from: "paired" | "ref" | "payload" | "ad_name";
}

/** What somebody said this advertisement sells, if they have said. */
async function pairedProduct(adId: string): Promise<Product | undefined> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("ins_ad_products").select("product").eq("ad_id", adId).limit(1);
    if (error) throw new Error(error.message);
    const row = data?.[0] as { product?: Product } | undefined;
    return row?.product;
  } catch (e) {
    console.error("อ่านการจับคู่โฆษณาไม่สำเร็จ:", e);
    return undefined;
  }
}

/** What the advertisement that sent this customer was selling, as far as it can be known. */
export async function productFromAd(
  referral: Referral | undefined, payload: string | undefined,
): Promise<AdOrigin | undefined> {
  if (referral?.ad_id) {
    // said by hand about this advertisement, which outranks anything read off a name
    const paired = await pairedProduct(referral.ad_id);
    if (paired) return { product: paired, from: "paired" };
  }

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
