"use client";

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
// SensitiveValue and card-lock helpers removed (cards cleaned up)
import QuickStatsCard from "@/components/QuickStatsCard";
import { useCardLock, LockButton } from "@/app/_components/useCardLock";
import PeriodSwitcher from "@/app/_components/PeriodSwitcher";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { getOnlineOpsWeeksForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { showToast } from "@/lib/ui/toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

type TradingWeekChip = { key: string; label: string; start: Date; end: Date };

type ReceiptStatsRow = {
  id: string;
  total?: number | null;
  items?: any[];
};

type ShopSalesRow = {
  id: string;
  name: string;
  platform: string;
  country: string;
  currency: string;
  status: string;
  codeLabel: string;
  handlerName: string;
  handlerRole: string;
  periodLabel: string;
  totalSales: number;
};

type OnlineEarningsSummary = {
  periodLabel: string;
  salesCommission: number;
  otherBonuses: number;
  netPay: number;
};

type PaymentMethod = "MPESA" | "CASH" | "";

// Preview commission from server (falls back to null until fetched)
const COMMISSION_RATE = undefined as unknown as number;

const formatKES = (value: number | null | undefined) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const safeNumber = (value?: number | null) => Number(value ?? 0);


const toInputDate = (date: Date) =>
  // produce a YYYY-MM-DD string in Nairobi local date so inputs and
  // range builders are consistent with server-side Nairobi midnights
  date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

const formatNairobiParam = (date: Date, endOfDay = false) => {
  const ymd = date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  return endOfDay ? `${ymd}T23:59:59.999+03:00` : `${ymd}T00:00:00+03:00`;
};

export default function AttendantOnlineClient() {
  const router = useRouter();
  const currentPeriod = getTradingPeriodFor(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<TradingPeriod>(currentPeriod);
  const period = selectedPeriod;
  const selectedPeriodKey = selectedPeriod.key;
  const [userId, setUserId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [supervisorPerformanceTools, setSupervisorPerformanceTools] = useState(false);
  const [impersonated, setImpersonated] = useState<boolean>(false);
  const [impersonatedBy, setImpersonatedBy] = useState<string | null>(null);
  const [impersonateId, setImpersonateId] = useState<string | null>(null);

  const appendImpersonateParam = useCallback(
    (params: URLSearchParams) => {
      if (impersonateId) {
        params.set("impersonateId", impersonateId);
        // When impersonating, explicitly request mine scope to avoid global leakage
        params.set("scope", "mine");
      }
    },
    [impersonateId],
  );


  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const imp = params.get("impersonateId");
    if (imp) {
      setImpersonateId(imp);
    }
  }, []);

  const identityMatches = useCallback(
    (meta?: { resolvedUserId?: string | null }) => {
      if (!impersonateId || !meta?.resolvedUserId) return true;
      const matches = meta.resolvedUserId === impersonateId;
      if (!matches) {
        console.warn(
          "[attendant/online] dropping response due to identity mismatch",
          { impersonateId, resolved: meta.resolvedUserId, meta },
        );
      }
      return matches;
    },
    [impersonateId],
  );

  const parseIdentityResponse = useCallback(
    async <T = any>(res: Response): Promise<T | null> => {
      const payload = await res.json().catch(() => null);
      if (!payload) return null;
      if (!identityMatches(payload.meta)) return null;
      return payload.data ?? payload;
    },
    [identityMatches],
  );

  // receipt totals & quick stats removed from right column

  const [shopSalesRows, setShopSalesRows] = useState<ShopSalesRow[]>([]);
  const [shopSalesLoading, setShopSalesLoading] = useState(false);
  const [shopRange, setShopRange] = useState<"period" | "this-week" | "last-week" | "all">(
    "period",
  );
  const [shopPeriodLabel, setShopPeriodLabel] = useState(period.label);
  const [shopPeriodTotal, setShopPeriodTotal] = useState(0);
  const [shopAllTimeTotal, setShopAllTimeTotal] = useState(0);

  const tradingWeeks = useMemo<TradingWeekChip[]>(() => {
    const weeks = getOnlineOpsWeeksForTradingPeriod(period, period.end, 4);
    return weeks.map((wk) => ({
      key: wk.startInput,
      label: wk.label.replace(/–/g, "-"),
      start: wk.weekStart,
      end: wk.weekEndInclusive,
    }));
  }, [period]);
  const [activeWeekKeys, setActiveWeekKeys] = useState<string[]>([]);
  const [weeklyEarnings, setWeeklyEarnings] = useState<any | null>(null);
  const [weeklyLoading, setWeeklyLoading] = useState(false);
  const [onlineSummary, setOnlineSummary] = useState<any | null>(null);
  const [onlineSummaryLoading, setOnlineSummaryLoading] = useState(false);

  // receipt totals & payroll (quick stats + earnings) re-enabled
  const [receiptRows, setReceiptRows] = useState<ReceiptStatsRow[]>([]);
  const [receiptStatsLoading, setReceiptStatsLoading] = useState(false);

  const [payrollSummary, setPayrollSummary] = useState<any | null>(null);
  const [payrollLoading, setPayrollLoading] = useState(false);

  const fetchUser = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      appendImpersonateParam(params);
      const query = params.toString();
      const res = await fetch(`/api/attendants/me${query ? `?${query}` : ""}`, { cache: "no-store" });
      if (!res.ok) return;
      const payload = await parseIdentityResponse(res);
      if (!payload) return;
      if (payload?.user?.id) setUserId(payload.user.id);
      if (payload?.user?.role) setUserRole(payload.user.role);
      setSupervisorPerformanceTools(Boolean(payload?.flags?.supervisorPerformanceTools));
      // capture impersonation metadata when present so UI can surface it
      if (payload?.impersonated) {
        setImpersonated(true);
        setImpersonatedBy(payload?.impersonatedBy ?? null);
      } else {
        setImpersonated(false);
        setImpersonatedBy(null);
      }
    } catch (err) {
      console.warn("[attendant/online] failed to load user", err);
    }
  }, [appendImpersonateParam]);

  const isBenjaminSupervisor = supervisorPerformanceTools;

  const getActiveWeekRange = useCallback(() => {
    const keys = activeWeekKeys.length ? activeWeekKeys : ["period"];
    if (keys.includes("period")) {
      return { start: period.start, end: period.end };
    }
    const selectedWeeks = tradingWeeks.filter((week) => keys.includes(week.key));
    if (!selectedWeeks.length) {
      return { start: period.start, end: period.end };
    }
    const start = new Date(Math.min(...selectedWeeks.map((week) => week.start.getTime())));
    const end = new Date(Math.max(...selectedWeeks.map((week) => week.end.getTime())));
    return { start, end };
  }, [activeWeekKeys, tradingWeeks, period]);

  const loadWeeklyEarnings = useCallback(async () => {
    if (!userId) return;
    const { start, end } = getActiveWeekRange();
    if (!start || !end) return;

      setWeeklyLoading(true);
      try {
        const params = new URLSearchParams({
          attendantId: userId,
          start: formatNairobiParam(start, false),
          end: formatNairobiParam(end, true),
        });
        appendImpersonateParam(params);
      const res = await fetch(`/api/online/weekly/shops/earnings?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setWeeklyEarnings(null);
        return;
      }
      const payload = await parseIdentityResponse(res);
      if (!payload) {
        setWeeklyEarnings(null);
        return;
      }
      setWeeklyEarnings(payload);
      } catch (err) {
        setWeeklyEarnings(null);
      } finally {
        setWeeklyLoading(false);
      }
    },
    [getActiveWeekRange, userId, appendImpersonateParam],
  );

    const loadOnlineSummary = useCallback(async () => {
      if (!userId) return;
      setOnlineSummaryLoading(true);
      try {
        const params = new URLSearchParams({
          periodKey: selectedPeriodKey,
        });
        appendImpersonateParam(params);
      const res = await fetch(`/api/online/summary?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setOnlineSummary(null);
        return;
      }
      const payload = await parseIdentityResponse(res);
      if (!payload) {
        setOnlineSummary(null);
        return;
      }
      setOnlineSummary(payload);
      } catch (err) {
        setOnlineSummary(null);
      } finally {
        setOnlineSummaryLoading(false);
      }
    }, [selectedPeriodKey, userId, appendImpersonateParam]);

    const loadReceiptStats = useCallback(async () => {
    if (!userId) return;
    setReceiptStatsLoading(true);
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(period.start, false),
        end: formatNairobiParam(period.end, true),
        onlyPos: "1",
        includeItems: "true",
        size: "200",
      });
      appendImpersonateParam(params);

      const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load receipts for payroll period");
      const payload = await parseIdentityResponse(res);
      if (!payload) throw new Error("Failed to load receipts for payroll period");
      setReceiptRows(Array.isArray(payload.receipts) ? payload.receipts : []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load receipt totals";
      showToast(msg, "error");
    } finally {
      setReceiptStatsLoading(false);
    }
  }, [userId, period, appendImpersonateParam]);

  const loadPayrollSummary = useCallback(async () => {
    if (!userId) return;
    setPayrollLoading(true);
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(period.start, false),
        end: formatNairobiParam(period.end, true),
      });
      appendImpersonateParam(params);

      // If user is an admin, prefer the richer admin endpoint which may return multiple rows
      if (userRole === "ADMIN") {
        try {
          const adminRes = await fetch(`/api/admin/payroll/summary?${params.toString()}`, { cache: "no-store" });
          if (adminRes.ok) {
            const adminPayload = await parseIdentityResponse(adminRes);
            const rows = Array.isArray(adminPayload?.rows) ? adminPayload.rows : [];
            if (rows.length > 0) {
              setPayrollSummary(rows[0]);
              return;
            }
          }
        } catch (e) {
          // fall through to normal endpoint on error
        }
      }

      // For attendants, use the attendant earnings summary endpoint (existing route)
      const res = await fetch(`/api/attendant/earnings/summary?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setPayrollSummary(null);
        return;
      }
      const payload = await parseIdentityResponse(res);
      if (!payload) {
        setPayrollSummary(null);
        return;
      }
      setPayrollSummary(payload);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unable to load payroll summary";
      showToast(msg, "error");
      setPayrollSummary(null);
    } finally {
      setPayrollLoading(false);
    }
  }, [userId, period, appendImpersonateParam]);

  // receiptTotals loader removed

  const loadShopSales = useCallback(async () => {
    if (!userId) return;
    setShopSalesLoading(true);
    try {
      const { start, end } = computeRangeDates(shopRange, period);
      const params = new URLSearchParams({
        range: shopRange,
        attendantId: userId,
      });
      if (start) params.set("start", start);
      if (end) params.set("end", end);
      appendImpersonateParam(params);

      const res = await fetch(`/api/online/shops/sales?${params.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("Failed to load shop sales");
      const payload = await parseIdentityResponse(res);
      if (!payload) throw new Error("Failed to load shop sales");
      setShopSalesRows(Array.isArray(payload.rows) ? payload.rows : []);
      setShopPeriodLabel(payload.periodLabel ?? period.label);
      setShopPeriodTotal(payload.periodTotal ?? 0);
      setShopAllTimeTotal(payload.totalToDate ?? 0);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unable to load shop sales";
      showToast(message, "error");
    } finally {
      setShopSalesLoading(false);
    }
  }, [period, shopRange, userId, appendImpersonateParam]);


  // receiptTotals derived state removed (Quick stats removed)

  const weeklyTotals = weeklyEarnings?.totals ?? { orders: 0, sales: 0, commission: 0, shops: 0 };
  const platformAggregates = useMemo(() => {
    const rows = weeklyEarnings?.rows ?? [];
    const map: Record<string, { key: string; name: string; orders: number; sales: number; commission: number }> = {};
    for (const r of rows) {
      const key = String(r.platform ?? "UNKNOWN").toUpperCase();
      if (!map[key]) {
        map[key] = { key, name: r.platform ?? key, orders: 0, sales: 0, commission: 0 };
      }
      map[key] = {
        ...map[key],
        orders: map[key].orders + Number(r.orders ?? 0),
        sales: map[key].sales + Number(r.sales ?? 0),
        commission: map[key].commission + Number(r.commission ?? 0),
      };
    }

    const ensurePlatform = (code: string, label: string) => {
      if (!map[code]) {
        map[code] = { key: code, name: label, orders: 0, sales: 0, commission: 0 };
      }
    };
    ensurePlatform("JUMIA", "Jumia");
    ensurePlatform("KILIMALL", "Kilimall");

    return Object.values(map);
  }, [weeklyEarnings]);

  const platformTotals = useMemo(() => {
    const jumia = platformAggregates.find((p) => p.key === "JUMIA");
    const kilimall = platformAggregates.find((p) => p.key === "KILIMALL");

    return {
      jumiaSales: Number(jumia?.sales || 0),
      kilimallSales: Number(kilimall?.sales || 0),
      marketplaceCommission: Number(weeklyTotals.commission || 0),
    };
  }, [platformAggregates, weeklyTotals]);

  const accountRows = weeklyEarnings?.rows ?? [];

  const directReceiptsSummary = onlineSummary?.directReceipts ?? null;
  const posReceiptRows = useMemo(
    () => (receiptRows ?? []).filter((row: any) => row?.source === "pos"),
    [receiptRows],
  );
  const directSales = useMemo(() => {
    if (
      directReceiptsSummary &&
      (Number(directReceiptsSummary.totalSales ?? 0) > 0 || Number(directReceiptsSummary.totalReceipts ?? 0) > 0)
    ) {
      return Number(directReceiptsSummary.totalSales ?? 0);
    }
    return posReceiptRows.reduce((sum, r) => sum + (Number(r.total) || 0), 0);
  }, [directReceiptsSummary, posReceiptRows]);

  const receiptsCount = useMemo(() => {
    if (!receiptStatsLoading && Array.isArray(receiptRows)) {
      return posReceiptRows.length;
    }
    if (
      directReceiptsSummary &&
      (Number(directReceiptsSummary.totalSales ?? 0) > 0 || Number(directReceiptsSummary.totalReceipts ?? 0) > 0)
    ) {
      return Number(directReceiptsSummary.totalReceipts ?? 0);
    }
    const serverKeys = (payrollSummary as any)?.perReceiptCanonicalKeys ?? [];
    const localKeys = posReceiptRows.map((r: any) => {
      const createdAt = r.createdAt ?? r.generatedAt ?? new Date().toISOString();
      const d = new Date(createdAt);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      const businessDate = `${y}-${m}-${day}`;
      const raw = (r.receiptNumber ?? r.orderRef ?? r.receiptRef ?? r.id ?? "") as string;
      const serial = String(raw).toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (serial && serial.length > 0) return `${businessDate}:${serial}`;
      return `ID:${String(r.id ?? raw ?? "")}`;
    });
    const union = new Set<string>([...serverKeys, ...localKeys]);
    return union.size;
  }, [directReceiptsSummary, payrollSummary, posReceiptRows, receiptRows, receiptStatsLoading]);

  const totalSales = directSales + platformTotals.jumiaSales + platformTotals.kilimallSales;

  const [previewCommission, setPreviewCommission] = useState<number | null>(null);

  const commission = payrollSummary?.commissionTotal ?? payrollSummary?.commission ?? previewCommission ?? 0;

  const nextTierTarget = 1000000;
  const toNextTier = Math.max(0, nextTierTarget - totalSales);

  useEffect(() => {
    fetchUser();
    const defaultKey = tradingWeeks.at(-1)?.key ?? tradingWeeks[0]?.key ?? "period";
    setActiveWeekKeys((prev) => (prev.length ? prev : [defaultKey]));
  }, [fetchUser, tradingWeeks]);

  // show a small banner when viewing as another attendant
  const ImpersonationBanner = () => {
    if (!impersonated) return null;
    return (
      <div className="rounded-md border border-amber-600 bg-amber-900/30 px-3 py-2 text-sm text-amber-100">
        Viewing as another attendant{impersonatedBy ? ` (impersonated by ${impersonatedBy})` : ""} — some data may not match your account.
      </div>
    );
  };

  const loadCommissionPreview = useCallback(async () => {
    if (!userId) return;
    try {
      const params = new URLSearchParams({
        attendantId: userId,
        start: formatNairobiParam(period.start, false),
        end: formatNairobiParam(period.end, true),
      });
      appendImpersonateParam(params);
      const res = await fetch(`/api/online/preview-commission?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) {
        setPreviewCommission(null);
        return;
      }
      const payload = await parseIdentityResponse(res);
      if (!payload) {
        setPreviewCommission(null);
        return;
      }
      setPreviewCommission(Number(payload.totalCommission ?? 0));
    } catch (err) {
      setPreviewCommission(null);
    }
  }, [userId, period, appendImpersonateParam]);

  useEffect(() => {
    if (!userId) return;
    void loadCommissionPreview();
  }, [loadCommissionPreview, userId, period]);

  useEffect(() => {
    if (!userId) return;
    void loadShopSales();
    void loadReceiptStats();
    void loadPayrollSummary();
    void loadOnlineSummary();
  }, [loadShopSales, loadReceiptStats, loadPayrollSummary, userId]);

  useEffect(() => {
    if (!userId) return;
    void loadWeeklyEarnings();
  }, [loadWeeklyEarnings, userId]);

    // earnings summary loader removed

  // Prefer authoritative online summary (trading-period marketplace totals) when available.
  const quickStatsPeriodLabel =
    onlineSummary?.period?.label ?? weeklyEarnings?.rangeLabel ?? selectedPeriod.label;
  const marketplace = onlineSummary?.marketplace ?? null;
  const aggregatorJumiaSales = platformTotals.jumiaSales;
  const aggregatorKilimallSales = platformTotals.kilimallSales;
  const aggregatorMarketplaceSalesOnly = aggregatorJumiaSales + aggregatorKilimallSales;
  const quickJumiaSales =
    marketplace && Number(marketplace.jumiaSales ?? 0) > 0 ? Number(marketplace.jumiaSales) : aggregatorJumiaSales;
  const quickKilimallSales =
    marketplace && Number(marketplace.kilimallSales ?? 0) > 0
      ? Number(marketplace.kilimallSales)
      : aggregatorKilimallSales;
  const quickMarketplaceSalesOnly =
    marketplace && Number(marketplace.marketplaceSalesOnly ?? 0) > 0
      ? Number(marketplace.marketplaceSalesOnly)
      : aggregatorMarketplaceSalesOnly;
  const commissionBreakdown = onlineSummary?.commissions ?? null;
  const quickStatsPayload = {
    periodLabel: quickStatsPeriodLabel,
    jumiaSales: quickJumiaSales,
    kilimallSales: quickKilimallSales,
    directSales,
    receiptsCount,
    totalSales: quickMarketplaceSalesOnly + directSales,
    commission: payrollSummary?.commissionTotal ?? payrollSummary?.commission ?? commission,
    directCommission:
      Number(
        commissionBreakdown?.direct ??
          payrollSummary?.directCommission ??
          payrollSummary?.salesCommission ??
          0,
      ) || 0,
    marketplaceCommission:
      Number(
        commissionBreakdown?.marketplaceCombined ??
          payrollSummary?.marketplaceCommission ??
          0,
      ) || 0,
    toNextTier: Number(marketplace?.toNextTier ?? toNextTier),
    tierProgress: Number(marketplace?.tierProgress ?? 0),
    tierMessage: marketplace?.commissionInfo?.nextTarget ? undefined : "Max tier reached",
  };

  const receiptsHistoryHref = userId
    ? `/receipts?attendantId=${encodeURIComponent(userId)}&start=${encodeURIComponent(
        period.start.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }),
      )}&end=${encodeURIComponent(period.end.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }))}`
    : "/receipts";

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <main className="mx-auto max-w-6xl space-y-6 p-6">
        <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">Online Operations</h1>
            <p className="text-sm text-slate-300">
              Track marketplace shop sales, receipt activity, and payroll-linked
              earnings in one place.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 rounded-full border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
            <Link
              href={receiptsHistoryHref}
              className="rounded-full border border-transparent px-3 py-1 transition hover:border-slate-500"
            >
              Receipts
            </Link>
            {isBenjaminSupervisor ? (
              <>
                <button
                  type="button"
                  onClick={() => router.push("/attendant/online/performance")}
                  className="rounded-full border border-transparent px-3 py-1 transition hover:border-slate-500"
                >
                  Performance
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/attendant/online/performance/capture")}
                  className="rounded-full border border-transparent px-3 py-1 transition hover:border-slate-500"
                >
                  Capture profit
                </button>
                <button
                  type="button"
                  onClick={() => router.push("/attendant/online/manual-weekly")}
                  className="rounded-full border border-transparent px-3 py-1 transition hover:border-slate-500"
                >
                  Manual weekly
                </button>
              </>
            ) : null}
            <Link
              href="/receipts"
              className="rounded-full border border-emerald-500/40 bg-emerald-500/20 px-3 py-1 text-emerald-200 transition hover:bg-emerald-500/30"
            >
              Create receipt
            </Link>
            <Link
              href="/api/auth/signout"
              className="rounded-full border border-transparent px-3 py-1 transition hover:border-slate-500"
            >
              Log out
            </Link>
          </div>
        </header>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Statistics period</p>
              <p className="text-lg font-semibold text-slate-100">{selectedPeriod.label}</p>
              {selectedPeriodKey !== currentPeriod.key && (
                <p className="text-xs text-amber-300">Showing archived period.</p>
              )}
            </div>
            <PeriodSwitcher
              currentPeriod={currentPeriod}
              selectedPeriod={selectedPeriod}
              onSelectPeriod={setSelectedPeriod}
            />
          </div>
        </div>

        {/* Payroll earnings period banner removed */}

        <div className="grid gap-6 lg:grid-cols-12">
          <div className="space-y-6 lg:col-span-8">
            {/* Render the receipts editor as a single card (it contains its own header/totals) */}
            <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
              <div className="flex flex-col gap-1">
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  Online orders &amp; channels
                </p>
                <h2 className="text-lg font-semibold">Marketplace overview</h2>
                <p className="text-sm text-slate-400">
                  See how your sales are distributed across marketplaces.
                </p>
                <p className="text-[11px] text-amber-300">
                  Marketplace ladder is memo-only and may be withheld for misconduct, abandonment, or resignation.
                </p>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/70">
                <div className="px-4 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-[11px] uppercase tracking-wide text-slate-400">Total sales (selected range)</p>
                      <p className="text-3xl font-semibold text-white">{formatKES(weeklyTotals.sales)}</p>
                      <p className="text-xs text-slate-500">Commission: {formatKES(weeklyTotals.commission)}</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      className="px-4"
                      onClick={() => void loadWeeklyEarnings()}
                      disabled={weeklyLoading}
                    >
                      {weeklyLoading ? "Refreshing…" : "Refresh online stats"}
                    </Button>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">
                    Click week chips to combine totals across multiple weeks or choose the marketplace period for everything.
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {tradingWeeks.map((week) => (
                      <button
                        key={week.key}
                        type="button"
                        onClick={() => {
                          if (activeWeekKeys.includes("period")) {
                            setActiveWeekKeys([week.key]);
                            return;
                          }
                          if (activeWeekKeys.includes(week.key)) {
                            const remaining = activeWeekKeys.filter((key) => key !== week.key);
                            setActiveWeekKeys(remaining.length ? remaining : [week.key]);
                            return;
                          }
                          setActiveWeekKeys([...activeWeekKeys, week.key]);
                        }}
                        className={[
                          "rounded-full border px-3 py-1 text-xs font-semibold transition",
                          activeWeekKeys.includes(week.key)
                            ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                            : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700",
                        ].join(" ")}
                      >
                        {week.label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setActiveWeekKeys(["period"])}
                      className={[
                        "rounded-full border px-3 py-1 text-xs font-semibold transition",
                        activeWeekKeys.includes("period")
                          ? "border-emerald-500 bg-emerald-500/10 text-emerald-200"
                          : "border-slate-800 bg-slate-950/40 text-slate-300 hover:border-slate-700",
                      ].join(" ")}
                        >
                          Full period
                        </button>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    Weeks shown are the last 4 full weeks in the selected trading period.
                  </div>
                </div>
                <div className="border-t border-slate-800 px-4 pt-3">
                  <div className="grid grid-cols-2 gap-2 text-[11px] uppercase tracking-wide text-slate-400">
                    <span>Accounts</span>
                    <span className="text-right">Sales / Commission</span>
                  </div>
                  {accountRows.length === 0 ? (
                    <div className="py-4 text-sm text-slate-400">Select a week or the full period to see account sales.</div>
                  ) : (
                    accountRows.map((row) => (
                      <div key={`${row.shopId}-${row.weekStart}`} className="grid grid-cols-2 gap-2 border-t border-slate-800 py-3 text-sm text-slate-300">
                        <div>
                          <p className="font-semibold text-white">{row.shopName}</p>
                          <p className="text-[11px] uppercase tracking-wide text-slate-500">{row.platform}</p>
                        </div>
                        <div className="flex flex-col items-end text-right">
                          <span className="text-emerald-300">{formatKES(row.sales)}</span>
                          <span className="text-xs text-slate-400">{formatKES(row.commission)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </Card>
          </div>

          <div className="space-y-4 lg:col-span-4">
            <QuickStatsCard
              variant="onlineOps"
              loading={receiptStatsLoading || weeklyLoading}
              onlineOps={quickStatsPayload}
            />

            <PayrollEarningsCard
              summary={payrollSummary}
              loading={payrollLoading}
              periodLabel={period.label}
              fallbackCommission={commission}
            />

            {/* Marketplace Assigned shops card removed as requested */}
          </div>
        </div>
      </main>
    </div>
  );
}
// Marketplace Assigned shops card removed per request

function PayrollEarningsCard({
  summary,
  loading,
  periodLabel,
  fallbackCommission = 0,
}: {
  summary: any | null;
  loading: boolean;
  periodLabel: string;
  fallbackCommission?: number;
}) {
  const commissionValue = Number(
    summary?.commission ?? summary?.commissionTotal ?? summary?.salesCommission ?? fallbackCommission ?? 0,
  );
  const chamaValue = Number(
    summary?.chamaTotal ?? summary?.chama ?? summary?.adjustmentBreakdown?.chama ?? 0,
  );
  const bonusValue = Number(summary?.bonusTotal ?? 0);
  const totalDeductions = Number(summary?.totalDeductions ?? 0);
  let deductionBreakdown: [string, number][] = [];
  const adjEntries: { id: string; label: string; amount: number; adjustmentType: string; adjustmentKind: string }[] =
    (summary?.adjustmentEntries ?? []);
  if (adjEntries && adjEntries.length > 0) {
    deductionBreakdown = adjEntries
      .filter((e) => String(e.adjustmentKind || "DEDUCTION").toUpperCase() === "DEDUCTION")
      .map((e) => [String(e.label || e.adjustmentType), Number(e.amount ?? 0)]) as [string, number][];
  } else {
    const fallback: [string, number][] = [
      ["Chama", chamaValue],
      ["Lateness", Number(summary?.latenessTotal ?? 0)],
      ["Discipline", Number(summary?.disciplineTotal ?? 0)],
      ["Other", Number(summary?.otherDeductionsTotal ?? 0)],
      ["Penalties", Number(summary?.adjustmentBreakdown?.penalties ?? 0)],
    ];
    deductionBreakdown = fallback.filter(([, amount]) => Number(amount) > 0) as [string, number][];
  }

  const rows = [
    { label: "Base salary", value: Number(summary?.baseSalary ?? 0) },
    { label: "Commission", value: commissionValue },
    { label: "Chama", value: chamaValue },
    { label: "Bonuses", value: bonusValue },
    { label: "Deductions", value: totalDeductions },
  ];
  const netPay = summary?.netPay ?? summary?.netPayTotal ?? 0;
  const { locked, toggle } = useCardLock("onlineops:earnings");
  return (
    <Card className="space-y-4 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
        <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-100">Earnings this period</h2>
          <p className="text-xs text-slate-400">{periodLabel}</p>
        </div>
        {/** Use shared card lock so unlocking persists and auto-lock works */}
        <div>
          <LockButton locked={locked} onToggle={toggle} />
        </div>
      </div>

      {/** mask values when locked */}
      <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-400">
        <span>NET PAY</span>
        <span className="text-emerald-300 font-semibold">{locked ? "•••" : formatKES(netPay)}</span>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-2xl bg-slate-950/60 px-3 py-3 text-sm text-slate-300">
            <span className="text-[11px] uppercase tracking-wide text-slate-400">{row.label}</span>
            <span className="text-base font-semibold text-emerald-300">{locked ? "•••" : formatKES(row.value)}</span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="text-sm text-slate-400">{loading ? "Loading..." : "No earnings data"}</div>
        )}
        {deductionBreakdown.length > 0 && (
          <div className="space-y-1 rounded-2xl bg-slate-950/60 px-3 py-3 text-xs text-slate-400">
            <p className="uppercase tracking-wide text-[10px]">Payroll deduction summary</p>
            <div className="text-sm text-slate-200">
              {deductionBreakdown.map(([label, amount], index) => (
                <span key={label}>
                  {label} {locked ? "•••" : formatKES(Number(amount))}
                  {index < deductionBreakdown.length - 1 && " · "}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function computeRangeDates(
  range: "period" | "this-week" | "last-week" | "all",
  period: { start: Date; end: Date; label: string },
) {
  if (range === "period") {
    return {
      start: formatNairobiParam(period.start, false),
      end: formatNairobiParam(period.end, true),
    };
  }
  if (range === "this-week") {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { start: formatNairobiParam(weekStart, false), end: formatNairobiParam(weekEnd, true) };
  }
  if (range === "last-week") {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? 6 : day - 1;
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - diffToMonday);
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(thisWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(lastWeekStart);
    lastWeekEnd.setDate(lastWeekStart.getDate() + 6);
    lastWeekEnd.setHours(23, 59, 59, 999);
    return { start: formatNairobiParam(lastWeekStart, false), end: formatNairobiParam(lastWeekEnd, true) };
  }
  return { start: "", end: "" };
}
