"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import Textarea from "@/app/_components/Textarea";
import Button from "@/app/_components/Button";
import ReceiptsEditor from "@/app/_components/ReceiptsEditor";
import { showToast } from "@/lib/ui/toast";
import {
  DayName,
  marketingDayConfigs,
  marketingFieldKeys,
  marketingFieldTypes,
} from "@/lib/marketingDayConfigs";
import { useRouter } from "next/navigation";
import getLandingPage from "@/lib/getLandingPage";
import { getCommissionSummaryForSales } from "@/lib/marketingCommission";
import type { EarningsSummary } from "@/lib/marketingEarnings";
import { signOut } from "next-auth/react";
import { Trash2 } from "lucide-react";
import { useCardLock, LockButton } from "@/app/_components/useCardLock";
import type { UnpricedSale } from "@/lib/marketingUnpricedSales";

type MarketingDailyFormState = {
  date: string;
  dayOfWeek: DayName;
  fields: Record<string, boolean | number | string | null>;
};

type ReceiptItem = { id: string; productName: string; buyingPrice: number | "" };
type ReceiptRow = {
  id: string;
  receiptNumber: string;
  sellingTotal: number | "";
  paymentMethod: "MPESA" | "CASH" | "";
  items: ReceiptItem[];
};

type RemoteSummaryPayload = {
  period?: { key?: string; label?: string; start?: string; end?: string };
  aggregates?: {
    totalSales?: number;
    totalItems?: number;
    paymentStats?: { totalSalesMpesa?: number; totalSalesCash?: number };
    commission?: { commission?: number };
  };
};

const getUnpricedSaleKey = (sale: UnpricedSale) => `${sale.source}:${sale.id}`;
const getUnpricedDraftKey = (sale: UnpricedSale, receiptItemId?: string) =>
  receiptItemId ? `${sale.source}:item:${receiptItemId}` : getUnpricedSaleKey(sale);

const dayOptions: DayName[] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const deriveDayOfWeek = (dateStr: string): DayName => {
  const d = new Date(dateStr);
  const map = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const label = map[d.getDay()] as DayName | "Sunday";
  const exists = marketingDayConfigs.find((c) => c.day === label);
  return exists?.day ?? "Monday";
};

const defaultFormState = (): MarketingDailyFormState => {
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];
  const day = deriveDayOfWeek(todayStr);
  const dynamic: Record<string, boolean | number | string | null> = {};
  marketingFieldKeys.forEach((key) => {
    const type = marketingFieldTypes[key];
    dynamic[key] = type === "yesno" ? false : "";
  });
  return {
    date: todayStr,
    dayOfWeek: day,
    fields: { ...dynamic },
  };
};

const newSaleRow = (): ReceiptRow => ({
  id:
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2),
  receiptNumber: "",
  sellingTotal: "",
  paymentMethod: "",
  items: [
    {
      id:
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : Math.random().toString(36).slice(2),
      productName: "",
      buyingPrice: "",
    },
  ],
});

const pillClass = (checked: boolean) =>
  `rounded-full border px-4 py-2 text-sm font-medium transition ${
    checked
      ? "border-emerald-400 bg-emerald-400 text-black shadow-lg shadow-emerald-500/20"
      : "border-slate-700 bg-slate-800 text-slate-200 hover:border-slate-500"
  }`;

/* ---------- Quick stats card ---------- */

type StatsCardProps = {
  periodLabel: string;
  receipts: number;
  salesKes: number;
  items: number;
  commissionKes: number;
  currentSalesForTier: number;
  nextTarget: number | null;
};

function StatsCard({
  periodLabel,
  receipts,
  salesKes,
  items,
  commissionKes,
  currentSalesForTier,
  nextTarget,
}: StatsCardProps) {
  const hasNextTier = typeof nextTarget === "number" && nextTarget > 0;
  const { locked, toggle } = useCardLock("marketing:quickstats");
  const mask = (val: React.ReactNode) => (locked ? "•••" : val);

  const remaining =
    hasNextTier && nextTarget! > currentSalesForTier
      ? nextTarget! - currentSalesForTier
      : 0;

  const progress =
    hasNextTier && nextTarget!
      ? Math.min((currentSalesForTier / nextTarget!) * 100, 100)
      : 100;

  return (
    <Card className="h-full border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold">Quick stats</h2>
          <LockButton locked={locked} onToggle={toggle} />
        </div>
        <p className="text-xs text-slate-400 text-right">{periodLabel}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {/* Receipts */}
        <div className="rounded-2xl bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Receipts</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">{mask(receipts)}</p>
        </div>

        {/* Sales */}
        <div className="rounded-2xl bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Sales (KES)</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {mask(salesKes.toLocaleString())}
          </p>
        </div>

        {/* Commission */}
        <div className="rounded-2xl bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">
            Commission (KES)
          </p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">
            {mask(commissionKes.toLocaleString())}
          </p>
        </div>

        {/* Items */}
        <div className="rounded-2xl bg-slate-950/60 px-4 py-3">
          <p className="text-xs uppercase tracking-wide text-slate-400">Items sold</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-400">{mask(items)}</p>
        </div>
      </div>

      {/* Progress toward next tier */}
        <div className="mt-6 space-y-2">
        <p className="text-xs uppercase tracking-wide text-slate-400">To next tier</p>
        <p className="text-xs sm:text-sm text-slate-200">
          {hasNextTier && remaining > 0
            ? `KES ${remaining.toLocaleString()} more to hit next tier`
            : "You’ve reached the top tier for this period 🎉"}
        </p>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
          <div
            className="h-full rounded-full bg-emerald-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </Card>
  );
}

