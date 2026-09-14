-- Data collection for the Messenger bot, exactly as applied to Supabase on 2026-09-14 as four
-- migrations: ins_data_collection_tables, ins_data_collection_views_and_prune,
-- ins_data_collection_functions, ins_prune_hourly_cron.
-- Spec: docs/superpowers/specs/2026-09-14-data-collection-design.md
--
-- Every statement is idempotent (if not exists / or replace), so the file can be run again
-- against a fresh project. Conventions follow ins_set_channel_auth: functions are security
-- definer with search_path pinned and pgcrypto called by schema; and, unlike the defaults,
-- the write functions are executable by the server's service role alone.

-- ============================================================================ 1. tables

create table if not exists ins_conversations (
  id               uuid primary key default gen_random_uuid(),
  channel          text not null default 'facebook',
  page_id          text,
  user_hash        text,
  started_at       timestamptz not null default now(),
  last_event_at    timestamptz not null default now(),
  product          text,
  source           text,
  ad_id            text,
  ref              text,
  referral         jsonb,
  entry_payload    text,
  priced_at        timestamptz,
  form_sent_at     timestamptz,
  form_done_at     timestamptz,
  agent_replied_at timestamptz,
  stalled_at       timestamptz,
  handover_at      timestamptz,
  messages         integer not null default 0,
  model_calls      integer not null default 0
);
comment on table ins_conversations is 'One row per bot conversation on the Page: where it came from and how far it went. user_hash is nulled after 90 days.';
create index if not exists ins_conversations_started_idx on ins_conversations (started_at);
create index if not exists ins_conversations_ad_idx on ins_conversations (ad_id) where ad_id is not null;
create index if not exists ins_conversations_user_idx on ins_conversations (channel, user_hash) where user_hash is not null;
alter table ins_conversations enable row level security;

create table if not exists ins_events (
  id               bigserial primary key,
  conversation_id  uuid not null references ins_conversations(id) on delete cascade,
  at               timestamptz not null default now(),
  kind             text not null,
  product          text,
  data             jsonb not null default '{}'::jsonb
);
comment on table ins_events is 'What happened in a conversation: kinds and figures only, never the customer''s words.';
create index if not exists ins_events_conv_idx on ins_events (conversation_id, at);
create index if not exists ins_events_kind_idx on ins_events (kind, at);
alter table ins_events enable row level security;

alter table ins_chat_sessions
  add column if not exists conversation_id uuid references ins_conversations(id) on delete set null;
comment on column ins_chat_sessions.conversation_id is 'The conversation this live session belongs to; a stale session starts a new one.';

create table if not exists ins_leads (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid unique references ins_conversations(id) on delete set null,
  channel          text not null default 'facebook',
  page_id          text,
  user_hash        text,
  psid_cipher      bytea,
  stage            text not null default 'interested',
  product          text,
  last_quote       jsonb,
  ad_id            text,
  ref              text,
  form_ref         text unique,
  note             text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  closed_at        timestamptz
);
comment on table ins_leads is 'A customer who asked to apply or to talk to a person. psid_cipher is pgp_sym_encrypt''d and nulled 180 days after the lead closes.';
create index if not exists ins_leads_stage_idx on ins_leads (stage, updated_at);
alter table ins_leads enable row level security;

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
  messaging_started  integer not null default 0,
  actions            jsonb,
  currency           text not null default 'THB',
  fetched_at         timestamptz not null default now(),
  primary key (date, ad_id)
);
comment on table ins_ad_daily is 'Daily ad insights per ad, written by a Routine from the Marketing API. No personal data.';
alter table ins_ad_daily enable row level security;

create table if not exists ins_unanswered (
  id        bigserial primary key,
  at        timestamptz not null default now(),
  product   text,
  intent    text not null,
  route     text not null,
  question  text not null
);
comment on table ins_unanswered is 'Questions the bot had no written answer for, as the model''s stand-alone rewrite. Unlinked to anyone; kept 30 days.';
alter table ins_unanswered enable row level security;

