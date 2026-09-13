"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { clearConnection, clearPending, pageConnection, pageToken, readPending, saveConnection } from "@/lib/facebook/connection";
import { listPages, subscribePage, unsubscribePage } from "@/lib/facebook/oauth";

/** Finishes a login where the person admins more than one Page. */
export async function connectPage(pageId: string) {
  await requireAdmin();
  const pending = await readPending();
  if (!pending) throw new Error("การเชื่อมต่อหมดอายุแล้ว กดเชื่อมต่อกับ Facebook ใหม่อีกครั้ง");

  const page = (await listPages(pending.token)).find((p) => p.id === pageId);
  if (!page) throw new Error("ไม่พบเพจนี้ในบัญชีที่เพิ่งเข้าสู่ระบบ");

  const fields = await subscribePage(page);
  await saveConnection({
    pageId: page.id, pageName: page.name, token: page.accessToken, scopes: pending.scopes, fields,
  });
  await clearPending();
  revalidatePath("/admin/messenger");
}

/**
 * Stops the Page sending its messages here before forgetting the token — in that order,
 * because a forgotten token cannot unsubscribe anything.
 */
export async function disconnectPage() {
  await requireAdmin();
  const [connection, token] = await Promise.all([pageConnection(), pageToken()]);
  if (connection && token) {
    try {
      await unsubscribePage(connection.pageId, token);
    } catch {
      // Meta may have revoked the token already; the local half still has to be cleared
    }
  }
  await clearConnection();
  revalidatePath("/admin/messenger");
}

export async function cancelPending() {
  await requireAdmin();
  await clearPending();
  revalidatePath("/admin/messenger");
}


/**
 * Re-asks Meta for the webhook events this build handles. Needed once after the list grows —
 * a Page connected before the echo field was added still sends messages only, and the bot
 * would go on answering threads the agent had already picked up.
 */
export async function refreshSubscription() {
  await requireAdmin();
  const [connection, token] = await Promise.all([pageConnection(), pageToken()]);
  if (!connection || !token) throw new Error("ยังไม่ได้เชื่อมต่อเพจ Facebook");
  const fields = await subscribePage({ id: connection.pageId, name: connection.pageName, accessToken: token });
  await saveConnection({
    pageId: connection.pageId, pageName: connection.pageName, token, scopes: connection.scopes, fields,
  });
  revalidatePath("/admin/messenger");
}
