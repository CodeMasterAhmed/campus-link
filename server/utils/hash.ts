import { createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function hashVerificationToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function compareVerificationTokenHash(token: string, expectedHash: string) {
  const provided = Buffer.from(hashVerificationToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  if (provided.length !== expected.length) {
    return false;
  }
  return timingSafeEqual(provided, expected);
}
