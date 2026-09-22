import Link from "next/link";
import { Card, Empty, Stat } from "../ui";
import { loadAds } from "./actions";
import { AccountPicker } from "./AccountPicker";
import { SyncButton } from "./SyncButton";
import { DisconnectAdAccountButton } from "./DisconnectAdAccountButton";
import { ADS_SCOPES, adsOauthIsConfigured } from "@/lib/facebook/oauth";
import { OTHER_CAMPAIGN } from "@/lib/ads/summary";
import type { AdsRange, Tally } from "@/lib/ads/types";
import { siteOrigin } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * The advertising account, read-only.
 *
 * What the owner asked for was a way to see the ad account without opening Ads Manager, and
 * the one figure Ads Manager cannot show: what each customer in the CRM cost. Meta knows the
 * spend; this system knows who arrived, because the referral carried the ad's id. The join
 * is the page.
 */

const RANGES: { key: AdsRange; label: string }[] = [
  { key: "7d", label: "7 วัน" },
  { key: "30d", label: "30 วัน" },
];

const OUTCOMES: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  connected: { tone: "ok", text: "เชื่อมบัญชีโฆษณาแล้ว กด “ดึงตอนนี้” เพื่อเอาตัวเลขชุดแรกเข้ามา" },
  choose: { tone: "warn", text: "เข้าสู่ระบบ Facebook แล้ว เหลือเลือกบัญชีโฆษณา" },
  cancelled: { tone: "warn", text: "ยกเลิกจากหน้า Facebook ยังไม่ได้เชื่อมต่ออะไร" },
  state: { tone: "bad", text: "ลิงก์เชื่อมต่อหมดอายุแล้ว กดเชื่อมต่อใหม่อีกครั้ง" },
  noscope: { tone: "bad", text: "Facebook ไม่ได้ให้สิทธิ์ ads_read — ต้องเพิ่ม ads_read ใน Login Configuration บน Meta dashboard ก่อน (ดูขั้นตอนข้างล่าง)" },
  noaccounts: { tone: "bad", text: "บัญชี Facebook นี้ไม่มีสิทธิ์ดูบัญชีโฆษณาไหนเลย" },
  unconfigured: { tone: "bad", text: "ยังไม่ได้ตั้งค่าการเชื่อมบัญชีโฆษณา — ต้องมี FB_APP_ID, FB_APP_SECRET และ FB_ADS_LOGIN_CONFIG_ID" },
  failed: { tone: "bad", text: "เชื่อมต่อไม่สำเร็จ" },
};

const TONES = {
  ok: "bg-[var(--bot-ok-soft)] text-[var(--bot-ok)]",
  warn: "bg-[var(--bot-sand-soft)] text-[var(--bot-sand-ink)]",
  bad: "bg-[var(--bot-red-soft)] text-[var(--bot-red-ink)]",
};

/** Two days with nothing fetched is one missed cron plus a day of grace. */
const STALE_MS = 2 * 86_400_000;

const baht = (v: number) => `฿${Math.round(v).toLocaleString("en-US")}`;
const n = (v: number) => v.toLocaleString("en-US");
const per = (v: number | null) => (v === null ? "—" : baht(v));
const when = (iso: string) => new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });

function Setup() {
  return (
    <div className="mt-4 rounded-md bg-[var(--bot-sand-soft)] px-3 py-2 text-sm text-[var(--bot-sand-ink)]">
      <p className="font-medium">ก่อนกดเชื่อม ต้องทำบน Meta ครั้งเดียว:</p>
      <ol className="mt-1 list-decimal space-y-1 pl-5">
        <li>developers.facebook.com → แอปนี้ → กรณีการใช้งาน → เพิ่ม “วัดผลข้อมูลประสิทธิภาพของโฆษณาด้วย API การตลาด”</li>
        <li>Facebook Login for Business → Configurations → สร้าง config <strong>ใหม่แยกต่างหาก</strong> สิทธิ์ <code>ads_read</code> อย่างเดียว แล้วเอา ID ไปใส่ <code>FB_ADS_LOGIN_CONFIG_ID</code> — ห้ามใช้ config เดียวกับเพจ เพราะการล็อกอินใหม่ผ่าน config ของเพจจะถอนสิทธิ์เพจที่ไม่ได้ติ๊ก</li>
        <li>เข้าสู่ระบบด้วยบัญชี Facebook ที่เป็นผู้ดูแลบัญชีโฆษณาที่ยิง Life Protect / iHealthy</li>
        <li>ถ้า Meta ขอ Business Verification ระหว่างทาง ต้องทำก่อนถึงจะเห็นบัญชี</li>
      </ol>
      <p className="mt-1 text-xs">สิทธิ์ที่ขอ: {ADS_SCOPES.join(", ")} — อ่านอย่างเดียว หน้านี้ปรับแอดไม่ได้</p>
    </div>
  );
}

