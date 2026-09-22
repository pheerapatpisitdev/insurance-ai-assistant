import type { Metadata } from "next";
import "../other-plans/theme.css";

export const metadata: Metadata = { title: "บำนาญ สมาร์ท 95 — คำนวณเบี้ยและเงินบำนาญ" };

/** A tool like the calculator it sits beside in the menu, so it wears the same palette. */
export default function PensionLayout({ children }: { children: React.ReactNode }) {
  return <div className="other-plans">{children}</div>;
}
