import { Card, Empty, Stat } from "../ui";
import { alertSettings, recentAlerts, sentThisMonth } from "@/lib/alerts/settings";
import { codeIsLive } from "@/lib/alerts/register";
import { CapField, ModePicker, RegisterPanel, TestButton } from "./AlertsClient";

export const dynamic = "force-dynamic";

const KIND_TH: Record<string, string> = { lead: "ลูกค้าใหม่", health: "ปัญหาระบบ", test: "ทดสอบ" };

export default async function AlertsAdminPage() {
  const [settings, sent, log] = await Promise.all([alertSettings(), sentThisMonth(), recentAlerts()]);
  const pending = codeIsLive(settings.pendingCode, settings.pendingUntil) ? settings.pendingCode : null;
  const connected = Boolean(settings.lineUserId);

  return (
    <>
      <Card title="แจ้งเตือนเข้า LINE" hint="ส่งหาคุณเอง ไม่เกี่ยวกับข้อความที่ลูกค้าได้รับ">
        <RegisterPanel connected={connected} pending={pending} />
        {connected && <div className="mt-3"><TestButton /></div>}
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Stat label="ส่งไปแล้วเดือนนี้" value={`${sent} / ${settings.monthlyCap}`}
              sub={"LINE ให้ส่งฟรีเดือนละ 300 ข้อความ"} />
        <Stat label="สถานะ" value={connected ? "พร้อมแจ้งเตือน" : "ยังไม่ได้ผูกบัญชี"}
              sub={connected ? undefined : "กดขอรหัสด้านบนเพื่อเริ่ม"} />
      </div>

      <Card title="แจ้งเมื่อมีลูกค้าใหม่" hint="นับหนึ่งครั้งต่อหนึ่งบทสนทนา ถามซ้ำหลายรอบไม่แจ้งซ้ำ">
        <ModePicker value={settings.leadsMode} />
        <div className="mt-4 border-t pt-3"><CapField value={settings.monthlyCap} /></div>
        <p className="mt-3 text-xs text-slate-500">
          ข้อความแจ้งเตือนบอกแค่ว่าลูกค้าถามอะไรและบอทตอบอะไร ไม่มีชื่อหรือข้อมูลที่ระบุตัวตน
          เพราะระบบเก็บผู้ใช้เป็นรหัสแฮชอยู่แล้ว
        </p>
      </Card>

      <Card title="แจ้งเมื่อระบบล่ม" hint="ต้องมีตัวเฝ้าจากข้างนอก เพราะแอปที่ล่มแล้วบอกตัวเองไม่ได้">
        <p className="text-sm text-slate-700">
          ให้ n8n หรือบริการเฝ้าเว็บ (เช่น UptimeRobot แบบฟรี) เรียก{" "}
          <code className="rounded bg-slate-100 px-1">/api/health</code> ทุก 5 นาที
          ถ้าได้ค่าอื่นที่ไม่ใช่ 200 ให้ยิงกลับมาที่{" "}
          <code className="rounded bg-slate-100 px-1">POST /api/alerts/notify</code>{" "}
          พร้อมหัวข้อ <code className="rounded bg-slate-100 px-1">x-alert-secret</code> แล้วข้อความจะเข้า LINE เส้นเดียวกับด้านบน
        </p>
        <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ตั้งตัวเฝ้าให้ชี้ไปที่{" "}
          <code className="rounded bg-amber-100 px-1">insurance-ai-assistant-pheerapatpisit.vercel.app</code>{" "}
          ไม่ใช่ advisortool.app เพราะโดเมนหลักเปิดระบบกันบอทของ Vercel อยู่ เครื่องยิงเข้าจะได้ 403 เสมอ
          และตัวเฝ้าจะเตือนผิดตลอด
        </p>
        <p className="mt-2 text-xs text-slate-500">วิธีตั้งค่าอยู่ในไฟล์ docs/alerts.md ในโปรเจกต์</p>
      </Card>

      <Card title="แจ้งเตือนล่าสุด" hint="เก็บไว้ดูว่าอะไรถูกส่งไปแล้วบ้าง">
        {log.length === 0 ? (
          <Empty>ยังไม่มีการแจ้งเตือน</Empty>
        ) : (
          <ul className="divide-y text-sm">
            {log.map((a, i) => (
              <li key={i} className="flex flex-wrap gap-x-3 py-2">
                <span className="w-24 shrink-0 text-slate-500">{KIND_TH[a.kind] ?? a.kind}</span>
                <span className="min-w-0 flex-1 break-words">{a.detail?.split("\n")[0]}</span>
                <span className="text-xs text-slate-400">
                  {new Date(a.sentAt).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
