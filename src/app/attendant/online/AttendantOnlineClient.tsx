"use client";

import React, { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import Card from "@/app/_components/Card";
import Button from "@/app/_components/Button";
// SensitiveValue and card-lock helpers removed (cards cleaned up)
import QuickStatsCard from "@/components/QuickStatsCard";
import { useCardLock, LockButton } from "@/app/_components/useCardLock";
import PeriodSwitcher from "@/app/_components/PeriodSwitcher";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import { getOnlineOpsWeeksForTradingPeriod, getOnlineOpsWindowForTradingPeriod } from "@/lib/onlineOpsWeeks";
import { computeMarketplaceCommission } from "@/lib/onlineCommission";
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

type MarketplaceOverviewRow = {
  shopId: string;
  accountId?: string;
  shopIds?: string[];
  shopName: string;
  platform: string;
  weekLabel: string;
  weekStart: string;
  weekEnd: string;
  sales: number;
  commission: number;
  chargedReturns?: number;
  orders: number;
};

type AccountSubmissionWeekStatus = {
  accountId: string;
  weekStart: string;
  status: "SUBMITTED" | "LOADED" | "ZERO" | "NOT_SUBMITTED";
  markedZero?: boolean;
  hasDraft?: boolean;
  hasProfitEntries?: boolean;
  complete?: boolean;
  missingPricing?: number;
};

type AccountStatusSummary = {
  totalWeeks: number;
  submitted: number;
  loaded: number;
  zero: number;
  notSubmitted: number;
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
const MARKETPLACE_STEP_POINTS = [
  2_000_000,
  3_000_000,
  4_000_000,
  5_000_000,
  6_000_000,
  7_000_000,
  8_000_000,
  9_000_000,
  10_000_000,
];

const formatKES = (value: number | null | undefined) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const safeNumber = (value?: number | null) => Number(value ?? 0);
const ONLINE_STATS_REFRESH_INTERVAL_MS = 15_000;
const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

type MarketplaceTierInfo = {
  target: number;
  remaining: number;
  progress: number;
  message: string;
};

function describeMarketplaceTier(sales: number): MarketplaceTierInfo {
  const normalized = Math.max(0, Math.round(sales));

  if (normalized < 500_000) {
    const remaining = 500_000 - normalized;
    return {
      target: 500_000,
      remaining,
      progress: clamp01(normalized / 500_000),
      message: `${formatKES(remaining)} to enter the ladder`,
    };
  }

  if (normalized < 1_000_000) {
    const remaining = 1_000_000 - normalized;
    return {
      target: 1_000_000,
      remaining,
      progress: clamp01((normalized - 500_000) / 500_000),
      message: `${formatKES(remaining)} to finish the 500k-1M band`,
    };
  }

  let previous = 1_000_000;
  for (const point of MARKETPLACE_STEP_POINTS) {
    if (normalized < point) {
      const remaining = point - normalized;
      const progress = clamp01((normalized - previous) / (point - previous));
      return {
        target: point,
        remaining,
        progress,
        message: `${formatKES(remaining)} to reach the ${point / 1_000_000}M tier`,
      };
    }
    previous = point;
  }

  return {
    target: MARKETPLACE_STEP_POINTS[MARKETPLACE_STEP_POINTS.length - 1],
    remaining: 0,
    progress: 1,
    message: "Max tier reached",
  };
}

function formatAccountStatusLabel(status: AccountSubmissionWeekStatus["status"]) {
  switch (status) {
    case "SUBMITTED":
      return "Submitted";
    case "LOADED":
      return "Loaded";
    case "ZERO":
      return "Zero";
    default:
      return "Not submitted";
  }
}

function getAccountStatusBadgeClass(status: AccountSubmissionWeekStatus["status"]) {
  switch (status) {
    case "SUBMITTED":
      return "border-emerald-500/40 bg-emerald-500/10 text-emerald-200";
    case "LOADED":
      return "border-sky-500/40 bg-sky-500/10 text-sky-200";
    case "ZERO":
      return "border-amber-500/40 bg-amber-500/10 text-amber-200";
    default:
      return "border-slate-700 bg-slate-900/80 text-slate-300";
  }
}

function buildAccountStatusBadges(summary: AccountStatusSummary): Array<{
  key: string;
  label: string;
  className: string;
}> {
  if (summary.totalWeeks <= 1) {
    const singleStatus: AccountSubmissionWeekStatus["status"] =
      summary.zero > 0
        ? "ZERO"
        : summary.submitted > 0
          ? "SUBMITTED"
          : summary.loaded > 0
            ? "LOADED"
            : "NOT_SUBMITTED";
    return [
      {
        key: singleStatus,
        label: formatAccountStatusLabel(singleStatus),
        className: getAccountStatusBadgeClass(singleStatus),
      },
    ];
  }

  const badges: Array<{ key: string; label: string; className: string }> = [];
  if (summary.submitted > 0) {
    badges.push({
      key: "submitted",
      label: `Submitted ${summary.submitted}/${summary.totalWeeks}`,
      className: getAccountStatusBadgeClass("SUBMITTED"),
    });
  }
  if (summary.loaded > 0) {
    badges.push({
      key: "loaded",
      label: `Loaded ${summary.loaded}/${summary.totalWeeks}`,
      className: getAccountStatusBadgeClass("LOADED"),
    });
  }
  if (summary.zero > 0) {
    badges.push({
      key: "zero",
      label: `Zero ${summary.zero}/${summary.totalWeeks}`,
      className: getAccountStatusBadgeClass("ZERO"),
    });
  }
  if (summary.notSubmitted > 0 || badges.length === 0) {
    badges.push({
      key: "not-submitted",
      label: `Not submitted ${summary.notSubmitted}/${summary.totalWeeks}`,
      className: getAccountStatusBadgeClass("NOT_SUBMITTED"),
    });
  }
  return badges;
}

const allocateCombinedMarketplaceCommission = <T extends { sales: number; chargedReturns?: number }>(
  rows: T[],
  totalCommission: number,
) => {
  const totalSales = rows.reduce((sum, row) => sum + Number(row.sales ?? 0), 0);
  if (totalCommission <= 0 || totalSales <= 0) {
    return rows.map((row) => Math.max(0, 0 - Number(row.chargedReturns ?? 0)));
  }

  let allocated = 0;
  return rows.map((row, index) => {
    const sales = Number(row.sales ?? 0);
    const rawShare =
      index === rows.length - 1 ? totalCommission - allocated : Math.round((sales / totalSales) * totalCommission);
    allocated += index === rows.length - 1 ? totalCommission - allocated : rawShare;
    return Math.max(0, rawShare - Number(row.chargedReturns ?? 0));
  });
};

function normalizeWeekKey(value: string | null | undefined) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw.slice(0, 10);
  const shifted = new Date(parsed.getTime() + 3 * 60 * 60 * 1000);
  return shifted.toISOString().slice(0, 10);
}


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
  const marketplacePeriodWindow = useMemo(
    () => getOnlineOpsWindowForTradingPeriod(period, period.end, 4),
    [period],
  );
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

  const selectedMarketplaceWeekKeys = useMemo(
    () =>
      activeWeekKeys.includes("period")
        ? tradingWeeks.map((week) => week.key)
        : activeWeekKeys.length
          ? activeWeekKeys
          : tradingWeeks.at(-1)?.key
            ? [tradingWeeks.at(-1)!.key]
            : [],
    [activeWeekKeys, tradingWeeks],
  );

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
      return { start: marketplacePeriodWindow.start, end: marketplacePeriodWindow.end };
    }
    const selectedWeeks = tradingWeeks.filter((week) => keys.includes(week.key));
    if (!selectedWeeks.length) {
      return { start: marketplacePeriodWindow.start, end: marketplacePeriodWindow.end };
    }
    const start = new Date(Math.min(...selectedWeeks.map((week) => week.start.getTime())));
    const end = new Date(Math.max(...selectedWeeks.map((week) => week.end.getTime())));
    return { start, end };
  }, [activeWeekKeys, tradingWeeks, marketplacePeriodWindow]);

  const loadWeeklyEarnings = useCallback(async () => {
    if (!userId) return;
    const { start, end } = getActiveWeekRange();
    if (!start || !end) return;
    const selectedWeekKeys = activeWeekKeys.includes("period")
      ? tradingWeeks.map((week) => week.key)
      : activeWeekKeys.length
        ? activeWeekKeys
        : tradingWeeks.at(-1)?.key
          ? [tradingWeeks.at(-1)!.key]
          : [];

      setWeeklyLoading(true);
      try {
        const params = new URLSearchParams({
          attendantId: userId,
          start: formatNairobiParam(start, false),
          end: formatNairobiParam(end, true),
        });
        for (const weekKey of selectedWeekKeys) {
          if (weekKey && weekKey !== "period") params.append("weekStart", weekKey);
        }
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
    [activeWeekKeys, appendImpersonateParam, getActiveWeekRange, tradingWeeks, userId],
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

      // Online ops attendants need the online-specific earnings breakdown so
      // marketplace commission and POS profit-share commission stay aligned.
      params.set("periodKey", selectedPeriodKey);
      const res = await fetch(`/api/online/earnings/summary?${params.toString()}`, { cache: "no-store" });
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
  }, [userId, period, appendImpersonateParam, selectedPeriodKey, parseIdentityResponse]);

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

  const marketplaceOverviewRows = useMemo<MarketplaceOverviewRow[]>(() => {
    const serverRows = Array.isArray(weeklyEarnings?.rows) ? (weeklyEarnings.rows as MarketplaceOverviewRow[]) : [];
    const serverWeeklyRows = Array.isArray(weeklyEarnings?.weeklyRows) ? (weeklyEarnings.weeklyRows as MarketplaceOverviewRow[]) : [];
    if (!serverWeeklyRows.length) {
      return serverRows.map((row) => ({
        ...row,
        sales: Number(row.sales ?? 0),
        commission: Number(row.commission ?? 0),
        orders: Number(row.orders ?? 0),
      }));
    }
    const serverWeeklyByAccountWeek = new Map<string, MarketplaceOverviewRow>();
    for (const row of serverWeeklyRows) {
      const weekKey = normalizeWeekKey(row.weekStart);
      serverWeeklyByAccountWeek.set(`${row.accountId ?? row.shopId}::${weekKey}`, row);
    }

    const baseRows = serverRows.map((row) => {
      const accountKey = String(row.accountId ?? row.shopId ?? "").trim();
      const selectedWeeks = selectedMarketplaceWeekKeys.length ? selectedMarketplaceWeekKeys : [normalizeWeekKey(row.weekStart)];
      let sales = 0;
      let orders = 0;

      for (const weekKey of selectedWeeks) {
        const serverWeek = serverWeeklyByAccountWeek.get(`${accountKey}::${weekKey}`);
        if (serverWeek) {
          sales += Number(serverWeek.sales ?? 0);
          orders += Number(serverWeek.orders ?? 0);
        }
      }

      return {
        ...row,
        sales,
        orders,
      };
    });

    const useCombinedMarketplaceLadder = Boolean(weeklyEarnings?.useCombinedMarketplaceLadder);
    if (useCombinedMarketplaceLadder) {
      const combinedCommission = Number(computeMarketplaceCommission(baseRows.reduce((sum, row) => sum + Number(row.sales ?? 0), 0)).amount || 0);
      const rowCommissions = allocateCombinedMarketplaceCommission(baseRows, combinedCommission);
      return baseRows.map((row, index) => ({
        ...row,
        commission: rowCommissions[index] ?? 0,
      }));
    }

    return baseRows.map((row) => ({
      ...row,
      commission: Math.max(0, Number(computeMarketplaceCommission(row.sales).amount || 0) - Number(row.chargedReturns ?? 0)),
    }));
  }, [selectedMarketplaceWeekKeys, weeklyEarnings]);

  const accountSubmissionStatuses = useMemo<AccountSubmissionWeekStatus[]>(
    () =>
      Array.isArray(weeklyEarnings?.accountStatuses)
        ? (weeklyEarnings.accountStatuses as AccountSubmissionWeekStatus[]).map((entry) => ({
            ...entry,
            accountId: String(entry.accountId ?? "").trim(),
            weekStart: normalizeWeekKey(entry.weekStart),
            status: (String(entry.status ?? "NOT_SUBMITTED").trim().toUpperCase() as AccountSubmissionWeekStatus["status"]),
          }))
        : [],
    [weeklyEarnings],
  );

  const accountStatusSummaryById = useMemo(() => {
    const summaryById = new Map<string, AccountStatusSummary>();
    const explicitStatusByAccountWeek = new Map<string, AccountSubmissionWeekStatus["status"]>();

    for (const entry of accountSubmissionStatuses) {
      if (!entry.accountId || !entry.weekStart) continue;
      explicitStatusByAccountWeek.set(`${entry.accountId}::${entry.weekStart}`, entry.status);
    }

    for (const row of marketplaceOverviewRows) {
      const accountId = String(row.accountId ?? row.shopId ?? "").trim();
      if (!accountId) continue;
      const summary: AccountStatusSummary = {
        totalWeeks: selectedMarketplaceWeekKeys.length || 1,
        submitted: 0,
        loaded: 0,
        zero: 0,
        notSubmitted: 0,
      };

      const weeks = selectedMarketplaceWeekKeys.length ? selectedMarketplaceWeekKeys : [normalizeWeekKey(row.weekStart)];
      for (const weekKey of weeks) {
        const status = explicitStatusByAccountWeek.get(`${accountId}::${weekKey}`) ?? "NOT_SUBMITTED";
        if (status === "SUBMITTED") summary.submitted += 1;
        else if (status === "LOADED") summary.loaded += 1;
        else if (status === "ZERO") summary.zero += 1;
        else summary.notSubmitted += 1;
      }

      summaryById.set(accountId, summary);
    }

    return summaryById;
  }, [accountSubmissionStatuses, marketplaceOverviewRows, selectedMarketplaceWeekKeys]);

  const marketplaceOverviewTotals = useMemo(
    () =>
      marketplaceOverviewRows.reduce(
        (acc, row) => {
          acc.sales += Number(row.sales ?? 0);
          acc.commission += Number(row.commission ?? 0);
          acc.orders += Number(row.orders ?? 0);
          return acc;
        },
        { sales: 0, commission: 0, orders: 0 },
      ),
    [marketplaceOverviewRows],
  );
  const platformAggregates = useMemo(() => {
    const rows = marketplaceOverviewRows ?? [];
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
  }, [marketplaceOverviewRows]);

  const platformTotals = useMemo(() => {
    const jumia = platformAggregates.find((p) => p.key === "JUMIA");
    const kilimall = platformAggregates.find((p) => p.key === "KILIMALL");

    return {
      jumiaSales: Number(jumia?.sales || 0),
      kilimallSales: Number(kilimall?.sales || 0),
      marketplaceCommission: Number(marketplaceOverviewTotals.commission || 0),
    };
  }, [marketplaceOverviewTotals.commission, platformAggregates]);

  const accountRows = marketplaceOverviewRows;

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
  const directProfitFromReceiptRows = useMemo(
    () =>
      posReceiptRows.reduce((sum, row: any) => {
        const profit = Number(row?.profit ?? 0);
        return Number.isFinite(profit) ? sum + profit : sum;
      }, 0),
    [posReceiptRows],
  );

  const totalSales = directSales + platformTotals.jumiaSales + platformTotals.kilimallSales;

  const [previewCommission, setPreviewCommission] = useState<number | null>(null);

  const commission = payrollSummary?.commissionTotal ?? payrollSummary?.commission ?? previewCommission ?? 0;

  const nextTierTarget = 1000000;
  const toNextTier = Math.max(0, nextTierTarget - totalSales);

  useEffect(() => {
    fetchUser();
    setActiveWeekKeys((prev) => {
      if (prev.includes("period")) return prev;
      const validKeys = prev.filter((key) => tradingWeeks.some((week) => week.key === key));
      return validKeys.length ? validKeys : ["period"];
    });
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
        periodKey: selectedPeriodKey,
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
  }, [userId, period, appendImpersonateParam, selectedPeriodKey]);

  useEffect(() => {
    if (!userId) return;
    void loadCommissionPreview();
  }, [loadCommissionPreview, userId, period]);

  const refreshAllOnlineStats = useCallback(async () => {
    if (!userId) return;
    await Promise.allSettled([
      loadWeeklyEarnings(),
      loadOnlineSummary(),
      loadPayrollSummary(),
      loadCommissionPreview(),
    ]);
  }, [loadCommissionPreview, loadOnlineSummary, loadPayrollSummary, loadWeeklyEarnings, userId]);

  useEffect(() => {
    if (!userId) return;
    void loadShopSales();
    void loadReceiptStats();
    void refreshAllOnlineStats();
  }, [loadReceiptStats, loadShopSales, refreshAllOnlineStats, userId]);

  useEffect(() => {
    if (!userId) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;

    const refreshVisibleStats = () => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      void refreshAllOnlineStats();
    };

    const intervalId = window.setInterval(refreshVisibleStats, ONLINE_STATS_REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refreshVisibleStats);
    document.addEventListener("visibilitychange", refreshVisibleStats);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", refreshVisibleStats);
      document.removeEventListener("visibilitychange", refreshVisibleStats);
    };
  }, [refreshAllOnlineStats, userId]);

    // earnings summary loader removed

  // Keep quick stats aligned with the marketplace overview/PDF logic for the
  // currently selected range instead of older period-wide summary totals.
  const quickStatsPeriodLabel =
    onlineSummary?.period?.label ?? weeklyEarnings?.rangeLabel ?? selectedPeriod.label;
  const marketplace = onlineSummary?.marketplace ?? null;
  const aggregatorJumiaSales = platformTotals.jumiaSales;
  const aggregatorKilimallSales = platformTotals.kilimallSales;
  const aggregatorMarketplaceSalesOnly = aggregatorJumiaSales + aggregatorKilimallSales;
  const marketplaceTierInfo = describeMarketplaceTier(aggregatorMarketplaceSalesOnly);
  const quickJumiaSales = aggregatorJumiaSales;
  const quickKilimallSales = aggregatorKilimallSales;
  const quickMarketplaceSalesOnly = aggregatorMarketplaceSalesOnly;
  const commissionBreakdown = onlineSummary?.commissions ?? null;
  const quickMarketplaceCommission = platformTotals.marketplaceCommission;
  const directCommissionMode = String(commissionBreakdown?.directCommissionMode ?? "").toUpperCase();
  const directCommissionFromSummary = [
    Number(commissionBreakdown?.direct ?? Number.NaN),
    Number(payrollSummary?.directCommission ?? Number.NaN),
    Number(payrollSummary?.salesCommission ?? Number.NaN),
  ].find((value) => Number.isFinite(value) && value > 0) ?? 0;
  const directProfitForCommission = Math.max(
    Number(directReceiptsSummary?.totalProfit ?? 0),
    Number(directProfitFromReceiptRows ?? 0),
  );
  const profitShareDirectCommissionFallback =
    directProfitForCommission > 0
      ? Math.max(0, Math.round(directProfitForCommission * 0.1))
      : 0;
  const quickDirectCommission =
    directCommissionFromSummary > 0 ? directCommissionFromSummary : profitShareDirectCommissionFallback;
  const quickStatsPayload = {
    periodLabel: quickStatsPeriodLabel,
    marketplaceSales: quickMarketplaceSalesOnly,
    kilimallSales: quickKilimallSales,
    directSales,
    receiptsCount,
    totalSales: quickMarketplaceSalesOnly + directSales,
    commission: payrollSummary?.commissionTotal ?? payrollSummary?.commission ?? commission,
    directCommission:
      quickDirectCommission,
    marketplaceCommission:
      Number(
        quickMarketplaceCommission ??
          commissionBreakdown?.marketplaceCombined ??
          payrollSummary?.marketplaceCommission ??
          0,
      ) || 0,
    toNextTier: marketplaceTierInfo.remaining,
    tierProgress: marketplaceTierInfo.progress,
    tierMessage: marketplaceTierInfo.message,
  };

  const receiptsHistoryHref = userId
    ? `/receipts?attendantId=${encodeURIComponent(userId)}&start=${encodeURIComponent(
        period.start.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }),
      )}&end=${encodeURIComponent(period.end.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }))}`
    : "/receipts";
  const performanceReportHref = (() => {
    const params = new URLSearchParams({ periodKey: selectedPeriodKey });
    if (impersonateId) params.set("impersonateId", impersonateId);
    return `/api/online/summary/export?${params.toString()}`;
  })();

  const renderAccountStatusBadges = (summary?: AccountStatusSummary): ReactNode => {
    if (!summary) return null;
    const badges = buildAccountStatusBadges(summary);
    return (
      <div className="mt-2 flex flex-wrap gap-2">
        {badges.map((badge) => (
          <span
            key={badge.key}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em] ${badge.className}`}
          >
            {badge.label}
          </span>
        ))}
      </div>
    );
  };

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
                      <p className="text-3xl font-semibold text-white">{formatKES(marketplaceOverviewTotals.sales)}</p>
                      <p className="text-xs text-slate-500">Commission: {formatKES(marketplaceOverviewTotals.commission)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {userId ? (
                        <a
                          href={performanceReportHref}
                          className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm text-slate-200 transition hover:bg-white/5"
                        >
                          Download full weeks PDF
                        </a>
                      ) : null}
                      <Button
                        type="button"
                        variant="secondary"
                        className="px-4"
                        onClick={() => void refreshAllOnlineStats()}
                        disabled={weeklyLoading}
                      >
                        {weeklyLoading ? "Refreshing…" : "Refresh online stats"}
                      </Button>
                    </div>
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
                          {renderAccountStatusBadges(
                            accountStatusSummaryById.get(String(row.accountId ?? row.shopId ?? "").trim()),
                          )}
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
              loading={receiptStatsLoading || weeklyLoading || onlineSummaryLoading || payrollLoading}
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
  const directCommissionValue = Number(
    summary?.commissionDirect ?? summary?.directCommission ?? 0,
  );
  const jumiaCommissionValue = Number(summary?.commissionMarketplaceJumia ?? 0);
  const kilimallCommissionValue = Number(summary?.commissionMarketplaceKilimall ?? 0);
  const marketplaceCommissionValue = Number(
    summary?.marketplaceCommission ??
      (jumiaCommissionValue + kilimallCommissionValue > 0
        ? jumiaCommissionValue + kilimallCommissionValue
        : 0),
  );
  const chamaValue = Number(
    summary?.chamaTotal ?? summary?.chama ?? summary?.adjustmentBreakdown?.chama ?? 0,
  );
  const bonusValue = Number(summary?.bonusTotal ?? 0);
  const topUpValue = Number(summary?.commissionTopUpTotal ?? 0);
  const transportValue = Number(summary?.transportAllowance ?? 0);
  const totalDeductions = Number(summary?.totalDeductions ?? 0);
  let deductionBreakdown: [string, number][] = [];
  let adjustmentBreakdown: [string, number][] = [];
  const adjEntries: { id: string; label: string; amount: number; adjustmentType: string; adjustmentKind: string }[] =
    (summary?.adjustmentEntries ?? []);
  if (adjEntries && adjEntries.length > 0) {
    adjustmentBreakdown = adjEntries.map((e) => [
      String(e.label || e.adjustmentType),
      String(e.adjustmentKind || "DEDUCTION").toUpperCase() === "ADDITION"
        ? Number(e.amount ?? 0)
        : -Math.abs(Number(e.amount ?? 0)),
    ]) as [string, number][];
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
    { label: "Transport allowance", value: transportValue },
    ...(directCommissionValue > 0 ? [{ label: "Direct POS commission", value: directCommissionValue }] : []),
    ...(jumiaCommissionValue > 0 ? [{ label: "Jumia commission", value: jumiaCommissionValue }] : []),
    ...(kilimallCommissionValue > 0 ? [{ label: "Kilimall commission", value: kilimallCommissionValue }] : []),
    ...(directCommissionValue <= 0 &&
    jumiaCommissionValue <= 0 &&
    kilimallCommissionValue <= 0 &&
    marketplaceCommissionValue > 0
      ? [{ label: "Marketplace commission", value: marketplaceCommissionValue }]
      : []),
    { label: "Commission", value: commissionValue },
    { label: "Chama adjustment", value: chamaValue },
    { label: "Bonuses", value: bonusValue },
    { label: "Top-ups", value: topUpValue },
    { label: "Deductions", value: totalDeductions },
  ].filter((row) => Number(row.value ?? 0) !== 0 || row.label === "Commission" || row.label === "Deductions");
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
        {adjustmentBreakdown.length > 0 && (
          <div className="space-y-1 rounded-2xl bg-slate-950/60 px-3 py-3 text-xs text-slate-400">
            <p className="uppercase tracking-wide text-[10px]">Saved payroll adjustments</p>
            <div className="space-y-1 text-sm text-slate-200">
              {adjustmentBreakdown.map(([label, amount]) => (
                <div key={label} className="flex items-center justify-between gap-3">
                  <span>{label}</span>
                  <span className={Number(amount) >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {locked ? "•••" : formatKES(Number(amount))}
                  </span>
                </div>
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
