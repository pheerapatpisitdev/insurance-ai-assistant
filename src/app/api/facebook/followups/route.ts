import { after } from "next/server";
import type { NextRequest } from "next/server";
import { claimDueFollowups, followupMessage, sweepFollowups } from "@/lib/chat/followup";
import { sendMessage } from "@/lib/facebook/client";
import { cronCallerIsOurs } from "@/lib/chat/cron-token";
import { markStalled } from "@/lib/chat/record";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The minute hand of the bot.
 *
 * Called once a minute from the database's own scheduler, because a follow-up is the one
 * thing this app has to do when nobody is talking to it — every other line of it runs because
 * a customer wrote. It sends what has come due and nothing else; the claim that reads a
 * follow-up also marks it sent, so calling this twice sends nothing twice.
 *
 * The caller proves itself with a token that lives in the database and nowhere else, so the
 * only thing that can make the page speak is something that already has the database.
 */
export async function POST(req: NextRequest) {
  if (!(await cronCallerIsOurs(req.headers.get("authorization")))) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const due = await claimDueFollowups("facebook");
  after(async () => {
    for (const { userHash, psid, stage } of due) {
      const { text, replies } = followupMessage(stage);
      // proactive, not a reply to anything: Meta has a name for that and this is it
      await sendMessage(psid, text, replies, { proactive: true })
        .catch((e) => console.error("followup failed:", e));
      // the second question is the last one, and reaching it means the first went unanswered —
      // which is the one outcome worth reporting that nothing else leaves a trace of
      if (stage >= 2) await markStalled("facebook", userHash);
    }
    await sweepFollowups();
  });
  return Response.json({ sent: due.length });
}
