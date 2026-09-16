-- Internal RPCs belong to the server, not to anyone holding the publishable key.
--
-- Every ins_* function is SECURITY DEFINER or reads the project's own tables, and twelve of
-- them could be executed by `anon` — the role every visitor's browser gets, whose key is
-- published in the page by design. That meant anyone at all could call:
--
--   ins_clear_channel_auth  delete the Page connection, and the bot goes silent mid-campaign
--   ins_set_channel_auth    overwrite it with a token of their own
--   ins_set_api_key         overwrite the encrypted model keys
--   ins_get_api_keys        ask for them back, decrypted, with a passphrase of their choosing
--   ins_get_channel_auth    the same for the Page token
--
-- Nothing in this application needs them from a browser: the whole codebase builds exactly one
-- Supabase client, in src/lib/supabase/admin.ts, with the service-role key, on the server. The
-- publishable key is not used anywhere. Twenty-four hours of edge logs show every ins_* call
-- carrying service_role and none carrying anon or authenticated.
--
-- Some of the grants are explicit and some are inherited from PUBLIC, so both have to go —
-- revoking from anon alone leaves the PUBLIC grant standing and changes nothing at all.
--
-- postgres keeps EXECUTE as the owner, which is what the pg_cron jobs run as: ins_prune_hourly
-- and messenger-followups both have username = postgres.

do $$
declare f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname like 'ins\_%'
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
    execute format('grant execute on function %s to service_role', f.sig);
  end loop;
end $$;
