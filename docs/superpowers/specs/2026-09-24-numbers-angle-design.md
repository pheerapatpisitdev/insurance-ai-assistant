# มุม "ตัวเลขชัดๆ" — design

Owner request, 2026-09-24. A Facebook post that sells on figures alone, in the owner's example:

```
ประกันชีวิตทุน 1,000,000 บาท
เบี้ย 1,548 บาท ต่อเดือน
ตกวันละ 48 บาท
เบี้ยไม่ทิ้ง
เบี้ยไม่เพิ่ม
```

The example is exact: Life Protect x 2, male 35, 1,000,000, paying to 99 — 17,200 a year, 1,548 a
month, and 17,200 ÷ 365 = 47.12 rounded up to 48, which is how the sales pages say เบี้ยเฉลี่ยวันละ.

## Decisions (owner, in this order)

1. **No input from the owner.** The plan is already picked on the form, and the app already
   prices every plan; the engine chooses the case.
2. **Cases vary by piece (B).** Each plan carries 3 preset cases; piece *n* of a round uses case
   *n* (wrapping), so a round of three shows three different people.
3. **Claim lines from a fixed, owner-approved list per plan (A).** The model never writes a
   "เบี้ยไม่เพิ่ม" of its own. A line that is false for a plan (Protection Life is term — its
   premium is not "ไม่ทิ้ง"; Legacy, CI 123 and Cancer rise with age) is simply not on its list.
4. **Short and complete (A).** Figures, 2–3 claim lines, the case in brackets, one chat line.
5. **Hybrid (3).** Code lays down every figure; the model writes only one headline line above
   them, and that line may carry no digit — if it does, a fixed fallback headline is used.

## Shape of a piece

```
[headline — model, no digits]
<plan word> ทุน {sum} บาท            ← e.g. ประกันชีวิตทุน / ประกันโรคร้ายแรงทุน / บำนาญเดือนละ
เบี้ย {monthly} บาท ต่อเดือน          ← "เบี้ยปีแรก …" for plans whose premium rises
ตกวันละ {ceil(annual / 365)} บาท
{claim line}
{claim line}
({sex} {age} ปี จ่าย{term})
ทักแชทเช็กเบี้ยตามอายุคุณ
```

