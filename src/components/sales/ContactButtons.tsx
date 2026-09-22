import { messengerUrl } from "@/lib/legacy-cta";
import { CopyButton } from "./CopyButton";
import { SendButton } from "./SendButton";
import { CardButton } from "./CardButton";
import type { ContactWords } from "@/lib/ihealthy-words";

/**
 * The way out of the page: a chat with a person on the agency's Facebook Page — and, once a
 * price is on screen, the same quote as text for the agent to paste into whichever chat the
 * customer is already in.
 *
 * The message is prepared, never sent: pressing send stays the customer's own act.
 */
export function ContactButtons(
  { message, copyText, cardPath, tableCardPath, tableLabel, compact = false, words }:
    {
      message: string; copyText?: string; cardPath?: string; tableCardPath?: string;
      /** what the table's button says, for a plan whose table is not a table of values */
      tableLabel?: { full: string; compact: string };
      compact?: boolean;
      /** the buttons' labels in another language; each button keeps its own Thai without it */
      words?: ContactWords;
    },
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
        {compact ? words?.chat.compact ?? "ทักเพจ" : words?.chat.full ?? "ทักเพจปรึกษาฟรี"}
      </a>
      {cardPath && (
        <CardButton path={cardPath} compact={compact} words={words?.card} className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`} />
      )}
      {/* the table's own picture belongs here as well as beside the table: someone who has
          just read sixty rows is at the bottom of the page, looking at these */}
      {tableCardPath && (
        <CardButton
          path={tableCardPath}
          compact={compact}
          filename="value-table.png"
          label={tableLabel ?? { full: "บันทึกตารางมูลค่า", compact: "ตาราง" }}
          className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`}
        />
      )}
      {copyText && (
        <>
          <SendButton text={copyText} compact={compact} words={words?.send} className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`} />
          <CopyButton text={copyText} compact={compact} words={words?.copy} className={`${shape} border border-[var(--lg-panel-line)] text-[var(--lg-mute)]`} />
        </>
      )}
    </div>
  );
}
