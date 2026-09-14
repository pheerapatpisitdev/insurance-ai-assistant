# ฐานข้อมูลรวบรวมข้อมูล: ที่มา บทสนทนา ใบเสนอราคา ลีด และผลโฆษณา

วันที่ 2026-09-14
สถานะ: รอผู้ใช้ตรวจทาน (มีสี่ข้อที่ต้องตัดสินใจในหัวข้อท้ายเอกสาร)

## ปัญหา

ระบบตอนนี้ตอบลูกค้าได้ แต่จำอะไรไม่ได้เลย

- `ins_chat_sessions` เก็บบทสนทนาไว้ให้ถามต่อเนื่อง 24 ชั่วโมง แล้วถือว่าหมดอายุ ไม่มีบันทึกว่าเคยคุยกับใคร
  กี่คน ถามอะไร ได้ราคาไหม สนใจสมัครไหม
- Meta ส่งรหัสโฆษณามาในเว็บฮุกทุกครั้งที่ลูกค้ากดจากโฆษณา แต่ `events.ts` อ่านเฉพาะข้อความ ก้อน `referral`
  ถูกทิ้งไป จึงตอบไม่ได้ว่าโฆษณาชิ้นไหนทำให้เกิดใบเสนอราคา
- ลูกค้าที่บอทส่งฟอร์มใบคำขอให้แล้ว ไม่มีที่บันทึกว่าเป็นลีด ตัวแทนต้องไล่หาในกล่องข้อความของเพจเอง
- ผลโฆษณาอยู่ใน Ads Manager ค่าโมเดลอยู่ใน `ins_usage_ledger` จำนวนบทสนทนาไม่อยู่ที่ไหนเลย สามอย่างนี้
  ไม่เคยถูกวางบนตารางเดียวกัน
- หน้า `/privacy` สัญญาว่าข้อความถูกลบภายใน 24 ชั่วโมง แต่ในโค้ดไม่มีอะไรลบจริง `loadSession()` แค่
  ไม่อ่านแถวที่เก่ากว่า 24 ชั่วโมง แถวนั้นค้างอยู่จนลูกค้าคนเดิมทักมาใหม่ แถวช่องทาง `line` จากวันที่ 4 ก.ย.
  ยังอยู่ในตาราง

ที่คุยกันไว้ก่อนหน้า: การวิเคราะห์โฆษณาและ CRM ทำไม่ได้บนข้อมูลที่ลบทิ้งทุกวัน เอกสารนี้ตอบว่าจะเก็บอะไร
เก็บอย่างไร เก็บนานแค่ไหน และใครอ่าน

## สิ่งที่จะสร้าง

ตารางใหม่ห้าใบ มุมมองสี่ตัว ฟังก์ชันลบข้อมูลตามอายุหนึ่งตัว และคอลัมน์เดียวบนตารางเดิม ทั้งหมดอยู่ใน
`public` ด้วยคำนำหน้า `ins_` เปิด RLS โดยไม่มี policy เหมือนตารางเดิม จึงเข้าถึงได้เฉพาะ service role
ฝั่งเซิร์ฟเวอร์

```
ลูกค้ากดโฆษณา → ทักเพจ → เว็บฮุก
   │
   ├─ referral (ad_id, ref) ─────────────► ins_conversations   หนึ่งแถวต่อบทสนทนา + ที่มา + ผลลัพธ์
   │                                            │
   ├─ ทุกเทิร์น: อ่าน / คิดเบี้ย / ส่งฟอร์ม ──► ins_events          เหตุการณ์ในบทสนทนา ไม่มีตัวตน ไม่มีข้อความ
   │                                            │
   ├─ กด "สนใจสมัคร" ──────────────────────► ins_leads           ลีดที่ตัวแทนต้องตามต่อ
   │
   └─ โมเดลต้องตอบเอง ────────────────────► ins_unanswered      คำถามที่ยังไม่มีคำตอบเขียนไว้ (30 วัน)

Routine รายสัปดาห์ (Facebook Ads → Supabase) ──► ins_ad_daily     ผลโฆษณารายวันต่อชิ้น

v_ins_ad_attribution = ins_ad_daily ⋈ ins_conversations ⋈ ins_leads   →  บาทต่อใบเสนอราคา บาทต่อลีด
```

หลักที่ยึด

1. **หน่วยของการวิเคราะห์คือบทสนทนา ไม่ใช่คน** ตัวตนอยู่บนแถวบทสนทนาแถวเดียว และถูกลบตามอายุ
   เหตุการณ์ทุกแถวชี้ไปที่บทสนทนา ไม่ถือตัวตนเอง ลบตัวตนแล้วสถิติยังอยู่ครบ
