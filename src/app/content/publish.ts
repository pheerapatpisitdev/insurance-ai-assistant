"use server";
import { cookies, headers } from "next/headers";
import { limiter } from "@/lib/assistant/rate-limit";
import { pageConnections, pageToken } from "@/lib/facebook/connection";
import { deletePost, MAX_AHEAD_MS, MIN_AHEAD_MS, postPhoto, PublishError } from "@/lib/facebook/publish";
import { fullText } from "@/lib/content/output";
import { defaultPoster } from "@/lib/content/poster";
import { drawPoster } from "@/lib/content/poster-draw";
import { contentProduct } from "@/lib/content/products";
import { claimPublish, getContent, listPublished, recordPublish, type ContentItem } from "@/lib/content/store";
import { cookieOpens, PIN_COOKIE, PIN_DAYS, pinMatches, pinToken, publishPin } from "@/lib/content/pin";
import { setContentStatus } from "./actions";

/**
 * Posting a piece to a Facebook Page from the workbench, now or at a time Facebook holds.
 *
 * Three gates stand before Facebook is called, in this order: the PIN (the page is public),
 * the piece's own checks (a Facebook-rule finding marked block stops it; amounts not in the
 * rate tables must be confirmed), and the Page's permission to post. Only posts go up — a
 * script is filmed and an ad goes through Ads Manager.
 */

const POST_SCOPE = "pages_manage_posts";
const pinTries = limiter(8, 60 * 60_000);

async function caller(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}

async function unlocked(): Promise<boolean> {
  return cookieOpens((await cookies()).get(PIN_COOKIE)?.value);
}

export interface PublishPage {
  pageId: string;
  pageName: string;
  /** the Page was connected with the permission to post */
  canPost: boolean;
}

export interface PublishSetup {
  /** a PIN is set for this deployment; without one nobody can post */
  pinSet: boolean;
  unlocked: boolean;
  pages: PublishPage[];
}

export async function publishSetup(): Promise<PublishSetup> {
  try {
    const pages = (await pageConnections()).map((p) => ({ pageId: p.pageId, pageName: p.pageName, canPost: p.scopes.includes(POST_SCOPE) }));
    return { pinSet: publishPin() !== null, unlocked: await unlocked(), pages };
  } catch (e) {
    console.error("publish setup failed:", e);
    return { pinSet: publishPin() !== null, unlocked: false, pages: [] };
  }
}

export async function unlockPublishing(pin: string): Promise<{ ok: boolean; error?: string }> {
  if (!publishPin()) return { ok: false, error: "ยังไม่ได้ตั้ง PIN สำหรับโพสต์ (CONTENT_PUBLISH_PIN)" };
  if (!pinTries(`pin:${await caller()}`)) return { ok: false, error: "ใส่ PIN ผิดหลายครั้งเกินไป รอสักชั่วโมงนะครับ" };
  if (!pinMatches(String(pin ?? ""))) return { ok: false, error: "PIN ไม่ถูกต้อง" };
  (await cookies()).set(PIN_COOKIE, pinToken(publishPin()!), {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: PIN_DAYS * 24 * 60 * 60,
  });
  return { ok: true };
}

export type PublishResult =
  | { ok: true; item: ContentItem }
  | { ok: false; error: string; needPin?: boolean; /** amounts to confirm before it may go */ confirmNumbers?: string[] };

