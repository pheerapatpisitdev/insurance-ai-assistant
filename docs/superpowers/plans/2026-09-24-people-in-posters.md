# People in posters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the owner keep consenting people's reference photos and have the image model draw that person, in a chosen pose, into a post's picture.

**Architecture:** A private people library (`ins_people` + private bucket `content-people`) managed at `/content/people`. `drawImage` accepts reference images and routes them only to callers that take them (Gemini interactions image parts first, OpenAI `/images/edits` second). `backgroundPrompt` adds a person block. The create form picks a person and a pose for the round; each piece stores `output.person` so redraws keep it.

**Tech Stack:** Next.js 15, Supabase (migration via MCP + file), sharp (already used? check `package.json`; else resize in the browser with a canvas), vitest.

Spec: `docs/superpowers/specs/2026-09-24-people-in-posters-design.md`. Gemini 3.1 Flash Image takes at most 4 character images, so a person holds **1–4** photos.

---

### Task 1: Poses and the prompt's person block (pure)
**Files:** Create `src/lib/content/people.ts`; Modify `src/lib/content/background.ts`; Test `tests/content/people.test.ts`
- [ ] Test: `POSES` has `auto` first plus five poses, each with a Thai label and an English phrase; `backgroundPrompt({ …, person: { pose: "arms" } })` contains "reference photos", the pose's English phrase, "never a doctor", and the side away from the words for the layout; without `person` none of these appear; `poseText("auto")` asks the model to choose a pose fitting the scene; an unknown pose id reads as auto.
- [ ] Implement `POSES` (`auto` ให้ AI เลือก, `arms` ยืนกอดอกมั่นใจ, `point` ยิ้มชี้ไปทางข้อความ, `consult` นั่งให้คำปรึกษา, `tablet` ถือแท็บเล็ตอธิบาย, `wave` โบกมือทักทาย), `poseText(id)`, `MAX_PHOTOS = 4`, and the person block in `backgroundPrompt`.
- [ ] Run tests; commit.

### Task 2: References in the image callers
**Files:** Modify `src/lib/ai/images.ts`, `src/lib/ai/client.ts`; Test `tests/ai/images.test.ts` (or existing ai test dir)
- [ ] Test (pure): `googleBody(model, prompt, params, refs)` puts each reference as `{ type: "image", mime_type, data }` after the text item; `TAKES_REFERENCES` lists google and openai.
- [ ] Implement: `ImageArgs.references?: { bytes: Buffer; mimeType: string }[]`; Google caller adds the image items; OpenAI caller uses `https://api.openai.com/v1/images/edits` with `FormData` (`model`, `prompt`, `size`, `quality`, one `image[]` Blob per reference) when references exist, else generations as now. `drawImage({ …, references })` passes them through and, with references, prefers `gemini-image` then `gpt-image-medium`.
- [ ] Run tests + `npx tsc --noEmit`; commit.

### Task 3: The people store
**Files:** `supabase/migrations/20260924_content_people.sql` (apply via MCP), `src/lib/content/people-store.ts`
- [ ] Migration: `ins_people(id uuid pk default gen_random_uuid(), name text not null check (char_length(name) between 1 and 40), photos text[] not null default '{}', consented_at timestamptz not null, created_at timestamptz default now())`, RLS on with no policies (service role only); private bucket `content-people` (`insert into storage.buckets (id, name, public) values ('content-people','content-people', false) on conflict do nothing`).
- [ ] Store: `listPeople()`, `addPerson(name, files)`, `deletePerson(id)` (removes `id/*` from the bucket first), `personPhotos(id)` → `{ bytes, mimeType }[]` (downloads, at most 4), `photoBytes(path)` for thumbnails. Paths `"<person id>/<n>.<ext>"`, checked by a regex before use.
- [ ] `npx tsc --noEmit`; commit.

### Task 4: `/content/people`
**Files:** `src/app/content/people/page.tsx`, `src/app/content/people/PeopleBoard.tsx`, `src/app/content/people/actions.ts`, `src/app/api/content-people/photo/route.ts`; link on `src/app/content/page.tsx`
- [ ] Server actions: `savePerson(formData)` — name, 1–4 image files (type in jpeg/png/webp, ≤ 5 MB each), `consent === "on"` required, else a Thai error; `removePerson(id)`.
- [ ] Photo route: GET `?path=` → bytes with `cache-control: private, max-age=300`, 404 on a bad path.
- [ ] Page: list of people with thumbnails and a delete button (uses `ask()`); an add form (name, file input `multiple accept="image/*"`, consent checkbox, save). The theme's `--ct-*` tokens like the calendar page.
- [ ] Browser check; commit.

### Task 5: Draw with a person
**Files:** `src/lib/content/output.ts` (`person?: { id: string; pose: string }`), `src/app/content/actions.ts` (`drawBackground(id, request, painter, person?)`), `src/app/api/content-draw/route.ts`, `src/app/content/draw.ts`
- [ ] `drawBackground`: the person is the argument if given (`null` = remove), else `item.output.person`; loads `personPhotos`; a missing person → draw without, and the result carries a note; passes `references` and `person` to `drawImage`/`backgroundPrompt`; saves `output.person` on the piece.
- [ ] `npx tsc --noEmit`; commit.

### Task 6: The form and the editor
**Files:** `src/app/content/ContentStudio.tsx`, `src/app/content/PosterPanel.tsx`, `src/app/content/page.tsx` (pass the people list)
- [ ] Create form: "ใส่บุคคลในภาพ" select (ไม่ใส่ + people) remembered per device; pose chips when chosen; passed to the round's auto-draw.
- [ ] Editor: the same select + chips beside the redraw box, starting from the piece's `output.person`.
- [ ] Browser check; `npm run verify && git push origin main`.

### Task 7: Live test with the owner's photos
- [ ] Ask the owner to add themselves at `/content/people`; draw one post with ยืนกอดอกมั่นใจ and one with นั่งให้คำปรึกษา; screenshot both; report cost from the ledger.
