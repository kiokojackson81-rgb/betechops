import { prisma } from "@/lib/prisma";
import { buildReceiptKey } from "@/lib/receiptKey";

export type ReceiptOwnerResult = {
  source: "POS" | "MARKETING" | "SUPPORT";
  id: string;
  createdAt?: Date;
  ownerUserId?: string | null;
};

export async function findReceiptOwner(client: typeof prisma, receiptKeyRaw: string): Promise<ReceiptOwnerResult | null> {
  const receiptKey = buildReceiptKey(receiptKeyRaw);
  if (!receiptKey) return null;

  // POS: try to find Order by orderNumber and its Receipt
  try {
    if ((client as any).order) {
      const order = await (client as any).order.findUnique({ where: { orderNumber: receiptKey }, include: { receipt: true } });
      if (order) {
        if (order.receipt) {
          return { source: "POS", id: order.receipt.id, createdAt: order.receipt.createdAt, ownerUserId: order.attendantId ?? null };
        }
        // if order exists but no receipt row, return order as owner
        return { source: "POS", id: order.id, createdAt: order.createdAt, ownerUserId: order.attendantId ?? null };
      }
    }
  } catch (err) {
    // ignore and continue
  }

  // Marketing receipts
  try {
    if ((client as any).marketingReceipt) {
      const m = await (client as any).marketingReceipt.findFirst({
        where: { OR: [{ receiptKey }, { receiptNumber: receiptKey }] },
        include: { dailyEntry: { select: { submittedById: true } } },
      });
      if (m) return { source: "MARKETING", id: m.id, createdAt: m.createdAt, ownerUserId: m.dailyEntry?.submittedById ?? null };
    }
  } catch (err) {}

  // Support receipts
  try {
    if ((client as any).supportReceipt) {
      const s = await (client as any).supportReceipt.findFirst({
        where: { OR: [{ receiptKey }, { receiptNumber: receiptKey }] },
        include: { dailyEntry: { select: { submittedById: true } } },
      });
      if (s) return { source: "SUPPORT", id: s.id, createdAt: s.createdAt, ownerUserId: s.dailyEntry?.submittedById ?? null };
    }
  } catch (err) {}

  return null;
}

export default findReceiptOwner;
