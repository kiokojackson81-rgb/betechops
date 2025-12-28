import { prisma } from "@/lib/prisma";
import { buildReceiptKey, normalizeReceiptNumber } from "@/lib/receiptKey";

export type ReceiptOwner =
  | { type: "pos"; id: string; ref?: string; createdAt?: Date; ownerUserId?: string | null }
  | { type: "marketing"; id: string; entryId?: string; createdAt?: Date; ownerUserId?: string | null }
  | { type: "support"; id: string; entryId?: string; createdAt?: Date; ownerUserId?: string | null };

export function canonicalReceiptNumber(receiptNumber?: string) {
  return normalizeReceiptNumber(receiptNumber ?? undefined);
}

export async function findReceiptOwner(receiptNumber?: string): Promise<ReceiptOwner | null> {
  const rk = buildReceiptKey(receiptNumber ?? undefined);
  if (!rk) return null;

  // Precedence: POS > MARKETING > SUPPORT
  try {
    if ((prisma as any).order) {
      const order = await (prisma as any).order.findUnique({ where: { orderNumber: rk }, include: { receipt: true } });
      if (order && order.receipt) return { type: "pos", id: order.receipt.id, ref: order.orderNumber, createdAt: order.receipt.createdAt, ownerUserId: order.attendantId ?? null };
    }
  } catch (e) {}

  try {
    if ((prisma as any).marketingReceipt) {
      const m = await (prisma as any).marketingReceipt.findFirst({ where: { OR: [{ receiptKey: rk }, { receiptNumber: rk }] }, include: { dailyEntry: { select: { submittedById: true } } } });
      if (m) return { type: "marketing", id: m.id, entryId: m.dailyEntryId, createdAt: m.createdAt, ownerUserId: m.dailyEntry?.submittedById ?? null };
    }
  } catch (e) {}

  try {
    if ((prisma as any).supportReceipt) {
      const s = await (prisma as any).supportReceipt.findFirst({ where: { OR: [{ receiptKey: rk }, { receiptNumber: rk }] }, include: { dailyEntry: { select: { submittedById: true } } } });
      if (s) return { type: "support", id: s.id, entryId: s.dailyEntryId, createdAt: s.createdAt, ownerUserId: s.dailyEntry?.submittedById ?? null };
    }
  } catch (e) {}

  return null;
}

export function buildDuplicateMessage(receiptNumber: string, owner: ReceiptOwner | null) {
  if (!owner) return "Receipt already exists";
  switch (owner.type) {
    case "pos":
      return `Receipt ${receiptNumber} already exists (POS order ${owner.ref ?? owner.id})`;
    case "marketing":
      return `Receipt ${receiptNumber} already exists (marketing entry ${owner.entryId ?? owner.id})`;
    case "support":
      return `Receipt ${receiptNumber} already exists (support entry ${owner.entryId ?? owner.id})`;
    default:
      return `Receipt ${receiptNumber} already exists`;
  }
}
