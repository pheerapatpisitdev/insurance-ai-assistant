import { NextResponse } from "next/server";
import { authorise } from "@/lib/api/key";
import { DISCLAIMER } from "@/lib/api/respond";
import { planCatalogue, quotePremium, tablesMeta, type QuoteAsk } from "@/lib/api/service";

/**
 * The same two answers, offered to a model as tools it can pick up.
 *
 * MCP over HTTP is JSON-RPC in a POST body: the client says hello, asks what there is, and
 * calls one. Three methods is the whole of it, which is why this is a file rather than a
 * dependency.
 *
 * What deserves care is not the protocol but the descriptions. They are the only instructions
 * the model gets, and a model handed a premium will round it, restate it in its own words, or
 * carry it into a month when the table has expired — so each description says what the tool
 * is for and, in as many words, what must not be done with what comes back.
 */

const PROTOCOL = "2025-06-18";

const TOOLS = [
  {
    name: "list_plans",
    description:
      "รายการแบบประกันทั้งหมดที่ระบบนี้ขาย พร้อมช่วงอายุที่รับประกัน ทุนขั้นต่ำ และรหัส variant ที่ต้องใช้ตอนคิดเบี้ย "
      + "เรียกอันนี้ก่อนเสมอถ้ายังไม่รู้ว่ามีแบบไหนบ้าง — ห้ามเดารหัสแบบประกันหรือรหัส variant เอง",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "quote_premium",
    description:
      "คิดเบี้ยประกันจากตารางเบี้ยจริงของบริษัท ไม่ใช่การประมาณ "
      + "ตัวเลขที่ได้ต้องนำไปใช้ตามที่ได้มาเท่านั้น: ห้ามปัดเศษ ห้ามคำนวณต่อ ห้ามรวมกับแบบอื่นเอง "
      + "และต้องแสดงข้อความใน field disclaimer ให้ผู้ใช้เห็นทุกครั้งที่บอกตัวเลข "
      + "ถ้าบริษัทไม่รับประกันตามเงื่อนไขที่ถาม จะได้ not_issuable พร้อมเหตุผล — ให้บอกเหตุผลนั้นตรงๆ ห้ามเสนอตัวเลขอื่นแทน",
    inputSchema: {
      type: "object",
      properties: {
        plan: { type: "string", description: "รหัสแบบประกัน เช่น PLB, ISMART, LIFETREASURE, LIFEPROTECT (ดูจาก list_plans)" },
        variant: { type: "string", description: "รหัสแพ็กเกจ/ระยะเวลาชำระเบี้ย เช่น PLB10 (ดูจาก list_plans)" },
        age: { type: "integer", minimum: 0, maximum: 99, description: "อายุผู้ทำประกัน" },
        sex: { type: "string", enum: ["M", "F"], description: "M ชาย / F หญิง" },
        sumAssured: { type: "number", description: "วงเงินคุ้มครอง (ทุนประกัน) เป็นบาท" },
        mode: { type: "string", enum: ["annual", "semi", "monthly"], description: "งวดการชำระ ค่าเริ่มต้นคือรายปี" },
      },
      required: ["plan", "age", "sex", "sumAssured"],
      additionalProperties: false,
    },
  },
] as const;

/** JSON-RPC says an error is an object with a number; these are the two this can raise. */
const rpcError = (id: unknown, code: number, message: string) =>
  NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

const rpcResult = (id: unknown, result: unknown) =>
  NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result });

/**
 * A tool's answer, as the model will read it.
 *
 * Returned as text rather than as a structure because that is what every MCP client shows the
 * model. The envelope goes in the same JSON so that the version and the disclaimer are inside
 * the thing being read, not attached to it — an instruction the model can skip is one it will.
 */
const content = (payload: unknown, isError = false) => ({
  content: [{ type: "text", text: JSON.stringify(payload, null, 1) }],
  ...(isError ? { isError: true } : {}),
});

async function callTool(name: string, args: QuoteAsk) {
  const meta = tablesMeta();
  const envelope = { ...meta, disclaimer: DISCLAIMER };

  if (name === "list_plans") return content({ plans: planCatalogue(), ...envelope });

  if (name === "quote_premium") {
    const outcome = quotePremium(args ?? {});
    if (outcome.kind === "unreadable") {
      return content({ error: "bad_request", message: outcome.message, field: outcome.field }, true);
    }
    if (outcome.kind === "not_issuable") {
      return content({
        error: "not_issuable",
        message: "บริษัทไม่รับประกันตามเงื่อนไขนี้ จึงไม่มีเบี้ยให้ ให้บอกเหตุผลด้านล่างกับผู้ใช้ตรงๆ",
        reasons: outcome.reasons,
      }, true);
    }
    return content({ ...outcome.quote, ...outcome.meta, disclaimer: DISCLAIMER });
  }

  return content({ error: "unknown_tool", message: `ไม่มีเครื่องมือชื่อ ${name}` }, true);
}

/**
 * One turn of the protocol, with the key wherever this caller was able to put it.
 *
 * Split out so that the path-carried variant next door runs the identical code: a second
 * implementation of a protocol is a second set of bugs, and this one already refuses, counts
 * and answers correctly.
 */
export async function handleMcp(request: Request, keyFromPath?: string) {
  const auth = await authorise(request, keyFromPath);
  if ("refused" in auth) {
    // the key is checked before the protocol: an unauthorised client should be told so in the
    // way every HTTP client understands, not in a JSON-RPC error it has to parse first
    return NextResponse.json(
      { error: auth.refused, message: "ต้องส่งกุญแจใน header: Authorization: Bearer <key>" },
      { status: auth.refused === "quota_exhausted" ? 429 : auth.refused === "disabled" ? 403 : 401 },
    );
  }

  let rpc: { jsonrpc?: string; id?: unknown; method?: string; params?: Record<string, unknown> };
  try {
    rpc = await request.json();
  } catch {
    return rpcError(null, -32700, "อ่าน JSON ไม่ได้");
  }

  const { id, method, params } = rpc;

  switch (method) {
    case "initialize":
      return rpcResult(id, {
        protocolVersion: PROTOCOL,
        capabilities: { tools: {} },
        serverInfo: { name: "advisortool-insurance", version: "1.0.0" },
        instructions:
          "เครื่องคิดเบี้ยประกันชีวิตจากตารางจริงของบริษัท ตัวเลขทุกตัวมาจากตารางเบี้ย ไม่ใช่การประมาณของโมเดล "
          + "ห้ามปัดเศษหรือคำนวณต่อจากตัวเลขที่ได้ และต้องแสดง disclaimer ที่ติดมาให้ผู้ใช้เห็นทุกครั้ง",
      });

    // the client tells the server it is ready; there is nothing to answer and nothing to do
    case "notifications/initialized":
      return new NextResponse(null, { status: 202 });

    case "tools/list":
      return rpcResult(id, { tools: TOOLS });

    case "tools/call": {
      const name = String(params?.name ?? "");
      const args = (params?.arguments ?? {}) as QuoteAsk;
      return rpcResult(id, await callTool(name, args));
    }

    case "ping":
      return rpcResult(id, {});

    default:
      return rpcError(id, -32601, `ไม่รองรับ method: ${method}`);
  }
}
