import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/api";
import { getBranding } from "@/lib/branding";
import { launchChromiumBrowser } from "@/lib/pdf/chromium";
import { getOrCreateCommissionPeriod, computeJenifferProratedCommission, computeSalesCommissionFromTiers } from "@/lib/commission";
import { getOrCreateUserCommissionConfig } from "@/lib/userCommissionConfig";
import { computeBrendahDirectCommission } from "@/lib/onlineCommission";
import { canonicalReceiptNumber } from "@/lib/receiptGuard";
import { buildReceiptKey } from "@/lib/receiptKey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const currency = new Intl.NumberFormat("en-KE", {
  style: "currency",
  currency: "KES",
  maximumFractionDigits: 0,
});

const toNumber = (value: unknown): number => {
  if (value === null || typeof value === "undefined") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

function sanitizeFilename(value: string) {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function parseDateParam(value: string | null) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function extractSales(receipt: { totals?: any; data?: any; order?: any }) {
  const totals = receipt.totals ?? {};
  const data = receipt.data ?? {};
  return (
    toNumber(totals.sellingTotal) ||
    toNumber(totals.grandTotal) ||
    toNumber(totals.total) ||
    toNumber(totals.amount) ||
    toNumber(totals.subtotal) ||
    toNumber(data.total) ||
    toNumber(data.amount) ||
    toNumber(receipt.order?.totalAmount) ||
    0
  );
}

function extractProfit(receipt: { totals?: any; data?: any }, sales: number) {
  const totals = receipt.totals ?? {};
  const data = receipt.data ?? {};
  const candidate =
    toNumber(totals.profit) ||
    toNumber(data.profit) ||
    toNumber(totals.sellingTotal) - toNumber(totals.buyingTotal) ||
    toNumber(data.sellingTotal) - toNumber(data.buyingTotal);
  if (candidate !== 0) return candidate;
  const buying = toNumber(totals.buyingTotal) || toNumber(data.buyingTotal);
  if (buying > 0) return sales - buying;
  return 0;
}

function parseExplicitProfit(receipt: any): number | undefined {
  const p = receipt?.profit ?? receipt?.data?.profit ?? receipt?.totals?.profit;
  if (typeof p === "number" && Number.isFinite(p)) return p;
  if (typeof p === "string" && p.trim() !== "" && !Number.isNaN(Number(p))) return Number(p);
  return undefined;
}

const FALLBACK_TIERS = [
  { minSales: 500_000, maxSales: 1_000_000, payoutFlat: 10_000 },
  { minSales: 2_000_000, maxSales: 2_000_000, payoutFlat: 15_000 },
  { minSales: 3_000_000, maxSales: 3_000_000, payoutFlat: 20_000 },
  { minSales: 4_000_000, maxSales: 4_000_000, payoutFlat: 20_000 },
  { minSales: 5_000_000, maxSales: 5_000_000, payoutFlat: 20_000 },
  { minSales: 6_000_000, maxSales: 6_000_000, payoutFlat: 20_000 },
  { minSales: 7_000_000, maxSales: 7_000_000, payoutFlat: 20_000 },
  { minSales: 8_000_000, maxSales: 8_000_000, payoutFlat: 20_000 },
  { minSales: 9_000_000, maxSales: 9_000_000, payoutFlat: 20_000 },
  { minSales: 10_000_000, maxSales: 10_000_000, payoutFlat: 20_000 },
];
function renderHtml(opts: {
  title: string;
  attendantName: string;
  attendantEmail: string | null;
  startIso: string;
  endIso: string;
  letterheadUrl: string | null;
  totalSales: number;
  receiptCount: number;
  commissionKes: number;
  rows: Array<{
    receiptNumber: string;
    createdAt: string;
    customerName: string;
    total: number;
    paymentMethod: string;
    docType: string;
  }>;
}) {
  const letterheadBlock = opts.letterheadUrl
    ? `<div class="letterhead"><img src="${opts.letterheadUrl}" alt="Letterhead" /></div>`
    : "";

  const rowsHtml = opts.rows
    .map(
      (r) => `
      <tr>
        <td>${r.createdAt}</td>
        <td>${r.receiptNumber}</td>
        <td>${r.docType}</td>
        <td>${r.customerName}</td>
        <td>${r.paymentMethod}</td>
        <td style="text-align:right">${currency.format(r.total)}</td>
      </tr>`,
    )
    .join("\n");

  return `
  <html>
    <head>
      <meta charset="utf-8" />
      <title>${opts.title}</title>
      <style>
        @page { size: A4; margin: 22mm 14mm; }
        body { font-family: Inter, system-ui, -apple-system, sans-serif; color: #0f172a; }
        h1 { font-size: 18px; margin: 10px 0 6px; }
        .muted { color: #475569; font-size: 12px; }
        .summary { margin-top: 10px; padding: 10px 12px; border: 1px solid #e2e8f0; border-radius: 10px; background: #f8fafc; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 18px; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; font-size: 11.5px; margin-top: 14px; }
        th, td { padding: 8px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
        th { text-align: left; background: #f1f5f9; color: #334155; font-size: 10.5px; text-transform: uppercase; letter-spacing: .05em; }
        .letterhead { margin-bottom: 10px; }
        .letterhead img { width: 100%; max-height: 120px; object-fit: contain; }
      </style>
    </head>
    <body>
      ${letterheadBlock}
      <div class="muted">Generated: ${new Date().toISOString()}</div>
      <h1>${opts.title}</h1>
      <div class="muted">Direct sales (POS receipts)</div>
      <div class="muted">Range: ${opts.startIso} – ${opts.endIso}</div>

      <div class="summary">
        <div class="summary-grid">
          <div><strong>Attendant:</strong> ${opts.attendantName}</div>
          <div><strong>Email:</strong> ${opts.attendantEmail ?? "-"}</div>
          <div><strong>Receipts:</strong> ${opts.receiptCount}</div>
          <div><strong>Total sales:</strong> ${currency.format(opts.totalSales)}</div>
          <div><strong>Commission (KES):</strong> ${currency.format(opts.commissionKes)}</div>
        </div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width: 110px">Date</th>
            <th style="width: 170px">Receipt</th>
            <th style="width: 90px">Doc</th>
            <th>Customer</th>
            <th style="width: 80px">Pay</th>
            <th style="width: 120px; text-align:right">Amount</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml || `<tr><td colspan="6" class="muted">No POS receipts found for this range.</td></tr>`}
        </tbody>
      </table>
    </body>
  </html>
  `;
}

export async function GET(req: Request) {
  const authz = await requireRole("ADMIN");
  if (!authz.ok) return authz.res;

  const url = new URL(req.url);
  const debug = url.searchParams.get("debug") === "1" || url.searchParams.get("debug") === "true";
  const attendantId = (url.searchParams.get("attendantId") || "").trim();
  const rawStart = url.searchParams.get("start");
  const rawEnd = url.searchParams.get("end");
  const startParam = parseDateParam(rawStart);
  const endParam = parseDateParam(rawEnd);
  const docTypeParam = (url.searchParams.get("docType") || "").trim();
  const docType = docTypeParam ? docTypeParam.toUpperCase() : null;

  if (!attendantId) {
    return NextResponse.json({ error: "Missing attendantId" }, { status: 400 });
  }
  if (!startParam || !endParam) {
    return NextResponse.json({ error: "Missing start/end" }, { status: 400 });
  }

  const attendant = await prisma.user.findUnique({
    where: { id: attendantId },
    select: { id: true, name: true, email: true },
  });
  const attendantName = (attendant?.name ?? attendant?.email ?? attendantId).toString();
  const attendantEmail = attendant?.email ?? null;

  const ownerOr: Prisma.ReceiptWhereInput[] = [
    { issuedById: attendantId },
    { order: { attendantId } },
    { data: { path: ["attendantId"], equals: attendantId } as any },
    { data: { path: ["servedBy"], equals: attendantId } as any },
    { data: { path: ["servedById"], equals: attendantId } as any },
    { data: { path: ["issuedById"], equals: attendantId } as any },
    { order: { metadata: { path: ["attendantId"], equals: attendantId } as any } },
    { order: { metadata: { path: ["servedBy"], equals: attendantId } as any } },
    { order: { metadata: { path: ["servedById"], equals: attendantId } as any } },
    // Legacy/edge cases: some receipts store only the attendant's name in JSON.
    { data: { path: ["attendantName"], equals: attendantName } as any },
    { data: { path: ["issuedByName"], equals: attendantName } as any },
  ];
  if (attendantEmail) {
    ownerOr.push(
      { issuedBy: { email: attendantEmail } },
      { order: { attendant: { email: attendantEmail } } },
      { data: { path: ["attendantEmail"], equals: attendantEmail } as any },
      { data: { path: ["servedByEmail"], equals: attendantEmail } as any },
      { data: { path: ["issuedByEmail"], equals: attendantEmail } as any },
    );
  }

  // Load receipts directly from POS Receipt table.
  const receiptWhere = {
    generatedAt: { gte: startParam, lte: endParam },
    ...(docType ? { docType: docType as any } : {}),
    AND: [
      {
        OR: ownerOr,
      },
    ],
  } as any;

  const isPodReceipt = (r: any) => Boolean(r?.data && typeof r.data === "object" && (r.data as any).podDelivery);
  const podStatusOf = (r: any) => ((r?.data as any)?.podDelivery?.status ?? "").toString().toLowerCase();
  const isPodPaid = (r: any) => Boolean((r?.data as any)?.podDelivery?.paidAt);
  const isPosPaid = (r: any) => {
    const paymentStatus = (r?.order?.paymentStatus ?? "").toString().toUpperCase().trim();
    if (!paymentStatus) return false;
    return paymentStatus === "PAID";
  };
  const isPodSettledForSales = (r: any) => {
    if (!isPodReceipt(r)) return false;
    if (podStatusOf(r) === "pending") return false;
    return isPodPaid(r) || isPosPaid(r);
  };
  const shouldIncludeForSales = (r: any) => {
    // Mirror the admin summary logic: only include paid receipts by default.
    if (isPodReceipt(r)) return isPodSettledForSales(r);
    return isPosPaid(r);
  };

  if (debug) {
    const [rawCount, rawSample] = await Promise.all([
      prisma.receipt.count({ where: receiptWhere }),
      prisma.receipt.findMany({
        where: receiptWhere,
        orderBy: { generatedAt: "asc" },
        take: 20,
        select: {
          id: true,
          docType: true,
          generatedAt: true,
          receiptNumber: true,
          issuedById: true,
          data: true,
          order: { select: { orderNumber: true, attendantId: true, paymentStatus: true, totalAmount: true } },
        },
      }),
    ]);
    const filteredSample = rawSample.filter(shouldIncludeForSales);
    return NextResponse.json({
      ok: true,
      attendant: { id: attendantId, name: attendantName, email: attendantEmail },
      range: { start: startParam.toISOString(), end: endParam.toISOString() },
      docType,
      rawCount,
      filteredCountInSample: filteredSample.length,
      sample: rawSample,
      filteredSample,
      sampleBreakdown: {
        pod: rawSample.filter(isPodReceipt).length,
        podPending: rawSample.filter((r) => isPodReceipt(r) && podStatusOf(r) === "pending").length,
        podPaid: rawSample.filter((r) => isPodReceipt(r) && isPodPaid(r)).length,
        nonPod: rawSample.filter((r) => !isPodReceipt(r)).length,
        nonPodPaid: rawSample.filter((r) => !isPodReceipt(r) && isPosPaid(r)).length,
      },
    });
  }

  const receipts = await prisma.receipt.findMany({
    where: {
      ...receiptWhere,
    } as any,
    include: {
      order: {
        select: {
          orderNumber: true,
          customerName: true,
          totalAmount: true,
          paymentStatus: true,
          items: {
            select: {
              productId: true,
              quantity: true,
              orderCosts: { select: { unitCost: true } },
              profitSnapshots: {
                orderBy: { computedAt: "desc" },
                take: 1,
                select: { unitCost: true, profit: true, qty: true },
              },
              product: { select: { lastBuyingPrice: true } },
            },
          },
        },
      },
    },
    orderBy: { generatedAt: "asc" },
  });

  const filteredReceipts = receipts.filter(shouldIncludeForSales);

  // Optional fallback costs: latest ProductCost per productId (for receipts missing orderCosts/profitSnapshots).
  const productCostMap = new Map<string, number>();
  try {
    const productIds = new Set<string>();
    for (const r of filteredReceipts as any[]) {
      const items = (r?.order?.items ?? []) as any[];
      for (const it of items) {
        if (it?.productId) productIds.add(String(it.productId));
      }
    }
    const ids = Array.from(productIds);
    if (ids.length > 0) {
      const costs = await prisma.productCost.findMany({
        where: { productId: { in: ids } },
        orderBy: [{ productId: "asc" }, { createdAt: "desc" }],
        distinct: ["productId"],
        select: { productId: true, price: true },
      });
      for (const c of costs) {
        const n = Number(c.price ?? 0);
        if (c.productId && Number.isFinite(n) && n > 0) {
          productCostMap.set(String(c.productId), n);
        }
      }
    }
  } catch {
    // Best-effort: ignore productCost lookup failures.
  }

  // Optional fallback costs: support ledger buying totals (for receipts lacking order costs).
  const supportBuyingTotals = new Map<string, number>();
  try {
    const candidates = new Set<string>();
    for (const r of filteredReceipts as any[]) {
      const orderRef = String(r?.order?.orderNumber ?? "");
      const receiptNumber = String(r?.receiptNumber ?? "");
      const key = buildReceiptKey(orderRef || receiptNumber, r.id);
      const normalizedOrder = canonicalReceiptNumber(orderRef);
      const normalizedReceipt = canonicalReceiptNumber(receiptNumber);
      if (orderRef) candidates.add(orderRef);
      if (receiptNumber) candidates.add(receiptNumber);
      if (key) candidates.add(key);
      if (normalizedOrder) candidates.add(normalizedOrder);
      if (normalizedReceipt) candidates.add(normalizedReceipt);
    }
    const candidateArray = Array.from(candidates).filter((v) => v && v.length > 0);
    if (candidateArray.length > 0) {
      const ledgerEntries = await prisma.supportReceipt.findMany({
        where: {
          OR: [{ receiptNumber: { in: candidateArray } }, { receiptKey: { in: candidateArray } }],
        },
        select: {
          receiptNumber: true,
          receiptKey: true,
          buyingTotal: true,
          items: { select: { buyingPrice: true } },
        },
      });
      for (const entry of ledgerEntries as any[]) {
        const explicitBuyingTotal = Number(entry.buyingTotal ?? 0);
        const itemsSum = Array.isArray(entry.items)
          ? entry.items.reduce((sum: number, it: any) => sum + Number(it?.buyingPrice ?? 0), 0)
          : 0;
        const buyingTotal = explicitBuyingTotal > 0 ? explicitBuyingTotal : itemsSum;
        if (!(Number.isFinite(buyingTotal) && buyingTotal > 0)) continue;

        const keys = [entry.receiptNumber, entry.receiptKey]
          .map((k: any) => (typeof k === "string" ? k : ""))
          .filter((k) => k);
        for (const k of keys) {
          if (!supportBuyingTotals.has(k)) supportBuyingTotals.set(k, buyingTotal);
          const normalized = canonicalReceiptNumber(k);
          if (normalized && !supportBuyingTotals.has(normalized)) supportBuyingTotals.set(normalized, buyingTotal);
        }
      }
    }
  } catch {
    // Best-effort: ignore support ledger lookup failures.
  }

  const computeReceiptProfitFromCosts = (receipt: any) => {
    const selling = extractSales(receipt);
    const orderRef = String(receipt?.order?.orderNumber ?? "");
    const receiptNumber = String(receipt?.receiptNumber ?? "");
    const keyCandidates = [
      orderRef,
      receiptNumber,
      buildReceiptKey(orderRef || receiptNumber, receipt.id),
      canonicalReceiptNumber(orderRef),
      canonicalReceiptNumber(receiptNumber),
    ].filter((v): v is string => Boolean(v));
    let supportBuying: number | undefined;
    for (const k of keyCandidates) {
      const v = supportBuyingTotals.get(k);
      if (typeof v === "number" && v > 0) {
        supportBuying = v;
        break;
      }
    }

    const aggregateCostRaw = Number((receipt as any)?.buyingTotal ?? (receipt.data as any)?.buyingTotal ?? 0);
    const aggregateCost = supportBuying && supportBuying > 0 ? supportBuying : aggregateCostRaw;

    const items = (receipt?.order?.items ?? []) as any[];
    const perItemUnitCosts = items.map((item: any) => {
      const costs = Array.isArray(item?.orderCosts) ? item.orderCosts : [];
      const buyingSum = costs.reduce((sum: number, c: any) => sum + Number(c?.unitCost ?? 0), 0);
      const snap = Array.isArray(item?.profitSnapshots) ? item.profitSnapshots[0] : null;
      const snapUnitCost = snap ? Number(snap?.unitCost ?? 0) : 0;
      const productLastBuying = Number(item?.product?.lastBuyingPrice ?? 0) || 0;
      const productCost = productCostMap.get(String(item?.productId ?? "")) ?? 0;
      const fallbackUnitCost =
        snapUnitCost > 0
          ? snapUnitCost
          : productLastBuying > 0
            ? productLastBuying
            : productCost > 0
              ? productCost
              : 0;
      return buyingSum > 0 ? buyingSum : fallbackUnitCost;
    });

    const costFromItems = items.reduce((sum: number, item: any, idx: number) => {
      const qty = Math.max(1, Math.trunc(Number(item?.quantity ?? 1)));
      const unit = Number(perItemUnitCosts[idx] ?? 0);
      return sum + unit * qty;
    }, 0);

    const allItemsPriced = items.length > 0 && perItemUnitCosts.every((u: number) => Number(u) > 0);
    const hasAggregateCost = Number.isFinite(aggregateCost) && aggregateCost > 0;
    const explicitProfit = parseExplicitProfit(receipt);

    if (hasAggregateCost || allItemsPriced) {
      const buyingSum = hasAggregateCost ? aggregateCost : costFromItems;
      return { profit: selling - buyingSum, hasCost: true };
    }
    if (explicitProfit !== undefined) {
      return { profit: explicitProfit, hasCost: false };
    }
    // No cost/pricing info → profit unknown; treat as 0 for commission safety.
    return { profit: 0, hasCost: false };
  };

  const rows = filteredReceipts.map((r: any) => {
    const total = extractSales(r);
    const receiptNumber = (r.receiptNumber ?? r.order?.orderNumber ?? r.id).toString();
    const customerName = (r.order?.customerName ?? r.data?.customerName ?? "").toString() || "—";
    const paymentMethod = (r.data?.paymentMethod ?? r.totals?.paymentMethod ?? "MPESA").toString().toUpperCase();
    const createdAt = new Date(r.generatedAt ?? r.createdAt ?? new Date()).toISOString().slice(0, 10);
    return {
      receiptNumber,
      createdAt,
      customerName,
      total,
      paymentMethod: paymentMethod === "CASH" ? "CASH" : "MPESA",
      docType: String(r.docType ?? "RECEIPT"),
    };
  });

  const receiptCount = rows.length;
  const totalSales = rows.reduce((sum, r) => sum + Number(r.total ?? 0), 0);
  const totalProfit = filteredReceipts.reduce((sum: number, r: any) => sum + computeReceiptProfitFromCosts(r).profit, 0);

  const commissionConfig = await getOrCreateUserCommissionConfig(attendantId);
  const { tiers } = await getOrCreateCommissionPeriod(startParam);

  let commissionKes = 0;
  if (commissionConfig.salesCommissionMode === "BRENDAH_DIRECT") {
    commissionKes = computeBrendahDirectCommission(totalSales, totalProfit).amount;
  } else if (commissionConfig.salesCommissionMode === "JENIFFER_PRORATED") {
    const res = computeJenifferProratedCommission(
      totalSales,
      tiers.map((t) => ({
        minSales: Number(t.minSales),
        maxSales: t.maxSales == null ? null : Number(t.maxSales),
        payoutFlat: Number(t.payoutFlat),
      })),
    );
    commissionKes = Math.round(Number(res.commission ?? 0));
  } else {
    const fallbackPercent = totalProfit > 0 ? 0.05 : 0;
    commissionKes = Math.round(computeSalesCommissionFromTiers(totalSales, totalProfit, tiers as any, fallbackPercent));
  }

  const branding = await getBranding();
  const rawLetterhead = (branding as any)?.letterheadUrl ?? null;
  const letterheadUrl =
    rawLetterhead && typeof rawLetterhead === "string"
      ? rawLetterhead.startsWith("http")
        ? rawLetterhead
        : new URL(rawLetterhead, url).toString()
      : null;

  const title = `${attendantName} POS direct sales report`;
  const startIso = (rawStart && rawStart.length >= 10 ? rawStart.slice(0, 10) : startParam.toISOString().slice(0, 10));
  const endIso = (rawEnd && rawEnd.length >= 10 ? rawEnd.slice(0, 10) : endParam.toISOString().slice(0, 10));
  const html = renderHtml({
    title,
    attendantName,
    attendantEmail,
    startIso,
    endIso,
    letterheadUrl,
    totalSales,
    receiptCount,
    commissionKes,
    rows,
  });

  const browser = await launchChromiumBrowser();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "networkidle0" });
  const pdfBuffer = await page.pdf({ format: "A4", printBackground: true });
  await browser.close();

  const filename = sanitizeFilename(`${attendantName} POS direct sales ${startIso} to ${endIso}.pdf`);
  return new Response(pdfBuffer, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
