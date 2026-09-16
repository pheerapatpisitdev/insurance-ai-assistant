import { chat } from "@/lib/ai/client";
import type { ChatMessage } from "@/lib/ai/types";
import { assembleKnowledge } from "./knowledge";

/**
 * One question, answered out of this system's own library — from wherever it was asked.
 *
 * The website and the page's inbox used to know different things. The website had every
 * plan's rules, the illness lists and whatever the agent had typed into the knowledge box;
 * the bot had a ten-line summary of one plan. A customer who asked the same question in the
 * two places got two different answers, and the one who arrived through an advertisement got
 * the thinner of them.
 *
 * So the library sits here, on its own, and both doors knock on it. It is the same text, the
 * same rules against inventing, and the same routing — which means an answer the owner
 * improves by typing a note improves in both places at once, which is what they asked for
 * and what they reasonably assumed was already true.
 */

const SYSTEM = `คุณคือผู้ช่วยของตัวแทนประกันชีวิต ตอบคำถามจากคลังความรู้ด้านล่างเท่านั้น

กฎที่ห้ามฝ่าฝืน:
1. ตอบเฉพาะสิ่งที่มีอยู่ในคลังความรู้ ถ้าไม่มีให้บอกตรงๆ ว่า "ข้อมูลนี้ไม่มีในระบบ" แล้วแนะนำให้ถามบริษัท
   ห้ามเดา ห้ามเติมจากความรู้ทั่วไปของคุณเอง แม้จะมั่นใจแค่ไหนก็ตาม
2. ห้ามคิดหรือคาดเดาตัวเลขเบี้ยประกันเด็ดขาด ถ้าถูกถามเรื่องเบี้ย ให้บอกว่าพิมพ์ อายุ เพศ แบบประกัน และทุน
   มาได้เลย ระบบจะคิดให้จากตารางจริง — ห้ามให้ตัวเลขประมาณการใดๆ ทั้งสิ้น
3. บอกที่มาของคำตอบทุกครั้ง เช่น "จากกฎของ Life Protect" หรือ "จากบันทึกของตัวแทน"
4. ถ้าคำตอบมาจาก "บันทึกของตัวแทนเอง" ต้องบอกให้ชัดว่าเป็นบันทึกภายใน ไม่ใช่เอกสารบริษัท
5. ห้ามรับรองผลการพิจารณารับประกัน เรื่องนั้นเป็นคำตอบของผู้พิจารณาเท่านั้น
6. ตอบเป็นภาษาไทย สั้น ตรงประเด็น ใช้หัวข้อย่อยเมื่อมีหลายข้อ`;

export interface LibraryAnswer {
  text: string;
  /** which model wrote it, for the line the website prints under an answer */
  model: string;
}

/**
 * The library's answer, or undefined when it could not be reached.
 *
 * Undefined rather than a thrown error, because one of the two callers is a customer's inbox:
 * a question the library cannot take should fall back to what that channel would have said
 * anyway, not break the conversation.
 */
export async function askLibrary(
  history: ChatMessage[], question: string,
): Promise<LibraryAnswer | undefined> {
  try {
    const knowledge = await assembleKnowledge(question);
    const reply = await chat({
      tier: "small",
      task: "library",
      maxTokens: 900,
      messages: [
        { role: "system", content: `${SYSTEM}\n\n---\n\n${knowledge}` },
        ...history.slice(-6),
        { role: "user", content: question },
      ],
    });
    return { text: reply.text.trim(), model: reply.model };
  } catch (e) {
    console.error("ตอบจากคลังความรู้ไม่สำเร็จ:", e);
    return undefined;
  }
}

/** The text alone, for the caller that has no use for the model's name. */
export async function answerFromLibrary(
  history: ChatMessage[], question: string,
): Promise<string | undefined> {
  const answer = await askLibrary(history, question);
  return answer?.text;
}
