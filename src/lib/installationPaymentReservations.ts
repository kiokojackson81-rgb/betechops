import "server-only";

import { prisma } from "@/lib/prisma";

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

/** Keeps abandoned STK reservations out of the confirmed installation queue. */
export async function expireInstallationPaymentReservations(now = new Date()) {
  const candidates = await prisma.order.findMany({
    where: { metadata: { path: ["installationPaymentState"], equals: "AWAITING_PAYMENT" } },
    select: { id: true, metadata: true, receipt: { select: { id: true, data: true } } },
    take: 500,
  });
  const expired = candidates.filter((order) => {
    const expiresAt = new Date(String(metadataObject(order.metadata).installationPaymentExpiresAt || ""));
    return !Number.isNaN(expiresAt.getTime()) && expiresAt.getTime() <= now.getTime();
  });
  await Promise.all(expired.map(async (order) => {
    const metadata = metadataObject(order.metadata);
    await prisma.$transaction(async (tx) => {
      await tx.order.updateMany({ where: { id: order.id, metadata: { path: ["installationPaymentState"], equals: "AWAITING_PAYMENT" } }, data: { metadata: { ...metadata, installationPaymentState: "PAYMENT_EXPIRED", installationPaymentExpiredAt: now.toISOString() } } });
      if (order.receipt) {
        const data = metadataObject(order.receipt.data);
        await tx.receipt.update({ where: { id: order.receipt.id }, data: { data: { ...data, installationPaymentState: "PAYMENT_EXPIRED", installationPaymentExpiredAt: now.toISOString() } } });
      }
    });
  }));
  return { scanned: candidates.length, expired: expired.length };
}
