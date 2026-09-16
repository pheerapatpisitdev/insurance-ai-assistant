-- Which plan an advertisement is selling, said outright.
--
-- The bot already works this out on its own: the m.me link's ref, the button's payload, and
-- failing those the advertisement's own name out of ins_ad_daily. That covers an agency which
-- names its advertisements after the plan they sell, and leaves out the one named "โปรโมชั่น
-- เดือนนี้" — which is a perfectly ordinary thing to call an advertisement, and about which the
-- bot can only go on asking "สนใจแบบไหนครับ" to a customer whose click was paid for.
--
-- So this table is the place to say it by hand, for the advertisements that do not say it
-- themselves. One row per advertisement; the id is Meta's, which is what arrives in the
-- referral, so nothing has to be matched by name at the moment it matters.
--
-- Locked to service_role like every other ins_* table: the whole application talks to this
-- database through one client, on the server, with the service-role key. See
-- 20260916_lock_ins_rpcs_to_service_role.sql for what an anon grant here would be worth to
-- somebody holding the published key.

create table if not exists public.ins_ad_products (
  ad_id text primary key,
  -- the dispatcher's own vocabulary, so a row can only name a brain that exists
  product text not null check (product in ('lifeprotect', 'ihealthy')),
  -- what the advertisement is called, kept only so the list is readable months later
  label text,
  updated_at timestamptz not null default now()
);

comment on table public.ins_ad_products is
  'จับคู่ ad_id ของ Facebook กับแบบประกัน สำหรับโฆษณาที่ชื่อไม่ได้บอกว่าเป็นแบบไหน';

alter table public.ins_ad_products enable row level security;

revoke all on public.ins_ad_products from public, anon, authenticated;
grant all on public.ins_ad_products to service_role;
