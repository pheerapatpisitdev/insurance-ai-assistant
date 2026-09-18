-- The thread the form went out in is an agent's, and stays theirs.
--
-- The bot already stopped answering once the form had gone, but it read that from the
-- session's own slots — and a session goes stale after a day. So a customer who filled the
-- form in on Tuesday and wrote again on Thursday was met by the bot, quoting, in the middle
-- of an application a person was already handling.
--
-- This column has its own clock, the way muted_until does: it is read whatever the age of the
-- row. Clearing it is what gives the thread back to the bot, and that is a deliberate act by
-- somebody who knows the application is over.
alter table public.ins_chat_sessions add column if not exists handed_over_at timestamptz;

comment on column public.ins_chat_sessions.handed_over_at is
  'When the application form was handed to this customer. The bot answers nothing in the thread after it: what follows a form is an agent. Unlike the session itself this does not go stale — clear the column to give the thread back to the bot.';
