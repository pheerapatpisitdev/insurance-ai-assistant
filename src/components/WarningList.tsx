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
              ? "rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
              : "rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          }
        >
          {w.message}
        </li>
      ))}
    </ul>
  );
}
