import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "AVST | คำนวณเบี้ยประกัน", template: "%s | AVST" },
  description: "โปรแกรมคำนวณเบี้ยประกันสำหรับตัวแทน",
  applicationName: "AVST",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased">{children}</body>
    </html>
  );
}
