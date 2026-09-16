-- Pin the search_path on the two ins_* functions that were left without one.
--
-- Every other function in this family already carries SET search_path TO 'public','extensions'.
-- These two do not, and ins_prune is SECURITY DEFINER: it runs as its owner, so an unqualified
-- name inside it resolves through whatever search_path the caller happens to have. Revoking
-- anon's EXECUTE has already taken the reachable attack away, but a definer function whose
-- names can be redirected is worth closing on its own.
--
-- ALTER rather than CREATE OR REPLACE: the bodies are correct and do not need retyping, and
-- retyping them from a transcript is how a working function acquires a subtle difference.

alter function public.ins_prune() set search_path = public, extensions;
alter function public.ins_search_faq(vector, integer) set search_path = public, extensions;
