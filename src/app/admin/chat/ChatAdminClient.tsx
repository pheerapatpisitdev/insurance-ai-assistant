"use client";
import { useState } from "react";
import { Card } from "../ui";
import { resetPrompt, savePrompt, tryQuestion, type TryResult } from "./actions";
import type { PromptKey } from "@/lib/assistant/prompts";

interface PromptRow {
  key: PromptKey;
  label: string;
  hint: string;
  fallback: string;
  current: string;
  edited: boolean;
}

const EXAMPLES = [
  "ไลฟ์โพรเทค ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่",
  "สนใจประกันมรดก",
  "iShield รับอายุเท่าไหร่",
  "ขั้นตอนการเคลมมีอะไรบ้าง",
  "สวัสดีครับ",
];

function money(thb: number | undefined) {
  if (thb === undefined) return null;
  return `${thb < 0.01 ? thb.toFixed(4) : thb.toFixed(2)} บาท`;
}

/** The path a question takes, drawn from what the assistant actually does. */
function Structure({ counts }: { counts: { plans: number; bundles: number; docs: number } }) {
  const routes = [
    {
      name: "คำนวณเบี้ย",
      when: "ลูกค้าบอกอายุ เพศ ทุนประกัน",
      source: `ตารางเบี้ยของบริษัท ${counts.plans} แบบ`,
      engine: "เครื่องคำนวณ ไม่ใช้ AI",
      cost: "ฟรี",
    },
    {
      name: "ชุดจัดเอง",
      when: "ลูกค้าเรียกชื่อชุดที่คุณตั้งไว้",
      source: `ชุดที่จัดไว้ ${counts.bundles} ชุด`,
      engine: "เครื่องคำนวณ ไม่ใช้ AI",
      cost: "ฟรี",
    },
    {
      name: "เงื่อนไขแบบประกัน",
      when: "ถามว่ามีแบบไหน รับอายุเท่าไหร่",
      source: "ข้อเท็จจริงที่ดึงจากตารางเบี้ย",
      engine: "โมเดลเล็ก",
      cost: "ราว 0.02 บาท",
    },
    {
      name: "ค้นจากเอกสาร",
      when: "ถามเรื่องเคลม ระยะรอคอย ข้อยกเว้น",
      source: `เอกสารในคลังความรู้ ${counts.docs} ไฟล์`,
      engine: "โมเดลใหญ่",
      cost: "ราว 0.08 บาท",
    },
    {
      name: "ทักทาย / นอกเรื่อง",
      when: "ทักทาย หรือถามเรื่องที่ไม่ใช่ประกัน",
      source: "รายชื่อแบบประกัน",
      engine: "โมเดลเล็ก",
      cost: "ต่ำกว่า 0.01 บาท",
    },
  ];

  return (
    <Card
      title="โครงสร้าง"
      hint="ข้อความหนึ่งข้อความเดินทางแบบนี้ ตัวเลขเบี้ยทุกตัวมาจากเครื่องคำนวณ ไม่ได้มาจาก AI"
    >
      <ol className="mb-4 flex flex-wrap items-center gap-2 text-sm">
        {["ลูกค้าพิมพ์", "อ่านคำถาม แยกเจตนา (โมเดลเล็ก)", "เลือก 1 ใน 5 เส้นทาง", "ตอบกลับ"].map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className="rounded-md border bg-slate-50 px-2.5 py-1">{s}</span>
            {i < 3 && <span aria-hidden="true" className="text-slate-400">→</span>}
          </li>
        ))}
      </ol>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="pb-2 pr-3 font-medium">เส้นทาง</th>
              <th className="pb-2 pr-3 font-medium">ใช้เมื่อ</th>
              <th className="pb-2 pr-3 font-medium">ดึงข้อมูลจาก</th>
              <th className="pb-2 pr-3 font-medium">ใครตอบ</th>
              <th className="pb-2 font-medium">ค่าใช้จ่าย</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.name} className="border-t align-top">
                <td className="py-2 pr-3 font-medium">{r.name}</td>
                <td className="py-2 pr-3 text-slate-600">{r.when}</td>
                <td className="py-2 pr-3 text-slate-600">{r.source}</td>
                <td className="py-2 pr-3 text-slate-600">{r.engine}</td>
                <td className="py-2 whitespace-nowrap text-slate-600">{r.cost}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Playground() {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TryResult | null>(null);

  async function run(q: string) {
    if (!q.trim() || busy) return;
    setBusy(true);
    setResult(await tryQuestion(q));
    setBusy(false);
  }

  return (
    <Card title="ลองถาม" hint="ถามเหมือนลูกค้าถาม แล้วดูว่าระบบคิดยังไงในแต่ละขั้น ไม่ถูกบันทึกเป็นบทสนทนา">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(question);
        }}
        className="flex gap-2"
      >
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="พิมพ์คำถามของลูกค้า"
          className="flex-1 rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={busy || !question.trim()}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          {busy ? "กำลังถาม…" : "ถาม"}
        </button>
      </form>

      <div className="mt-2 flex flex-wrap gap-1.5">
        {EXAMPLES.map((e) => (
          <button
            key={e}
            type="button"
            onClick={() => {
              setQuestion(e);
              run(e);
            }}
            className="rounded-full border px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            {e}
          </button>
        ))}
      </div>

      {result && (
        <div className="mt-4 space-y-3">
          <ol className="space-y-2">
            {result.trace.map((s, i) => (
              <li key={i} className="rounded-md border bg-slate-50 p-3 text-sm">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="font-medium">{i + 1}. {s.step}</span>
                  {s.model && <span className="text-xs text-slate-500">{s.model}</span>}
                  {s.inputTokens !== undefined && (
                    <span className="text-xs tabular-nums text-slate-500">
                      เข้า {s.inputTokens.toLocaleString("en-US")} · ออก {(s.outputTokens ?? 0).toLocaleString("en-US")} คำ
                    </span>
                  )}
                  {money(s.costThb) && <span className="text-xs tabular-nums text-slate-500">{money(s.costThb)}</span>}
                </div>
                {s.detail && (
                  <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-all text-xs text-slate-600">
                    {s.detail}
                  </pre>
                )}
              </li>
            ))}
          </ol>

          {result.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{result.error}</p>
          )}
          {result.reply && (
            <div>
              <div className="mb-1 text-xs text-slate-500">คำตอบที่ลูกค้าจะได้</div>
              <div className="whitespace-pre-wrap rounded-md border bg-white p-3 text-sm">{result.reply}</div>
            </div>
          )}
          {result.sources.length > 0 && (
            <div className="text-xs text-slate-500">
              เอกสารที่ใช้: {result.sources.map((s) => `${s.title}${s.page ? ` หน้า ${s.page}` : ""}`).join(" · ")}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

function PromptEditor({ row }: { row: PromptRow }) {
  const [text, setText] = useState(row.current);
  const [edited, setEdited] = useState(row.edited);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const dirty = text !== row.current;

  async function save() {
    setBusy(true);
    const r = await savePrompt(row.key, text);
    setBusy(false);
    setStatus(r.ok ? "บันทึกแล้ว มีผลกับข้อความถัดไปภายใน 1 นาที" : (r.error ?? "บันทึกไม่สำเร็จ"));
    if (r.ok) setEdited(true);
  }

  async function reset() {
    setBusy(true);
    const r = await resetPrompt(row.key);
    setBusy(false);
    if (r.ok) {
      setText(row.fallback);
      setEdited(false);
      setStatus("คืนค่าเดิมแล้ว");
    } else {
      setStatus(r.error ?? "คืนค่าเดิมไม่สำเร็จ");
    }
  }

  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1 flex flex-wrap items-baseline gap-2">
        <h3 className="text-sm font-medium">{row.label}</h3>
        {edited && <span className="rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">แก้ไว้</span>}
      </div>
      <p className="mb-2 text-xs text-slate-500">{row.hint}</p>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={10}
        spellCheck={false}
        className="w-full rounded-md border p-3 font-mono text-xs leading-relaxed"
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm text-white disabled:opacity-40"
        >
          บันทึก
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={busy || !edited}
          className="rounded-md border px-3 py-1.5 text-sm disabled:opacity-40"
        >
          คืนค่าเดิม
        </button>
        {status && <span className="text-xs text-slate-500">{status}</span>}
      </div>
    </div>
  );
}

export function ChatAdminClient({
  prompts, counts,
}: {
  prompts: PromptRow[];
  counts: { plans: number; bundles: number; docs: number };
}) {
  return (
    <>
      <Structure counts={counts} />
      <Playground />
      <Card
        title="ข้อความสั่งงาน AI"
        hint="บอกบอทว่าให้ตอบยังไง แก้แล้วมีผลกับทุกช่องทาง คำสั่งของตัวแยกเจตนาไม่ให้แก้ เพราะต้องส่งข้อมูลกลับเป็นรูปแบบเฉพาะ"
      >
        {prompts.map((p) => (
          <PromptEditor key={p.key} row={p} />
        ))}
      </Card>
    </>
  );
}