2. **ไม่เก็บข้อความของลูกค้าเพิ่มจากที่เก็บอยู่** เหตุการณ์เก็บแต่ชนิดกับตัวเลข ใบเสนอราคาเก็บอายุ เพศ ทุน
   เบี้ย ซึ่งเป็นสิ่งที่เครื่องคำนวณสร้าง ไม่ใช่สิ่งที่ลูกค้าพิมพ์ ยกเว้น `ins_unanswered` ซึ่งเป็นข้อที่ต้องตัดสินใจ
3. **การบันทึกห้ามทำให้บอทช้าหรือล้ม** เขียนหลังส่งคำตอบแล้ว ผิดพลาดก็แค่ log ลูกค้าไม่รู้เรื่อง
4. **ตัวเลขทุกตัวในรายงานย้อนกลับไปหาแถวต้นทางได้** มุมมองคำนวณจากตารางตอนอ่าน ไม่มีตารางสรุปที่
   ต้องคอยอัปเดตให้ตรงกัน

## ตาราง

### `ins_conversations` หนึ่งแถวต่อบทสนทนา

บทสนทนาเริ่มเมื่อ `loadSession()` ไม่พบเซสชัน หรือพบแต่เก่ากว่า 24 ชั่วโมง ซึ่งเป็นเส้นที่โค้ดใช้อยู่แล้ว
คนเดิมทักมาอีกครั้งในสัปดาห์ถัดไปคือบทสนทนาใหม่ที่มี `user_hash` เดิม จึงยังนับได้ว่าเป็นลูกค้าที่กลับมา
ตราบที่แฮชยังไม่ถูกลบ

```sql
create table if not exists ins_conversations (
  id               uuid primary key default gen_random_uuid(),
  channel          text not null default 'facebook',
  page_id          text,
  user_hash        text,                        -- HMAC ของ PSID ตัวเดียวกับ ins_chat_sessions; ลบทิ้งหลัง 90 วัน
  started_at       timestamptz not null default now(),
  last_event_at    timestamptz not null default now(),
  product          text,                        -- 'lifeprotect' | 'ihealthy' | null = ยังไม่เลือก

  -- ที่มา บันทึกครั้งแรกที่เห็น (first touch) ครั้งต่อไปลง ins_events
  source           text,                        -- 'ads' | 'shortlink' | 'organic'
  ad_id            text,
  ref              text,                        -- พารามิเตอร์ ref ที่เราตั้งเองบนโฆษณาหรือลิงก์ m.me
  referral         jsonb,                       -- ก้อน referral ดิบจาก Meta ทั้งก้อน กันฟิลด์ที่เอกสารไม่ได้บอก
  entry_payload    text,                        -- ข้อความบนปุ่มโฆษณา (postback payload) ไม่ใช่สิ่งที่ลูกค้าพิมพ์

  -- ผลลัพธ์ คัดลอกจาก ins_events ตอนบันทึก เพื่อให้ funnel เป็น count ตรงๆ ไม่ต้อง join
  priced_at        timestamptz,
  form_sent_at     timestamptz,
  form_done_at     timestamptz,
  agent_replied_at timestamptz,
  stalled_at       timestamptz,
  handover_at      timestamptz,
  messages         integer not null default 0,  -- ข้อความจากลูกค้า
  model_calls      integer not null default 0
);
create index if not exists ins_conversations_started_idx on ins_conversations (started_at);
create index if not exists ins_conversations_ad_idx on ins_conversations (ad_id) where ad_id is not null;
create index if not exists ins_conversations_user_idx on ins_conversations (channel, user_hash) where user_hash is not null;
alter table ins_conversations enable row level security;

-- เซสชันเดิมชี้ไปที่บทสนทนาที่กำลังคุย
alter table ins_chat_sessions
  add column if not exists conversation_id uuid references ins_conversations(id) on delete set null;
```

### `ins_events` เหตุการณ์ในบทสนทนา

```sql
create table if not exists ins_events (
  id               bigserial primary key,
  conversation_id  uuid not null references ins_conversations(id) on delete cascade,
  at               timestamptz not null default now(),
  kind             text not null,
  product          text,
  data             jsonb not null default '{}'   -- ชนิดกับตัวเลขเท่านั้น ห้ามมีข้อความของลูกค้า
);
create index if not exists ins_events_conv_idx on ins_events (conversation_id, at);
create index if not exists ins_events_kind_idx on ins_events (kind, at);
alter table ins_events enable row level security;
```

ชนิดของเหตุการณ์ และจุดในโค้ดที่ปล่อยออกมา

