import { prisma } from "@/lib/prisma";
import type { Prisma, PrismaClient } from "@prisma/client";

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

const RELEASED_POS_COMMISSION_STATUSES = ["RELEASED", "APPROVED"] as const;

type CommissionLike = {
  basis?: string | null;
  calcDetail?: unknown;
  createdAt?: Date | null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const toNumber = (value: unknown) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseDate = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string" || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

export function isPosProductCommissionEntry(entry: CommissionLike) {
  const detail = asRecord(entry.calcDetail);
  return entry.basis === "product_flat" || detail?.reason === "pos_product_commission";
}

export function getReleasedPosCommissionEffectiveAt(entry: CommissionLike) {
  const detail = asRecord(entry.calcDetail);
  return (
    parseDate(detail?.approvedAt) ??
    parseDate(detail?.releasedAt) ??
    (entry.createdAt instanceof Date ? entry.createdAt : null)
  );
}

export async function getReleasedPosProductCommissionForStaffPeriod(
  staffId: string,
  start: Date,
  end: Date,
  client: PrismaClientOrTx = prisma,
) {
  const rows = await client.commissionEarning.findMany({
    where: {
      staffId,
      status: { in: [...RELEASED_POS_COMMISSION_STATUSES] },
      basis: "product_flat",
    },
    select: {
      amount: true,
      basis: true,
      calcDetail: true,
      createdAt: true,
    },
  });

  return rows.reduce((sum, row) => {
    if (!isPosProductCommissionEntry(row)) return sum;
    const effectiveAt = getReleasedPosCommissionEffectiveAt(row);
    if (!effectiveAt) return sum;
    const time = effectiveAt.getTime();
    if (time < start.getTime() || time > end.getTime()) return sum;
    return sum + toNumber(row.amount);
  }, 0);
}

export async function getReleasedPosProductCommissionTotalsByOrderItemIds(
  orderItemIds: string[],
  client: PrismaClientOrTx = prisma,
) {
  if (!orderItemIds.length) return new Map<string, number>();

  const rows = await client.commissionEarning.findMany({
    where: {
      orderItemId: { in: orderItemIds },
      status: { in: [...RELEASED_POS_COMMISSION_STATUSES] },
      basis: "product_flat",
    },
    select: {
      orderItemId: true,
      amount: true,
      basis: true,
      calcDetail: true,
      createdAt: true,
    },
  });

  const totals = new Map<string, number>();
  for (const row of rows) {
    if (!isPosProductCommissionEntry(row)) continue;
    totals.set(row.orderItemId, (totals.get(row.orderItemId) ?? 0) + toNumber(row.amount));
  }
  return totals;
}
