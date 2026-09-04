"use client";
import { useEffect, useState } from "react";
import { prepareShare, sendQuote, shareLinkUrl, type ShareMode } from "@/lib/liff";

const LABEL: Record<ShareMode, string> = {
  chat: "ส่งเข้าแชท",
  picker: "ส่งให้ลูกค้า",
  link: "แชร์เข้า LINE",
};

const CLASS =
  "inline-flex items-center gap-2 rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 disabled:opacity-60";

function LineMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="currentColor">
      <path d="M12 2C6.5 2 2 5.6 2 10c0 3.9 3.5 7.2 8.2 7.9.3.07.75.22.86.5.1.26.07.66.03.92l-.14.83c-.04.25-.2.96.85.53 1.05-.44 5.65-3.33 7.7-5.7C20.9 13.4 22 11.8 22 10c0-4.4-4.5-8-10-8Z" />
    </svg>
  );
}

export function ShareToLineButton({ text }: { text: string }) {
  // until LIFF has had its say, the plain link is the honest answer: it works everywhere
  const [mode, setMode] = useState<ShareMode>("link");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let alive = true;
    prepareShare().then((m) => {
      if (alive) setMode(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (mode === "link") {
    return (
      <a href={shareLinkUrl(text)} target="_blank" rel="noopener noreferrer" className={CLASS}>
        <LineMark />
        {LABEL.link}
      </a>
    );
  }

  async function send() {
    setSending(true);
    const sent = await sendQuote(mode, text);
    setSending(false);
    // a refusal inside LINE still deserves a way out, so fall back to the share link
    if (!sent) window.open(shareLinkUrl(text), "_blank", "noopener");
  }

  return (
    <button type="button" onClick={send} disabled={sending} className={CLASS}>
      <LineMark />
      {sending ? "กำลังส่ง…" : LABEL[mode]}
    </button>
  );
}