| `kind` | เกิดเมื่อ | `data` | ปล่อยจาก |
| --- | --- | --- | --- |
| `started` | บทสนทนาใหม่ | `source`, `ad_id`, `ref` | `session.ts` |
| `referral` | กดโฆษณาหรือลิงก์เข้ามาระหว่างคุยอยู่ | ก้อน referral ดิบ | `conversation.ts` |
| `message` | ทุกข้อความของลูกค้า นับอย่างเดียว | `chars`, `button` (กดปุ่มหรือพิมพ์) | `conversation.ts` |
| `routed` | โมเดลเล็กอ่านข้อความ | `intent`, `model`, `has_age`, `has_sex`, `has_cover` | `answer.ts` |
| `quoted` | ส่งใบเสนอราคา | `planCode`, `variant`, `age`, `sex`, `sumAssured`, `coverWanted`, `monthly`, `semi`, `annual`, `people` | `answer.ts` |
| `no_price` | คิดเบี้ยไม่ได้ | `reason`: `out_of_range` / `below_min` / `expired` / `not_quotable` | `answer.ts` |
| `value_table` | ส่งตารางมูลค่า | `variant`, `sumAssured` | `answer.ts` |
| `cheaper` | ลูกค้าบอกแพง | `offered` (ทุนที่เสนอลด) | `answer.ts` |
| `offer_taken` | รับข้อเสนอลดทุน | `sumAssured` | `answer.ts` |
| `pay_term` | ถามระยะเวลาจ่าย | `variant` | `answer.ts` |
| `company` | ถามบริษัทหรือความน่าเชื่อถือ | `trust` | `answer.ts` |
| `faq` | ตอบจากชุดคำถามที่เขียนไว้ | `key` | `answer.ts` |
| `plan_info` / `small_talk` | โมเดลเรียบเรียงคำตอบ | `model` | `answer.ts` |
| `handover` | บอทส่งไม้ให้ตัวแทน | `reason`: `trust` / `health` / `other_plan` / `no_price` | `answer.ts` |
| `form_sent` | ส่งฟอร์มใบคำขอ | `form_ref`, `had_quote` | `answer.ts` |
| `form_done` | ลูกค้าบอกว่ากรอกแล้ว | | `answer.ts` |
| `stalled` | ขอคิดดูก่อน | `had_quote` | `answer.ts` |
| `agent_replied` | echo ของคนพิมพ์จากกล่องข้อความเพจ | | `conversation.ts` |
| `rate_limited` / `budget_exceeded` / `error` | บอทตอบไม่ได้ | `message` ของระบบ ไม่ใช่ของลูกค้า | `conversation.ts` |

`answer.ts` ปล่อยเหตุการณ์ผ่านช่องใหม่ `Answer.trace: TraceEvent[]` ซึ่งเป็นแค่ลิสต์ที่แต่ละเส้นทาง push
ชนิดของตัวเองลงไป `conversation.ts` รวมกับเหตุการณ์ของตัวเองแล้วบันทึกทีเดียวหลังส่งคำตอบครบ

การบันทึกใช้ RPC ตัวเดียว `ins_record(p_conversation uuid, p_events jsonb)` ที่ insert ทุกเหตุการณ์และอัปเดต
คอลัมน์ผลลัพธ์บน `ins_conversations` ในทรานแซกชันเดียว เว็บฮุกจึงยิงฐานข้อมูลรอบเดียวต่อเทิร์น

### `ins_leads` ลีดที่ตัวแทนต้องตามต่อ

```sql
create table if not exists ins_leads (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid unique references ins_conversations(id) on delete set null,
  channel          text not null default 'facebook',
  page_id          text,
  user_hash        text,
  psid_cipher      bytea,                        -- เข้ารหัสด้วย pgcrypto ผ่าน RPC เท่านั้น (ข้อตัดสินใจที่ 1)
  stage            text not null default 'interested',
                   -- interested → form_sent → form_done → contacted → applied → issued | lost
  product          text,
  last_quote       jsonb,                        -- data ของเหตุการณ์ quoted ล่าสุด
  ad_id            text,
  ref              text,
  form_ref         text unique,                  -- รหัสสั้นที่ต่อท้ายลิงก์ฟอร์ม ใช้จับคู่กับใบคำขอ
  note             text,                         -- บันทึกของตัวแทน แก้จากหลังบ้าน
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  closed_at        timestamptz
);
create index if not exists ins_leads_stage_idx on ins_leads (stage, updated_at);
alter table ins_leads enable row level security;
```

ลีดถูกเปิดโดยบอทเมื่อเกิดอย่างใดอย่างหนึ่ง และเปิดครั้งเดียวต่อบทสนทนา

- `form_sent` ลูกค้าตัดสินใจสมัคร นี่คือลีดร้อน
- `form_done` ลูกค้าบอกว่ากรอกแล้ว โดยที่บทสนทนาก่อนหน้าไม่มีลีด
- `handover` ด้วยเหตุ `trust` หรือ `health` ลูกค้าต้องการคน ไม่ใช่บอท

ขั้น (`stage`) หลัง `form_done` เป็นของตัวแทน แก้จากหน้าหลังบ้านที่จะทำภายหลัง ไม่ใช่ของบอท

