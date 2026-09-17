import { formatBaht } from "@/calc/money";
import type { Projection } from "@/lib/cash-projection";
import { CardButton } from "@/components/sales/CardButton";

export interface CashValueTableProps {
  projection: Projection;
  /** the line above the table, e.g. "ทุนประกัน 1,000,000 บาท · ชาย 35 ปี · ถึงอายุ 99" */
  caption: string;
  /**
   * Where the same table is drawn as a picture. Given, the heading carries a button that
   * hands it over — a table this long is the one thing on the page nobody can screenshot.
   */
  cardPath?: string;
}

const HEAD = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"];

/** every column but the first is ruled off from the one before it */
const RULE = "border-l border-l-white/10";
const CELL = "whitespace-nowrap border-b border-white/5 px-[5px] py-1.5";

/**
 * Every year of the contract, laid out in full.
 *
 * It used to scroll inside its own box so that a sixty-four-year contract left the rest of
 * the page where it was. The owner asked for the box gone, so the page is as long as the
 * contract now — see the note above the table for what that took with it and how the column
 * headings were got back.
 *
 * The years that are worth nothing are shown rather than filtered out, and at the same weight
 * as every other row. A customer should meet that fact before signing, not on the day they
 * try to surrender — and it is said plainly, by the 0 in the column and by the note
 * underneath, rather than by making the numbers harder to read.
 */
export function CashValueTable({ projection, caption, cardPath }: CashValueTableProps) {
  const { rows, breakEven, zeroYears, maturityAge } = projection;
  if (!rows.length) return null;

  return (
    <section className="mt-3.5 border-t border-[var(--lg-panel-line)] pt-3">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-normal text-[var(--lg-gold)]">มูลค่าทุกปี</h4>
        {cardPath && (
          <CardButton
            path={cardPath}
            filename="value-table.png"
            label={{ full: "บันทึกตารางเป็นรูป", compact: "บันทึกตาราง" }}
            className="rounded-sm border border-[var(--lg-gold)] px-3 py-1.5 text-xs font-medium text-[var(--lg-gold)]"
          />
        )}
      </div>

      <p className="mt-2.5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-gold-glow)] px-3 py-2.5 text-xs leading-[1.75] tabular-nums text-[var(--lg-gold-lit)]">
        {caption}
      </p>

      {/* Laid out in full rather than scrolled inside a box, which the owner asked for after
          living with the box: a table you scroll inside a page you also scroll is two
          scrolls fighting each other, and on a phone the inner one swallows the outer.

          What that costs is the thing the box was for — a sixty-four-year contract now runs
          to sixty-four rows of page, and whatever was under the table is a long way under it.

          The sideways scroll is kept only where it is needed, and that is not tidiness. CSS
          will not let a box scroll in one direction and stay open in the other: set
          `overflow-x`, and `overflow-y` becomes a scroller too, which makes the box the
          thing the sticky header sticks to — and a box as tall as its contents is one the
          header can never stick within. Measured rather than assumed: at row 25 of 50 the
          header sat 376px above the top of the screen, so from about row 12 the reader had
          six columns of numbers and nothing saying which was which.

          Past 1024px the table fits the column beside the menu, so there is no box and the
          header sticks to the page instead. Below that the box comes back, because six
          columns of `whitespace-nowrap` do not fit 375px and never will — there the headings
          still scroll away, which is the part of this not yet solved. */}
      <div className="-mx-2.5 mt-2.5 w-[calc(100%+1.25rem)] max-lg:overflow-x-auto">
        <table className="w-full border-collapse text-xs tabular-nums">
          <thead>
            <tr>
              {HEAD.map((h, i) => (
                <th
                  key={h}
                  scope="col"
                  /* sticky alone is not enough: without the stack order the rows scroll
                     through the header's own text */
                  className={`sticky top-0 z-[2] whitespace-nowrap border-b border-[var(--lg-hair)]
                    bg-[var(--lg-ground-deep)] px-[5px] py-[7px] text-[11px] font-normal text-[var(--lg-mute)]
                    ${i < 2 ? "text-left" : "text-right"} ${i > 0 ? RULE : ""}
                    ${i === HEAD.length - 1 ? "pr-3" : ""}`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              /**
               * Every row is the same weight, including the early years worth nothing.
               *
               * They used to recede at 55% opacity, on the argument that a year with no
               * surrender value should say so by fading. Two things were wrong with it. The
               * fact was already said twice over — the เวนคืนได้ column reads 0, and the note
               * under the table names the years by number — so the fade carried nothing the
               * reader did not already have. And it was not even applied consistently: the
               * iShield skin switches it off for the whole page, because on ivory the fade
               * drops that text to between 2.95 and 4.21 to one. So the same table was
               * already being shown two different ways on three pages.
               *
               * Dropping it here settles that the other way, which is what the owner asked
               * for and what the one skin that had thought about it had already done.
               */
              return (
                <tr
                  key={r.policyYear}
                  className={breakEven?.policyYear === r.policyYear ? "bg-[var(--lg-gold-glow)] text-[var(--lg-gold-lit)]" : ""}
                >
                  <td className={`${CELL} text-left text-[var(--lg-mute)]`}>{r.policyYear}</td>
                  <td className={`${CELL} ${RULE} text-left text-[var(--lg-mute)]`}>{r.age}</td>
                  <td className={`${CELL} ${RULE} text-right`}>
                    {r.premiumDue ? formatBaht(r.premiumDue) : "—"}
                  </td>
                  <td className={`${CELL} ${RULE} text-right`}>
                    {r.premiumPaid === null ? "—" : formatBaht(r.premiumPaid)}
                  </td>
                  <td className={`${CELL} ${RULE} text-right`}>{formatBaht(r.cashValue)}</td>
                  <td className={`${CELL} ${RULE} pr-3 text-right`}>{formatBaht(r.cover)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {zeroYears > 0 && (
        <p className="mt-2.5 border-l-2 border-[var(--lg-gold-deep)] py-2 pl-3 text-xs leading-[1.8] text-[var(--lg-mute)]">
          <span className="font-medium text-[var(--lg-gold-lit)]">
            {zeroYears === 1 ? "ปีที่ 1" : `ปีที่ 1–${zeroYears}`} ยังไม่มีมูลค่าเวนคืน
          </span>{" "}
          เบี้ยช่วงต้นถูกใช้ไปกับค่าใช้จ่ายในการออกกรมธรรม์ เป็นปกติของประกันตลอดชีพทุกบริษัท
          แบบนี้เน้นความคุ้มครอง ไม่ใช่การออมระยะสั้น
        </p>
      )}
      <p className="mt-2 px-0.5 text-[11.5px] leading-[1.7] text-[var(--lg-mute)] opacity-80">
        แถวสุดท้าย (ปีที่ {rows.length}) คือเงินที่ได้รับเมื่อครบสัญญาอายุ {maturityAge} ปี
      </p>
    </section>
  );
}
