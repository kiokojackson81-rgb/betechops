import { randomBytes } from "crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function generateReferralCode(prefix = "BETECH", length = 6) {
  const bytes = randomBytes(length);
  let suffix = "";
  for (let i = 0; i < length; i += 1) {
    suffix += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return `${prefix}-${suffix}`;
}

export default generateReferralCode;