**PSID เข้ารหัส** บันทึกเฉพาะตอนเปิดลีด และเฉพาะบนตารางนี้ ใช้เพื่อสองอย่างที่แฮชทำไม่ได้ คือเปิดห้องแชท
ในกล่องข้อความของเพจจากหน้าหลังบ้าน (`GET /{page_id}/conversations?user_id={psid}&fields=link`) และ
แสดงชื่อลูกค้าตอนเปิดหน้า (`GET /{psid}?fields=first_name,last_name`) ชื่อดึงตอนแสดง ไม่บันทึก
วิธีเข้ารหัสใช้แบบเดียวกับโทเคนเพจใน `ins_channel_auth` คือ RPC รับ passphrase

```sql
create or replace function ins_set_lead_psid(p_lead uuid, p_psid text, p_passphrase text)
returns void language sql security definer as $$
  update ins_leads set psid_cipher = pgp_sym_encrypt(p_psid, p_passphrase), updated_at = now()
  where id = p_lead;
$$;

create or replace function ins_get_lead_psid(p_lead uuid, p_passphrase text)
returns text language sql security definer as $$
  select pgp_sym_decrypt(psid_cipher, p_passphrase) from ins_leads where id = p_lead;
$$;
```

`form_ref` เป็นรหัสสั้นที่ต่อท้ายลิงก์ฟอร์ม `APPLICATION_FORM` เป็น `&lead=<form_ref>` ถ้าฟอร์มที่
`ktaxaform.vercel.app` รับพารามิเตอร์นี้แล้วบันทึกไว้กับใบคำขอ ตัวแทนจับคู่ใบคำขอกับบทสนทนาและโฆษณาได้
ฟอร์มเป็นระบบแยก การรับพารามิเตอร์เป็นงานฝั่งนั้น รอบนี้แค่ส่งไปให้

### `ins_ad_daily` ผลโฆษณารายวันต่อชิ้น

```sql
create table if not exists ins_ad_daily (
  date               date not null,
  ad_id              text not null,
  ad_name            text,
  adset_id           text,
  adset_name         text,
  campaign_id        text,
  campaign_name      text,
  spend              numeric(12,2) not null default 0,
  impressions        integer not null default 0,
  reach              integer not null default 0,
  clicks             integer not null default 0,
  link_clicks        integer not null default 0,
  messaging_started  integer not null default 0,   -- onsite_conversion.messaging_conversation_started_7d
  actions            jsonb,                        -- ก้อน actions ดิบจาก insights
  currency           text not null default 'THB',
  fetched_at         timestamptz not null default now(),
  primary key (date, ad_id)
);
alter table ins_ad_daily enable row level security;
```

ตารางนี้ **แอปไม่เขียน** โทเคนเพจที่แอปถือมีแค่สิทธิ์ `pages_*` ไม่มี `ads_read` ผู้เขียนคือ Routine
รายสัปดาห์ที่ดึง insights ผ่าน connector Facebook Ads แล้ว upsert ผ่าน connector Supabase ย้อนหลังเจ็ดวัน
ทุกครั้งเพื่อรับตัวเลขที่ Meta ปรับย้อนหลัง ไม่ต้องเพิ่มสิทธิ์ให้แอป ไม่ต้องเขียนโค้ด

ฐานข้อมูลนี้มีตาราง `ad_accounts` `ad_campaigns` `ad_variants` ของผลิตภัณฑ์อื่นอยู่แล้ว คนละเรื่องกัน
ห้ามใช้ร่วม คำนำหน้า `ins_` คือเส้นแบ่ง

### `ins_unanswered` คำถามที่ยังไม่มีคำตอบเขียนไว้

```sql
create table if not exists ins_unanswered (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  product   text,
  intent    text not null,          -- plan_info | other | out_of_scope
  route     text not null,          -- model = โมเดลตอบเอง | handover = ส่งไม้ให้ตัวแทน
  question  text not null           -- Routed.question ที่โมเดลเขียนใหม่ให้ยืนได้เอง ไม่ใช่ข้อความดิบ
);
alter table ins_unanswered enable row level security;
```

ไม่มี `conversation_id` ไม่มีแฮช โยงกลับหาใครไม่ได้ เก็บเฉพาะเทิร์นที่ไปถึงโมเดลหรือถูกส่งไม้ ซึ่งคือ
เทิร์นที่ชุดคำถามใน `faq.ts` ยังไม่ครอบคลุม อายุ 30 วัน พอให้ Routine รายวันสรุปเป็นข้อเสนอ FAQ ใหม่
แล้วปล่อยให้หมดอายุ ตารางนี้เก็บถ้อยคำ จึงเป็นข้อตัดสินใจที่ 2

## มุมมอง

คำนวณตอนอ่าน ไม่มีสถานะของตัวเอง เวลาตัดวันเป็นเวลาไทย

