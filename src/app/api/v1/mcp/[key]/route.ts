import { handleMcp } from "@/lib/api/mcp";

export const dynamic = "force-dynamic";

/**
 * The same door, for a client that cannot be told to send a header.
 *
 * Claude's connector settings take a URL and nothing else: it negotiates its own
 * authentication, tries OAuth with dynamic client registration, and stops there when the
 * server cannot do that — "Couldn't register with advisortool's sign-in service". So for that
 * client the key travels in the path.
 *
 * It is a worse place for a key and the trade is worth naming. The key ends up in Claude's
 * stored configuration and in this server's request logs, where a header would not have been,
 * and a URL is the kind of thing people paste into a chat window without thinking. What makes
 * it acceptable here rather than merely convenient: this API is read-only, holds no customer
 * data, and computes premiums from rate tables — the worst a stolen key buys is somebody
 * else's arithmetic until the month's quota runs out. And it is one press to revoke, in the
 * same screen that issued it.
 *
 * The proper answer is OAuth, and this is not it. It is the answer that works today.
 */
export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return handleMcp(request, decodeURIComponent(key));
}
