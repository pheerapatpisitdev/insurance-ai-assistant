import { handleMcp } from "@/lib/api/mcp";

export const dynamic = "force-dynamic";

/** The ordinary door: the key rides in the Authorization header, as it should. */
export async function POST(request: Request) {
  return handleMcp(request);
}
