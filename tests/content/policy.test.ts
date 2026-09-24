import { describe, expect, it } from "vitest";
import { checkPolicy } from "@/lib/content/policy";

const codes = (text: string) => checkPolicy(text).map((f) => f.code);

describe("checkPolicy", () => {
  it("stops copy that tells the reader what they are", () => {
    expect(codes("คุณป่วยเป็นโรคเรื้อรังอยู่ใช่ไหม")).toEqual(["health_you"]);
    expect(codes("คุณกำลังมีหนี้บ้านอยู่ใช่ไหม")).toEqual(["debt_you"]);
    expect(codes("คุณอายุ 40 แล้ว ต้องมีประกัน")).toEqual(["age_you"]);
    expect(codes("อายุ 50 ปีขึ้นไปสมัครได้ทันที")).toEqual(["age_you"]);
  });

  it("lets a supposition through — insurance is sold on 'if'", () => {
    expect(codes("ถ้าวันหนึ่งคุณป่วยหนัก ใครจะดูแลครอบครัว")).toEqual([]);
    expect(codes("สมมติว่าคุณป่วยกะทันหัน")).toEqual([]);
    // the supposition covers its own sentence and not the next one
    expect(codes("ถ้าคุณป่วย… แล้วคุณป่วยอยู่ตอนนี้ใช่ไหม")).toEqual(["health_you"]);
  });

  it("leaves a third-person example alone", () => {
    // the briefs price "ผู้หญิงอายุ 35"; that is an example, not the reader
    expect(codes("ตัวอย่าง ผู้หญิงอายุ 35 ทุน 500,000 บาท เบี้ยวันละ 20 บาท")).toEqual([]);
  });

  it("stops guarantees and requests for personal data", () => {
    expect(codes("สมัครวันนี้ อนุมัติ 100%")).toEqual(["guarantee"]);
    expect(codes("การันตีอนุมัติทุกเคส")).toEqual(["guarantee"]);
    expect(codes("ส่งเลขบัตรประชาชนมาในคอมเมนต์")).toEqual(["pii_request"]);
  });

  it("warns, without stopping, on an unprovable superlative", () => {
    const [f] = checkPolicy("เบี้ยถูกที่สุดในประเทศ");
    expect(f.code).toBe("superlative");
    expect(f.severity).toBe("warn");
  });

  it("says nothing about clean copy", () => {
    expect(codes("ทุน 1,000,000 บาท ถ้าเสียชีวิตก่อนอายุ 60 ครอบครัวได้ 2 เท่า")).toEqual([]);
  });

  it("reads the polite ท่าน as the reader too", () => {
    expect(codes("ท่านป่วยเป็นเบาหวานอยู่ใช่ไหม")).toEqual(["health_you"]);
    expect(codes("ท่านมีหนี้บ้านอยู่ใช่ไหม")).toEqual(["debt_you"]);
    expect(codes("ท่านตกงานอยู่หรือเปล่า")).toEqual(["job_you"]);
    expect(codes("ถ้าวันหนึ่งท่านป่วยหนัก ใครดูแล")).toEqual([]);
  });

  it("reads Thai digits as digits", () => {
    expect(codes("คุณอายุ ๔๐ แล้ว ต้องมีประกัน")).toEqual(["age_you"]);
    expect(codes("อายุ ๕๐ ปีขึ้นไปสมัครได้ทันที")).toEqual(["age_you"]);
    expect(codes("สมัครวันนี้ อนุมัติ ๑๐๐%")).toEqual(["guarantee"]);
    expect(codes("อันดับ ๑ ของประเทศ")).toEqual(["superlative"]);
  });
});
