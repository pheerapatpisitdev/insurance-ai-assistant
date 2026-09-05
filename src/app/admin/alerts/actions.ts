"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin/guard";
import { expiryFrom, makeCode } from "@/lib/alerts/register";
import { alertSettings, saveAlertSettings, type LeadsMode } from "@/lib/alerts/settings";
import { alert } from "@/lib/alerts/send";

/** Makes the short code the owner sends to the OA so the bot learns where to push. */
export async function startRegistration(): Promise<string> {
  await requireAdmin();
  const code = makeCode();
  await saveAlertSettings({ pending_code: code, pending_until: expiryFrom() });
  revalidatePath("/admin/alerts");
  return code;
}

export async function stopAlerts() {
  await requireAdmin();
  await saveAlertSettings({ line_user_id: null, label: null, pending_code: null, pending_until: null });
  revalidatePath("/admin/alerts");
}

export async function setLeadsMode(mode: LeadsMode) {
  await requireAdmin();
  await saveAlertSettings({ leads_mode: mode });
  revalidatePath("/admin/alerts");
}

export async function setMonthlyCap(cap: number) {
  await requireAdmin();
  if (!Number.isInteger(cap) || cap < 0 || cap > 300) throw new Error("ตั้งได้ 0-300 ข้อความต่อเดือน");
  await saveAlertSettings({ monthly_cap: cap });
  revalidatePath("/admin/alerts");
}

/** Proves the whole path works, from this page to the phone in the owner's pocket. */
export async function sendTestAlert(): Promise<string> {
  await requireAdmin();
  const { lineUserId } = await alertSettings();
  if (!lineUserId) return "ยังไม่ได้ผูกบัญชี LINE";
  const outcome = await alert("test", "🔔 ทดสอบการแจ้งเตือน ระบบส่งถึงคุณได้แล้วครับ");
  revalidatePath("/admin/alerts");
  return { sent: "ส่งแล้ว ดูใน LINE ได้เลย", capped: "ส่งไม่ได้ ใช้โควตาเดือนนี้ครบแล้ว", "no-target": "ยังไม่ได้ผูกบัญชี LINE", failed: "ส่งไม่สำเร็จ ดูรายละเอียดใน log" }[outcome];
}
