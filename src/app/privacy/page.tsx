import Link from "next/link";

export const metadata = {
  title: "นโยบายความเป็นส่วนตัว | advisortool",
  description: "ข้อมูลที่เว็บไซต์คำนวณเบี้ยประกัน advisortool และผู้ช่วยตอบแชทของเพจ เก็บ ใช้ และไม่เก็บ",
};

/** Last change to what this page describes, not to its wording. */
const UPDATED = "14 กันยายน 2569";
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
          อายุ เพศ และทุนประกันที่คุณเลือกไม่ถูกส่งมาที่เซิร์ฟเวอร์และไม่ถูกบันทึก
        </p>
        <p>
          <strong>เมื่อคุณทักแชทเพจเฟซบุ๊ก</strong> เราเก็บข้อความในบทสนทนาไว้ไม่เกิน{" "}
          <strong>24 ชั่วโมง</strong> เพื่อให้ถามต่อเนื่องได้ว่าอ้างถึงอะไร แล้วงานอัตโนมัติรายชั่วโมงจะลบข้อความนั้น
          ส่วนตัวตนของผู้ส่ง เราไม่ได้เก็บรหัสที่เฟซบุ๊กให้มาตรง ๆ แต่เก็บเป็นค่าที่เข้ารหัสทางเดียว
          ซึ่งใช้ต่อบทสนทนาเดิมได้อย่างเดียว และย้อนกลับเป็นตัวคุณไม่ได้
          เราไม่ได้เก็บชื่อ รูปโปรไฟล์ หรือรายชื่อเพื่อนของคุณ
        </p>
        <p>
          <strong>บันทึกของบทสนทนา</strong> เราบันทึกว่าบทสนทนาเกิดขึ้นเมื่อไหร่ มาจากโฆษณาชิ้นไหน
          และดำเนินไปถึงขั้นไหน เป็นชนิดของเหตุการณ์กับตัวเลข เช่น อายุ เพศ ทุน และเบี้ยที่ระบบคำนวณให้
          ไม่มีข้อความที่คุณพิมพ์ ตัวตนบนบันทึกนั้นเป็นค่าเข้ารหัสทางเดียวชุดเดิม และถูกลบออกจากบันทึกภายใน{" "}
          <strong>90 วัน</strong> สถิติที่เหลือโยงกลับหาใครไม่ได้
          คำถามที่ผู้ช่วยไม่มีคำตอบเตรียมไว้ ถูกเก็บเป็นประโยคที่เขียนใหม่โดยไม่มีตัวตน 30 วัน เพื่อปรับปรุงคำตอบ
        </p>
        <p>
          <strong>เมื่อคุณกดสนใจสมัครหรือขอคุยกับตัวแทน</strong> เราบันทึกรหัสห้องแชทของคุณแบบเข้ารหัส
          เพื่อให้ตัวแทนเปิดห้องแชทนี้กลับมาติดต่อได้ตามที่ผู้ช่วยแจ้งไว้ พร้อมใบเสนอราคาล่าสุดที่คุณได้รับ
          และลบรหัสนั้นเมื่อเรื่องจบไปแล้ว 180 วัน
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
          ผู้ที่ทักแชทเพจ ข้อความในบทสนทนาถูกลบโดยงานอัตโนมัติเมื่อพ้น 24 ชั่วโมง
          และตัวตนบนบันทึกของบทสนทนาถูกลบภายใน 90 วัน
          หากต้องการให้ลบก่อนหน้านั้น รวมถึงรหัสห้องแชทที่บันทึกไว้เมื่อคุณกดสนใจสมัคร
          หรืออยากทราบว่ามีอะไรเก็บอยู่ ส่งอีเมลมาที่{" "}
          <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>{" "}
          พร้อมบอกว่าทักเข้ามาจากเพจใดและเมื่อใด เราจะลบให้ทันทีที่ตรวจสอบได้
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
            From a chat with the agency&rsquo;s Facebook Page, the conversation is kept for at most 24 hours
            so that follow-up questions make sense, then deleted by an hourly job. The sender is stored only as
            a one-way hash of the page-scoped id, which cannot be turned back into a person. We also keep a
            record of each conversation &mdash; when it happened, which advert it came from and how far it went,
            as event kinds and figures such as age, sex, sum assured and the computed premium, never your
            words &mdash; and remove the hashed sender from that record within 90 days. Questions the assistant
            had no written answer for are kept for 30 days as a stand-alone rewrite with no identity attached.
            If you ask to apply or to talk to the agent, we store your Messenger thread id encrypted so the
            agent can reopen this chat and follow up as promised, and delete it 180 days after the matter closes.
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
