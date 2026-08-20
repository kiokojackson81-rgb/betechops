import type { Prisma, PrismaClient } from "@prisma/client";
import { computeProductCommissions } from "@/lib/commission";
import type { TradingPeriod } from "@/lib/tradingPeriod";

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
const PRODUCT_ACTIONS = ["POS_PRODUCT_CREATE", "POS_PRODUCT_UPDATE", "POS_PRODUCT_COPY"];

export type MarketingProductActivitySummary = {
  uploaded: number;
  edited: number;
  copied: number;
  commission: {
    newProducts: number;
    editedProducts: number;
    copiedProducts: number;
    total: number;
  };
};

function dateKeyBoundary(value: string, end: boolean) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) throw new Error(`Invalid date key: ${value}`);
  const [, year, month, day] = match;
  const utc = Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    end ? 23 : 0,
    end ? 59 : 0,
    end ? 59 : 0,
    end ? 999 : 0,
  ) - NAIROBI_OFFSET_MS;
  return new Date(utc);
}

type ProductActivityRow = {
  entityId: string;
  action: string;
  createdAt: Date;
};

function uniqueProductsForAction(
  rows: ProductActivityRow[],
  action: string,
) {
  return new Set(
    rows
      .filter((row) => row.action === action)
      .map((row) => {
        const nairobiDate = new Date(row.createdAt.getTime() + NAIROBI_OFFSET_MS)
          .toISOString()
          .slice(0, 10);
        return `${nairobiDate}:${row.entityId}`;
      }),
  ).size;
}

export function summarizeMarketingProductActivityRows(
  rows: ProductActivityRow[],
): MarketingProductActivitySummary {
  const uploaded = uniqueProductsForAction(rows, "POS_PRODUCT_CREATE");
  const edited = uniqueProductsForAction(rows, "POS_PRODUCT_UPDATE");
  const copied = uniqueProductsForAction(rows, "POS_PRODUCT_COPY");
  const calculated = computeProductCommissions({
    newProducts: uploaded,
    editedProducts: edited,
    copiedProducts: copied,
  });

  return {
    uploaded,
    edited,
    copied,
    commission: {
      newProducts: calculated.newProductCommission,
      editedProducts: calculated.editedCommission,
      copiedProducts: calculated.copiedCommission,
      total:
        calculated.newProductCommission +
        calculated.editedCommission +
        calculated.copiedCommission,
    },
  };
}

export async function getMarketingProductActivity(input: {
  userId: string;
  startDate: string;
  endDate?: string;
  client?: PrismaClientOrTx;
}): Promise<MarketingProductActivitySummary> {
  const client = input.client;
  if (!client) throw new Error("A Prisma client is required");

  const rows = await client.actionLog.findMany({
    where: {
      actorId: input.userId,
      entity: "Product",
      action: { in: PRODUCT_ACTIONS },
      createdAt: {
        gte: dateKeyBoundary(input.startDate, false),
        lte: dateKeyBoundary(input.endDate ?? input.startDate, true),
      },
    },
    select: { entityId: true, action: true, createdAt: true },
  });

  return summarizeMarketingProductActivityRows(rows);
}

export function getTradingPeriodDateKeys(period: TradingPeriod) {
  const [startDate, endDate] = period.key.split("_");
  if (!startDate || !endDate) throw new Error(`Invalid trading period key: ${period.key}`);
  return { startDate, endDate };
}
