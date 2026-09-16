import { listAds } from "./actions";
import { AdTable, AddAd } from "./AdTable";
import { RefLinks } from "./RefLinks";
import { pageConnection } from "@/lib/facebook/connection";
import { Card } from "../ui";

export const dynamic = "force-dynamic";

/**
 * What each advertisement sells, so the bot can open on it.
 *
 * Most advertisements never need a row here — the bot reads the m.me link's ref, the button's
 * payload, or the advertisement's own name, and is right. This page is for the one called
 * "โปรโมชั่นเดือนนี้", and for the campaign that goes live today and would otherwise spend a
 * week asking its own customers which plan they came about.
 */
export default async function AdsPage() {
  const [rows, connection] = await Promise.all([listAds(), pageConnection()]);
  const paired = rows.filter((r) => r.paired).length;
  const unread = rows.filter((r) => !r.paired && !r.read).length;

  return (
    <>
      <Card
        title="จับคู่โฆษณากับแบบประกัน"
        hint={
          "ลูกค้าที่กดมาจากโฆษณาบอกไปแล้วว่าสนใจอะไร บอทจะได้ไม่ต้องถามซ้ำ — "
          + "ปกติบอทอ่านเองจากชื่อโฆษณาหรือจาก ref ในลิงก์ หน้านี้ไว้แก้เฉพาะตัวที่อ่านไม่ออก"
        }
      >
        <p className="mb-3 text-xs text-slate-500">
          จับคู่ไว้แล้ว {paired} รายการ
          {unread > 0 && ` · อีก ${unread} รายการที่ชื่ออ่านไม่ออกว่าขายแบบไหน`}
        </p>
        <AdTable rows={rows} />
      </Card>

      <Card
        title="เพิ่มโฆษณาเอง"
        hint="สำหรับแคมเปญที่เพิ่งเริ่ม ยังไม่มีใครทักเข้ามาและสถิติยังไม่เข้า — รหัสโฆษณาดูได้จาก Ads Manager"
      >
        <AddAd />
      </Card>

      <Card
        title="ลิงก์พร้อมใช้ของเพจคุณ"
        hint="ก๊อปไปวางได้เลย บอทจะรู้ตั้งแต่ข้อความแรกว่าลูกค้ามาเรื่องแบบไหน โดยไม่ต้องจับคู่ในหน้านี้"
      >
        <RefLinks pageId={connection?.pageId ?? null} />
        <div className="mt-4 border-t pt-3 text-sm leading-relaxed text-slate-700">
          <p className="font-medium">วางที่ไหนได้บ้าง</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-slate-600">
            <li>ปุ่ม “ส่งข้อความ” บนหน้าเพจ · ลิงก์ในไบโอ · โพสต์ · QR code — ใช้ได้ทันที</li>
            <li>
              โฆษณาแบบ “ส่งข้อความ” (Click to Messenger): ฟอร์มใน Ads Manager
              <strong> มักไม่มีช่องให้ใส่ ref</strong> — กรณีนี้ Facebook จะส่ง <em>รหัสโฆษณา</em> มาแทน
              ให้ใช้การจับคู่ด้านบน หรือตั้งชื่อโฆษณาให้มีชื่อแบบประกันอยู่ในนั้น
            </li>
          </ul>
        </div>
      </Card>
    </>
  );
}