function ConnectButton() {
  return adsOauthIsConfigured() ? (
    <a href="/api/facebook/connect?for=ads" className="inline-block rounded-md bg-[#0866FF] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#0653cc]">
      เชื่อมบัญชีโฆษณา
    </a>
  ) : (
    <div className="rounded-md border border-dashed px-3 py-5 text-center">
      <p className="text-sm text-[var(--bot-ink-foot)]">ต่อจากเครื่องนี้ไม่ได้ — Facebook ยอมให้ต่อจากเว็บจริงเท่านั้น</p>
      <a href={`${siteOrigin()}/admin/ads`} className="mt-3 inline-block rounded-md bg-[#0866FF] px-4 py-2 text-sm font-medium text-white no-underline hover:bg-[#0653cc]">
        ไปเชื่อมที่เว็บจริง →
      </a>
    </div>
  );
}

function Cells({ t }: { t: Tally }) {
  return (
    <>
      <td className="px-2 py-1.5 text-right tabular-nums">{baht(t.spend)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{n(t.reach)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{n(t.messagingStarted)}</td>
      <td className="px-2 py-1.5 text-right font-medium tabular-nums">{n(t.leads)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{per(t.costPerLead)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{n(t.priced)}</td>
      <td className="px-2 py-1.5 text-right tabular-nums">{n(t.formSent)}</td>
    </>
  );
}

export default async function AdsPage({ searchParams }: { searchParams: Promise<{ range?: string; fb?: string; detail?: string }> }) {
  const params = await searchParams;
  const range: AdsRange = params.range === "30d" ? "30d" : "7d";
  const outcome = OUTCOMES[params.fb ?? ""];
  const { accounts, choices, summary: figures, lastFetchedAt } = await loadAds(range);
  /**
   * Campaign names repeat across ad accounts — the agency has "มรดก" and "Life Protect x 2"
   * in more than one — so the account is what tells two identical-looking rows apart.
   */
  const accountName = new Map(accounts.map((a) => [a.id, a.name]));
  const connected = accounts.length > 0;
  const stale = lastFetchedAt !== null && Date.now() - new Date(lastFetchedAt).getTime() > STALE_MS;

  return (
    <div className="space-y-5">
      {outcome && (
        <p className={`rounded-md px-3 py-2 text-sm ${TONES[outcome.tone]}`}>
          {outcome.text}{params.detail ? ` — ${params.detail}` : ""}
        </p>
      )}

      <Card title="บัญชีโฆษณา" hint="อ่านอย่างเดียว ตัวเลขดึงจาก Meta วันละครั้งตอน 10:00">
        {choices.length > 0 ? (
          <AccountPicker accounts={choices} />
        ) : connected ? (
          <div className="space-y-4">
            {accounts.map((a) => (
              <div key={a.id} className="rounded-lg border border-[var(--bot-line)] p-3 text-sm">
                <p className="font-medium">{a.name} <span className="font-normal text-[var(--bot-ink-mute)]">{a.id}{a.currency ? ` · ${a.currency}` : ""}</span></p>
                <p className="mt-0.5 text-xs text-[var(--bot-ink-mute)]">เชื่อมเมื่อ {when(a.connectedAt)}</p>
                <div className="mt-3"><DisconnectAdAccountButton actId={a.id} /></div>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-4 border-t border-[var(--bot-line)] pt-4">
              <SyncButton />
              <p className="text-sm text-[var(--bot-ink-mute)]">
                {lastFetchedAt ? `ดึงล่าสุด ${when(lastFetchedAt)}` : "ยังไม่เคยดึง"}
                {stale && <span className="ml-2 rounded bg-[var(--bot-sand-soft)] px-2 py-0.5 text-xs text-[var(--bot-sand-ink)]">ข้อมูลค้าง</span>}
              </p>
              <a href="/api/facebook/connect?for=ads" className="text-sm underline">เชื่อมบัญชีเพิ่ม / เชื่อมใหม่</a>
            </div>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-[var(--bot-ink-foot)]">
              กดปุ่มแล้วเข้าสู่ระบบ Facebook ด้วยบัญชีที่ดูแลบัญชีโฆษณา ระบบจะขอสิทธิ์อ่านอย่างเดียวและเก็บให้เอง
            </p>
            <ConnectButton />
            <Setup />
          </div>
        )}
      </Card>

      {connected && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {RANGES.map((r) => (
              <Link
                key={r.key}
                href={`/admin/ads?range=${r.key}`}
                className={`rounded-md border px-3 py-1 text-sm no-underline ${r.key === range ? "border-[var(--bot-navy)] bg-[var(--bot-navy)] text-white" : "border-[var(--bot-line)] bg-white text-[var(--bot-ink-foot)]"}`}
              >
                {r.label}
              </Link>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Stat label="ใช้จ่าย" value={baht(figures.total.spend)} sub={figures.currency ?? undefined} />
            <Stat label="คนเห็น" value={n(figures.total.reach)} />
            <Stat label="คลิกลิงก์" value={n(figures.total.linkClicks)} />
            <Stat label="เริ่มแชท" value={n(figures.total.messagingStarted)} sub="ตามที่ Meta นับ" />
            <Stat label="ลูกค้าใน CRM" value={n(figures.total.leads)} sub="มาจากโฆษณา" />
            <Stat label="บาทต่อลูกค้า" value={per(figures.total.costPerLead)} />
          </div>

          <Card title="รายแคมเปญ" hint="กดชื่อแคมเปญเพื่อดูรายโฆษณา เรียงตามใช้จ่ายมากไปน้อย">
            {figures.campaigns.length === 0 ? (
              <Empty>ยังไม่มีตัวเลข กด “ดึงตอนนี้” หรือรอถึงพรุ่งนี้ 10:00</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-[var(--bot-ink-mute)]">
                    <tr>
                      <th className="px-2 py-1.5 text-left font-normal">แคมเปญ</th>
                      <th className="px-2 py-1.5 text-right font-normal">ใช้จ่าย</th>
                      <th className="px-2 py-1.5 text-right font-normal">คนเห็น</th>
                      <th className="px-2 py-1.5 text-right font-normal">เริ่มแชท</th>
                      <th className="px-2 py-1.5 text-right font-normal">ลูกค้า</th>
                      <th className="px-2 py-1.5 text-right font-normal">บาท/คน</th>
                      <th className="px-2 py-1.5 text-right font-normal">ได้ราคา</th>
                      <th className="px-2 py-1.5 text-right font-normal">ส่งฟอร์ม</th>
                    </tr>
                  </thead>
                  {figures.campaigns.map((c) => (
                    <tbody key={c.campaignId} className="border-t border-[var(--bot-line)]">
                      <tr className={c.campaignId === OTHER_CAMPAIGN ? "text-[var(--bot-ink-mute)]" : ""}>
                        <td className="px-2 py-1.5">
                          <details>
                            <summary className="cursor-pointer font-medium">
                              {c.name}
                              {c.accountId && accounts.length > 1 && (
                                <span className="ml-2 font-normal text-xs text-[var(--bot-ink-mute)]">
                                  {accountName.get(c.accountId) ?? c.accountId}
                                </span>
                              )}
                            </summary>
                            <ul className="mt-1 space-y-0.5 pl-3 text-xs text-[var(--bot-ink-foot)]">
                              {c.ads.map((a) => (
                                <li key={a.adId} className="flex flex-wrap justify-between gap-x-3">
                                  <span className="truncate">{a.name}</span>
                                  <span className="tabular-nums">{baht(a.spend)} · ลูกค้า {n(a.leads)} · {per(a.costPerLead)}/คน</span>
                                </li>
                              ))}
                            </ul>
                          </details>
                        </td>
                        <Cells t={c} />
                      </tr>
                    </tbody>
                  ))}
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
