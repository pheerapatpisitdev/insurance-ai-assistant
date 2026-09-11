import type { Projection, ProjectionRow } from "@/lib/cash-projection";

const W = 340, H = 190, LEFT = 46, RIGHT = 8, TOP = 12, BOTTOM = 24;

/** 1,112,000 → "1.1 ล้าน". The vertical axis carries one label, so it must read at a glance. */
function short(baht: number): string {
  if (baht >= 1_000_000) {
    const m = baht / 1_000_000;
    return `${m % 1 ? m.toFixed(1) : m.toFixed(0)} ล้าน`;
  }
  if (baht >= 100_000) return `${Math.round(baht / 100_000)} แสน`;
  return baht.toLocaleString("en-US");
}

export interface CashValueChartProps {
  projection: Projection;
  /** the insured's age at issue — where the horizontal axis starts */
  age: number;
}

/**
 * The gold line is what the policy is worth, the grey one what it has cost. Where gold
 * overtakes grey is the answer to the question customers ask out loud.
 *
 * The table below is the screen-reader's copy of this, so the drawing is one role="img"
 * with a sentence on it rather than sixty-four announced points.
 */
export function CashValueChart({ projection, age }: CashValueChartProps) {
  const { rows, breakEven, maturityAge } = projection;
  if (!rows.length) return null;

  const top = Math.max(...rows.map((r) => Math.max(r.cover, r.cashValue, r.premiumPaid ?? 0))) || 1;
  const x = (at: number) => LEFT + ((at - age) / (maturityAge - age)) * (W - LEFT - RIGHT);
  const y = (satang: number) => H - BOTTOM - (satang / top) * (H - BOTTOM - TOP);
  const path = (pick: (r: ProjectionRow) => number) =>
    rows.map((r) => `${x(r.age).toFixed(1)},${y(pick(r)).toFixed(1)}`).join(" ");

  /**
   * The cover holds all year and then drops on one birthday, so it is drawn as a step —
   * a sloped line between two years would say the family loses it gradually, which is not
   * what the policy does.
   */
  const coverPath = rows
    .flatMap((r) => [`${x(r.age).toFixed(1)},${y(r.cover).toFixed(1)}`, `${x(r.age + 1).toFixed(1)},${y(r.cover).toFixed(1)}`])
    .join(" ");
  const coverDrops = rows.some((r) => r.cover !== rows[0].cover);

  const ticks = [...new Set([age, 60, 80, maturityAge])].filter((a) => a >= age && a <= maturityAge);
  // a label near the right edge has to flip left, or its text runs outside the drawing
  const flip = breakEven ? x(breakEven.age) > W * 0.62 : false;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`} width="100%" role="img"
      aria-label={`กราฟเปรียบเทียบความคุ้มครองชีวิต เบี้ยที่จ่ายสะสม และมูลค่าเวนคืนเงินสด${
        coverDrops ? ` ความคุ้มครองลดลงเมื่ออายุ ${rows.find((r) => r.cover !== rows[0].cover)!.age} ปี` : ""
      }${breakEven ? ` มูลค่าเวนคืนเท่ากับเบี้ยที่จ่ายเมื่ออายุ ${breakEven.age} ปี` : ""}`}
      className="mt-2.5 block overflow-visible"
    >
      <line x1={LEFT} y1={H - BOTTOM} x2={W - RIGHT} y2={H - BOTTOM} stroke="var(--lg-panel-line)" />
      <line x1={LEFT} y1={TOP} x2={LEFT} y2={H - BOTTOM} stroke="var(--lg-panel-line)" />
      <text x={LEFT - 6} y={y(top) + 4} fill="var(--lg-mute)" fontSize="10" textAnchor="end">
        {short(Math.round(top / 100))}
      </text>
      <text x={LEFT - 6} y={H - BOTTOM + 4} fill="var(--lg-mute)" fontSize="10" textAnchor="end">0</text>
      {ticks.map((at) => (
        <text key={at} x={x(at)} y={H - 8} fill="var(--lg-mute)" fontSize="10" textAnchor="middle">{at}</text>
      ))}
      <polyline
        fill="none" stroke="rgba(245,245,245,.3)" strokeWidth="1.5" strokeDasharray="4 3"
        points={coverPath}
      />
      {rows[0].premiumPaid !== null && (
        <polyline
          fill="none" stroke="rgba(245,245,245,.5)" strokeWidth="1.5" strokeLinejoin="round"
          points={path((r) => r.premiumPaid!)}
        />
      )}
      <polyline
        fill="none" stroke="var(--lg-gold)" strokeWidth="2" strokeLinejoin="round"
        points={path((r) => r.cashValue)}
      />
      {breakEven && (
        <>
          <circle
            cx={x(breakEven.age)} cy={y(breakEven.cashValue)} r="4"
            fill="var(--lg-gold-lit)" stroke="var(--lg-ground-deep)" strokeWidth="1.5"
          />
          <text
            x={x(breakEven.age) + (flip ? -8 : 8)} y={y(breakEven.cashValue) - 9}
            fill="var(--lg-gold-lit)" fontSize="11" textAnchor={flip ? "end" : "start"}
          >
            เท่าทุนอายุ {breakEven.age}
          </text>
        </>
      )}
    </svg>
  );
}
