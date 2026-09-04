"use client";
import { useState } from "react";
import { Card, Empty } from "../ui";
import { deleteFaq, listFaq, probeFaq, saveFaq, setFaqEnabled, type FaqProbe, type FaqRow } from "./actions";

function Editor({
  row, onDone, onCancel,
}: {
  row?: FaqRow;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const [question, setQuestion] = useState(row?.question ?? "");
  const [answer, setAnswer] = useState(row?.answer ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const r = await saveFaq({ id: row?.id, question, answer });
    setBusy(false);
    if (r.ok) {
      if (!row) {
        setQuestion("");
        setAnswer("");
      }
      onDone();
    } else setError(r.error ?? "บันทึกไม่สำเร็จ");
  }

  return (
    <div className="space-y-2">
      <div>
        <label className="mb-1 block text-xs text-slate-500">คำถามของลูกค้า</label>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="เช่น ต้องใช้เอกสารอะไรบ้างตอนเคลม"
          className="w-full rounded-md border px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-slate-500">คำตอบที่จะส่งให้ลูกค้า ส่งตามนี้ทุกตัวอักษร</label>
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={5}
          placeholder="พิมพ์คำตอบที่อยากให้ลูกค้าได้รับ"
          className="w-full rounded-md border p-3 text-sm"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !question.trim() || !answer.trim()}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          {busy ? "กำลังบันทึก…" : row ? "บันทึกการแก้ไข" : "เพิ่มคำตอบ"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-md border px-3 py-1.5 text-sm">
            ยกเลิก
          </button>
        )}
        {error && <span className="text-xs text-red-700">{error}</span>}
      </div>
    </div>
  );
}

function Tester({ threshold }: { threshold: number }) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ hits: FaqProbe[]; error?: string } | null>(null);

  async function run() {
    if (!question.trim()) return;
    setBusy(true);
    setResult(await probeFaq(question));
    setBusy(false);
  }

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="ลองพิมพ์แบบที่ลูกค้าจะถาม"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="rounded-md border px-4 py-2 text-sm disabled:opacity-40"
        >
          {busy ? "กำลังค้น…" : "ค้น"}
        </button>
      </form>
      {result?.error && <p className="mt-2 text-sm text-red-700">{result.error}</p>}
      {result && !result.error && (
        result.hits.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">ยังไม่มีคำตอบที่เขียนไว้</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {result.hits.map((h, i) => (
              <li key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
                <span className="tabular-nums">{(h.score * 100).toFixed(0)}%</span>
                <span className={h.willUse ? "text-emerald-700" : "text-slate-500"}>
                  {h.willUse ? "จะใช้คำตอบนี้" : "ไม่ถึงเกณฑ์"}
                </span>
                <span className="min-w-0 break-words text-slate-700">{h.question}</span>
              </li>
            ))}
          </ul>
        )
      )}
      <p className="mt-2 text-xs text-slate-500">
        ต้องตรงกันตั้งแต่ {(threshold * 100).toFixed(0)}% ขึ้นไปถึงจะใช้คำตอบที่เขียนไว้ ต่ำกว่านั้นบอทจะไปหาจากเอกสารตามปกติ
      </p>
    </div>
  );
}

export function FaqClient({ rows, threshold }: { rows: FaqRow[]; threshold: number }) {
  const [items, setItems] = useState(rows);
  const [editing, setEditing] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function refresh() {
    setItems(await listFaq());
    setEditing(null);
  }

  async function toggle(row: FaqRow) {
    await setFaqEnabled(row.id, !row.enabled);
    await refresh();
  }

  async function remove(id: string) {
    await deleteFaq(id);
    setConfirmDelete(null);
    await refresh();
  }

  return (
    <>
      <Card
        title="เพิ่มคำตอบที่เขียนเอง"
        hint="บอทจะเช็กคลังนี้ก่อนเสมอ ถ้าคำถามลูกค้าตรงกับที่เขียนไว้ จะส่งคำตอบของคุณไปทั้งประโยค ไม่ผ่าน AI เรียบเรียง ใช้กับเรื่องที่ต้องพูดให้ถูกทุกครั้ง เช่น การเคลม ข้อยกเว้น"
      >
        <Editor onDone={refresh} />
      </Card>

      <Card title="ลองค้น" hint="ดูว่าคำถามแบบที่ลูกค้าถามจริงจะไปเจอคำตอบไหน และตรงกันกี่เปอร์เซ็นต์">
        <Tester threshold={threshold} />
      </Card>

      <Card title={`คำตอบที่เขียนไว้ ${items.length} ข้อ`} hint="ปิดชั่วคราวได้โดยไม่ต้องลบ">
        {items.length === 0 ? (
          <Empty>ยังไม่มีคำตอบที่เขียนไว้ เพิ่มข้อแรกด้านบนได้เลย</Empty>
        ) : (
          <ul className="space-y-2">
            {items.map((row) => (
              <li key={row.id} className="rounded-md border p-3">
                {editing === row.id ? (
                  <Editor row={row} onDone={refresh} onCancel={() => setEditing(null)} />
                ) : (
                  <>
                    <div className="flex flex-wrap items-baseline gap-2">
                      <span className="font-medium">{row.question}</span>
                      {!row.enabled && (
                        <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">ปิดอยู่</span>
                      )}
                      {!row.indexed && (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">ยังค้นหาไม่เจอ</span>
                      )}
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{row.answer}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-sm">
                      <button type="button" onClick={() => setEditing(row.id)} className="rounded border px-2.5 py-1">
                        แก้ไข
                      </button>
                      <button type="button" onClick={() => toggle(row)} className="rounded border px-2.5 py-1">
                        {row.enabled ? "ปิดใช้" : "เปิดใช้"}
                      </button>
                      {confirmDelete === row.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => remove(row.id)}
                            className="rounded bg-red-600 px-2.5 py-1 text-white"
                          >
                            ลบจริง
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className="rounded border px-2.5 py-1">
                            ยกเลิก
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(row.id)}
                          className="rounded border px-2.5 py-1 text-red-700"
                        >
                          ลบ
                        </button>
                      )}
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
