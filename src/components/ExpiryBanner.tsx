export function ExpiryBanner({ expired, expiresOn }: { expired: boolean; expiresOn: string }) {
  if (!expired) return null;
  return (
    <div className="mb-4 rounded-md border border-red-400 bg-red-100 px-4 py-3 text-sm text-red-900">
      ตารางเบี้ยหมดอายุตั้งแต่ {expiresOn} กรุณาอัปเดตไฟล์ตารางเบี้ยจากบริษัท
    </div>
  );
}
