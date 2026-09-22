import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * Reserved, and redirecting until there is something to reserve it for.
 *
 * The owner's own way in is /admin, open at the address they type since the PIN went. This
 * address is kept for the agents: when they get accounts of their own, /login is where they
 * will sign in, and it is the word a person who is not the owner would guess.
 *
 * So this is not dead weight to be tidied away. Until that page exists it redirects, which
 * also keeps the browser histories, the bookmarks and the two Facebook routes working — a
 * saved address that 404s is a person who thinks the back office is gone.
 */
export default async function LoginPage() {
  redirect("/admin");
}
