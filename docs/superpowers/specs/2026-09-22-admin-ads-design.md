# หน้า ADS ในหลังบ้าน — ดูบัญชีโฆษณา Facebook

วันที่ 2026-09-22 · สถานะ: ตกลงแล้ว รอเขียนแผน

## ที่มา

เจ้าของอยากมีเมนู ADS ใน `/admin` เพื่อดูบัญชีโฆษณา Facebook โดยไม่ต้องเปิด Ads Manager
เลือกขอบเขต **B**: ดูภาพรวมการใช้จ่าย + ต้นทุนต่อลูกค้าโดยโยงกับ CRM อ่านอย่างเดียว ไม่สั่งงานแอด

งานนี้คือ "ขั้นที่ 4" ที่สเปค CRM (`2026-09-15-crm-dashboard-design.md` §8) เขียนค้างไว้
ของที่มีอยู่แล้ว:

| มีแล้ว | ที่ไหน |
|---|---|
| ตาราง `ins_ad_daily` (pk `date, ad_id`) 16 คอลัมน์ ว่างเปล่า | Supabase |
| `ad_id` ของลูกค้าที่มาจากโฆษณา | `ins_conversations.ad_id`, `ins_leads.ad_id` |
| หน้าล็อกอิน Facebook + เก็บ token เข้ารหัส | `src/lib/facebook/oauth.ts`, `connection.ts`, ตาราง `ins_channel_auth` |
| ตัวอ่านชื่อโฆษณาจาก `ins_ad_daily` เพื่อเดาแบบประกัน | `src/lib/facebook/from-ad.ts` (พอมีข้อมูลจะทำงานเอง) |

## สิ่งที่ตัดสินไปแล้ว

1. **ดึงวันละครั้ง + ปุ่ม "ดึงตอนนี้"** — Vercel cron เรียกตอนเช้า หน้าอ่านจากฐานข้อมูล
   ไม่ดึงสดจาก Meta ทุกครั้งที่เปิดหน้า (ช้า ติด rate limit ไม่มีประวัติ)
2. **อ่านอย่างเดียว** — ขอสิทธิ์ `ads_read` เท่านั้น ไม่ขอ `ads_management` เพราะ `/admin`
   ไม่มีล็อกอิน (ดู `admin/layout.tsx`) หน้าที่สั่งงานแอดได้จากที่อยู่เปิดคือความเสี่ยงที่ไม่คุ้ม
3. **token ผู้ใช้อายุ ~60 วัน** — ยอมรับก่อน หมดอายุแล้วหน้าขึ้นให้เชื่อมใหม่ System User
   token ถาวรไว้ทีหลังถ้ารำคาญ
4. **หลายบัญชีโฆษณาได้** — เก็บได้หลายบัญชี ทำแบบเดียวกับการเลือกหลายเพจ

## 1. การเชื่อมบัญชีโฆษณา

### สิทธิ์

`SCOPES` เดิม `["pages_show_list", "pages_messaging", "pages_manage_metadata"]` เพิ่ม `ads_read`
เป็นรายการแยก `ADS_SCOPES = ["ads_read"]` ไม่ยัดรวมกับของเพจ เพราะการเชื่อมเพจไม่ควรถูกบังคับ
ให้ขอสิทธิ์โฆษณาไปด้วย

แอปเป็น Business type ใช้ `FB_LOGIN_CONFIG_ID` ซึ่ง Meta จะไม่สนใจ `scope` ถ้ามี `config_id`
เพราะฉะนั้น **เจ้าของต้องเพิ่ม `ads_read` ใน Login Configuration บน Meta dashboard เอง**
(ขั้นตอนเขียนไว้ใน §7) โค้ดจะส่ง `scope=ads_read` ไปด้วยเผื่อกรณีไม่มี config

ไม่ต้องผ่าน App Review: Marketing API กับบัญชีโฆษณาของตัวเอง ในฐานะผู้ดูแลแอป ใช้ Standard
Access ได้ (ตรวจแล้ว 2026-09-15 ตามสเปค CRM §8)

