"use client";
import { useEffect, useState } from "react";

/**
 * Puts the quote on the clipboard for the agent to paste into whatever chat the customer is
 * in. The button says so for a moment afterwards, because a click that changes nothing on
 * screen leaves the agent pressing it again.
 *
 * The async clipboard API is refused on plain http and in some in-app browsers; the
 * hidden-textarea fallback still works there.
 */
export function CopyButton(
  { text, className, compact = false }: { text: string; className: string; compact?: boolean },
) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
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
      {copied ? "คัดลอกแล้ว ✓" : compact ? "คัดลอก" : "คัดลอกข้อความ"}
    </button>
  );
}
