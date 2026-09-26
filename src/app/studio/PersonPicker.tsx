"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { POSES, type PiecePerson } from "@/lib/content/people";

export interface PersonOption {
  id: string;
  name: string;
}

const chip = (on: boolean) =>
  `min-h-11 rounded-full border px-3.5 py-1.5 text-sm disabled:opacity-50 ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;

/**
 * Who from the people library goes into the picture, and how they stand. None is the
 * default, and with nobody in the library the picker says where to add someone instead.
 */
export function PersonPicker({ people, value, onChange, disabled, confirmLeave }: {
  people: PersonOption[];
  value: PiecePerson | null;
  onChange: (next: PiecePerson | null) => void;
  /** the picture can no longer be redrawn here */
  disabled?: boolean;
  /** asked before the link to the library leaves the page; false stays */
  confirmLeave?: () => Promise<boolean>;
}) {
  const router = useRouter();
  const toLibrary = async (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!confirmLeave || e.metaKey || e.ctrlKey || e.shiftKey) return;
    e.preventDefault();
    if (await confirmLeave()) router.push("/studio/people");
  };
  if (people.length === 0) {
    return (
      <p className="text-sm text-[var(--ct-mute)]">
        ยังไม่มีใครในคลัง — <Link href="/studio/people" onClick={toLibrary} className="underline">เพิ่มคนที่คลังบุคคล</Link>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Link href="/studio/people" onClick={toLibrary} className="inline-flex min-h-11 items-center text-sm text-[var(--ct-accent)] underline">จัดการคลังบุคคล (เพิ่ม/แก้ไข/ลบ) →</Link>
      </div>
      <select
        value={value?.id ?? ""}
        disabled={disabled}
        aria-label="บุคคลในภาพ"
        onChange={(e) => onChange(e.target.value ? { id: e.target.value, pose: value?.pose ?? "auto" } : null)}
        className="min-h-11 w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm disabled:opacity-60"
      >
        <option value="">ไม่ใส่</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {value && (
        <div role="radiogroup" aria-label="ท่าทาง" className="flex flex-wrap gap-1.5">
          {POSES.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={value.pose === p.id} disabled={disabled} onClick={() => onChange({ ...value, pose: p.id })} className={chip(value.pose === p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