```sql
create or replace view v_ins_funnel_daily as
select (started_at at time zone 'Asia/Bangkok')::date as day,
       coalesce(product, 'undecided')             as product,
       count(*)                                    as conversations,
       count(*) filter (where source = 'ads')      as from_ads,
       count(priced_at)                            as priced,
       count(form_sent_at)                         as form_sent,
       count(form_done_at)                         as form_done,
       count(agent_replied_at)                     as agent_replied,
       count(stalled_at)                           as stalled,
       count(handover_at)                          as handed_over
from ins_conversations
group by 1, 2;

create or replace view v_ins_ad_attribution as
with c as (
  select (started_at at time zone 'Asia/Bangkok')::date as day, ad_id,
         count(*) as conversations, count(priced_at) as priced, count(form_sent_at) as form_sent
  from ins_conversations where ad_id is not null group by 1, 2
), l as (
  select (created_at at time zone 'Asia/Bangkok')::date as day, ad_id, count(*) as leads
  from ins_leads where ad_id is not null group by 1, 2
)
select a.date, a.ad_id, a.ad_name, a.campaign_name,
       a.spend, a.impressions, a.link_clicks, a.messaging_started,
       coalesce(c.conversations, 0) as conversations,
       coalesce(c.priced, 0)        as priced,
       coalesce(c.form_sent, 0)     as form_sent,
       coalesce(l.leads, 0)         as leads,
       case when coalesce(c.priced, 0) > 0 then round(a.spend / c.priced, 2) end as cost_per_priced,
       case when coalesce(l.leads, 0)  > 0 then round(a.spend / l.leads, 2)  end as cost_per_lead
from ins_ad_daily a
left join c on c.day = a.date and c.ad_id = a.ad_id
left join l on l.day = a.date and l.ad_id = a.ad_id;

create or replace view v_ins_quotes as
select e.at, e.conversation_id, c.source, c.ad_id,
       e.data->>'planCode'                as plan_code,
       e.data->>'variant'                 as variant,
       (e.data->>'age')::int              as age,
       e.data->>'sex'                     as sex,
       (e.data->>'sumAssured')::bigint    as sum_assured,
       (e.data->>'coverWanted')::bigint   as cover_wanted,
       (e.data->>'monthly')::numeric      as monthly,
       (e.data->>'annual')::numeric       as annual
from ins_events e
join ins_conversations c on c.id = e.conversation_id
where e.kind = 'quoted';

create or replace view v_ins_model_cost_daily as
select (created_at at time zone 'Asia/Bangkok')::date as day, task,
       count(*) as calls, sum(cost_thb) as cost_thb
from ins_usage_ledger
group by 1, 2;
```

ใครอ่านอะไร

| ผู้อ่าน | อ่านจาก | ได้อะไร |
| --- | --- | --- |
| Routine สรุปโฆษณารายสัปดาห์ | `v_ins_ad_attribution` | บาทต่อใบเสนอราคา บาทต่อลีด แยกต่อโฆษณา |
| Routine สรุปคำถามรายวัน | `v_ins_funnel_daily`, `ins_unanswered` | กี่คนทัก กี่คนได้ราคา กี่คนหลุด และถามอะไรที่บอทตอบเองไม่ได้ |
| Routine เตือนงบ | `v_ins_model_cost_daily` | ค่าโมเดลเดือนนี้เทียบเพดาน |
| หน้า `/admin/leads` (ภายหลัง) | `ins_leads` | ลีดค้าง ราคาล่าสุด ปุ่มเปิดห้องแชท |
| คุณ ผ่านเซสชันแบบนี้ | ทุกตาราง | ถามอะไรก็ได้ที่ข้อมูลตอบได้ |

## การเก็บและการลบ

ฐานข้อมูลนี้มี `pg_cron` เปิดอยู่แล้ว การลบจึงเป็นงานของฐานข้อมูลเอง ไม่พึ่งแอปหรือ Routine

| ตาราง | เก็บนานแค่ไหน | ลบอะไร |
| --- | --- | --- |
| `ins_chat_sessions` | 24 ชั่วโมงหลังข้อความล่าสุด | ทั้งแถว ยกเว้นแถวที่การปิดปากยังไม่หมดเวลา (ตอนนี้ไม่มีอะไรลบเลย) |
| `ins_chat_events` | 7 วัน | ทั้งแถว Meta ส่งซ้ำภายในไม่กี่ชั่วโมง เก็บนานกว่านั้นไม่มีประโยชน์ |
| `ins_conversations.user_hash` | 90 วัน หลังเหตุการณ์สุดท้าย | เฉพาะคอลัมน์ตัวตน แถวและสถิติอยู่ต่อ |
| `ins_events` | 13 เดือน | ทั้งแถว พอให้เทียบปีต่อปี |
| `ins_unanswered` | 30 วัน | ทั้งแถว |
| `ins_leads.psid_cipher` | 180 วัน หลังปิดลีด | เฉพาะคอลัมน์ตัวตน |
| `ins_ad_daily` | ไม่ลบ | ไม่มีข้อมูลบุคคล |

