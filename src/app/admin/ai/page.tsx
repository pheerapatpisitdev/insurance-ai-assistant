import { loadAiPage } from "./actions";
import { AiClient } from "./AiClient";
import { isSignedIn } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  /**
   * No session, nothing to read.
   *
   * The layout has the PIN box up already — a page renders beside its layout, not after it —
   * and the loaders below all throw at a missing session. That throw reached the browser as
   * Next's error screen: an owner whose twelve hours had run out was told the back office had
   * broken rather than being asked for the PIN. The actions still throw; they are a network
   * boundary and this is a screen.
   */
  if (!(await isSignedIn())) return null;

  const data = await loadAiPage();
  return <AiClient {...data} />;
}
