-- People in posters (owner, 2026-09-24): consenting people whose reference photos the image
-- model draws from. Photos live in a private bucket read only by the server when it draws;
-- nothing here is ever given a public URL. consented_at is when the owner ticked that the
-- photos' owner agreed to advertising use and AI alteration — no tick, no row.
create table if not exists ins_people (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 40),
  photos text[] not null default '{}',
  consented_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table ins_people enable row level security;
-- no policies: the service role alone reads and writes it, like every ins_* table

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('content-people', 'content-people', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do nothing;
