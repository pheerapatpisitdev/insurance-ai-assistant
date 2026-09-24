"use client";
import { shortModel } from "@/lib/content/models";
import { LENGTHS } from "@/lib/content/prompt";
import { scenes } from "@/lib/content/script";
import type { ContentItem } from "@/lib/content/store";
import { CheckIcon } from "./ui/editor-icons";

/**
 * A video script on the workbench: a shot list, not a poster.
 *
 * A script is read aloud in front of a camera, so its card is the words laid out the way
 * they will be filmed — one row per stretch of time, the words to say, what to do, and
 * what goes on screen. There is no picture, so no บันทึกรูป.
 */

interface Props {
  item: ContentItem;
  index: number;
  busy: boolean;
  onEdit: () => void;
  onStatus: (status: ContentItem["status"]) => void;
  onDelete: () => void;
  onCopy: () => void;
}

export function ScriptCard({ item, index, busy, onEdit, onStatus, onDelete, onCopy }: Props) {
  const blocking = (item.flags.policy ?? []).some((f) => f.severity === "block");
  const toCheck = item.flags.numbers.length + item.flags.words.length + (item.flags.policy?.length ?? 0);
  const list = scenes(item.output.hooks[0] ?? "", item.output.body, item.output.closing);
  const length = LENGTHS.find((l) => l.id === item.length)?.label;
  const cell = "flex min-h-11 items-center justify-center gap-1.5 text-sm hover:bg-[var(--ct-soft)] disabled:opacity-50";

  return (
    <article className="flex flex-col overflow-hidden rounded-xl border border-[var(--ct-hair)] bg-[var(--ct-panel)]">
      <div className="flex flex-wrap items-center gap-2 border-b border-[var(--ct-hair)] px-3 py-2.5">
        <span className="rounded-full bg-[var(--ct-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ct-accent)]">สคริปต์ {index + 1}</span>
        <span className="text-xs text-[var(--ct-mute)]">
          {["วิดีโอ", length, `${list.length} ช่วง`, item.model && `เขียนโดย ${shortModel(item.model)}`].filter(Boolean).join(" · ")}
        </span>
        {toCheck > 0 && (
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-xs ${blocking ? "bg-[var(--ct-alert-bg)] text-[var(--ct-alert)]" : "bg-[var(--ct-warn-bg)] text-[var(--ct-warn-ink)]"}`}>
            {blocking ? "ผิดกฎ Facebook" : `ต้องตรวจ ${toCheck}`}
          </span>
        )}
      </div>

      {/* a list may not sit inside a button; แก้ไข below opens the script */}
      <div className="flex-1">
        <ol className="divide-y divide-[var(--ct-hair)]">
          {list.map((s, i) => (
            <li key={i} className="grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 px-3 py-2.5">
              <span className="pt-0.5 text-xs font-medium tabular-nums text-[var(--ct-accent)]">{s.time ?? "—"}</span>
              <div className="min-w-0 space-y-1">
                {s.say && <p className={`line-clamp-3 text-sm leading-relaxed ${i === 0 ? "font-semibold" : ""}`}>{s.say}</p>}
                {s.acts.length > 0 && <p className="line-clamp-1 text-xs text-[var(--ct-mute)]">ท่าทาง: {s.acts.join(" · ")}</p>}
                {s.screen.map((t, j) => (
                  <p key={j} className="w-fit max-w-full truncate rounded border border-[var(--ct-line)] bg-[var(--ct-ground)] px-1.5 py-0.5 text-xs">
                    ขึ้นจอ: {t}
                  </p>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-3 divide-x divide-[var(--ct-hair)] border-t border-[var(--ct-hair)]">
        {item.status === "used" ? (
          <button type="button" onClick={onCopy} className={cell}>คัดลอก</button>
        ) : (
          <button type="button" disabled={busy} onClick={() => onStatus("used")} className={`${cell} font-medium text-[var(--ct-accent)]`}>
            <CheckIcon className="size-4" />
            ใช้จริง
          </button>
        )}
        <button type="button" onClick={onEdit} className={cell}>แก้ไข</button>
        <button type="button" disabled={busy} onClick={onDelete} className={`${cell} text-[var(--ct-alert)]`}>ลบ</button>
      </div>
    </article>
  );
}
