"use client";
import { defaultPoster, posterUrl } from "@/lib/content/poster";
import type { ContentItem } from "@/lib/content/store";

/**
 * One piece on the workbench, in the shape of Maryjane's piece-card: the picture on top, the
 * words under it, and a bar of three buttons — the decision, the tools, the bin.
 *
 * The picture is the piece's poster, drawn by /api/content-poster from the words the writer
 * chose; a piece from before posters gets one drawn from its hook.
 */

interface Props {
  item: ContentItem;
  index: number;
  productName: string;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: ContentItem["status"]) => void;
  onDelete: () => void;
  onCopy: () => void;
}

export function PieceCard({ item, index, productName, busy, onEdit, onStatus, onDelete, onCopy }: Props) {
  const blocking = (item.flags.policy ?? []).some((f) => f.severity === "block");
  const toCheck = item.flags.numbers.length + item.flags.words.length + (item.flags.policy?.length ?? 0);
  const cell = "flex min-h-11 items-center justify-center gap-1.5 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
      <button type="button" onClick={onEdit} className="relative block w-full text-left" aria-label="เปิดแก้ไขชิ้นนี้">
        {/* eslint-disable-next-line @next/next/no-img-element -- a drawn PNG from our own route, not an asset to optimise */}
        <img
          src={posterUrl(item.output.poster ?? defaultPoster(item.output.hooks[0], productName))}
          alt={item.output.hooks[0]}
          loading="lazy"
          className="aspect-square w-full bg-[var(--ct-ground)] object-cover"
        />
        <span className="absolute left-3 top-3 rounded-full bg-[var(--ct-panel)] px-2.5 py-0.5 text-xs text-[var(--ct-mute)]">
          {item.format === "post" ? "โพสต์" : "สคริปต์"} {index + 1}
        </span>
        {toCheck > 0 && (
          <span className={`absolute right-3 top-3 rounded-full px-2.5 py-0.5 text-xs ${blocking ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
            {blocking ? "ผิดกฎ Facebook" : `ต้องตรวจ ${toCheck}`}
          </span>
        )}
      </button>

      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-sm font-semibold leading-snug">{item.output.hooks[0]}</p>
        {item.output.angle && <p className="text-xs text-[var(--ct-mute)]">มุม: {item.output.angle}</p>}
        <p className="line-clamp-4 whitespace-pre-line text-sm leading-relaxed">{item.output.body}</p>
        {item.output.hashtags.length > 0 && (
          <p className="line-clamp-1 text-xs text-[var(--ct-accent)]">{item.output.hashtags.join(" ")}</p>
        )}
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--ct-hair)] border-t border-[var(--ct-hair)]">
        {item.status === "used" ? (
          <button type="button" onClick={onCopy} className={cell}>คัดลอก</button>
        ) : (
          <button type="button" disabled={busy} onClick={() => onStatus("used")} className={`${cell} font-medium text-[var(--ct-accent)]`}>
            ✓ ใช้จริง
          </button>
        )}
        <button type="button" onClick={onEdit} className={cell}>แก้ไข</button>
        <button type="button" disabled={busy} onClick={onDelete} className={`${cell} text-[var(--ct-alert)]`}>
          ลบ
        </button>
      </div>
    </article>
  );
}
