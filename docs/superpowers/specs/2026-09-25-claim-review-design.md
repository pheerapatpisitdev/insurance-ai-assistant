# รีวิวเคลม — claim documents into a post and a poster

Owner, 2026-09-25. A second mode on /content beside "จากแบบประกัน".

## What the owner does

1. /content → **รีวิวเคลม**.
2. Adds up to 6 photos of claim papers (approval letter, hospital bill, medical certificate,
   chat / transfer slip). Images only; a PDF is screenshotted first.
3. Ticks **ลูกค้ายินยอมให้ใช้เอกสารนี้ลงเพจแล้ว** — required, checked on the server too.
4. **ให้ AI อ่านเอกสาร** (~฿0.2): one vision call returns the claim facts and, per image, boxes
   around anything that identifies someone.
5. Review dialog:
   - each image with black bars already on: tap a bar to remove it, drag on the image to add
     one; **ตรวจแล้ว** per image — an unchecked image cannot go on a poster.
   - the facts, every field editable, numbers marked "AI อ่าน — เทียบกับเอกสาร".
   - pick the one image for the poster.
6. **สร้างรีวิวเคลม 1–3 ชิ้น** → pieces land in รอตรวจ like any other: edit, proofread, post,
   schedule.

Not tied to a plan (owner): the post tells the claim only and sells nothing.

## Privacy

- Bars are burnt into the pixels in the browser (canvas → JPEG). Only the redacted poster image
  is uploaded and stored, under the piece (`content-media/<piece>/<file>.jpg`), so deleting the
  piece deletes it.
- Originals go to the vision model once, in memory, and are never stored.
- Redacted by default: names, national ID, policy / claim / HN / AN numbers, address, phone,
  birth date, bank account, doctor's name and signature, QR / barcodes.
- The text never carries a name, a hospital name or an exact date; the writer is told so and
  the facts it is given have none.

## Facts (ClaimFacts)

`kind` (ipd / opd / ci / accident / other), `illness` (plain words), `nights`, `billTotal`,
`paid` (insurer), `selfPaid`, `daysToApprove`, `who` ("ผู้หญิง วัย 40+"), `note` (one line the
owner may add). Numbers are strings as printed; the facts block is the yardstick for the
number check, as a plan's brief is.

## Writing

No planner. Each piece takes one of three fixed angles — ยอดเงินชัดๆ, เล่าเหตุการณ์, ข้อคิด /
เตรียมตัว — so 1–3 pieces are distinct without a second call. One call per piece on the
picked writer, same JSON shape as posts (hook, body, closing, hashtags, poster). Core rules
apply (no invented numbers, no superlatives, no other insurers); Facebook's personal-attribute
rule applies (never "คุณป่วยเป็น…").

## Poster

`PosterSpec.document = { path, ratio }`. When present the drawing puts the words on the top
part and the redacted document as a white, slightly tilted card below; the `sub` line is drawn
on the yellow highlighter (it carries the amount: "บริษัทจ่าย 48,250 บาท"). Themes and sizes
work as before. No AI background is auto-drawn for claim pieces.

## Pieces

`planHref = "claim-review"`, named "รีวิวเคลม" in lists and the calendar. `output.fact` holds the
facts block so edits are checked against it again.

## Code

- `src/lib/ai/*` — messages may carry images (Anthropic, OpenAI, Google).
- `src/lib/content/claim.ts` — facts, redaction boxes, read prompt + parse, write prompt + parse.
- `src/app/api/content-claim/route.ts` — POST read (form data), PUT write (form data).
- `src/app/content/claim/*` — tools panel, review dialog, redaction canvas.
- poster.ts / poster-draw.tsx — `document`.

Budget: reading and writing count against the content cap and the hourly limits like a round.

## Revised the same day (owner)

- **One press, as for a plan.** The form shows everything from the start — papers, consent,
  ทำอะไร (โพสต์ / สคริปต์ + length / โฆษณา), มุมที่อยากเล่า (AI's turns, five angles, or own
  words), คนอ่าน (shared with the plan form), เล่าเพิ่ม, count, writer. สร้าง reads the papers,
  burns the AI's stickers onto the one for the poster (approval letter first) and writes.
  The review dialog before writing is gone; facts are no longer edited before writing.
- **Covers are stickers**, not black bars: opaque pastel pills with a face and a word, padded so
  their rounded corners still cover the box.
- **The check moved to the editor.** A piece with a paper carries `paperChecked: false`; the
  editor shows the paper, the owner drags on more stickers if the AI missed anything and ticks
  ตรวจแล้ว (a new stickered picture replaces the old). `clear()` in publish-flow refuses to post
  or schedule until then. Stickers can be added there, never lifted.
- A script has no poster, so no paper goes with it and nothing needs checking.
- **Up to three papers on a poster** (owner, later the same day): `PosterSpec.documents`, approval
  letters first, drawn as a pile — portrait papers fanned side by side, wide screenshots stacked.
  A poster that carried one `document` is read as a list of it.
- **An AI photograph behind the pile**, as a plan's posters get one: the writer gives an
  `imagePrompt`, the form has ภาพประกอบ, and each new claim poster's picture is drawn after the
  round. The theme's wash sits under the words.
- **Claims tables:** the reader picks the approved row with the highest approved amount and
  fills every field from it; ยอดอนุมัติ is paid, ยอดเรียกร้อง the bill.

