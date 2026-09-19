"use client";
import { useState, useTransition } from "react";
import { letBotResume } from "./actions";

/**
 * The switch that gives one thread back to the bot.
 *
 * The bot stops the moment an application form goes out, and stays stopped: what follows a
 * form is an agent, and a model quoting over the top of somebody checking a birthdate is the
 * failure that rule exists to prevent. So the silence ends here, by hand, when whoever is
 * looking at this row knows the application is over.
 *
 * It asks first. This is a customer's thread, and a mis-tap would put the bot back into a
 * conversation an agent is in the middle of.
 */
export function BotResume({ leadId }: { leadId: string }) {
  const [state, setState] = useState<"idle" | "asking" | "done">("idle");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  if (state === "done") return <span className="whitespace-nowrap text-xs text-slate-400">บอทดูแลต่อแล้ว</span>;

  if (state === "asking") {
    return (
      <span className="flex items-center gap-1.5">
        <button
          type="button"
          disabled={pending}
          onClick={() => {
            setError(undefined);
            start(async () => {
              const res = await letBotResume(leadId);
              if (res.ok) setState("done");
              else { setError(res.error); setState("idle"); }
            });
          }}
          className="whitespace-nowrap rounded-lg bg-slate-800 px-2.5 py-1.5 text-xs text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {pending ? "กำลังเปิด…" : "ยืนยัน"}
        </button>
        <button
          type="button"
          onClick={() => setState("idle")}
          className="whitespace-nowrap px-1.5 py-1.5 text-xs text-slate-500 hover:text-slate-700"
        >
          ยกเลิก
        </button>
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => setState("asking")}
        title="ตอนนี้บอทหยุดตอบในแชทนี้เพราะส่งฟอร์มไปแล้ว"
        className="whitespace-nowrap rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
      >
        ให้บอทดูแลต่อ
      </button>
      {error && <span className="text-xs text-rose-600">{error}</span>}
    </span>
  );
}
