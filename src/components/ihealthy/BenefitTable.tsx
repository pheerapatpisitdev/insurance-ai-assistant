import { benefitValue, isHeading, type BenefitEntry, type IHealthyFacts } from "@/lib/ihealthy-facts";

/**
 * The half of the benefit data the browser needs. `terms` and `disclaimer` are three of the
 * five kilobytes that would otherwise cross the wire, and only server components render
 * them, so the page passes this subset rather than the whole object.
 */
export type BenefitTableData = Pick<IHealthyFacts, "rows" | "plans" | "copayPercent">;

export interface BenefitTableProps {
  data: BenefitTableData;
  /** the plan whose column is highlighted */
  selected: string;
  /** the age the columns are read at; under 11 swaps in the child wording */
  age: number;
  /** the plan codes the company sells at this age, from `plansFor` */
  sellable: string[];
  /** the company's note that the rider and its endorsement share one annual ceiling */
  sharedLimit: string;
}

const DASH = "-";
/** What a column says, once in its header, when the company does not sell it at this age. */
const NOT_SOLD = "ไม่ขายที่อายุนี้";

export interface BenefitCell {
  /** what the cell prints */
  text: string;
  /** the company does not sell this plan at the age on screen, whatever the sheet holds */
  unavailable: boolean;
}

/**
 * What one plan's column says on one row.
 *
 * A cell the company left blank reads as a dash, not as an empty gap. `undefined` can only
 * mean the sheet has no column for that plan, which is an extraction bug rather than an
 * answer, so it reads as a dash too rather than being hidden.
 *
 * A plan the company will not sell at this age is a different thing from a plan that pays
 * nothing, and the difference is the caller's to draw: the sheet's figure is withheld — it
 * is not on offer, so printing it would be an offer — but the reason is said once in the
 * column header rather than thirty-six times down the column.
 *
 * It takes the whole union, not just a `BenefitRow`, because that is what `data.rows` holds:
 * a caller that walks the list without splitting the headings off gets an empty cell rather
 * than a heading's internals printed six times across.
 */
export function benefitCell(
  entry: BenefitEntry,
  plan: string,
  age: number,
  sellable: string[],
): BenefitCell {
  if (isHeading(entry)) return { text: "", unavailable: false };
  if (!sellable.includes(plan)) return { text: DASH, unavailable: true };
  const v = benefitValue(entry, plan, age);
  return { text: v === undefined || v.trim() === "" ? DASH : v, unavailable: false };
}

/** One width for the row titles, the heading labels above them, and the corner cell. */
const TITLE_W = "w-56 min-w-56 max-w-56";
/** The pinned row-title column. Opaque, or the rows scroll visibly through their own titles. */
const PIN = `sticky left-0 print:static ${TITLE_W} border-r border-[var(--lg-panel-line)] bg-[var(--lg-ground-deep)] px-3 text-left`;
/**
 * The plan names, and with them the one statement of why four columns are dashes at a child
 * age, stay on screen: the table is three and a half phone screens tall, and a header that
 * scrolls away takes the only thing that says what a column is.
 *
 * Its rule and the ground under it are a shadow rather than a border because the rows are
 * half-pixel tall: a collapsed border belongs to the table and scrolls away with it, and the
 * fraction it leaves behind is a sliver of the next row showing through the header's edge.
 */
const HEAD =
  "sticky top-0 print:static bg-[var(--lg-ground-deep)] py-2.5 shadow-[0_1px_0_var(--lg-ground-deep),inset_0_-1px_0_var(--lg-panel-line)]";

