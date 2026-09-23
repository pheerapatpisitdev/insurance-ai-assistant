"use client";
import type { DrawBackgroundResult } from "./actions";

/** Order a piece's photograph through /api/content-draw, which is not queued behind the page's other actions. */
export async function drawPicture(id: string, request = ""): Promise<DrawBackgroundResult> {
  try {
    const res = await fetch("/api/content-draw", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id, request }),
    });
    return await res.json() as DrawBackgroundResult;
  } catch {
    return { ok: false, error: "วาดรูปไม่สำเร็จ ลองใหม่อีกครั้งนะครับ" };
  }
}
