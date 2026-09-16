import { NextResponse } from "next/server";
import { DISCLAIMER } from "@/lib/api/respond";
import { siteUrl } from "@/lib/site-url";
import { listPlans } from "@/calc/plans/registry";

export const dynamic = "force-dynamic";

/**
 * The same API, described so a custom GPT can call it.
 *
 * Public on purpose, and it is a description rather than data: it names the endpoints and the
 * shape of a request, and every one of them still refuses without a key. Somebody building an
 * Action pastes a URL into a form long before they have a key to paste with it, and a schema
 * behind a key is a schema nobody can set up against.
 *
 * Generated rather than typed out, so the plan codes in the examples are the plans that
 * actually exist. A hand-written example naming a plan the registry has dropped is how an
 * integration spends its first hour.
 */
export function GET() {
  const codes = listPlans().map((p) => p.code);

  return NextResponse.json({
    openapi: "3.1.0",
    info: {
      title: "advisortool — เครื่องคิดเบี้ยประกันชีวิต",
      version: "1.0.0",
      description:
        "คิดเบี้ยประกันจากตารางเบี้ยจริงของบริษัท ไม่ใช่การประมาณ "
        + "ตัวเลขที่ได้ห้ามปัดเศษ ห้ามคำนวณต่อ และต้องแสดงข้อความใน disclaimer ให้ผู้ใช้เห็นทุกครั้ง",
    },
    servers: [{ url: siteUrl("/api/v1") }],
    security: [{ bearerAuth: [] }],
    paths: {
      "/plans": {
        get: {
          operationId: "listPlans",
          summary: "แบบประกันทั้งหมด ช่วงอายุ ทุนขั้นต่ำ และรหัส variant",
          description: "เรียกก่อนเสมอถ้ายังไม่รู้ว่ามีแบบไหน ห้ามเดารหัสแบบประกันหรือ variant เอง",
          responses: {
            200: { description: "รายการแบบประกัน", content: { "application/json": { schema: { $ref: "#/components/schemas/Plans" } } } },
            401: { description: "ไม่มีกุญแจหรือกุญแจผิด" },
            429: { description: "ใช้ครบโควตาของเดือนนี้" },
          },
        },
      },
      "/quote": {
        post: {
          operationId: "quotePremium",
          summary: "คิดเบี้ยประกันจากตารางจริง",
          description:
            "ถ้าบริษัทไม่รับประกันตามเงื่อนไขที่ถาม จะได้ 422 พร้อมเหตุผล — ให้บอกเหตุผลนั้นตรงๆ ห้ามเสนอตัวเลขอื่นแทน",
          requestBody: {
            required: true,
            content: { "application/json": { schema: { $ref: "#/components/schemas/QuoteRequest" } } },
          },
          responses: {
            200: { description: "เบี้ยประกัน", content: { "application/json": { schema: { $ref: "#/components/schemas/Quote" } } } },
            400: { description: "อ่านคำขอไม่ได้ เช่น ไม่ได้ระบุ variant ของแบบที่มีหลายแพ็กเกจ" },
            422: { description: "บริษัทไม่รับประกันตามเงื่อนไขนี้ ไม่มีเบี้ยให้", content: { "application/json": { schema: { $ref: "#/components/schemas/NotIssuable" } } } },
            401: { description: "ไม่มีกุญแจหรือกุญแจผิด" },
            429: { description: "ใช้ครบโควตาของเดือนนี้" },
          },
        },
      },
    },
    components: {
      securitySchemes: { bearerAuth: { type: "http", scheme: "bearer" } },
      schemas: {
        Envelope: {
          type: "object",
          description: "ติดมากับทุกคำตอบ ห้ามตัดทิ้งเวลาส่งต่อให้ผู้ใช้",
          properties: {
            version: { type: "string", description: "เวอร์ชันตารางเบี้ยที่ใช้คิด" },
            expiresOn: { type: "string", format: "date", description: "วันที่ตารางชุดนี้หมดอายุ" },
            expired: { type: "boolean", description: "true แปลว่าห้ามนำตัวเลขไปเสนอลูกค้า" },
            disclaimer: { type: "string", example: DISCLAIMER },
          },
        },
        Plans: {
          allOf: [
            { $ref: "#/components/schemas/Envelope" },
            {
              type: "object",
              properties: {
                plans: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      code: { type: "string", enum: codes },
                      name: { type: "string" },
                      ageMin: { type: "integer" },
                      ageMax: { type: "integer" },
                      quotable: { type: "boolean", description: "false แปลว่าคิดเบี้ยผ่าน API นี้ไม่ได้" },
                      premiumBasis: { type: "boolean", description: "true แปลว่าแบบนี้กรอกเบี้ยแล้วได้ทุน ไม่ใช่กรอกทุน" },
                      packages: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            variant: { type: "string" },
                            label: { type: "string" },
                            sumAssuredMin: { type: "integer" },
                            sumAssuredMax: { type: "integer" },
                            sumAssuredFixed: { type: "boolean", description: "true แปลว่าบริษัทเขียนแบบนี้ที่ทุนเดียวเท่านั้น" },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },
        QuoteRequest: {
          type: "object",
          required: ["plan", "age", "sex", "sumAssured"],
          properties: {
            plan: { type: "string", enum: codes, description: "รหัสแบบประกัน" },
            variant: { type: "string", description: "รหัสแพ็กเกจ ต้องระบุถ้าแบบนั้นมีหลายแพ็กเกจ" },
            age: { type: "integer", minimum: 0, maximum: 99 },
            sex: { type: "string", enum: ["M", "F"] },
            sumAssured: { type: "number", description: "วงเงินคุ้มครอง (ทุนประกัน) เป็นบาท" },
            mode: { type: "string", enum: ["annual", "semi", "monthly"], default: "annual" },
          },
        },
        Quote: {
          allOf: [
            { $ref: "#/components/schemas/Envelope" },
            {
              type: "object",
              properties: {
                plan: { type: "object", properties: { code: { type: "string" }, name: { type: "string" }, variant: { type: "string" }, label: { type: "string" } } },
                insured: { type: "object", properties: { age: { type: "integer" }, sex: { type: "string" } } },
                sumAssured: { type: "integer" },
                premium: {
                  type: "object",
                  properties: {
                    annual: { type: "integer", description: "บาทต่อปี" },
                    byMode: {
                      type: "array",
                      items: {
                        type: "object",
                        properties: {
                          mode: { type: "string" },
                          amount: { type: "integer" },
                          belowMinimum: { type: "boolean", description: "true แปลว่าบริษัทไม่รับงวดนี้ ห้ามเสนอ" },
                        },
                      },
                    },
                  },
                },
                images: {
                  type: "object",
                  description: "รูปการ์ดสรุป ส่งต่อให้ลูกค้าได้เลย",
                  properties: { quote: { type: "string", format: "uri" }, valueTable: { type: "string", format: "uri" } },
                },
              },
            },
          ],
        },
        NotIssuable: {
          type: "object",
          properties: {
            error: { type: "string", enum: ["not_issuable"] },
            message: { type: "string" },
            reasons: { type: "array", items: { type: "string" }, description: "เหตุผลของบริษัท ให้บอกผู้ใช้ตามนี้" },
          },
        },
      },
    },
  }, { headers: { "cache-control": "public, max-age=300" } });
}