export function BenefitTable({ data, selected, age, sellable, sharedLimit }: BenefitTableProps) {
  const plans = data.plans;
  return (
    <div className="overflow-hidden rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)]">
      {/* A box that scrolls is a control: without a tabindex there is no way to reach the
          other five plans from a keyboard, and what it needs to hear when it lands there is
          what the box does. What the table is, its caption already says. */}
      <div
        className="max-h-[70vh] overflow-auto print:max-h-none print:overflow-visible focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--lg-gold)]"
        tabIndex={0}
        role="region"
        aria-label="เลื่อนตารางเพื่อดูแผนอื่น"
      >
        <table className="w-max min-w-full border-collapse text-xs">
          <caption className="sr-only">
            ตารางผลประโยชน์ ไอเฮลท์ตี้ อัลตร้า ทั้ง {plans.length} แผน
          </caption>
          <thead>
            <tr>
              {/* the corner is pinned in both directions at once, so it outranks both */}
              <th scope="col" className={`${PIN} ${HEAD} z-30 font-medium text-[var(--lg-mute)]`}>
                ผลประโยชน์
              </th>
              {plans.map((p) => {
                const sold = sellable.includes(p.code);
                return (
                  <th
                    key={p.code} scope="col"
                    /* The tint is laid over the ground rather than instead of it: a sticky
                       cell carrying only the translucent wash would let the rows it is
                       covering read through it. */
                    className={`${HEAD} z-20 min-w-28 px-3 text-center align-top font-medium ${
                      p.code === selected
                        ? "bg-[linear-gradient(var(--lg-gold-glow),var(--lg-gold-glow))] text-[var(--lg-gold-lit)]"
                        : "text-[var(--lg-mute)]"
                    }`}
                  >
                    {p.name}
                    {/* The ceiling stays even where the plan is not for sale — it is what the
                        whole table is organised around, and four columns of six lose it at a
                        child age. The six are read across the row against one another, which
                        is the one place in the table where the digits line up. */}
                    <span className="mt-0.5 block text-[0.65rem] font-normal tabular-nums opacity-80">
                      {(p.annualMax / 1_000_000).toLocaleString("en-US")} ล้าน
                    </span>
                    {/* The column out of play is dimmed in its cells, not here: this line is
                        the only place the reader is told why, and faded to match the dashes
                        below it, it would sit at 3:1 on the ground. */}
                    {!sold && <span className="block text-[0.65rem] font-normal">{NOT_SOLD}</span>}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {/* keyed by the wording rather than by `no`, which a sub-row like หมวดย่อยที่ 2.1
                does not have; the sheet's 41 titles and headings are all distinct */}
            {data.rows.map((entry) =>
              isHeading(entry) ? (
                // Sticky on the cell itself would do nothing — it is already as wide as the
                // table, so there is nothing for it to slide against, and a heading laid out
                // at that width runs off a phone. The label is pinned instead, and to the
                // width of the row titles it names, so it wraps where they wrap and stays
                // where they stay while the plans scroll past underneath.
                <tr key={entry.heading}>
                  <th
                    scope="colgroup" colSpan={plans.length + 1}
                    className="bg-[var(--lg-ground-deep)] py-2 text-left text-[0.7rem] font-medium leading-relaxed text-[var(--lg-gold)]"
                  >
                    <span className={`sticky left-0 print:static inline-block ${TITLE_W} px-3`}>{entry.heading}</span>
                  </th>
                </tr>
              ) : (
                <tr key={entry.title} className="border-t border-[var(--lg-panel-line)] align-top">
                  <th
                    scope="row"
                    className={`${PIN} z-10 py-2 text-[0.7rem] font-normal leading-relaxed text-[var(--lg-mute)]`}
                  >
                    {entry.title}
                  </th>
                  {plans.map((p) => {
                    const cell = benefitCell(entry, p.code, age, sellable);
                    return (
                      <td
                        key={p.code}
                        className={`px-3 py-2 text-center leading-relaxed ${
                          p.code === selected
                            ? "bg-[var(--lg-gold-glow)] text-[var(--lg-white)]"
                            : "text-[var(--lg-mute)]"
                        } ${cell.unavailable ? "opacity-75" : ""}`}
                      >
                        {cell.text}
                      </td>
                    );
                  })}
                </tr>
              ),
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-[var(--lg-panel-line)] px-3 py-2.5 text-[0.7rem] leading-relaxed text-[var(--lg-mute)] opacity-80">
        เลื่อนตารางไปทางขวาเพื่อดูแผนอื่น · {sharedLimit}
      </p>
    </div>
  );
}
