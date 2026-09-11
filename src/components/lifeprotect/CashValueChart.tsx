"use client";
import { useState } from "react";
import { formatBaht } from "@/calc/money";
import type { Projection, ProjectionRow } from "@/lib/cash-projection";

const W = 340, H = 190, LEFT = 46, RIGHT = 8, TOP = 12, BOTTOM = 24;

const GOLD = "var(--lg-gold)";
const GREY = "rgba(245,245,245,.5)";
const COVER = "rgba(245,245,245,.3)";

/** 1,112,000 → "1.1 ล้าน". The vertical axis carries two labels, so they must read at a glance. */
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
 * The gold line is what the policy is worth, the grey one what it has cost, the dashed one
 * what the family would receive. Where gold overtakes grey is the answer to the question
 * customers ask out loud.
 *
 * Dragging across it reads out any single year. The readout sits above the drawing rather
 * than floating beside the finger, because on a phone the finger covers the very point being
 * asked about — and a panel that stays put is one an agent can read aloud while the customer
 * scrubs.
 */
export function CashValueChart({ projection, age }: CashValueChartProps) {
  const { rows, breakEven, maturityAge } = projection;
  // opening on the break-even year shows the readout working and names the year that matters
  const [picked, setPicked] = useState(() => (breakEven ? breakEven.policyYear - 1 : rows.length - 1));
  if (!rows.length) return null;

  const here = rows[Math.min(picked, rows.length - 1)];
  const top = Math.max(...rows.map((r) => Math.max(r.cover, r.cashValue, r.premiumPaid ?? 0))) || 1;
  const x = (at: number) => LEFT + ((at - age) / (maturityAge - age)) * (W - LEFT - RIGHT);
  const y = (satang: number) => H - BOTTOM - (satang / top) * (H - BOTTOM - TOP);
  const path = (pick: (r: ProjectionRow) => number) =>
    rows.map((r) => `${x(r.age).toFixed(1)},${y(pick(r)).toFixed(1)}`).join(" ");

  /**
   * The cover holds all year and then drops on one birthday, so it is drawn as a step — a
   * sloped line between two years would say the family loses it gradually, which is not what
   * the policy does.
   */
  const coverPath = rows
    .flatMap((r) => [`${x(r.age).toFixed(1)},${y(r.cover).toFixed(1)}`, `${x(r.age + 1).toFixed(1)},${y(r.cover).toFixed(1)}`])
    .join(" ");

  /**
   * One gridline, at the level the cover settles to — which is the sum assured, the number
   * the customer picked. It reads the dashed line's lower step for them. Skipped when it
   * would sit on top of an axis label it would otherwise explain.
   */
  const settledCover = rows[rows.length - 1].cover;
  const grid = settledCover < top * 0.92 && settledCover > top * 0.08 ? settledCover : null;

  const ticks = [...new Set([age, 60, 80, maturityAge])].filter((a) => a >= age && a <= maturityAge);

  /** which year a touch anywhere in the drawing is asking about */
  const pickFrom = (clientX: number, box: DOMRect) => {
    const inView = ((clientX - box.left) / box.width) * W;
    const at = ((inView - LEFT) / (W - LEFT - RIGHT)) * (maturityAge - age) + age;
    setPicked(Math.max(0, Math.min(rows.length - 1, Math.round(at - age))));
  };

  const readout: [string, string, number | null][] = [
    ["เบี้ยสะสม", GREY, here.premiumPaid],
    ["มูลค่าเวนคืนเงินสด", GOLD, here.cashValue],
    ["ความคุ้มครองเสียชีวิต", COVER, here.cover],
  ];

  return (
    <div className="mt-2">
      <dl className="rounded-sm border border-[var(--lg-hair)] bg-[var(--lg-panel)] px-3 py-2.5">
        <div className="mb-2 border-b border-[var(--lg-panel-line)] pb-1.5 text-xs font-medium text-[var(--lg-white)]">
          อายุ {here.age} ปี · สิ้นปีที่ {here.policyYear}
        </div>
        {readout.map(([label, colour, value]) => value === null ? null : (
          <div key={label} className="flex items-baseline justify-between gap-3 py-0.5">
            <dt className="flex items-center gap-2 text-xs text-[var(--lg-mute)]">
              <i className="inline-block h-2 w-2 rounded-full" style={{ background: colour }} />
              {label}
            </dt>
            <dd className="text-sm tabular-nums text-[var(--lg-white)]">{formatBaht(value)}</dd>
          </div>
        ))}
      </dl>

      <svg
        viewBox={`0 0 ${W} ${H}`} width="100%" role="img" tabIndex={0}
        aria-label={`กราฟความคุ้มครองชีวิต เบี้ยที่จ่ายสะสม และมูลค่าเวนคืนเงินสด ตั้งแต่อายุ ${age} ถึง ${maturityAge} ปี${
          breakEven ? ` มูลค่าเวนคืนเท่ากับเบี้ยที่จ่ายเมื่ออายุ ${breakEven.age} ปี` : ""
        } ใช้ปุ่มลูกศรซ้ายขวาเพื่อดูทีละปี`}
        className="mt-2 block touch-none select-none overflow-visible focus-visible:outline focus-visible:outline-1 focus-visible:outline-[var(--lg-gold)]"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          pickFrom(e.clientX, e.currentTarget.getBoundingClientRect());
        }}
        onPointerMove={(e) => {
          // a mouse reads out on hover; a finger only while it is down
          if (e.buttons === 0 && e.pointerType !== "mouse") return;
          pickFrom(e.clientX, e.currentTarget.getBoundingClientRect());
        }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
          e.preventDefault();
          setPicked((i) => Math.max(0, Math.min(rows.length - 1, i + (e.key === "ArrowRight" ? 1 : -1))));
        }}
      >
        <line x1={LEFT} y1={H - BOTTOM} x2={W - RIGHT} y2={H - BOTTOM} stroke="var(--lg-panel-line)" />
        <line x1={LEFT} y1={TOP} x2={LEFT} y2={H - BOTTOM} stroke="var(--lg-panel-line)" />
        <text x={LEFT - 6} y={y(top) + 4} fill="var(--lg-mute)" fontSize="10" textAnchor="end">
          {short(Math.round(top / 100))}
        </text>
        <text x={LEFT - 6} y={H - BOTTOM + 4} fill="var(--lg-mute)" fontSize="10" textAnchor="end">0</text>
        {grid !== null && (
          <>
            <line x1={LEFT} y1={y(grid)} x2={W - RIGHT} y2={y(grid)} stroke="var(--lg-panel-line)" />
            <text x={LEFT - 6} y={y(grid) + 4} fill="var(--lg-mute)" fontSize="10" textAnchor="end">
              {short(Math.round(grid / 100))}
            </text>
          </>
        )}
        {ticks.map((at) => (
          <text key={at} x={x(at)} y={H - 8} fill="var(--lg-mute)" fontSize="10" textAnchor="middle">{at}</text>
        ))}

        <line
          x1={x(here.age)} y1={TOP - 4} x2={x(here.age)} y2={H - BOTTOM}
          stroke="var(--lg-mute)" strokeWidth="1" strokeDasharray="3 3"
        />

        <polyline fill="none" stroke={COVER} strokeWidth="1.5" strokeDasharray="4 3" points={coverPath} />
        {here.premiumPaid !== null && (
          <polyline fill="none" stroke={GREY} strokeWidth="1.5" strokeLinejoin="round" points={path((r) => r.premiumPaid!)} />
        )}
        <polyline fill="none" stroke={GOLD} strokeWidth="2" strokeLinejoin="round" points={path((r) => r.cashValue)} />

        {([["cover", here.cover, COVER], ["paid", here.premiumPaid, GREY], ["cash", here.cashValue, GOLD]] as [string, number | null, string][])
          .map(([key, value, colour]) => value === null ? null : (
            <circle
              key={key} cx={x(here.age)} cy={y(value)} r="3.5"
              fill={colour} stroke="var(--lg-ground-deep)" strokeWidth="1.5"
            />
          ))}
      </svg>

      <div className="mt-1.5 text-center text-[11px] text-[var(--lg-mute)] opacity-70">
        ลากบนกราฟเพื่อดูตัวเลขของปีอื่น
      </div>
    </div>
  );
}
