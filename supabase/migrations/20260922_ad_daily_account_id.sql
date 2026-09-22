-- Which ad account a row came from.
--
-- The agency runs three (PHET, MANIT, LuckyPlanner) and names campaigns the same way in
-- more than one of them: the ADS page drew two rows called "มรดก" and two called
-- "Life Protect x 2", with nothing on screen to say which account each belonged to. A
-- spend report whose rows cannot be told apart is a spend report nobody can act on.
--
-- Nullable, because the rows written before this column existed have no account to name.
alter table public.ins_ad_daily add column if not exists account_id text;

comment on column public.ins_ad_daily.account_id is
  'บัญชีโฆษณาที่แถวนี้มาจาก (act_...) ใช้แยกแคมเปญชื่อซ้ำข้ามบัญชี';
