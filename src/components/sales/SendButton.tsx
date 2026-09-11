"use client";
import { useEffect, useState } from "react";
import { PAGE_INBOX_URL } from "@/lib/legacy-cta";

/**
 * Hands the quote to whoever the agent is talking to, by the shortest route the device has.
 *
 * Meta publishes no way to open a chat addressed to a particular customer, so the agent
 * always picks the person — the button's whole job is to have the text already written when
 * they get there. On a phone that is the system share sheet, which carries the text into
 * Messenger or LINE and lets the agent pick the conversation. On a desktop, where the share
 * sheet mostly does not exist, it copies the text and opens the Page inbox instead.
 *
 * Which of the two it will do is only knowable in the browser, so the button renders the
 * same words either way and decides what to do after mounting, rather than guessing during
 * server rendering and tripping hydration.
 */
export function SendButton(
  { text, className, compact = false }: { text: string; className: string; compact?: boolean },
) {
  const [canShare, setCanShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCanShare(typeof navigator !== "undefined" && typeof navigator.share === "function");
  }, []);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2500);
    return () => clearTimeout(t);
  }, [copied]);

  const send = () => {
    if (canShare) {
      // a share the agent backs out of is not a failure and has nothing to report
      navigator.share({ text }).catch(() => {});
      return;
    }
    // the window has to be opened on the click itself: a popup asked for after an awaited
    // clipboard write has lost the gesture that permits it
    window.open(PAGE_INBOX_URL, "_blank", "noopener,noreferrer");
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
  };

  return (
    <button type="button" onClick={send} className={className} aria-live="polite">
      {copied ? (compact ? "คัดลอกแล้ว ✓" : "คัดลอกแล้ว เปิด Inbox ✓") : compact ? "ส่งต่อ" : "ส่งให้ลูกค้า"}
    </button>
  );
}