type EarningsCardProps = {
  summary: EarningsSummary | null;
};

function EarningsCard({ summary }: EarningsCardProps) {
  const { locked, toggle } = useCardLock("marketing:earnings");
  if (!summary) return null;
  const mask = (v: React.ReactNode) => (locked ? "•••" : v);

  const rows = [
    { label: "Base salary", type: "earning", amount: summary.baseSalary },
    { label: "Commission", type: "earning", amount: summary.commission },
    { label: "Transport allowance", type: "earning", amount: summary.transportAllowance },
    { label: "Bonuses / extras", type: "earning", amount: summary.bonusTotal },
    { label: "Chama", type: "deduction", amount: summary.chamaTotal },
    { label: "Lateness", type: "deduction", amount: summary.latenessTotal },
    { label: "Disciplinary", type: "deduction", amount: summary.disciplineTotal },
    { label: "Other deductions", type: "deduction", amount: summary.otherDeductionsTotal },
  ].filter((row) => row.amount && row.amount !== 0);

  return (
    <Card className="border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-lg font-semibold">Earnings this period</h2>
            <p className="text-xs text-slate-400">{summary.periodLabel}</p>
          </div>
          <LockButton locked={locked} onToggle={toggle} />
        </div>
        <div className="text-right text-xs">
          <p className="text-slate-400 uppercase tracking-wide">Net pay</p>
          <p className="text-xl font-semibold text-emerald-400">{mask(`KES ${summary.netPay.toLocaleString()}`)}</p>
        </div>
      </div>

      <div className="space-y-2 text-sm">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between rounded-xl bg-slate-950/60 px-3 py-2"
          >
            <span className="text-slate-300">{row.label}</span>
            <span
              className={
                row.type === "earning"
                  ? "font-semibold text-emerald-400"
                  : "font-semibold text-rose-400"
              }
            >
              {mask(`${row.type === "deduction" ? "-" : ""}KES ${row.amount.toLocaleString()}`)}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- Page component ---------- */

export default function MarketingTrackerPage() {
  const impersonateIdFromWindow = () =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("impersonateId")
      : null;

  const [form, setForm] = useState<MarketingDailyFormState>(() =>
    defaultFormState(),
  );
  const [receipts, setReceipts] = useState<ReceiptRow[]>([newSaleRow()]);
  const [submitting, setSubmitting] = useState(false);
  const [weeklyMeetingAttended, setWeeklyMeetingAttended] = useState(false);
  const [weeklyVideoShootParticipated, setWeeklyVideoShootParticipated] =
    useState(false);
  const [weeklyVideoCount, setWeeklyVideoCount] = useState<number | "">("");
  const [periodSummary, setPeriodSummary] = useState<null | {
    period: { key: string; label: string; start: string; end: string };
    aggregates: {
      totalSales: number;
      totalItems: number;
      paymentStats: {
        totalSalesMpesa: number;
        totalSalesCash: number;
        countMpesaReceipts?: number;
        countCashReceipts?: number;
      };
      commission: { commission: number };
    };
  }>(null);

  // Background authoritative server summary used for Quick stats calculations.
  // We keep this separate from `periodSummary` which controls the visible
  // summary panel. The panel should remain hidden unless the attendant
  // explicitly submits — serverPeriodSummary is updated by the poll.
  const [serverPeriodSummary, setServerPeriodSummary] = useState<null | {
    period: { key: string; label: string; start: string; end: string };
    aggregates: {
      totalSales: number;
      totalItems: number;
      paymentStats: {
        totalSalesMpesa: number;
        totalSalesCash: number;
        countMpesaReceipts?: number;
        countCashReceipts?: number;
      };
      commission: { commission: number };
    };
  }>(null);
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary | null>(null);
  const earningsSummaryJsonRef = useRef<string>("");
  const [unpricedSales, setUnpricedSales] = useState<UnpricedSale[]>([]);
  const [buyingDrafts, setBuyingDrafts] = useState<Record<string, string>>({});
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [deletingSaleKey, setDeletingSaleKey] = useState<string | null>(null);
  const [pricingSaleKey, setPricingSaleKey] = useState<string | null>(null);
  const unpricedQueueStats = useMemo(() => {
    return unpricedSales.reduce(
      (acc, sale) => {
        acc.receipts += 1;
        if (sale.source === "support") {
          acc.supportReceipts += 1;
          const pendingItems = sale.receiptItems?.length ?? sale.itemsPending ?? 0;
          if (pendingItems > 0) {
            acc.items += pendingItems;
          } else {
            const fallback = sale.itemsPending ?? 0;
            acc.items += fallback > 0 ? fallback : 1;
          }
        } else {
          acc.items += 1;
        }
        return acc;
      },
      { receipts: 0, supportReceipts: 0, items: 0 },
    );
  }, [unpricedSales]);
  useEffect(() => {
    earningsSummaryJsonRef.current = JSON.stringify(earningsSummary ?? {});
  }, [earningsSummary]);

  const config = useMemo(
    () =>
      marketingDayConfigs.find((c) => c.day === form.dayOfWeek) ??
      marketingDayConfigs[0],
    [form.dayOfWeek],
  );

  useEffect(() => {
    setForm((prev) => ({ ...prev, dayOfWeek: deriveDayOfWeek(prev.date) }));
  }, [form.date]);

  useEffect(() => {
    if (!periodSummary) return;
    const timer = setTimeout(() => setPeriodSummary(null), 5 * 60 * 1000);
    return () => clearTimeout(timer);
  }, [periodSummary]);

  const groupedYesNo = useMemo(() => {
    const groups = new Map<string, typeof config.yesNoFields>();
    (config?.yesNoFields || []).forEach((f) => {
      if (!groups.has(f.section)) groups.set(f.section, []);
      groups.get(f.section)?.push(f);
    });
    return Array.from(groups.entries());
  }, [config]);

  const router = useRouter();

  const handleSetBuyingDraft = (key: string, value: string) => {
    setBuyingDrafts((prev) => ({ ...prev, [key]: value }));
  };

  const allocateReceiptBuyingPrices = (total: number, items: Array<{ id: string }>) => {
    if (!items.length) return [];
    const base = Math.floor(total / items.length);
    let remainder = total - base * items.length;
    return items.map((item) => {
      const extra = remainder > 0 ? 1 : 0;
      if (remainder > 0) remainder -= 1;
      return { id: item.id, value: base + extra };
    });
  };

  const submitBuyingPrice = async (
    sale: UnpricedSale,
    receiptItemId: string | undefined,
    buyingPrice: number,
  ) => {
    if (sale.source === "support" && !receiptItemId) {
      throw new Error("Select an item on the receipt to price");
    }

    const endpoint =
      sale.source === "support" ? "/api/support/price-sale" : "/api/marketing/price-sale";
    const body =
      sale.source === "support"
        ? { receiptItemId, buyingPrice }
        : { dailySaleId: sale.id, buyingPrice };

    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error || "Failed to save buying price");
    }
    const data = await res.json().catch(() => null);

    let saleValueDelta = 0;
    let paymentDelta: "MPESA" | "CASH" | null = null;
    setUnpricedSales((prev) => {
      const next: UnpricedSale[] = [];
      for (const row of prev) {
        if (row.id !== sale.id || row.source !== sale.source) {
          next.push(row);
          continue;
        }
        if (row.source === "support" && receiptItemId) {
          const remainingItems = (row.receiptItems || []).filter((item) => item.id !== receiptItemId);
          if (!remainingItems.length) {
            saleValueDelta = data?.receiptTotal ?? row.sellingPrice;
            paymentDelta = row.paymentMethod;
            continue;
          }
          next.push({
            ...row,
            receiptItems: remainingItems,
            itemsPending: Math.max(0, (row.itemsPending ?? remainingItems.length + 1) - 1),
          });
          continue;
        }
        saleValueDelta = data?.saleValue ?? row.sellingPrice;
        paymentDelta = row.paymentMethod;
      }
      return next;
    });

    if (saleValueDelta > 0) {
      const methodKey = paymentDelta === "CASH" ? "totalSalesCash" : "totalSalesMpesa";
      setServerPeriodSummary((prev) => {
        if (!prev) return prev;
        const updatedPaymentStats = {
          ...prev.aggregates.paymentStats,
          [methodKey]: (prev.aggregates.paymentStats[methodKey] ?? 0) + saleValueDelta,
        };
        return {
          ...prev,
          aggregates: {
            ...prev.aggregates,
            totalSales: prev.aggregates.totalSales + saleValueDelta,
            totalItems: prev.aggregates.totalItems + 1,
            paymentStats: updatedPaymentStats,
          },
        };
      });

      try {
        setEarningsSummary((prev) => {
          if (!prev) return prev;
          const currentTotalSales = serverPeriodSummary?.aggregates?.totalSales ?? 0;
          const newTotalSales = currentTotalSales + saleValueDelta;
          const commissionInfo = getCommissionSummaryForSales(newTotalSales);
          const newCommission = Math.round(commissionInfo.commission ?? 0);
          const delta = newCommission - (prev.commission ?? 0);
          if (delta === 0) return { ...prev, commission: newCommission };
          return {
            ...prev,
            commission: newCommission,
            totalEarnings: (prev.totalEarnings ?? 0) + delta,
            netPay: (prev.netPay ?? 0) + delta,
          };
        });
      } catch {
        // ignore client-side calculation issues
      }
    }
  };

  const handleSubmitBuyingPrice = async (sale: UnpricedSale, receiptItemId?: string) => {
    const draftKey = getUnpricedDraftKey(sale, receiptItemId);
    const rawValue = buyingDrafts[draftKey] ?? "";
    const parsedValue = Number(rawValue);
    if (!rawValue || Number.isNaN(parsedValue) || parsedValue <= 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }

    const buyingPrice = Math.round(parsedValue);
    setPricingSaleKey(draftKey);
    try {
      await submitBuyingPrice(sale, receiptItemId, buyingPrice);
      setBuyingDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      showToast("Buying price saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save buying price", "error");
    } finally {
      setPricingSaleKey(null);
    }
  };

  const handleSubmitSupportReceiptTotal = async (sale: UnpricedSale) => {
    const draftKey = getUnpricedDraftKey(sale);
    const rawValue = buyingDrafts[draftKey] ?? "";
    const parsedValue = Number(rawValue);
    if (!rawValue || Number.isNaN(parsedValue) || parsedValue <= 0) {
      showToast("Enter a valid buying price", "error");
      return;
    }
    const items = sale.receiptItems || [];
    if (!items.length) {
      showToast("No receipt items available for pricing", "error");
      return;
    }
    const allocations = allocateReceiptBuyingPrices(Math.round(parsedValue), items);
    setPricingSaleKey(draftKey);
    try {
      for (let i = 0; i < allocations.length; i++) {
        const { id, value } = allocations[i];
        await submitBuyingPrice(sale, id, value);
      }
      setBuyingDrafts((prev) => {
        const next = { ...prev };
        delete next[draftKey];
        return next;
      });
      showToast("Buying price saved", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save buying price", "error");
    } finally {
      setPricingSaleKey(null);
    }
  };

  const handleDeleteUnpricedSale = async (sale: UnpricedSale) => {
    const key = getUnpricedSaleKey(sale);
    if (typeof window !== "undefined") {
      const confirmed = window.confirm("Delete this pending sale? This cannot be undone.");
      if (!confirmed) return;
    }
    setDeletingSaleKey(key);
    try {
      const res = await fetch("/api/marketing/unpriced-sales/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ saleId: sale.id, source: sale.source }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => null);
        showToast(err?.error || "Failed to delete sale", "error");
        return;
      }
      setUnpricedSales((prev) =>
        prev.filter((row) => getUnpricedSaleKey(row) !== key),
      );
      setBuyingDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      showToast("Sale deleted", "success");
    } catch {
      showToast("Failed to delete sale", "error");
    } finally {
      setDeletingSaleKey((prev) => (prev === key ? null : prev));
    }
  };

  // auth guard
  useEffect(() => {
    (async () => {
      try {
        const imp = impersonateIdFromWindow();
        const url = imp
          ? `/api/attendants/me?impersonateId=${encodeURIComponent(imp)}`
          : "/api/attendants/me";
        const res = await fetch(url, { credentials: "same-origin" });
        if (!res.ok) {
          router.replace("/attendant/login");
          return;
        }
        const data = await res.json().catch(() => null);
        const user = data?.user;
        if (!user) {
          router.replace("/attendant/login");
          return;
        }
        setCurrentUserEmail(user.email?.toLowerCase() ?? null);
        const role = user.role as string | undefined;
        const category = user.attendantCategory as string | undefined;
        if (role === "ADMIN") return;
        if (category !== "DIRECT_SALES_OPS") {
          const dest = getLandingPage(category ?? null, role);
          router.replace(dest);
        }
      } catch {
        router.replace("/attendant/login");
      }
    })();
  }, [router]);

  // fetch + poll period summary so Quick stats stay in sync with server
  useEffect(() => {
    const POLL_INTERVAL_MS = 15_000; // poll every 15s
    const controller = new AbortController();

    const buildSummaryFrom = (data: RemoteSummaryPayload) => {
      type PaymentStatsRaw = {
        totalSalesMpesa?: number;
        totalSalesCash?: number;
        countMpesaReceipts?: number;
        countCashReceipts?: number;
      };

      const paymentStatsRaw: PaymentStatsRaw = data.aggregates?.paymentStats ?? {};
      return {
        period: {
          key: data.period?.key ?? "",
          label: data.period?.label ?? "",
          start: data.period?.start ?? "",
          end: data.period?.end ?? "",
        },
        aggregates: {
          totalSales: data.aggregates?.totalSales ?? 0,
          totalItems: data.aggregates?.totalItems ?? 0,
          paymentStats: {
            totalSalesMpesa: paymentStatsRaw.totalSalesMpesa ?? 0,
            totalSalesCash: paymentStatsRaw.totalSalesCash ?? 0,
            countMpesaReceipts: paymentStatsRaw.countMpesaReceipts ?? 0,
            countCashReceipts: paymentStatsRaw.countCashReceipts ?? 0,
          },
          commission: {
            commission: data.aggregates?.commission?.commission ?? 0,
          },
        },
      };
    };

    const fetchSummary = async () => {
      try {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        const imp = impersonateIdFromWindow();
        const url = imp
          ? `/api/marketing/report/summary?impersonateId=${encodeURIComponent(imp)}`
          : "/api/marketing/report/summary";
        const res = await fetch(url, { credentials: "same-origin", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data) return;
        const next = buildSummaryFrom(data);
        const safeNext = {
          ...next,
          aggregates: {
            ...next.aggregates,
            paymentStats: {
              totalSalesMpesa: next.aggregates.paymentStats.totalSalesMpesa ?? 0,
              totalSalesCash: next.aggregates.paymentStats.totalSalesCash ?? 0,
              countMpesaReceipts: next.aggregates.paymentStats.countMpesaReceipts ?? 0,
              countCashReceipts: next.aggregates.paymentStats.countCashReceipts ?? 0,
            },
          },
        };
        // update authoritative server-side summary but do NOT show the panel
        // unless the attendant explicitly submitted (periodSummary is used
        // for the visible panel). This keeps Quick stats accurate while the
        // panel remains hidden.
        setServerPeriodSummary((prev) => {
          if (!prev) return safeNext;
          const changed =
            prev.aggregates.totalSales !== safeNext.aggregates.totalSales ||
            prev.aggregates.totalItems !== safeNext.aggregates.totalItems ||
            prev.aggregates.paymentStats.totalSalesMpesa !== safeNext.aggregates.paymentStats.totalSalesMpesa ||
            prev.aggregates.paymentStats.totalSalesCash !== safeNext.aggregates.paymentStats.totalSalesCash ||
            prev.aggregates.commission.commission !== safeNext.aggregates.commission.commission ||
            prev.period.label !== safeNext.period.label;
          return changed ? safeNext : prev;
        });
      } catch {
        // ignore network/abort errors
      }
    };

    // initial fetch
    fetchSummary();

    const id = setInterval(fetchSummary, POLL_INTERVAL_MS);

    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, []);

  // Poll earnings summary for the current attendant (used by EarningsCard)
  useEffect(() => {
    const POLL_INTERVAL_MS = 15_000;
    const controller = new AbortController();

    const fetchEarnings = async () => {
      try {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        const imp = impersonateIdFromWindow();
        const url = imp
          ? `/api/marketing/earnings/summary?impersonateId=${encodeURIComponent(imp)}`
          : "/api/marketing/earnings/summary";
        const res = await fetch(url, { credentials: "same-origin", signal: controller.signal });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data) return;
        const next = data.summary ?? null;
        // shallow compare by JSON to avoid unnecessary updates
        const prevStr = earningsSummaryJsonRef.current;
        const nextStr = JSON.stringify(next ?? {});
        if (next && prevStr !== nextStr) {
          earningsSummaryJsonRef.current = nextStr;
          setEarningsSummary(next);
        }
      } catch {
        // ignore network/abort errors
      }
    };

    fetchEarnings();
    const id = setInterval(fetchEarnings, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, []);

  useEffect(() => {
    const POLL_INTERVAL_MS = 20_000;
    if (!currentUserEmail || currentUserEmail !== "jeniffer@betech.co.ke") {
      setUnpricedSales([]);
      return;
    }
    const controller = new AbortController();

    const fetchUnpricedSales = async () => {
      try {
        if (typeof document !== "undefined" && document.visibilityState === "hidden") return;
        const res = await fetch("/api/marketing/unpriced-sales", {
          credentials: "same-origin",
          signal: controller.signal,
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data?.sales) return;
        setUnpricedSales(data.sales);
      } catch {
        // ignore expected aborts/errors
      }
    };

    fetchUnpricedSales();
    const id = setInterval(fetchUnpricedSales, POLL_INTERVAL_MS);
    return () => {
      clearInterval(id);
      controller.abort();
    };
  }, [currentUserEmail]);

  const updateField = (key: string, value: boolean | number | string | null) => {
    setForm((prev) => ({ ...prev, fields: { ...prev.fields, [key]: value } }));
  };

const totals = useMemo((): { totalSales: number; totalProfit: number; totalItems: number; filledReceiptsCount: number } => {
    const totalSales = receipts.reduce(
      (sum, r) =>
        sum +
        (typeof r.sellingTotal === "number"
          ? r.sellingTotal
          : Number(r.sellingTotal || 0)),
      0,
    );
    const totalProfit = receipts.reduce((sum, r) => {
      const selling = typeof r.sellingTotal === "number" ? r.sellingTotal : Number(r.sellingTotal || 0);

      // If any item in the receipt does not have a buyingPrice entered,
      // treat the receipt as unpriced and exclude it from profit calculations.
      const allItemsPriced = r.items.every((it) => {
        if (typeof it.buyingPrice === "number") return it.buyingPrice > 0;
        return Number(it.buyingPrice || 0) > 0;
      });

      if (!allItemsPriced) return sum;

      const buyingSum = r.items.reduce(
        (s, it) => s + (typeof it.buyingPrice === "number" ? it.buyingPrice : Number(it.buyingPrice || 0)),
        0,
      );

      return sum + (selling - buyingSum);
    }, 0);
    // Count only "filled" items (product name or a buying price) so the
    // items counter updates as the attendant types product names/prices.
    const totalItems = receipts.reduce((sum, r) => {
      const filled = r.items.filter((it) => {
        const nameFilled = typeof it.productName === "string" && it.productName.trim() !== "";
        const priceFilled =
          typeof it.buyingPrice === "number"
            ? it.buyingPrice > 0
            : Number(it.buyingPrice || 0) > 0;
        return nameFilled || priceFilled;
      }).length;
      return sum + filled;
    }, 0);

    // Count only "filled" receipts (sellingTotal > 0, any filled item, or
    // a non-empty receipt number) so the receipts counter updates while
    // typing, similar to total sales.
    const filledReceiptsCount = receipts.reduce((count, r) => {
      const hasSelling =
        typeof r.sellingTotal === "number"
          ? r.sellingTotal > 0
          : Number(r.sellingTotal || 0) > 0;
      const hasItems = r.items.some((it) => {
        const nameFilled = typeof it.productName === "string" && it.productName.trim() !== "";
        const priceFilled =
          typeof it.buyingPrice === "number"
            ? it.buyingPrice > 0
            : Number(it.buyingPrice || 0) > 0;
        return nameFilled || priceFilled;
      });
      const hasReceiptNumber = (r.receiptNumber ?? "").trim() !== "";
      return count + (hasSelling || hasItems || hasReceiptNumber ? 1 : 0);
    }, 0);

  return { totalSales, totalProfit, totalItems, filledReceiptsCount };
}, [receipts]);

// derived stats for the Quick stats card
const totalReceipts = totals.filledReceiptsCount ?? receipts.length;
  const totalSales = totals.totalSales;
  const totalItems = totals.totalItems;
  // Combine server-side period totals (if any) with the unsaved local receipts
  // so the Quick stats update instantly as the attendant enters or deletes sales.
  // Use `serverPeriodSummary` (authoritative) for calculations so the visible
  // panel (`periodSummary`) can remain hidden while Quick stats stay accurate.
  const serverPeriodTotalSales = serverPeriodSummary?.aggregates?.totalSales ?? 0;
  const combinedPeriodSales = serverPeriodTotalSales + totalSales;
  const serverPeriodTotalItems = serverPeriodSummary?.aggregates?.totalItems ?? 0;
  const combinedPeriodItems = serverPeriodTotalItems + totalItems;
  // receipts: server may provide counts per payment method in paymentStats
  const serverPeriodReceipts =
    (serverPeriodSummary?.aggregates?.paymentStats?.countMpesaReceipts ?? 0) +
    (serverPeriodSummary?.aggregates?.paymentStats?.countCashReceipts ?? 0);
  const combinedPeriodReceipts = serverPeriodReceipts + totalReceipts;

  const commissionSummary = useMemo(
    () => getCommissionSummaryForSales(combinedPeriodSales),
    [combinedPeriodSales],
  );

  // Prefer the server-calculated earnings summary commission when available
  // so the Quick stats panel matches the detailed Earnings card exactly.
  const commissionKes = earningsSummary?.commission ?? commissionSummary.commission;
  const nextTarget = commissionSummary.nextTarget;
  const periodLabel = periodSummary?.period.label ?? serverPeriodSummary?.period.label ?? "Nov 25, 2025 – Dec 24, 2025";
  const displayedSalesKes = combinedPeriodSales;
  const displayedItems = combinedPeriodItems;
  const displayedReceipts = combinedPeriodReceipts;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const errors: string[] = [];

    receipts.forEach((r, i) => {
      if (!r.receiptNumber || r.receiptNumber.trim() === "")
        errors.push(`Receipt ${i + 1}: missing receipt number`);
      if (r.sellingTotal === "" || Number.isNaN(Number(r.sellingTotal)))
        errors.push(`Receipt ${i + 1}: invalid selling total`);
      if (!r.paymentMethod)
        errors.push(`Receipt ${i + 1}: missing payment method`);
      r.items.forEach((it, j) => {
        if (!it.productName || it.productName.trim() === "")
          errors.push(
            `Receipt ${i + 1}, item ${j + 1}: missing product name`,
          );
        if (it.buyingPrice === "" || Number.isNaN(Number(it.buyingPrice)))
          errors.push(
            `Receipt ${i + 1}, item ${j + 1}: invalid buying price`,
          );
      });
    });

    (config.textFields || []).forEach((f) => {
      const raw = form.fields[f.key];
      if (!raw || String(raw).trim() === "") errors.push(`${f.key}: required`);
    });
    (config.numericFields || []).forEach((f) => {
      const raw = form.fields[f.key];
      if (
        raw === "" ||
        raw === null ||
        raw === undefined ||
        Number.isNaN(Number(raw))
      )
        errors.push(`${f.key}: required numeric`);
    });

    if (errors.length > 0) {
      showToast(errors.slice(0, 5).join("; "), "error");
      setSubmitting(false);
      return;
    }

    try {
      const yesNo: Record<string, boolean> = {};
      const numeric: Record<string, number> = {};
      const text: Record<string, string> = {};
      Object.entries(marketingFieldTypes).forEach(([key, type]) => {
        const raw = form.fields[key];
        if (type === "yesno") yesNo[key] = Boolean(raw);
        else if (type === "numeric") numeric[key] = Number(raw || 0);
        else text[key] = typeof raw === "string" ? raw : "";
      });

      const payload = {
        date: form.date,
        dayOfWeek: form.dayOfWeek,
        receipts: receipts.map((r) => ({
          receiptNumber: r.receiptNumber,
          sellingTotal:
            r.sellingTotal === "" ? 0 : Math.max(0, Number(r.sellingTotal)),
          paymentMethod: r.paymentMethod,
          items: r.items.map((it) => ({
            productName: it.productName.trim(),
            buyingPrice:
              it.buyingPrice === "" ? 0 : Math.max(0, Number(it.buyingPrice)),
          })),
        })),
        yesNo,
        numeric,
        text,
        weeklyMeetingAttended,
        weeklyVideoShootParticipated,
        weeklyVideoCount: weeklyVideoCount ? Number(weeklyVideoCount) : 0,
      };

      const imp = impersonateIdFromWindow();
      const url = imp
        ? `/api/marketing/daily?impersonateId=${encodeURIComponent(imp)}`
        : "/api/marketing/daily";
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showToast("Marketing daily tracker submitted", "success");
        setForm(defaultFormState());
        setReceipts([newSaleRow()]);
        setWeeklyMeetingAttended(false);
        setWeeklyVideoShootParticipated(false);
        setWeeklyVideoCount("");
        const data = await res.json().catch(() => null);
        if (data?.periodSummary) {
          // Use authoritative receipt counts returned by the server so Quick
          // stats show exact MPESA/CASH/total receipts immediately after submit.
          const next = {
            period: {
              key: "",
              label: data.periodSummary.periodLabel,
              start: "",
              end: "",
            },
            aggregates: {
              totalSales: data.periodSummary.periodSales ?? 0,
              totalItems: data.periodSummary.totalItems ?? 0,
              paymentStats: {
                totalSalesMpesa: data.periodSummary.mpesaTotal ?? 0,
                totalSalesCash: data.periodSummary.cashTotal ?? 0,
                countMpesaReceipts: data.periodSummary.countMpesaReceipts ?? 0,
                countCashReceipts: data.periodSummary.countCashReceipts ?? 0,
              },
              commission: {
                commission: data.periodSummary.commission ?? 0,
              },
            },
          };
          // show the panel briefly
          setPeriodSummary(next);
          // also update the background authoritative summary used by Quick stats
          setServerPeriodSummary(next);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || "Failed to submit entry", "error");
      }
    } catch (err: unknown) {
      showToast(
        err instanceof Error ? err.message : "Failed to submit entry",
        "error",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="mx-auto flex max-w-6xl flex-col gap-6 p-6"
      >
        <header className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-semibold">Sales Operations Dashboard</h1>
            <p className="text-sm text-slate-300">
              Every task you complete brings you closer to your next reward.
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`/receipts?start=${form.date}&end=${form.date}`}
              className="rounded-full border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400 hover:bg-emerald-500/20"
            >
              View Receipts
            </a>
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/attendant/login" })}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </header>

        {periodSummary && (
          <Card className="border-emerald-700/60 bg-emerald-900/20 text-emerald-100 shadow-xl shadow-emerald-900/30">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-200">
                    Summary so far for this trading period
                  </p>
                  <h2 className="text-lg font-semibold">
                    {periodSummary.period.label}
                  </h2>
                  <p className="text-xs text-emerald-200">
                    {periodSummary.period.label}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPeriodSummary(null)}
                >
                  Hide
                </Button>
              </div>
              <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">
                    Period sales
                  </div>
                  <div className="text-xl font-semibold text-white">
                    KES {periodSummary.aggregates.totalSales.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">
                    Total items
                  </div>
                  <div className="text-xl font-semibold text-white">
                    {periodSummary.aggregates.totalItems.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">
                    MPESA vs Cash
                  </div>
                  <div className="text-sm">
                    MPESA KES{" "}
                    {periodSummary.aggregates.paymentStats.totalSalesMpesa.toLocaleString()}
                  </div>
                  <div className="text-sm">
                    Cash KES{" "}
                    {periodSummary.aggregates.paymentStats.totalSalesCash.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-700/40 bg-emerald-900/30 p-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-200">
                    Commission so far
                  </div>
                  <div className="text-xl font-semibold text-white">
                    KES{" "}
                    {periodSummary.aggregates.commission.commission.toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-xs text-emerald-200">
                This panel auto-hides after 5 minutes. Commission shown is
                cumulative for the current trading period.
              </p>
            </div>
          </Card>
        )}

        <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Date</label>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={form.date}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, date: e.target.value }))
                  }
                  className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">Day of week</label>
              <select
                value={form.dayOfWeek}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    dayOfWeek: e.target.value as DayName,
                  }))
                }
                className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              >
                {dayOptions.map((day) => (
                  <option key={day} value={day}>
                    {day}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </Card>

        {/* SALES RECORDS + QUICK STATS ROW */}
        <div className="grid gap-6 lg:grid-cols-12 items-start">
          <div className="lg:col-span-8">
            <ReceiptsEditor
              receipts={receipts}
              setReceipts={setReceipts}
              totals={totals}
            />
          </div>
          <div className="lg:col-span-4 space-y-4">
            <StatsCard
              periodLabel={periodLabel}
              receipts={displayedReceipts}
              salesKes={displayedSalesKes}
              items={displayedItems}
              commissionKes={commissionKes}
              currentSalesForTier={combinedPeriodSales}
              nextTarget={nextTarget}
            />
            <EarningsCard summary={earningsSummary} />
            {currentUserEmail === "jeniffer@betech.co.ke" && (
              <Card className="border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-100">
                  Sales needing buying price
                </h2>
                <p className="text-xs text-slate-400">
                  Attach buying price to attendants&apos; sales to earn commission.
                </p>
              </div>
              {unpricedSales.length > 0 ? (
                <div className="flex flex-col items-start rounded-xl border border-slate-800/80 px-3 py-2 text-[11px] uppercase tracking-wide text-slate-300 sm:flex-row sm:items-center sm:gap-4">
                  <span>{unpricedQueueStats.receipts} receipts</span>
                  <span>{unpricedQueueStats.items} items pending</span>
                  {unpricedQueueStats.supportReceipts ? (
                    <span>{unpricedQueueStats.supportReceipts} support receipts</span>
                  ) : null}
                </div>
              ) : null}
            </div>

                {unpricedSales.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No pending sales. All sales in this period have buying prices.
                  </p>
                ) : (
                  <div className="mt-2 space-y-2 max-h-72 overflow-y-auto pr-1">
                    {unpricedSales.map((sale) => {
                      const saleKey = getUnpricedSaleKey(sale);
                      const isSupport = sale.source === "support";
                      const isDeleting = deletingSaleKey === saleKey;
                      return (
                        <div
                          key={saleKey}
                          className="rounded-xl bg-slate-950/70 px-3 py-2 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-100">
                                {sale.productName}
                              </span>
                              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                                {isSupport ? "Support ops" : "Marketing ops"}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteUnpricedSale(sale)}
                              disabled={isDeleting}
                              aria-label="Delete pending sale"
                              title="Delete sale"
                              className={`rounded-full p-1 text-slate-500 transition hover:text-rose-400 disabled:cursor-not-allowed disabled:opacity-50`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex justify-between gap-2 text-[11px] text-slate-400">
                            <span>{sale.attendantName}</span>
                            <span>
                              #{sale.receiptNumber || "No receipt"} � {sale.paymentMethod || "N/A"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-[11px] text-slate-400">
                            <span>{isSupport ? "Receipt value" : "Line value"}</span>
                            <span>KES {sale.sellingPrice.toLocaleString()}</span>
                          </div>
                          {isSupport ? (
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">
                              {((sale.itemsPending ?? sale.receiptItems?.length ?? 0) || 0).toLocaleString()} pending
                              {sale.itemsTotal ? ` of ${sale.itemsTotal}` : ""} items
                            </div>
                          ) : (
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">1 item pending</div>
                          )}
                          {isSupport && (sale.receiptItems?.length ?? 0) > 0 ? (
                            <div className="space-y-2 pt-2">
                              <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-2 text-[11px] text-slate-300">
                                <ul className="list-disc space-y-1 pl-4 text-left text-slate-200">
                                  {sale.receiptItems!.map((item) => (
                                    <li key={item.id}>{item.productName || "Receipt item"}</li>
                                  ))}
                                </ul>
                              </div>
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number"
                                  min={0}
                                  placeholder="Total buying price"
                                  value={buyingDrafts[saleKey] ?? ""}
                                  onChange={(e) => handleSetBuyingDraft(saleKey, e.target.value)}
                                  className="h-8 w-28 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleSubmitSupportReceiptTotal(sale)}
                                  disabled={pricingSaleKey === saleKey}
                                  className="ml-auto h-8 rounded-full bg-emerald-500 px-3 text-xs font-semibold text-black hover:brightness-95 disabled:opacity-60"
                                >
                                  {pricingSaleKey === saleKey ? "Saving…" : "Save"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 pt-1">
                              <Input
                                type="number"
                                min={0}
                                placeholder="Buying price"
                                value={buyingDrafts[saleKey] ?? ""}
                                onChange={(e) => handleSetBuyingDraft(saleKey, e.target.value)}
                                className="h-8 w-24 rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-xs"
                              />
                              <button
                                type="button"
                                onClick={() => handleSubmitBuyingPrice(sale)}
                                className="ml-auto h-8 rounded-full bg-emerald-500 px-3 text-xs font-semibold text-black hover:brightness-95"
                              >
                                Save
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            )}
          </div>
        </div>

        <Card className="border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-400">Day checklist</p>
              <h2 className="text-xl font-semibold">{config.day}</h2>
            </div>
            <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-200">
              Auto-loaded from selected day
            </div>
          </div>

          <div className="space-y-6">
            {groupedYesNo.map(([section, fields]) => (
              <div key={section} className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-slate-200">{section}</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {fields.map((f) => (
                    <button
                      type="button"
                      key={f.key}
                      onClick={() =>
                        updateField(f.key, !Boolean(form.fields[f.key]))
                      }
                      className={pillClass(Boolean(form.fields[f.key]))}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {form.dayOfWeek === "Thursday" && (
              <section className="mt-6 rounded-xl border border-red-500/30 p-4">
                <h3 className="mb-3 text-sm font-semibold">
                  Weekly Marketing Activities (Thursday)
                </h3>

                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-full">
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        Weekly meeting
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setWeeklyMeetingAttended(true);
                            updateField("weeklyMeetingAttended", true);
                          }}
                          className={pillClass(weeklyMeetingAttended)}
                        >
                          Attended weekly marketing meeting
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWeeklyMeetingAttended(false);
                            updateField("weeklyMeetingAttended", false);
                          }}
                          className={pillClass(!weeklyMeetingAttended)}
                        >
                          Did not attend
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-full">
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        Video shoot
                      </label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setWeeklyVideoShootParticipated(true);
                            updateField("weeklyVideoShootParticipated", true);
                          }}
                          className={pillClass(weeklyVideoShootParticipated)}
                        >
                          Participated in weekly video shoot
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setWeeklyVideoShootParticipated(false);
                            updateField("weeklyVideoShootParticipated", false);
                          }}
                          className={pillClass(!weeklyVideoShootParticipated)}
                        >
                          Did not participate
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-full">
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        Number of videos participated in (shooting)
                      </label>
                      <div className="mt-2">
                        <Input
                          type="number"
                          min={0}
                          value={String(weeklyVideoCount)}
                          onChange={(e) => {
                            const v =
                              e.target.value === ""
                                ? ""
                                : Math.max(0, Number(e.target.value));
                            setWeeklyVideoCount(
                              v === "" ? "" : Number(v),
                            );
                            updateField(
                              "weeklyVideoCount",
                              v === "" ? "" : Number(v),
                            );
                          }}
                          className="w-28 rounded-full border border-slate-800 bg-slate-950/80 px-3 py-2 text-center text-slate-100"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {(config.numericFields || []).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">
                  Numeric checks
                </h3>
                <div className="grid gap-3 md:grid-cols-2">
                  {(config.numericFields || []).map((f) => (
                    <div key={f.key} className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        {f.label}
                      </label>
                      <Input
                        type="number"
                        min={f.min}
                        value={String(form.fields[f.key] ?? "")}
                        onChange={(e) => updateField(f.key, e.target.value)}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {(config.textFields || []).length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-200">Notes</h3>
                <div className="grid gap-3">
                  {(config.textFields || []).map((f) => (
                    <div key={f.key} className="space-y-2">
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        {f.label}
                      </label>
                      <Textarea
                        value={String(form.fields[f.key] ?? "")}
                        onChange={(e) => updateField(f.key, e.target.value)}
                        placeholder={f.placeholder}
                        rows={3}
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        <div className="sticky bottom-4 flex items-center justify-end gap-3 rounded-2xl border border-slate-800 bg-slate-900/80 p-3 backdrop-blur">
          <Button
            type="reset"
            variant="secondary"
            onClick={() => setForm(defaultFormState())}
            className="px-5"
          >
            Reset
          </Button>
          <Button
            type="submit"
            variant="primary"
            className="bg-emerald-500 px-5 text-black hover:brightness-95"
            disabled={submitting}
          >
            {submitting ? "Submitting..." : "Submit report"}
          </Button>
        </div>
      </form>
    </div>
  );
}
