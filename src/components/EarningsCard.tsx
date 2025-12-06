"use client";

import { useEffect, useState } from "react";
import BaseEarningsCard from "@/app/_components/EarningsCard";
import type { EarningsSummary as MarketingSummary } from "@/lib/earningsSummary";
import type { OnlineEarningsSummary } from "@/lib/onlineOps";
import { showToast } from "@/lib/ui/toast";

type Variant = "support" | "marketing" | "onlineOps";

type BaseProps = {
  variant?: Exclude<Variant, "onlineOps">;
  summary: MarketingSummary | null;
  lockKey?: string;
};

type OnlineProps = {
  variant: "onlineOps";
};

type Props = BaseProps | OnlineProps;

export function EarningsCard(props: Props) {
  if (props.variant === "onlineOps") {
    return <OnlineOpsEarningsCard />;
  }
  return <BaseEarningsCard summary={props.summary} lockKey={props.lockKey} />;
}

function OnlineOpsEarningsCard() {
  const [summary, setSummary] = useState<MarketingSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/online/earnings/summary", { credentials: "same-origin", cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load earnings summary");
      const data = await res.json().catch(() => null);
      if (data?.summary) setSummary(mapOnlineSummary(data.summary));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load earnings summary", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
    const handler = () => fetchSummary();
    window.addEventListener("onlineOps:refresh", handler);
    return () => window.removeEventListener("onlineOps:refresh", handler);
  }, []);

  if (loading && !summary) {
    return (
      <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-sm text-slate-400">
        Loading earnings summary…
      </div>
    );
  }

  return <BaseEarningsCard summary={summary} />;
}

function mapOnlineSummary(source: OnlineEarningsSummary): MarketingSummary {
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
