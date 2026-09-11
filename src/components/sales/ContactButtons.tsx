import { messengerUrl } from "@/lib/legacy-cta";
import { CopyButton } from "./CopyButton";

/**
 * The way out of the page: a chat with a person on the agency's Facebook Page — and, once a
 * price is on screen, the same quote as text for the agent to paste into whichever chat the
 * customer is already in.
 *
 * The message is prepared, never sent: pressing send stays the customer's own act.
 */
export function ContactButtons(
  { message, copyText, compact = false }: { message: string; copyText?: string; compact?: boolean },
) {
  const shape = compact
    ? "rounded-sm px-3 py-2.5 text-center text-sm font-medium"
    : "rounded-sm px-5 py-3.5 text-center font-medium tracking-wide";
  return (
    <div className={compact ? "flex gap-2 [&>*]:flex-1" : "grid gap-2"}>
      <a
        href={messengerUrl(message)} target="_blank" rel="noopener noreferrer"
        className={`${shape} lg-metal-face${compact ? "" : " lg-sheen"}`}
      >
        {compact ? "ทักเพจ" : "ทักเพจปรึกษาฟรี"}
      </a>
      {copyText && (
        <CopyButton text={copyText} className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`} />
      )}
    </div>
  );
}
