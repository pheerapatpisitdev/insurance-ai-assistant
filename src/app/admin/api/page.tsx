import { listKeys } from "./actions";
import { Keys } from "./Keys";
import { Card } from "../ui";
import { siteUrl } from "@/lib/site-url";
import { isSignedIn } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

/**
 * The system's own API: who may call it, and how.
 *
 * The example is on the page because a key without a working request beside it is a puzzle,
 * and because this is where somebody will be standing when they need it — pasting into a
 * partner's brief, or into a model that is about to call it.
 */
export default async function ApiPage() {
  /**
   * No session, nothing to read.
   *
   * The layout has the PIN box up already — a page renders beside its layout, not after it —
   * and the loaders below all throw at a missing session. That throw reached the browser as
   * Next's error screen: an owner whose twelve hours had run out was told the back office had
   * broken rather than being asked for the PIN. The actions still throw; they are a network
   * boundary and this is a screen.
   */
  if (!(await isSignedIn())) return null;

  const rows = await listKeys();
  const base = siteUrl("/api/v1");

  return (
    <>
      <Card
        title="กุญแจ API"
        hint="ให้ระบบอื่นเรียกเครื่องคิดเบี้ยของเราได้ — หนึ่งกุญแจต่อหนึ่งผู้ใช้ จะได้ปิดทีละอันและดูได้ว่าใครใช้เท่าไหร่"
      >
        <Keys rows={rows} mcpBase={siteUrl("/api/v1/mcp")} />
      </Card>

      <Card
        title="ต่อกับ Claude หรือ ChatGPT"
        hint="กุญแจเดียวกัน ใช้ได้ทั้งสองทาง — ตัวเลขที่ได้เป็นตัวเลขเดียวกับที่หน้าเว็บคิด"
      >
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="font-medium text-slate-800">Claude — เพิ่มเป็น connector</dt>
            <dd className="mt-1 text-slate-600">
              ใช้ที่อยู่ที่มีกุญแจต่อท้าย ซึ่งจะแสดงให้ตอนสร้างกุญแจ:
              <code className="mt-1 block overflow-x-auto rounded bg-slate-100 px-2 py-1.5 text-xs text-slate-800">
                {siteUrl("/api/v1/mcp")}/&lt;กุญแจของคุณ&gt;
              </code>
              <span className="mt-1 block text-xs text-slate-500">
                Claude จะเห็นเครื่องมือ 2 ตัว: ดูรายการแบบประกัน และคิดเบี้ย ·
                ช่อง connector ของ Claude รับแต่ที่อยู่ ไม่มีที่ให้ใส่กุญแจแยก กุญแจจึงอยู่ในที่อยู่
              </span>
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-800">ChatGPT — สร้าง Custom GPT แล้วเพิ่ม Action</dt>
            <dd className="mt-1 text-slate-600">
              วางที่อยู่นี้ในช่อง schema แล้วตั้ง Authentication เป็น API Key แบบ Bearer
              <code className="mt-1 block overflow-x-auto rounded bg-slate-100 px-2 py-1.5 text-xs text-slate-800">
                {siteUrl("/api/v1/openapi.json")}
              </code>
              <span className="mt-1 block text-xs text-slate-500">
                ที่อยู่นี้เปิดอ่านได้โดยไม่ต้องใช้กุญแจ เพราะเป็นแค่คำอธิบาย ไม่มีข้อมูล — ตัว API ยังต้องใช้กุญแจเหมือนเดิม
              </span>
            </dd>
          </div>
        </dl>
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-900">
          คำอธิบายเครื่องมือสั่ง AI ไว้แล้วว่า <strong>ห้ามปัดเศษ ห้ามคำนวณต่อ</strong> และ
          <strong> ต้องแสดงคำกำกับให้ผู้ใช้เห็นทุกครั้ง</strong> — และถ้าบริษัทไม่รับประกันตามเงื่อนไขที่ถาม
          AI จะได้รับเป็น &ldquo;ข้อผิดพลาด&rdquo; พร้อมเหตุผล ไม่ใช่ตัวเลข จะได้ไม่เอาไปเสนอเป็นราคา
        </p>
      </Card>

      <Card title="เรียกตรงๆ ด้วย HTTP" hint="ส่งกุญแจใน header ทุกครั้ง">
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
