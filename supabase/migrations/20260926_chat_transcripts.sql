-- Chat transcripts and the daily review that reads them (owner, 2026-09-26).
--
-- Until now no chat text outlived the 24-hour session, by design. The owner asked for the bot
-- to learn from its conversations, which it cannot do from counts alone, and chose:
--   * the text of every turn kept 90 days — the customer's, the bot's, and what the agent
--     typed by hand in the Page inbox — with phone numbers, national ids, emails and LINE ids
--     taken out before it is written (src/lib/chat/transcript.ts);
--   * a review once a day that reads them and proposes answers, which the owner approves one
--     by one into ins_faq (the notes the AI already reads).
-- Rows older than 90 days are deleted by the review job itself (src/lib/chat/review.ts).
-- Server-only, like every ins_* table. docs/data-deletion.md lists these tables.

create table if not exists public.ins_transcripts (
  id bigserial primary key,
  at timestamptz not null default now(),
  channel text not null check (channel in ('facebook', 'line')),
  page_id text,
  user_hash text not null,
  conversation_id uuid,
  role text not null check (role in ('customer', 'bot', 'agent')),
  text text not null check (length(text) <= 2000),
  product text
);

alter table public.ins_transcripts enable row level security;
revoke all on public.ins_transcripts from public, anon, authenticated;
grant all on public.ins_transcripts to service_role;
grant usage, select on sequence public.ins_transcripts_id_seq to service_role;

create index if not exists ins_transcripts_at_idx on public.ins_transcripts (at);
create index if not exists ins_transcripts_thread_idx on public.ins_transcripts (channel, user_hash, at);

comment on table public.ins_transcripts is
  'Chat turns, scrubbed of contact details: role = customer | bot | agent. Kept 90 days, then deleted by the daily review.';

create table if not exists public.ins_chat_reviews (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  since timestamptz not null,
  until timestamptz not null,
  conversations int not null default 0,
  summary text not null,
  model text,
  cost_thb numeric not null default 0
);

alter table public.ins_chat_reviews enable row level security;
revoke all on public.ins_chat_reviews from public, anon, authenticated;
grant all on public.ins_chat_reviews to service_role;
grant usage, select on sequence public.ins_chat_reviews_id_seq to service_role;

create index if not exists ins_chat_reviews_created_idx on public.ins_chat_reviews (created_at desc);

comment on table public.ins_chat_reviews is
  'One row per review of the transcripts between since and until. Kept 90 days, like the transcripts it quotes.';

create table if not exists public.ins_chat_review_items (
  id bigserial primary key,
  review_id bigint not null references public.ins_chat_reviews (id) on delete cascade,
  kind text not null check (kind in ('unanswered', 'wrong', 'dropoff', 'agent')),
  question text not null check (length(question) <= 200),
  evidence text check (length(evidence) <= 400),
  answer text not null check (length(answer) <= 2000),
  status text not null default 'open' check (status in ('open', 'used', 'skipped')),
  faq_id uuid,
  decided_at timestamptz
);

alter table public.ins_chat_review_items enable row level security;
revoke all on public.ins_chat_review_items from public, anon, authenticated;
grant all on public.ins_chat_review_items to service_role;
grant usage, select on sequence public.ins_chat_review_items_id_seq to service_role;

create index if not exists ins_chat_review_items_review_idx on public.ins_chat_review_items (review_id);

comment on table public.ins_chat_review_items is
  'A proposed note from a review: the question, a short quote as evidence, and the answer. used = copied into ins_faq (faq_id).';
