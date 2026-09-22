-- Advertising figures, one row per advertisement per day.
--
-- Written by the ads sync (src/lib/ads/sync.ts) from the Marketing API's insights, at ad
-- level, and read by /admin/ads and by from-ad.ts, which uses the advertisement's name to
-- guess which plan a customer arriving from it came for. No personal data: these are the
-- advertiser's own counts.
--
-- The table was created by hand on the project before this file existed; this records it,
-- column for column as the live table stands on 2026-09-22, and does nothing where it is
-- already there.
--
-- Locked to service_role like every other ins_* table: see
-- 20260916_lock_ins_rpcs_to_service_role.sql.

create table if not exists public.ins_ad_daily (
  date date not null,
  ad_id text not null,
  ad_name text,
  adset_id text,
  adset_name text,
  campaign_id text,
  campaign_name text,
  spend numeric not null default 0,
  impressions integer not null default 0,
  reach integer not null default 0,
  clicks integer not null default 0,
  link_clicks integer not null default 0,
  messaging_started integer not null default 0,
  actions jsonb,
  currency text not null default 'THB',
  fetched_at timestamptz not null default now(),
  primary key (date, ad_id)
);

comment on table public.ins_ad_daily is
  'ตัวเลขโฆษณา Facebook รายวันต่อชิ้น ดึงจาก Marketing API วันละครั้ง';

alter table public.ins_ad_daily enable row level security;

revoke all on public.ins_ad_daily from anon, authenticated;
grant all on public.ins_ad_daily to service_role;
