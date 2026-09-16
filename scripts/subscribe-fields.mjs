#!/usr/bin/env node
/**
 * Subscribe the Page to the webhook fields this app needs, once, by hand.
 *
 * The app does this for you at the end of the Facebook login — `subscribePage()` in
 * `src/lib/facebook/oauth.ts` — and that is the way to do it normally. This exists for the
 * case the login cannot be used: no connection row in the database, so the admin page shows
 * no button to press, while the bot itself runs on a Page token from the environment.
 *
 * Adding `messaging_referrals` is what makes the advertisement's id arrive at all. Without
 * it, Meta sends no referral of its own AND withholds the copy it would otherwise put on the
 * first message of a thread opened from an ad — so "which advert paid for this customer"
 * stays unanswerable no matter what the code does.
 *
 * The token is read from the environment and never printed. Nothing here writes to the
 * database; it talks to Meta and to nothing else.
 *
 * Usage, from the project root:
 *
 *   FB_PAGE_ACCESS_TOKEN='...' node scripts/subscribe-fields.mjs          # show and subscribe
 *   FB_PAGE_ACCESS_TOKEN='...' node scripts/subscribe-fields.mjs --check  # show only
 *
 * Get the token from Vercel → Project → Settings → Environment Variables, or with
 * `vercel env pull .env.production.local` and then reading it from that file.
 */

import { readFileSync } from "node:fs";

const GRAPH = "https://graph.facebook.com/v23.0";
const CHECK_ONLY = process.argv.includes("--check");

/**
 * The fields the app expects, read out of the app rather than repeated here.
 *
 * Repeating the list is how the two drift apart: the code would ask for four and this script
 * would subscribe three, and the missing one would look like a Meta problem for a week.
 */
function wantedFields() {
  const src = readFileSync(new URL("../src/lib/facebook/oauth.ts", import.meta.url), "utf8");
  const block = src.match(/SUBSCRIBED_FIELDS\s*=\s*\[([\s\S]*?)\]/);
  if (!block) throw new Error("อ่าน SUBSCRIBED_FIELDS จาก src/lib/facebook/oauth.ts ไม่ได้");
  const fields = [...block[1].matchAll(/["']([a-z_]+)["']/g)].map((m) => m[1]);
  if (fields.length === 0) throw new Error("SUBSCRIBED_FIELDS ว่างเปล่า");
  return fields;
}

function token() {
  const t = process.env.FB_PAGE_ACCESS_TOKEN;
  if (t && t.trim()) return t.trim();
  console.error(
    "\nยังไม่ได้ตั้ง FB_PAGE_ACCESS_TOKEN\n\n" +
    "  ดึงจาก Vercel:  vercel env pull .env.production.local\n" +
    "  แล้วรัน:        FB_PAGE_ACCESS_TOKEN=\"$(grep -m1 '^FB_PAGE_ACCESS_TOKEN=' .env.production.local | cut -d= -f2- | tr -d '\\\"')\" \\\n" +
    "                  node scripts/subscribe-fields.mjs\n",
  );
  process.exit(1);
}

/** A Graph call that turns Meta's own error into a sentence, and never echoes the token. */
async function graph(path, init = {}) {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token()}`, ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error ?? {};
    throw new Error(`Meta ปฏิเสธ (${res.status}) ${e.message ?? ""} ${e.code ? `[code ${e.code}]` : ""}`.trim());
  }
  return body;
}

/** The fields this Page currently sends to this app. */
async function current(pageId) {
  const body = await graph(`/${pageId}/subscribed_apps?fields=subscribed_fields`);
  const app = (body.data ?? [])[0];
  return app?.subscribed_fields ?? [];
}

async function main() {
  const wanted = wantedFields();
  console.log(`\nเหตุการณ์ที่แอปต้องการ: ${wanted.join(", ")}`);

  // /me with a Page token is the Page itself — and proves the token works before anything else
  const me = await graph("/me?fields=id,name");
  console.log(`เพจ: ${me.name} (${me.id})\n`);

  const before = await current(me.id);
  console.log(`ตอนนี้รับอยู่:  ${before.length ? before.join(", ") : "(ไม่มีเลย)"}`);

  const missing = wanted.filter((f) => !before.includes(f));
  if (missing.length === 0) {
    console.log("\n✓ ครบแล้ว ไม่ต้องทำอะไร\n");
    return;
  }
  console.log(`ยังขาด:        ${missing.join(", ")}`);

  if (CHECK_ONLY) {
    console.log("\n(--check: ดูอย่างเดียว ยังไม่ได้สมัคร)\n");
    return;
  }

  // the whole list, not just the missing ones: this endpoint replaces rather than appends
  await graph(`/${me.id}/subscribed_apps`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ subscribed_fields: wanted.join(",") }),
  });

  const after = await current(me.id);
  console.log(`หลังสมัคร:     ${after.join(", ")}`);

  const stillMissing = wanted.filter((f) => !after.includes(f));
  if (stillMissing.length) {
    console.error(`\n✗ ยังขาด ${stillMissing.join(", ")} — Meta ตอบว่าสำเร็จแต่ไม่ได้เพิ่มให้\n`);
    process.exit(1);
  }
  console.log("\n✓ สมัครครบแล้ว ข้อมูลโฆษณาจะเริ่มมากับข้อความถัดไปที่มาจากแอด\n");
}

main().catch((e) => {
  console.error(`\n✗ ${e.message}\n`);
  process.exit(1);
});
