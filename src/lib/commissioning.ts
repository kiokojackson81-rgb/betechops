import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";

export const COMMISSIONING_LINK_DAYS = Math.max(
  7,
  Number(process.env.COMMISSIONING_LINK_EXPIRY_DAYS || 180),
);

export type CommissioningAuditEvent = {
  at: string;
  action: string;
  actorId?: string | null;
  detail?: Record<string, unknown>;
};

export function createCommissioningToken() {
  return randomBytes(32).toString("base64url");
}

export function hashCommissioningToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function tokenEncryptionKey() {
  const secret = process.env.COMMISSIONING_LINK_ENCRYPTION_SECRET || process.env.NEXTAUTH_SECRET;
  if (!secret) throw new Error("COMMISSIONING_LINK_ENCRYPTION_SECRET or NEXTAUTH_SECRET must be configured.");
  return createHash("sha256").update(secret).digest();
}

export function encryptCommissioningToken(token: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

export function decryptCommissioningToken(ciphertext: string) {
  const [ivText, tagText, encryptedText] = ciphertext.split(".");
  if (!ivText || !tagText || !encryptedText) throw new Error("Invalid encrypted commissioning token.");
  const decipher = createDecipheriv("aes-256-gcm", tokenEncryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, "base64url")), decipher.final()]).toString("utf8");
}

export function commissioningExpiry() {
  return new Date(Date.now() + COMMISSIONING_LINK_DAYS * 24 * 60 * 60 * 1000);
}

export function appendCommissioningAudit(
  audit: unknown,
  entry: CommissioningAuditEvent,
) {
  const existing = Array.isArray(audit) ? audit : [];
  return [...existing.slice(-99), entry];
}

export function commissioningUrl(token: string, origin?: string) {
  const base = (origin || process.env.NEXT_PUBLIC_BASE_URL || process.env.APP_URL || "").replace(/\/$/, "");
  return `${base}/commissioning/${token}`;
}

export function projectSummary(receipt: {
  receiptNumber: string | null;
  data: unknown;
  order: { orderNumber: string; customerName: string | null; metadata?: unknown } | null;
}) {
  const data = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
    ? (receipt.data as Record<string, unknown>)
    : {};
  const metadata = receipt.order?.metadata && typeof receipt.order.metadata === "object" && !Array.isArray(receipt.order.metadata)
    ? (receipt.order.metadata as Record<string, unknown>)
    : {};
  const items = Array.isArray(data.items) ? data.items : Array.isArray(data.lineItems) ? data.lineItems : [];
  const itemNames = items.slice(0, 8).map((item) => {
    if (!item || typeof item !== "object") return null;
    const value = item as Record<string, unknown>;
    const name = String(value.name || value.title || value.description || "").trim();
    const qty = Number(value.qty ?? value.quantity ?? 1);
    return name ? `${Number.isFinite(qty) && qty > 1 ? `${qty} × ` : ""}${name}` : null;
  }).filter((value): value is string => Boolean(value));
  const location = [data.customerLocation, data.deliveryAddress, metadata.customerLocation, metadata.deliveryAddress, data.town, data.county]
    .find((value) => typeof value === "string" && value.trim());

  return {
    reference: receipt.receiptNumber || receipt.order?.orderNumber || "Project",
    customerName: receipt.order?.customerName || String(data.customerName || "Customer"),
    location: typeof location === "string" ? location : "Location pending",
    system: itemNames.join(" · ") || String(data.itemDescription || data.description || "Solar installation"),
    expectedItems: itemNames,
  };
}

export async function findAccessibleCommissioningSession(token: string) {
  const tokenHash = hashCommissioningToken(token);
  const session = await prisma.commissioningSession.findUnique({
    where: { tokenHash },
    include: {
      technician: { select: { id: true, name: true } },
      receipt: {
        select: {
          receiptNumber: true,
          data: true,
          order: {
            select: {
              orderNumber: true,
              customerName: true,
              customerPhone: true,
              customerEmail: true,
              metadata: true,
            },
          },
        },
      },
    },
  });
  if (!session || session.status === "REVOKED" || session.expiresAt <= new Date()) return null;
  return session;
}

export async function findCustomerCertificateSession(token: string) {
  const customerTokenHash = hashCommissioningToken(token);
  const session = await prisma.commissioningSession.findUnique({
    where: { customerTokenHash },
    include: {
      technician: { select: { id: true, name: true } },
      receipt: { select: { receiptNumber: true, data: true, order: { select: { orderNumber: true, customerName: true, customerPhone: true, customerEmail: true, metadata: true } } } },
    },
  });
  return session?.status === "ISSUED" ? session : null;
}

export function certificateNumber(reference: string) {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `BSC-${stamp}-${reference.replace(/[^A-Z0-9]/gi, "").replace(/\s+/g, "").trim().slice(-8).toUpperCase() || "PROJECT"}-${suffix}`;
}
