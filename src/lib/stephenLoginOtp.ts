import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { generateOtpCode, hashOtpCode } from "@/lib/phoneOtpAuth";
import { normalizeKenyanPhone } from "@/lib/phone";

// This is deliberately a narrowly-scoped second factor. Keep the values in
// environment variables in production; the fallbacks preserve the requested
// protection until those variables are configured.
export const STEPHEN_OTP_USER_ID =
  process.env.STEPHEN_LOGIN_OTP_USER_ID || "cmimxqfgo0004v5mc5pn1r486";
export const STEPHEN_OTP_EMAIL = "stephen@betech.co.ke";
export const STEPHEN_OTP_PHONE =
  normalizeKenyanPhone(process.env.STEPHEN_LOGIN_OTP_PHONE || "0722607174") || "+254722607174";

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_ATTEMPT_LIMIT = 5;

function storageKey() {
  return `password-login:${STEPHEN_OTP_USER_ID}`;
}

export function isStephenOtpProtectedUser(user: { id?: string | null; email?: string | null }) {
  return user.id === STEPHEN_OTP_USER_ID || String(user.email || "").trim().toLowerCase() === STEPHEN_OTP_EMAIL;
}

export async function createStephenLoginOtp() {
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);
  const key = storageKey();
  const [, challenge] = await prisma.$transaction([
    prisma.otpCode.updateMany({ where: { phone: key, used: false }, data: { used: true } }),
    prisma.otpCode.create({
      data: { phone: key, codeHash: hashOtpCode(key, code), expiresAt },
    }),
  ]);
  return { challengeId: challenge.id, code, expiresAt };
}

export async function verifyStephenLoginOtp(challengeId: string, codeInput: string) {
  const code = String(codeInput || "").trim();
  if (!/^\d{6}$/.test(code)) throw new Error("Enter the 6-digit code we sent.");

  const challenge = await prisma.otpCode.findFirst({
    where: { id: String(challengeId || ""), phone: storageKey(), used: false },
  });
  if (!challenge || challenge.expiresAt.getTime() < Date.now()) {
    if (challenge) await prisma.otpCode.update({ where: { id: challenge.id }, data: { used: true } });
    throw new Error("This code has expired. Sign in again to receive a new one.");
  }

  const expected = hashOtpCode(storageKey(), code);
  const matches = crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(challenge.codeHash));
  if (!matches) {
    const attempts = challenge.attempts + 1;
    await prisma.otpCode.update({
      where: { id: challenge.id },
      data: { attempts, used: attempts >= OTP_ATTEMPT_LIMIT },
    });
    throw new Error(attempts >= OTP_ATTEMPT_LIMIT ? "Too many incorrect attempts. Sign in again." : "The code is incorrect.");
  }

  await prisma.otpCode.update({ where: { id: challenge.id }, data: { used: true } });
  return STEPHEN_OTP_USER_ID;
}

export function maskedStephenOtpPhone() {
  return `${STEPHEN_OTP_PHONE.slice(0, 5)}***${STEPHEN_OTP_PHONE.slice(-3)}`;
}
