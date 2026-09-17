import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Kept as a signpost, not a page.
 *
 * The PIN is asked for at /admin now, which is the address the owner types. This one still
 * answers because it is in browser histories, in bookmarks, and in the two Facebook routes
 * that send an unauthenticated admin back to sign in — and a saved address that 404s is a
 * person who thinks the back office is gone.
 */
export default async function LoginPage() {
  redirect("/admin");
}
