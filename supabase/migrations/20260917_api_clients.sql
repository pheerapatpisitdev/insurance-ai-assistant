-- Keys for the public API, and the counter that keeps one from costing more than it should.
--
-- Not `ins_api_keys`: that name was already taken by the encrypted provider keys this system
-- calls out with — OpenAI, Anthropic, the rest — and these are the opposite, the keys other
-- systems call in with. The first attempt at this table used the old name, `create table if
-- not exists` quietly did nothing, and the function went looking for columns that were not
-- there. Clients, then.
--
-- The key itself is never stored. What is kept is its SHA-256 and the first few characters,
-- which is enough to show a row in a list and never enough to make a request — a table of
-- working keys is a table worth stealing, and this one is not.
--
-- The counter lives on the row rather than in a ledger because the question it answers is
-- asked on every single call: has this key used up the month. `period` carries the month the
-- count belongs to, so the roll-over costs nothing and happens on first use rather than on a
-- schedule that has to be trusted to run.

drop function if exists public.ins_api_key_use(text);

create table if not exists public.ins_api_clients (
  id uuid primary key default gen_random_uuid(),
  -- what the owner calls it: "LINE OA", "คุณเอ", "พาร์ทเนอร์ X"
  name text not null,
  -- the first characters, shown so a row can be told from another at a glance
  prefix text not null,
  key_hash text not null unique,
  -- calls a month; null is unlimited, which is for the owner's own systems and nobody else
  quota_month integer,
  used_month integer not null default 0,
  -- 'YYYY-MM' that used_month belongs to
  period text not null default to_char(now() at time zone 'utc', 'YYYY-MM'),
  last_used_at timestamptz,
  disabled boolean not null default false,
  created_at timestamptz not null default now()
);

comment on table public.ins_api_clients is
  'กุญแจของระบบภายนอกที่เรียก API ของเรา เก็บเฉพาะค่าแฮช ไม่เก็บกุญแจจริง';

alter table public.ins_api_clients enable row level security;
revoke all on public.ins_api_clients from public, anon, authenticated;
grant all on public.ins_api_clients to service_role;

-- One call's worth of bookkeeping, done in one statement.
--
-- Checking the quota and then incrementing it from the application would let two requests
-- read the same count and both be allowed through. This reads, rolls the month, checks and
-- increments under one lock, and answers with why it refused rather than with nothing — the
-- caller has to tell a wrong key from an exhausted one to say which.
create or replace function public.ins_api_client_use(p_hash text)
returns table (ok boolean, reason text, client_name text, remaining integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  k public.ins_api_clients%rowtype;
  this_period text := to_char(now() at time zone 'utc', 'YYYY-MM');
begin
  select * into k from public.ins_api_clients where key_hash = p_hash for update;

  if not found then
    return query select false, 'unknown_key', null::text, null::integer;
    return;
  end if;

  if k.disabled then
    return query select false, 'disabled', k.name, 0;
    return;
  end if;

  -- a new month starts the count again, on the first call of it
  if k.period <> this_period then
    k.used_month := 0;
    k.period := this_period;
  end if;

  if k.quota_month is not null and k.used_month >= k.quota_month then
    return query select false, 'quota_exhausted', k.name, 0;
    return;
  end if;

  update public.ins_api_clients
     set used_month = k.used_month + 1,
         period = this_period,
         last_used_at = now()
   where id = k.id;

  return query select
    true,
    null::text,
    k.name,
    case when k.quota_month is null then null::integer else k.quota_month - k.used_month - 1 end;
end;
$$;

revoke all on function public.ins_api_client_use(text) from public, anon, authenticated;
grant execute on function public.ins_api_client_use(text) to service_role;
