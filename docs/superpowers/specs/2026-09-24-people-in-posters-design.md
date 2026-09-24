# People in posters — design

Owner request, 2026-09-24: put the owner (or a consenting model) into the poster's picture,
with AI setting the pose. Decisions, in the order the owner made them:

1. **AI redraws the person (B).** Reference photos go to the image model, which draws that
   person in a new scene and pose. About 90% likeness is acceptable to the owner.
2. **A library of people (B).** Several named people ("ตัวผม", "นางแบบ A"), each with 3–5
   reference photos, kept once and picked per round.
3. **Pose buttons plus free text (B).** A row of preset poses, "ให้ AI เลือก" the default; clothes
   and place go in the existing picture-brief box.

## Parts

### 1. คลังบุคคล — `/content/people`
- Linked from the create page beside ปฏิทินโพสต์ / คลังสูตรประโยคเปิด.
- Add a person: a name, 1–5 photos (JPEG/PNG/WebP, each ≤ 5 MB, resized on the server to at
  most 1024px on the long side), and a **required** consent tick: "ได้รับความยินยอมจากเจ้าของรูป
  ให้ใช้ในโฆษณาและให้ AI ดัดแปลงได้". No tick, no save.
- Delete a person: the row and every stored photo go (the owner's confirmation via `ask()`).
- Storage: table `ins_people (id uuid, name text, photos text[], consented_at timestamptz,
  created_at)`, service-role only like the other `ins_*` tables; photos in a **private**
  bucket `content-people`, read only by the server when drawing. No public URL anywhere; the
  page shows thumbnails through a server route that checks the path shape.

### 2. On the create form
- "ใส่บุคคลในภาพ" under โทนสีโปสเตอร์ (posts and ads, hidden for scripts and when the painter is
  ไม่วาดภาพ): a select — ไม่ใส่ (default) / each person — remembered per device.
- With a person chosen, pose chips: ให้ AI เลือก · ยืนกอดอกมั่นใจ · ยิ้มชี้ไปทางข้อความ ·
  นั่งให้คำปรึกษา · ถือแท็บเล็ตอธิบาย · โบกมือทักทาย.
- The choice is stored on each piece (`output.person = { id, pose }`) so a redraw in the editor
  keeps the person; the editor can change or remove it.

### 3. Drawing with references
- `drawImage` gains optional `references: { bytes, mimeType }[]`. Only callers that accept
  them are tried when references are present:
  - Google (`gemini-image`, `gemini-image-lite`): reference images as image input parts
    before the text, same interactions endpoint.
  - OpenAI (`gpt-image-*`): `/v1/images/edits` with the photos as `image[]`.
  Gemini first — it keeps a face best; OpenAI as the fallback.
- `backgroundPrompt` gains `person?: { pose: string }` and then adds: the person in the
  reference photos is the main subject; same face, hairstyle, skin tone and build; the pose;
  keep them on the side away from the words (per layout); ordinary clothes unless the brief
  says otherwise; never a doctor's, nurse's or any uniform; no other identifiable faces.
- A person that no longer exists (deleted) is dropped with a note, and the picture is drawn
  without them rather than failing.

### 4. Money
Priced like any picture from the ledger (Gemini Image ฿2.41 at today's table; references add
input tokens on OpenAI). Counted against the content budget.

## Out of scope
Keeping the owner's real photo untouched (option A), video, any public sharing of photos.

## Testing
- Unit: consent is required; the prompt carries the person block and the no-uniform rule
  only when a person is given; pose ids map to English; references route only to callers
  that take them.
- Live: one person added with photos the owner uploads; one post drawn with each of two poses.
