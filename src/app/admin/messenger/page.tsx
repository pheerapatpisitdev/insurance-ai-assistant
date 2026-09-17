import { Card, Empty } from "../ui";
import { facebookStatus } from "@/lib/facebook/status";
import { pageConnections, readPending } from "@/lib/facebook/connection";
import { listPages, oauthIsConfigured, SCOPES, SUBSCRIBED_FIELDS } from "@/lib/facebook/oauth";
import { DisconnectButton } from "./DisconnectButton";
import { PagePicker, type Choice } from "./PagePicker";
import { RefreshSubscriptionButton } from "./RefreshSubscriptionButton";

export const dynamic = "force-dynamic";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-0.5 border-b py-2 text-sm last:border-0">
      <span className="w-40 shrink-0 text-slate-500">{label}</span>
      <span className="min-w-0 break-all">{children}</span>
    </div>
  );
}

const OUTCOMES: Record<string, { tone: "ok" | "warn" | "bad"; text: string }> = {
  connected: { tone: "ok", text: "เชื่อมต่อเพจเรียบร้อยแล้ว บอทเริ่มตอบข้อความได้ทันที" },
  choose: { tone: "warn", text: "เข้าสู่ระบบ Facebook แล้ว เหลือเลือกเพจที่จะให้บอทตอบ" },
  cancelled: { tone: "warn", text: "ยกเลิกจากหน้า Facebook ยังไม่ได้เชื่อมต่ออะไร" },
  state: { tone: "bad", text: "ลิงก์เชื่อมต่อหมดอายุแล้ว กดเชื่อมต่อใหม่อีกครั้ง" },
  nopages: { tone: "bad", text: "บัญชี Facebook นี้ไม่ได้เป็นแอดมินเพจไหนเลย" },
  unconfigured: { tone: "bad", text: "ยังไม่ได้ตั้งค่า FB_APP_ID กับ FB_APP_SECRET" },
  failed: { tone: "bad", text: "เชื่อมต่อไม่สำเร็จ" },
};

const TONES = {
  ok: "bg-emerald-50 text-emerald-800",
  warn: "bg-amber-50 text-amber-800",
  bad: "bg-red-50 text-red-700",
};

/** The Pages a half-finished login is waiting to choose between. */
async function pendingChoices(): Promise<Choice[]> {
  const pending = await readPending();
  if (!pending) return [];
  try {
    return (await listPages(pending.token)).map((p) => ({ id: p.id, name: p.name }));
  } catch {
    return [];
  }
}

