import { NextResponse } from "next/server";
import type { Caller, Refusal } from "./key";

/**
 * How this API answers, and the two things it may never answer without.
 *
 * Every figure leaves here with the rate table it came from and the sentence that has to be
 * said beside it. On the website those live on the page — "เบี้ยเป็นตัวเลขประมาณการ… ไม่ใช่ใบ
 * เสนอราคา" sits under the chat, and the version is printed on the card. Through an API the
 * page does not travel: the number lands in somebody else's screen, or in a model's context,
 * with nothing around it. So they travel in the body.
 *
 * The audience makes it sharper still. A model asked to be helpful will round a premium,
 * restate it, or carry it into next month — so what it is handed has to say, in the payload
 * it is reading, which table the figure came from and when that table stops being true.
 */

/** What every successful body carries, whatever else is in it. */
interface Envelope {
  version: string;
  expiresOn: string;
  expired: boolean;
  disclaimer: string;
}

export const DISCLAIMER =
  "เบี้ยประกันเป็นตัวเลขประมาณการจากตารางของบริษัท ไม่ใช่ใบเสนอราคา "
  + "เบี้ยและความคุ้มครองจริงเป็นไปตามผลการพิจารณารับประกันและที่ระบุในกรมธรรม์ "
  + "ห้ามดัดแปลง ปัดเศษ หรือคำนวณต่อจากตัวเลขนี้";

const EXPIRED_NOTE =
  "ตารางเบี้ยชุดนี้หมดอายุแล้ว ห้ามนำตัวเลขไปเสนอลูกค้า ให้ขอราคาปัจจุบันจากบริษัทก่อน";

/** Keeps the caller's remaining quota where an HTTP client can read it without parsing a body. */
function headers(caller: Caller): Record<string, string> {
  return {
    "cache-control": "no-store",
    ...(caller.remaining === null ? {} : { "x-quota-remaining": String(caller.remaining) }),
  };
}

export function ok<T extends object>(
  caller: Caller, meta: { version: string; expiresOn: string; expired: boolean }, body: T,
): NextResponse {
  const envelope: Envelope = {
    version: meta.version,
    expiresOn: meta.expiresOn,
    expired: meta.expired,
    // an expired table says so in the sentence itself, not only in a boolean somebody has to
    // remember to read
    disclaimer: meta.expired ? `${EXPIRED_NOTE} · ${DISCLAIMER}` : DISCLAIMER,
  };
  return NextResponse.json({ ...body, ...envelope }, { headers: headers(caller) });
}

/** The four ways a key is turned away, each with the status that says which. */
export function refuse(refusal: Refusal): NextResponse {
  const [status, error, message] = {
    missing: [401, "missing_key", "ต้องส่งกุญแจมาใน header: Authorization: Bearer <key>"],
    unknown_key: [401, "unknown_key", "กุญแจนี้ไม่มีในระบบ"],
    disabled: [403, "key_disabled", "กุญแจนี้ถูกปิดใช้งานแล้ว"],
    quota_exhausted: [429, "quota_exhausted", "กุญแจนี้ใช้ครบโควตาของเดือนนี้แล้ว"],
  }[refusal] as [number, string, string];
  return NextResponse.json({ error, message }, { status, headers: { "cache-control": "no-store" } });
}

/** A request this API cannot read: a field missing, a number that is not one. */
export function badRequest(message: string, fields?: Record<string, string>): NextResponse {
  return NextResponse.json({ error: "bad_request", message, ...(fields ? { fields } : {}) }, { status: 400 });
}

/**
 * An arrangement the company will not write.
 *
 * Deliberately not a 200 with a zero in it. A caller reading zero as a price is the failure
 * this whole system is built against, and a model reading it is worse — it will present the
 * refusal as a bargain. The reasons are the engine's own sentences, which are the ones an
 * agent would have to repeat anyway.
 */
export function cannotIssue(reasons: string[]): NextResponse {
  return NextResponse.json({
    error: "not_issuable",
    message: "บริษัทไม่รับประกันตามเงื่อนไขนี้ จึงไม่มีเบี้ยให้",
    reasons,
  }, { status: 422, headers: { "cache-control": "no-store" } });
}
