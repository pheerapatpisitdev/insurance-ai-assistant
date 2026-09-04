/**
 * The Page's Messenger profile: the greeting shown before a first message, and the ice
 * breakers — up to four questions a person can tap instead of typing. A tap reaches the
 * webhook as a postback whose title is the question, so each question is written the way
 * the bot expects to be asked.
 */

const GRAPH = "https://graph.facebook.com/v23.0/me/messenger_profile";

export const MAX_ICE_BREAKERS = 4;
export const MAX_QUESTION_CHARS = 80;
export const MAX_GREETING_CHARS = 160;

export interface MessengerProfile {
  greeting: string;
  questions: string[];
}

interface CallToAction { question: string; payload: string }
/**
 * Meta writes ice breakers in the new shape (one entry per locale, each holding its
 * questions) but still reads them back in the old one (a flat list of questions), so both
 * are accepted.
 */
type IceBreakerRow = { locale?: string; call_to_actions?: CallToAction[] } & Partial<CallToAction>;
interface ProfileRow {
  greeting?: { locale: string; text: string }[];
  ice_breakers?: IceBreakerRow[];
}

function questionsOf(rows: IceBreakerRow[] | undefined): string[] {
  if (!rows?.length) return [];
  const localised = rows.find((r) => r.locale === "default" && r.call_to_actions) ?? rows.find((r) => r.call_to_actions);
  if (localised?.call_to_actions) return localised.call_to_actions.map((c) => c.question);
  return rows.map((r) => r.question).filter((q): q is string => typeof q === "string");
}

export class ProfileError extends Error {
  constructor(readonly code: number, message: string) {
    super(message);
  }
  /** Meta allows ten Messenger Profile calls per ten minutes; this is the eleventh. */
  get rateLimited(): boolean {
    return [4, 17, 32, 613].includes(this.code);
  }
}

/**
 * Meta allows ten Messenger Profile calls per ten minutes per Page, and one back-office
 * visit used to spend two of them. A read is kept for a minute so reloading the page costs
 * nothing, and a write clears it so the form shows what was just saved.
 */
let cached: { token: string; at: number; profile: MessengerProfile } | null = null;
const CACHE_MS = 60_000;

export function forgetProfile(): void {
  cached = null;
}

export async function readProfile(token: string): Promise<MessengerProfile> {
  if (cached && cached.token === token && Date.now() - cached.at < CACHE_MS) return cached.profile;
  const res = await fetch(`${GRAPH}?fields=greeting,ice_breakers`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    let code = res.status;
    let message = `messenger_profile ${res.status}: ${text.slice(0, 200)}`;
    try {
      const err = (JSON.parse(text) as { error?: { code?: number; message?: string } }).error;
      if (err?.code) code = err.code;
      if (err?.message) message = err.message;
    } catch {
      // not JSON; the status line above is all there is
    }
    throw new ProfileError(code, message);
  }
  // temporary: the greeting reads back empty after a successful write; see what Meta sends
  console.log("messenger_profile raw:", text.slice(0, 1500));
  const body = JSON.parse(text) as { data?: ProfileRow[] };
  const row = body.data?.[0] ?? {};
  const greeting = row.greeting?.find((r) => r.locale === "default") ?? row.greeting?.[0];
  const profile = {
    greeting: greeting?.text ?? "",
    questions: questionsOf(row.ice_breakers),
  };
  cached = { token, at: Date.now(), profile };
  return profile;
}

/** Trims, drops blanks, and refuses what Meta would refuse, so the error is in Thai and early. */
export function normaliseProfile(input: MessengerProfile): MessengerProfile {
  const greeting = input.greeting.trim();
  if (greeting.length > MAX_GREETING_CHARS) throw new Error(`ข้อความทักทายยาวเกิน ${MAX_GREETING_CHARS} ตัวอักษร`);
  const questions = input.questions.map((q) => q.trim()).filter(Boolean);
  if (questions.length > MAX_ICE_BREAKERS) throw new Error(`ปุ่มคำถามใส่ได้ไม่เกิน ${MAX_ICE_BREAKERS} ปุ่ม`);
  for (const q of questions) {
    if (q.length > MAX_QUESTION_CHARS) throw new Error(`คำถาม "${q.slice(0, 20)}…" ยาวเกิน ${MAX_QUESTION_CHARS} ตัวอักษร`);
  }
  return { greeting, questions };
}

/** The body Meta expects. The payload repeats the question so a postback reads the same as a typed message. */
export function profileBody(profile: MessengerProfile): Record<string, unknown> {
  return {
    ...(profile.greeting ? { greeting: [{ locale: "default", text: profile.greeting }] } : {}),
    ...(profile.questions.length
      ? { ice_breakers: [{ locale: "default", call_to_actions: profile.questions.map((q) => ({ question: q, payload: q })) }] }
      : {}),
  };
}

export async function writeProfile(token: string, input: MessengerProfile): Promise<void> {
  const profile = normaliseProfile(input);
  forgetProfile();
  // a field left empty is deleted, not left as it was; otherwise an old greeting would linger
  const gone = [!profile.greeting && "greeting", !profile.questions.length && "ice_breakers"].filter(Boolean);
  if (gone.length) {
    const res = await fetch(GRAPH, {
      method: "DELETE",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: gone }),
    });
    if (!res.ok) throw new Error(`ลบค่าเดิมไม่ได้ ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const body = profileBody(profile);
  if (!Object.keys(body).length) return;
  const res = await fetch(GRAPH, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const answer = await res.text();
  // temporary: the greeting is not stored although the write succeeds; see both sides
  console.log("messenger_profile write:", JSON.stringify(body).slice(0, 800), "->", res.status, answer.slice(0, 300));
  if (!res.ok) throw new Error(`บันทึกไม่ได้ ${res.status}: ${answer.slice(0, 200)}`);
}