```sql
create or replace function ins_prune() returns void language sql security definer as $$
  delete from ins_chat_sessions
   where updated_at < now() - interval '24 hours'
     and (muted_until is null or muted_until < now());
  delete from ins_chat_events where created_at < now() - interval '7 days';
  update ins_conversations set user_hash = null
   where user_hash is not null and last_event_at < now() - interval '90 days';
  delete from ins_events where at < now() - interval '13 months';
  delete from ins_unanswered where at < now() - interval '30 days';
  update ins_leads set psid_cipher = null
   where psid_cipher is not null and closed_at is not null and closed_at < now() - interval '180 days';
$$;

select cron.schedule('ins_prune_hourly', '5 * * * *', $$select ins_prune()$$);
```

รันรายชั่วโมง เพราะสัญญาบนหน้า `/privacy` คือ "ไม่เกิน 24 ชั่วโมง" งานรายวันจะปล่อยให้ค้างได้ถึงสองวัน

## ที่มาจากโฆษณา

Meta แนบก้อน `referral` มาสามที่ แล้วแต่ว่าลูกค้าเคยมีห้องแชทกับเพจหรือยัง

| ที่ | เมื่อ | ต้องสมัครรับ |
| --- | --- | --- |
| `messaging[].message.referral` | ข้อความแรกจากโฆษณา ไม่เคยมีห้องแชท | `messages` (มีแล้ว) |
| `messaging[].postback.referral` | กด Get Started จากโฆษณาหรือลิงก์ m.me | `messaging_postbacks` (มีแล้ว) |
| `messaging[].referral` | เคยมีห้องแชทแล้วกดโฆษณาเข้ามาอีก มาเป็นเหตุการณ์แยก ไม่มีข้อความ | `messaging_referrals` (**ต้องเพิ่ม**) |

ก้อนที่โฆษณาส่งมีหน้าตาราวนี้ และเก็บทั้งก้อนลง `referral jsonb` เผื่อฟิลด์ที่ต่างจากนี้

```json
{ "ref": "<ที่เราตั้งเอง ถ้าตั้ง>", "source": "ADS", "type": "OPEN_THREAD",
  "ad_id": "1234567890", "ads_context_data": { "ad_title": "...", "post_id": "...", "photo_url": "..." } }
```

- `events.ts` เพิ่ม `referralOf(event)` อ่านจากสามที่ตามลำดับ คืน `{ source, adId, ref, raw }`
- `oauth.ts` เพิ่ม `messaging_referrals` ใน `SUBSCRIBED_FIELDS` เพจที่เชื่อมอยู่กดปุ่มสมัครรับใหม่ในหน้า
  แอดมินหนึ่งครั้ง เหมือนตอนเพิ่ม `message_echoes`
- `conversation.ts` อ่าน referral **ก่อน** เช็กว่ามีข้อความไหม เพราะเหตุการณ์ `messaging_referrals` ไม่มี
  ข้อความ แต่เป็นจุดเริ่มบทสนทนาใหม่ถ้าเซสชันเดิมหมดอายุแล้ว
- บทสนทนาหนึ่งเก็บที่มาครั้งแรก การกดโฆษณาอีกชิ้นระหว่างคุยลง `ins_events` เป็น `referral`

`ad_id` มาเองเสมอเมื่อมาจากโฆษณา ส่วน `ref` มีเฉพาะเมื่อตั้งไว้บนโฆษณา ชื่อโฆษณาและแคมเปญไม่อยู่ในเว็บฮุก
ได้จาก `ins_ad_daily` ตอน join

## ไฟล์ที่แก้

| ไฟล์ | หน้าที่ |
| --- | --- |
| `src/lib/facebook/events.ts` | `Messaging` รับ `referral` สามที่ · `referralOf()` |
| `src/lib/facebook/oauth.ts` | `SUBSCRIBED_FIELDS` เพิ่ม `messaging_referrals` |
| `src/lib/chat/session.ts` | `Session.conversationId` · เซสชันหมดอายุหรือไม่มี = เปิดบทสนทนาใหม่ พร้อมเหตุการณ์ `started` |
| `src/lib/chat/collect.ts` (ใหม่) | `openConversation()` `record()` `openLead()` ทุกตัวกลืน error แล้ว log ไม่โยนต่อ |
| `src/lib/assistant/answer.ts` | `Answer.trace` แต่ละเส้นทาง push ชนิดของตัวเอง · `handOverForm()` รับ `formRef` |
| `src/lib/facebook/conversation.ts` | อ่าน referral · เรียก `record()` หลังส่งครบ · เปิดลีดตาม trace |
| `src/app/privacy/page.tsx` | เขียนหัวข้อ "ข้อมูลที่เก็บ" ใหม่ตามหัวข้อถัดไป |
| `docs/facebook-connect.md` | ข้อ 3 เพิ่มฟิลด์ที่สี่ |
| `src/app/api/health/route.ts` | ตัวตรวจฐานข้อมูลอ่าน `ins_ai_settings` แทน `ins_alert_settings` ซึ่งเป็นตารางของระบบแจ้งเตือน LINE ที่ถอดไปแล้ว |

