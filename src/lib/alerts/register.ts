import { alertSettings, saveAlertSettings } from "./settings";

/**
 * Learning where to send alerts.
 *
 * A push message needs the owner's LINE userId, which no dashboard shows. So the back office
 * makes a short code, the owner sends it to the OA, and the webhook recognises it — the same
 * account that received the code proves it is the one to notify. The code lasts ten minutes.
 */

const CODE_PREFIX = "ALERT-";
const TTL_MS = 10 * 60 * 1000;

/** A code that cannot be confused with a customer's question, or with 0/O and 1/I. */
export function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `${CODE_PREFIX}${code}`;
}

export function expiryFrom(now = Date.now()): string {
  return new Date(now + TTL_MS).toISOString();
}

export function codeIsLive(code: string | null, until: string | null, now = Date.now()): boolean {
  return Boolean(code && until && Date.parse(until) > now);
}

/** Whether a message looks like someone answering the registration prompt at all. */
export function looksLikeCode(text: string): boolean {
  return text.trim().toUpperCase().startsWith(CODE_PREFIX);
}

/**
 * The reply to send when a message is a registration code, or null when it is an ordinary
 * question that should go to the assistant.
 */
export async function registrationReply(text: string, lineUserId: string): Promise<string | null> {
  if (!looksLikeCode(text)) return null;
  const settings = await alertSettings();
  if (!codeIsLive(settings.pendingCode, settings.pendingUntil)) {
    return "รหัสนี้หมดอายุแล้วครับ กดขอรหัสใหม่ในหน้าหลังบ้าน แล้วส่งมาภายใน 10 นาที";
  }
  if (text.trim().toUpperCase() !== settings.pendingCode) {
    return "รหัสไม่ตรงครับ ลองคัดลอกจากหน้าหลังบ้านอีกครั้ง";
  }
  await saveAlertSettings({ line_user_id: lineUserId, pending_code: null, pending_until: null });
  return "ตั้งค่าเรียบร้อยครับ ต่อจากนี้จะแจ้งเตือนลูกค้าใหม่และปัญหาระบบมาที่แชทนี้";
}
