-- How each ad account's last fetch went.
--
-- The ADS page said "ดึงล่าสุด" once for all accounts, from the newest fetched_at in
-- ins_ad_daily. That hid two things. One account failing every night was covered by another
-- succeeding, because the newest row was always somebody's. And an account that spent
-- nothing wrote no rows, so a fetch that worked perfectly looked like one that never ran.
-- The fetch itself is what has to be recorded, per account, whether it wrote rows or not.
--
-- Ad accounts are rows of ins_channel_auth (key 'facebook_ads:act_…', next to the Page rows),
-- so the columns go there. They mean nothing on a Page row and stay null on one. The table
-- was created by hand before migrations were kept and has no create statement in this folder;
-- it already has row level security on with no policy, and its RPCs are locked to
-- service_role (20260916_lock_ins_rpcs_to_service_role.sql). New columns inherit both, so
-- nothing is granted here.
--
-- Written by src/lib/ads/sync.ts after every attempt, the button and the daily cron alike.
-- The code reads and writes these columns best-effort, so a deploy that lands before this
-- file is applied keeps working and simply shows the old single "ดึงล่าสุด" line.

alter table public.ins_channel_auth
  add column if not exists last_sync_at timestamptz,
  add column if not exists last_sync_ok_at timestamptz,
  add column if not exists last_sync_error text;

comment on column public.ins_channel_auth.last_sync_at is
  'บัญชีโฆษณา: ดึงตัวเลขครั้งล่าสุดเมื่อไร (สำเร็จหรือไม่ก็ตาม) — แถวของเพจเว้นว่าง';
comment on column public.ins_channel_auth.last_sync_ok_at is
  'บัญชีโฆษณา: ดึงสำเร็จครั้งล่าสุดเมื่อไร ใช้ตัดสินว่าข้อมูลค้าง';
comment on column public.ins_channel_auth.last_sync_error is
  'บัญชีโฆษณา: สาเหตุที่ดึงครั้งล่าสุดไม่สำเร็จ ว่างถ้าสำเร็จ';
