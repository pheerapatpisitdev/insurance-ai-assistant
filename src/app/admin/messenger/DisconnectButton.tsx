"use client";
import { useState } from "react";
import { disconnectPage } from "./actions";
import { ActionError, useAction } from "./useAction";

/**
 * Asks twice in the page itself rather than through confirm(): a browser told once to stop
 * showing dialogs answers confirm() with "no" from then on, which left this button dead with
 * nothing on screen to say why.
 */
export function DisconnectButton() {
  const { pending, error, run } = useAction();
  const [armed, setArmed] = useState(false);

  if (!armed) {
    return (
      <div>
        <button
          type="button"
          onClick={() => setArmed(true)}
          className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
        >
          ยกเลิกการเชื่อมต่อ
        </button>
        <ActionError error={error} />
      </div>
    );
  }

  return (
    <div>
      <p className="mb-2 text-sm text-red-700">
        ยกเลิกแล้วบอทจะหยุดตอบข้อความใน Messenger ทันที และต้องเข้าสู่ระบบ Facebook ใหม่ถึงจะกลับมาได้
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => disconnectPage())}
          className="rounded-md bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "กำลังยกเลิก…" : "ยืนยันยกเลิกการเชื่อมต่อ"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => setArmed(false)}
          className="text-sm text-slate-500 underline disabled:opacity-50"
        >
          ไม่ยกเลิกแล้ว
        </button>
      </div>
      <ActionError error={error} />
    </div>
  );
}
