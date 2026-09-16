# เชื่อมเครื่องคำนวณประกันกับ ChatGPT

โปรเจกต์นี้มี MCP endpoint แบบ Streamable HTTP ที่ `/mcp` และมีเครื่องมืออ่านข้อมูล 2 ตัว:

- `list_insurance_plans` คืนช่วงอายุ ทุนประกัน และรหัสแบบของ PLB, LifeProtect, iShield และ LifeTreasure
- `calculate_insurance_quote` คำนวณเบี้ยจาก `plan_code`, `variant`, `age`, `sex` (`M`/`F`) และ `sum_assured` (บาท)

ผลเบี้ยคิดเป็นบาทต่อหนึ่งงวดตามโหมดรายปี ราย 6 เดือน และรายเดือน; `available: false` หมายถึงงวดนั้นต่ำกว่าขั้นต่ำที่ระบบรับได้ ข้อมูลที่ส่งออกเป็นราคาเบื้องต้นจากตารางอัตรา ไม่ใช่การอนุมัติรับประกัน

## ใช้กับ ChatGPT

1. Deploy แอพตามวิธีปกติของโปรเจกต์ให้มี HTTPS URL ที่เข้าถึงได้จากภายนอก เช่น `https://example.com/mcp`
2. ใน ChatGPT เปิด Developer Mode จาก **Settings → Apps & Connectors → Advanced settings**
3. เพิ่ม app/connector แบบกำหนดเอง โดยใส่ URL `/mcp` ของ deployment
4. เปิดใช้ app ในแชต แล้วลองถาม เช่น “PLB แบบ PLB12 ชายอายุ 35 ปี ทุน 1,000,000 บาท เบี้ยรายปีเท่าไร”

หลังเปลี่ยนชื่อหรือ schema ของเครื่องมือ ให้ refresh app ใน ChatGPT เพื่อโหลดรายการ tools ใหม่

Endpoint นี้ให้ข้อมูลแบบ public และไม่เรียก API key ของระบบ AI; หากจะเพิ่มข้อมูลลูกค้าหรือเครื่องมือแก้ไขข้อมูลในอนาคต ต้องเพิ่มระบบยืนยันตัวตนก่อน