SQL ทั้งหมดในเอกสารนี้รันครั้งเดียวใน SQL editor ของ Supabase ตามธรรมเนียมของโปรเจกต์ ไม่มีโฟลเดอร์
migration

ไม่แตะ: `ins_knowledge_docs` `ins_doc_chunks` `ins_faq` และ RPC `ins_search_*` มีอยู่แล้วในฐานข้อมูล
(เอกสาร 3 ชิ้น 37 ชิ้นส่วน ปิดใช้งานอยู่) เป็นของเฟสฮับความรู้ · `ins_alert_settings` `ins_alert_log` และ
คอลัมน์ `is_agent` `alerted_at` บน `ins_chat_sessions` เป็นซากของระบบ LINE ลบได้ในรอบหลัง

## ความเป็นส่วนตัว

หน้า `/privacy` หัวข้อ "ข้อมูลที่เก็บ" ต้องพูดสี่อย่างที่ตอนนี้ไม่ได้พูด

- บันทึกว่าบทสนทนาเกิดขึ้นเมื่อไหร่ มาจากโฆษณาชิ้นไหน และดำเนินไปถึงขั้นไหน เป็น **ชนิดของเหตุการณ์กับตัวเลข**
  เช่น อายุ เพศ ทุน เบี้ยที่คำนวณให้ ไม่มีข้อความที่คุณพิมพ์
- ตัวตนบนบันทึกนั้นเป็นค่าเข้ารหัสทางเดียวชุดเดิม และถูกลบออกจากบันทึกภายใน 90 วัน สถิติที่เหลือโยงกลับหา
  ใครไม่ได้
- เมื่อคุณกดสนใจสมัครหรือขอคุยกับตัวแทน เราบันทึกรหัสห้องแชทของคุณแบบเข้ารหัส เพื่อให้ตัวแทนเปิดห้องแชทนี้
  กลับมาติดต่อได้ตามที่บอทแจ้งไว้ และลบเมื่อเรื่องจบไปแล้ว 180 วัน
- คำถามที่บอทไม่มีคำตอบเตรียมไว้ ถูกเก็บเป็นประโยคที่เขียนใหม่โดยไม่มีตัวตน 30 วัน เพื่อปรับปรุงคำตอบ

และแก้ให้ตรงความจริง: ข้อความในบทสนทนาถูกลบด้วยงานรายชั่วโมง ไม่ใช่ "หมดอายุเอง"

การถามข้อมูลลูกค้าไม่เปลี่ยน บอทยังไม่ถามชื่อ เบอร์โทร เลขบัตร ประวัติสุขภาพ ตามเดิม

## ปริมาณและค่าใช้จ่าย

ตัวเลขจริง 30 วันล่าสุดจาก `ins_usage_ledger` เป็นฐานคิด

| งาน | ครั้ง | บาท |
| --- | --- | --- |
| route (อ่านข้อความ) | 392 | 5.30 |
| plan_info | 61 | 1.89 |
| small_talk | 58 | 0.29 |

ราว 400 เทิร์นต่อเดือน ให้เหตุการณ์ราว 2,000 ถึง 3,000 แถวต่อเดือน `ins_ad_daily` เพิ่มวันละไม่กี่แถว
ทั้งหมดอยู่ในหลักเมกะไบต์ต่อปี ต่ำกว่าเพดานของแพ็กเกจฟรีหลายเท่า

ค่าโมเดลไม่เพิ่ม การบันทึกเป็นการเขียนฐานข้อมูลหนึ่งรอบต่อเทิร์น ไม่มีการเรียกโมเดลเพิ่ม

## สิ่งที่ผู้ใช้ต้องตัดสินใจ

ค่าที่แนะนำอยู่หน้าสุด ทุกข้อเปลี่ยนภายหลังได้โดยไม่กระทบโครง

1. **เก็บ PSID เข้ารหัสของลีดไหม** แนะนำ **เก็บ** เฉพาะลีดที่กดสนใจสมัครหรือขอคุยกับคน เพราะนั่นคือ
   จังหวะที่ลูกค้าขอให้ติดต่อกลับ และเป็นทางเดียวที่หน้าหลังบ้านจะเปิดห้องแชทให้ได้ ทางเลือกคือไม่เก็บ
   แล้วให้ตัวแทนหาห้องแชทจากเวลาที่ลีดเกิด ซึ่งทำได้แต่ช้าและพลาดง่าย
