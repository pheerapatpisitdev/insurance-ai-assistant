import { NextResponse } from "next/server";
import { authorise } from "@/lib/api/key";
import { DISCLAIMER } from "@/lib/api/respond";
import {
  healthCatalogue, planCatalogue, quoteHealth, quotePremium, tablesMeta,
  type HealthAsk, type QuoteAsk,
} from "@/lib/api/service";

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

/**
 * Said in both quoting tools, in the same words.
 *
 * A model handed two links and no instruction shows one and mentions the other, or mentions
 * neither and offers to fetch them if wanted. Neither is any use to an agent, who is going to
 * forward both to a customer: the card is the price and the table is what it is worth in the
 * year they are thinking about, and a price on its own is the half of the answer that sells
 * nothing. So the instruction is explicit about the markdown, because "แสดงรูป" on its own is
 * satisfied by a bare URL.
 */
const SHOW_BOTH_IMAGES =
  "ต้องแสดงรูปทั้งสองใบใน field images ทุกครั้งที่ตอบ โดยเขียนเป็น markdown ![](url) ทั้งคู่ "
  + "ใบแรก images.quote คือการ์ดสรุปเบี้ย ใบที่สอง images.valueTable คือตาราง "
  + "ห้ามแสดงใบเดียว ห้ามใส่แค่ลิงก์เฉยๆ และห้ามละเพราะคิดว่าผู้ใช้ไม่ได้ขอ "
  + "เพราะตัวแทนต้องส่งต่อให้ลูกค้าทั้งสองใบ ";

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
      + SHOW_BOTH_IMAGES
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
  {
    name: "quote_health",
    description:
      "คิดเบี้ยประกันสุขภาพ ไอเฮลท์ตี้ อัลตร้า (iHealthy Ultra) — ใช้เครื่องมือนี้ทุกครั้งที่ถามถึงประกันสุขภาพ "
      + "ห้ามใช้ quote_premium กับแพ็กเกจสุขภาพ เพราะสุขภาพเป็นสัญญาเพิ่มเติม ซื้อเดี่ยวไม่ได้ ต้องมีสัญญาหลักเสมอ "
      + "ตัวเลขที่ได้เป็นราคาของทั้งชุด (สัญญาหลัก + ค่ารักษา + ค่าชดเชยรายวัน) ไม่ใช่ค่าสุขภาพอย่างเดียว "
      + "ต้องบอกผู้ใช้ด้วยว่าในราคานี้มีอะไรบ้าง โดยดูจาก field arrangement และ partsOfPremium "
      + "ห้ามปัดเศษ ห้ามคำนวณต่อ และต้องแสดง disclaimer ให้ผู้ใช้เห็นทุกครั้ง "
      + SHOW_BOTH_IMAGES
      + "(ของสุขภาพ images.valueTable คือตารางเปรียบเทียบทุกแผน)",
    inputSchema: {
      type: "object",
      properties: {
        age: { type: "integer", minimum: 0, maximum: 99, description: "อายุผู้ทำประกัน" },
        sex: { type: "string", enum: ["M", "F"], description: "M ชาย / F หญิง" },
        plan: {
          type: "string",
          description:
            "รหัสแผนความคุ้มครอง เช่น GOLD, SMART, BRONZE — ถ้าไม่รู้ว่ามีแผนอะไรบ้าง "
            + "ให้เรียก list_health_plans ก่อน ห้ามเดารหัสเอง",
        },
        territory: {
          type: "string",
          description: "พื้นที่ความคุ้มครอง เว้นว่างได้ ค่าเริ่มต้นคือประเทศไทย (ดูจาก list_health_plans)",
        },
      },
      required: ["age", "sex", "plan"],
      additionalProperties: false,
    },
  },
  {
    name: "list_health_plans",
    description:
      "แผนความคุ้มครองของประกันสุขภาพ ไอเฮลท์ตี้ อัลตร้า ที่อายุนี้ซื้อได้ พร้อมวงเงินค่ารักษาต่อปีและค่าใช้จ่ายส่วนแรก "
      + "เรียกอันนี้ก่อน quote_health ถ้ายังไม่รู้ว่ามีแผนอะไรบ้าง — ห้ามเดารหัสแผนเอง "
      + "แต่ละอายุซื้อได้ไม่เท่ากัน จึงควรใส่อายุลูกค้าไปด้วย",
    inputSchema: {
      type: "object",
      properties: {
        age: { type: "integer", minimum: 0, maximum: 99, description: "อายุลูกค้า ใส่ไว้จะได้เห็นเฉพาะแผนที่อายุนี้ซื้อได้" },
      },
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

/** The two refusals, worded once, because a model must read them the same way from either tool. */
function refusal(outcome: { kind: "unreadable"; message: string; field?: string } | { kind: "not_issuable"; reasons: string[] }) {
  if (outcome.kind === "unreadable") {
    return content({ error: "bad_request", message: outcome.message, field: outcome.field }, true);
  }
  return content({
    error: "not_issuable",
    message: "บริษัทไม่รับประกันตามเงื่อนไขนี้ จึงไม่มีเบี้ยให้ ให้บอกเหตุผลด้านล่างกับผู้ใช้ตรงๆ",
    reasons: outcome.reasons,
  }, true);
}

async function callTool(name: string, args: QuoteAsk & HealthAsk) {
  const meta = tablesMeta();
  const envelope = { ...meta, disclaimer: DISCLAIMER };

  if (name === "list_plans") return content({ plans: planCatalogue(), ...envelope });

  if (name === "list_health_plans") {
    const age = Number.isInteger(args?.age) ? (args.age as number) : undefined;
    const c = healthCatalogue(age);
    return content({
      ...c,
      note:
        "ราคาที่ quote_health คืนมาเป็นราคาของทั้งชุด — สัญญาหลักทุน 50,000 บาท + ค่ารักษา + ค่าชดเชยรายวัน "
        + "เพราะประกันสุขภาพซื้อเดี่ยวไม่ได้ ต้องมีสัญญาหลักเสมอ",
      disclaimer: DISCLAIMER,
    });
  }

  if (name === "quote_premium") {
    const outcome = quotePremium(args ?? {});
    if (outcome.kind !== "ok") return refusal(outcome);
    return content({ ...outcome.quote, ...outcome.meta, disclaimer: DISCLAIMER });
  }

  if (name === "quote_health") {
    const outcome = quoteHealth(args ?? {});
    if (outcome.kind !== "ok") return refusal(outcome);
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