-- ============================================================================ 2. views + prune

-- Views are security_invoker so they respect the RLS of the tables beneath them (no policies:
-- service role only), and are not readable by the API roles anyway.

create or replace view v_ins_funnel_daily with (security_invoker = true) as
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

create or replace view v_ins_ad_attribution with (security_invoker = true) as
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

create or replace view v_ins_quotes with (security_invoker = true) as
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

create or replace view v_ins_model_cost_daily with (security_invoker = true) as
select (created_at at time zone 'Asia/Bangkok')::date as day, task,
       count(*) as calls, sum(cost_thb) as cost_thb
from ins_usage_ledger
group by 1, 2;

revoke all on v_ins_funnel_daily, v_ins_ad_attribution, v_ins_quotes, v_ins_model_cost_daily from anon, authenticated;

-- Retention, as promised on /privacy. Runs hourly from pg_cron (section 4).
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
revoke execute on function ins_prune() from public, anon, authenticated;

-- ============================================================================ 3. functions

-- The bot writes through these, one round trip per turn.

create or replace function public.ins_open_conversation(
  p_channel text, p_page_id text, p_user_hash text,
  p_source text, p_ad_id text, p_ref text, p_referral jsonb, p_entry_payload text
) returns uuid
language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_id uuid;
begin
  insert into public.ins_conversations (channel, page_id, user_hash, source, ad_id, ref, referral, entry_payload)
  values (p_channel, p_page_id, p_user_hash, coalesce(p_source, 'organic'), p_ad_id, p_ref, p_referral, p_entry_payload)
  returning id into v_id;
  insert into public.ins_events (conversation_id, kind, data)
  values (v_id, 'started', jsonb_strip_nulls(jsonb_build_object('source', coalesce(p_source, 'organic'), 'ad_id', p_ad_id, 'ref', p_ref)));
  return v_id;
end $$;

-- A referral landing on a conversation already under way. The first source stays; a
-- conversation that started without one takes this one.
create or replace function public.ins_attribute(p_conversation uuid, p_source text, p_ad_id text, p_ref text, p_referral jsonb)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $$
begin
  update public.ins_conversations set
    source        = case when ad_id is null and p_ad_id is not null then p_source else coalesce(source, p_source) end,
    ad_id         = coalesce(ad_id, p_ad_id),
    ref           = coalesce(ref, p_ref),
    referral      = coalesce(referral, p_referral),
    last_event_at = now()
  where id = p_conversation;
  insert into public.ins_events (conversation_id, kind, data)
  values (p_conversation, 'referral', jsonb_strip_nulls(jsonb_build_object('source', p_source, 'ad_id', p_ad_id, 'ref', p_ref)));
end $$;

-- One turn: its events, the conversation's summary columns, and any question the bot had no
-- written answer for (kept apart, with no conversation on it).
create or replace function public.ins_record(p_conversation uuid, p_events jsonb, p_product text default null, p_unanswered jsonb default '[]'::jsonb)
returns void language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare kinds text[];
begin
  insert into public.ins_events (conversation_id, kind, product, data)
  select p_conversation, e->>'kind', p_product, coalesce(e->'data', '{}'::jsonb)
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e
  where e->>'kind' is not null;

  select coalesce(array_agg(e->>'kind'), '{}'::text[]) into kinds
  from jsonb_array_elements(coalesce(p_events, '[]'::jsonb)) e;

  update public.ins_conversations set
    last_event_at    = now(),
    product          = coalesce(p_product, product),
    messages         = messages + (select count(*)::int from unnest(kinds) k where k = 'message'),
    model_calls      = model_calls + (select count(*)::int from unnest(kinds) k where k in ('routed', 'plan_info', 'small_talk')),
    priced_at        = coalesce(priced_at,        case when 'quoted'        = any(kinds) then now() end),
    form_sent_at     = coalesce(form_sent_at,     case when 'form_sent'     = any(kinds) then now() end),
    form_done_at     = coalesce(form_done_at,     case when 'form_done'     = any(kinds) then now() end),
    agent_replied_at = coalesce(agent_replied_at, case when 'agent_replied' = any(kinds) then now() end),
    stalled_at       = coalesce(stalled_at,       case when 'stalled'       = any(kinds) then now() end),
    handover_at      = coalesce(handover_at,      case when 'handover'      = any(kinds) then now() end)
  where id = p_conversation;

  insert into public.ins_unanswered (product, intent, route, question)
  select p_product, coalesce(u->>'intent', 'other'), coalesce(u->>'route', 'model'), u->>'question'
  from jsonb_array_elements(coalesce(p_unanswered, '[]'::jsonb)) u
  where coalesce(u->>'question', '') <> '';
