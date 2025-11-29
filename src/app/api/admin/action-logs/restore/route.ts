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
    const { actionLogId, force } = parsed;
    const log = await prisma.actionLog.findUnique({ where: { id: actionLogId } });
    if (!log) return NextResponse.json({ error: "ActionLog not found" }, { status: 404 });

    if (!log.before) return NextResponse.json({ error: "No before snapshot available to restore" }, { status: 400 });
    // Ensure it's a wipe record
    if (log.entity !== "MarketingDailyEntry" || log.action !== "WIPE_RECEIPTS") {
      return NextResponse.json({ error: "ActionLog is not a wipe of marketing receipts" }, { status: 400 });
    }

    const entryId = log.entityId;
    const currentEntry = await prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: true } });
    if (!currentEntry) return NextResponse.json({ error: "Marketing entry not found" }, { status: 404 });

    if ((currentEntry.receipts || []).length > 0 && !force) {
      return NextResponse.json({ error: "Entry already has receipts; pass force=true to override" }, { status: 409 });
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

    // Audit the restore
    try {
      const actorId = await getActorId();
      const session = await auth();
      const actorEmail = (session?.user as any)?.email || "";
      await prisma.actionLog.create({ data: { actorId: actorId || "", entity: "MarketingDailyEntry", entityId: entryId, action: "RESTORE_RECEIPTS", before: beforeSnapshot as any, after: restored as any } });
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
