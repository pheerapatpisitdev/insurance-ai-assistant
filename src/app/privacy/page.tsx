import Link from "next/link";

export const metadata = {
  title: "นโยบายความเป็นส่วนตัว | advisortool",
  description: "ข้อมูลที่ผู้ช่วยประกัน advisortool เก็บ ใช้ และไม่เก็บ",
};

/** Last change to what this page describes, not to its wording. */
const UPDATED = "4 กันยายน 2569";
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
        advisortool เป็นผู้ช่วยตอบคำถามเรื่องประกันชีวิตของตัวแทน ให้บริการผ่านเว็บไซต์นี้
        บัญชีทางการ LINE และเพจ Facebook ที่ระบุไว้ในหน้านี้ เอกสารนี้อธิบายว่าเราเก็บอะไร
        ไม่เก็บอะไร และส่งต่อให้ใครบ้าง
      </p>

      <Section id="collect" title="ข้อมูลที่เก็บ">
        <p>
          <strong>เมื่อคุณทักผ่าน LINE หรือ Messenger</strong> เราเก็บข้อความที่คุณพิมพ์และคำตอบของระบบ
          ย้อนหลังไม่เกิน 6 ข้อความ เพื่อให้ถามต่อเนื่องได้ เช่น ถามว่า &ldquo;แล้วผู้หญิงล่ะ&rdquo; แล้วระบบยังรู้ว่าพูดถึงแบบไหนอยู่
        </p>
        <p>
          <strong>รหัสผู้ใช้ของคุณไม่ได้ถูกเก็บตามจริง</strong> LINE และ Facebook ส่งรหัสประจำตัวมาให้ระบบ
          เราแปลงเป็นค่าแฮชด้วยกุญแจลับก่อนบันทึกเสมอ ค่าที่เก็บไว้ใช้ต่อบทสนทนาเดิมได้อย่างเดียว
          ย้อนกลับไปเป็นรหัสจริงหรือหาว่าเป็นบัญชีใดไม่ได้
        </p>
        <p>
          <strong>เมื่อคุณใช้หน้าคำนวณเบี้ยบนเว็บ</strong> การคำนวณทั้งหมดเกิดขึ้นในเบราว์เซอร์ของคุณ
          ตัวเลขที่กรอกไม่ถูกส่งมาที่เซิร์ฟเวอร์และไม่ถูกบันทึก
        </p>
      </Section>

      <Section id="never" title="ข้อมูลที่ไม่เก็บและไม่ถาม">
        <p>
          ระบบไม่ถามและไม่เก็บเลขบัตรประชาชน เลขกรมธรรม์ ประวัติการรักษาพยาบาล ข้อมูลบัตรเครดิต
          หรือข้อมูลการชำระเงินใด ๆ ถ้าคุณพิมพ์ข้อมูลเหล่านี้เข้ามาเอง ข้อความนั้นจะถูกลบไปพร้อมบทสนทนาตามกำหนดเวลาด้านล่าง
        </p>
        <p>
          บันทึกค่าใช้จ่ายที่เราเก็บไว้เพื่อดูต้นทุนระบบ มีเพียงจำนวนคำและค่าบริการเป็นเงินบาท
          <strong>ไม่มีข้อความของผู้ใช้อยู่ในบันทึกนั้น</strong>
        </p>
      </Section>

      <Section id="use" title="ใช้ทำอะไร">
        <p>
          ใช้ตอบคำถามของคุณอย่างเดียว ได้แก่ คำนวณเบี้ยประกันจากอายุ เพศ และทุนประกันที่คุณแจ้ง
          อธิบายเงื่อนไขของแบบประกัน และตอบคำถามจากเอกสารที่ตัวแทนอัปโหลดไว้
        </p>
        <p>เราไม่ใช้ข้อมูลของคุณเพื่อโฆษณา ไม่ขาย และไม่แลกเปลี่ยนกับบุคคลที่สาม</p>
      </Section>

      <Section id="share" title="ส่งต่อให้ใครบ้าง">
        <p>เพื่อให้ระบบทำงานได้ ข้อความของคุณถูกส่งต่อไปยังผู้ให้บริการเหล่านี้เท่าที่จำเป็น</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>ผู้ให้บริการโมเดลภาษา</strong> ได้แก่ Google, Anthropic, OpenAI, xAI และ Z.ai
            เพื่อเรียบเรียงคำตอบ ระบบเลือกใช้รายใดรายหนึ่งตามงานและความพร้อมในขณะนั้น
          </li>
          <li><strong>Supabase</strong> ฐานข้อมูลที่เก็บบทสนทนาชั่วคราวและเอกสารของตัวแทน</li>
          <li><strong>Vercel</strong> ผู้ให้บริการเซิร์ฟเวอร์ที่รันเว็บไซต์นี้</li>
          <li><strong>LINE และ Meta</strong> เจ้าของช่องทางที่คุณทักเข้ามา</li>
        </ul>
        <p>
          นอกจากนี้เราเปิดเผยข้อมูลเมื่อมีคำสั่งตามกฎหมายเท่านั้น
        </p>
      </Section>

      <Section id="keep" title="เก็บไว้นานแค่ไหน">
        <p>
          บทสนทนาถูกเก็บไว้ <strong>24 ชั่วโมง</strong> นับจากข้อความล่าสุด หลังจากนั้นระบบจะไม่อ่านบทสนทนานั้นอีก
          และไม่ใช้ในการตอบครั้งต่อไป
        </p>
        <p>
          รหัสอ้างอิงของข้อความที่ตอบไปแล้วถูกเก็บไว้เพื่อกันการตอบซ้ำเมื่อช่องทางส่งข้อความเดิมมาอีกครั้ง
          รหัสนี้ไม่มีเนื้อหาข้อความและไม่ระบุตัวบุคคล
        </p>
      </Section>

      <Section id="rights" title="สิทธิของคุณ">
        <p>
          คุณขอให้ลบบทสนทนาของคุณก่อนครบกำหนดได้ ส่งอีเมลมาที่{" "}
          <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>{" "}
          พร้อมบอกว่าคุณทักมาจากช่องทางใดและช่วงเวลาไหน เพื่อให้เราค้นหาบทสนทนาที่ถูกต้อง
        </p>
        <p>
          คุณขอทราบได้ว่าเรามีข้อมูลอะไรของคุณ ขอให้แก้ไข หรือคัดค้านการประมวลผลได้ตามกฎหมายคุ้มครองข้อมูลส่วนบุคคล
        </p>
      </Section>

      <Section id="accuracy" title="ข้อจำกัดของคำตอบ">
        <p>
          เบี้ยประกันที่ระบบคำนวณเป็น <strong>ตัวเลขประมาณการ</strong> จากตารางเบี้ยของบริษัทประกัน
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
            advisortool is an assistant that answers life insurance questions for an agency in Thailand.
            It runs on this website, on a LINE official account, and on a Facebook Page.
          </p>
          <p>
            <strong>What we keep.</strong> When you message us, we store the last six messages of the
            conversation for 24 hours so that follow-up questions make sense. The user id the platform
            sends us is never stored as given: it is hashed with a secret key first, and the stored value
            can only continue the same conversation — it cannot be turned back into your account.
            Premium calculations made on the website itself run in your browser and are never sent to us.
          </p>
          <p>
            <strong>What we never ask for or keep.</strong> National ID numbers, policy numbers, medical
            records, and payment details. Our cost log records token counts and money only, never message
            content.
          </p>
          <p>
            <strong>Who else sees it.</strong> Your message is sent to a language model provider (Google,
            Anthropic, OpenAI, xAI, or Z.ai) to compose the answer, and is stored in Supabase and served
            from Vercel. We do not use your data for advertising, and we do not sell or trade it.
          </p>
          <p>
            <strong>Deletion.</strong> Conversations are deleted 24 hours after the last message. To have
            yours removed sooner, email{" "}
            <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a> saying which channel you
            wrote from and roughly when.
          </p>
          <p>
            <strong>Accuracy.</strong> Premiums are estimates taken from the insurer&rsquo;s rate tables.
            They are not a formal quotation and do not bind underwriting.
          </p>
        </div>
      </section>

      <p className="mt-10 text-sm">
        <Link href="/" className="text-slate-500 underline">กลับไปหน้าคำนวณเบี้ย</Link>
      </p>
    </main>
  );
}