2. **เก็บคำถามที่โมเดลต้องตอบเอง 30 วันไหม** แนะนำ **เก็บ** เพราะเป็นทางเดียวที่จะรู้ว่าควรเขียนคำตอบอะไร
   เพิ่ม เก็บเป็นประโยคที่โมเดลเขียนใหม่ ไม่ใช่ข้อความดิบ และไม่โยงกับใคร ทางเลือกคือปิดตารางนี้
   แล้วดูแค่จำนวนเทิร์นที่ถึงโมเดลจาก `ins_events`
3. **ตัวตนบนบทสนทนาอยู่ 90 วันพอไหม** 90 วันพอให้เห็นลูกค้าที่กลับมาทักภายในไตรมาส สั้นกว่านั้นได้
   ยาวกว่านั้นควรมีเหตุผลเขียนไว้บนหน้านโยบาย
4. **ต่อ `form_ref` เข้าฟอร์มใบคำขอไหม** ฝั่งบอทส่งพารามิเตอร์ไปได้เลย ฝั่งฟอร์มเป็นอีกโปรเจกต์ ถ้าไม่ต่อ
   ลีดยังใช้ได้ แค่จับคู่กับใบคำขอด้วยมือ

## ขอบเขตที่ไม่ทำในรอบนี้

หน้า `/admin/leads` (ออกแบบแยกเมื่อตารางมีข้อมูลแล้ว) · Routine ทั้งสองตัวที่อ่านมุมมอง (ตั้งได้ทันทีที่
ตารางมี ไม่ต้องเขียนโค้ด) · การรับ `lead` ฝั่งฟอร์มใบคำขอ · ตอบคอมเมนต์ใต้โพสต์ · หลายเพจ (มี `page_id`
รอไว้แล้ว) · LINE · ลบซากระบบ LINE · สิทธิ์ `ads_read` ในแอป

## การทดสอบ

เทสต์อัตโนมัติ (vitest) ฐานข้อมูลถูกแทนด้วย mock แบบเดียวกับ `messenger-webhook.test.ts`

- `referralOf()` อ่านก้อนจากสามที่ คืนค่าว่างเมื่อไม่มี และเก็บก้อนดิบไว้ครบ
- `loadSession()` เซสชันหมดอายุหรือไม่มี → เปิดบทสนทนาใหม่พร้อม `started` · เซสชันสดใช้ `conversation_id`
  เดิม
- `handle()` เหตุการณ์ `messaging_referrals` ที่ไม่มีข้อความ → เปิดบทสนทนาและบันทึกที่มา แต่ไม่ตอบอะไร
- `handle()` บันทึกหลังส่งครบ และเมื่อ `record()` โยน error ลูกค้ายังได้คำตอบครบ ไม่มีข้อความแจ้งขัดข้อง
- `answer.ts` แต่ละเส้นทางให้ `trace` ที่ถูกต้อง: ใบเสนอราคาให้ `quoted` พร้อมตัวเลขตรงกับ
  `lifeProtectModes()` · อายุนอกช่วงให้ `no_price` ไม่มี `quoted` · ส่งฟอร์มให้ `form_sent` พร้อม `form_ref`
- ลิงก์ฟอร์มมี `&lead=<form_ref>` และ `form_ref` เดียวกันอยู่ในลีดที่เปิด
- ไม่มีข้อความของลูกค้าใน `data` ของเหตุการณ์ใดๆ ตรวจด้วยเทสต์ที่ส่งข้อความมีคำเฉพาะเข้าไปแล้วค้นใน
  ทุกเหตุการณ์ที่บันทึก
- `ins_prune()` รันบนข้อมูลทดสอบใน SQL editor: แถวเซสชันอายุ 25 ชั่วโมงหาย แถวที่ปิดปากอยู่ไม่หาย
  บทสนทนาอายุ 91 วันเหลือแฮชว่างแต่สถิติอยู่

ทดสอบด้วยมือก่อนถือว่าเสร็จ

- กดโฆษณาจริงจากบัญชีที่ไม่มีบทบาทในแอป ทักหนึ่งประโยค แล้วดูว่า `ins_conversations` มี `ad_id` ที่ตรงกับ
  Ads Manager
- คุยจนได้ใบเสนอราคา กด "สนใจสมัคร" แล้ว `ins_leads` มีหนึ่งแถว `stage = 'form_sent'` และ `last_quote`
  ตรงกับการ์ดที่ได้
- `select * from v_ins_ad_attribution` หลัง Routine เขียน `ins_ad_daily` ครั้งแรก แถวของโฆษณาชิ้นนั้นมี
  `conversations ≥ 1`
