/**
 * Opening the calculator from a LINE chat should end with the quote in that chat, not with
 * the agent copying text between apps. LIFF is what makes that possible, and it only exists
 * inside LINE — so the SDK is fetched on demand rather than shipped to every visitor, and
 * everything here degrades to the plain share link when the page is open in a browser.
 */

const SDK_URL = "https://static.line-scdn.net/liff/edge/2/sdk.js";

interface LiffContext {
  type?: "utou" | "room" | "group" | "square_chat" | "external" | "none";
}
interface Liff {
  init(config: { liffId: string }): Promise<void>;
  isInClient(): boolean;
  getContext(): LiffContext | null;
  isApiAvailable(name: string): boolean;
  sendMessages(messages: { type: "text"; text: string }[]): Promise<void>;
  shareTargetPicker(messages: { type: "text"; text: string }[]): Promise<unknown>;
  closeWindow(): void;
}

declare global {
  interface Window {
    liff?: Liff;
  }
}

/** Where the quote can go from here. */
export type ShareMode =
  /** open inside a LINE chat: one tap puts the quote in that conversation */
  | "chat"
  /** inside LINE but not in a chat, e.g. from the rich menu: LINE asks who to send it to */
  | "picker"
  /** an ordinary browser: hand off to LINE's share link */
  | "link";

let loading: Promise<Liff | null> | null = null;

function loadSdk(): Promise<Liff | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (window.liff) return Promise.resolve(window.liff);
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = SDK_URL;
    script.onload = () => resolve(window.liff ?? null);
    script.onerror = () => resolve(null);
    document.head.appendChild(script);
  });
}

/**
 * Prepares LIFF once and reports what sharing this page can offer. Any failure — no id
 * configured, SDK blocked, init refused — settles on the plain link rather than throwing,
 * because a share button that disappears is worse than one that opens a browser.
 */
export function prepareShare(): Promise<ShareMode> {
  if (!loading) {
    const liffId = process.env.NEXT_PUBLIC_LIFF_ID;
    // outside LINE the SDK is dead weight, and its absence is exactly the "link" answer
    const inLine = typeof navigator !== "undefined" && /\bLine\//i.test(navigator.userAgent);
    loading = !liffId || !inLine
      ? Promise.resolve(null)
      : loadSdk().then(async (liff) => {
          if (!liff) return null;
          try {
            await liff.init({ liffId });
            return liff;
          } catch {
            return null;
          }
        });
  }
  return loading.then((liff) => {
    if (!liff || !liff.isInClient()) return "link";
    const type = liff.getContext()?.type;
    if (type === "utou" || type === "room" || type === "group") return "chat";
    return liff.isApiAvailable("shareTargetPicker") ? "picker" : "link";
  });
}

/** LINE's own share link, used whenever the page is not running inside LINE. */
export function shareLinkUrl(text: string): string {
  return `https://line.me/R/share?text=${encodeURIComponent(text)}`;
}

/**
 * Sends the quote. Returns false when nothing was sent — the caller falls back to the link
 * so the agent is never left with a button that did nothing.
 */
export async function sendQuote(mode: ShareMode, text: string): Promise<boolean> {
  const liff = await loading;
  if (!liff || mode === "link") return false;
  const messages = [{ type: "text" as const, text }];
  try {
    if (mode === "chat") {
      await liff.sendMessages(messages);
      liff.closeWindow();
      return true;
    }
    await liff.shareTargetPicker(messages);
    return true;
  } catch {
    return false;
  }
}
