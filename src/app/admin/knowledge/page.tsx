import { listDocs } from "./actions";
import { KnowledgeClient } from "./KnowledgeClient";
import { listPlans } from "@/calc/plans/registry";

export const dynamic = "force-dynamic";

export default async function KnowledgePage() {
  const docs = await listDocs();
  return <KnowledgeClient docs={docs} plans={listPlans()} />;
}