- Poster: the monthly premium is the big line; sum and per-day under it.
- The existing checks run unchanged: the stray-number check (the brief handed to the model now
  carries the case's figures, so the numbers the code wrote are in it) and the Facebook policy
  gate. The disclaimer footer is kept.
- Format: posts only. Ads and video scripts do not offer this angle.

## Plans

All ten content plans. **iHealthy Ultra is priced as the Health Ultra Package** (WLF99HX base
at its fixed sum + the IHU plan + the standard daily-cash rider, as `ihealthy-table.ts` sells
it): the owner lifted "โพสต์นี้ห้ามระบุเบี้ย" for this angle on 2026-09-24. Its premium rises
with age, so it always reads เบี้ยปีแรก, for the package as a whole. Group insurance is not a
content plan.

## For the owner to review — cases and claim lines

Figures are not written here on purpose: each is computed by the plan's engine at build time.
The claim lines are drawn only from each sales page's points and cautions already in
`src/lib/content/products.ts`.

| Plan | Cases (piece 1 / 2 / 3) | Claim lines the post may use |
|---|---|---|
| Life Protect x 2 | ชาย 35 ทุน 1 ล้าน จ่ายถึง 99 · หญิง 30 ทุน 5 แสน จ่าย 19 ปี · ชาย 45 ทุน 1 ล้าน จ่าย 19 ปี | เบี้ยไม่เพิ่ม · เบี้ยไม่ทิ้ง คุ้มครองถึงอายุ 99 · จ่ายจบได้ใน 9 หรือ 19 ปี — and the post leads with the doubled sum: "ประกันชีวิตคุ้มครอง 2,000,000 บาท / (ทุน 1,000,000 บาท × 2 เมื่อเสียชีวิตก่อนอายุ 60)" (owner, 2026-09-24) |
| Protection Life | ชาย 35 ทุน 1 ล้าน 10 ปี · หญิง 30 ทุน 1 ล้าน 10 ปี · ชาย 40 ทุน 3 ล้าน 15 ปี | เบี้ยไม่เพิ่มตลอดสัญญา · จ่ายมีวันจบ · ทุนยิ่งสูง เบี้ยต่อล้านยิ่งถูก · เสียชีวิตระหว่างสัญญา ครอบครัวรับเต็มทุน |
| Easy Protect 6 | ชาย 35 ทุน 5 แสน · หญิง 30 ทุน 5 แสน · ชาย 45 ทุน 1 ล้าน | จ่ายเบี้ยแค่ 6 ปี · คุ้มครองถึงอายุ 99 · เบี้ยไม่ทิ้ง มูลค่าเวนคืนโตทุกปี · เบี้ยล็อกตามอายุวันที่ทำ |
| Life Treasure | ชาย 45 ทุน 10 ล้าน จ่าย 12 ปี · หญิง 40 ทุน 10 ล้าน จ่าย 12 ปี · ชาย 55 ทุน 20 ล้าน จ่าย 6 ปี | เงินก้อนระบุจำนวนไว้ล่วงหน้า ไม่ขึ้นกับตลาด · แบ่งให้ใครเท่าไรระบุได้ · คุ้มครองถึงอายุ 99 · ส่งต่อได้ {n} เท่าของเบี้ย |
| มรดกเพื่อครอบครัว | หญิง 30 แผน 1 ล้าน · ชาย 35 แผน 1 ล้าน · หญิง 45 แผน 1 ล้าน | ป่วยโรคร้ายแรงรับเงินสด {…} บาท · เสียชีวิตก่อน 60 รับ {…} บาท · คุ้มครอง 31 โรค · *เบี้ยปีแรก* |
| iShield | ชาย 35 ทุน 1 ล้าน จ่าย 10 ปี · หญิง 30 ทุน 5 แสน จ่าย 20 ปี · ชาย 45 ทุน 1 ล้าน จ่าย 15 ปี | เบี้ยไม่เพิ่ม · คุ้มครอง 70 โรค เจอระยะเริ่มต้นก็ได้เงิน · ไม่ป่วยก็ไม่เสียเปล่า ครบสัญญารับคืนเต็มทุน |
| CI 123 | หญิง 30 ทุน 5 แสน · ชาย 35 ทุน 1 ล้าน · หญิง 45 ทุน 1 ล้าน | คุ้มครอง 122 โรค · เจอระยะแรกก็ได้เงิน · เคลมระยะแรกแล้ว ยังเคลมระยะถัดไปได้ · *เบี้ยปีแรก* |
| ชุดประกันมะเร็ง | หญิง 30 ทุน 3 แสน · ชาย 35 ทุน 1 ล้าน · หญิง 45 ทุน 1 ล้าน | เจอมะเร็งระยะแรกก็ได้เงินก้อน · นอนโรงพยาบาลรับชดเชยรายวัน · เงินก้อนเอาไปใช้อะไรก็ได้ · *เบี้ยปีแรก* |
| iHealthy Ultra (แพ็กเกจสุขภาพ) | หญิง 30 แผน 3 ล้าน (SMART) · ชาย 35 แผน 10 ล้าน (BRONZE) · หญิง 45 แผน 15 ล้าน (SILVER) | วงเงินค่ารักษาปีละ {annualMax} บาท · เหมาจ่ายค่ารักษาต่อปี · ต่ออายุได้ถึงอายุ 98 · ไม่เคลม 3 ปีติดต่อกัน ลดเบี้ย 10% · *เบี้ยปีแรก รวมทั้งแพ็กเกจ* |
| บำนาญ สมาร์ท 95 | ชาย 40 บำนาญเดือนละ 10,000 ตั้งแต่ 60 · หญิง 35 เดือนละ 5,000 ตั้งแต่ 60 · ชาย 45 เดือนละ 10,000 ตั้งแต่ 60 | รับบำนาญถึงอายุ 95 · รับประกันจ่าย 15 ปีแรก · บำนาญเพิ่มเป็นขั้นตามอายุ · ลดหย่อนภาษีได้ตามเงื่อนไขสรรพากร |

A case the engine cannot price (age outside the table, a lapsed rate table) is skipped for the
next one; if a plan has none left, the angle reports that instead of writing a piece without
figures.

## Testing

- Unit: each plan's cases all price today; the per-day figure is `ceil(annual / 365)`; the
  built text contains only figures present in the brief; a headline with a digit falls back.
- Rising-premium plans always say เบี้ยปีแรก.
- One live round per plan in the browser before it ships.
