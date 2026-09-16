"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { productNamedIn, type Product } from "@/lib/assistant/choose";

/**
 * The advertisements this system has seen, and what each one is understood to be selling.
 *
 * Three places know about an advertisement and none of them knows everything: the figures
 * synced back from Meta have its name and its spending, the conversations have the ones
 * customers actually arrived through, and the pairing table has whatever has been said by
 * hand. The page shows the union, because an advertisement that has sent someone here matters
 * whether or not its figures have synced yet.
 */

export interface AdRow {
  adId: string;
  /** the advertisement's own name, where Meta has sent it back */
  name?: string;
  campaign?: string;
  /** what was said by hand about it, if anything */
  paired?: Product;
  /** what the name alone is read as, which is what happens when nothing is paired */
  read?: Product;
  /** how many conversations arrived through it */
  conversations: number;
  spend?: number;
}

const asProduct = (v: unknown): Product | undefined => (v === "lifeprotect" || v === "ihealthy" ? v : undefined);

export async function listAds(): Promise<AdRow[]> {
  await requireAdmin();
  const db = supabaseAdmin();

  const [ads, seen, paired] = await Promise.all([
    db.from("ins_ad_daily").select("ad_id, ad_name, adset_name, campaign_name, spend"),
    db.from("ins_conversations").select("ad_id").not("ad_id", "is", null),
    db.from("ins_ad_products").select("ad_id, product, label"),
  ]);

  const rows = new Map<string, AdRow>();
  const at = (adId: string) => {
    const found = rows.get(adId) ?? { adId, conversations: 0 };
    rows.set(adId, found);
    return found;
  };

  for (const a of (ads.data ?? []) as {
    ad_id: string; ad_name?: string; adset_name?: string; campaign_name?: string; spend?: number;
  }[]) {
    const row = at(a.ad_id);
    row.name ??= a.ad_name ?? a.adset_name;
    row.campaign ??= a.campaign_name;
    // the figures arrive one row per day, so the spending is summed rather than taken
    row.spend = (row.spend ?? 0) + Number(a.spend ?? 0);
  }
  for (const c of (seen.data ?? []) as { ad_id: string }[]) at(c.ad_id).conversations += 1;
  for (const p of (paired.data ?? []) as { ad_id: string; product: string; label?: string }[]) {
    const row = at(p.ad_id);
    row.paired = asProduct(p.product);
    row.name ??= p.label ?? undefined;
  }

  for (const row of rows.values()) {
    row.read = productNamedIn([row.name, row.campaign].filter(Boolean).join(" ")) ?? undefined;
  }

  // the ones that have actually sent somebody first, then the busiest, then by name
  return [...rows.values()].sort((a, b) =>
    b.conversations - a.conversations || (b.spend ?? 0) - (a.spend ?? 0) || a.adId.localeCompare(b.adId));
}

/** Say what an advertisement sells, or take back what was said. */
export async function pairAd(adId: string, product: Product | "", label?: string): Promise<void> {
  await requireAdmin();
  const id = adId.trim();
  if (!id) throw new Error("ต้องระบุรหัสโฆษณา");

  const db = supabaseAdmin();
  if (!product) {
    const { error } = await db.from("ins_ad_products").delete().eq("ad_id", id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await db.from("ins_ad_products").upsert({
      ad_id: id,
      product,
      ...(label?.trim() ? { label: label.trim() } : {}),
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
  }
  revalidatePath("/admin/ads");
}
