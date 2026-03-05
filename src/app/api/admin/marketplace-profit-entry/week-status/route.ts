import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { mondayToSundayNairobiWindow } from "@/lib/weekWindow";
import { isMarketplaceStatementDraftTableAvailable } from "@/lib/statementDraftTable";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isRecord(value: unknown): value is Record<string, any> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const body = (await req.json().catch(() => null)) as
    | {
        weekStart?: string;
        shopIds?: string[];
      }
    | null;

  if (!body || !isRecord(body)) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const weekStartIso = String(body.weekStart ?? "").trim();
  if (!weekStartIso) return NextResponse.json({ error: "weekStart is required" }, { status: 400 });

  const weekStartDate = new Date(weekStartIso);
  if (Number.isNaN(weekStartDate.getTime())) return NextResponse.json({ error: "Invalid weekStart" }, { status: 400 });

  const shopIds = Array.isArray(body.shopIds) ? body.shopIds.map((s) => String(s).trim()).filter(Boolean) : [];
  if (!shopIds.length) return NextResponse.json({ error: "shopIds is required" }, { status: 400 });

  const canonical = mondayToSundayNairobiWindow(weekStartDate);
  const { weekStart, weekEnd } = canonical;

  const weeklySales = await prisma.weeklySale.findMany({
    where: {
      shopId: { in: shopIds },
      weekStart,
      weekEnd,
    },
    select: {
      shopId: true,
      amount: true,
      updatedAt: true,
      source: true,
      status: true,
    },
    take: shopIds.length,
  });

  const weeklySaleByShopId: Record<string, any> = {};
  for (const s of weeklySales) {
    weeklySaleByShopId[String(s.shopId)] = {
      amount: Number(s.amount ?? 0),
      updatedAt: s.updatedAt.toISOString(),
      source: s.source,
      status: s.status,
    };
  }

  const draftTableAvailable = await isMarketplaceStatementDraftTableAvailable();
  const draftByShopId: Record<
    string,
    { id: string; platform: string; rowCount: number; submittedCount: number; isComplete: boolean; updatedAt?: string }
  > = {};

  if (draftTableAvailable) {
    try {
      const drafts = await prisma.marketplaceStatementDraft.findMany({
        where: {
          weekStart,
          weekEnd,
          OR: [{ shopId: { in: shopIds } }, { accountId: { in: shopIds } }],
        },
        orderBy: { updatedAt: "desc" },
        select: { id: true, platform: true, shopId: true, accountId: true, rowCount: true, submittedByTxn: true, updatedAt: true },
        take: shopIds.length * 2,
      });

      for (const d of drafts) {
        const key = shopIds.includes(d.shopId) ? d.shopId : shopIds.includes(d.accountId) ? d.accountId : null;
        if (!key) continue;
        if (draftByShopId[key]) continue; // already have latest by updatedAt desc
        const submitted =
          d.submittedByTxn && typeof d.submittedByTxn === "object" ? Object.keys(d.submittedByTxn as any).length : 0;
        const rowCount = Number(d.rowCount ?? 0);
        draftByShopId[key] = {
          id: d.id,
          platform: String(d.platform),
          rowCount,
          submittedCount: submitted,
          isComplete: submitted >= rowCount,
          updatedAt: d.updatedAt.toISOString(),
        };
      }
    } catch (err: any) {
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2021")) throw err;
    }
  }

  const items = shopIds.map((id) => ({
    shopId: id,
    weeklySale: weeklySaleByShopId[id] ?? null,
    draft: draftByShopId[id] ?? null,
  }));

  return NextResponse.json({
    week: { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() },
    draftTableAvailable,
    items,
  });
}

