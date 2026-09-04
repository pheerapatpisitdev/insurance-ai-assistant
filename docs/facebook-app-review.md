# ยื่น App Review ของ Facebook Messenger

แอป **ai chet** (`1624098972401227`) · เพจ **LuckyPlanner โชคดีที่มีแพลน**
Webhook: `https://www.advisortool.app/api/facebook/webhook`
Privacy Policy: `https://www.advisortool.app/privacy`

---

## สถานะ ณ 4 ก.ย. 2569

ยื่นยังไม่ได้ Meta ขึ้นข้อความว่า *"To add a permission or feature to App Review, become a
Tech Provider"* ตรวจแล้วพบว่าพอร์ตโฟลิโอธุรกิจ Luckyplanner ยังไม่ผ่านการตรวจสอบสองอย่าง

| สิ่งที่ต้องผ่าน | สถานะ | ใครทำได้ |
| --- | --- | --- |
| ยืนยันธุรกิจ (Business Verification) | ยังไม่ได้ตรวจสอบยืนยัน | เจ้าของธุรกิจ ต้องใช้เอกสารจดทะเบียน |
| ยืนยันสิทธิ์การเข้าถึง (Tech Provider) | Not verified | ทำหลังข้อบน Meta ใช้เวลารีวิว 5 วัน |
| App Review สิทธิ์ `pages_messaging` | ยังยื่นไม่ได้ ถูกบล็อกจากสองข้อบน | ยื่นได้เมื่อสองข้อบนผ่าน |

**แก้ไข 4 ก.ย. 2569 ค่ำ — บอทตอบคนทั่วไปได้แล้วโดยไม่ต้องยื่น App Review**
ทดสอบด้วยบัญชี Facebook ที่ไม่มีบทบาทใดในแอป ทักเพจ LuckyPlanner แล้วบอทตอบทันที
(ข้อความเข้า 19:01 และ 19:03 ตอบใบเสนอเบี้ยทั้งสองครั้ง) เหตุผลคือเพจกับแอปอยู่ใต้
พอร์ตโฟลิโอธุรกิจเดียวกัน (Luckyplanner) สิทธิ์ระดับมาตรฐานของ Meta ครอบคลุม
สินทรัพย์ของธุรกิจตัวเองอยู่แล้ว ข้อความก่อนหน้านี้ที่ว่า "ตอบได้เฉพาะคนที่มีบทบาทในแอป"
จึงไม่ถูกต้องสำหรับเพจนี้

ตารางด้านบนยังจำเป็น **เฉพาะเมื่อจะเอาบอทไปตอบเพจของธุรกิจอื่น** เช่นเพจของตัวแทนในทีม
ที่ไม่ได้อยู่ใต้พอร์ตโฟลิโอ Luckyplanner ถ้ายังใช้กับเพจของตัวเองอย่างเดียว ไม่ต้องทำอะไร

---

## สิ่งที่เตรียมไว้แล้ว

- นโยบายความเป็นส่วนตัวเผยแพร่ที่ `https://www.advisortool.app/privacy` (ต้องมี Meta ถึงจะรับพิจารณา)
- ลิงก์วิธีขอลบข้อมูลตั้งไว้ที่ `https://www.advisortool.app/privacy#rights`
- ทั้งสองบันทึกในหน้าตั้งค่าแอปแล้ว

ยังไม่ได้ตั้งคือ URL ข้อกำหนดในการใช้บริการ ตอนนี้ชี้ไปที่ `https://www.facebook.com/`
ซึ่งเป็นค่าที่ติดมาแต่เดิม ไม่ผิดกฎแต่ไม่ตรงความจริง ถ้าจะเขียนข้อกำหนดของตัวเองต้องให้เจ้าของธุรกิจตัดสินใจเนื้อหา

---

## คำอธิบายสิทธิ์ `pages_messaging`

ใช้ข้อความนี้ในช่อง "อธิบายว่าแอปของคุณใช้สิทธิ์นี้อย่างไร" ตอบเป็นภาษาอังกฤษได้ผลดีกว่า

> Our Page, "LuckyPlanner โชคดีที่มีแพลน", belongs to a licensed life insurance agency in
> Thailand. People message the Page to ask what a plan covers, what the conditions are, and
> what a premium would cost them.
>
> We use `pages_messaging` to receive those inbound messages through the Messenger webhook
> and to reply through the Send API. The assistant answers three kinds of question. Premium
> estimates are computed in our own code from the insurer's published rate tables — the
> figures are arithmetic, not model output, and every one of them is verified against the
> insurer's own spreadsheets in our test suite. Questions about a plan's terms are answered
> from those same tables. General questions are answered from documents the agency has
> uploaded, and the answer names the document and page it came from. A language model is used
> to understand the question and to word the reply; it is never the source of a number.
>
> We reply only to people who messaged the Page first, within the standard messaging window.
> We never send promotional or unsolicited messages. The assistant does not ask for national
> ID numbers, policy numbers, medical records, or payment details, and it states on every
> quote that the figure is an estimate rather than a formal quotation.
>
> Conversations are kept for 24 hours so that follow-up questions make sense, then deleted.
> The page-scoped user id is stored only as an HMAC hash, which is enough to continue the same
> conversation and cannot be reversed.