export async function publishPiece(input: {
  id: string;
  pageId: string;
  /** ISO time to hold it for; null posts now */
  at: string | null;
  /** which opening line, for older pieces that carry three */
  hook?: number;
  confirmNumbers?: boolean;
}): Promise<PublishResult> {
  if (!publishPin()) return { ok: false, error: "ยังไม่ได้ตั้ง PIN สำหรับโพสต์ (CONTENT_PUBLISH_PIN)" };
  if (!(await unlocked())) return { ok: false, error: "ใส่ PIN ก่อนโพสต์", needPin: true };

  const item = await getContent(input.id).catch(() => null);
  if (!item) return { ok: false, error: "ไม่พบชิ้นงานนี้" };
  if (item.format !== "post") return { ok: false, error: "โพสต์ลงเพจได้เฉพาะงานแบบโพสต์เฟซบุ๊ก" };
  const blocked = (item.flags.policy ?? []).filter((f) => f.severity === "block");
  if (blocked.length > 0) return { ok: false, error: `ยังผิดกฎโฆษณาของ Facebook: ${blocked[0].message} — แก้ก่อนแล้วค่อยโพสต์` };
  if (item.flags.numbers.length > 0 && !input.confirmNumbers) {
    return { ok: false, error: "มีตัวเลขที่ไม่ตรงกับตารางเบี้ย", confirmNumbers: item.flags.numbers };
  }

  let at: Date | undefined;
  if (input.at) {
    at = new Date(input.at);
    const ahead = at.getTime() - Date.now();
    if (Number.isNaN(ahead)) return { ok: false, error: "เวลาที่เลือกไม่ถูกต้อง" };
    if (ahead < MIN_AHEAD_MS) return { ok: false, error: "ตั้งเวลาได้ตั้งแต่ 15 นาทีข้างหน้าขึ้นไป" };
    if (ahead > MAX_AHEAD_MS) return { ok: false, error: "ตั้งเวลาล่วงหน้าได้ไม่เกิน 30 วัน" };
  }

  const page = (await pageConnections().catch(() => [])).find((p) => p.pageId === input.pageId);
  if (!page) return { ok: false, error: "ไม่พบเพจนี้ในรายการที่เชื่อมไว้" };
  if (!page.scopes.includes(POST_SCOPE)) {
    return { ok: false, error: `เพจ ${page.pageName} ยังไม่ได้เปิดสิทธิ์โพสต์ — เพิ่ม pages_manage_posts ในแอป Facebook แล้วเชื่อมเพจใหม่ที่ /admin/messenger` };
  }
  const token = await pageToken(page.pageId);
  if (!token) return { ok: false, error: "ไม่พบการเชื่อมต่อของเพจนี้" };

  if (!(await claimPublish(item.id))) return { ok: false, error: "ชิ้นนี้โพสต์หรือตั้งเวลาไปแล้ว หรือกำลังส่งอยู่" };

  try {
    const poster = item.output.poster ?? defaultPoster(item.output.hooks[0], contentProduct(item.planHref)?.name ?? "");
    const png = await drawPoster(poster, "square");
    const posted = await postPhoto({ pageId: page.pageId, token, png, caption: fullText(item.output, input.hook ?? 0), at });
    const saved = await recordPublish(item.id, {
      state: at ? "scheduled" : "published", pageId: page.pageId, postId: posted.id, at: (at ?? new Date()).toISOString(),
    });
    // posted is used: it moves to ใช้จริง, and its hook joins the formula library
    if (saved.status === "draft") await setContentStatus(saved.id, "used");
    return { ok: true, item: { ...saved, status: "used" } };
  } catch (e) {
    const message = e instanceof PublishError ? e.message : "ส่งไป Facebook ไม่สำเร็จ ลองใหม่อีกครั้งนะครับ";
    if (!(e instanceof PublishError)) console.error("content publish failed:", e);
    // failed is claimable again, so the owner can press once more
    await recordPublish(item.id, { state: "failed", error: message }).catch((err) => console.error("publish failure not recorded:", err));
    return { ok: false, error: message };
  }
}

/** Takes back a post Facebook is holding, before its time. It can be scheduled again after. */
export async function cancelScheduled(id: string): Promise<PublishResult> {
  if (!(await unlocked())) return { ok: false, error: "ใส่ PIN ก่อน", needPin: true };
  const item = await getContent(id).catch(() => null);
  const p = item?.publish;
  if (!item || !p || p.state !== "scheduled" || !p.postId || !p.pageId) return { ok: false, error: "ชิ้นนี้ไม่ได้ตั้งเวลาไว้" };
  if (p.at && new Date(p.at).getTime() <= Date.now()) return { ok: false, error: "ถึงเวลาโพสต์ไปแล้ว ยกเลิกไม่ได้ — ลบโพสต์ในเพจแทน" };
  const token = await pageToken(p.pageId);
  if (!token) return { ok: false, error: "ไม่พบการเชื่อมต่อของเพจนี้" };
  try {
    await deletePost(p.postId, token);
    return { ok: true, item: await recordPublish(id, { state: "cancelled", postId: null, at: null }) };
  } catch (e) {
    if (!(e instanceof PublishError)) console.error("content cancel failed:", e);
    return { ok: false, error: e instanceof PublishError ? e.message : "ยกเลิกไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}

/** The calendar's pieces: posted or held between two moments. */
export async function publishedBetween(fromIso: string, toIso: string): Promise<ContentItem[]> {
  const from = new Date(fromIso);
  const to = new Date(toIso);
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return [];
  return listPublished(from, to).catch((e) => {
    console.error("content calendar failed:", e);
    return [];
  });
}
