import { prisma } from "@/lib/prisma";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";

const toNumber = (value: unknown) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const formatKes = (value: number) =>
  `KES ${Math.round(value).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

export type PodPendingStats = {
  pendingCount: number;
  pendingTotal: number;
  pendingList: string;
};

export async function getPodPendingStats(limit = 10): Promise<PodPendingStats> {
  // Newest first so the list is relevant for follow-up.
  const receipts = await prisma.receipt.findMany({
    where: { data: { path: ["podDelivery", "status"], equals: "pending" } },
    orderBy: { generatedAt: "desc" },
    take: Math.max(50, limit * 10), // overfetch to allow de-duping
    select: {
      id: true,
      generatedAt: true,
      totals: true,
      data: true,
      order: {
        select: {
          orderNumber: true,
          customerPhone: true,
          totalAmount: true,
        },
      },
    },
  });

  const seen = new Set<string>();
  let pendingCount = 0;
  let pendingTotal = 0;
  const lines: string[] = [];

  for (const r of receipts as any[]) {
    const orderNumber = r?.order?.orderNumber ?? null;
    const dataReceiptNumber = r?.data?.receiptNumber ?? null;
    const canonical =
      canonicalReceiptNumber(orderNumber ?? undefined) ||
      canonicalReceiptNumber(dataReceiptNumber ?? undefined) ||
      canonicalReceiptNumber(r.id) ||
      r.id;
    if (seen.has(canonical)) continue;
    seen.add(canonical);

    const total =
      toNumber(r?.totals?.total) ||
      toNumber(r?.totals?.grandTotal) ||
      toNumber(r?.totals?.sellingTotal) ||
      toNumber(r?.data?.total) ||
      toNumber(r?.data?.amount) ||
      toNumber(r?.order?.totalAmount) ||
      0;

    pendingCount += 1;
    pendingTotal += total;

    if (lines.length < limit) {
      const phone = (r?.order?.customerPhone ?? r?.data?.customerPhone ?? "").toString().trim();
      const receiptNumber = (orderNumber ?? dataReceiptNumber ?? r.id).toString();
      lines.push(`${lines.length + 1}) ${receiptNumber} - ${formatKes(total)} - ${phone || "-"}`);
    }
  }

  return {
    pendingCount,
    pendingTotal,
    pendingList: lines.join("\n"),
  };
}

