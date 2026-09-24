import type { Publish } from "./store";

/**
 * What a piece's trip to the Page looks like from here, in the owner's words.
 *
 * A held post has no event of its own when Facebook puts it up, so a schedule whose time has
 * passed is read as posted: Facebook does not miss its own schedule, and a post the owner
 * deleted by hand is theirs to know about.
 */

export type PublishView =
  | { kind: "none" }
  | { kind: "posting" }
  | { kind: "scheduled"; at: Date }
  | { kind: "published"; at: Date | null }
  | { kind: "failed"; error: string };

export function publishView(p: Publish | null, now: Date = new Date()): PublishView {
  if (!p || p.state === "cancelled") return { kind: "none" };
  if (p.state === "posting") return { kind: "posting" };
  if (p.state === "failed") return { kind: "failed", error: p.error ?? "โพสต์ไม่สำเร็จ" };
  const at = p.at ? new Date(p.at) : null;
  if (p.state === "scheduled" && at && at.getTime() > now.getTime()) return { kind: "scheduled", at };
  return { kind: "published", at };
}

/** On the Page or on its way there. Such a piece lives on the calendar; the studio's
    รอตรวจ and ใช้จริง lists leave it out (the owner's call, 2026-09-24). It stays ใช้จริง
    underneath, so the hook formulas still learn from it. */
export const ON_PAGE_STATES = ["posting", "scheduled", "published"] as const;

export function onPage(p: Publish | null): boolean {
  return p != null && (ON_PAGE_STATES as readonly string[]).includes(p.state);
}

/** "25 ก.ย. 19:30", in Thailand's time whatever the browser's clock says */
export function thaiWhen(d: Date): string {
  return d.toLocaleString("th-TH", { timeZone: "Asia/Bangkok", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** The card's one line about it, or null when there is nothing to say. */
export function publishLabel(p: Publish | null, now: Date = new Date()): string | null {
  const v = publishView(p, now);
  switch (v.kind) {
    case "posting": return "กำลังส่งไปเพจ…";
    case "scheduled": return `⏰ ตั้งเวลาโพสต์ ${thaiWhen(v.at)}`;
    case "published": return v.at ? `✓ ลงเพจแล้ว ${thaiWhen(v.at)}` : "✓ ลงเพจแล้ว";
    case "failed": return "โพสต์ลงเพจไม่สำเร็จ — เปิดแก้ไขเพื่อลองใหม่";
    default: return null;
  }
}

/**
 * The quick times offered for a schedule: this evening while it is still ahead, then tomorrow
 * noon and evening. Local time, which for the owner is Thailand's.
 */
export function quickTimes(now: Date = new Date(), minAheadMs = 15 * 60_000): { label: string; at: Date }[] {
  const at = (days: number, h: number, m: number) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(h, m, 0, 0);
    return d;
  };
  return [
    { label: "วันนี้ 19:30", at: at(0, 19, 30) },
    { label: "พรุ่งนี้ 14:10", at: at(1, 14, 10) },
    { label: "พรุ่งนี้ 19:30", at: at(1, 19, 30) },
  ].filter((t) => t.at.getTime() - now.getTime() >= minAheadMs);
}
