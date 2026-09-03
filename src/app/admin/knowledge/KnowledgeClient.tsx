"use client";
import { useRef, useState, useTransition } from "react";
import { Card, Empty } from "../ui";
import { supabaseBrowser } from "@/lib/supabase/client";
import { BUCKET } from "@/lib/knowledge";
import { registerDoc, setDocActive, deleteDoc, type DocRow } from "./actions";

const mb = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

export function KnowledgeClient({ docs, plans }: { docs: DocRow[]; plans: { code: string; name: string }[] }) {
  const [pending, start] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string>();
  const [planCode, setPlanCode] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  async function upload(files: FileList) {
    setBusy(true);
    setMessage(undefined);
    const supabase = supabaseBrowser();
    for (const file of Array.from(files)) {
      if (file.type !== "application/pdf") {
        setMessage(`${file.name} ไม่ใช่ไฟล์ PDF`);
        continue;
      }
      const path = `${Date.now()}-${crypto.randomUUID()}.pdf`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, { contentType: "application/pdf" });
      if (error) {
        setMessage(`อัปโหลด ${file.name} ไม่สำเร็จ: ${error.message}`);
        continue;
      }
      try {
        await registerDoc({ title: file.name.replace(/\.pdf$/i, ""), planCode: planCode || null, storagePath: path, bytes: file.size });
        setMessage(`อัปโหลด ${file.name} แล้ว`);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "บันทึกรายการไม่สำเร็จ");
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

      <Card title="อัปโหลดเอกสาร" hint="รับเฉพาะไฟล์ PDF เลือกได้หลายไฟล์พร้อมกัน">
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
                  <th className="py-2 pl-3">วันที่</th><th className="py-2 pl-3">ใช้งาน</th><th className="py-2 pl-3"></th>
                </tr>
              </thead>
              <tbody>
                {docs.map((d) => (
                  <tr key={d.id} className="border-b">
                    <td className="py-1.5">{d.title}</td>
                    <td className="py-1.5 pl-3">{plans.find((p) => p.code === d.plan_code)?.name ?? "—"}</td>
                    <td className="py-1.5 pl-3 tabular-nums">{mb(d.bytes)}</td>
                    <td className="py-1.5 pl-3">{String(d.created_at).slice(0, 10)}</td>
                    <td className="py-1.5 pl-3">
                      <input type="checkbox" checked={d.is_active} disabled={pending}
                             onChange={(e) => run(() => setDocActive(d.id, e.target.checked))} />
                    </td>
                    <td className="py-1.5 pl-3">
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
