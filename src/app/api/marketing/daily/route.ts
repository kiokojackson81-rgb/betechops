import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole, getActorId } from "@/lib/api";
import { marketingDayConfigs, marketingFieldTypes } from "@/lib/marketingDayConfigs";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import { z } from "zod";

const ReceiptItemSchema = z.object({
  id: z.string().optional(),
  productName: z.string().min(1),
  buyingPrice: z.number().min(0),
});

const ReceiptSchema = z.object({
  id: z.string().optional(),
  receiptNumber: z.string().optional().nullable(),
  sellingTotal: z.number().min(0),
  paymentMethod: z.enum(["MPESA", "CASH"]),
  items: z.array(ReceiptItemSchema).min(1),
});

const DailyPayloadSchema = z.object({
  date: z.string().min(1),
  dayOfWeek: z.string().optional(),
  receipts: z.array(ReceiptSchema).optional(),
  yesNo: z.record(z.string(), z.any()).optional(),
  numeric: z.record(z.string(), z.any()).optional(),
  text: z.record(z.string(), z.any()).optional(),
  // Optional top-level weekly fields (convenience)
  weeklyMeetingAttended: z.boolean().optional(),
  weeklyVideoShootParticipated: z.boolean().optional(),
  weeklyVideoCount: z.number().optional(),
});

export const dynamic = "force-dynamic";

type ReceiptPayload = {
  id?: string;
  receiptNumber?: string;
  sellingTotal: number;
  paymentMethod: "MPESA" | "CASH";
  items: { id?: string; productName: string; buyingPrice: number }[];
};

const toNumber = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const normalizePaymentMethod = (value: unknown): "MPESA" | "CASH" => {
  const v = typeof value === "string" ? value.trim().toUpperCase() : "";
  return v === "CASH" ? "CASH" : "MPESA";
};

const normalizeReceipts = (raw: any): ReceiptPayload[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => ({
      receiptNumber: typeof r?.receiptNumber === "string" ? r.receiptNumber.trim() : null,
      sellingTotal: Math.max(0, toNumber(r?.sellingTotal)),
      paymentMethod: normalizePaymentMethod(r?.paymentMethod),
      items: Array.isArray(r?.items)
        ? r.items
            .map((it: any) => ({
              productName: typeof it?.productName === "string" ? it.productName.trim() : "",
              buyingPrice: Math.max(0, toNumber(it?.buyingPrice)),
            }))
            .filter((it: any) => it.productName || Number.isFinite(it.buyingPrice))
        : [],
    }))
    .filter((r) => r.sellingTotal > 0 || r.items.length > 0 || (r.receiptNumber ?? "") !== "");
};

