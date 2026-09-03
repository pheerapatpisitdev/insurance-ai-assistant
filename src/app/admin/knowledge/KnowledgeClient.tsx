"use client";
import { useRef, useState, useTransition } from "react";
import { Card, Empty } from "../ui";
import { uploadDoc, setDocActive, deleteDoc, reingestDoc, type DocRow } from "./actions";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

const STATUS: Record<string, { label: string; className: string }> = {
  uploaded: { label: "รออ่าน", className: "bg-slate-100 text-slate-700" },
  processing: { label: "กำลังอ่าน", className: "bg-sky-100 text-sky-800" },
  ready: { label: "ค้นหาได้", className: "bg-emerald-100 text-emerald-800" },
  failed: { label: "อ่านไม่ได้", className: "bg-red-100 text-red-800" },
};

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, className: "bg-slate-100 text-slate-700" };
  return <span className={`rounded px-2 py-0.5 text-xs ${s.className}`}>{s.label}</span>;
}

export function KnowledgeClient({ docs, plans }: { docs: DocRow[]; plans: { code: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [planCode, setPlanCode] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(files: FileList) {
    setBusy(true);
    setMessage(undefined);
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("planCode", planCode);
      try {
        await uploadDoc(fd);
        setMessage(`อัปโหลด ${file.name} แล้ว`);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : `อัปโหลด ${file.name} ไม่สำเร็จ`);
      }
    }
    if (fileInput.current) fileInput.current.value = "";
    setBusy(false);
  }

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "ทำรายการไม่สำเร็จ");
      }
    });

  return (
    <>
      {message && <p className="mb-4 rounded-md border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">{message}</p>}

      <Card title="อัปโหลดเอกสาร" hint="รับเฉพาะไฟล์ PDF ไม่เกิน 50 MB เลือกได้หลายไฟล์พร้อมกัน">
        <div className="flex flex-wrap items-center gap-3">
          <select value={planCode} onChange={(e) => setPlanCode(e.target.value)} className="rounded border px-2 py-1 text-sm">
            <option value="">ไม่ระบุแบบประกัน</option>
            {plans.map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
          </select>
          <input ref={fileInput} type="file" accept="application/pdf" multiple disabled={busy}
                 className="text-sm" onChange={(e) => e.target.files && upload(e.target.files)} />
          {busy && <span className="text-sm text-slate-500">กำลังอัปโหลด…</span>}
        </div>
      </Card>

      <Card title={`เอกสารในคลัง (${docs.length})`}>
        {docs.length === 0 ? <Empty>ยังไม่มีเอกสาร</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-slate-500">
                  <th className="py-2">ชื่อ</th><th className="py-2 pl-3">แบบประกัน</th><th className="py-2 pl-3">ขนาด</th>
                  <th className="py-2 pl-3">หน้า</th><th className="py-2 pl-3">สถานะ</th>
                  <th className="py-2 pl-3">วันที่</th><th className="py-2 pl-3">ใช้งาน</th><th className="py-2 pl-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b">
                    <td className="py-1.5">{d.title}</td>
                    <td className="py-1.5 pl-3">{plans.find((p) => p.code === d.plan_code)?.name ?? "—"}</td>
                    <td className="py-1.5 pl-3 tabular-nums">{mb(d.bytes)}</td>
                    <td className="py-1.5 pl-3 tabular-nums">{d.page_count ?? "—"}</td>
                    <td className="py-1.5 pl-3">
                      <StatusBadge status={d.status} />
                      {d.error && <div className="mt-0.5 max-w-64 text-xs text-red-600">{d.error}</div>}
                    </td>
                    <td className="py-1.5 pl-3">{String(d.created_at).slice(0, 10)}</td>
                    <td className="py-1.5 pl-3">
                      <input type="checkbox" checked={d.is_active} disabled={pending}
                             onChange={(e) => run(() => setDocActive(d.id, e.target.checked))} />
                    </td>
                    <td className="py-1.5 pl-3 whitespace-nowrap">
                      {d.status !== "ready" && (
                        <button type="button" disabled={pending} className="mr-3 text-xs text-sky-700 underline"
                                onClick={() => run(() => reingestDoc(d.id))}>
                          อ่านใหม่
                        </button>
                      )}
                      <button type="button" disabled={pending} className="text-xs text-red-600 underline"
                              onClick={() => { if (confirm(`ลบ ${d.title} ?`)) run(() => deleteDoc(d.id)); }}>
                        ลบ
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
