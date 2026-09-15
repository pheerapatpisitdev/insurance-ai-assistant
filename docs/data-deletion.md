# การลบข้อมูลลูกค้ารายคน (คำขอตาม PDPA)

เอกสารนี้ใช้เมื่อมีคนขอให้ลบข้อมูลของตัวเอง หรือขอทราบว่าระบบเก็บอะไรไว้บ้าง
หน้า [นโยบายความเป็นส่วนตัว](../src/app/privacy/page.tsx) สัญญาไว้ว่าจะทำให้ภายใน **30 วัน**

> ระบบยังไม่มีปุ่มลบในหน้าจอ — เฟสแรกของ `/admin/crm` อ่านอย่างเดียว
> จนกว่าจะมีปุ่ม ให้ทำด้วย SQL ตามขั้นตอนข้างล่างใน SQL Editor ของ Supabase

## 1. ยืนยันตัวตนก่อนเสมอ

คำขอมาทางอีเมล และอีเมลไม่ได้พิสูจน์ว่าเป็นเจ้าของแชท **ห้ามลบจากคำขอที่ยืนยันไม่ได้** —
การลบผิดคนก็คือการทำลายข้อมูลของคนที่ไม่ได้ขอ

ให้ผู้ขอทำอย่างใดอย่างหนึ่ง:

- ส่งข้อความในแชทเพจนั้นว่า "ขอให้ลบข้อมูลของฉัน" แล้วแจ้งเวลาที่ส่งมาทางอีเมล
- ส่งภาพหน้าจอบทสนทนาที่เห็นชื่อเพจและช่วงเวลา

แล้วจึงหา `psid` ของเขาจากกล่องข้อความของเพจ

## 2. หา `user_hash` จาก `psid`

ระบบเก็บลูกค้าเป็นแฮชทางเดียว ไม่ใช่ `psid` ตรง ๆ สูตรคือ HMAC-SHA256 ของ `psid`
โดยใช้ `FB_APP_SECRET` เป็นกุญแจ แล้วเขียนเป็นเลขฐานสิบหก
— ดู `hashUserId()` ใน [`src/lib/facebook/verify.ts`](../src/lib/facebook/verify.ts)

รันจากรากของโปรเจกต์ (อ่าน secret จาก `.env.local` เอง ไม่ต้องพิมพ์ออกมา):

```bash
node -e 'const c=require("crypto"),f=require("fs");
const s=(f.readFileSync(".env.local","utf8").match(/^FB_APP_SECRET=(.*)$/m)||[])[1]||"";
if(!s){console.error("ไม่พบ FB_APP_SECRET ใน .env.local");process.exit(1)}
console.log(c.createHmac("sha256",s.trim()).update(process.argv[1]).digest("hex"))' PSID_ตรงนี้
```

ค่าที่ได้คือ `user_hash` ที่ใช้ในทุกคำสั่งข้างล่าง (เขียนแทนเป็น `:'hash'`)

**ถ้า `FB_APP_SECRET` เคยถูกเปลี่ยน** แถวที่เขียนก่อนเปลี่ยนจะมีแฮชคนละค่า
และหาด้วย secret ปัจจุบันไม่เจอ กรณีนั้นต้องใช้ค่าเดิมคำนวณอีกชุดหนึ่งด้วย

## 3. ดูก่อนว่าจะลบอะไร

รันอันนี้ก่อนเสมอ และส่งผลลัพธ์ให้ผู้ขอได้ถ้าเขาขอทราบว่าเก็บอะไรไว้:

```sql
-- แทน :hash ด้วยค่าที่ได้จากขั้นที่ 2
select 'conversations' as t, count(*) from ins_conversations where user_hash = :'hash'
union all
select 'leads', count(*) from ins_leads where user_hash = :'hash'
union all
select 'sessions', count(*) from ins_chat_sessions where user_hash = :'hash'
union all
select 'followups', count(*) from ins_chat_followups where user_hash = :'hash'
union all
select 'events', count(*) from ins_events
  where conversation_id in (select id from ins_conversations where user_hash = :'hash');
```

รายละเอียดที่เก็บไว้ (ไม่มีข้อความของลูกค้าอยู่ในนี้):

```sql
select c.id, c.started_at, c.product, c.source, c.ad_id,
       c.priced_at, c.form_sent_at, c.form_done_at, c.handover_at, c.messages
from ins_conversations c where c.user_hash = :'hash' order by c.started_at desc;

select e.kind, e.product, e.data, e.at
from ins_events e
join ins_conversations c on c.id = e.conversation_id
where c.user_hash = :'hash' order by e.at;
```

## 4. ลบ

ทำในทรานแซกชันเดียว ลบลูกก่อนพ่อแม่:

```sql
begin;

-- คิวติดตามและ session ที่ยังค้าง
delete from ins_chat_followups where user_hash = :'hash';
delete from ins_chat_sessions  where user_hash = :'hash';

-- รายชื่อผู้สนใจ พร้อมรหัสที่เข้ารหัสไว้
delete from ins_leads where user_hash = :'hash';

-- เหตุการณ์ แล้วจึงบทสนทนา
delete from ins_events
 where conversation_id in (select id from ins_conversations where user_hash = :'hash');
delete from ins_conversations where user_hash = :'hash';

-- ตรวจว่าไม่เหลืออะไรก่อน commit
select 'conversations' as t, count(*) from ins_conversations where user_hash = :'hash'
union all select 'leads', count(*) from ins_leads where user_hash = :'hash'
union all select 'sessions', count(*) from ins_chat_sessions where user_hash = :'hash'
union all select 'followups', count(*) from ins_chat_followups where user_hash = :'hash';

-- ทุกแถวต้องเป็น 0 ถ้าไม่ใช่ ให้ rollback แล้วหาสาเหตุ
commit;
```

## 5. สิ่งที่ลบด้วยวิธีนี้ไม่ได้ และต้องบอกผู้ขอ

| อยู่ที่ไหน | ลบอย่างไร |
|---|---|
| ข้อความในแชทฝั่งเฟซบุ๊ก | ผู้ขอลบเองจากหน้าแชท เราลบแทนไม่ได้ |
| `ins_unanswered` | ไม่ผูกกับตัวบุคคลโดยตั้งใจ จึงชี้ว่าแถวไหนเป็นของใครไม่ได้ ระบบลบเองใน 30 วัน |
| `ins_usage_ledger` | มีแต่จำนวนคำกับค่าใช้จ่าย ไม่มีตัวตนหรือข้อความ |
| log ของ Vercel | หมดอายุเองตามนโยบายของผู้ให้บริการ |
| ใบคำขอที่กรอกในฟอร์ม | เป็นระบบแยก ไม่ได้อยู่ในฐานข้อมูลนี้ |

## 6. บันทึกไว้

เก็บอีเมลคำขอ วิธีที่ใช้ยืนยันตัวตน วันที่ลบ และผลนับที่ได้หลังลบ
ไว้นอกฐานข้อมูลนี้ (เช่นในกล่องอีเมล) เพื่อพิสูจน์ได้ว่าทำตามคำขอแล้ว

## 7. สิ่งที่ควรทำให้ไม่ต้องทำมือ

- ปุ่มลบในหน้า `/admin/crm` พร้อมยืนยันสองชั้น
- `closed_at` ยังไม่มีอะไรตั้ง แปลว่า `ins_prune()` จะไม่ล้าง `psid_cipher` ของ lead เลย
  ถ้าเพิ่มปุ่ม "ปิดการขาย" การล้างอัตโนมัติที่ 180 วันจะเริ่มทำงานตามที่ออกแบบไว้
