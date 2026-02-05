"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEarningsSummaryForUser = getEarningsSummaryForUser;
const prisma_1 = require("@/lib/prisma");
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const commission_1 = require("./commission");
const onlineCommission_1 = require("./onlineCommission");
const marketingPeriodTotals_1 = require("@/lib/marketingPeriodTotals");
const supportEntries_1 = require("@/lib/supportEntries");
const posReceiptSummary_1 = require("@/lib/posReceiptSummary");
async function getEarningsSummaryForUser(opts) {
    const now = opts.asOf ?? new Date();
    const tradingPeriod = (0, tradingPeriod_1.getTradingPeriodFor)(now);
    const periodKey = `${tradingPeriod.start.toISOString().split("T")[0]}_${tradingPeriod.end.toISOString().split("T")[0]}`;
    const periodLabel = tradingPeriod.label;
    const { period, tiers, tradingPeriod: periodInfo } = await (0, commission_1.getOrCreateCommissionPeriod)(now);
    const start = periodInfo.startDate ?? periodInfo.start;
    const end = periodInfo.endDate ?? periodInfo.end;
    const snapshots = await prisma_1.prisma.profitSnapshot.findMany({
        where: {
            orderItem: {
                order: {
                    attendantId: opts.userId,
                    createdAt: { gte: start, lte: end },
                },
            },
        },
        select: {
            revenue: true,
            profit: true,
        },
    });
    let totalSales = 0;
    let totalProfit = 0;
    for (const row of snapshots) {
        totalSales += Number(row.revenue ?? 0);
        totalProfit += Number(row.profit ?? 0);
    }
    const reports = await prisma_1.prisma.dailyReport.findMany({
        where: { userId: opts.userId, date: { gte: start, lte: end } },
        select: {
            newProducts: true,
            productsEdited: true,
            copiesUploaded: true,
        },
    });
    let newProducts = 0;
    let editedProducts = 0;
    let copiedProducts = 0;
    for (const report of reports) {
        newProducts += report.newProducts ?? 0;
        editedProducts += report.productsEdited ?? 0;
        copiedProducts += report.copiesUploaded ?? 0;
    }
    const marketingSummary = await (0, marketingPeriodTotals_1.summarizeMarketingReportsForPeriod)({
        userId: opts.userId,
        period: tradingPeriod,
    });
    const marketingTotals = marketingSummary.totals;
    // Also include support aggregates and dedupe per-receipt to avoid double-counting
    const supportSummary = await (0, supportEntries_1.getSupportPeriodAggregates)({ userId: opts.userId, period: tradingPeriod });
    const marketingPer = marketingSummary?.perReceipts ?? {};
    const supportPer = supportSummary?.perReceipts ?? {};
    const merged = new Map();
    for (const [k, v] of Object.entries(marketingPer)) {
        merged.set(k, { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 });
    }
    for (const [k, v] of Object.entries(supportPer)) {
        const supportObj = { sales: v.sales ?? 0, profit: v.profit ?? 0, items: v.items ?? 0, mpesa: v.mpesa ?? 0, cash: v.cash ?? 0 };
        if (merged.has(k)) {
            // If marketing provided an entry but it lacks profit information while
            // the support entry has profit, prefer the support entry so we don't
            // lose buying-price-derived profit (handles unpriced marketing rows).
            const existing = merged.get(k);
            if ((existing.profit ?? 0) <= 0 && (supportObj.profit ?? 0) > 0) {
                merged.set(k, supportObj);
            }
            continue;
        }
        merged.set(k, supportObj);
    }
    let mergedSales = 0;
    let mergedProfit = 0;
    let mergedItems = 0;
    for (const [, v] of merged) {
        mergedSales += v.sales;
        mergedProfit += v.profit;
        mergedItems += v.items ?? 0;
    }
    const user = await prisma_1.prisma.user.findUnique({ where: { id: opts.userId }, select: { email: true } });
    const isJeniffer = (user?.email ?? "").toLowerCase() === "jeniffer@betech.co.ke";
    const isBrendah = (user?.email ?? "").toLowerCase() === "brendah@betech.co.ke";
    let posSummary = null;
    if (isJeniffer) {
        posSummary = await (0, posReceiptSummary_1.summarizePosReceiptsForPeriod)({ start, end });
        totalSales = posSummary.totalSales;
        totalProfit = posSummary.totalProfit;
    }
    else if (mergedSales > totalSales) {
        totalSales = mergedSales;
        totalProfit = mergedProfit;
    }
    // If Brendah, always prefer the deduped merged totals (marketing + support)
    // and ensure unpriced receipts (which produce zero profit) are excluded by
    // the upstream summarizers. We'll compute her commission using the
    // direct-sales formula + product commissions and ignore persisted ledger
    // overrides.
    if (isBrendah) {
        totalSales = mergedSales;
        totalProfit = mergedProfit;
    }
    const plan = await prisma_1.prisma.attendantCompPlan.findUnique({ where: { attendantId: opts.userId } });
    const baseSalary = plan?.baseSalary ?? 0;
    const transportAllowance = plan?.defaultTransportAllowance ?? 0;
    // Build two common periodKey formats used in various parts of the app so we
    // can find adjustments regardless of which format was used when creating them.
    // 1) YYYY-MM-DD_YYYY-MM-DD (used by some endpoints)
    // 2) <ISO_WITH_TZ>_<ISO_WITH_TZ> (used by admin/check scripts)
    const startDateOnly = tradingPeriod.start.toISOString().split("T")[0];
    const endDateOnly = tradingPeriod.end.toISOString().split("T")[0];
    const periodKeyDateOnly = `${startDateOnly}_${endDateOnly}`;
    const periodKeyIso = `${tradingPeriod.start.toISOString()}_${tradingPeriod.end.toISOString()}`;
    const adjustments = await prisma_1.prisma.attendantPayrollAdjustment.findMany({
        where: {
            attendantId: opts.userId,
            OR: [{ periodKey: periodKeyDateOnly }, { periodKey: periodKeyIso }],
        },
        orderBy: { createdAt: "desc" },
    });
    // Respect the adjustmentKind (ADDITION | DEDUCTION) when computing totals.
    // Some adjustment types (e.g., BONUS, COMMISSION_TOPUP) are meaningful as additions,
    // while CHAMA/LATENESS/DISCIPLINE/OTHER are deductions — but we still honour the
    // explicit adjustmentKind to allow admin-created additions or deductions.
    let bonusTotal = 0;
    let commissionTopUpTotal = 0;
    let chamaTotal = 0;
    let latenessTotal = 0;
    let disciplineTotal = 0;
    let otherDeductionsTotal = 0;
    const adjustmentEntries = adjustments.map((a) => ({
        id: a.id,
        label: a.label,
        amount: a.amount ?? 0,
        adjustmentType: a.adjustmentType,
        adjustmentKind: String(a.adjustmentKind ?? "DEDUCTION").toUpperCase(),
    }));
    for (const a of adjustments) {
        const kind = String(a.adjustmentKind ?? "DEDUCTION").toUpperCase();
        const amt = Number(a.amount ?? 0);
        const isAddition = kind === "ADDITION";
        const t = a.adjustmentType;
        if (t === "BONUS") {
            if (isAddition)
                bonusTotal += amt;
            else
                bonusTotal -= amt;
        }
        else if (t === "COMMISSION_TOPUP") {
            if (isAddition)
                commissionTopUpTotal += amt;
            else
                commissionTopUpTotal -= amt;
        }
        else if (t === "CHAMA") {
            if (!isAddition)
                chamaTotal += amt;
            else
                chamaTotal -= amt;
        }
        else if (t === "LATENESS") {
            if (!isAddition)
                latenessTotal += amt;
            else
                latenessTotal -= amt;
        }
        else if (t === "DISCIPLINE") {
            if (!isAddition)
                disciplineTotal += amt;
            else
                disciplineTotal -= amt;
        }
        else if (t === "OTHER") {
            if (!isAddition)
                otherDeductionsTotal += amt;
            else
                otherDeductionsTotal -= amt;
        }
        else {
            // unknown types: treat as deduction by default
            if (!isAddition)
                otherDeductionsTotal += amt;
            else
                bonusTotal += amt;
        }
    }
    // Load any existing CommissionLedger for this attendant/period. Prefer
    // the most-recent ledger (by `createdAt`) and favour ledgers that have a
    // persisted `commissionTotal` > 0 so recomputes/upserts are shown in the UI.
    let ledger = null;
    try {
        // First try exact unique lookup
        const exact = await prisma_1.prisma.commissionLedger.findUnique({
            where: {
                userId_periodStart_periodEnd: {
                    userId: opts.userId,
                    periodStart: tradingPeriod.start,
                    periodEnd: tradingPeriod.end,
                },
            },
        });
        if (exact) {
            ledger = {
                grossCommission: Number(exact.grossCommission ?? 0),
                netCommission: Number(exact.netCommission ?? 0),
                penalties: Number(exact.penalties ?? 0),
                commissionTotal: Number(exact.commissionTotal ?? 0),
                detail: exact.detail ?? null,
            };
        }
        else {
            // If no exact row, collect candidate ledgers that either embed the
            // periodKey in `detail.marketing.periodKey` or have a near periodStart.
            const periodKeyDateOnlyLocal = `${tradingPeriod.start.toISOString().split("T")[0]}_${tradingPeriod.end.toISOString().split("T")[0]}`;
            const windowMs = 24 * 60 * 60 * 1000;
            const candidates = await prisma_1.prisma.$queryRaw `
        SELECT id, "grossCommission", "netCommission", "penalties", "commissionTotal", detail, "createdAt"
        FROM "CommissionLedger"
        WHERE "userId" = ${opts.userId}
          AND (
            (detail->'marketing'->>'periodKey') = ${tradingPeriod.key}
            OR (detail->'marketing'->>'periodKey') = ${periodKeyDateOnlyLocal}
            OR ("periodStart" >= ${new Date(tradingPeriod.start.getTime() - windowMs)} AND "periodStart" <= ${new Date(tradingPeriod.start.getTime() + windowMs)})
          )
        ORDER BY "createdAt" DESC
        LIMIT 10
      `;
            if (Array.isArray(candidates) && candidates.length > 0) {
                // Prefer first candidate that has a positive commissionTotal
                let chosen = candidates.find((c) => Number(c.commissionTotal ?? 0) > 0) || candidates[0];
                ledger = {
                    grossCommission: Number(chosen.grossCommission ?? 0),
                    netCommission: Number(chosen.netCommission ?? 0),
                    penalties: Number(chosen.penalties ?? 0),
                    commissionTotal: Number(chosen.commissionTotal ?? 0),
                    detail: chosen.detail ?? null,
                };
            }
        }
    }
    catch (err) {
        // best-effort: if ledger lookup fails, proceed with computed values
        ledger = null;
    }
    // Compute commission. For Brendah we use the direct-sales formula from
    // `computeDirectCommission`. For Jeniffer apply special prorated-tier
    // rule (base payouts + prorated share of next tier). Others use the
    // tiered calculation with a fallback percent based on profit.
    let salesCommission;
    let jenifferProgress = null;
    if (isJeniffer) {
        const res = (0, commission_1.computeJenifferProratedCommission)(totalSales, tiers.map((t) => ({ minSales: Number(t.minSales), maxSales: t.maxSales == null ? null : Number(t.maxSales), payoutFlat: Number(t.payoutFlat) })));
        salesCommission = Number(res.commission ?? 0);
        jenifferProgress = res;
    }
    else {
        const fallbackPercent = totalProfit > 0 ? 0.05 : 0;
        salesCommission = (0, commission_1.computeSalesCommissionFromTiers)(totalSales, totalProfit, tiers, fallbackPercent);
    }
    const { newProductCommission, copiedCommission, editedCommission } = (0, commission_1.computeProductCommissions)({
        newProducts,
        copiedProducts,
        editedProducts,
    });
    let computedGrossCommission = salesCommission + newProductCommission + copiedCommission + editedCommission + commissionTopUpTotal;
    if (isBrendah) {
        const direct = (0, onlineCommission_1.computeBrendahDirectCommission)(totalSales, totalProfit);
        salesCommission = direct.amount;
        computedGrossCommission = direct.amount + newProductCommission + copiedCommission + editedCommission + commissionTopUpTotal;
    }
    // Prefer a persisted `commissionTotal` when present (authoritative),
    // otherwise fall back to computed values. This ensures the UI quick-stats
    // reflect the ledger-upserted commission when admins have run a recompute.
    // For Brendah we always use the computed formula (ignore persisted ledger
    // overrides). For others prefer a persisted `commissionTotal` when present.
    let finalGrossCommission;
    const ledgerPersistedCommission = ledger && ledger.commissionTotal ? Number(ledger.commissionTotal) : 0;
    if (isBrendah) {
        finalGrossCommission = computedGrossCommission;
    }
    else if (ledgerPersistedCommission > 0) {
        finalGrossCommission = ledgerPersistedCommission;
    }
    else {
        finalGrossCommission = ledger && !isJeniffer ? ledger.grossCommission : computedGrossCommission;
    }
    const totalEarnings = baseSalary + transportAllowance + finalGrossCommission + bonusTotal;
    const totalDeductions = chamaTotal + latenessTotal + disciplineTotal + otherDeductionsTotal;
    const netPay = totalEarnings - totalDeductions;
    return {
        periodKey,
        periodLabel,
        totalSales,
        totalProfit,
        totalNewProducts: newProducts,
        totalEditedProducts: editedProducts,
        totalCopiedProducts: copiedProducts,
        totalItems: isJeniffer ? posSummary?.totalItems ?? 0 : mergedItems || 0,
        totalReceipts: isJeniffer ? posSummary?.totalReceipts ?? 0 : merged.size || 0,
        walkInsServed: 0,
        walkInsPurchased: 0,
        baseSalary,
        transportAllowance,
        salesCommission,
        newProductCommission,
        copiedCommission,
        editedCommission,
        grossCommission: finalGrossCommission,
        commission: finalGrossCommission,
        batteryEarnings: 0,
        bonusTotal,
        commissionTopUpTotal,
        chamaTotal,
        latenessTotal,
        disciplineTotal,
        otherDeductionsTotal,
        totalEarnings,
        totalDeductions,
        netPay,
        ledger: ledger ? ledger : null,
        adjustmentEntries,
    };
}
