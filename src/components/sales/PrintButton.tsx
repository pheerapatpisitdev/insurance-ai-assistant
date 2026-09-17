"use client";
import { useRef } from "react";

/**
 * Hands the table to the browser's own print pipeline, where "Save as PDF" is waiting.
 *
 * Nothing is generated here and that is the point. The text stays vector, so the file is
 * sharp at any zoom and the figures can be selected out of it; and the Thai is shaped by the
 * browser, which is what a PDF library would have had to be taught to do. Combining marks in
 * a word like เบี้ยสะสม are exactly where those get it wrong, on a document that goes to a
 * customer. That trade was put to the owner against a one-tap file, and this is the side they
 * chose.
 *
 * The rest of the page is hidden by walking up from the table and marking every sibling on
 * the way, rather than by the usual trick of hiding everything and pulling the target to the
 * top with `position: absolute`. That trick was tried first and printed a blank sheet: the
 * sales pages give every direct child of `.theme-legacy` `position: relative`, so "the top"
 * meant the top of some element halfway down the document. Hiding siblings needs to know
 * nothing about the page it is on, which is the property worth having here — six sales pages
 * with three different skins are what this runs inside.
 */
const MARK = "data-print-hide";

export function PrintButton({ className }: { className: string }) {
  const ref = useRef<HTMLButtonElement>(null);

  const print = () => {
    const target = ref.current?.closest(".print-table");
    const hidden: Element[] = [];

    if (target) {
      for (let node: Element | null = target; node && node !== document.body; node = node.parentElement) {
        for (const sibling of Array.from(node.parentElement?.children ?? [])) {
          if (sibling !== node) {
            sibling.setAttribute(MARK, "");
            hidden.push(sibling);
          }
        }
      }
    }

    const restore = () => {
      for (const el of hidden) el.removeAttribute(MARK);
    };

    // Chrome returns from print() once the dialog closes; Safari returns at once and leaves
    // it to the event. Both paths restore, and removing an attribute twice costs nothing.
    window.addEventListener("afterprint", restore, { once: true });
    try {
      window.print();
    } finally {
      restore();
    }
  };

  return (
    <button ref={ref} type="button" onClick={print} className={className}>
      บันทึกเป็น PDF
    </button>
  );
}
