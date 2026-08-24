import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import {
  getReceiptProjectCompletionDate,
  isReceiptProjectRecognizedForSales,
  readReceiptProjectFlow,
} from "../src/lib/receiptProjects";
import { getTradingPeriodFor } from "../src/lib/tradingPeriod";

dotenv.config({ path: ".env.local", override: true });
const prisma = new PrismaClient();

const canonicalReceiptNumber = (value?: string | null) =>
  String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[\s\-_]+/g, "")
    .replace(/[^A-Z0-9]/g, "");

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

const toNumber = (value: unknown) => {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? number : 0;
};

const groupBy = <T>(rows: T[], keyFor: (row: T) => string | null) => {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return [...groups.entries()].filter(([, group]) => group.length > 1);
};

async function main() {
  const period = getTradingPeriodFor(new Date());

  const [receipts, marketingReceipts, supportReceipts, supportSales, marketingSales] = await Promise.all([
    prisma.receipt.findMany({
      where: {
        OR: [
          { generatedAt: { gte: period.start, lte: period.end } },
          {
            AND: [
              { createdAt: { lte: period.end } },
              { data: { path: ["projectFlow", "isProject"], equals: true } },
            ],
          },
        ],
      },
      select: {
        id: true,
        orderId: true,
        receiptNumber: true,
        generatedAt: true,
        createdAt: true,
        totals: true,
        data: true,
        order: {
          select: {
            orderNumber: true,
            customerName: true,
            customerPhone: true,
            customerEmail: true,
            totalAmount: true,
            paymentStatus: true,
            status: true,
            items: {
              select: { productId: true, quantity: true, sellingPrice: true },
            },
          },
        },
      },
    }),
    prisma.marketingReceipt.findMany({
      where: { dailyEntry: { date: { gte: period.start, lte: period.end } } },
      select: { id: true, receiptNumber: true, sellingTotal: true, dailyEntryId: true },
    }),
    prisma.supportReceipt.findMany({
      where: { dailyEntry: { date: { gte: period.start, lte: period.end } } },
      select: { id: true, receiptNumber: true, sellingTotal: true, dailyEntryId: true },
    }),
    prisma.supportSale.findMany({
      where: { createdAt: { gte: period.start, lte: period.end } },
      select: { id: true, receiptNumber: true, product: true, sellingPrice: true, buyingPrice: true },
    }),
    prisma.marketingSale.findMany({
      where: { createdAt: { gte: period.start, lte: period.end } },
      select: { id: true, receiptNumber: true, product: true, sellingPrice: true, buyingPrice: true, dailySaleId: true },
    }),
  ]);

  const candidates = receipts.map((receipt) => {
    const data = receipt.data && typeof receipt.data === "object" && !Array.isArray(receipt.data)
      ? receipt.data as Record<string, unknown>
      : {};
    const flow = readReceiptProjectFlow(data.projectFlow);
    const isProject = Boolean(flow?.isProject);
    const recognitionDate =
      getReceiptProjectCompletionDate(data.projectFlow, undefined, receipt.generatedAt ?? receipt.createdAt) ??
      receipt.generatedAt ??
      receipt.createdAt;
    const inPeriod = recognitionDate >= period.start && recognitionDate <= period.end;
    const isPod = Boolean(data.podDelivery && typeof data.podDelivery === "object");
    const pod = isPod ? data.podDelivery as Record<string, unknown> : {};
    const podStatus = String(pod.status ?? "").toLowerCase();
    const paid = String(receipt.order.paymentStatus ?? "").toUpperCase() === "PAID";
    const settled = isPod ? podStatus !== "pending" && (Boolean(pod.paidAt) || paid) : paid;
    const projectRecognized = !isProject || isReceiptProjectRecognizedForSales(data.projectFlow);
    const total = toNumber((receipt.totals as Record<string, unknown> | null)?.total) || toNumber(receipt.order.totalAmount);
    const itemSignature = receipt.order.items
      .map((item) => `${item.productId}:${item.quantity}:${toNumber(item.sellingPrice)}`)
      .sort()
      .join("|");
    const customerIdentity =
      normalizeText(receipt.order.customerPhone) ||
      normalizeText(receipt.order.customerEmail) ||
      normalizeText(receipt.order.customerName);
    const recognitionDay = recognitionDate.toISOString().slice(0, 10);

    return {
      id: receipt.id,
      orderId: receipt.orderId,
      orderNumber: receipt.order.orderNumber,
      receiptNumber: receipt.receiptNumber,
      canonicalOrder: canonicalReceiptNumber(receipt.order.orderNumber),
      canonicalReceipt: canonicalReceiptNumber(receipt.receiptNumber ?? undefined),
      customer: receipt.order.customerName,
      total,
      isProject,
      projectStage: flow?.stage ?? null,
      projectPaymentStatus: flow?.paymentStatus ?? null,
      orderPaymentStatus: receipt.order.paymentStatus,
      orderStatus: receipt.order.status,
      recognitionDate: recognitionDate.toISOString(),
      eligible: inPeriod && settled && projectRecognized,
      projectFingerprint: isProject && customerIdentity
        ? `${customerIdentity}|${total}|${recognitionDay}|${itemSignature}`
        : null,
    };
  });

  const eligible = candidates.filter((receipt) => receipt.eligible);
  const duplicateOrderIds = groupBy(eligible, (receipt) => receipt.orderId);
  const duplicateOrderNumbers = groupBy(eligible, (receipt) => receipt.canonicalOrder);
  const duplicateReceiptNumbers = groupBy(eligible, (receipt) => receipt.canonicalReceipt);
  const duplicateProjectFingerprints = groupBy(
    eligible.filter((receipt) => receipt.isProject),
    (receipt) => receipt.projectFingerprint,
  );

  const ledgerRows = [
    ...marketingReceipts.map((row) => ({ ...row, source: "marketing" as const })),
    ...supportReceipts.map((row) => ({ ...row, source: "support" as const })),
  ];
  const posKeys = new Set(
    eligible.flatMap((receipt) => [receipt.canonicalOrder, receipt.canonicalReceipt].filter(Boolean) as string[]),
  );
  const ledgerKey = (row: typeof ledgerRows[number]) =>
    canonicalReceiptNumber(row.receiptNumber ?? undefined);
  const crossLedgerGroups = groupBy(ledgerRows, ledgerKey);
  const ledgerKeys = new Set(ledgerRows.map(ledgerKey).filter(Boolean) as string[]);
  const orphanLedgerRows = ledgerRows.filter((row) => {
    const key = ledgerKey(row);
    return key && !posKeys.has(key);
  });

  const rawEligibleSales = eligible.reduce((sum, receipt) => sum + receipt.total, 0);
  const uniqueByOrder = new Map<string, typeof eligible[number]>();
  for (const receipt of eligible) {
    uniqueByOrder.set(receipt.canonicalOrder || receipt.canonicalReceipt || receipt.id, receipt);
  }
  const uniquePosSales = [...uniqueByOrder.values()].reduce((sum, receipt) => sum + receipt.total, 0);
  const dashboardRecords = new Map<string, { source: string; total: number }>();
  for (const row of ledgerRows) {
    const key = ledgerKey(row) || `ID:${row.id}`;
    const existing = dashboardRecords.get(key);
    if (!existing || existing.source === "marketing") {
      dashboardRecords.set(key, { source: row.source, total: Number(row.sellingTotal ?? 0) });
    }
  }
  for (const receipt of eligible) {
    const key = receipt.canonicalOrder || receipt.canonicalReceipt || `ID:${receipt.id}`;
    dashboardRecords.set(key, { source: "pos", total: receipt.total });
  }
  const reconstructedDashboardSales = [...dashboardRecords.values()].reduce((sum, row) => sum + row.total, 0);
  const posIdentityByVariant = new Map<string, { eligible: boolean; preferredKey: string }>();
  for (const receipt of candidates) {
    const preferredKey = receipt.canonicalOrder || receipt.canonicalReceipt || `ID:${receipt.id}`;
    for (const variant of [receipt.canonicalOrder, receipt.canonicalReceipt].filter(Boolean) as string[]) {
      const existing = posIdentityByVariant.get(variant);
      posIdentityByVariant.set(variant, {
        eligible: Boolean(existing?.eligible || receipt.eligible),
        preferredKey: existing?.preferredKey || preferredKey,
      });
    }
  }
  const fixedDashboardRecords = new Map<string, { source: string; total: number }>();
  for (const row of ledgerRows) {
    const key = ledgerKey(row) || `ID:${row.id}`;
    const linkedPos = posIdentityByVariant.get(key);
    if (linkedPos?.eligible === false) continue;
    const preferredKey = linkedPos?.preferredKey || key;
    const existing = fixedDashboardRecords.get(preferredKey);
    if (!existing || existing.source === "marketing") {
      fixedDashboardRecords.set(preferredKey, { source: row.source, total: Number(row.sellingTotal ?? 0) });
    }
  }
  for (const receipt of eligible) {
    const key = receipt.canonicalOrder || receipt.canonicalReceipt || `ID:${receipt.id}`;
    fixedDashboardRecords.set(key, { source: "pos", total: receipt.total });
  }
  const fixedDashboardSales = [...fixedDashboardRecords.values()].reduce((sum, row) => sum + row.total, 0);
  const dashboardKeyMismatchRisks = eligible.filter((receipt) =>
    Boolean(
      receipt.canonicalOrder &&
      receipt.canonicalReceipt &&
      receipt.canonicalOrder !== receipt.canonicalReceipt &&
      ledgerKeys.has(receipt.canonicalReceipt),
    ),
  );
  const projectCandidates = candidates.filter((receipt) => receipt.isProject);
  const eligibleProjects = projectCandidates.filter((receipt) => receipt.eligible);
  const nonEligibleProjectLedgerMirrors = projectCandidates.filter((receipt) =>
    !receipt.eligible &&
    Boolean(
      (receipt.canonicalOrder && ledgerKeys.has(receipt.canonicalOrder)) ||
      (receipt.canonicalReceipt && ledgerKeys.has(receipt.canonicalReceipt)),
    ),
  );
  const receiptLikeOrphans = orphanLedgerRows.filter((row) => !ledgerKey(row)?.startsWith("MANUALWEEKLY"));
  const manualWeeklyOrphans = orphanLedgerRows.filter((row) => ledgerKey(row)?.startsWith("MANUALWEEKLY"));
  const duplicateSupportSales = groupBy(
    supportSales,
    (row) => `${canonicalReceiptNumber(row.receiptNumber)}|${normalizeText(row.product)}`,
  );
  const duplicateMarketingSales = groupBy(
    marketingSales.filter((row) => Boolean(row.dailySaleId)),
    (row) => row.dailySaleId,
  );
  const eligibleByVariant = new Map<string, typeof eligible[number]>();
  for (const receipt of eligible) {
    if (receipt.canonicalOrder) eligibleByVariant.set(receipt.canonicalOrder, receipt);
    if (receipt.canonicalReceipt) eligibleByVariant.set(receipt.canonicalReceipt, receipt);
  }
  const supportSalesByReceipt = new Map<string, typeof supportSales>();
  for (const row of supportSales) {
    const key = canonicalReceiptNumber(row.receiptNumber);
    if (!key) continue;
    const group = supportSalesByReceipt.get(key) ?? [];
    group.push(row);
    supportSalesByReceipt.set(key, group);
  }
  const supportSellingMismatches = [...supportSalesByReceipt.entries()]
    .map(([key, rows]) => {
      const linkedReceipt = eligibleByVariant.get(key);
      if (!linkedReceipt) return null;
      const recognizedSelling = rows.reduce((sum, row) => sum + Number(row.sellingPrice ?? 0), 0);
      return recognizedSelling === linkedReceipt.total
        ? null
        : {
            key,
            receiptId: linkedReceipt.id,
            receiptTotal: linkedReceipt.total,
            recognizedSelling,
            difference: recognizedSelling - linkedReceipt.total,
            saleRows: rows.length,
          };
    })
    .filter(Boolean);

  const compactGroups = (groups: Array<[string, typeof eligible]>) =>
    groups.map(([key, rows]) => ({
      key,
      count: rows.length,
      totalIfAllCounted: rows.reduce((sum, row) => sum + row.total, 0),
      rows: rows.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        receiptNumber: row.receiptNumber,
        customer: row.customer,
        total: row.total,
        projectStage: row.projectStage,
        projectPaymentStatus: row.projectPaymentStatus,
        orderPaymentStatus: row.orderPaymentStatus,
        orderStatus: row.orderStatus,
        recognitionDate: row.recognitionDate,
      })),
    }));

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    period: { label: period.label, start: period.start.toISOString(), end: period.end.toISOString() },
    reconstructedDashboard: {
      beforeFix: { totalSales: reconstructedDashboardSales, receiptsCount: dashboardRecords.size },
      afterFix: { totalSales: fixedDashboardSales, receiptsCount: fixedDashboardRecords.size },
      removedSales: reconstructedDashboardSales - fixedDashboardSales,
      removedReceipts: dashboardRecords.size - fixedDashboardRecords.size,
      posRecords: [...dashboardRecords.values()].filter((row) => row.source === "pos").length,
      ledgerOnlyRecords: [...dashboardRecords.values()].filter((row) => row.source !== "pos").length,
    },
    posReconciliation: {
      rawCandidates: candidates.length,
      eligibleReceipts: eligible.length,
      rawEligibleSales,
      uniquePosReceiptsByOrder: uniqueByOrder.size,
      uniquePosSales,
      ledgerOnlyOrKeyMismatchSales: reconstructedDashboardSales - uniquePosSales,
    },
    exactDuplicates: {
      repeatedOrderIds: compactGroups(duplicateOrderIds),
      repeatedOrderNumbers: compactGroups(duplicateOrderNumbers),
      repeatedReceiptNumbers: compactGroups(duplicateReceiptNumbers),
    },
    projectDuplicateCandidates: compactGroups(duplicateProjectFingerprints),
    projects: {
      candidates: projectCandidates.length,
      eligible: eligibleProjects.length,
      eligibleSales: eligibleProjects.reduce((sum, row) => sum + row.total, 0),
      keyMismatchDoubleCountRisks: dashboardKeyMismatchRisks
        .filter((row) => row.isProject)
        .map((row) => ({
          id: row.id,
          orderNumber: row.orderNumber,
          receiptNumber: row.receiptNumber,
          customer: row.customer,
          total: row.total,
          recognitionDate: row.recognitionDate,
        })),
      nonEligibleWithLedgerMirror: nonEligibleProjectLedgerMirrors.map((row) => ({
        id: row.id,
        orderNumber: row.orderNumber,
        receiptNumber: row.receiptNumber,
        customer: row.customer,
        total: row.total,
        projectStage: row.projectStage,
        projectPaymentStatus: row.projectPaymentStatus,
        orderPaymentStatus: row.orderPaymentStatus,
        orderStatus: row.orderStatus,
        recognitionDate: row.recognitionDate,
      })),
    },
    ledgers: {
      marketingRows: marketingReceipts.length,
      supportRows: supportReceipts.length,
      mirroredKeyGroups: crossLedgerGroups.length,
      receiptLikeOrphansWithoutEligiblePos: receiptLikeOrphans.map((row) => ({
        source: row.source,
        id: row.id,
        key: ledgerKey(row),
        sellingTotal: row.sellingTotal,
      })),
      manualWeeklyOrphans: {
        rows: manualWeeklyOrphans.length,
        sales: manualWeeklyOrphans.reduce((sum, row) => sum + Number(row.sellingTotal ?? 0), 0),
      },
    },
    recognizedSales: {
      supportRows: supportSales.length,
      duplicateSupportItemGroups: duplicateSupportSales.map(([key, rows]) => ({
        key,
        rows: rows.map((row) => ({ id: row.id, sellingPrice: row.sellingPrice, buyingPrice: row.buyingPrice })),
      })),
      supportSellingMismatches,
      marketingRows: marketingSales.length,
      duplicateMarketingDailySaleGroups: duplicateMarketingSales.map(([key, rows]) => ({
        key,
        rows: rows.map((row) => ({ id: row.id, receiptNumber: row.receiptNumber, product: row.product })),
      })),
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
