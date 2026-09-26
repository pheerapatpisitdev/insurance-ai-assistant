# หาทีม (recruiting content + chat hand-over) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A third /content mode, หาทีม, that writes recruiting posts/ads/scripts from a picked topic, checked by recruit-specific Facebook/คปภ. rules; and a bot that hands a "อยากเป็นตัวแทน" message to the owner instead of pitching insurance.

**Architecture:** Mirrors รีวิวเคลม: a browser-safe module (`src/lib/content/recruit.ts`: topics, readers, prompt, parser, poster), a server runner (`recruit-run.ts`) called from a server action, and a form component (`src/app/content/recruit/RecruitTools.tsx`) rendered as the third tab of ContentStudio. Policy rules gain an opt-in recruit set. The chat hand-over is a fixed reply in `answerAny` (no model), recorded as a `recruit_interest` event and an `interested` lead with product `recruit`.

**Tech Stack:** Next.js 15 server actions, TypeScript, vitest, Supabase RPCs (`ins_record`, `ins_open_lead` — no schema change: event kinds and products are free text).

Spec: `docs/superpowers/specs/2026-09-26-recruit-content-design.md`

---

## File map

| File | Change |
|---|---|
| `src/lib/content/recruit.ts` | new — RECRUIT_HREF/NAME, RECRUIT_TOPICS (+brief), RECRUIT_READERS, RECRUIT_TONES, recruitTones(), recruitSystem(), recruitMessages(), recruitPoster(), parseRecruitPiece() |
| `src/lib/content/recruit-run.ts` | new — writeRecruit(input): budget hold → N writer calls → checks → save |
| `src/lib/content/policy.ts` | RECRUIT_POLICY_RULES, `checkPolicy(text, { recruit })`, RECRUIT_RULES_TH |
| `src/app/content/actions.ts` | `generateRecruit` server action (rate-limited); flagsFor passes `recruit` on edits |
| `src/app/content/recruit/RecruitTools.tsx` | new — the form |
| `src/app/content/ContentStudio.tsx` | third tab, nameOf, list filter option |
| `src/app/content/calendar/page.tsx` | name หาทีม pieces |
| `src/lib/assistant/recruit.ts` | new — wantsToJoin(), recruitReply(asked, lastSaid) |
| `src/lib/assistant/dispatch.ts` | recruit branch first; `recruit?: true` on AnyAnswer |
| `src/lib/chat/record.ts` | EventKind += "recruit_interest" |
| `src/lib/facebook/conversation.ts`, `src/lib/line/conversation.ts` | record + openLead for recruit answers |
| `src/lib/crm/plans.ts` | planName("recruit") = "หาทีม" |
| `tests/content/recruit.test.ts`, `tests/content/policy.test.ts`, `tests/chat/recruit.test.ts` | tests |

---

### Task 1: recruit.ts — topics, prompt, parser, poster

- [ ] Write `tests/content/recruit.test.ts`:
  - every topic has id, label, brief; ids unique; 8 topics
  - `recruitTones("", 3)` gives three different tones; a picked tone repeats with different openers
  - `recruitSystem("post")` contains the no-income rule, the no-age/gender rule, "คปภ.", neutral-voice rule, and the JSON shape
  - `recruitMessages(topic, tone, reader)` carries the topic brief and the reader line
  - `parseRecruitPiece(reply, topic, "post")`: hook/body required; poster badge is "ร่วมทีม"; footer defaults to the chat line; `fact` is the topic brief; ad has no hashtags and `ad.tone === "หาทีม"`; script has no poster
  - `strayNumbers` flags "50,000" in a piece against a brief that has none
- [ ] Run `npx vitest run tests/content/recruit.test.ts` → FAIL (module missing)
- [ ] Implement `src/lib/content/recruit.ts`
- [ ] Run → PASS
- [ ] Commit (after `npm run verify`)

### Task 2: recruit policy rules

- [ ] Add to `tests/content/policy.test.ts`:
  - `checkPolicy("รายได้เดือนละ 50,000 บาท", { recruit: true })` → `income_promise`
  - "รายได้หลักแสน" → `income_promise`; "การันตีรายได้" → `income_guarantee`
  - "รับสมัครเฉพาะผู้หญิง" / "อายุ 25-35 ปี สมัครได้" → `hire_filter`
  - "หาดาวน์ไลน์" → `mlm`; "งานสบาย รวยเร็ว" → `easy_money` (warn)
  - "รายได้ขึ้นกับผลงาน" → []
  - without `{ recruit: true }` the income line is not flagged (plan posts quote premiums)
- [ ] Run → FAIL
- [ ] Implement in `policy.ts`; `flagsFor(..., recruit)` in actions.ts for edits
- [ ] Run → PASS; commit

### Task 3: runner + server action + form + tab

- [ ] `recruit-run.ts` `writeRecruit({ topic, custom, reader, tone, format, length, count, writer })` — same budget hold/fallback/save loop as `writeClaim`, policy with `{ recruit: true }`, yardstick = topic brief
- [ ] `generateRecruit` server action in actions.ts with the 10-an-hour limiter
- [ ] `RecruitTools.tsx`: topic select (+ พิมพ์เอง), reader chips (5 groups + ทุกคน), format, length, tone, count 1–3, painter, person, writer, estimate, press
- [ ] ContentStudio: `mode` += "recruit", 3-column switch, nameOf, filter option; calendar name
- [ ] `npm run verify`; open /content in the preview, switch to หาทีม, check the form renders and has no console errors; commit

### Task 4: poster photo prompt

Covered in Task 1's `recruitSystem` (imagePrompt asks for a work scene) and `recruitPoster` (badge ร่วมทีม). Verified in the browser in Task 3 with one real round (owner's budget, ~฿0.5).

### Task 5: chat hand-over

- [ ] `tests/chat/recruit.test.ts`:
  - wantsToJoin true: "อยากเป็นตัวแทนครับ", "สนใจร่วมทีม", "สมัครตัวแทนยังไง", "รับสมัครตัวแทนไหม", "อยากสอบใบอนุญาตตัวแทน"
  - wantsToJoin false: "ขอคุยกับตัวแทน", "ตัวแทนโทรมาแล้ว", "สนใจสมัคร", "สมัครประกันยังไง", "ติดต่อตัวแทนได้ที่ไหน"
  - recruitReply(first ask) → hand-over bubbles, `recruit: true`
  - recruitReply("ทำงานบริษัทครับ", lastSaid = the hand-over question) → thanks bubble, `recruit: true`
  - recruitReply("เบี้ยเท่าไหร่", lastSaid = hand-over question) → null (a question goes to the normal brains)
- [ ] Run → FAIL; implement `src/lib/assistant/recruit.ts`; wire dispatch + both handlers + EventKind + planName
- [ ] Run → PASS; `npm run verify`; commit; push
