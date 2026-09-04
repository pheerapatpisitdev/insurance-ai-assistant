import { Card, Empty, Stat } from "../ui";
import { ConversationList } from "@/components/ConversationList";
import { channelActivity, recentConversations } from "@/lib/chat/history";
import { lineStatus } from "@/lib/line/status";

export const dynamic = "force-dynamic";

const CHAT_MODE: Record<string, string> = {
  chat: "แชทแบบแมนนวล — คนตอบเองได้ใน OA Manager และบอทตอบด้วย",
  bot: "บอทอย่างเดียว — คนตอบเองใน OA Manager ไม่ได้",
};

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b py-2 text-sm last:border-0">
      <span className="w-40 shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-all">{children}</span>
    </div>
  );
}

function Yes({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span className={ok ? "text-emerald-700" : "text-red-700"}>
      {ok ? "✓ " : "✗ "}
      {ok ? yes : no}
    </span>
  );
}

export default async function LineAdminPage() {
  const [status, conversations, activity] = await Promise.all([
    lineStatus(),
    recentConversations("line"),
    channelActivity("line"),
  ]);

  return (
    <>
      <Card title="สถานะบัญชี LINE" hint="อ่านสดจาก LINE ทุกครั้งที่เปิดหน้านี้ ไม่ใช่ค่าที่จำไว้">
        {!status.configured ? (
          <Empty>ยังไม่ได้เชื่อมต่อ LINE</Empty>
        ) : (
          <div>
            <Row label="ชื่อบัญชี">{status.displayName ?? "—"}</Row>
            <Row label="LINE ID">{status.basicId ?? "—"}</Row>
            <Row label="โหมดการตอบ">
              {status.chatMode ? (CHAT_MODE[status.chatMode] ?? status.chatMode) : "—"}
            </Row>
            <Row label="Webhook">
              {status.webhookActive === undefined ? "—" : (
                <Yes ok={status.webhookActive} yes="เปิดใช้งาน บอทรับข้อความได้" no="ปิดอยู่ บอทจะไม่ได้รับข้อความ" />
              )}
            </Row>
            <Row label="ปลายทาง">{status.endpoint ?? "—"}</Row>
            <Row label="โควตาข้อความ">
              {status.quota === null
                ? "ไม่จำกัด"
                : status.quota !== undefined
                  ? `${status.quotaUsed?.toLocaleString("en-US") ?? "?"} จาก ${status.quota.toLocaleString("en-US")} ข้อความ`
                  : "—"}
            </Row>
          </div>
        )}
        {status.errors.map((e) => (
          <p key={e} className="mt-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{e}</p>
        ))}
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
