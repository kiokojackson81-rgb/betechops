import { prisma } from "@/lib/prisma";

export type ReceiptOwner =
  | { type: "pos"; id: string; ref: string }
  | { type: "marketing"; id: string; entryId: string }
  | { type: "support"; id: string; entryId: string };

export async function findReceiptOwner(receiptNumber?: string): Promise<ReceiptOwner | null> {
  if (!receiptNumber || receiptNumber.trim() === "") return null;
  const rn = receiptNumber.trim();

  // Check POS orders (orderNumber + receipt)
  if (prisma.order && typeof (prisma.order as any).findUnique === "function") {
    const order = await (prisma.order as any).findUnique({ where: { orderNumber: rn }, include: { receipt: true } });
    if (order && order.receipt) {
      return { type: "pos", id: order.receipt.id, ref: order.orderNumber };
    }
  }

  // Check marketing receipts
  if (prisma.marketingReceipt && typeof (prisma.marketingReceipt as any).findFirst === "function") {
    const m = await (prisma.marketingReceipt as any).findFirst({ where: { receiptNumber: rn } });
    if (m) return { type: "marketing", id: m.id, entryId: m.dailyEntryId };
  }

  // Check support receipts
  if (prisma.supportReceipt && typeof (prisma.supportReceipt as any).findFirst === "function") {
    const s = await (prisma.supportReceipt as any).findFirst({ where: { receiptNumber: rn } });
    if (s) return { type: "support", id: s.id, entryId: s.dailyEntryId };
  }

  return null;
}

export function buildDuplicateMessage(receiptNumber: string, owner: ReceiptOwner) {
  if (!owner) return "Receipt already exists";
  switch (owner.type) {
    case "pos":
      return `Receipt ${receiptNumber} already exists (POS order ${owner.ref})`;
    case "marketing":
      return `Receipt ${receiptNumber} already exists (marketing entry ${owner.entryId})`;
    case "support":
      return `Receipt ${receiptNumber} already exists (support entry ${owner.entryId})`;
    default:
      return `Receipt ${receiptNumber} already exists`;
  }
}
