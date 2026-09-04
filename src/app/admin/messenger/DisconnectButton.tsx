"use client";
import { useTransition } from "react";
import { disconnectPage } from "./actions";

export function DisconnectButton() {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("ยกเลิกการเชื่อมต่อเพจนี้ บอทจะหยุดตอบข้อความใน Messenger ทันที ยืนยันไหม")) return;
        start(() => { void disconnectPage(); });
      }}
      className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
    >
      {pending ? "กำลังยกเลิก…" : "ยกเลิกการเชื่อมต่อ"}
    </button>
  );
}
