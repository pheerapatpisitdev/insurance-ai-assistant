import type { Metadata } from "next";
import { loadAiPage } from "./actions";
import { AiClient } from "./AiClient";

export const dynamic = "force-dynamic";

/**
 * The tab says which page this is. The root layout's title is the calculator's, and every
 * admin page wore it, so two open tabs of the back office could not be told apart.
 */
export const metadata: Metadata = {
  title: "ตั้งค่า AI | advisortool",
};

export default async function AiPage() {
  const data = await loadAiPage();
  return <AiClient {...data} />;
}
