import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const MAGIC = Buffer.from("BETECH-DOC-1\n");
function key() {
  const secret = process.env.DOCUMENT_ENCRYPTION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("Document encryption is not configured.");
  return createHash("sha256").update(`betech-documents:${secret}`).digest();
}
export function encryptDocument(bytes: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return Buffer.concat([MAGIC, iv, cipher.getAuthTag(), encrypted]);
}
export function decryptDocument(bytes: Buffer): Buffer<ArrayBuffer> {
  // Existing issued PDFs remain readable until their storage migration.
  if (!bytes.subarray(0, MAGIC.length).equals(MAGIC)) return Buffer.from(bytes);
  const offset = MAGIC.length;
  const decipher = createDecipheriv("aes-256-gcm", key(), bytes.subarray(offset, offset + 12));
  decipher.setAuthTag(bytes.subarray(offset + 12, offset + 28));
  return Buffer.concat([decipher.update(bytes.subarray(offset + 28)), decipher.final()]);
}
