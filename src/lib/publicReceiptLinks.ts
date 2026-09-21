import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

function getPublicBaseUrl() {
  return (process.env.PUBLIC_BETECH_SITE_URL || "https://www.betech.co.ke").replace(/\/$/, "");
}

function buildReceiptToken() {
  return `rcpt_${randomBytes(12).toString("base64url")}`;
}

export function buildPublicReceiptUrlFromToken(token: string) {
  return `${getPublicBaseUrl()}/r/${token}`;
}

export async function ensureReceiptPublicToken(receiptId: string): Promise<string> {
  // Compare the JSON snapshot before saving so concurrent sends cannot replace
  // a link already sent to a customer or overwrite other receipt updates.
  for (let attempt = 0; attempt < 5; attempt++) {
    const receipt = await prisma.receipt.findUnique({ where: { id: receiptId }, select: { data: true } });
    if (!receipt) throw new Error("Receipt not found for public token generation.");
    const data = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
      ? { ...(receipt.data as Record<string, unknown>) } : {};
    const existing = typeof data.publicReceiptToken === "string" ? data.publicReceiptToken.trim() : "";
    if (existing) return existing;
    const token = buildReceiptToken();
    const updated = await prisma.receipt.updateMany({
      where: { id: receiptId, data: { equals: receipt.data === null ? Prisma.DbNull : receipt.data as Prisma.InputJsonValue } },
      data: { data: { ...data, publicReceiptToken: token, publicReceiptTokenIssuedAt: new Date().toISOString() } as Prisma.InputJsonValue },
    });
    if (updated.count === 1) return token;
  }
  throw new Error("Receipt changed while preparing its public link. Please retry.");
}

export async function getPublicReceiptUrl(receiptId: string) {
  const token = await ensureReceiptPublicToken(receiptId);
  return buildPublicReceiptUrlFromToken(token);
}


export async function getPublicReceiptDocumentsUrl(receiptId: string) {
  return `${await getPublicReceiptUrl(receiptId)}/view`;
}
