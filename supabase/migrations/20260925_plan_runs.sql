-- /plan: every plan a customer builds, kept anonymously so the owner can see use.
--
-- No name, no phone, no IP — only the figures typed and the plan shown. Rows older than
-- thirty days are deleted by the page itself on each insert (src/app/plan/actions.ts), the
-- privacy page's promise for everything else. Server-only, like every ins_* table.

create table if not exists public.ins_plan_runs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  input jsonb not null,
  result jsonb not null
);

alter table public.ins_plan_runs enable row level security;
revoke all on public.ins_plan_runs from anon, authenticated;

create index if not exists ins_plan_runs_created_idx on public.ins_plan_runs (created_at desc);

comment on table public.ins_plan_runs is
  'Plans built on /plan: input = what the customer typed, result = PlanResult shown. Anonymous; kept 30 days.';
