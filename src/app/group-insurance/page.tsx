import type { Metadata } from "next";
import { AppShell } from "@/components/shell/AppShell";
import { GroupInsurance } from "@/components/group-insurance/GroupInsurance";

/**
 * ประกันภัยกลุ่ม — the sixth thing this system sells, and the first one sold to a company.
 *
 * The page itself is a server component holding nothing but the shell and the description,
 * so it prerenders and is served from the edge like the sales pages: an agent opens this in
 * front of an HR manager, sometimes on a phone in a lobby, and the first paint should not
 * wait on a session lookup. Everything that moves is in `GroupInsurance`.
 *
 * `signedIn` is not passed, for the reason `AppShell` gives at length — asking the session a
 * question here would make the page dynamic and cost every visitor a server round trip
 * forever, to show a sign-out button to somebody who never signed in.
 */
export const metadata: Metadata = {
  title: "ประกันภัยกลุ่ม — Group Insurance",
  description: "ประกันกลุ่มสำหรับองค์กร — คำนวณเบี้ยหลายกลุ่มและออกใบเสนอราคาได้ทันที",
};

export default function GroupInsurancePage() {
  return (
    <AppShell>
      <GroupInsurance />
    </AppShell>
  );
}
