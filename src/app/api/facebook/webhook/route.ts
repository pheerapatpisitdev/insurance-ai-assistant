import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { verifySignature, verifyTokenMatches } from "@/lib/facebook/verify";
import { handle } from "@/lib/facebook/conversation";
import type { Messaging } from "@/lib/facebook/events";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Entry {
  /** the Page this batch of events belongs to; ins_open_conversation wants it by name */
  id?: string;
  messaging?: Messaging[];
}

/** Meta checks it owns this URL by asking for a challenge back, once, when the webhook is set. */
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  if (params.get("hub.mode") === "subscribe" && verifyTokenMatches(params.get("hub.verify_token"))) {
    return new NextResponse(params.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("forbidden", { status: 403 });
}

export async function POST(req: NextRequest) {
  // the signature is computed over the exact bytes Meta sent, so the body is read as text
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"))) {
    return new NextResponse("bad signature", { status: 401 });
  }

  let entries: Entry[] = [];
  try {
    const body = JSON.parse(raw);
    if (body.object !== "page") return NextResponse.json({ ok: true });
    entries = (body.entry ?? []) as Entry[];
  } catch {
    return new NextResponse("bad body", { status: 400 });
  }

  // Meta gives up on a webhook that takes more than a few seconds, and an answer takes
  // longer than that, so the reply happens after this response has already been sent.
  after(async () => {
    for (const entry of entries) {
      for (const m of entry.messaging ?? []) {
        await handle(m, entry.id).catch((e) => console.error("facebook event failed:", e));
      }
    }
  });

  return NextResponse.json({ ok: true });
}
