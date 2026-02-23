import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { extractProfitTransactions, extractProfitTransactionsFromImage } from "@/lib/marketplaceProfitExtractor";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const auth = await requireRole(["ADMIN", "SUPERVISOR"]);
  if (!auth.ok) return auth.res;

  const contentType = req.headers.get("content-type") ?? "";
  const isMultipart = contentType.includes("multipart/form-data");

  let accountId = "";
  let buyingPriceKes: number | string | undefined;
  let transactionText = "";
  let imageFile: File | null = null;

  if (isMultipart) {
    const form = await req.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
    accountId = String(form.get("accountId") ?? "").trim();
    buyingPriceKes = form.get("buyingPriceKes") as any;
    transactionText = String(form.get("transactionText") ?? "").trim();
    const file = form.get("file");
    if (file && typeof file === "object" && "arrayBuffer" in (file as any)) {
      imageFile = file as File;
    }
  } else {
    const body = (await req.json().catch(() => null)) as
      | {
          accountId?: string;
          buyingPriceKes?: number | string;
          transactionText?: string;
        }
      | null;
    if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    accountId = (body.accountId ?? "").trim();
    buyingPriceKes = body.buyingPriceKes;
    transactionText = (body.transactionText ?? "").trim();
  }

  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  const account = await prisma.marketplaceAccount.findUnique({
    where: { id: accountId },
    select: { id: true, platform: true, displayName: true, isActive: true },
  });
  if (!account) return NextResponse.json({ error: "Shop account not found" }, { status: 404 });
  if (!account.isActive) return NextResponse.json({ error: "Shop account is inactive" }, { status: 400 });

  const buying = typeof buyingPriceKes === "string" ? Number(buyingPriceKes) : buyingPriceKes;
  if (typeof buying !== "number" || !Number.isFinite(buying) || buying < 0) {
    return NextResponse.json({ error: "buyingPriceKes must be a non-negative number" }, { status: 400 });
  }

  const rawText = transactionText;
  if (!rawText && !imageFile) return NextResponse.json({ error: "transactionText (or image file) is required" }, { status: 400 });

  let extractedList = [] as Awaited<ReturnType<typeof extractProfitTransactions>>;
  let effectiveText = rawText;
  if (!effectiveText && imageFile) {
    const buf = Buffer.from(await imageFile.arrayBuffer());
    const mime = imageFile.type || "image/png";
    const dataUrl = `data:${mime};base64,${buf.toString("base64")}`;
    const img = await extractProfitTransactionsFromImage({ dataUrl });
    effectiveText = img.extractedText || effectiveText;
    extractedList = img.transactions;
  } else {
    extractedList = await extractProfitTransactions(effectiveText, { max: 25 });
  }

  if (extractedList.length === 0) return NextResponse.json({ error: "No transactions detected" }, { status: 400 });

  const items = extractedList.map((extracted) => {
    const netPayout = extracted.itemPriceCredit.amount + extracted.commission.amount + extracted.shippingFee.amount;
    const profit = netPayout - buying;
    const marginPct = netPayout !== 0 ? (profit / netPayout) * 100 : 0;
    const commissionRatePct =
      extracted.itemPriceCredit.amount !== 0 ? (Math.abs(extracted.commission.amount) / extracted.itemPriceCredit.amount) * 100 : 0;

    return {
      extracted: {
        method: extracted.method,
        confidence: extracted.confidence,
        notes: extracted.notes,
        date: extracted.date.toISOString(),
        currency: extracted.currency,
        item_price_credit: extracted.itemPriceCredit,
        commission: extracted.commission,
        shipping_fee: extracted.shippingFee,
      },
      computed: {
        netPayout,
        buyingPriceKes: buying,
        profit,
        marginPct,
        commissionRatePct,
        isLoss: profit < 0,
      },
    };
  });

  const lowConfidence = items.find((it) => (it.extracted.confidence ?? 0) < 0.7);
  if (lowConfidence) {
    return NextResponse.json(
      { error: "Low confidence extraction. Please paste a more complete transaction block.", confidence: lowConfidence.extracted.confidence, notes: lowConfidence.extracted.notes },
      { status: 400 },
    );
  }

  const totals = items.reduce(
    (acc, it) => {
      acc.netPayout += it.computed.netPayout;
      acc.profit += it.computed.profit;
      acc.lossCount += it.computed.isLoss ? 1 : 0;
      return acc;
    },
    { netPayout: 0, profit: 0, lossCount: 0 },
  );

  return NextResponse.json({
    mode: items.length > 1 ? "batch" : "single",
    account: { id: account.id, displayName: account.displayName, platform: account.platform },
    rawText: effectiveText,
    items,
    totals,
  });
}
