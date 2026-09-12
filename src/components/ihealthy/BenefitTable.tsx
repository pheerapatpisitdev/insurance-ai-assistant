import { formatBaht } from "@/calc/money";
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
  /**
   * The daily cash the agency attaches as standard, in baht a day — absent above the age the
   * company writes it at. It does not vary with the health plan, so it is one cell across
   * them rather than the same figure printed six times.
   */
  dailyCash?: number;
  /**
   * The whole yearly premium under each plan, in satang, for the arrangement on screen —
   * null where that plan has no price at this age, and undefined for every plan when no
   * price may be shown at all.
   *
   * A table of what six plans pay, with the price of only one of them on the card above it,
   * is half a comparison: the figure a reader is weighing every row against is the one it
   * does not carry. It is also what a printed sheet has instead of a card.
   */
  premiums?: Record<string, number | null>;
}

/**
 * What a phone shows of a table built for a sheet of paper.
 *
 * Three plans and three figures, chosen by the user. Six columns of Thai do not fit a phone
 * at a size worth reading, and forty-one rows of them is a document rather than a
 * comparison — so a phone gets the middle three plans and the three figures that separate
 * them, and the whole table waits on a wider screen.
 *
 * The plan being quoted is always kept, whichever it is: a link can arrive carrying
 * แพลทินั่ม and a child is sold สมาร์ท, and the column the card is pricing must not be the
 * one column missing from the table under it.
 */
export const PHONE_PLANS = ["BRONZE", "SILVER", "GOLD"];
/** หมวด 1 is the room rate, หมวด 18 the outpatient allowance; the ceiling has its own row. */
const PHONE_ROWS = [1, 18];
/** Hidden at every width, restored from the tablet breakpoint up. */
const WIDE_ONLY_CELL = "hidden sm:table-cell";
const WIDE_ONLY_ROW = "hidden sm:table-row";

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

/**
 * One width for the row titles, the heading labels above them, and the corner cell.
 *
 * Narrower on a phone, where three plans and a title have to share 375 points: at the wide
 * width the table would be 561 and would scroll sideways, which is the thing the phone
 * table exists to avoid.
 */
const TITLE_W = "w-28 min-w-28 max-w-28 sm:w-56 sm:min-w-56 sm:max-w-56";
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
  "bg-[var(--lg-ground-deep)] py-2.5 shadow-[0_1px_0_var(--lg-ground-deep),inset_0_-1px_0_var(--lg-panel-line)]";
/**
 * The rule between one plan's column and the next.
 *
 * Forty-one rows of Thai across seven columns is a lot of text to hold a line through: the
 * row rules alone leave the eye to guess which figure belongs to which plan halfway down.
 * Not on the last column, which would draw an edge the table does not have.
 */
const COLUMN_RULE = "border-r border-[var(--lg-panel-line)] last:border-r-0";

