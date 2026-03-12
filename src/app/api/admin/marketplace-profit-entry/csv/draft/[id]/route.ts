import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRoleOrBenjamin } from "@/lib/api";
import { isMarketplaceStatementDraftTableAvailable } from "@/lib/statementDraftTable";
import { upsertManualWeeklySale } from "@/lib/manualWeeklySaleUpsert";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const normalizeName = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const money = (value: unknown) => {
  const n = typeof value === "number" ? value : Number(value ?? NaN);
  return Number.isFinite(n) ? n : NaN;
};

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
    select: {
      id: true,
      platform: true,
      shopId: true,
      accountId: true,
      weekStart: true,
      weekEnd: true,
      rows: true,
      buyingByTxn: true,
      submittedByTxn: true,
    },
  });
  if (!draft) return NextResponse.json({ error: "Draft not found" }, { status: 404 });

  const rows = Array.isArray(draft.rows) ? (draft.rows as any[]) : [];
  const buyingByTxn =
    draft.buyingByTxn && typeof draft.buyingByTxn === "object" && !Array.isArray(draft.buyingByTxn)
      ? (draft.buyingByTxn as Record<string, any>)
      : {};
  const submittedByTxn =
    draft.submittedByTxn && typeof draft.submittedByTxn === "object" && !Array.isArray(draft.submittedByTxn)
      ? (draft.submittedByTxn as Record<string, any>)
      : {};

  const txns = Array.from(
    new Set(rows.map((r) => String(r?.itemCreditTxn ?? "").trim()).filter(Boolean)),
  );
  const submittedEntryIds = Array.from(
    new Set(Object.values(submittedByTxn).map((v) => String(v ?? "").trim()).filter(Boolean)),
  );

  // Before deleting statement rows, preserve learned buying prices as reusable templates.
  try {
    for (const row of rows) {
      const txn = String(row?.itemCreditTxn ?? "").trim();
      if (!txn) continue;
      const buying = money(buyingByTxn[txn]);
      const selling = money(row?.grossSale);
      const normalizedProductName = normalizeName(row?.details);
      if (!Number.isFinite(buying) || buying <= 0) continue;
      if (!Number.isFinite(selling) || selling <= 0) continue;
      if (!normalizedProductName) continue;
      await prisma.marketplacePricingTemplate.upsert({
        where: {
          platform_normalizedProductName_sellingPrice: {
            platform: draft.platform as any,
            normalizedProductName,
            sellingPrice: selling,
          },
        },
        create: {
          platform: draft.platform as any,
          normalizedProductName,
          sellingPrice: selling,
          defaultBuyingPrice: buying,
          updatedById: actorId ?? undefined,
        },
        update: {
          defaultBuyingPrice: buying,
          updatedById: actorId ?? undefined,
          updatedAt: new Date(),
        },
      });
    }
  } catch (err) {
    console.error("[draft-delete] pricing template preserve failed", err);
  }

  // Delete persisted statement profit entries from system.
  try {
    if (submittedEntryIds.length) {
      await (prisma as any).marketplaceProfitEntry.deleteMany({
        where: { id: { in: submittedEntryIds } },
      });
    }
    if (txns.length) {
      await (prisma as any).marketplaceProfitEntry.deleteMany({
        where: { accountId: draft.accountId, itemCreditTxn: { in: txns } },
      });
    }
  } catch (err) {
    console.error("[draft-delete] marketplaceProfitEntry delete failed", err);
  }

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
