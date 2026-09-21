jest.mock("next/headers", () => ({ cookies: jest.fn(async () => ({ get: () => undefined })) }));
jest.mock("@/lib/prisma", () => ({ prisma: { $transaction: jest.fn(), receipt: { findFirst: jest.fn() }, commissioningSession: { findUnique: jest.fn() } } }));
import { prisma } from "@/lib/prisma";
import { createDocumentGrant, validDocumentGrant, withinDocumentWindow, DOCUMENT_ACCESS_MS, resolveDocument, issueDocumentOtp, verifyDocumentOtp, type DocumentAccess } from "@/lib/documentAccess";
import { encryptDocument, decryptDocument } from "@/lib/documentEncryption";
const now = Date.now();
const doc: DocumentAccess = { kind: "receipt", token: "rcpt_abcdefghijklmnop", receiptId: "r1", phone: "+254700000001", issuedAt: null };
beforeEach(() => { jest.clearAllMocks(); process.env.DOCUMENT_ACCESS_SECRET = "test-only-document-secret"; process.env.DOCUMENT_ENCRYPTION_SECRET = "test-only-storage-secret"; });

test("24-hour grace ends exactly at expiry and missing/future timestamps fail closed", () => {
  expect(withinDocumentWindow(new Date(now - DOCUMENT_ACCESS_MS + 1), now)).toBe(true);
  expect(withinDocumentWindow(new Date(now - DOCUMENT_ACCESS_MS), now)).toBe(false);
  expect(withinDocumentWindow(null, now)).toBe(false);
  expect(withinDocumentWindow(new Date("invalid"), now)).toBe(false);
  expect(withinDocumentWindow(new Date(now + 1000), now)).toBe(false);
});
test("verification grants expire and cannot cross tokens, receipts, or changed customer phones", () => {
  const grant = createDocumentGrant(doc, now);
  expect(validDocumentGrant(doc, grant, now)).toBe(true);
  expect(validDocumentGrant(doc, grant, now + DOCUMENT_ACCESS_MS)).toBe(false);
  expect(validDocumentGrant({ ...doc, token: "another-token" }, grant, now)).toBe(false);
  expect(validDocumentGrant({ ...doc, receiptId: "r2" }, grant, now)).toBe(false);
  expect(validDocumentGrant({ ...doc, phone: "+254700000002" }, grant, now)).toBe(false);
  expect(validDocumentGrant(doc, grant + "x", now)).toBe(false);
});
test("old receipt links do not acquire a fresh grace period", async () => {
  (prisma.receipt.findFirst as jest.Mock).mockResolvedValue({ id: "r1", data: { publicReceiptToken: doc.token }, order: { customerPhone: "0700000001" } });
  expect((await resolveDocument("receipt", doc.token))?.issuedAt).toBeNull();
});
test("encrypted stored files cannot be read or modified without the key", () => {
  const bytes = Buffer.from("%PDF-1.7 customer receipt");
  const encrypted = encryptDocument(bytes);
  expect(encrypted.includes(bytes)).toBe(false);
  expect(decryptDocument(encrypted)).toEqual(bytes);
  const tampered = Buffer.from(encrypted); tampered[tampered.length - 1] ^= 1;
  expect(() => decryptDocument(tampered)).toThrow();
  expect(decryptDocument(bytes)).toEqual(bytes);
});
test("OTP resend limits are enforced using persisted history", async () => {
  const tx = { $queryRaw: jest.fn(), otpCode: { findMany: jest.fn(async () => [{ createdAt: new Date() }]), create: jest.fn(), updateMany: jest.fn() } };
  (prisma.$transaction as jest.Mock).mockImplementation(fn => fn(tx));
  await expect(issueDocumentOtp(doc)).rejects.toThrow("Please wait");
  expect(tx.otpCode.create).not.toHaveBeenCalled();
});
test("codes are single use, limited to five guesses, and bound to the document", async () => {
  let stored: any = null;
  const tx = { $queryRaw: jest.fn(), otpCode: {
    findMany: jest.fn(async () => []), updateMany: jest.fn(),
    create: jest.fn(async ({ data }) => { stored = { ...data, id: "otp", used: false, attempts: 0 }; }),
    findFirst: jest.fn(async () => stored && !stored.used && stored.expiresAt > new Date() ? stored : null),
    update: jest.fn(async ({ data }) => { stored.used = data.used; stored.attempts++; }),
  } };
  (prisma.$transaction as jest.Mock).mockImplementation(fn => fn(tx));
  const code = await issueDocumentOtp(doc);
  expect(await verifyDocumentOtp({ ...doc, token: "other" }, code)).toBe(false);
  expect(await verifyDocumentOtp(doc, code)).toBe(true);
  expect(await verifyDocumentOtp(doc, code)).toBe(false);
  await issueDocumentOtp(doc);
  for (let i = 0; i < 5; i++) expect(await verifyDocumentOtp(doc, "999999" === code ? "888888" : "999999")).toBe(false);
  expect(stored.used).toBe(true);
});
