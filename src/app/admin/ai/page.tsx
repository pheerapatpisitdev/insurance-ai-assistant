import { loadAiPage } from "./actions";
import { AiClient } from "./AiClient";

export const dynamic = "force-dynamic";

export default async function AiPage() {
  const data = await loadAiPage();
  return <AiClient {...data} />;
}
