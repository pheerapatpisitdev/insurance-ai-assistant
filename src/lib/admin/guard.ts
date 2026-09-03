import { isSignedIn } from "./session";

/** Throws unless the caller holds a valid admin session. Use at the top of every action. */
export async function requireAdmin(): Promise<void> {
  if (!(await isSignedIn())) throw new Error("ไม่มีสิทธิ์ กรุณาเข้าสู่ระบบใหม่");
}
