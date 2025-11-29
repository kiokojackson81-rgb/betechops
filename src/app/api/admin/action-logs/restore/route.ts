import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getActorId } from "@/lib/api";
import { auth } from "@/lib/auth";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getMarketingReport } from "@/lib/marketingReport";
import { z } from "zod";

const RestoreSchema = z.object({
  actionLogId: z.string(),
  force: z.boolean().optional(),
  confirmToken: z.string().optional(),
});

export async function POST(req: Request) {
  const authz = await requireRole("ADMIN");
  if (!authz.ok) return authz.res;

  let body: any;
  try {
    body = await req.json();
  } catch (e) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let parsed: z.infer<typeof RestoreSchema>;
  try {
    parsed = RestoreSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const { actionLogId, force, confirmToken } = parsed;
    const log = await prisma.actionLog.findUnique({ where: { id: actionLogId } });
    if (!log) return NextResponse.json({ error: "ActionLog not found" }, { status: 404 });

    if (!log.before) return NextResponse.json({ error: "No before snapshot available to restore" }, { status: 400 });
    // Ensure it's a wipe record
    if (log.entity !== "MarketingDailyEntry" || log.action !== "WIPE_RECEIPTS") {
      return NextResponse.json({ error: "ActionLog is not a wipe of marketing receipts" }, { status: 400 });
    }

    // Prevent repeated restores: if original log.after has 'restored' flag and force not set, fail
    const alreadyRestored = (log.after as any)?.restored;
    if (alreadyRestored && !force) {
      return NextResponse.json({ error: "This action log was already restored" }, { status: 409 });
    }

    const entryId = log.entityId;
    const currentEntry = await prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: true } });
    if (!currentEntry) return NextResponse.json({ error: "Marketing entry not found" }, { status: 404 });

    if ((currentEntry.receipts || []).length > 0 && !force) {
      return NextResponse.json({ error: "Entry already has receipts; pass force=true to override" }, { status: 409 });
    }

    // If caller requested a forced restore, require a valid confirmation token.
    if (force) {
      if (!confirmToken) return NextResponse.json({ error: "confirmToken required for force restore" }, { status: 400 });
      // validate confirmation token exists, is for this wipe, not expired and not consumed
      const actorId = await getActorId();
      const now = new Date();
      const confirmLog = await prisma.actionLog.findFirst({
        where: {
          action: 'REQUEST_RESTORE_CONFIRM',
          actorId: actorId || undefined,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (!confirmLog) return NextResponse.json({ error: 'No restore confirmation found; request a confirmation token first' }, { status: 403 });
      const after = (confirmLog.after as any) || {};
      if (after.consumed) return NextResponse.json({ error: 'Confirmation token already used' }, { status: 409 });
      if (after.expiresAt && new Date(after.expiresAt) < now) return NextResponse.json({ error: 'Confirmation token expired' }, { status: 410 });
      if (after.originalWipeId !== actionLogId) return NextResponse.json({ error: 'Confirmation token not valid for this wipe' }, { status: 403 });
      if (after.token !== confirmToken) return NextResponse.json({ error: 'Invalid confirmation token' }, { status: 403 });

      // mark confirmation consumed
      try {
        await prisma.actionLog.update({ where: { id: confirmLog.id }, data: { after: { ...(confirmLog.after as any || {}), consumed: true } as any } });
      } catch (e) {
        console.warn('failed to mark confirmation as consumed', e);
      }
    }

    // Parse before snapshot — it's stored as JSON in actionLog.before
    const before = log.before as any;
    const receipts = Array.isArray(before.receipts) ? before.receipts : [];

    // Capture current state for audit
    const beforeSnapshot = currentEntry;

    // Insert receipts and items
    for (const r of receipts) {
      const created = await prisma.marketingReceipt.create({
        data: {
          dailyEntryId: entryId,
          receiptNumber: r.receiptNumber || null,
          sellingTotal: Number(r.sellingTotal) || 0,
          paymentMethod: (r.paymentMethod === "CASH" ? "CASH" : "MPESA"),
          items: {
            create: Array.isArray(r.items)
              ? r.items.map((it: any) => ({ productName: String(it.productName || ""), buyingPrice: Number(it.buyingPrice) || 0 }))
              : [],
          },
        },
      });
    }

    // Recompute totals
    const entryWithReceipts = await prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
    if (!entryWithReceipts) return NextResponse.json({ error: "Entry disappeared during restore" }, { status: 500 });

    const totalSales = entryWithReceipts.receipts.reduce((s, r) => s + (r.sellingTotal || 0), 0);
    const totalProfit = entryWithReceipts.receipts.reduce(
      (s, r) => s + ((r.sellingTotal || 0) - (r.items?.reduce((is, it) => is + (it.buyingPrice || 0), 0) || 0)),
      0
    );

    await prisma.marketingDailyEntry.update({ where: { id: entryId }, data: { totalSales, totalProfit } });

    const restored = await prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });

    // Audit the restore: create a RESTORE_RECEIPTS actionLog and then mark the original log as restored
    let restoreLog: any = null;
    try {
      const actorId = await getActorId();
      const session = await auth();
      const actorEmail = (session?.user as any)?.email || "";
      // include a reference back to the original wipe so we can list restores by wipe
      const afterWithRef = { ...(restored as any), originalWipeId: actionLogId };
      restoreLog = await prisma.actionLog.create({ data: { actorId: actorId || "", entity: "MarketingDailyEntry", entityId: entryId, action: "RESTORE_RECEIPTS", before: beforeSnapshot as any, after: afterWithRef as any } });

      // Mark original actionLog as restored (best-effort)
      try {
        const mergedAfter = { ...(log.after as any || {}), restored: true, restoredAt: new Date(), restoredBy: restoreLog.id };
        await prisma.actionLog.update({ where: { id: actionLogId }, data: { after: mergedAfter as any } });
      } catch (e) {
        console.warn("failed to mark original actionLog as restored", e);
      }
    } catch (e) {
      console.warn("failed to write actionLog for restore", e);
    }

    // Return restored entry and period report
    const period = getTradingPeriodFor(restored!.date);
    const report = await getMarketingReport({ tradingPeriodKey: period.key });
    return NextResponse.json({ restored: true, entry: restored, report }, { status: 200 });
  } catch (err: unknown) {
    console.error("restore failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "restore failed" }, { status: 500 });
  }
}