### เส้นทาง

ใช้ route เดิม `GET /api/facebook/connect?for=ads` และ callback เดิม โดย `state` พกคำว่า `ads`
ไว้ (ลงลายเซ็นเหมือนเดิม) callback เห็นแล้วแยกทาง:

- ทาง `ads`: แลก code เป็น long-lived user token → เรียก `/me/adaccounts?fields=id,name,currency,account_status`
  → ถ้ามีบัญชีเดียวบันทึกเลย ถ้าหลายบัญชีเก็บ token ไว้ชั่วคราวแล้วให้เลือก → redirect
  กลับ `/admin/ads?fb=…`
- ทางเดิม: เหมือนเดิมทุกอย่าง ไม่แตะ

### ที่เก็บ

ตาราง `ins_channel_auth` เดิม ผ่าน RPC `ins_set_channel_auth` / `ins_get_channel_auth` เดิม
ไม่ต้องมี migration ใหม่:

| key | page_id | page_name | token | scopes |
|---|---|---|---|---|
| `facebook_ads:<act_id>` | `act_123…` | ชื่อบัญชี | user token (long-lived) | `["ads_read"]` |
| `facebook_ads_pending` | null | null | user token รอเลือกบัญชี | |

`pageConnections()` เดิมกรองแถวที่ `page_id` ไม่ว่าง — จะเห็นแถว ads ด้วย ต้องกรอง prefix
`facebook_ads:` ออกจากรายการเพจ (แก้ใน `connection.ts` หนึ่งบรรทัด + test)

ไฟล์ใหม่ `src/lib/facebook/ads-connection.ts`: `adAccounts()`, `adAccountToken(actId)`,
`saveAdAccount()`, `clearAdAccount()`, `savePendingAds()/readPendingAds()/clearPendingAds()`

## 2. ตัวดึงข้อมูล (sync)

`GET /api/facebook/ads/sync` — ยอมรับเมื่อ header `Authorization: Bearer <CRON_SECRET>`
ตรงกับ env (Vercel ส่งให้เองเมื่อเป็น cron) หรือเมื่อถูกเรียกจาก Server Action ของหน้า ADS
(ปุ่ม "ดึงตอนนี้" เรียกฟังก์ชัน sync ตรง ไม่ผ่าน HTTP)

`vercel.json` ใหม่:

```json
{ "crons": [{ "path": "/api/facebook/ads/sync", "schedule": "0 3 * * *" }] }
```

03:00 UTC = 10:00 กรุงเทพ ตัวเลขของเมื่อวานนิ่งแล้ว Hobby plan ให้ cron วันละครั้งพอดี

ฟังก์ชัน `syncAds(days = 3)` ใน `src/lib/facebook/ads-sync.ts`:

1. อ่านทุกบัญชีจาก `adAccounts()`; ไม่มี → คืน `{ accounts: 0 }` ไม่ error
2. ต่อบัญชี เรียก `GET /act_<id>/insights` ด้วย
   `level=ad`, `time_increment=1`, `time_range={since,until}` ย้อนหลัง `days` วัน,
   `fields=ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,spend,impressions,reach,clicks,inline_link_clicks,actions,account_currency`
   ตาม `paging.next` จนหมด
3. แปลงแต่ละแถวเป็น `ins_ad_daily`: `link_clicks = inline_link_clicks`,
   `messaging_started = actions[type=onsite_conversion.messaging_conversation_started_7d].value`
   (ไม่มี → 0), `actions` เก็บ jsonb ทั้งก้อน, `fetched_at = now()`
4. upsert ทีละก้อนบน `(date, ad_id)` — ดึงย้อน 3 วันทุกวันเพราะ Meta ปรับตัวเลขย้อนหลัง
5. คืน `{ accounts, rows, errors: [{ actId, message }] }` บัญชีที่พังไม่หยุดบัญชีอื่น

