import { createHash, createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { normalizeKenyanPhone } from "@/lib/phone";

export const DOCUMENT_ACCESS_MS = 24 * 60 * 60 * 1000;
export type DocumentKind = "receipt" | "certificate";
export type DocumentAccess = { kind: DocumentKind; token: string; receiptId: string; phone: string | null; issuedAt: Date | null };
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
function secret() {
  const value = process.env.DOCUMENT_ACCESS_SECRET || process.env.NEXTAUTH_SECRET;
  if (!value) throw new Error("Document access is not configured.");
  return value;
}
const mac = (value: string) => createHmac("sha256", secret()).update(value).digest("hex");
function equal(a: string, b: string) { return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
export const documentCookieName = (doc: DocumentAccess) => `betech-doc-${digest(doc.kind + doc.token).slice(0, 24)}`;
export function withinDocumentWindow(issuedAt: Date | null, now = Date.now()) {
  const time = issuedAt?.getTime();
  return time != null && Number.isFinite(time) && time <= now && now < time + DOCUMENT_ACCESS_MS;
}
export function createDocumentGrant(doc: DocumentAccess, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ scope: digest(doc.kind + doc.token), receiptId: doc.receiptId, phone: doc.phone, exp: now + DOCUMENT_ACCESS_MS })).toString("base64url");
  return `${payload}.${mac(payload)}`;
}
export function validDocumentGrant(doc: DocumentAccess, grant: string, now = Date.now()) {
  try {
    const [payload, signature, extra] = grant.split(".");
    if (!payload || !signature || extra || !equal(mac(payload), signature)) return false;
    const value = JSON.parse(Buffer.from(payload, "base64url").toString());
    return value.scope === digest(doc.kind + doc.token) && value.receiptId === doc.receiptId && value.phone === doc.phone && Number.isFinite(value.exp) && value.exp > now && value.exp <= now + DOCUMENT_ACCESS_MS;
  } catch { return false; }
}
export async function resolveDocument(kind: string, token: string): Promise<DocumentAccess | null> {
  if (kind === "receipt" && /^rcpt_[A-Za-z0-9_-]{16}$/.test(token)) {
    const receipt = await prisma.receipt.findFirst({ where: { data: { path: ["publicReceiptToken"], equals: token } }, select: { id: true, data: true, order: { select: { customerPhone: true } } } });
    if (!receipt) return null;
    const data = receipt.data as Record<string, unknown> | null;
    return { kind, token, receiptId: receipt.id, phone: normalizeKenyanPhone(receipt.order.customerPhone || ""), issuedAt: typeof data?.publicReceiptTokenIssuedAt === "string" ? new Date(data.publicReceiptTokenIssuedAt) : null };
  }
  if (kind === "certificate" && /^[A-Za-z0-9_-]{43}$/.test(token)) {
    const session = await prisma.commissioningSession.findUnique({ where: { customerTokenHash: digest(token) }, select: { receiptId: true, status: true, customerDeliveredAt: true, issuedAt: true, receipt: { select: { order: { select: { customerPhone: true } } } } } });
    if (!session || session.status !== "ISSUED") return null;
    return { kind, token, receiptId: session.receiptId, phone: normalizeKenyanPhone(session.receipt.order.customerPhone || ""), issuedAt: session.customerDeliveredAt || session.issuedAt };
  }
  return null;
}
export async function canAccessDocument(doc: DocumentAccess) {
  if (withinDocumentWindow(doc.issuedAt)) return true;
  return validDocumentGrant(doc, (await cookies()).get(documentCookieName(doc))?.value || "");
}
export async function documentAccessAllowed(kind: DocumentKind, token: string) {
  const doc = await resolveDocument(kind, token);
  return Boolean(doc && await canAccessDocument(doc));
}
export const documentVerificationPath = (kind: DocumentKind, token: string) => `/documents/${kind}/${encodeURIComponent(token)}/verify`;
export const documentReturnPath = (kind: DocumentKind, token: string) => kind === "receipt" ? `/r/${encodeURIComponent(token)}/view` : `/certificate/${encodeURIComponent(token)}`;

export async function issueDocumentOtp(doc: DocumentAccess) {
  if (!doc.phone) throw new Error("No customer phone is available. Please contact Betech Customer Care.");
  const phone = `document:${doc.phone}`;
  const code = String(randomInt(0, 1000000)).padStart(6, "0");
  // A shared database lock makes resend limits work across serverless instances.
  await prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))::text`;
    const recent = await tx.otpCode.findMany({ where: { phone, createdAt: { gt: new Date(Date.now() - 3600000) } }, orderBy: { createdAt: "desc" } });
    if (recent.length >= 5 || (recent[0] && Date.now() - recent[0].createdAt.getTime() < 60000)) throw new Error("Please wait before requesting another code. Maximum five codes per hour.");
    await tx.otpCode.updateMany({ where: { phone, used: false }, data: { used: true } });
    await tx.otpCode.create({ data: { phone, codeHash: mac(`${doc.kind}:${doc.token}:${code}`), expiresAt: new Date(Date.now() + 300000) } });
  });
  return code;
}
export async function verifyDocumentOtp(doc: DocumentAccess, code: string) {
  if (!doc.phone || !/^\d{6}$/.test(code)) return false;
  const phone = `document:${doc.phone}`;
  return prisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))::text`;
    const otp = await tx.otpCode.findFirst({ where: { phone, used: false, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (!otp || otp.attempts >= 5) return false;
    const valid = equal(otp.codeHash, mac(`${doc.kind}:${doc.token}:${code}`));
    await tx.otpCode.update({ where: { id: otp.id }, data: { attempts: { increment: 1 }, used: valid || otp.attempts >= 4 } });
    return valid;
  });
}
