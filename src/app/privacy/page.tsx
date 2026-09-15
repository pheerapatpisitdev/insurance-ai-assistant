import Link from "next/link";

export const metadata = {
  title: "นโยบายความเป็นส่วนตัว | advisortool",
  description: "ข้อมูลที่เว็บไซต์คำนวณเบี้ยประกัน advisortool และผู้ช่วยตอบแชทของเพจ เก็บ ใช้ และไม่เก็บ",
};

/** Last change to what this page describes, not to its wording. */
const UPDATED = "15 กันยายน 2569";
const CONTACT = "pheerapatpisit.dev@gmail.com";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="mt-8">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      <div className="space-y-2 text-slate-700">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-semibold">นโยบายความเป็นส่วนตัว</h1>
      <p className="mt-1 text-sm text-slate-500">ปรับปรุงล่าสุด {UPDATED}</p>

      <p className="mt-6 text-slate-700">
        advisortool เป็นเว็บไซต์คำนวณเบี้ยประกันชีวิตของตัวแทน ประกอบด้วยหน้าคำนวณเบี้ยและหน้าแนะนำแบบประกัน
        และเป็นระบบที่ตอบข้อความในเพจเฟซบุ๊กของตัวแทนให้โดยอัตโนมัติ
        เอกสารนี้อธิบายว่าเราเก็บอะไร ไม่เก็บอะไร และส่งต่อให้ใครบ้าง
      </p>

      <Section id="collect" title="ข้อมูลที่เก็บ">
        <p>
          <strong>เมื่อคุณใช้หน้าคำนวณเบี้ย</strong> การคำนวณทั้งหมดเกิดขึ้นในเบราว์เซอร์ของคุณ
          อายุ เพศ และทุนประกันที่คุณเลือกไม่ถูกส่งมาที่เซิร์ฟเวอร์ และเราไม่บันทึกลงฐานข้อมูล
        </p>
        <p>
          <strong>ยกเว้นเมื่อคุณกดบันทึกรูปใบเสนอ</strong> ปุ่มนั้นสร้างรูปที่ฝั่งเซิร์ฟเวอร์
          อายุ เพศ และทุนที่เลือกจึงเดินทางไปกับลิงก์ของรูป และปรากฏอยู่ใน log ของผู้ให้บริการ
          เซิร์ฟเวอร์ตามปกติของเว็บไซต์ทั่วไป เราไม่ได้เก็บค่าเหล่านั้นลงฐานข้อมูลของเราเอง
          และถ้าคุณไม่กดปุ่มนั้น ตัวเลขของคุณก็ไม่ได้ออกจากเบราว์เซอร์เลย
        </p>
        <p>
          <strong>เมื่อคุณทักแชทเพจเฟซบุ๊ก</strong> เราเก็บข้อความในบทสนทนาไว้ไม่เกิน{" "}
          <strong>24 ชั่วโมง</strong> เพื่อให้ถามต่อเนื่องได้ว่าอ้างถึงอะไร แล้วข้อความนั้นจะถูกลบ
          ส่วนตัวตนของผู้ส่ง เราไม่ได้เก็บรหัสที่เฟซบุ๊กให้มาตรง ๆ แต่เก็บเป็นค่าที่เข้ารหัสทางเดียว
          ซึ่งใช้ต่อบทสนทนาเดิมได้อย่างเดียว และย้อนกลับเป็นตัวคุณไม่ได้
          เราไม่ได้เก็บชื่อ รูปโปรไฟล์ หรือรายชื่อเพื่อนของคุณ
        </p>
        <p>
          <strong>บันทึกว่าบทสนทนาไปถึงไหน</strong> นอกเหนือจากข้อความที่ลบใน 24 ชั่วโมง
          เราเก็บสรุปของบทสนทนาไว้เพื่อดูว่าผู้ช่วยทำงานได้ดีแค่ไหน ได้แก่ สนใจแบบประกันใด
          ได้รับใบเสนอหรือไม่ ตัวเลขในใบเสนอนั้น (อายุ เพศ ทุน และเบี้ย) กดขอสมัครหรือไม่
          ตัวแทนเข้ามาตอบเองหรือไม่ และมาจากโฆษณาชิ้นใด <strong>บันทึกนี้ไม่มีข้อความของคุณอยู่เลย</strong>{" "}
          มีแต่ประเภทของเหตุการณ์กับตัวเลข และผูกกับค่าที่เข้ารหัสทางเดียวเช่นเดิม
          สรุประดับบทสนทนาเก็บไว้ไม่มีกำหนด ส่วนรายละเอียดรายเหตุการณ์ถูกลบเมื่อเก่ากว่า 13 เดือน
          และค่าที่เข้ารหัสทางเดียวจะถูกล้างเมื่อไม่มีการติดต่อเกิน 90 วัน
        </p>
        <p>
          <strong>คำถามที่ผู้ช่วยตอบไม่ได้</strong> ถูกเก็บไว้ 30 วันในรูปประโยคที่ระบบเรียบเรียงใหม่
          เพื่อนำไปปรับปรุงคำตอบ โดยไม่ผูกกับตัวคุณหรือบทสนทนาใด
        </p>
        <p>
          <strong>เมื่อคุณได้รับใบเสนอเบี้ยประกัน</strong> เราจะเก็บรหัสผู้ใช้ที่เฟซบุ๊กให้มา
          ไว้ชั่วคราวในรูปแบบที่เข้ารหัสไว้ เพื่อส่งข้อความติดตามให้คุณ <strong>ไม่เกินสองครั้ง</strong>{" "}
          ครั้งแรกประมาณห้านาทีหลังได้รับใบเสนอ และครั้งที่สองก่อนครบ 24 ชั่วโมง เฉพาะช่วงเวลากลางวัน
          รหัสนั้นจะถูกลบทิ้งทันทีที่ส่งข้อความครั้งที่สองแล้ว ลบทันทีถ้าคุณตอบกลับมาก่อน
          หรือถ้าตัวแทนเข้ามาตอบเอง และลบอัตโนมัติภายใน 24 ชั่วโมงไม่ว่ากรณีใด
          เราไม่ส่งข้อความติดตามเกินสองครั้ง และไม่ใช้รหัสนั้นเพื่อการอื่น
        </p>
        <p>
          <strong>เมื่อคุณกดว่าสนใจสมัคร</strong> เราจะเก็บรหัสผู้ใช้ที่เฟซบุ๊กให้มาไว้ในรูปแบบที่เข้ารหัส
          เพื่อให้ตัวแทนติดต่อกลับไปดูแลขั้นตอนต่อได้ เก็บไว้จนกว่าเรื่องจะจบและอีก 180 วันหลังจากนั้น
          <strong> ขอให้ลบก่อนได้ทุกเมื่อ</strong> ตามวิธีในหัวข้อ &ldquo;สิทธิของคุณ&rdquo; ด้านล่าง
        </p>
        <p>
          <strong>ชื่อและรูปโปรไฟล์</strong> เราไม่ได้เก็บไว้ในระบบของเรา แต่เมื่อตัวแทนเปิดหน้าจัดการภายใน
          เพื่อดูว่ามีใครรอติดต่อกลับบ้าง หน้านั้นจะขอชื่อและรูปของคุณจากเฟซบุ๊กมาแสดงในขณะนั้น
          แล้วไม่ได้บันทึกเก็บไว้ — เป็นข้อมูลชุดเดียวกับที่ตัวแทนเห็นอยู่แล้วในกล่องข้อความของเพจ
        </p>
        <p>
          <strong>บันทึกค่าใช้จ่ายของระบบ</strong> เก็บเพียงจำนวนคำที่ประมวลผลและค่าใช้จ่ายเป็นเงินบาท
          ไม่มีข้อความของคุณอยู่ในบันทึกนั้น
        </p>
        <p>
          <strong>เราไม่มีระบบสมาชิกสำหรับผู้เข้าชม</strong> ไม่ต้องสมัคร ไม่ต้องเข้าสู่ระบบ
          และไม่ตั้งคุกกี้เพื่อติดตามคุณ คุกกี้เพียงตัวเดียวของเว็บไซต์นี้ใช้สำหรับหน้าจัดการภายในของตัวแทนเอง
          ซึ่งผู้เข้าชมทั่วไปไม่ได้ใช้
        </p>
      </Section>

      <Section id="never" title="ข้อมูลที่ไม่เก็บและไม่ถาม">
        <p>
          เว็บไซต์นี้ไม่ถามและไม่เก็บชื่อ เบอร์โทร อีเมล เลขบัตรประชาชน เลขกรมธรรม์ ประวัติการรักษาพยาบาล
          ข้อมูลบัตรเครดิต หรือข้อมูลการชำระเงินใด ๆ
        </p>
        <p>
          เมื่อคุณตัดสินใจสมัคร ผู้ช่วยจะส่งลิงก์แบบฟอร์มใบคำขอให้กรอกเอง แบบฟอร์มนั้นเป็นระบบแยกต่างหาก
          ข้อมูลที่กรอกในแบบฟอร์มไม่ผ่านและไม่ถูกเก็บโดยเว็บไซต์นี้หรือผู้ช่วยในแชท
        </p>
        <p>
          ผู้ช่วยที่ตอบในแชทก็ไม่ถามสิ่งเหล่านี้เช่นกัน ไม่รับสมัครทำประกัน และไม่รับรองผลการพิจารณารับประกัน
          หากคุณพิมพ์ข้อมูลเหล่านี้เข้ามาเอง ข้อความนั้นจะถูกลบพร้อมบทสนทนาภายใน 24 ชั่วโมง
        </p>
      </Section>

      <Section id="share" title="ส่งต่อให้ใครบ้าง">
        <p>
          เว็บไซต์นี้ให้บริการผ่าน <strong>Vercel</strong> ผู้ให้บริการเซิร์ฟเวอร์
          ซึ่งเห็นข้อมูลทางเทคนิคของการเข้าชมตามปกติของเว็บไซต์ทั่วไป เช่น ที่อยู่ IP และชนิดเบราว์เซอร์
        </p>
        <p>
          <strong>ข้อความที่ทักเข้ามาในแชท</strong> ส่งผ่าน <strong>Meta (Facebook Messenger)</strong>{" "}
          ตามปกติของบริการนั้น และถูกส่งต่อให้ <strong>ผู้ให้บริการโมเดลภาษา</strong> เพื่ออ่านว่าคำถามคืออะไร
          และช่วยเรียบเรียงคำตอบ ผู้ให้บริการที่ระบบเลือกใช้เป็นรายใดรายหนึ่งใน Google, OpenAI, Anthropic,
          xAI หรือ Z.ai ขึ้นกับการตั้งค่าในขณะนั้น เราส่งเฉพาะข้อความในบทสนทนา ไม่ส่งตัวตนของคุณไปด้วย
        </p>
        <p>
          <strong>ตัวเลขเบี้ยประกันไม่ได้มาจากโมเดลภาษา</strong> แต่คำนวณในระบบของเราเองจากตารางเบี้ยของบริษัทประกัน
        </p>
        <p>เราไม่ใช้ข้อมูลของคุณเพื่อโฆษณา ไม่ขาย และไม่แลกเปลี่ยนกับบุคคลที่สาม และเปิดเผยข้อมูลเมื่อมีคำสั่งตามกฎหมายเท่านั้น</p>
      </Section>

      <Section id="rights" title="สิทธิของคุณ">
        <p>
          ผู้ที่ใช้หน้าคำนวณเบี้ยอย่างเดียวไม่มีข้อมูลอยู่กับเราเลย จึงไม่มีอะไรให้ลบ
        </p>
        <p>
          ผู้ที่ทักแชทเพจ <strong>ข้อความ</strong>จะหมดอายุและถูกลบเองภายใน 24 ชั่วโมง
          ส่วน<strong>สรุปว่าบทสนทนาไปถึงไหน</strong>และ<strong>รหัสที่เข้ารหัสไว้</strong>{" "}
          อยู่นานกว่านั้นตามที่อธิบายไว้ข้างบน
        </p>
        <p>
          <strong>คุณขอให้ลบได้ทุกเมื่อ</strong> ส่งอีเมลมาที่{" "}
          <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>{" "}
          พร้อมบอกว่าทักเข้ามาจากเพจใดและช่วงเวลาไหน เมื่อตรวจสอบได้ว่าเป็นคุณจริง
          เราจะลบทั้งสรุปบทสนทนา รายการเหตุการณ์ และรหัสที่เข้ารหัสไว้ทั้งหมดของคุณ ภายใน 30 วัน
          และแจ้งกลับเมื่อทำเสร็จ การลบนี้ทำให้ตัวแทนติดต่อคุณกลับผ่านระบบนี้ไม่ได้อีก
        </p>
        <p>
          คุณขอทราบได้เช่นกันว่ามีอะไรของคุณเก็บอยู่บ้าง โดยใช้วิธีติดต่อเดียวกัน
          ส่วนสำเนาข้อความที่อยู่ในระบบของเฟซบุ๊กเอง ลบได้จากหน้าแชทของคุณ
        </p>
      </Section>

      <Section id="accuracy" title="ข้อจำกัดของตัวเลข">
        <p>
          เบี้ยประกันที่คำนวณได้เป็น <strong>ตัวเลขประมาณการ</strong> จากตารางเบี้ยของบริษัทประกัน
          ใช้ประกอบการตัดสินใจเบื้องต้น ไม่ใช่ใบเสนอราคาอย่างเป็นทางการ และไม่ผูกพันการพิจารณารับประกัน
          เงื่อนไขความคุ้มครองที่แท้จริงเป็นไปตามกรมธรรม์
        </p>
      </Section>

      <Section id="contact" title="ติดต่อเรา">
        <p>
          อีเมล <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>
        </p>
      </Section>

      <hr className="mt-10 border-slate-200" />

      <section id="english" className="mt-8">
        <h2 className="mb-2 text-lg font-semibold">Privacy policy (English summary)</h2>
        <div className="space-y-2 text-slate-700">
          <p>
            advisortool is a life insurance premium calculator run by an agency in Thailand.
          </p>
          <p>
            <strong>What we keep.</strong> From the calculator, nothing: it runs in your browser, and the
            age, sex and sum assured you choose are never sent to us. There are no visitor accounts and no
            tracking cookies — the site&rsquo;s only cookie belongs to the agency&rsquo;s own admin page.
            From a chat with the agency&rsquo;s Facebook Page, the message text is kept for at most 24 hours
            so that follow-up questions make sense, then deleted. The sender is stored only as a one-way
            hash of the page-scoped id, which cannot be turned back into a person.
          </p>
          <p>
            <strong>What we keep for longer.</strong> A record of how far a conversation got — which plan,
            whether a premium was quoted and its figures, whether you asked to apply, and which advert
            brought you — with <strong>none of your words in it</strong>. Conversation-level figures are kept
            indefinitely; per-event detail is deleted after 13 months, and the one-way hash is cleared after
            90 days without contact. If you ask to apply, your page-scoped id is kept encrypted so the agent
            can follow up. Your name and photo are never stored: the agency&rsquo;s own admin page asks
            Facebook for them at the moment it is opened.
          </p>
          <p>
            <strong>Deletion.</strong> Write to the address below from the Page you messaged, and once we can
            confirm it is you we delete your conversation record, its events and the stored id within 30 days.
          </p>
          <p>
            <strong>Who else sees it.</strong> The site is served from Vercel, which sees the ordinary
            technical details of a visit such as IP address and browser type. Messages sent to the Page pass
            through Meta, and their text is sent to a language-model provider — one of Google, OpenAI,
            Anthropic, xAI or Z.ai, depending on the current setting — to read the question and word the
            reply. Premiums are not model output: they are computed from the insurer&rsquo;s rate tables in
            our own code. We do not use your data for advertising, and we do not sell or trade it.
          </p>
          <p>
            <strong>Accuracy.</strong> Premiums are estimates taken from the insurer&rsquo;s rate tables.
            They are not a formal quotation and do not bind underwriting.
          </p>
          <p>
            Questions: <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>
          </p>
        </div>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/" className="text-slate-500 underline">กลับไปหน้าคำนวณเบี้ย</Link>
      </p>
    </main>
  );
}
