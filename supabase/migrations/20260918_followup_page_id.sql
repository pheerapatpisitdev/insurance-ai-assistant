-- The follow-up remembers which Page it belongs to.
--
-- Two Pages are connected now, and the queue never recorded which one a conversation happened
-- on. The sender had no Page in hand, so it took whichever token `pageToken(undefined)` found
-- first — the most recently connected Page — and Meta answered every follow-up bound for the
-- other one with "ไม่พบผู้ใช้ที่แมตช์": a page-scoped id means nothing to a Page that did not
-- issue it. Three customers were quoted this morning and then heard nothing, which is the one
-- silence this whole feature exists to prevent.
--
-- The column is the Page's own numeric id, which is not a secret and is not the customer's —
-- the one identifier here that has to be encrypted already is, and stays that way.
--
-- Both functions are dropped and recreated rather than replaced, because their shapes change:
-- an argument with a default on one, a returned column on the other. Old code deployed at the
-- moment this runs keeps working — a six-argument call lands on the new default, and a reader
-- that selects three columns is unbothered by a fourth.

alter table public.ins_chat_followups add column if not exists page_id text;

drop function if exists public.ins_arm_followup(text, text, text, timestamptz, timestamptz, text);

create function public.ins_arm_followup(
  p_channel text,
  p_user_hash text,
  p_psid text,
  p_due_at timestamptz,
  p_expires_at timestamptz,
  p_passphrase text,
  p_page_id text default null
) returns void
language sql
security definer
set search_path to 'public', 'extensions'
as $function$
  insert into public.ins_chat_followups
    (channel, user_hash, psid_cipher, page_id, quoted_at, due_at, expires_at, sent_at)
  values (p_channel, p_user_hash, extensions.pgp_sym_encrypt(p_psid, p_passphrase), p_page_id,
          now(), p_due_at, p_expires_at, null)
  on conflict (channel, user_hash) do update
    set psid_cipher = excluded.psid_cipher,
        page_id = excluded.page_id,
        quoted_at = excluded.quoted_at,
        due_at = excluded.due_at,
        expires_at = excluded.expires_at,
        sent_at = null
    where public.ins_chat_followups.expires_at <= now();
$function$;

drop function if exists public.ins_claim_followups(text, text);

create function public.ins_claim_followups(p_channel text, p_passphrase text)
returns table(user_hash text, psid text, page_id text, stage smallint)
language sql
security definer
set search_path to 'public', 'extensions'
as $function$
  with due as (
    select f.user_hash as uh,
           extensions.pgp_sym_decrypt(f.psid_cipher, p_passphrase) as id,
           f.page_id as pg,
           f.stage as st,
           public.ins_followup_second_due(f.quoted_at, f.expires_at) as next_due
      from public.ins_chat_followups f
      join public.ins_chat_sessions s
        on s.channel = f.channel and s.user_hash = f.user_hash
     where f.channel = p_channel
       and f.sent_at is null
       and f.psid_cipher is not null
       and f.due_at <= now()
       and f.expires_at > now()
       and s.updated_at <= f.quoted_at
       and (s.muted_until is null or s.muted_until < now())
  ), advanced as (
    update public.ins_chat_followups f
       set stage = 2, due_at = d.next_due
      from due d
     where f.channel = p_channel and f.user_hash = d.uh
       and d.st = 1 and d.next_due is not null
    returning f.user_hash
  ), finished as (
    update public.ins_chat_followups f
       set sent_at = now(), psid_cipher = null
      from due d
     where f.channel = p_channel and f.user_hash = d.uh
       and (d.st >= 2 or d.next_due is null)
    returning f.user_hash
  )
  select d.uh, d.id, d.pg, d.st from due d;
$function$;

-- a recreated function comes back with PUBLIC's grant, which is exactly what
-- 20260916_lock_ins_rpcs_to_service_role.sql took away from every ins_* function
do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('ins_arm_followup', 'ins_claim_followups')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
