"use client";
import type { ContentItem } from "@/lib/content/store";

/**
 * One piece on the workbench, in the shape of Maryjane's piece-card: the picture on top, the
 * words under it, and a bar of three buttons — the decision, the tools, the bin.
 *
 * There is no picture yet, so the top is the hook set large on navy — the poster the next
 * round will render for real. It already does the job the picture does on a feed: it is what a
 * scrolling eye reads first, and on the workbench it is how one piece is told from another.
 */

interface Props {
  item: ContentItem;
  index: number;
  productName: string;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: ContentItem["status"]) => void;
  onCopy: () => void;
}

export function PieceCard({ item, index, productName, busy, onEdit, onStatus, onCopy }: Props) {
  const blocking = (item.flags.policy ?? []).some((f) => f.severity === "block");
  const toCheck = item.flags.numbers.length + item.flags.words.length + (item.flags.policy?.length ?? 0);
  const cell = "flex min-h-11 items-center justify-center gap-1.5 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";

  return (
    <article className={`overflow-hidden rounded-xl border bg-[var(--ct-panel)] ${item.status === "trashed" ? "border-[var(--ct-hair)] opacity-70" : "border-[var(--ct-hair)]"}`}>
      {/* the navy is a div inside the button: the site's own button rule outranks a background
          utility on the button itself, and the header rendered transparent */}
      <button type="button" onClick={onEdit} className="block w-full text-left">
        <div className="relative flex aspect-[4/3] w-full flex-col justify-end bg-[var(--ct-solid)] p-4 text-[var(--ct-solid-ink)]">
          <span className="absolute left-3 top-3 rounded-full bg-[var(--ct-panel)] px-2.5 py-0.5 text-xs text-[var(--ct-mute)]">
            {item.format === "post" ? "โพสต์" : "สคริปต์"} {index + 1}
          </span>
          {toCheck > 0 && (
            <span className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs ${blocking ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
              {blocking ? "ผิดกฎ Facebook" : `ต้องตรวจ ${toCheck}`}
            </span>
          )}
          <span className="text-xs opacity-80">{productName}</span>
          <span className="mt-1 line-clamp-4 text-lg font-semibold leading-snug">{item.output.hooks[0]}</span>
        </div>
      </button>

      <div className="space-y-1.5 p-3">
        {item.output.angle && <p className="text-xs text-[var(--ct-mute)]">มุม: {item.output.angle}</p>}
        <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed">{item.output.body}</p>
        {item.output.hashtags.length > 0 && (
          <p className="line-clamp-1 text-xs text-[var(--ct-accent)]">{item.output.hashtags.join(" ")}</p>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--ct-hair)] border-t border-[var(--ct-hair)]">
        {item.status === "trashed" ? (
          <button type="button" disabled={busy} onClick={() => onStatus("draft")} className={`${cell} col-span-3`}>
            ↩ กู้คืน
          </button>
        ) : (
          <>
            {item.status === "used" ? (
              <button type="button" onClick={onCopy} className={cell}>คัดลอก</button>
            ) : (
              <button type="button" disabled={busy} onClick={() => onStatus("used")} className={`${cell} font-medium text-[var(--ct-accent)]`}>
                ✓ ใช้จริง
              </button>
            )}
            <button type="button" onClick={onEdit} className={cell}>แก้ไข</button>
            <button type="button" disabled={busy} onClick={() => onStatus("trashed")} className={`${cell} text-[var(--ct-alert)]`}>
              ทิ้ง
            </button>
          </>
        )}
      </div>
    </article>
  );
}
