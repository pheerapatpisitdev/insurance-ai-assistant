"use client";
import { useState, useTransition } from "react";
import { resumeBot, type HandedOverRow } from "./actions";

/**
 * The threads the bot is switched off in, and the one control that turns it back on.
 *
 * This list is the other half of the rule the owner asked for. One reply typed by hand hands
 * a thread to a person for good — which is what they want while they are in the conversation,
 * and a customer nobody answers the moment they are not. A switch with no indicator is how
 * that happens, so the indicator is a tab with a count on it.
 */

const PLAN_LABEL: Record<string, string> = {
  lifeprotect: "มรดกเบี้ยไม่ทิ้ง",
  legacy: "มรดกเบี้ยทิ้ง",
  ishield: "มรดก + ออม",
  ihealthy: "ประกันสุขภาพ",
  undecided: "ยังไม่ได้เลือกแบบ",
};

/** "3 ชม.ที่แล้ว" — near enough, and never a timestamp nobody reads. */
function ago(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "เมื่อครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} ชม.ที่แล้ว`;
  const days = Math.round(hours / 24);
  return days === 1 ? "เมื่อวาน" : `${days} วันที่แล้ว`;
}

export function HandedOver({ rows }: { rows: HandedOverRow[] }) {
  const box = "rounded-b-xl border border-t-0 border-slate-200 bg-white overflow-x-auto";
  const [done, setDone] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();

  if (rows.length === 0) {
    return (
      <div className={box}>
        <p className="px-4 py-8 text-center text-sm text-slate-500">
          บอทกำลังตอบทุกแชท — ยังไม่มีแชทไหนที่คุณเข้าไปตอบเอง
        </p>
      </div>
    );
  }

  return (
    <div className={box}>
      {error && <p className="border-b border-red-100 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
      <ul className="divide-y divide-slate-100">
        {rows.map((r) => {
          const back = done.includes(r.userHash);
          return (
            <li key={r.userHash} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-800">
                  {PLAN_LABEL[r.product ?? "undecided"] ?? r.product}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  คุณเข้าไปตอบ {ago(r.handedOverAt)} · ลูกค้าเคลื่อนไหวล่าสุด {ago(r.updatedAt)}
                </p>
              </div>
              {back ? (
                <span className="shrink-0 text-xs text-emerald-700">บอทกลับมาตอบแล้ว</span>
              ) : (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    setError(undefined);
                    start(async () => {
                      try {
                        await resumeBot(r.userHash);
                        setDone((d) => [...d, r.userHash]);
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "เปิดคืนไม่สำเร็จ");
                      }
                    });
                  }}
                  className="shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  ให้บอทกลับมาตอบ
                </button>
              )}
            </li>
          );
        })}
      </ul>
      <p className="border-t border-slate-100 px-4 py-2.5 text-xs leading-relaxed text-slate-500">
        คุณตอบในแชทไหน บอทจะหยุดตอบแชทนั้นถาวร จนกว่าจะกดปุ่มนี้ —
        แชทในรายการนี้ไม่มีบอทคอยตอบ มีแต่คุณ
      </p>
    </div>
  );
}
