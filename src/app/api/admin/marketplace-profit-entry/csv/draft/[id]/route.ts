import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const params = await Promise.resolve(ctx.params);
  const id = String(params?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const draft = await prisma.marketplaceStatementDraft.findUnique({
    where: { id },
    select: {
      id: true,
      draftKey: true,
      platform: true,
      shopId: true,
      accountId: true,
      weekStart: true,
      weekEnd: true,
      periodKey: true,
      statementNumber: true,
      fileName: true,
      rowCount: true,
      totalNetPayout: true,
      rows: true,
      buyingByTxn: true,
      submittedByTxn: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  return NextResponse.json({
    ...draft,
    weekStart: draft.weekStart.toISOString(),
    weekEnd: draft.weekEnd.toISOString(),
    totalNetPayout: Number(draft.totalNetPayout ?? 0),
  });
}

