import Link from "next/link";

export const metadata = {
  title: "นโยบายความเป็นส่วนตัว | advisortool",
  description: "ข้อมูลที่เว็บไซต์คำนวณเบี้ยประกัน advisortool เก็บ ใช้ และไม่เก็บ",
};

/** Last change to what this page describes, not to its wording. */
const UPDATED = "11 กันยายน 2569";
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
        เอกสารนี้อธิบายว่าเราเก็บอะไร ไม่เก็บอะไร และส่งต่อให้ใครบ้าง
      </p>

      <Section id="collect" title="ข้อมูลที่เก็บ">
        <p>
          <strong>เมื่อคุณใช้หน้าคำนวณเบี้ย</strong> การคำนวณทั้งหมดเกิดขึ้นในเบราว์เซอร์ของคุณ
          อายุ เพศ และทุนประกันที่คุณเลือกไม่ถูกส่งมาที่เซิร์ฟเวอร์และไม่ถูกบันทึก
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
      </Section>

      <Section id="share" title="ส่งต่อให้ใครบ้าง">
        <p>
          เว็บไซต์นี้ให้บริการผ่าน <strong>Vercel</strong> ผู้ให้บริการเซิร์ฟเวอร์
          ซึ่งเห็นข้อมูลทางเทคนิคของการเข้าชมตามปกติของเว็บไซต์ทั่วไป เช่น ที่อยู่ IP และชนิดเบราว์เซอร์
        </p>
        <p>เราไม่ใช้ข้อมูลของคุณเพื่อโฆษณา ไม่ขาย และไม่แลกเปลี่ยนกับบุคคลที่สาม และเปิดเผยข้อมูลเมื่อมีคำสั่งตามกฎหมายเท่านั้น</p>
      </Section>

      <Section id="rights" title="สิทธิของคุณ">
        <p>
          เนื่องจากเราไม่ได้เก็บข้อมูลส่วนบุคคลของผู้เข้าชม จึงไม่มีข้อมูลให้ลบหรือแก้ไข
          หากมีข้อสงสัยเกี่ยวกับความเป็นส่วนตัว ส่งอีเมลมาที่{" "}
          <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>
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
            <strong>What we keep.</strong> Nothing about you. Premium calculations run in your browser;
            the age, sex and sum assured you choose are never sent to us. There are no visitor accounts and
            no tracking cookies — the site&rsquo;s only cookie belongs to the agency&rsquo;s own admin page.
          </p>
          <p>
            <strong>Who else sees it.</strong> The site is served from Vercel, which sees the ordinary
            technical details of a visit such as IP address and browser type. We do not use your data for
            advertising, and we do not sell or trade it.
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
