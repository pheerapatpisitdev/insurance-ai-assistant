import { describe, expect, it } from "vitest";
import { healthFaqAnswer } from "@/lib/assistant/ihealthy/faq";
import { iHealthyFacts } from "@/lib/ihealthy-facts";

describe("the health answers the agent types by hand", () => {
  it("puts the declaration first, before anything about a price", () => {
    const answer = healthFaqAnswer("เป็นเบาหวาน ทำได้ไหม เบี้ยขึ้นทุกปีด้วยหรือเปล่า")!;
    expect(answer).toContain("แถลงข้อมูลสุขภาพตามจริง");
    expect(answer).not.toContain("ตามอายุที่เพิ่มขึ้น");
  });

  it("says the health relief, which is not the life one", () => {
    const answer = healthFaqAnswer("ลดหย่อนภาษีได้ไหม")!;
    expect(answer).toContain("25,000");
    expect(answer).toContain("100,000");
  });

  it("says the premium rises, because on this contract it does", () => {
    const answer = healthFaqAnswer("เบี้ยขึ้นตามอายุไหม")!;
    expect(answer).toContain("ปรับตามอายุ");
    expect(answer).toContain("เบี้ยปีแรก");
  });

  it("takes the waiting periods from the contract rather than from memory", () => {
    const { terms } = iHealthyFacts();
    const answer = healthFaqAnswer("ซื้อแล้วใช้ได้เลยไหม")!;
    expect(answer).toContain(String(terms.waitingDays));
    expect(answer).toContain(String(terms.specialWaitingDays));
    expect(answer).toContain(terms.specialWaitingDiseases[0]);
  });

  it("answers nothing it was not asked", () => {
    expect(healthFaqAnswer("สวัสดีครับ")).toBeUndefined();
    expect(healthFaqAnswer("โกลด์เท่าไหร่")).toBeUndefined();
  });
});
