"use server";

import { NextResponse } from "next/server";
import { z } from "zod";
import { AttendantCategory, type PaymentMethod } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAttendant } from "@/lib/auth";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getSupportPeriodAggregates } from "@/lib/supportEntries";

export const dynamic = "force-dynamic";

const ItemSchema = z.object({
  productName: z.string().optional(),
});

const ReceiptSchema = z.object({
  receiptNumber: z.string().optional().nullable(),
  sellingTotal: z.union([z.number(), z.string()]),
  paymentMethod: z.string().optional(),
  items: z.array(ItemSchema).optional(),
});

const PayloadSchema = z.object({
  date: z.string(),
  dayOfWeek: z.string().optional(),
  receipts: z.array(ReceiptSchema),
});

const normalizePaymentMethod = (value?: string): PaymentMethod => (String(value).toUpperCase() === "CASH" ? "CASH" : "MPESA");
const toNumber = (value: unknown) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

export async function POST(req: Request) {
  const auth = await requireAttendant(req, ["JUMIA_KILIMALL_OPS", "BETECH_OPS", "SUPERVISOR", "ADMIN"]);
  if (!auth.ok) return auth.res;

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload" }, { status: 400 });
  }

  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const { date, dayOfWeek, receipts } = parsed.data;
  const entryDate = new Date(date);
  if (Number.isNaN(entryDate.getTime())) {
    return NextResponse.json({ error: "Invalid date supplied" }, { status: 400 });
  }
  const resolvedDay = typeof dayOfWeek === "string" && dayOfWeek.length > 0 ? dayOfWeek : entryDate.toLocaleDateString("en-KE", { weekday: "long" });

  const normalizedReceipts = receipts
    .map((receipt) => {
      const sellingTotal = Math.max(0, toNumber(receipt.sellingTotal));
      const items = Array.isArray(receipt.items) && receipt.items.length > 0 ? receipt.items : [{ productName: "Direct sale item" }];
      return {
        receiptNumber: typeof receipt.receiptNumber === "string" ? receipt.receiptNumber.trim() : null,
        sellingTotal,
        paymentMethod: normalizePaymentMethod(receipt.paymentMethod),
        items: items.map((item, index) => ({
          productName: (item.productName ?? "").trim() || `Item ${index + 1}`,
        })),
      };
    })
    .filter((receipt) => receipt.sellingTotal > 0);

  if (!normalizedReceipts.length) {
    return NextResponse.json({ error: "At least one receipt with a selling total is required" }, { status: 400 });
  }

  let entryId: string | null = null;
  await prisma.$transaction(async (tx) => {
    const created = await tx.supportDailyEntry.create({
      data: {
        date: entryDate,
        dayOfWeek: resolvedDay,
        totalSales: normalizedReceipts.reduce((sum, receipt) => sum + receipt.sellingTotal, 0),
        totalProfit: 0,
        newBatteries: 0,
        changedBatteries: 0,
        submittedById: auth.user.id,
        receipts: {
          create: normalizedReceipts.map((receipt) => ({
            receiptNumber: receipt.receiptNumber,
            sellingTotal: receipt.sellingTotal,
            paymentMethod: receipt.paymentMethod,
            items: {
              create: receipt.items.map((item) => ({
                productName: item.productName,
                buyingPrice: 0,
              })),
            },
          })),
        },
      },
      select: { id: true },
    });

    entryId = created.id;

    await tx.attendantActivity.createMany({
      data: normalizedReceipts.map((receipt) => ({
        userId: auth.user.id,
        category: (auth.user.attendantCategory ?? AttendantCategory.JUMIA_KILIMALL_OPS) as AttendantCategory,
        metric: "onlineDirectSale",
        numericValue: receipt.sellingTotal,
        entryDate,
      })),
    });
  });

  const period = getTradingPeriodFor(entryDate);
  const aggregates = await getSupportPeriodAggregates({ userId: auth.user.id, period });

  return NextResponse.json(
    {
      entryId,
      period: {
        key: period.key,
        label: period.label,
      },
      aggregates: aggregates.aggregates,
    },
    { status: 201 },
  );
}
