"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapPayrollToEarningsSummary = mapPayrollToEarningsSummary;
exports.mapPayrollToPayrollRow = mapPayrollToPayrollRow;
function mapPayrollToEarningsSummary(p, receiptsCount = 0) {
    if (!p)
        return null;
    const baseSalary = p.baseSalary ?? p.salary ?? 0;
    const direct = p.commissionDirect ?? p.directCommission ?? 0;
    const marketplaceJumia = p.commissionMarketplaceJumia ?? 0;
    const marketplaceKilimall = p.commissionMarketplaceKilimall ?? 0;
    const marketplaceTotal = marketplaceJumia + marketplaceKilimall > 0 ? marketplaceJumia + marketplaceKilimall : p.marketplaceCommission ?? 0;
    const totalCommission = p.commissionTotal ?? p.totalCommission ?? p.grossCommission ?? direct + marketplaceTotal;
    const chama = p.chamaTotal ?? p.deductions ?? 0;
    const lateness = p.latenessTotal ?? 0;
    const discipline = p.disciplineTotal ?? 0;
    const otherDeductions = p.otherDeductionsTotal ?? 0;
    const bonusTotal = p.bonusTotal ?? 0;
    const commissionTopUpTotal = p.commissionTopUpTotal ?? 0;
    const penalties = p.penalties ?? 0;
    return {
        periodKey: p.periodLabel ?? "",
        periodLabel: p.periodLabel ?? "",
        totalSales: 0,
        totalProfit: 0,
        totalNewProducts: 0,
        totalEditedProducts: 0,
        totalCopiedProducts: 0,
        totalItems: 0,
        totalReceipts: receiptsCount,
        walkInsServed: 0,
        walkInsPurchased: 0,
        baseSalary,
        transportAllowance: 0,
        salesCommission: totalCommission,
        newProductCommission: 0,
        copiedCommission: 0,
        editedCommission: 0,
        grossCommission: totalCommission,
        batteryEarnings: 0,
        bonusTotal,
        commissionTopUpTotal,
        chamaTotal: chama,
        latenessTotal: lateness,
        disciplineTotal: discipline,
        otherDeductionsTotal: otherDeductions,
        totalEarnings: baseSalary + totalCommission + bonusTotal + commissionTopUpTotal,
        totalDeductions: chama + lateness + discipline + otherDeductions + penalties,
        netPay: p.netPay ?? 0,
        ledger: null,
    };
}
function mapPayrollToPayrollRow(p, userId) {
    const salary = p?.baseSalary ?? p?.salary ?? 0;
    const direct = p?.commissionDirect ?? p?.directCommission ?? 0;
    const marketplaceJumia = p?.commissionMarketplaceJumia ?? 0;
    const marketplaceKilimall = p?.commissionMarketplaceKilimall ?? 0;
    const marketplaceTotal = marketplaceJumia + marketplaceKilimall > 0 ? marketplaceJumia + marketplaceKilimall : p?.marketplaceCommission ?? 0;
    const totalCommission = p?.commissionTotal ?? p?.totalCommission ?? p?.grossCommission ?? direct + marketplaceTotal;
    const chama = p?.chamaTotal ?? p?.deductions ?? 0;
    const lateness = p?.latenessTotal ?? 0;
    const discipline = p?.disciplineTotal ?? 0;
    const otherDeductions = p?.otherDeductionsTotal ?? 0;
    const bonus = p?.bonusTotal ?? 0;
    const commissionTopUp = p?.commissionTopUpTotal ?? 0;
    const penalties = p?.penalties ?? 0;
    const deductionTotal = chama + lateness + discipline + otherDeductions + penalties;
    return {
        attendantId: userId ?? "",
        name: undefined,
        email: undefined,
        attendantCategory: "DIRECT_SALES_OPS",
        isActive: true,
        baseSalary: salary,
        transportAllowance: 0,
        commission: totalCommission,
        commissionGross: totalCommission,
        commissionDirect: direct,
        commissionMarketplaceJumia: marketplaceJumia,
        commissionMarketplaceKilimall: marketplaceKilimall,
        commissionTotal: totalCommission,
        commissionBreakdown: p?.commissionBreakdown ?? null,
        bonusTotal: bonus + commissionTopUp,
        deductionTotal: deductionTotal,
        totalEarnings: salary + totalCommission + bonus + commissionTopUp,
        totalDeductions: deductionTotal,
        netPay: p?.netPay ?? 0,
        totalSales: 0,
        totalProfit: 0,
        totalReceipts: 0,
        totalItems: 0,
        newProducts: 0,
        editedProducts: 0,
        copiedProducts: 0,
        adjustmentBreakdown: {
            chama,
            lateness,
            discipline,
            other: otherDeductions,
            bonus,
            commissionTopUp,
            penalties,
        },
        adjustmentEntries: [],
    };
}
exports.default = {
    mapPayrollToEarningsSummary,
    mapPayrollToPayrollRow,
};
