import type { Warning } from "@/calc/types";

export function WarningList({ warnings }: { warnings: Warning[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="space-y-2">
      {warnings.map((w) => (
        <li
          key={w.code + w.message}
          className={
            w.level === "error"
              ? "rounded-md border border-[var(--bot-red)] bg-[var(--bot-red-soft)] px-3 py-2 text-sm text-[var(--bot-red-ink)]"
              : "rounded-md border border-[var(--bot-sand-line)] bg-[var(--bot-sand-soft)] px-3 py-2 text-sm text-[var(--bot-sand-ink)]"
          }
        >
          {w.message}
        </li>
      ))}
    </ul>
  );
}
