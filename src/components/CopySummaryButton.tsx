"use client";
import { useState } from "react";

export function CopySummaryButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      window.prompt("คัดลอกข้อความด้านล่าง", text);
    }
  }
  return (
    <button type="button" onClick={copy} className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700">
      {copied ? "คัดลอกแล้ว ✓" : "คัดลอกสรุปส่ง LINE"}
    </button>
  );
}
