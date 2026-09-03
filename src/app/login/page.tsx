import { redirect } from "next/navigation";
import { isSignedIn, pinIsConfigured } from "@/lib/admin/session";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (pinIsConfigured() && (await isSignedIn())) redirect("/admin/ai");
  return <LoginForm configured={pinIsConfigured()} />;
}
