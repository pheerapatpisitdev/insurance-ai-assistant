import { MATCH_THRESHOLD } from "@/lib/assistant/faq";
import { listFaq } from "./actions";
import { FaqClient } from "./FaqClient";

export const dynamic = "force-dynamic";

export default async function FaqAdminPage() {
  return <FaqClient rows={await listFaq()} threshold={MATCH_THRESHOLD} />;
}
