import { Card, Empty, Stat } from "../ui";
import { ConversationList } from "@/components/ConversationList";
import { channelActivity, recentConversations } from "@/lib/chat/history";
import { facebookStatus } from "@/lib/facebook/status";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b py-2 text-sm last:border-0">
      <span className="w-40 shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-all">{children}</span>
    </div>
  );
}

export default async function MessengerAdminPage() {
  const [status, conversations, activity] = await Promise.all([
    facebookStatus(),
    recentConversations("facebook"),
    channelActivity("facebook"),
  ]);

  return (
    <>
      <Card title="สถานะเพจ Facebook" hint="อ่านสดจาก Meta ทุกครั้งที่เปิดหน้านี้">
        {!status.configured ? (
          <Empty>ยังไม่ได้เชื่อมต่อ Facebook</Empty>
        ) : (
          <div>
            <Row label="การตอบข้อความ">
              {status.messagingOk ? (
                <span className="text-emerald-700">✓ โทเค็นเพจใช้งานได้ บอทส่งและรับข้อความได้</span>
              ) : (
                <span className="text-red-700">✗ โทเค็นเพจใช้งานไม่ได้ บอทตอบใครไม่ได้เลย</span>
              )}
            </Row>
            <Row label="ชื่อเพจ">{status.pageName ?? "—"}</Row>
            <Row label="รหัสเพจ">{status.pageId ?? "—"}</Row>
            <Row label="การรับข้อมูล">
              {status.subscribed === undefined ? "—" : status.subscribed ? (
                <span className="text-emerald-700">✓ เพจส่งข้อมูลมาที่แอปนี้แล้ว</span>
              ) : (
                <span className="text-red-700">✗ เพจยังไม่ได้ส่งข้อมูลมาที่แอปนี้ บอทจะไม่ได้รับข้อความ</span>
              )}
            </Row>
            <Row label="เหตุการณ์ที่รับ">{status.fields?.length ? status.fields.join(", ") : "—"}</Row>
          </div>
        )}
        {status.errors.map((e) => (
          <p key={e} className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{e}</p>
        ))}
        {status.notes.map((n) => (
          <p key={n} className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">{n}</p>
        ))}
      </Card>

      <Card title="ข้อจำกัดที่ยังมีอยู่" hint="เรื่องที่ Meta กำหนด ไม่ใช่ข้อจำกัดของระบบเรา">
        <p className="text-sm text-slate-700">
          ตอนนี้บอทตอบได้เฉพาะคนที่มีบทบาทในแอป (แอดมิน ผู้พัฒนา ผู้ทดสอบ) ลูกค้าทั่วไปทักมาแล้วจะไม่ได้รับคำตอบ
          จนกว่าจะผ่าน App Review ของ Meta ซึ่งต้องยืนยันธุรกิจก่อน รายละเอียดและข้อความที่เตรียมไว้สำหรับยื่น
          อยู่ในไฟล์ <code className="rounded bg-slate-100 px-1">docs/facebook-app-review.md</code> ในโปรเจกต์
        </p>
        <p className="mt-2 text-sm text-slate-700">
          ระหว่างนี้เพิ่มคนให้ทดสอบได้ที่ App Dashboard → บทบาทในแอพ ส่วน LINE ไม่มีข้อจำกัดนี้ ลูกค้าทุกคนใช้ได้แล้ว
        </p>
      </Card>

      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <Stat label="ข้อความที่รับมาแล้ว" value={activity.events.toLocaleString("en-US")} sub="นับตั้งแต่เปิดใช้งาน" />
        <Stat
          label="ข้อความล่าสุด"
          value={activity.latest ? new Date(activity.latest).toLocaleString("th-TH", { dateStyle: "short", timeStyle: "short" }) : "—"}
          sub={activity.latest ? undefined : "ยังไม่มีใครทักเข้ามา"}
        />
      </div>

      <Card title="บทสนทนาล่าสุด" hint="เก็บไว้ 24 ชั่วโมงตามนโยบายความเป็นส่วนตัว">
        <ConversationList items={conversations} />
      </Card>
    </>
  );
}
