import { listNotes } from "./actions";
import { Notes } from "./Notes";
import { isSignedIn } from "@/lib/admin/session";

export const dynamic = "force-dynamic";

/**
 * What the agent has taught the assistant, on top of the plan rules.
 *
 * It lived on the home page, open to anybody, which was right while that page was the agent's
 * own tool. The page answers customers now — and the notes reach the Messenger bot as well —
 * so a stranger typing here would be typing into what the business says to people who arrived
 * through a paid advertisement.
 */
export default async function KnowledgePage() {
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

  const notes = await listNotes();
  return <Notes initial={notes} />;
}
