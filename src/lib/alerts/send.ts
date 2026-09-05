import { push } from "@/lib/line/client";
import { alertSettings, recordSent, sentThisMonth } from "./settings";

/** Why an alert did not go out, so the back office can say something better than nothing. */
export type AlertOutcome = "sent" | "no-target" | "capped" | "failed";

/**
 * Tells the agent something, once, against the monthly allowance. Never throws: an alert
 * that cannot be delivered must not take down the answer the customer is waiting for.
 */
export async function alert(kind: string, text: string): Promise<AlertOutcome> {
  try {
    const settings = await alertSettings();
    if (!settings.lineUserId) return "no-target";
    if ((await sentThisMonth()) >= settings.monthlyCap) return "capped";
    await push(settings.lineUserId, text);
    await recordSent(kind, text);
    return "sent";
  } catch (e) {
    console.error("alert failed:", e);
    return "failed";
  }
}
