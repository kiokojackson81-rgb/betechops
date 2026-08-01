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

export async function ensureReceiptPublicToken(receiptId: string) {
  const receipt = await prisma.receipt.findUnique({
    where: { id: receiptId },
    select: { id: true, data: true },
  });
  if (!receipt) {
    throw new Error("Receipt not found for public token generation.");
  }

  const data =
    receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
      ? ({ ...(receipt.data as Record<string, unknown>) } satisfies Record<string, unknown>)
      : {};

  const existing = typeof data.publicReceiptToken === "string" ? data.publicReceiptToken.trim() : "";
  if (existing) {
    return existing;
  }

  const token = buildReceiptToken();
  data.publicReceiptToken = token;
  await prisma.receipt.update({
    where: { id: receiptId },
    data: { data: data as Prisma.InputJsonValue },
  });
  return token;
}

export async function getPublicReceiptUrl(receiptId: string) {
  const token = await ensureReceiptPublicToken(receiptId);
  return buildPublicReceiptUrlFromToken(token);
}

