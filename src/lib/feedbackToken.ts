import { randomBytes } from "node:crypto";

const TOKEN_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const DEFAULT_TOKEN_LENGTH = 5;

export function generateFeedbackToken(length = DEFAULT_TOKEN_LENGTH) {
  const tokenLength = Math.max(5, Math.min(8, Math.floor(length)));
  const bytes = randomBytes(tokenLength);
  let token = "";
  for (let index = 0; index < tokenLength; index += 1) {
    token += TOKEN_ALPHABET[bytes[index] % TOKEN_ALPHABET.length];
  }
  return token;
}
