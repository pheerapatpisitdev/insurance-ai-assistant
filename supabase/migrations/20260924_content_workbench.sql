-- The content workbench: pieces get a status, and opening lines get a library of formulas.
--
-- ins_content.status replaces the star. A piece is รอตรวจ (draft) until the owner marks it
-- ใช้จริง (used) or throws it away (trashed); trashed pieces stay, and can be restored.
-- Pieces that were starred before this are the ones the owner had marked as used.
-- `starred` is left in place and no longer read.
--
-- ins_hook_templates is the formula library, ported from the owner's Maryjane project with its
-- thirty insurance seeds (six per category). It grows from the owner's own work: marking a
-- piece ใช้จริง draws a formula out of its hook. A formula is unique by its text, ignoring
-- case and surrounding space, so the same one drawn twice is one row.
--
-- Locked to service_role like every other ins_* table: see
-- 20260916_lock_ins_rpcs_to_service_role.sql.

alter table public.ins_content
  add column if not exists status text not null default 'draft'
    check (status in ('draft', 'used', 'trashed'));

update public.ins_content set status = 'used' where starred and status = 'draft';

create index if not exists ins_content_status_created_at on public.ins_content (status, created_at desc);

create table if not exists public.ins_hook_templates (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('SWAP', 'BUILD', 'CLAIM', 'LIST', 'CONTRARIAN')),
  template text not null check (char_length(btrim(template)) between 4 and 200),
  example_hook text,
  source_content_id uuid references public.ins_content(id) on delete set null,
  use_count integer not null default 0 check (use_count >= 0),
  seed boolean not null default false,
  created_at timestamptz not null default now()
);

create unique index if not exists ins_hook_templates_template_key
  on public.ins_hook_templates (lower(btrim(template)));

comment on table public.ins_hook_templates is
  'สูตรประโยคเปิด (hook) มีช่อง [ ] ให้เติม — 30 สูตรตั้งต้นจาก Maryjane และสูตรที่ถอดจากโพสต์ที่ใช้จริง';

alter table public.ins_content
  add column if not exists hook_template_id uuid references public.ins_hook_templates(id) on delete set null;

insert into public.ins_hook_templates (category, template, seed) values
  ('SWAP', 'เลิก[พฤติกรรมเดิม] แล้วเริ่ม[พฤติกรรมใหม่] ก่อน[เหตุการณ์สำคัญ]', true),
  ('SWAP', 'หยุดจ่าย[ค่าใช้จ่ายที่ไม่จำเป็น] แล้วเอาเงินนั้นมา[ทางเลือกที่ดีกว่า]', true),
  ('SWAP', 'อย่าเพิ่ง[สิ่งที่คนมักทำ] ถ้ายังไม่ได้[สิ่งที่ควรทำก่อน]', true),
  ('SWAP', 'เปลี่ยนจาก[วิธีเดิม] เป็น[วิธีใหม่] แล้ว[ผลลัพธ์ที่ได้]', true),
  ('SWAP', 'เลิกกลัว[ความกังวล] แล้วมาดู[ทางแก้ที่ง่ายกว่าที่คิด]', true),
  ('SWAP', 'แทนที่จะ[ทางเลือกยอดนิยม] ลอง[ทางเลือกที่คุ้มกว่า]ดูก่อน', true),
  ('BUILD', 'วางแผน[เป้าหมาย]ให้เสร็จใน[ระยะเวลา] ด้วยเงิน[จำนวน]ต่อเดือน', true),
  ('BUILD', 'สร้าง[ความมั่นคง]ให้[คนที่รัก] ภายใน[ระยะเวลา] เริ่มจาก[ขั้นแรก]', true),
  ('BUILD', 'จาก[จุดเริ่มต้น] สู่[ผลลัพธ์] ใน[ระยะเวลา] ทำได้ด้วย[วิธี]', true),
  ('BUILD', 'เตรียม[สิ่งที่ต้องมี]ก่อนอายุ[ตัวเลข] ให้ครบใน[จำนวน]ขั้น', true),
  ('BUILD', 'ปิดช่องโหว่[ความเสี่ยง]ให้จบใน[ระยะเวลา] ด้วย[เครื่องมือ]', true),
  ('BUILD', 'เก็บ[จำนวนเงิน]ต่อวัน กลายเป็น[ผลลัพธ์]ใน[ระยะเวลา]', true),
  ('CLAIM', 'คุณต้องมี[ความคุ้มครอง]ก่อนอายุ[ตัวเลข] นี่คือเหตุผล', true),
  ('CLAIM', '[กลุ่มคน]ทุกคนควรมี[สิ่งนี้] แม้จะคิดว่ายังไม่จำเป็น', true),
  ('CLAIM', '[ความเชื่อทั่วไป]ไม่จริงเสมอไป และนี่คือสิ่งที่เกิดขึ้นจริง', true),
  ('CLAIM', 'ถ้าคุณ[สถานการณ์] [สิ่งนี้]สำคัญกว่าที่คิด', true),
  ('CLAIM', '[ผลิตภัณฑ์]ไม่ใช่ค่าใช้จ่าย แต่คือ[มุมมองใหม่]', true),
  ('CLAIM', 'เรื่อง[หัวข้อ]ที่คนส่วนใหญ่เข้าใจผิด และราคาที่ต้องจ่ายเมื่อเข้าใจผิด', true),
  ('LIST', '[N] เรื่องที่ควรรู้ก่อนซื้อ[ผลิตภัณฑ์]', true),
  ('LIST', '[N] สัญญาณว่าคุณ[สถานการณ์เสี่ยง]โดยไม่รู้ตัว', true),
  ('LIST', '[N] คำถามที่ต้องถาม[ตัวแทน]ก่อนเซ็น[เอกสาร]', true),
  ('LIST', '[N] ความผิดพลาดของ[กลุ่มคน]เรื่อง[หัวข้อ] ที่แก้ได้ตั้งแต่วันนี้', true),
  ('LIST', 'เช็กลิสต์ [N] ข้อก่อน[เหตุการณ์] คุณครบไหม', true),
  ('LIST', '[N] ทางเลือกเรื่อง[หัวข้อ]สำหรับ[กลุ่มคน]ที่งบ[ระดับงบ]', true),
  ('CONTRARIAN', 'ยังไม่มีใครบอกคุณเรื่อง[ความจริง]ของ[ผลิตภัณฑ์]', true),
  ('CONTRARIAN', 'ทำไม[คำแนะนำยอดนิยม]อาจไม่เหมาะกับ[กลุ่มคน]', true),
  ('CONTRARIAN', '[สิ่งที่คนคิดว่าดี]อาจทำให้คุณ[ผลเสีย] ถ้าไม่ดู[รายละเอียด]', true),
  ('CONTRARIAN', 'เรื่องที่[ผู้ขาย]ไม่ค่อยพูดถึงเวลาแนะนำ[ผลิตภัณฑ์]', true),
  ('CONTRARIAN', 'ไม่ต้อง[สิ่งที่คนคิดว่าต้องทำ]ก็[ผลลัพธ์]ได้ ถ้ารู้[เคล็ดลับ]', true),
  ('CONTRARIAN', '[กระแสที่คนแห่ทำ] กับความจริงที่[กลุ่มคน]ควรรู้', true)
on conflict (lower(btrim(template))) do nothing;

alter table public.ins_hook_templates enable row level security;
revoke all on public.ins_hook_templates from anon, authenticated;
grant all on public.ins_hook_templates to service_role;
