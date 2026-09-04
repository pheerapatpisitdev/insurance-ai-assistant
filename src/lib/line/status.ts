/**
 * What LINE itself says about the account, read live rather than remembered. A back office
 * that only shows what was configured cannot tell you the webhook was switched off an hour
 * ago; asking LINE can.
 */

const API = "https://api.line.me/v2/bot";

export interface LineStatus {
  configured: boolean;
  displayName?: string;
  basicId?: string;
  /** "chat" when a person answers in OA Manager, "bot" when only the API does */
  chatMode?: string;
  endpoint?: string;
  webhookActive?: boolean;
  /** null when the plan does not cap outgoing messages */
  quota?: number | null;
  quotaUsed?: number;
  errors: string[];
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json() as Promise<T>;
}

export async function lineStatus(): Promise<LineStatus> {
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  if (!token) return { configured: false, errors: ["ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN"] };

  const status: LineStatus = { configured: true, errors: [] };
  // each call stands on its own: one failing endpoint should not blank the whole page
  const [info, hook, quota, used] = await Promise.allSettled([
    get<{ displayName: string; basicId: string; chatMode: string }>("/info", token),
    get<{ endpoint: string; active: boolean }>("/channel/webhook/endpoint", token),
    get<{ type: string; value?: number }>("/message/quota", token),
    get<{ totalUsage: number }>("/message/quota/consumption", token),
  ]);

  if (info.status === "fulfilled") {
    status.displayName = info.value.displayName;
    status.basicId = info.value.basicId;
    status.chatMode = info.value.chatMode;
  } else status.errors.push(`อ่านข้อมูลบัญชีไม่ได้: ${info.reason}`);

  if (hook.status === "fulfilled") {
    status.endpoint = hook.value.endpoint;
    status.webhookActive = hook.value.active;
  } else status.errors.push(`อ่านค่า webhook ไม่ได้: ${hook.reason}`);

  if (quota.status === "fulfilled") status.quota = quota.value.value ?? null;
  if (used.status === "fulfilled") status.quotaUsed = used.value.totalUsage;

  return status;
}
