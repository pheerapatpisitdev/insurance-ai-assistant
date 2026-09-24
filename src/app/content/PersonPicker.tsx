"use client";
import Link from "next/link";
import { POSES, type PiecePerson } from "@/lib/content/people";

export interface PersonOption {
  id: string;
  name: string;
}

const chip = (on: boolean) =>
  `rounded-full border px-2.5 py-1 text-xs ${on ? "border-[var(--ct-solid)] bg-[var(--ct-soft)] font-medium text-[var(--ct-accent)]" : "border-[var(--ct-line)] text-[var(--ct-mute)] hover:bg-[var(--ct-ground)]"}`;

/**
 * Who from the people library goes into the picture, and how they stand. None is the
 * default, and with nobody in the library the picker says where to add someone instead.
 */
export function PersonPicker({ people, value, onChange }: {
  people: PersonOption[];
  value: PiecePerson | null;
  onChange: (next: PiecePerson | null) => void;
}) {
  if (people.length === 0) {
    return (
      <p className="text-xs text-[var(--ct-mute)]">
        ยังไม่มีใครในคลัง — <Link href="/content/people" className="underline">เพิ่มคนที่คลังบุคคล</Link>
      </p>
    );
  }
  return (
    <div className="space-y-2">
      <select
        value={value?.id ?? ""}
        onChange={(e) => onChange(e.target.value ? { id: e.target.value, pose: value?.pose ?? "auto" } : null)}
        className="w-full rounded-lg border border-[var(--ct-line)] bg-[var(--ct-panel)] px-3 py-2 text-sm"
      >
        <option value="">ไม่ใส่</option>
        {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {value && (
        <div role="radiogroup" aria-label="ท่าทาง" className="flex flex-wrap gap-1.5">
          {POSES.map((p) => (
            <button key={p.id} type="button" role="radio" aria-checked={value.pose === p.id} onClick={() => onChange({ ...value, pose: p.id })} className={chip(value.pose === p.id)}>
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
