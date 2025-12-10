import { NextResponse } from "next/server";
import { z } from "zod";
import { AttendantCategory, Prisma, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { requireAttendant } from "@/lib/auth";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";
import { recomputeSupportCommissionLedger } from "@/lib/supportCommission";
import { buildDuplicateMessage, canonicalReceiptNumber, findReceiptOwner } from "@/lib/receiptGuard";

export const dynamic = "force-dynamic";

const ReceiptItemSchema = z.object({
  productName: z.string().optional(),
  buyingPrice: z.union([z.number(), z.string()]).optional(),
});

const ReceiptSchema = z.object({
  receiptNumber: z.string().optional().nullable(),
  sellingTotal: z.union([z.number(), z.string()]),
  paymentMethod: z.string().optional(),
  items: z.array(ReceiptItemSchema).default([]),
});

const PerformanceSchema = z.object({
  newBatteries: z.union([z.number(), z.string()]).optional(),
  changedBatteries: z.union([z.number(), z.string()]).optional(),
});

const PayloadSchema = z.object({
  date: z.string(),
  dayOfWeek: z.string().optional(),
  newBatteries: z.union([z.number(), z.string()]).optional(),
  changedBatteries: z.union([z.number(), z.string()]).optional(),
  receipts: z.array(ReceiptSchema),
  performance: PerformanceSchema.optional(),
});

const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const toBuyingPrice = (value: unknown) => {
  if (value === null || typeof value === "undefined" || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.round(num) : 0;
};

const normalizePaymentMethod = (value: string | undefined): PaymentMethod => {
  const normalized = (value ?? "").toUpperCase();
  return normalized === "CASH" ? "CASH" : "MPESA";
};

export async function POST(req: Request) {
  const auth = await requireAttendant(req, ["SUPPORT_OPS", "ADMIN"]);
  if (!auth.ok) return auth.res;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const {
    date,
    dayOfWeek,
    receipts,
    performance,
    newBatteries: legacyNew = 0,
    changedBatteries: legacyChanged = 0,
  } = parsed.data;

  if (!date) {
    return NextResponse.json({ error: "date is required" }, { status: 400 });
  }

  const entryDate = new Date(date);
  if (Number.isNaN(entryDate.getTime())) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const resolvedDay = typeof dayOfWeek === "string" && dayOfWeek.length > 0
    ? dayOfWeek
    : entryDate.toLocaleDateString("en-KE", { weekday: "long" });

  const metrics = {
    newBatteries: Math.max(0, toNumber(performance?.newBatteries ?? legacyNew)),
    changedBatteries: Math.max(0, toNumber(performance?.changedBatteries ?? legacyChanged)),
  };

  const normalizedReceipts = receipts
    .map((receipt) => {
      const sellingTotal = Math.max(0, toNumber(receipt.sellingTotal));
      const paymentMethod = normalizePaymentMethod(receipt.paymentMethod);
      const receiptNumber = typeof receipt.receiptNumber === "string" ? receipt.receiptNumber.trim() : null;
      const normalizedItems = (receipt.items.length > 0 ? receipt.items : [{ productName: "Battery sale" }]).map((item) => {
        const buyingPrice = toBuyingPrice(item.buyingPrice);
        return {
          productName: (item.productName ?? "").trim() || "Battery sale",
          buyingPrice,
        };
      });
      const receiptBuyingTotal = normalizedItems.reduce((sum, item) => sum + item.buyingPrice, 0);
      const fullyPriced = normalizedItems.every((item) => item.buyingPrice > 0);
      const profit = fullyPriced ? Math.max(0, sellingTotal - receiptBuyingTotal) : 0;

      return { receiptNumber, sellingTotal, paymentMethod, buyingTotal: receiptBuyingTotal, items: normalizedItems, profit };
    })
    .filter((receipt) => receipt.sellingTotal > 0 || receipt.items.length > 0);

  const seenReceipts = new Set<string>();
  for (const receipt of normalizedReceipts) {
    const normalized = canonicalReceiptNumber(receipt.receiptNumber || undefined);
    if (!normalized) continue;
    if (seenReceipts.has(normalized)) {
      return NextResponse.json({ error: `Duplicate receipt ${normalized} in submission` }, { status: 409 });
    }
    seenReceipts.add(normalized);
    const owner = await findReceiptOwner(normalized);
    if (owner) {
      return NextResponse.json({ error: buildDuplicateMessage(normalized, owner) }, { status: 409 });
    }
  }

  if (normalizedReceipts.length === 0) {
    return NextResponse.json({ error: "At least one receipt is required" }, { status: 400 });
  }

  let totalSales = 0;
  let totalProfit = 0;
  normalizedReceipts.forEach((receipt) => {
    totalSales += receipt.sellingTotal;
    totalProfit += receipt.profit;
  });

  try {
    const entry = await prisma.$transaction(async (tx) => {
      const created = await tx.supportDailyEntry.create({
        data: {
          date: entryDate,
          dayOfWeek: resolvedDay,
          totalSales,
          totalProfit,
          newBatteries: metrics.newBatteries,
          changedBatteries: metrics.changedBatteries,
          submittedById: auth.user.id,
      receipts: {
        create: normalizedReceipts.map((receipt) => ({
          receiptNumber: receipt.receiptNumber,
          sellingTotal: receipt.sellingTotal,
          paymentMethod: receipt.paymentMethod,
          buyingTotal: receipt.buyingTotal ?? 0,
          items: {
            create: receipt.items.map((item) => ({
              productName: item.productName || "Item",
              buyingPrice: item.buyingPrice,
            })),
          },
        })),
      },
        },
        select: { id: true },
      });

      const activityData: Prisma.AttendantActivityCreateManyInput[] = [];
      if (metrics.newBatteries > 0) {
        activityData.push({
          userId: auth.user.id,
          category: AttendantCategory.SUPPORT_OPS,
          metric: "newBatteries",
          intValue: metrics.newBatteries,
          entryDate,
        });
      }
      if (metrics.changedBatteries > 0) {
        activityData.push({
          userId: auth.user.id,
          category: AttendantCategory.SUPPORT_OPS,
          metric: "changedBatteries",
          intValue: metrics.changedBatteries,
          entryDate,
        });
      }
      if (activityData.length) {
        await tx.attendantActivity.createMany({ data: activityData });
      }

      return created;
    });

    const period = getTradingPeriodFor(entryDate);
    const summary = await getSupportPeriodAggregates({ userId: auth.user.id, period });
    const aggregates = summary.aggregates;

    // Update commission ledger so payroll and earnings views include the new profit.
    try {
      await recomputeSupportCommissionLedger({ userId: auth.user.id, period });
    } catch (ledgerErr) {
      console.error("[support/daily] failed to recompute commission ledger", ledgerErr);
    }

    return NextResponse.json(
      {
        entryId: entry.id,
        period: {
          key: period.key,
          label: period.label,
          start: period.start.toISOString(),
          end: period.end.toISOString(),
        },
        aggregates: {
          ...aggregates,
          batteryEarnings: (aggregates.newBatteries + aggregates.changedBatteries) * 70,
        },
      },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save support entry";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
