-- Pieces posted to a Facebook Page from the workbench, now or at a time Facebook holds.
--
-- Facebook keeps the schedule itself (scheduled_publish_time), so nothing here runs a clock:
-- these columns only remember what was sent where, for the card, the calendar and cancelling.
--
-- publish_state
--   posting    claimed by one request while it talks to Facebook; a second tap finds it taken
--   scheduled  Facebook holds it for publish_at
--   published  on the Page since publish_at
--   failed     Facebook refused; publish_error says why, and it may be tried again
--   cancelled  a scheduled post taken back before its time; it may be scheduled again
--
-- fb_post_id is what Facebook returned: the post id ("<page>_<post>") when it gives one,
-- otherwise the photo id. Either deletes the post, which is how a schedule is cancelled.

alter table public.ins_content
  add column if not exists fb_page_id text,
  add column if not exists fb_post_id text,
  add column if not exists publish_state text
    check (publish_state in ('posting', 'scheduled', 'published', 'failed', 'cancelled')),
  add column if not exists publish_at timestamptz,
  add column if not exists publish_error text;

create index if not exists ins_content_publish_at on public.ins_content (publish_at)
  where publish_state in ('scheduled', 'published');