token หมดอายุ: Meta ตอบ error code 190 → บันทึกใน `errors` ด้วยข้อความไทย
"token หมดอายุ กดเชื่อมบัญชีโฆษณาใหม่"

ผลการดึงไม่ถูกเก็บลงตารางไหน: ปุ่ม "ดึงตอนนี้" แสดงผล (จำนวนแถว / error) สดบนการ์ด
ส่วน cron เขียน `console.error` เมื่อพัง สถานะ "ข้อมูลค้าง" บนหน้าคำนวณจาก `max(fetched_at)`
ใน `ins_ad_daily` อย่างเดียว — cron ที่พังติดกันจะโผล่เป็น "ค้างเกิน 2 วัน" เอง

## 3. หน้า `/admin/ads`

Server Component `page.tsx` + `actions.ts` (`loadAds(range)`, `syncNow()`,
`connectAdAccounts(ids)`, `disconnectAdAccount(id)`) + client ชิ้นเล็ก ตามแบบ `admin/messenger`

### 3.1 การ์ดสถานะ (บนสุด)

- ยังไม่เชื่อม → ข้อความ + ปุ่ม "เชื่อมบัญชีโฆษณา" (ลิงก์ไป `/api/facebook/connect?for=ads`)
  + กล่องขั้นตอนที่เจ้าของต้องทำบน Meta dashboard ก่อน (§7 ย่อ)
- รอเลือกบัญชี (`fb=choose`) → รายการติ๊ก แบบ `PagePicker`
- เชื่อมแล้ว → ชื่อบัญชี, สกุลเงิน, เชื่อมเมื่อ, ดึงล่าสุดเมื่อ (จาก `max(fetched_at)`),
  ปุ่ม "ดึงตอนนี้", ปุ่ม "ตัดการเชื่อมต่อ" (ยืนยันก่อน แบบ `DisconnectButton`)
- ดึงล่าสุดเกิน 2 วัน → ป้ายเตือน "ข้อมูลค้าง" สีทราย

### 3.2 ภาพรวม

สลับช่วง `7d | 30d` (query `?range=` แบบ CRM) แถว `Stat` 6 ช่อง:

| ช่อง | ที่มา |
|---|---|
| ใช้จ่าย | `sum(spend)` แสดง ฿ ทศนิยม 0 |
| คนเห็น | `sum(reach)` |
| คลิกลิงก์ | `sum(link_clicks)` |
| เริ่มแชท | `sum(messaging_started)` |
| ลูกค้าใน CRM | `count(ins_leads where ad_id in (…) and created_at in range)` |
| บาทต่อลูกค้า | ใช้จ่าย ÷ ลูกค้า; ลูกค้า 0 → "—" |

### 3.3 ตารางแคมเปญ

หนึ่งแถวต่อ `campaign_id` เรียงตามใช้จ่ายมาก→น้อย กดแถวขยายเห็นรายโฆษณา (`<details>`
ไม่ต้องมี state) คอลัมน์:

ชื่อ · ใช้จ่าย · คนเห็น · เริ่มแชท · ลูกค้า · บาท/คน · ได้ราคาแล้ว · ส่งฟอร์มแล้ว

- ลูกค้า = `ins_leads.ad_id` ในช่วง
- ได้ราคาแล้ว = `ins_conversations.ad_id` ที่ `priced_at` ไม่ว่าง ในช่วง
- ส่งฟอร์มแล้ว = `form_sent_at` ไม่ว่าง
- โฆษณาที่มีลูกค้าใน CRM แต่ไม่มีแถวใน `ins_ad_daily` (เช่น แอดเก่าที่หยุดแล้ว) → แถว
  "โฆษณาอื่น (ไม่มีตัวเลขค่าใช้จ่ายในช่วงนี้)" ท้ายตาราง ไม่ทิ้งลูกค้า

การรวมตัวเลขทำใน pure function `summarise(rows, leads, conversations, range)` ใน
`src/lib/ads/summary.ts` มี test

### 3.4 ว่าง

