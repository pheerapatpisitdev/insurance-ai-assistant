/**
 * What Meta says about the Page this bot answers for. The webhook URL is not readable with a
 * page token, so what can be checked is the more useful half anyway: whether the Page still
 * has this app subscribed, and to which events.
 */

const GRAPH = "https://graph.facebook.com/v23.0";

export interface FacebookStatus {
  configured: boolean;
  pageName?: string;
  pageId?: string;
  /** the app is subscribed to this Page's events */
  subscribed?: boolean;
  fields?: string[];
  errors: string[];
}

async function get<T>(path: string, token: string): Promise<T> {
  const res = await fetch(`${GRAPH}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${path} ${res.status}: ${(await res.text()).slice(0, 120)}`);
  return res.json() as Promise<T>;
}

export async function facebookStatus(): Promise<FacebookStatus> {
  const token = process.env.FB_PAGE_ACCESS_TOKEN;
  if (!token) return { configured: false, errors: ["ยังไม่ได้ตั้งค่า FB_PAGE_ACCESS_TOKEN"] };

  const status: FacebookStatus = { configured: true, errors: [] };
  const [page, subs] = await Promise.allSettled([
    get<{ id: string; name: string }>("/me?fields=id,name", token),
    get<{ data: { name: string; subscribed_fields?: string[] }[] }>("/me/subscribed_apps", token),
  ]);

  if (page.status === "fulfilled") {
    status.pageId = page.value.id;
    status.pageName = page.value.name;
  } else status.errors.push(`อ่านข้อมูลเพจไม่ได้: ${page.reason}`);

  if (subs.status === "fulfilled") {
    const apps = subs.value.data ?? [];
    status.subscribed = apps.length > 0;
    status.fields = apps.flatMap((a) => a.subscribed_fields ?? []);
  } else status.errors.push(`อ่านการสมัครรับข้อมูลไม่ได้: ${subs.reason}`);

  return status;
}
