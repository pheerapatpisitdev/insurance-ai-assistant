import { LegacyCalculator } from "@/components/LegacyCalculator";

export const metadata = {
  title: "มรดกเพื่อครอบครัว — คำนวณเบี้ย",
  description: "เตรียมเงินก้อน 1–10 ล้านบาทให้ครอบครัว จ่ายทั้งกรณีเสียชีวิตและโรคร้ายแรง",
};

export default function LegacyPage() {
  return (
    <main className="mx-auto max-w-lg px-4 py-8">
      <h1 className="text-2xl font-semibold text-slate-900">มรดกเพื่อครอบครัว</h1>
      <p className="mt-1 mb-6 text-sm text-slate-600">
        เตรียมเงินก้อนให้คนข้างหลัง จ่ายทั้งวันที่คุณจากไป และวันที่คุณป่วยหนักแต่ยังอยู่
      </p>
      <LegacyCalculator />
    </main>
  );
}