เชื่อมแล้วแต่ยังไม่มีแถว → `Empty` "ยังไม่มีตัวเลข กดดึงตอนนี้ หรือรอถึงพรุ่งนี้ 10:00"

## 4. เมนูและหน้าแรก admin

- `src/lib/shell/menu.ts` เพิ่ม `{ href: "/admin/ads", label: "ADS", icon: "megaphone" }`
  ต่อจาก CRM (ไอคอน `megaphone` มีอยู่แล้ว)
- `src/app/admin/overview.ts` เพิ่ม 2 รายการ: ยังไม่เชื่อมบัญชีโฆษณา (action "ไปเชื่อม"),
  ตัวเลขโฆษณาค้างเกิน 2 วัน (action "ไปดึง") ทั้งคู่ระดับเตือน ไม่ใช่ error

## 5. env ใหม่

| ตัวแปร | ที่ไหน | หน้าที่ |
|---|---|---|
| `CRON_SECRET` | Vercel (ทุก environment) + `.env.example` | กันคนนอกยิง `/api/facebook/ads/sync` |

ไม่มี env อื่น token อยู่ในฐานข้อมูล

## 6. ความปลอดภัย

- sync route ปฏิเสธ 401 เมื่อไม่มี/ไม่ตรง `CRON_SECRET`; ไม่มี env เลย → 503 พร้อมข้อความไทย
- token ไม่เคยไปถึง React tree: `loadAds()` คืนเฉพาะชื่อ/สกุลเงิน/เวลา
- `ads_read` อย่างเดียว ต่อให้ใครเปิด `/admin/ads` ได้ก็ทำได้แค่ดูตัวเลข
- ตัดการเชื่อมต่อลบแถว token ทันที (`ins_clear_channel_auth`)

## 7. สิ่งที่เจ้าของต้องทำเอง (ก่อนกดเชื่อม)

1. developers.facebook.com → แอปนี้ → Facebook Login for Business → Configurations →
   config ที่ id ตรงกับ `FB_LOGIN_CONFIG_ID` → Edit → Permissions → ติ๊ก `ads_read` → Save
2. Vercel → Settings → Environment Variables → เพิ่ม `CRON_SECRET` (สุ่มยาว ๆ) ทุก environment
3. deploy แล้วเปิด `/admin/ads` → กด "เชื่อมบัญชีโฆษณา" ด้วยบัญชี Facebook ที่เป็นผู้ดูแล
   บัญชีโฆษณาที่ยิง Life Protect / iHealthy
4. ถ้า Meta ขอ Business Verification ระหว่างทาง ต้องทำก่อนถึงจะเห็นบัญชี

## 8. การทดสอบ

- `tests/ads/summary.test.ts` — รวมยอดต่อแคมเปญ, บาทต่อคน, ลูกค้า 0 → "—", แอดที่มีลูกค้าแต่
  ไม่มีตัวเลข → แถว "โฆษณาอื่น"
- `tests/ads/sync.test.ts` — แปลง insights → แถว `ins_ad_daily` (mock fetch): อ่าน
  `messaging_started` จาก actions, ไม่มี actions → 0, ตาม `paging.next`, บัญชีพังไม่หยุดบัญชีอื่น,
  error 190 → ข้อความ token หมดอายุ
- `tests/facebook/connection.test.ts` (มีอยู่หรือเพิ่ม) — `pageConnections()` ไม่นับแถว
  `facebook_ads:*`
- sync route: 401 เมื่อไม่มี bearer
- ผ่าน `npm run verify` ก่อน commit ทุกครั้ง

## 9. นอกขอบเขต (รอบนี้ไม่ทำ)

- เปิด/ปิด/ปรับงบแอด (`ads_management`)
- System User token ถาวร
- กราฟรายวัน (มีตารางแล้วเติมทีหลังได้ ข้อมูลอยู่ใน `ins_ad_daily` ครบ)
- ค่าใช้จ่ายโฆษณารวมกับ AI cost ในหน้า CRM
