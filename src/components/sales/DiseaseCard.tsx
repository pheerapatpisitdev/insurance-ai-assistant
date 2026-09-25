import { H2 } from "@/components/sales/Blocks";

export interface DiseaseGroup {
  /** the policy's own name for the group; a contract with one list has none */
  title?: string;
  /** what the group pays, in a line under its title */
  note?: string;
  names: readonly string[];
}

/**
 * A contract's illnesses, laid out as a card on the page and open from the start.
 *
 * The owner asked for the list to be shown as a card rather than behind a fold (2026-09-25).
 * It is drawn here in the page's own type rather than as the picture the calculator hands
 * over: that picture is three columns across 1,700 pixels, and on a phone it would shrink to
 * text nobody could read without zooming. This one is one column on a phone and two on a
 * wider screen, and numbers each group from 1, the same way the picture does.
 */
export function DiseaseCard(
  { plan, total, groups, footnote }:
    { plan: string; total: number; groups: DiseaseGroup[]; footnote?: React.ReactNode },
) {
  return (
    <div className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] p-5 sm:p-6">
      <p className="text-xs font-medium tracking-wide text-[var(--lg-gold)]">{plan}</p>
      <div className="mt-1.5">
        <H2>คุ้มครอง {total} โรคร้ายแรง</H2>
      </div>
      <div className="mt-4 space-y-6 border-t border-[var(--lg-panel-line)] pt-5">
        {groups.map((g, gi) => (
          <div key={g.title ?? gi}>
            {g.title && <h3 className="text-sm font-medium text-[var(--lg-white)]">{g.title}</h3>}
            {g.note && <p className="mt-1 text-xs text-[var(--lg-gold)]">{g.note}</p>}
            <ol className={`space-y-1.5 text-sm leading-[1.85] text-[var(--lg-mute)] sm:columns-2 sm:gap-x-8 ${g.title || g.note ? "mt-3" : ""}`}>
              {g.names.map((d, i) => (
                <li key={d} className="flex gap-2.5 break-inside-avoid">
                  <span className="shrink-0 tabular-nums text-[var(--lg-gold)] opacity-70">{i + 1}.</span>
                  <span>{d}</span>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
      {footnote && (
        <p className="mt-5 border-t border-[var(--lg-panel-line)] pt-4 text-xs leading-[1.9] text-[var(--lg-mute)] opacity-80">
          {footnote}
        </p>
      )}
    </div>
  );
}
