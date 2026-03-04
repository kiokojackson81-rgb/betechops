import { prisma } from "@/lib/prisma";

export async function resolveShopIdsForMarketplaceAccount(accountId: string): Promise<string[]> {
  const id = String(accountId ?? "").trim();
  if (!id) return [];

  const account = await prisma.marketplaceAccount.findUnique({
    where: { id },
    select: { id: true, platform: true, displayName: true, jumiaShopSid: true, kilimallShopCode: true },
  });
  if (!account) return [];

  const display = (account.displayName ?? "").trim();

  const shops = await prisma.shop.findMany({
    where: {
      isActive: true,
      platform: account.platform as any,
      OR: [
        { id: account.id },
        ...(account.jumiaShopSid ? [{ jumiaShopSid: account.jumiaShopSid }] : []),
        ...(account.kilimallShopCode ? [{ jumiaShopSid: account.kilimallShopCode }] : []),
        ...(display ? [{ name: { equals: display, mode: "insensitive" } as any }] : []),
        ...(account.jumiaShopSid
          ? [{ apiConfig: { is: { apiKey: account.jumiaShopSid } } } as any]
          : []),
        ...(account.kilimallShopCode
          ? [{ apiConfig: { is: { apiKey: account.kilimallShopCode } } } as any]
          : []),
      ] as any,
    },
    select: { id: true },
    take: 5,
  });

  return shops.map((s) => s.id);
}

