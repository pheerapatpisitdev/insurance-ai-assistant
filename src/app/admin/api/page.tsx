import { listKeys } from "./actions";
import { Keys } from "./Keys";
import { Card } from "../ui";
import { siteUrl } from "@/lib/site-url";

export const dynamic = "force-dynamic";

/**
 * The system's own API: who may call it, and how.
 *
 * The example is on the page because a key without a working request beside it is a puzzle,
 * and because this is where somebody will be standing when they need it — pasting into a
 * partner's brief, or into a model that is about to call it.
 */
export default async function ApiPage() {
  const rows = await listKeys();
  const base = siteUrl("/api/v1");

  return (
    <>
      <Card
        title="กุญแจ API"
        hint="ให้ระบบอื่นเรียกเครื่องคิดเบี้ยของเราได้ — หนึ่งกุญแจต่อหนึ่งผู้ใช้ จะได้ปิดทีละอันและดูได้ว่าใครใช้เท่าไหร่"
      >
        <Keys rows={rows} />
      </Card>

      <Card title="เรียกยังไง" hint="ส่งกุญแจใน header ทุกครั้ง">
        <pre className="overflow-x-auto rounded bg-slate-900 p-3 text-xs leading-relaxed text-slate-100">
{`# แบบประกันทั้งหมด + ช่วงอายุ + ทุนขั้นต่ำ
curl ${base}/plans \\
  -H "Authorization: Bearer <กุญแจของคุณ>"

# คิดเบี้ย
curl -X POST ${base}/quote \\
  -H "Authorization: Bearer <กุญแจของคุณ>" \\
  -H "Content-Type: application/json" \\
  -d '{"plan":"PLB","variant":"PLB10","age":35,"sex":"M","sumAssured":1000000}'`}
        </pre>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>ทุกคำตอบติด <code className="rounded bg-slate-100 px-1">version</code> และ <code className="rounded bg-slate-100 px-1">expiresOn</code> ของตารางเบี้ยมาด้วย — ถ้าตารางหมดอายุ <code className="rounded bg-slate-100 px-1">expired</code> จะเป็น true</li>
          <li>เงื่อนไขที่บริษัทไม่รับ ตอบ <strong>422</strong> พร้อมเหตุผล ไม่ใช่ตอบเลข 0</li>
          <li>ใช้ครบโควตาเดือนนั้น ตอบ <strong>429</strong> · กุญแจผิดหรือถูกปิด ตอบ <strong>401/403</strong></li>
          <li>ตัวเลขเป็นบาทเต็มจำนวน และมี <code className="rounded bg-slate-100 px-1">disclaimer</code> ติดมาเสมอ — ต้องแสดงให้ลูกค้าเห็นด้วย</li>
        </ul>
      </Card>
    </>
  );
}