export function BenefitTable(
  { data, selected, age, sellable, sharedLimit, premiums, dailyCash }: BenefitTableProps,
) {
  const plans = data.plans;
  /** A column a phone keeps: one of the three, or the one the card is pricing. */
  const onPhone = (code: string) => PHONE_PLANS.includes(code) || code === selected;
  return (
    <div>
      {/* No height of its own: the table runs its full length down the page, so a reader
          scrolls the page rather than a window inside it. Sideways is the one direction that
          still has to scroll — six plans of Thai will not fit a phone at any size worth
          reading — and a box that scrolls is a control, so it takes a tabindex and says what
          it does. What the table is, its caption already says.

          The header does not follow the reader down: sideways scrolling needs a scroll
          container, and a cell can only stick inside the nearest one — which no longer has a
          height to stick within. The chosen plan's column stays tinted the whole way down,
          which is the column a reader is following. */}
      <div
        className="overflow-x-auto print:overflow-visible focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--lg-gold)]"
        tabIndex={0}
        role="region"
        aria-label="เลื่อนตารางเพื่อดูแผนอื่น"
      >
        {/* A phone gets a table sized to its box, so three plans and their titles share the
              width and the Thai wraps; a wide screen gets one sized to its content. */}
          <table className="w-full border-collapse text-xs sm:w-max sm:min-w-full">
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
                    className={`${HEAD} ${COLUMN_RULE} ${onPhone(p.code) ? "" : WIDE_ONLY_CELL} z-20 min-w-0 px-1.5 text-center align-top font-medium sm:min-w-28 sm:px-3 ${
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
                    <span className="mt-0.5 hidden text-[0.65rem] font-normal tabular-nums opacity-80 sm:block">
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
            {/* On a wide screen the ceiling rides in the column header, where the six read
                across against one another. A phone has no room for a two-line header and
                only three columns to read across, so it takes a row of its own — the first
                thing under the price, which is the pair a reader weighs. */}
            <tr className="border-t border-[var(--lg-panel-line)] sm:hidden">
              <th
                scope="row"
                className={`${PIN} z-10 py-2.5 text-[0.7rem] font-medium leading-relaxed text-[var(--lg-white)]`}
              >
                วงเงินค่ารักษาต่อปี
              </th>
              {plans.map((p) => (
                <td
                  key={p.code}
                  className={`${COLUMN_RULE} ${onPhone(p.code) ? "" : WIDE_ONLY_CELL} px-1.5 py-2.5 text-center tabular-nums sm:px-3 ${
                    p.code === selected ? "bg-[var(--lg-gold-glow)] text-[var(--lg-white)]" : "text-[var(--lg-mute)]"
                  }`}
                >
                  {(p.annualMax / 1_000_000).toLocaleString("en-US")} ล้าน
                </td>
              ))}
            </tr>
            {/* Not one of the company's twenty-eight categories: a second contract the
                agency sells alongside this one, whose figure the premium row above already
                counts. Spanning the plans rather than repeating in each says what is true —
                it is the same cover whichever health plan is bought. */}
            {dailyCash !== undefined && (
              <tr className="border-t border-[var(--lg-panel-line)]">
                <th
                  scope="row"
                  className={`${PIN} z-10 py-2.5 text-[0.7rem] font-medium leading-relaxed text-[var(--lg-white)]`}
                >
                  ค่าชดเชยรายวัน
                </th>
                <td
                  colSpan={plans.length}
                  className="px-1.5 py-2.5 text-center text-[var(--lg-white)] sm:px-3"
                >
                  <span className="tabular-nums">{dailyCash.toLocaleString("en-US")}</span> ต่อวัน
                  <span className="ml-2 text-[0.65rem] text-[var(--lg-mute)]">ทุกแผนเท่ากัน</span>
                </td>
              </tr>
            )}
            {premiums && (
              <tr className="border-t border-[var(--lg-panel-line)]">
                <th
                  scope="row"
                  className={`${PIN} z-10 py-2.5 text-[0.7rem] font-medium leading-relaxed text-[var(--lg-white)]`}
                >
                  เบี้ยรวมต่อปี
                </th>
                {plans.map((p) => {
                  const premium = premiums[p.code];
                  return (
                    <td
                      key={p.code}
                      className={`${COLUMN_RULE} ${onPhone(p.code) ? "" : WIDE_ONLY_CELL} px-1.5 py-2.5 text-center font-medium tabular-nums sm:px-3 ${
                        p.code === selected
                          ? "bg-[var(--lg-gold-glow)] text-[var(--lg-gold)]"
                          : "text-[var(--lg-white)]"
                      }`}
                    >
                      {premium === null || premium === undefined ? DASH : formatBaht(premium)}
                    </td>
                  );
                })}
              </tr>
            )}
            {/* keyed by the wording rather than by `no`, which a sub-row like หมวดย่อยที่ 2.1
                does not have; the sheet's 41 titles and headings are all distinct */}
            {data.rows.map((entry) =>
              isHeading(entry) ? (
                // Sticky on the cell itself would do nothing — it is already as wide as the
                // table, so there is nothing for it to slide against, and a heading laid out
                // at that width runs off a phone. The label is pinned instead, and to the
                // width of the row titles it names, so it wraps where they wrap and stays
                // where they stay while the plans scroll past underneath.
                <tr key={entry.heading} className={WIDE_ONLY_ROW}>
                  <th
                    scope="colgroup" colSpan={plans.length + 1}
                    className="bg-[var(--lg-ground-deep)] py-2 text-left text-[0.7rem] font-medium leading-relaxed text-[var(--lg-gold)]"
                  >
                    <span className={`sticky left-0 print:static inline-block ${TITLE_W} px-3`}>{entry.heading}</span>
                  </th>
                </tr>
              ) : (
                <tr
                  key={entry.title}
                  className={`border-t border-[var(--lg-panel-line)] align-top ${
                    entry.no !== null && PHONE_ROWS.includes(entry.no) ? "" : WIDE_ONLY_ROW
                  }`}
                >
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
                        className={`${COLUMN_RULE} ${onPhone(p.code) ? "" : WIDE_ONLY_CELL} px-1.5 py-2 text-center leading-relaxed sm:px-3 ${
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
      <p className="border-t border-[var(--lg-panel-line)] py-2.5 text-[0.7rem] leading-relaxed text-[var(--lg-mute)] opacity-80">
        {/* A phone is shown three rows of the twenty-eight, so it is told what the other
            twenty-five do rather than left to read the table as the whole contract. */}
        <span className="sm:hidden">
          อีก 25 หมวดจ่ายตามจริงเท่ากันทุกแผน รวมผ่าตัด อุบัติเหตุ และมะเร็ง · ดูตารางเต็มได้บนจอคอมพิวเตอร์ ·{" "}
        </span>
        {/* on paper there is nothing to scroll to, and the whole table is already there */}
        <span className="hidden print:hidden sm:inline">เลื่อนตารางไปทางขวาเพื่อดูแผนอื่น · </span>
        {sharedLimit}
      </p>
    </div>
  );
}
