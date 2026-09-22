-- The month's AI spend, summed where the rows are.
--
-- Two readers of ins_usage_ledger selected the month's rows and added them up in JavaScript.
-- The client library returns at most 1,000 rows of any select and does not say when it has
-- stopped. On 2026-09-22 the spend card on /admin/ai showed exactly 1,000 calls at ฿29.68;
-- this table held 1,180 at ฿34.54. The budget guard in src/lib/ai/client.ts read the same
-- way, so past a thousand calls a month — three weeks, at this month's pace — the owner's
-- ceiling was being compared to a figure that no longer moved.
--
-- One line per model and task is what every reader needs: the guard wants the total, the
-- card wants which company was paid and for what. Both now call this.
--
-- SECURITY INVOKER: it reads one table this application owns, and the only caller is the
-- server's service-role client, which can read that table anyway. No reason to run as the
-- owner. EXECUTE goes the way of every other ins_* function (see 20260916_lock_ins_rpcs…):
-- service_role only, nothing for anon or authenticated, and postgres keeps it as owner.

create or replace function public.ins_month_spend(p_since timestamptz)
returns table (model text, task text, calls bigint, cost_thb numeric)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select l.model, l.task, count(*) as calls, coalesce(sum(l.cost_thb), 0) as cost_thb
  from public.ins_usage_ledger l
  where l.created_at >= p_since
  group by l.model, l.task
$$;

revoke execute on function public.ins_month_spend(timestamptz) from public, anon, authenticated;
grant execute on function public.ins_month_spend(timestamptz) to service_role;

-- The reads are all "since the first of the month"; without this each one is a scan of the
-- whole ledger, which at a thousand-odd rows a month is fine today and not in a year.
create index if not exists ins_usage_ledger_created_at_idx on public.ins_usage_ledger (created_at);
