# หาทีม — recruiting content on /content, and the bot that hands it over

Owner, 2026-09-26. A third mode on /content beside "จากแบบประกัน" and "รีวิวเคลม".

## Decisions (owner)

- Source: a picked topic, not a true story or a photo. One press, like a plan.
- Readers: five groups — เจ้าของกิจการ, มนุษย์เงินเดือนหารายได้เสริม, คนอยากเปลี่ยนสายงาน/ทำเต็มเวลา,
  แม่บ้าน/คนอยากทำงานที่บ้าน, ตัวแทนที่มีใบอนุญาตแล้ว.
- Where an interested reader goes: ทักแชทเพจ. No /join page, no form (later, if chats come).
- Income: no figure, ever. "รายได้ขึ้นกับผลงาน" is the most a piece says.

## What the owner does

1. /content → **หาทีม** (third button in the "สร้างจาก" switch).
2. Picks a **หัวข้อ** (below) or ✏️ พิมพ์เอง; picks a **คนอ่าน** (one of the five, or ให้ AI เลือก).
3. Format โพสต์ / โฆษณา / สคริปต์, count, writer, painter, person from คลังบุคคล — as on the plan form.
4. **สร้างหาทีม N ชิ้น** → pieces land in รอตรวจ like any other: edit, proofread, post, schedule.

## Topics (RECRUIT_TOPICS)

| id | label |
|---|---|
| side | รายได้เสริมจากเวลาว่าง |
| home | ทำงานที่บ้าน / จัดเวลาเองได้ |
| switch | เปลี่ยนสายงานมาเป็นตัวแทน |
| owner | เจ้าของกิจการมาเป็นตัวแทนเอง |
| team | ทีมสอนตั้งแต่ศูนย์ + เครื่องมือ AI ช่วยขาย |
| license | ขั้นตอนสอบใบอนุญาต คปภ. |
| day | หนึ่งวันของตัวแทน |
| licensed | มีใบอนุญาตแล้ว ย้ายมาอยู่ทีม |

Each topic carries a short Thai brief (2–4 lines of what is true about it) that the writer is
given as its facts. `team` names the workbench's real tools (เครื่องคิดเบี้ย, บอทตอบแชท, ทำคอนเทนต์);
`license` states the real steps only as far as the owner has written them — no invented fee or date.

## Writing

No planner. One call per piece on the picked writer, same JSON shape as posts (hook, body,
closing, hashtags, poster). When N > 1 each piece takes a different fixed tone — เล่าชีวิตจริง,
ตอบข้อสงสัย, ชวนตรงๆ — so pieces differ without a second call.

Rules added to the prompt (RECRUIT_RULES_TH), on top of the core rules and the neutral voice:

- no income figure, no comparison to a salary, no "รายได้หลักแสน"; "รายได้ขึ้นกับผลงาน" allowed
- no requirement of age, gender, marital status, nationality or looks — anyone may read it as for them
- no get-rich-quick or MLM wording: รวยเร็ว, ไม่ต้องทำอะไร, ไม่ต้องขาย, ชวนคนมาแล้วได้เงิน, ดาวน์ไลน์, อัพไลน์
- says the work needs the คปภ. licence exam, and the team helps prepare
- ends by inviting the reader to ทักแชทเพจ with a word such as "สนใจร่วมทีม"
- never names another insurer or agency; the insurer, when named, is กรุงไทย-แอกซ่า ประกันชีวิต

## Policy check (policy.ts)

A second rule set, `RECRUIT_POLICY_RULES`, run by pattern on recruit pieces in addition to the
existing rules (so it costs nothing and re-runs after every edit):

- block `income_promise`: a baht figure or "หลักหมื่น/หลักแสน" near รายได้/เงินเดือน/ต่อเดือน
- block `income_guarantee`: การันตี/แน่นอน/ชัวร์ near รายได้
- block `hire_filter`: อายุ ‹n›–‹n›, เพศ, เฉพาะผู้หญิง/ผู้ชาย, โสด, สัญชาติ near รับ/สมัคร
- block `mlm`: ดาวน์ไลน์, อัพไลน์, ชวนคนมาแล้วได้เงิน
- warn `easy_money`: รวย, ไม่ต้องขาย, งานสบาย, ไม่ต้องทำอะไร

A blocked piece cannot be posted, as today.

## Poster

Same drawing as a plan poster. The badge reads "ร่วมทีม"; the AI photo prompt asks for a work
scene (desk, laptop, meeting a customer, a small team) — not a family or a hospital. A person
from คลังบุคคล works as it does for plans.

## Pieces

`planHref = "recruit"`, named "หาทีม" in lists and the calendar. `output.fact` holds the topic
brief so edits are checked against it again (the number check finds any figure the brief lacks).

## Chat hand-over (Messenger + LINE dispatcher)

Today a reader who writes "อยากเป็นตัวแทน" gets a sales answer. Added before the router:

- a pattern for joining intent: สนใจร่วมทีม, ร่วมทีม, อยากเป็นตัวแทน, สมัครตัวแทน, สมัครเป็นตัวแทน,
  รับสมัครตัวแทน, หางาน…ประกัน
- on a match: one fixed reply (no model call) — thanks, the team manager will message back, and one
  question "ตอนนี้ทำงานอะไรอยู่" so the owner has a starting point
- `record(... [{ kind: "recruit_interest" }], "recruit")` and `openLead(..., "interested", "recruit")`
  so the conversation shows under product "recruit" in /admin
- recruit leads are left out of the insurance follow-up queue (followup.ts)
- the bot is not silenced; it answers the next message as usual (bot-silence rule unchanged)

## Not in this round

- /join page and sign-up form
- income examples, even from real commission rates
- true stories of team members, photo input
- Facebook's "Employment" special ad category is the owner's setting in Ads Manager when a piece
  is boosted; nothing here sets it

## Order of work (one commit each, each behind `npm run verify`)

1. topics + form + tab (`src/lib/content/recruit.ts`, `src/app/content/recruit/RecruitTools.tsx`)
2. prompt + writer call (`recruit.ts`, reusing write.ts's call)
3. RECRUIT_POLICY_RULES + tests
4. poster badge and photo prompt
5. chat hand-over + followup exclusion + tests — may ship on its own