export async function POST(req: Request) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR", "ATTENDANT"]);
  if (!auth.ok) return auth.res;
  // allow admin to submit on behalf of another attendant via impersonateId query param
  let actorId = await getActorId();
  try {
    const url = new URL(req.url);
    const impersonateId = url.searchParams.get("impersonateId");
    if (impersonateId && auth.role === "ADMIN") {
      actorId = impersonateId;
    }
  } catch (e) {
    // ignore
  }

  // Server-side defense in depth: ensure the actor (either the current
  // session user or the impersonated user) is allowed to submit marketing
  // daily entries. Only ADMIN or attendants in DIRECT_SALES_OPS may submit.
  try {
    if (!actorId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const actorUser = await prisma.user.findUnique({
      where: { id: actorId },
      select: { id: true, role: true, attendantCategory: true },
    });
    if (!actorUser) return NextResponse.json({ error: "Actor not found" }, { status: 404 });
    const isAllowed = actorUser.role === "ADMIN" || actorUser.attendantCategory === "DIRECT_SALES_OPS";
    if (!isAllowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  } catch (e) {
    return NextResponse.json({ error: "Failed to verify actor" }, { status: 500 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate payload shape using Zod
  try {
    DailyPayloadSchema.parse(body);
  } catch (err: unknown) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: "Validation failed", details: err.errors }, { status: 400 });
    }
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const { date, dayOfWeek, receipts = [], yesNo = {}, numeric = {}, text = {} } = body || {};
  if (!date) return NextResponse.json({ error: "date is required" }, { status: 400 });
  const entryDate = new Date(date);
  const day = typeof dayOfWeek === "string" ? dayOfWeek : entryDate.toLocaleDateString("en-KE", { weekday: "long" });

  const allowedDay = marketingDayConfigs.find((c) => c.day === day)?.day;
  const resolvedDay = allowedDay ?? marketingDayConfigs[0].day;

  const yesNoValues: Record<string, boolean> = {};
  const numericValues: Record<string, number> = {};
  const textValues: Record<string, string> = {};
  Object.entries(marketingFieldTypes).forEach(([key, type]) => {
    const raw = (type === "yesno" ? yesNo : type === "numeric" ? numeric : text) as Record<string, any>;
    if (type === "yesno") yesNoValues[key] = Boolean(raw?.[key]);
    if (type === "numeric") numericValues[key] = toNumber(raw?.[key]);
    if (type === "text") textValues[key] = typeof raw?.[key] === "string" ? raw[key] : "";
  });

  // Accept convenience top-level weekly fields and normalize them.
  const weeklyMeetingAttendedRaw = (yesNo?.weeklyMeetingAttended ?? body.weeklyMeetingAttended) as unknown;
  const weeklyVideoShootParticipatedRaw = (yesNo?.weeklyVideoShootParticipated ?? body.weeklyVideoShootParticipated) as unknown;
  const weeklyVideoCountRaw = (numeric?.weeklyVideoCount ?? body.weeklyVideoCount) as unknown;

  const receiptsClean = normalizeReceipts(receipts);
  const totalSales = receiptsClean.reduce((sum, r) => sum + r.sellingTotal, 0);
  const totalProfit = receiptsClean.reduce(
    (sum, r) => sum + (r.sellingTotal - r.items.reduce((s, it) => s + it.buyingPrice, 0)),
    0
  );
  const totalItems = receiptsClean.reduce((sum, r) => sum + r.items.length, 0);
  const mpesaTotal = receiptsClean.filter((r) => r.paymentMethod === "MPESA").reduce((s, r) => s + r.sellingTotal, 0);
  const cashTotal = receiptsClean.filter((r) => r.paymentMethod === "CASH").reduce((s, r) => s + r.sellingTotal, 0);

  try {
    // Ensure Thursday-only weekly fields are only persisted for Thursday.
    const isThursday = resolvedDay === "Thursday";

    // Compose final yesNo/numeric values with Thursday-only guards.
    const finalYesNo = { ...yesNoValues } as Record<string, boolean>;
    const finalNumeric = { ...numericValues } as Record<string, number>;

    if (isThursday) {
      if (typeof weeklyMeetingAttendedRaw === "boolean") finalYesNo["weeklyMeetingAttended"] = weeklyMeetingAttendedRaw as boolean;
      if (typeof weeklyVideoShootParticipatedRaw === "boolean") finalYesNo["weeklyVideoShootParticipated"] = weeklyVideoShootParticipatedRaw as boolean;
      if (typeof weeklyVideoCountRaw !== "undefined") finalNumeric["weeklyVideoCount"] = toNumber(weeklyVideoCountRaw);
    } else {
      // Ensure these keys are present with sensible defaults on non-Thursday days
      finalYesNo["weeklyMeetingAttended"] = false;
      finalYesNo["weeklyVideoShootParticipated"] = false;
      finalNumeric["weeklyVideoCount"] = 0;
    }

    const entry = await prisma.marketingDailyEntry.create({
      data: {
        date: entryDate,
        dayOfWeek: resolvedDay,
        totalSales,
        totalProfit,
        payload: { yesNo: finalYesNo, numeric: finalNumeric, text: textValues },
        submittedById: actorId,
        submittedByName: (auth.session?.user as any)?.name ?? null,
        submittedByEmail: (auth.session?.user as any)?.email ?? null,
        receipts: {
          create: receiptsClean.map((r) => ({
            receiptNumber: r.receiptNumber || null,
            sellingTotal: r.sellingTotal,
            paymentMethod: r.paymentMethod,
            items: {
              create: r.items.map((it) => ({
                productName: it.productName,
                buyingPrice: it.buyingPrice,
              })),
            },
          })),
        },
      },
      include: { receipts: { include: { items: true } } },
    });

    const isAdmin = auth.role === "ADMIN";
    const todaySummary: any = {
      totalReceipts: entry.receipts.length,
      totalSales,
      totalItems,
      mpesaTotal,
      cashTotal,
    };
    // Never expose profit to non-admins
    if (isAdmin) todaySummary.totalProfit = totalProfit;

    const period = getTradingPeriodFor(entryDate);
    const periodEntries = await prisma.marketingDailyEntry.findMany({
      where: { date: { gte: period.start, lte: period.end } },
      include: { receipts: { include: { items: true } } },
    });
    const periodSales = periodEntries.reduce(
      (sum, e) => sum + e.receipts.reduce((rs, r) => rs + r.sellingTotal, 0),
      0
    );
    const periodProfit = periodEntries.reduce(
      (sum, e) =>
        sum +
        e.receipts.reduce(
          (rs, r) => rs + (r.sellingTotal - r.items.reduce((s, it) => s + it.buyingPrice, 0)),
          0
        ),
      0
    );
    const periodItems = periodEntries.reduce((sum, e) => sum + e.receipts.reduce((rs, r) => rs + r.items.length, 0), 0);
    const periodMpesa = periodEntries.reduce(
      (sum, e) => sum + e.receipts.filter((r) => r.paymentMethod === "MPESA").reduce((s, r) => s + r.sellingTotal, 0),
      0
    );
    const periodCash = periodEntries.reduce(
      (sum, e) => sum + e.receipts.filter((r) => r.paymentMethod === "CASH").reduce((s, r) => s + r.sellingTotal, 0),
      0
    );
    const commission = getCommissionSummaryForSales(periodSales);

    const periodSummary: any = {
      periodLabel: period.label,
      periodSales,
      mpesaTotal: periodMpesa,
      cashTotal: periodCash,
      totalItems: periodItems,
      commission: commission.commission,
      nextTarget: commission.nextTarget,
      nextTierAmount: commission.nextTierReward,
    };
    // Only admins see period profit
    if (isAdmin) periodSummary.periodProfit = periodProfit;

    return NextResponse.json({ todaySummary, periodSummary }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to save marketing entry";
    console.error("marketing daily submit failed", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
