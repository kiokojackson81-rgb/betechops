import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const { searchParams } = new URL(req.url);
  const shopId = String(searchParams.get("shopId") ?? "").trim();
  if (!shopId) return NextResponse.json({ error: "shopId is required" }, { status: 400 });

  const draft = await prisma.marketplaceStatementDraft.findFirst({
    where: { shopId },
    orderBy: { updatedAt: "desc" },
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
      updatedAt: true,
    },
  });

  if (!draft) return NextResponse.json({ error: "No draft found for this shop" }, { status: 404 });

  return NextResponse.json({
    draftId: draft.id,
    shopId: draft.shopId,
    accountId: draft.accountId,
    platform: draft.platform,
    week: { weekStart: draft.weekStart.toISOString(), weekEnd: draft.weekEnd.toISOString() },
    periodKey: draft.periodKey,
    statementNumber: draft.statementNumber,
    fileName: draft.fileName,
    rowCount: draft.rowCount,
    totalNetPayout: Number(draft.totalNetPayout),
    updatedAt: draft.updatedAt.toISOString(),
  });
}

