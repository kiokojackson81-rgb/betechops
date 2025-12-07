"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EarningsCard = EarningsCard;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const EarningsCard_1 = __importDefault(require("@/app/_components/EarningsCard"));
const toast_1 = require("@/lib/ui/toast");
function EarningsCard(props) {
    if (props.variant === "onlineOps") {
        return (0, jsx_runtime_1.jsx)(OnlineOpsEarningsCard, {});
    }
    return (0, jsx_runtime_1.jsx)(EarningsCard_1.default, { summary: props.summary, lockKey: props.lockKey });
}
function OnlineOpsEarningsCard() {
    const [summary, setSummary] = (0, react_1.useState)(null);
    const [loading, setLoading] = (0, react_1.useState)(true);
    const fetchSummary = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/online/earnings/summary", { credentials: "same-origin", cache: "no-store" });
            if (!res.ok)
                throw new Error("Failed to load earnings summary");
            const data = await res.json().catch(() => null);
            if (data?.summary)
                setSummary(mapOnlineSummary(data.summary));
        }
        catch (err) {
            (0, toast_1.showToast)(err instanceof Error ? err.message : "Failed to load earnings summary", "error");
        }
        finally {
            setLoading(false);
        }
    };
    (0, react_1.useEffect)(() => {
        fetchSummary();
        const handler = () => fetchSummary();
        window.addEventListener("onlineOps:refresh", handler);
        return () => window.removeEventListener("onlineOps:refresh", handler);
    }, []);
    if (loading && !summary) {
        return ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400", children: "Loading earnings summary\u2026" }));
    }
    return (0, jsx_runtime_1.jsx)(EarningsCard_1.default, { summary: summary });
}
function mapOnlineSummary(source) {
    const totalSales = source.directSales + source.marketplaceSales;
    return {
        periodKey: source.periodKey,
        periodLabel: source.periodLabel,
        totalSales,
        totalProfit: source.directProfit,
        totalNewProducts: 0,
        totalEditedProducts: 0,
        totalCopiedProducts: 0,
        totalItems: 0,
        totalReceipts: 0,
        walkInsServed: 0,
        walkInsPurchased: 0,
        baseSalary: source.baseSalary,
        transportAllowance: source.transportAllowance,
        salesCommission: source.directCommission + source.marketplaceCommission + source.supervisorBonus - source.returnsDeduction,
        newProductCommission: 0,
        copiedCommission: 0,
        editedCommission: 0,
        grossCommission: source.grossCommission,
        batteryEarnings: 0,
        bonusTotal: source.bonusTotal,
        commissionTopUpTotal: source.commissionTopUpTotal,
        chamaTotal: source.chamaTotal,
        latenessTotal: source.latenessTotal,
        disciplineTotal: source.disciplineTotal,
        otherDeductionsTotal: source.otherDeductionsTotal,
        totalEarnings: source.totalEarnings,
        totalDeductions: source.totalDeductions,
        netPay: source.netPay,
        ledger: null,
    };
}
