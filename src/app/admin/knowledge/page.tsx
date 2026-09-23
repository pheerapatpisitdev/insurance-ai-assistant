import { listContentWords, listNotes } from "./actions";
import { Notes } from "./Notes";
import { Words } from "./Words";

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
  const [notes, words] = await Promise.all([listNotes(), listContentWords()]);
  return (
    <>
      <Notes initial={notes} />
      <Words initial={words} />
    </>
  );
}
