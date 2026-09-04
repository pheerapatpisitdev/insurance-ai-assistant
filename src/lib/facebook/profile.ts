/**
 * The Page's ice breakers — up to four questions a person can tap instead of typing. A tap
 * reaches the webhook as a postback whose title is the question, so each question is written
 * the way the bot expects to be asked.
 *
 * The welcome greeting is not here: Meta dropped `greeting` from this API, and answers a
 * request carrying it with "(#100) Requires one of the params: get_started, persistent_menu,
 * whitelisted_domains, account_linking_url, home_url, ice_breakers, platform, description,
 * commands". The greeting is set in Meta Business Suite instead.
 */

const GRAPH = "https://graph.facebook.com/v23.0/me/messenger_profile";

export const MAX_ICE_BREAKERS = 4;
export const MAX_QUESTION_CHARS = 80;

export interface MessengerProfile {
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
  const res = await fetch(`${GRAPH}?fields=ice_breakers`, {
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
  const body = JSON.parse(text) as { data?: ProfileRow[] };
  const row = body.data?.[0] ?? {};
  const profile = { questions: questionsOf(row.ice_breakers) };
  cached = { token, at: Date.now(), profile };
  return profile;
}

/** Trims, drops blanks, and refuses what Meta would refuse, so the error is in Thai and early. */
export function normaliseProfile(input: MessengerProfile): MessengerProfile {
  const questions = input.questions.map((q) => q.trim()).filter(Boolean);
  if (questions.length > MAX_ICE_BREAKERS) throw new Error(`ปุ่มคำถามใส่ได้ไม่เกิน ${MAX_ICE_BREAKERS} ปุ่ม`);
  for (const q of questions) {
    if (q.length > MAX_QUESTION_CHARS) throw new Error(`คำถาม "${q.slice(0, 20)}…" ยาวเกิน ${MAX_QUESTION_CHARS} ตัวอักษร`);
  }
  return { questions };
}

/** The body Meta expects. The payload repeats the question so a postback reads the same as a typed message. */
export function profileBody(profile: MessengerProfile): Record<string, unknown> {
  return profile.questions.length
    ? { ice_breakers: [{ locale: "default", call_to_actions: profile.questions.map((q) => ({ question: q, payload: q })) }] }
    : {};
}

export async function writeProfile(token: string, input: MessengerProfile): Promise<void> {
  const profile = normaliseProfile(input);
  forgetProfile();
  // clearing every question means deleting the field: an empty list is not something Meta
  // will store, and leaving the old questions up would ignore the person who cleared them
  if (!profile.questions.length) {
    const res = await fetch(GRAPH, {
      method: "DELETE",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ fields: ["ice_breakers"] }),
    });
    if (!res.ok) throw new Error(`ลบปุ่มคำถามไม่ได้ ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return;
  }
  const body = profileBody(profile);
  const res = await fetch(GRAPH, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`บันทึกไม่ได้ ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
