import type { Prisma, PrismaClient } from "@prisma/client";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";

type ReceiptLike = {
  data?: unknown;
  receiptNumber?: string | null;
  order?: { orderNumber?: string | null } | null;
};

type ReceiptClient = Pick<PrismaClient, "receipt"> | Prisma.TransactionClient;

const toPositiveInteger = (value: unknown) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed));
};

export const getPodDeliveryMeta = (data: unknown): Record<string, unknown> | null => {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const podDelivery = (data as Record<string, unknown>).podDelivery;
  if (!podDelivery || typeof podDelivery !== "object" || Array.isArray(podDelivery)) return null;
  return podDelivery as Record<string, unknown>;
};

export const getPodDeliveryFee = (value: unknown) => {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const podMeta = getPodDeliveryMeta((value as Record<string, unknown>).data ?? value);
    return toPositiveInteger(podMeta?.deliveryFee ?? 0);
  }
  return 0;
};

export const adjustProfitForPodDeliveryFee = (profit: number, deliveryFee: number) =>
  Number.isFinite(profit) ? profit - Math.max(0, deliveryFee) : profit;

export const getCanonicalReceiptCandidates = (receipt: ReceiptLike) =>
  Array.from(
    new Set(
      [
        canonicalReceiptNumber(receipt.order?.orderNumber ?? undefined),
        canonicalReceiptNumber(receipt.receiptNumber ?? undefined),
      ].filter((value): value is string => Boolean(value)),
    ),
  );

export async function loadPodDeliveryFeeMap(
  client: ReceiptClient,
  refs: Array<string | null | undefined>,
) {
  const canonicals = Array.from(
    new Set(refs.map((value) => canonicalReceiptNumber(value ?? undefined)).filter((value): value is string => Boolean(value))),
  );
  const result = new Map<string, number>();
  if (canonicals.length === 0) return result;

  const rows = await client.receipt.findMany({
    where: {
      OR: [
        { receiptNumber: { in: canonicals } },
        { order: { orderNumber: { in: canonicals } } },
      ],
    },
    select: {
      receiptNumber: true,
      data: true,
      order: { select: { orderNumber: true } },
    },
  });

  for (const row of rows) {
    const fee = getPodDeliveryFee(row.data);
    if (fee <= 0) continue;
    for (const key of getCanonicalReceiptCandidates(row)) {
      result.set(key, Math.max(result.get(key) ?? 0, fee));
    }
  }

  return result;
}
