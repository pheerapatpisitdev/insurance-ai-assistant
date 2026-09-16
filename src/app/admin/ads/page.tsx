import { listAds } from "./actions";
import { AdTable, AddAd } from "./AdTable";
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
  const rows = await listAds();
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

      <Card title="วิธีที่ไม่ต้องมาตั้งค่าเลย" hint="ใช้ได้กับโฆษณาแบบส่งข้อความทุกตัว">
        <p className="text-sm leading-relaxed text-slate-700">
          ใส่ <code className="rounded bg-slate-100 px-1">?ref=lifeprotect</code> หรือ{" "}
          <code className="rounded bg-slate-100 px-1">?ref=ihealthy</code> ต่อท้ายลิงก์ m.me ของโฆษณา
          เช่น <code className="rounded bg-slate-100 px-1">m.me/ชื่อเพจของคุณ?ref=lifeprotect</code>{" "}
          — บอทจะรู้ทันทีตั้งแต่ข้อความแรก โดยไม่ต้องรอสถิติและไม่ต้องมาจับคู่ในหน้านี้
        </p>
      </Card>
    </>
  );
}
