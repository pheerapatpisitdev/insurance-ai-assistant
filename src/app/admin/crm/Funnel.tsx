import { share } from "@/lib/crm/summary";
import type { Counts, Summary } from "@/lib/crm/types";

const PLAN_NAMES: Record<string, string> = {
  lifeprotect: "Life Protect",
  ihealthy: "iHealthy",
  undecided: "ยังไม่เลือกแผน",
};

const STEPS: { key: keyof Counts; label: string; colour: string }[] = [
  { key: "arrived", label: "ทักเข้ามา", colour: "#3b82f6" },
  { key: "told", label: "คุยต่อ", colour: "#6366f1" },
  { key: "priced", label: "ได้เบี้ยไป", colour: "#8b5cf6" },
  { key: "interested", label: "สนใจสมัคร", colour: "#d946ef" },
  { key: "formDone", label: "กรอกฟอร์ม", colour: "#ec4899" },
];

/**
 * Where the customers go.
 *
 * Drawn as a share of those who arrived rather than of the step before, because the question
 * the owner is asking is not "how leaky is this one join" but "of the hundred the advert paid
 * for, how many are worth calling".
 */
export function Funnel({ counts, byProduct }: { counts: Counts; byProduct: Summary["byProduct"] }) {
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3.5 text-sm font-semibold">ลูกค้าหล่นหายตรงไหน</h2>
        <div className="grid gap-2">
          {STEPS.map((s) => {
            const n = counts[s.key];
            return (
              <div key={s.key} className="grid grid-cols-[6rem_1fr_3rem] items-center gap-2.5 sm:grid-cols-[7rem_1fr_3.5rem]">
                <span className="text-xs text-slate-700 sm:text-sm">{s.label}</span>
                <div className="h-6 overflow-hidden rounded-md bg-slate-100">
                  {/* nothing at all rather than an empty bar: the padding on a zero-width div
                      still draws, and a row of those reads as a little data rather than none */}
                  {n > 0 && (
                    <div
                      className="flex h-full items-center rounded-md pl-2 text-xs font-semibold text-white"
                      style={{ width: `${Math.max(share(n, counts.arrived), 4)}%`, background: s.colour }}
                    >
                      {n}
                    </div>
                  )}
                </div>
                <span className="text-right text-xs tabular-nums text-slate-500">
                  {share(n, counts.arrived)}%
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3.5 text-sm font-semibold">เทียบตามแผน</h2>
        {byProduct.length === 0 ? (
          <p className="text-xs text-slate-400">ยังไม่มีข้อมูล</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs font-normal text-slate-500">
                  <th className="pb-2 text-left">แผน</th>
                  <th className="pb-2 text-right">ทัก</th>
                  <th className="pb-2 text-right">ได้เบี้ย</th>
                  <th className="pb-2 text-right">สนใจ</th>
                  <th className="pb-2 text-right">อัตราปิด</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map(({ product, counts: c }) => (
                  <tr key={product} className="border-t border-slate-100">
                    <td className="py-2">{PLAN_NAMES[product] ?? product}</td>
                    <td className="py-2 text-right tabular-nums">{c.arrived}</td>
                    <td className="py-2 text-right tabular-nums">{c.priced}</td>
                    <td className="py-2 text-right tabular-nums">{c.interested}</td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {share(c.interested, c.arrived)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
