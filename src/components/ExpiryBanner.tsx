export function ExpiryBanner({ expired, expiresOn }: { expired: boolean; expiresOn: string }) {
  if (!expired) return null;
  return (
    <div className="mb-4 rounded-md border border-[var(--bot-red)] bg-[var(--bot-red-soft)] px-4 py-3 text-sm text-[var(--bot-red-ink)]">
      ตารางเบี้ยหมดอายุตั้งแต่ {expiresOn} กรุณาอัปเดตไฟล์ตารางเบี้ยจากบริษัท
    </div>
  );
}
