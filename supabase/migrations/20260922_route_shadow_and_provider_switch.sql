-- Two small things for the week TypeSafe runs in the shadow of the router.
--
-- ins_route_shadow: one row per routed turn, saying what the chat model called it, what the
-- code settled on after its own rules, and what Jev would have called it with how much
-- confidence. Kinds and numbers only — never the customer's words, same as ins_events. The
-- table exists to answer one question at the end of the week: does Jev agree with the bot
-- often enough, on real conversations with history, to be trusted with the decision.
--
-- ins_api_keys.enabled: the switch beside each key on the admin page. Off means the provider
-- is not called at all — its models leave the fallback chain and the judge refuses — without
-- the key having to be deleted and pasted back. For TypeSafe it is also the shadow's off
-- switch, since the shadow asks the judge and the judge checks it.

create table if not exists public.ins_route_shadow (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  product text not null,
  model_intent text not null,
  final_intent text not null,
  jev_intent text not null,
  jev_confidence numeric(4,3) not null,
  agrees_model boolean not null,
  agrees_final boolean not null
);
comment on table public.ins_route_shadow is
  'Jev vs the chat model on every routed turn while the judge runs in shadow. Kinds and numbers only, never the customer''s words.';
alter table public.ins_route_shadow enable row level security;
revoke all on public.ins_route_shadow from public, anon, authenticated;

alter table public.ins_api_keys add column if not exists enabled boolean not null default true;
