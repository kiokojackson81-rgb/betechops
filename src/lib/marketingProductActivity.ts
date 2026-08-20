import type { Prisma, PrismaClient } from "@prisma/client";
import { computeProductCommissions } from "@/lib/commission";
import type { TradingPeriod } from "@/lib/tradingPeriod";

type PrismaClientOrTx = PrismaClient | Prisma.TransactionClient;

const NAIROBI_OFFSET_MS = 3 * 60 * 60 * 1000;
const PRODUCT_ACTIONS = ["POS_PRODUCT_CREATE", "POS_PRODUCT_UPDATE", "POS_PRODUCT_COPY"];

export const MARKETPLACE_PRODUCT_ACTIVITY_KEYS = {
  jumia: {
    uploaded: "jumiaProductsUploaded",
    edited: "jumiaProductsEdited",
    copied: "jumiaProductsCopied",
  },
  kilimall: {
    uploaded: "kilimallProductsUploaded",
    edited: "kilimallProductsEdited",
    copied: "kilimallProductsCopied",
  },
} as const;

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

export type MarketplaceProductActivityBreakdown = {
  jumia: MarketingProductActivitySummary;
  kilimall: MarketingProductActivitySummary;
  total: MarketingProductActivitySummary;
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

export function summarizeMarketingProductCounts(input: {
  uploaded?: number;
  edited?: number;
  copied?: number;
}): MarketingProductActivitySummary {
  const uploaded = Math.max(0, Math.floor(Number(input.uploaded ?? 0)));
  const edited = Math.max(0, Math.floor(Number(input.edited ?? 0)));
  const copied = Math.max(0, Math.floor(Number(input.copied ?? 0)));
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

export function combineMarketingProductActivity(
  ...summaries: MarketingProductActivitySummary[]
): MarketingProductActivitySummary {
  return summarizeMarketingProductCounts({
    uploaded: summaries.reduce((sum, value) => sum + value.uploaded, 0),
    edited: summaries.reduce((sum, value) => sum + value.edited, 0),
    copied: summaries.reduce((sum, value) => sum + value.copied, 0),
  });
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
  return summarizeMarketingProductCounts({
    uploaded: uniqueProductsForAction(rows, "POS_PRODUCT_CREATE"),
    edited: uniqueProductsForAction(rows, "POS_PRODUCT_UPDATE"),
    copied: uniqueProductsForAction(rows, "POS_PRODUCT_COPY"),
  });
}

function payloadNumeric(payload: Prisma.JsonValue | null): Record<string, unknown> {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const numeric = (payload as Record<string, unknown>).numeric;
  return numeric && typeof numeric === "object" && !Array.isArray(numeric)
    ? (numeric as Record<string, unknown>)
    : {};
}

export function summarizeManualMarketplaceProductActivityEntries(
  entries: Array<{ payload: Prisma.JsonValue | null }>,
): MarketplaceProductActivityBreakdown {
  const counts = {
    jumia: { uploaded: 0, edited: 0, copied: 0 },
    kilimall: { uploaded: 0, edited: 0, copied: 0 },
  };

  for (const entry of entries) {
    const numeric = payloadNumeric(entry.payload);
    for (const marketplace of ["jumia", "kilimall"] as const) {
      const keys = MARKETPLACE_PRODUCT_ACTIVITY_KEYS[marketplace];
      counts[marketplace].uploaded += Math.max(0, Math.floor(Number(numeric[keys.uploaded]) || 0));
      counts[marketplace].edited += Math.max(0, Math.floor(Number(numeric[keys.edited]) || 0));
      counts[marketplace].copied += Math.max(0, Math.floor(Number(numeric[keys.copied]) || 0));
    }
  }

  const jumia = summarizeMarketingProductCounts(counts.jumia);
  const kilimall = summarizeMarketingProductCounts(counts.kilimall);
  return { jumia, kilimall, total: combineMarketingProductActivity(jumia, kilimall) };
}

export async function getManualMarketplaceProductActivity(input: {
  userId: string;
  userEmail?: string | null;
  startDate: string;
  endDate?: string;
  client?: PrismaClientOrTx;
}): Promise<MarketplaceProductActivityBreakdown> {
  const client = input.client;
  if (!client) throw new Error("A Prisma client is required");
  const submittedBy: Prisma.MarketingDailyEntryWhereInput[] = [
    { submittedById: input.userId },
  ];
  if (input.userEmail) {
    submittedBy.push({
      submittedByEmail: { equals: input.userEmail, mode: "insensitive" as const },
    });
  }

  const entries = await client.marketingDailyEntry.findMany({
    where: {
      OR: submittedBy,
      date: {
        gte: dateKeyBoundary(input.startDate, false),
        lte: dateKeyBoundary(input.endDate ?? input.startDate, true),
      },
    },
    select: { payload: true },
  });
  return summarizeManualMarketplaceProductActivityEntries(entries);
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