export default async function MessengerAdminPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const outcome = OUTCOMES[String(params.fb ?? "")];
  const detail = typeof params.detail === "string" ? params.detail : undefined;

  const [status, connections, choices] = await Promise.all([
    facebookStatus(),
    pageConnections(),
    pendingChoices(),
  ]);

  return (
    <>
      {outcome && (
        <p className={`mb-4 rounded-md px-3 py-2 text-sm ${TONES[outcome.tone]}`}>
          {outcome.text}{detail ? ` — ${detail}` : ""}
        </p>
      )}

      <Card title="เพจที่บอทตอบให้" hint="เชื่อมต่อผ่านหน้า login ของ Facebook ไม่ต้องคัดลอกโทเค็นเอง">
        {choices.length > 0 ? (
          <PagePicker pages={choices} />
        ) : connections.length > 0 ? (
          /* One block per Page. It was written for exactly one because there could only be
             one — connecting a second overwrote the first without a word. */
          <div className="space-y-5">
            {connections.map((connection) => {
              const missingFields = SUBSCRIBED_FIELDS.filter((f) => !connection.fields.includes(f));
              return (
                <div key={connection.pageId} className="rounded-lg border border-slate-200 p-3">
                  <Row label="ชื่อเพจ"><span className="font-medium">{connection.pageName}</span></Row>
                  <Row label="รหัสเพจ">{connection.pageId}</Row>
                  <Row label="เชื่อมต่อเมื่อ">
                    {new Date(connection.connectedAt).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" })}
                  </Row>
                  <Row label="สิทธิ์ที่ได้รับ">{connection.scopes.join(", ") || "—"}</Row>
                  <Row label="เหตุการณ์ที่รับ">{connection.fields.join(", ") || "—"}</Row>
                  {missingFields.length > 0 && (
                    <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      ระบบรุ่นนี้ต้องรับเหตุการณ์ {missingFields.join(", ")} ด้วย ไม่งั้นปุ่มคำถามที่ลูกค้ากดจะไม่ถึงบอท
                      <span className="ml-3 inline-block"><RefreshSubscriptionButton pageId={connection.pageId} /></span>
                    </p>
                  )}
                  <div className="pt-3"><DisconnectButton pageId={connection.pageId} /></div>
                </div>
              );
            })}
            <p className="text-sm text-slate-600">
              ต่อเพจเพิ่มได้ — กดเชื่อมต่อกับ Facebook อีกครั้งแล้วเลือกเพจอื่น เพจที่ต่อไว้แล้วจะไม่หาย
            </p>
          </div>
        ) : (
          <div>
            <p className="mb-3 text-sm text-slate-700">
              กดปุ่มแล้วเข้าสู่ระบบ Facebook ด้วยบัญชีที่เป็นแอดมินเพจ ระบบจะขอสิทธิ์เท่าที่จำเป็น
              เก็บโทเค็นให้เอง และสมัครรับข้อความจากเพจให้เสร็จในขั้นตอนเดียว
            </p>
            {oauthIsConfigured() ? (
              <a
                href="/api/facebook/connect"
                className="inline-block rounded-md bg-[#0866FF] px-4 py-2 text-sm font-medium text-white hover:bg-[#0653cc]"
              >
                เชื่อมต่อกับ Facebook
              </a>
            ) : (
              <Empty>ยังตั้งค่า FB_APP_ID กับ FB_APP_SECRET ไม่ครบ</Empty>
            )}
            <p className="mt-3 text-xs text-slate-500">สิทธิ์ที่ขอ: {SCOPES.join(", ")}</p>
          </div>
        )}
      </Card>

      <Card title="สถานะจาก Meta" hint="อ่านสดทุกครั้งที่เปิดหน้านี้">
        {!status.configured ? (
          <Empty>ยังไม่ได้เชื่อมต่อ Facebook</Empty>
        ) : (
          <div>
            <Row label="การตอบข้อความ">
              {status.messagingOk === undefined ? (
                <span className="text-amber-800">ตรวจไม่ได้ชั่วคราว</span>
              ) : status.messagingOk ? (
                <span className="text-emerald-700">✓ โทเค็นเพจใช้งานได้ บอทส่งและรับข้อความได้</span>
              ) : (
                <span className="text-red-700">✗ โทเค็นเพจใช้งานไม่ได้ บอทตอบใครไม่ได้เลย</span>
              )}
            </Row>
            <Row label="ชื่อเพจ">{status.pageName ?? connections[0]?.pageName ?? "—"}</Row>
            <Row label="รหัสเพจ">{status.pageId ?? connections[0]?.pageId ?? "—"}</Row>
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

      <Card title="ใครคุยกับบอทได้บ้าง" hint="ตรวจกับคนนอกจริงแล้วเมื่อ 4 ก.ย. 2569">
        <p className="text-sm text-slate-700">
          ลูกค้าทุกคนที่ทักเพจนี้ได้รับคำตอบ ไม่ต้องมีบทบาทในแอป เพราะเพจกับแอปเป็นของธุรกิจเดียวกัน
          Meta จึงให้สิทธิ์ระดับมาตรฐานครอบคลุมเพจของตัวเองอยู่แล้ว
        </p>
        <p className="mt-2 text-sm text-slate-700">
          App Review จำเป็นก็ต่อเมื่อจะเอาบอทไปตอบเพจของธุรกิจอื่น ขั้นตอนทั้งหมดอยู่ในไฟล์{" "}
          <code className="rounded bg-slate-100 px-1">docs/facebook-connect.md</code> ในโปรเจกต์
        </p>
      </Card>

    </>
  );
}