---

## ข้อความสำหรับผู้ตรวจสอบ

ใช้ในช่อง "ข้อมูลสำหรับผู้ตรวจสอบ"

> Reviewers can test by messaging our Page "LuckyPlanner โชคดีที่มีแพลน".
>
> Suggested messages (Thai, with what each one tests):
>
> - `ไลฟ์โพรเทค ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่` — a premium estimate for a 35-year-old man
>   with 1,000,000 THB of cover. The reply gives the annual premium, the death benefit by age
>   band, and the surrender value at ten ages.
> - `แล้วผู้หญิงล่ะ จ่ายรายเดือน` — a follow-up. It shows the assistant remembers the age and
>   the sum assured from the previous message and re-prices for a woman paying monthly.
> - `iShield รับอายุเท่าไหร่` — a question about a plan's terms, answered from the insurer's
>   rate tables.
> - `ขั้นตอนการเคลมมีอะไรบ้าง` — a general question answered from an uploaded document; the
>   reply names the document and page.
> - `ช่วยเขียนโค้ด python ให้หน่อย` — an off-topic request. The assistant declines and returns
>   to insurance.
>
> Every reply arrives within about 5 to 15 seconds. No personal data is requested at any point.

---

## สคริปต์วิดีโอสาธิต

Meta ต้องการวิดีโอที่เห็นการทำงานจริง ยาว 2 ถึง 4 นาที ห้ามใช้สไลด์หรือภาพนิ่ง
ไม่ต้องมีเสียงพูดแต่ต้องมีคำบรรยายภาษาอังกฤษบนภาพ ต้องอัดเองเพราะต้องใช้บัญชีจริงส่งข้อความ

| เวลา | ทำอะไร | คำบรรยายบนวิดีโอ |
| --- | --- | --- |
| 0:00 | เปิดหน้าเพจให้เห็นชื่อเพจชัด | Our Page: a licensed life insurance agency in Thailand |
| 0:10 | กดส่งข้อความ พิมพ์ `ไลฟ์โพรเทค ชาย 35 ทุน 1 ล้าน เบี้ยเท่าไหร่` | A customer asks for a premium estimate |
| 0:25 | รอคำตอบ เลื่อนให้เห็นทั้งข้อความ | Premiums are computed from the insurer's rate tables, not by a language model |
| 0:45 | ชี้ให้เห็นบรรทัดท้ายที่บอกว่าเป็นเบี้ยประมาณการ | Every quote states that it is an estimate, not a formal quotation |
| 1:00 | พิมพ์ `แล้วผู้หญิงล่ะ จ่ายรายเดือน` | A follow-up question, answered in context |
| 1:20 | พิมพ์ `ขั้นตอนการเคลมมีอะไรบ้าง` | A general question answered from an uploaded document |
| 1:40 | ชี้ให้เห็นบรรทัด `ที่มา:` ท้ายคำตอบ | The answer names the document and page it came from |
| 2:00 | พิมพ์ `ช่วยเขียนโค้ด python ให้หน่อย` | Off-topic requests are declined |
| 2:15 | เปิด `https://www.advisortool.app/privacy` | Our privacy policy, linked from the app settings |

---

## ลำดับที่ต้องทำ

1. ยืนยันธุรกิจที่ Meta Business Suite → การตั้งค่า → ข้อมูลธุรกิจ ใช้เอกสารจดทะเบียนธุรกิจ (Meta ใช้เวลา 1 ถึง 5 วันทำการ)
2. ยืนยันสิทธิ์การเข้าถึง (Tech Provider) ในหน้าเดียวกัน หลังข้อ 1 ผ่าน (รีวิว 5 วัน)
3. อัดวิดีโอตามสคริปต์ข้างบน
4. App Dashboard → กรณีการใช้งาน → สิทธิ์การอนุญาต → แถว `pages_messaging` → การดำเนินการ → เพิ่มไปยังการตรวจสอบแอพ แล้วกรอกคำอธิบายกับข้อความสำหรับผู้ตรวจสอบด้านบน
5. ยื่น แล้วรอผล 3 ถึง 7 วัน
6. ผ่านแล้วกดเผยแพร่แอป

ถ้าถูกปฏิเสธมักเป็นเพราะวิดีโอไม่เห็นการทำงานจริง หรือคำอธิบายไม่ตรงกับสิ่งที่วิดีโอแสดง แก้แล้วยื่นใหม่ได้ไม่จำกัดครั้ง
