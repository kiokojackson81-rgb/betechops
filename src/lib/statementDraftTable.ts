import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

let cached: Promise<boolean> | null = null;

export async function isMarketplaceStatementDraftTableAvailable(): Promise<boolean> {
  if (cached) return cached;

  cached = (async () => {
    try {
      const rows = await prisma.$queryRaw<{ name: string | null }[]>(
        Prisma.sql`select to_regclass('public."MarketplaceStatementDraft"') as name`,
      );
      return Boolean(rows?.[0]?.name);
    } catch {
      // If we can't check (permissions/network), fall back to "not available" so the app still works via local drafts.
      return false;
    }
  })();

  return cached;
}

