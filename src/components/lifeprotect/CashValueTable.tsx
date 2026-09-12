import { formatBaht } from "@/calc/money";
import type { Projection } from "@/lib/cash-projection";

export interface CashValueTableProps {
  projection: Projection;
  /** the line above the table, e.g. "ทุนประกัน 1,000,000 บาท · ชาย 35 ปี · ถึงอายุ 99" */
  caption: string;
}

const HEAD = ["ปีที่", "อายุ", "เบี้ย/ปี", "เบี้ยสะสม", "เวนคืนได้", "คุ้มครอง"];

/** every column but the first is ruled off from the one before it */
const RULE = "border-l border-l-white/10";
const CELL = "whitespace-nowrap border-b border-white/5 px-[5px] py-1.5";

/**
 * Every year of the contract, open on arrival — the rows scroll inside their own box, so a
 * sixty-four-year contract still leaves the chat buttons where they were.
 *
 * The years that are worth nothing are shown rather than filtered out, with a note under the
 * table that counts them. A customer should meet that fact before signing, not on the day
 * they try to surrender.
 */
export function CashValueTable({ projection, caption }: CashValueTableProps) {
  const { rows, breakEven, zeroYears, maturityAge } = projection;
  if (!rows.length) return null;

  return (
    <section className="mt-3.5 border-t border-[var(--lg-panel-line)] pt-3">
      <h4 className="text-sm font-normal text-[var(--lg-gold)]">มูลค่าทุกปี</h4>

      <p className="mt-2.5 rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-gold-glow)] px-3 py-2.5 text-xs leading-[1.75] tabular-nums text-[var(--lg-gold-lit)]">
        {caption}
      </p>

      <div className="-mx-2.5 mt-2.5 max-h-[56vh] w-[calc(100%+1.25rem)] overflow-auto rounded-sm border border-[var(--lg-panel-line)]">
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
              // a year worth nothing yet says so by receding, not by being hidden
              const dim = r.cashValue === 0 ? "opacity-55" : "";
              return (
                <tr
                  key={r.policyYear}
                  className={breakEven?.policyYear === r.policyYear ? "bg-[var(--lg-gold-glow)] text-[var(--lg-gold-lit)]" : ""}
                >
                  <td className={`${CELL} text-left text-[var(--lg-mute)]`}>{r.policyYear}</td>
                  <td className={`${CELL} ${RULE} text-left text-[var(--lg-mute)]`}>{r.age}</td>
                  <td className={`${CELL} ${RULE} text-right ${dim}`}>
                    {r.premiumDue ? formatBaht(r.premiumDue) : "—"}
                  </td>
                  <td className={`${CELL} ${RULE} text-right ${dim}`}>
                    {r.premiumPaid === null ? "—" : formatBaht(r.premiumPaid)}
                  </td>
                  <td className={`${CELL} ${RULE} text-right ${dim}`}>{formatBaht(r.cashValue)}</td>
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
