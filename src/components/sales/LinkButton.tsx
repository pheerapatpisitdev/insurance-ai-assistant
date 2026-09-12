"use client";
import { useEffect, useState } from "react";

/**
 * Copies the page's own address, which the calculator keeps pointing at whatever is on
 * screen. An agent who has set an arrangement up sends the link rather than describing it,
 * and the customer opens the same card the agent was looking at.
 *
 * The address is read at the click rather than held in a prop: it changes on every choice,
 * and a prop would be one render behind the arrangement it claims to carry.
 */
export function LinkButton({ className }: { className: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  /** Same fallback as CopyButton: the async clipboard is refused on plain http and inside
   *  some in-app browsers, which is where a link sent through LINE is opened. */
  const copy = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
  };

  return (
    <button type="button" onClick={copy} className={className} aria-live="polite">
      {copied ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์หน้านี้"}
    </button>
  );
}
