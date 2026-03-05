import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { Prisma } from "@prisma/client";
import { isMarketplaceStatementDraftTableAvailable } from "@/lib/statementDraftTable";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

async function resolveDraftLookupIds(inputId: string) {
  const id = String(inputId ?? "").trim();
  if (!id) return { shopId: null as string | null, accountId: null as string | null, legacyShopId: null as string | null };

  const shop = await prisma.shop.findUnique({
    where: { id },
    select: { id: true, name: true, platform: true, apiConfig: { select: { apiKey: true } } },
  });
  if (shop) {
    const apiKey = (shop as any).apiConfig?.apiKey ? String((shop as any).apiConfig.apiKey) : null;
    const name = shop.name?.trim() ?? "";
    const account =
      (apiKey
        ? await prisma.marketplaceAccount.findFirst({
            where: {
              isActive: true,
              platform: shop.platform as any,
              OR: [{ jumiaShopSid: apiKey }, { kilimallShopCode: apiKey }],
            },
            select: { id: true },
          })
        : null) ??
      (name
        ? await prisma.marketplaceAccount.findFirst({
            where: { isActive: true, platform: shop.platform as any, displayName: { equals: name, mode: "insensitive" } as any },
            select: { id: true },
          })
        : null);

    return { shopId: shop.id, accountId: account?.id ?? null, legacyShopId: account?.id ?? null };
  }

  const account = await prisma.marketplaceAccount.findUnique({
    where: { id },
    select: { id: true, platform: true, displayName: true, jumiaShopSid: true, kilimallShopCode: true },
  });
  if (account) {
    const key = String(account.jumiaShopSid ?? account.kilimallShopCode ?? "").trim();
    const name = String(account.displayName ?? "").trim();
    const resolvedShop =
      (key
        ? await prisma.shop.findFirst({
            where: { platform: account.platform as any, apiConfig: { is: { apiKey: key } } as any },
            select: { id: true },
          })
        : null) ??
      (name
        ? await prisma.shop.findFirst({
            where: { platform: account.platform as any, name: { equals: name, mode: "insensitive" } as any },
            select: { id: true },
          })
        : null);

    return { shopId: resolvedShop?.id ?? null, accountId: account.id, legacyShopId: account.id };
  }

  return { shopId: id, accountId: id, legacyShopId: id };
}

export async function GET(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("shopId") ?? "").trim();
  if (!id) return NextResponse.json({ error: "shopId is required" }, { status: 400 });

  const draftTableAvailable = await isMarketplaceStatementDraftTableAvailable();
  if (!draftTableAvailable) {
    return NextResponse.json({ items: [], open: [], migrationPending: true }, { status: 200 });
  }

  try {
    const resolved = await resolveDraftLookupIds(id);
    const candidates = Array.from(new Set([resolved.shopId, resolved.accountId, resolved.legacyShopId].filter(Boolean))) as string[];
    if (!candidates.length) return NextResponse.json({ items: [], open: [] });

    const drafts = await prisma.marketplaceStatementDraft.findMany({
      where: { OR: candidates.flatMap((cid) => [{ shopId: cid }, { accountId: cid }]) },
      orderBy: { updatedAt: "desc" },
      take: 24,
      select: {
        id: true,
        shopId: true,
        accountId: true,
        platform: true,
        weekStart: true,
        weekEnd: true,
        periodKey: true,
        statementNumber: true,
        fileName: true,
        rowCount: true,
        totalNetPayout: true,
        submittedByTxn: true,
        updatedAt: true,
      },
    });

    const items = drafts.map((d) => {
      const submitted =
        d.submittedByTxn && typeof d.submittedByTxn === "object" ? Object.keys(d.submittedByTxn as any).length : 0;
      return {
        id: d.id,
        shopId: d.shopId,
        accountId: d.accountId,
        platform: d.platform,
        week: { weekStart: d.weekStart.toISOString(), weekEnd: d.weekEnd.toISOString() },
        periodKey: d.periodKey,
        statementNumber: d.statementNumber,
        fileName: d.fileName,
        rowCount: d.rowCount,
        submittedCount: submitted,
        totalNetPayout: Number(d.totalNetPayout),
        updatedAt: d.updatedAt.toISOString(),
        isComplete: submitted >= (d.rowCount ?? 0),
      };
    });

    const open = items.filter((i) => !i.isComplete);
    return NextResponse.json({ items, open });
  } catch (err: any) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021") {
      return NextResponse.json({ items: [], open: [], migrationPending: true }, { status: 200 });
    }
    throw err;
  }
}
