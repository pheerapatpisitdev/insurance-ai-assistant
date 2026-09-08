import { chatUrl, lineUrl, messengerUrl } from "@/lib/legacy-cta";
import type { LegacyChannels } from "@/lib/legacy-channels";

/**
 * The way out of the page, in every channel that has been configured. A channel with no
 * setting is left out rather than shown broken, so a page with only the assistant wired up
 * still reads as finished.
 *
 * The message is prepared, never sent: pressing send stays the customer's own act.
 */
export function ContactButtons(
  { channels, message, compact = false, assistant = true }: {
    channels: LegacyChannels;
    message: string;
    compact?: boolean;
    /**
     * Whether to offer the in-app assistant as well. A page that wants every lead in a
     * human's chat turns it off; the buttons that remain are the channels a person answers.
     */
    assistant?: boolean;
  },
) {
  const shape = compact
    ? "rounded-sm px-3 py-2.5 text-center text-sm font-medium"
    : "rounded-sm px-5 py-3.5 text-center font-medium tracking-wide";
  return (
    <div className={compact ? "flex gap-2 [&>*]:flex-1" : "grid gap-2"}>
      {channels.lineOaId && (
        <a
          href={lineUrl(channels.lineOaId, message)} target="_blank" rel="noopener noreferrer"
          className={`${shape} lg-metal-face${compact ? "" : " lg-sheen"}`}
        >
          {compact ? "ทักไลน์" : "ทักไลน์ปรึกษาฟรี"}
        </a>
      )}
      {channels.messengerPage && (
        <a
          href={messengerUrl(channels.messengerPage, message)} target="_blank" rel="noopener noreferrer"
          className={`${shape} border border-[var(--lg-gold)] text-[var(--lg-gold)]`}
        >
          {compact ? "Messenger" : "ทัก Messenger"}
        </a>
      )}
      {assistant && (
        <a href={chatUrl(message)} className={`${shape} border border-[var(--lg-panel-line)] text-[var(--lg-mute)]`}>
          {compact ? "ถาม AI" : "ถาม AI ก่อนก็ได้"}
        </a>
      )}
    </div>
  );
}
