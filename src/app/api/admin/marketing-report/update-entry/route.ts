import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { PaymentMethod } from "@prisma/client";
import { requireRole } from "@/lib/api";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getMarketingReport } from "@/lib/marketingReport";
import { getActorId } from "@/lib/api";
import { auth } from "@/lib/auth";
import { z } from "zod";

const ReceiptItemSchema = z.object({
  id: z.string().optional(),
  productName: z.string().min(1, "productName must be a non-empty string"),
  buyingPrice: z.number().min(0, "buyingPrice must be non-negative"),
});

const ReceiptSchema = z.object({
  id: z.string().optional(),
  receiptNumber: z.string().nullable().optional(),
  sellingTotal: z.number().min(0, "sellingTotal must be non-negative"),
  paymentMethod: z.enum(["MPESA", "CASH"]),
  items: z.array(ReceiptItemSchema).min(1, "Each receipt must contain at least one item"),
});

const UpdateEntrySchema = z.object({
  entryId: z.string(),
  receipts: z.array(ReceiptSchema),
});

const WipeSchema = z.object({
  entryId: z.string(),
  action: z.literal("wipe"),
});

export async function POST(req: Request) {
  const authz = await requireRole("ADMIN");
  if (!authz.ok) return authz.res;

  let body: any;
  try {
    body = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Support wipe action
  if (body?.action === "wipe") {
    try {
      const w = WipeSchema.parse(body);

      const entryId = w.entryId;

      // Capture 'before' snapshot for audit
      const before = await prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
      if (!before) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

      // Delete items then receipts for the entry
      await prisma.marketingReceiptItem.deleteMany({ where: { receipt: { dailyEntryId: entryId } } });
      await prisma.marketingReceipt.deleteMany({ where: { dailyEntryId: entryId } });

      // Reset totals on the daily entry
      await prisma.marketingDailyEntry.update({ where: { id: entryId }, data: { totalSales: 0, totalProfit: 0 } });

      // Audit log the wipe (best-effort) with extra context
      try {
        const actorId = await getActorId();
        const session = await auth();
        const actorEmail = (session?.user as any)?.email || "";
        const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "";
        await prisma.actionLog.create({
          data: {
            actorId: actorId || "",
            entity: "MarketingDailyEntry",
            entityId: entryId,
            action: "WIPE_RECEIPTS",
            before: before as any,
            after: { actorEmail, requestPayload: body, ip } as any,
          },
        });
      } catch (e) {
        console.warn("failed to write actionLog for marketing wipe", e);
      }

      // Return updated entry and period report
      const entryAfter = await prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
      const period = getTradingPeriodFor(entryAfter!.date);
      const report = await getMarketingReport({ tradingPeriodKey: period.key });
      return NextResponse.json({ wiped: true, entry: entryAfter, report }, { status: 200 });
    } catch (err: unknown) {
      if (err instanceof z.ZodError) return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
      console.error("wipe failed", err);
      return NextResponse.json({ error: err instanceof Error ? err.message : "wipe failed" }, { status: 500 });
    }
  }

  let parsed: z.infer<typeof UpdateEntrySchema>;
  try {
    parsed = UpdateEntrySchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { entryId, receipts } = parsed;

  try {
    // receipts validated by Zod already

    // Upsert-style behavior: update existing receipts/items, create new ones, delete removed
    const existingReceipts = await prisma.marketingReceipt.findMany({ where: { dailyEntryId: entryId }, include: { items: true } });

    const existingReceiptIds = existingReceipts.map((r) => r.id);
    const providedReceiptIds = receipts.filter((r: any) => r?.id).map((r: any) => r.id);

    // Delete receipts that existed but were removed in the payload
    const receiptsToDelete = existingReceiptIds.filter((id) => !providedReceiptIds.includes(id));
    if (receiptsToDelete.length) {
      await prisma.marketingReceipt.deleteMany({ where: { id: { in: receiptsToDelete } } });
    }

    for (const r of receipts) {
      const items = Array.isArray(r.items) ? r.items : [];
      const normalized = {
        receiptNumber: r.receiptNumber || null,
        sellingTotal: Number(r.sellingTotal) || 0,
        paymentMethod: ((String(r.paymentMethod || "")).toUpperCase() === "CASH" ? "CASH" : "MPESA") as PaymentMethod,
      };

      if (r.id && existingReceiptIds.includes(r.id)) {
        // Update receipt fields
        await prisma.marketingReceipt.update({ where: { id: r.id }, data: { receiptNumber: normalized.receiptNumber, sellingTotal: normalized.sellingTotal, paymentMethod: normalized.paymentMethod } });

        // Sync items for this receipt
        const exist = existingReceipts.find((er) => er.id === r.id)!;
        const existingItemIds = (exist.items || []).map((it) => it.id);
        const providedItemIds = items.filter((it: any) => it?.id).map((it: any) => it.id);

        const itemsToDelete = existingItemIds.filter((id) => !providedItemIds.includes(id));
        if (itemsToDelete.length) {
          await prisma.marketingReceiptItem.deleteMany({ where: { id: { in: itemsToDelete } } });
        }

        for (const it of items) {
          const normalizedItem = { productName: String(it.productName || "").trim(), buyingPrice: Number(it.buyingPrice) || 0 };
          if (it.id && existingItemIds.includes(it.id)) {
            await prisma.marketingReceiptItem.update({ where: { id: it.id }, data: { productName: normalizedItem.productName, buyingPrice: normalizedItem.buyingPrice } });
          } else {
            await prisma.marketingReceiptItem.create({ data: { receiptId: r.id, productName: normalizedItem.productName, buyingPrice: normalizedItem.buyingPrice } });
          }
        }
      } else {
        // Create new receipt with items
        await prisma.marketingReceipt.create({ data: { dailyEntryId: entryId, receiptNumber: normalized.receiptNumber, sellingTotal: normalized.sellingTotal, paymentMethod: normalized.paymentMethod, items: { create: items.map((it: any) => ({ productName: String(it.productName || "").trim(), buyingPrice: Number(it.buyingPrice) || 0 })) } } });
      }
    }

    // Recompute totals for the day and update the entry
    const entryWithReceipts = await prisma.marketingDailyEntry.findUnique({
      where: { id: entryId },
      include: { receipts: { include: { items: true } } },
    });
    if (!entryWithReceipts) return NextResponse.json({ error: "Entry not found" }, { status: 404 });

    const totalSales = entryWithReceipts.receipts.reduce((s, r) => s + (r.sellingTotal || 0), 0);
    const totalProfit = entryWithReceipts.receipts.reduce(
      (s, r) => s + ((r.sellingTotal || 0) - (r.items?.reduce((is, it) => is + (it.buyingPrice || 0), 0) || 0)),
      0
    );

    await prisma.marketingDailyEntry.update({ where: { id: entryId }, data: { totalSales, totalProfit } });

    // Return updated entry and aggregates for the trading period
    const entryAfter = await prisma.marketingDailyEntry.findUnique({ where: { id: entryId }, include: { receipts: { include: { items: true } } } });
    if (!entryAfter) return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    const period = getTradingPeriodFor(entryAfter.date);
    const report = await getMarketingReport({ tradingPeriodKey: period.key });

    return NextResponse.json({ updated: true, entry: entryAfter, report }, { status: 200 });
  } catch (err: unknown) {
    console.error("admin update marketing entry failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
