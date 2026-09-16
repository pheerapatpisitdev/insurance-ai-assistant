import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { z } from "zod";
import { calculateQuote, listQuotePlans } from "@/lib/mcp/quotes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function makeServer() {
  const server = new McpServer({ name: "insurance-calc", version: "1.0.0" });
  server.registerTool("list_insurance_plans", {
    title: "รายการแบบประกัน",
    description: "Use this when a user wants to see available insurance plans, age ranges, sum assured limits, or variant codes before requesting a quote.",
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  }, async () => {
    const data = { plans: listQuotePlans() };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  });
  server.registerTool("calculate_insurance_quote", {
    title: "คำนวณเบี้ยประกัน",
    description: "Use this when a user provides a plan, variant, age, sex and sum assured and wants an estimated insurance premium in Thai baht. Call list_insurance_plans first to get valid plan and variant codes.",
    inputSchema: {
      plan_code: z.enum(["PLB", "LIFEPROTECT", "ISHIELD", "LIFETREASURE"]),
      variant: z.string().min(1),
      age: z.number().int().min(0).max(100),
      sex: z.enum(["M", "F"]),
      sum_assured: z.number().int().positive(),
    },
    annotations: { readOnlyHint: true, openWorldHint: false, idempotentHint: true },
  }, async (input) => {
    try {
      const data = calculateQuote(input);
      return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
    } catch (error) {
      return { isError: true, content: [{ type: "text", text: error instanceof Error ? error.message : "คำนวณไม่สำเร็จ" }] };
    }
  });
  return server;
}

export async function POST(request: Request) {
  const server = makeServer();
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  return transport.handleRequest(request);
}

export async function GET() {
  return new Response("Method Not Allowed", { status: 405, headers: { Allow: "POST" } });
}
