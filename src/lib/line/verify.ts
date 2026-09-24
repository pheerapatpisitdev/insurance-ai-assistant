import crypto from "crypto";

/**
 * LINE signs every webhook body with the channel secret. Anyone can POST to a public URL, so
 * an unsigned or wrongly signed request is not from LINE and is refused.
 */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!secret || !signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * LINE user ids identify a person, so they are never stored as given. The hash is stable for
 * the same user, which is all a conversation needs, and useless without the secret.
 */
export function hashUserId(userId: string): string {
  const secret = process.env.LINE_CHANNEL_SECRET ?? "";
  return crypto.createHmac("sha256", secret).update(`line:${userId}`).digest("hex");
}
