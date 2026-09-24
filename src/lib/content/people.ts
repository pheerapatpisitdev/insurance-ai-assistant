/**
 * People in posters (owner, 2026-09-24): a consenting person's reference photos go to the
 * image model, which draws them into the post's picture in the pose picked here. Nothing in
 * this file touches the server, so the form can offer the poses. Design:
 * docs/superpowers/specs/2026-09-24-people-in-posters-design.md
 */

/** Gemini 3.1 Flash Image takes at most four character images */
export const MAX_PHOTOS = 4;

export const POSES = [
  { id: "auto", label: "ให้ AI เลือก", en: "Choose a natural pose that fits the scene and the post." },
  { id: "arms", label: "ยืนกอดอกมั่นใจ", en: "Standing with arms folded, relaxed and confident, a warm smile." },
  { id: "point", label: "ยิ้มชี้ไปทางข้อความ", en: "Smiling and pointing with one hand toward the empty side of the frame where the text will go." },
  { id: "consult", label: "นั่งให้คำปรึกษา", en: "Seated at a table, leaning in and explaining something kindly to a client across from them." },
  { id: "tablet", label: "ถือแท็บเล็ตอธิบาย", en: "Holding a tablet and showing its screen while explaining, friendly and professional (the screen shows no readable text)." },
  { id: "wave", label: "โบกมือทักทาย", en: "Waving hello toward the camera with a friendly, welcoming smile." },
] as const;

export type PoseId = (typeof POSES)[number]["id"];

export function poseText(id: string): string {
  return (POSES.find((p) => p.id === id) ?? POSES[0]).en;
}

/** a piece's person, as it is stored on the piece so a redraw keeps them */
export interface PiecePerson {
  id: string;
  pose: string;
}