end $$;

-- A lead, opened once per conversation and only ever moved forward here; the agent moves it
-- anywhere from the back office. The thread id is sealed with the same passphrase as the
-- page token. The last premium the bot gave is copied from the record.
create or replace function public.ins_open_lead(p_conversation uuid, p_psid text, p_passphrase text, p_stage text, p_product text, p_form_ref text)
returns uuid language plpgsql security definer set search_path to 'public', 'extensions' as $$
declare v_id uuid; v_quote jsonb;
begin
  select data into v_quote from public.ins_events
   where conversation_id = p_conversation and kind = 'quoted'
   order by at desc limit 1;

  insert into public.ins_leads as l (conversation_id, channel, page_id, user_hash, psid_cipher, stage, product, last_quote, ad_id, ref, form_ref)
  select c.id, c.channel, c.page_id, c.user_hash, extensions.pgp_sym_encrypt(p_psid, p_passphrase),
         coalesce(p_stage, 'interested'), coalesce(p_product, c.product), v_quote, c.ad_id, c.ref, p_form_ref
  from public.ins_conversations c where c.id = p_conversation
  on conflict (conversation_id) do update set
    stage = case
      when excluded.stage = 'form_done' then 'form_done'
      when excluded.stage = 'form_sent' and l.stage = 'interested' then 'form_sent'
      else l.stage end,
    last_quote = coalesce(excluded.last_quote, l.last_quote),
    form_ref   = coalesce(l.form_ref, excluded.form_ref),
    updated_at = now()
  returning l.id into v_id;
  return v_id;
end $$;

create or replace function public.ins_get_lead_psid(p_lead uuid, p_passphrase text)
returns text language sql stable security definer set search_path to 'public', 'extensions' as $$
  select extensions.pgp_sym_decrypt(l.psid_cipher, p_passphrase) from public.ins_leads l where l.id = p_lead;
$$;

revoke execute on function public.ins_open_conversation(text, text, text, text, text, text, jsonb, text) from public, anon, authenticated;
revoke execute on function public.ins_attribute(uuid, text, text, text, jsonb) from public, anon, authenticated;
revoke execute on function public.ins_record(uuid, jsonb, text, jsonb) from public, anon, authenticated;
revoke execute on function public.ins_open_lead(uuid, text, text, text, text, text) from public, anon, authenticated;
revoke execute on function public.ins_get_lead_psid(uuid, text) from public, anon, authenticated;
grant execute on function public.ins_open_conversation(text, text, text, text, text, text, jsonb, text) to service_role;
grant execute on function public.ins_attribute(uuid, text, text, text, jsonb) to service_role;
grant execute on function public.ins_record(uuid, jsonb, text, jsonb) to service_role;
grant execute on function public.ins_open_lead(uuid, text, text, text, text, text) to service_role;
grant execute on function public.ins_get_lead_psid(uuid, text) to service_role;

-- ============================================================================ 4. schedule

-- Hourly: the promise on /privacy is "within 24 hours", and a daily job would let a
-- conversation sit for up to two days.
select cron.schedule('ins_prune_hourly', '5 * * * *', $$select public.ins_prune()$$);
