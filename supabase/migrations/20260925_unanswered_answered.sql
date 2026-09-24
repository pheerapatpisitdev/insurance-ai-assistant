-- A question the assistant could not answer can now be marked answered.
--
-- ins_unanswered had no way to say a question had been dealt with, so the front page's
-- "มีคำถามที่ผู้ช่วยตอบเองไม่ได้ N ข้อ" could only grow until the thirty-day sweep in
-- src/lib/assistant/unanswered.ts caught up with it. The owner answers a question by writing a
-- note on /admin/knowledge and pressing "ตอบแล้ว" on /admin/crm; that press stamps this column,
-- and both pages count only the rows where it is empty.
--
-- Nothing is deleted by answering. The row still goes at thirty days like every other, which is
-- the promise on the privacy page.
--
-- The table was created by hand on the project before migrations were kept, so its definition
-- is not in this folder. As it stands on 2026-09-25: id bigint, at timestamptz, product text,
-- intent text not null, route text not null, question text not null; row level security on, no
-- policies — service_role only in practice. The grants still carry Supabase's defaults for anon
-- and authenticated, which the absent policies make harmless; they are taken away here as well,
-- the way every other ins_* table has them (see 20260916_lock_ins_rpcs_to_service_role.sql),
-- so the table does not depend on nobody ever adding a permissive policy.

alter table public.ins_unanswered add column if not exists answered_at timestamptz;

comment on column public.ins_unanswered.answered_at is
  'When the owner marked this question answered on /admin/crm. Empty = still waiting; the CRM tab and the /admin alert count only these.';

-- the only question ever asked of the table: the open ones, newest first
create index if not exists ins_unanswered_open_idx
  on public.ins_unanswered (at desc)
  where answered_at is null;

revoke all on public.ins_unanswered from anon, authenticated;
grant all on public.ins_unanswered to service_role;
grant usage, select on sequence public.ins_unanswered_id_seq to service_role;
