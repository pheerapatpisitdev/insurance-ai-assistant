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

interface ProfileRow {
  greeting?: { locale: string; text: string }[];
  ice_breakers?: { locale: string; call_to_actions: { question: string; payload: string }[] }[];
}

export async function readProfile(token: string): Promise<MessengerProfile> {
  const res = await fetch(`${GRAPH}?fields=greeting,ice_breakers`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`messenger_profile ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const body = (await res.json()) as { data?: ProfileRow[] };
  const row = body.data?.[0] ?? {};
  const pick = <T extends { locale: string }>(rows?: T[]) => rows?.find((r) => r.locale === "default") ?? rows?.[0];
  return {
    greeting: pick(row.greeting)?.text ?? "",
    questions: pick(row.ice_breakers)?.call_to_actions.map((c) => c.question) ?? [],
  };
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
  if (!res.ok) throw new Error(`บันทึกไม่ได้ ${res.status}: ${(await res.text()).slice(0, 200)}`);
}
