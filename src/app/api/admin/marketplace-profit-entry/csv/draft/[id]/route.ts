import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { isMarketplaceStatementDraftTableAvailable } from "@/lib/statementDraftTable";
import { upsertManualWeeklySale } from "@/lib/manualWeeklySaleUpsert";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const params = await Promise.resolve(ctx.params);
  const id = String(params?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const draftTableAvailable = await isMarketplaceStatementDraftTableAvailable();
  if (!draftTableAvailable) {
    return NextResponse.json({ error: "Drafts database table is not available yet." }, { status: 501 });
  }

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

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> | { id: string } }) {
  const auth = await requireRoleOrBenjamin(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const actorId = (auth.session?.user as { id?: string } | undefined)?.id ?? null;

  const params = await Promise.resolve(ctx.params);
  const id = String(params?.id ?? "").trim();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const draftTableAvailable = await isMarketplaceStatementDraftTableAvailable();
  if (!draftTableAvailable) {
    // Nothing to delete in DB; UI can still Clear local state.
    return NextResponse.json({ ok: true, deleted: false, draftTableAvailable: false });
  }

  const draft = await prisma.marketplaceStatementDraft.findUnique({
    where: { id },
    select: { id: true, shopId: true, accountId: true, weekStart: true, weekEnd: true },
  });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  await prisma.marketplaceStatementDraft.delete({ where: { id: draft.id } });

  // Mirror removal to WeeklySale so dashboards/quick-stats stop showing the wrong payout (best-effort).
  try {
    let effectiveUserId: string | null = null;
    if (draft.accountId) {
      const primary = await prisma.marketplaceAccountAssignment.findFirst({
        where: { accountId: draft.accountId, endsAt: null },
        orderBy: { startsAt: "desc" },
        select: { attendantId: true },
      });
      effectiveUserId = primary?.attendantId ?? null;
    }

    await upsertManualWeeklySale({
      shopId: draft.shopId,
      weekStart: draft.weekStart,
      weekEnd: draft.weekEnd,
      amount: 0,
      userId: effectiveUserId,
      actorId,
    });
  } catch (err) {
    console.error("[draft-delete] weekly sale reset failed", err);
  }

  return NextResponse.json({ ok: true, deleted: true, draftTableAvailable: true });
}
