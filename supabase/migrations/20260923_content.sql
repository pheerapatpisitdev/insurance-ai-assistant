-- The content generator at /content: what it wrote, and the owner's list of words to watch.
--
-- ins_content keeps every generated post or script so the owner can come back to one, copy it
-- again, or star the ones they actually used. The page is public (the owner's choice, made
-- knowing it), but these tables are not: the page reaches them through server actions only.
--
-- ins_content_words is the list the first check reads — claims an insurance advertisement
-- must not make, and misspellings with their fix. Seeded below and edited on /admin/knowledge,
-- so the owner can take a word off the list as easily as put one on.
--
-- Locked to service_role like every other ins_* table: see
-- 20260916_lock_ins_rpcs_to_service_role.sql.

create table if not exists public.ins_content (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  plan_href text not null,
  format text not null check (format in ('post', 'script')),
  angle text,
  length text,
  output jsonb not null,
  flags jsonb not null default '{}'::jsonb,
  rate_version text,
  model text,
  cost_thb numeric not null default 0,
  starred boolean not null default false
);

create index if not exists ins_content_created_at on public.ins_content (created_at desc);

comment on table public.ins_content is
  'โพสต์และสคริปต์ที่หน้า /content สร้าง พร้อมผลตรวจตัวเลข/คำ';

create table if not exists public.ins_content_words (
  word text primary key,
  kind text not null check (kind in ('banned', 'misspelling')),
  fix text,
  created_at timestamptz not null default now()
);

comment on table public.ins_content_words is
  'คำที่ตัวตรวจโพสต์เตือน: คำโฆษณาต้องห้าม และคำที่มักสะกดผิดพร้อมคำที่ถูก';

insert into public.ins_content_words (word, kind, fix) values
  ('การันตี', 'banned', null),
  ('รับประกันผลตอบแทน', 'banned', null),
  ('ได้เงินคืนแน่นอน', 'banned', null),
  ('ไม่มีความเสี่ยง', 'banned', null),
  ('ดีที่สุด', 'banned', null),
  ('ถูกที่สุด', 'banned', null),
  ('คุ้มที่สุด', 'banned', null),
  ('อันดับ 1', 'banned', null),
  ('ไม่ต้องตรวจสุขภาพ', 'banned', null),
  ('รับทุกโรค', 'banned', null),
  ('จ่ายทุกกรณี', 'banned', null),
  ('คุ้มคลอง', 'misspelling', 'คุ้มครอง'),
  ('อนุญาติ', 'misspelling', 'อนุญาต'),
  ('สังเกตุ', 'misspelling', 'สังเกต'),
  ('โอกาศ', 'misspelling', 'โอกาส'),
  ('กระทันหัน', 'misspelling', 'กะทันหัน'),
  ('ศรีษะ', 'misspelling', 'ศีรษะ'),
  ('ทายาต', 'misspelling', 'ทายาท'),
  ('ลายเซ็นต์', 'misspelling', 'ลายเซ็น')
on conflict (word) do nothing;

alter table public.ins_content enable row level security;
alter table public.ins_content_words enable row level security;

revoke all on public.ins_content from anon, authenticated;
revoke all on public.ins_content_words from anon, authenticated;
grant all on public.ins_content to service_role;
grant all on public.ins_content_words to service_role;
