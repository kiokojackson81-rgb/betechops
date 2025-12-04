import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextAuth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type SupportPricePayload = {
  receiptItemId: string;
  buyingPrice: number;
};

const SPECIAL_EMAIL = "jeniffer@betech.co.ke";

export async function POST(req: Request) {
  const session = (await getServerSession(authOptions as any)) as any;
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = (session.user as { role?: string }).role;
  const email = (session.user as { email?: string }).email?.toLowerCase();
  const allowPricing =
    role === "ADMIN" ||
    email === SPECIAL_EMAIL ||
    email === process.env.SUPPORT_PRICING_EMAIL?.toLowerCase();

  if (!allowPricing) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  let payload: SupportPricePayload | null = null;
  try {
    payload = (await req.json()) as SupportPricePayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  if (!payload?.receiptItemId || typeof payload.receiptItemId !== "string") {
    return NextResponse.json({ error: "receiptItemId is required" }, { status: 400 });
  }

  const parsedBuyingPrice = Number(payload.buyingPrice);
  if (!Number.isFinite(parsedBuyingPrice) || parsedBuyingPrice <= 0) {
    return NextResponse.json({ error: "buyingPrice must be a positive number" }, { status: 400 });
  }
  const roundedPrice = Math.round(parsedBuyingPrice);

  const receiptItem = await prisma.supportReceiptItem.findUnique({
    where: { id: payload.receiptItemId },
    include: {
      receipt: {
        include: {
          dailyEntry: true,
          items: true,
        },
      },
    },
  });

  if (!receiptItem || !receiptItem.receipt?.dailyEntry) {
    return NextResponse.json({ error: "Support receipt item not found" }, { status: 404 });
  }

  const entryId = receiptItem.receipt.dailyEntry.id;
  const previous = Number(receiptItem.buyingPrice ?? 0);
  const profitDelta = previous - roundedPrice; // negative when buying price increases (reduces profit)

  // derive a per-item selling value so callers (UI) can update quick-stats
  const receipt = receiptItem.receipt;
  const itemsCount = Math.max(1, (receipt.items || []).length);
  const sellingTotal = Number(receipt.sellingTotal ?? 0);
  const sellingPrice = Math.round(sellingTotal / itemsCount);

  await prisma.$transaction(async (tx) => {
    // update the receipt item
    await tx.supportReceiptItem.update({
      where: { id: receiptItem.id },
      data: { buyingPrice: roundedPrice },
    });

    // Recompute totalProfit for the whole daily entry in a safe, idempotent way
    const receipts = await tx.supportReceipt.findMany({
      where: { dailyEntryId: entryId },
      include: { items: true },
    });

    let recomputedTotalProfit = 0;
    for (const r of receipts) {
      const sell = Number(r.sellingTotal ?? 0);
      const cost = (r.items || []).reduce((s, it) => s + Number(it.buyingPrice ?? 0), 0);
      recomputedTotalProfit += sell - cost;
    }

    await tx.supportDailyEntry.update({
      where: { id: entryId },
      data: { totalProfit: recomputedTotalProfit },
    });
  });

  return NextResponse.json({
    ok: true,
    entryId,
    profitDelta,
    saleValue: sellingPrice,
    receiptTotal: sellingTotal,
    paymentMethod: receipt.paymentMethod ?? null,
  });
}
