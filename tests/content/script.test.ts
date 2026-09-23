import { describe, expect, it } from "vitest";
import { scenes } from "@/lib/content/script";

describe("a script read as a shot list", () => {
  const list = scenes(
    "รู้หรือไม่ว่าเลือกจ่ายได้ 3 แบบครับ",
    "[3–15 วิ] (ยกมือทั้งสองข้าง) ลองคิดดูนะครับ\n{จอ: ผู้ชายอายุ 35 ทุน 1,000,000 บาท}\n(ชี้ไปที่จอ) เลือกได้หลายแบบ\n\n[15–25 วิ] มีให้เลือก 6 แผน (6 แผน) {จอ: 9 ปี = 4,914 บาท/เดือน}",
    "[28–30 วิ] (ยกมือทำสัญลักษณ์โทรศัพท์) ทักแชทมาได้เลยครับ",
  );

  it("opens on the hook as the first three seconds", () => {
    expect(list[0]).toEqual({ time: "0–3 วิ", say: "รู้หรือไม่ว่าเลือกจ่ายได้ 3 แบบครับ", acts: [], screen: [] });
  });

  it("gives each marked stretch its own row, the closing included", () => {
    expect(list.map((s) => s.time)).toEqual(["0–3 วิ", "3–15 วิ", "15–25 วิ", "28–30 วิ"]);
  });

  it("keeps actions and on-screen text apart from the words said", () => {
    expect(list[1]).toEqual({
      time: "3–15 วิ",
      say: "ลองคิดดูนะครับ เลือกได้หลายแบบ",
      acts: ["ยกมือทั้งสองข้าง", "ชี้ไปที่จอ"],
      screen: ["ผู้ชายอายุ 35 ทุน 1,000,000 บาท"],
    });
  });

  it("leaves a bracket with a figure in it in the sentence", () => {
    expect(list[2].say).toBe("มีให้เลือก 6 แผน (6 แผน)");
    expect(list[2].screen).toEqual(["9 ปี = 4,914 บาท/เดือน"]);
  });

  it("still shows a script written without markers", () => {
    expect(scenes("เปิด", "พูดยาวๆ ไม่มีเวลา", "")).toEqual([
      { time: "0–3 วิ", say: "เปิด", acts: [], screen: [] },
      { time: null, say: "พูดยาวๆ ไม่มีเวลา", acts: [], screen: [] },
    ]);
  });

  it("does not take a scene direction with วิ in it for a time", () => {
    const list = scenes("เปิด", "[3–15 วิ] พูด [ตัดไปที่วิวทะเล] ต่อ", "");
    expect(list.map((s) => s.time)).toEqual(["0–3 วิ", "3–15 วิ"]);
  });

  it("keeps a stretch whose marker was left unclosed from swallowing the next", () => {
    const list = scenes("เปิด", "[3–15 วิ (ยิ้ม) ประโยคแรก\n\n[15–30 วิ] ประโยคสอง", "");
    expect(list.at(-1)).toMatchObject({ time: "15–30 วิ", say: "ประโยคสอง" });
    expect(list.some((s) => s.time?.includes("ประโยคแรก"))).toBe(false);
  });

  it("peels actions inside actions", () => {
    const [, s] = scenes("เปิด", "[3–15 วิ] (ชี้ไปที่กล้อง (ยิ้ม)) สวัสดีครับ", "");
    expect(s.acts.sort()).toEqual(["ชี้ไปที่กล้อง", "ยิ้ม"].sort());
    expect(s.say).toBe("สวัสดีครับ");
  });
});
