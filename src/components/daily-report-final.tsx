"use client";

import { signOut, useSession } from "next-auth/react";
import HeaderActions from "@/components/HeaderActions";
import Link from "next/link";
import Card from "@/app/_components/Card";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarIcon } from "lucide-react";
import { getTradingPeriodFor, type TradingPeriod } from "@/lib/tradingPeriod";
import EarningsCard from "@/app/_components/EarningsCard";
import type { EarningsSummary } from "@/lib/earningsSummary";
import { showToast } from "@/lib/ui/toast";
import { useCardLock, LockButton } from "@/app/_components/useCardLock";
import SensitiveValue from "./SensitiveValue";
import DailyReportReceiptsPanel from "./daily-report-receipts";
import PeriodSwitcher from "@/app/_components/PeriodSwitcher";
import { withImpersonateId } from "@/lib/impersonation";

type PaymentMethod = "MPESA" | "CASH";

type ProductRow = {
  id: string;
  name: string;
};

type ReceiptRow = {
  id: string;
  sellingTotal: number | "";
  receiptNumber: string;
  paymentMethod: PaymentMethod;
  products: ProductRow[];
};

type SaleEntryPayload = {
  productName: string;
  price: number;
  paymentMethod: PaymentMethod;
  receiptNumber: string;
};

const kenyanLocale = "en-KE";
const kenyaTimeZone = "Africa/Nairobi";

const formatKES = (value?: number | null) =>
  `KES ${Number(value ?? 0).toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;

const toLocalIsoDate = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const cardClasses =
  "rounded-3xl border border-slate-800 bg-slate-800/70 shadow-2xl shadow-black/40";
const inputClasses =
  "w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
const textareaClasses =
  "w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500";
export default function DailyReportFinal() {
  const [showMyReceipts, setShowMyReceipts] = useState(false);

  // receipts-history controls (used when #my-receipts)
  const todayIso = new Date().toISOString().split("T")[0];
  const [startDate, setStartDate] = useState<string>(todayIso);
  const [endDate, setEndDate] = useState<string>(todayIso);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  const [receiptsSummary, setReceiptsSummary] = useState<{ count: number; totalSales: number }>({ count: 0, totalSales: 0 });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const applyThisTradingPeriodRange = useCallback(() => {
    const period = getTradingPeriodFor(new Date());
    setStartDate(toLocalIsoDate(period.start));
    setEndDate(toLocalIsoDate(period.end));
  }, []);

  const setRange = (range: "today" | "yesterday" | "thisWeek" | "period") => {
    const now = new Date();
    if (range === "today") {
      const iso = now.toISOString().split("T")[0];
      setStartDate(iso);
      setEndDate(iso);
      return;
    }
    if (range === "yesterday") {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const iso = d.toISOString().split("T")[0];
      setStartDate(iso);
      setEndDate(iso);
      return;
    }
    if (range === "thisWeek") {
      const d = new Date(now);
      const day = d.getDay();
      // compute Monday as start (if Sunday day=0 -> go back 6)
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const start = new Date(d);
      start.setDate(d.getDate() + diffToMonday);
      const isoStart = start.toISOString().split("T")[0];
      const isoEnd = now.toISOString().split("T")[0];
      setStartDate(isoStart);
      setEndDate(isoEnd);
      return;
    }
    if (range === "period") {
      applyThisTradingPeriodRange();
      return;
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    const sync = () => setShowMyReceipts(window.location.hash === "#my-receipts");
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);

  useEffect(() => {
    if (!showMyReceipts) return;
    const el = document.getElementById("my-receipts");
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showMyReceipts]);

  const [date, setDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split("T")[0];
  });
  const [dayOfWeek, setDayOfWeek] = useState<string>(() => {
    const d = new Date();
    return d.toLocaleDateString(kenyanLocale, { weekday: "long", timeZone: kenyaTimeZone });
  });

  const [receipts, setReceipts] = useState<ReceiptRow[]>([]);

  const [walkinsServed, setWalkinsServed] = useState<number | "">("");
  const [walkinsPurchased, setWalkinsPurchased] = useState<number | "">("");
  const [shopNeatness, setShopNeatness] = useState({
    cleaned: false,
    neat: false,
    labeled: false,
  });

  const [productsUploaded, setProductsUploaded] = useState<number | "">("");
  const [productsEdited, setProductsEdited] = useState<number | "">("");
  const [productsCopied, setProductsCopied] = useState<number | "">("");

  const [communications, setCommunications] = useState({
    repliedFbComments: false,
    repliedFbDms: false,
    repliedIgComments: false,
    repliedIgDms: false,
    clearedFbInbox: false,
    clearedIgInbox: false,
  });

  const [marketplace, setMarketplace] = useState({
    stockChecked: false,
    pricingConfirmed: false,
    competitorsReviewed: false,
    oosReview: false,
  });

  const [liveSession, setLiveSession] = useState({
    hosted: 0,
    viewers: 0,
    durationMinutes: 0,
    platforms: "",
  });

  const [thursdayActivities, setThursdayActivities] = useState({
    attendedMeeting: false,
    attendedShoot: false,
    videosShot: 0,
  });

  const [fridayTasks, setFridayTasks] = useState({
    promoVideosPosted: 0,
    preparedWeekendPromos: false,
    improvementSummary: "",
  });

  const [saturdaySummary, setSaturdaySummary] = useState({
    liveSessionNotes: "",
    weeklySummary: "",
  });
  const [commissionForPeriod, setCommissionForPeriod] = useState(0);
  const [serverQuickStats, setServerQuickStats] = useState<null | {
    totalSales: number;
    totalItems: number;
    totalNewProducts: number;
    totalEditedProducts: number;
    totalCopiedProducts: number;
    walkInsServed: number;
    walkInsPurchased: number;
    totalReceipts: number;
  }>(null);
  const [earningsSummary, setEarningsSummary] = useState<EarningsSummary | null>(null);
  const [earningsError, setEarningsError] = useState<string | null>(null);
  const [impersonateId, setImpersonateId] = useState<string | null>(null);
  const [resolvedAttendantEmail, setResolvedAttendantEmail] = useState<string | null>(null);
  const [hasAuthoritativeCommission, setHasAuthoritativeCommission] = useState(false);
  const sessionResponse = useSession();
  const session = sessionResponse?.data;
  const sessionStatus = sessionResponse?.status ?? "loading";
  const attendantId =
    impersonateId ?? ((session?.user as { id?: string } | undefined)?.id ?? null);
  const sessionEmail =
    typeof (session?.user as { email?: string } | undefined)?.email === "string"
      ? (session?.user as { email?: string }).email!.toLowerCase().trim()
      : null;
  const effectiveAttendantEmail = resolvedAttendantEmail ?? (impersonateId ? null : sessionEmail);
  const isBrendahView = effectiveAttendantEmail === "brendah@betech.co.ke";
  const canResolveCommissionOwner =
    Boolean(resolvedAttendantEmail) || (!impersonateId && sessionStatus !== "loading");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasValidationErrors] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  const currentPeriod = getTradingPeriodFor(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<TradingPeriod>(currentPeriod);
  const selectedPeriodKey = selectedPeriod.key;
  const selectedPeriodLabel = selectedPeriod.label;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setImpersonateId(params.get("impersonateId"));
  }, []);

  const loadEarnings = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedPeriodKey) return null;
      try {
        const basePath = "/api/attendant/earnings/summary";
        const params = new URLSearchParams({ periodKey: selectedPeriodKey });
        if (impersonateId) {
          params.set("impersonateId", impersonateId);
        }
        const url = `${basePath}?${params.toString()}`;
        const res = await fetch(url, {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal,
        });
        if (!res.ok) {
          if (res.status === 401 || res.status === 403) {
            setEarningsError(null);
            return null;
          }
          setEarningsError("Failed to load earnings summary.");
          return null;
        }
        const data = await res.json().catch(() => null);
        if (!data) return null;
        setEarningsError(null);
        setEarningsSummary(data);
        const nextAttendantEmail =
          typeof data.attendantEmail === "string" ? data.attendantEmail.toLowerCase().trim() : null;
        const prefersEarningsQuickStats = nextAttendantEmail === "brendah@betech.co.ke";
        setResolvedAttendantEmail(nextAttendantEmail);
        const grossCommission = Number(data.grossCommission ?? 0);
        setCommissionForPeriod(Math.round(grossCommission));
        setHasAuthoritativeCommission(Number.isFinite(grossCommission));
        const payrollSales = Number(data.totalSales ?? 0);
        const payrollItems = Number(data.totalItems ?? 0);
        const payrollReceipts = Number(data.totalReceipts ?? 0);

        // Quick stats should reflect the daily-report submissions (the same page the user is on),
        // not marketing/support ledgers or POS-only views.
        try {
          const qsParams = new URLSearchParams({ periodKey: selectedPeriodKey });
          if (impersonateId) qsParams.set("impersonateId", impersonateId);
          const qsRes = await fetch(`/api/attendant/daily-report/summary?${qsParams.toString()}`, {
            method: "GET",
            cache: "no-store",
            credentials: "same-origin",
            signal,
          });
          const qsData = await qsRes.json().catch(() => null);
          if (qsRes.ok && qsData) {
            const usePosTotals = Boolean(qsData.usePosTotals);
            const pos = (qsData.pos && typeof qsData.pos === "object") ? qsData.pos : null;
            const hasPosSales = usePosTotals && pos && Number(pos.totalSales ?? 0) > 0;
            const summarySales = hasPosSales ? Number(pos.totalSales ?? 0) : Number(qsData.totalSales ?? 0);
            const summaryItems = hasPosSales ? Number(pos.totalItems ?? 0) : Number(qsData.totalItems ?? 0);
            const summaryReceipts = hasPosSales ? Number(pos.totalReceipts ?? 0) : Number(qsData.totalReceipts ?? 0);
            const nextQuickStats = prefersEarningsQuickStats
              ? {
                  totalSales: payrollSales,
                  totalItems: payrollItems,
                  totalNewProducts: Number(qsData.totalNewProducts ?? data.totalNewProducts ?? 0),
                  totalEditedProducts: Number(qsData.totalEditedProducts ?? data.totalEditedProducts ?? 0),
                  totalCopiedProducts: Number(qsData.totalCopiedProducts ?? data.totalCopiedProducts ?? 0),
                  walkInsServed: Number(qsData.walkInsServed ?? 0),
                  walkInsPurchased: Number(qsData.walkInsPurchased ?? 0),
                  totalReceipts: payrollReceipts,
                }
              : {
                  totalSales: Math.max(summarySales, payrollSales),
                  totalItems: Math.max(summaryItems, payrollItems),
                  totalNewProducts: Number(qsData.totalNewProducts ?? 0),
                  totalEditedProducts: Number(qsData.totalEditedProducts ?? 0),
                  totalCopiedProducts: Number(qsData.totalCopiedProducts ?? 0),
                  walkInsServed: Number(qsData.walkInsServed ?? 0),
                  walkInsPurchased: Number(qsData.walkInsPurchased ?? 0),
                  totalReceipts: Math.max(summaryReceipts, payrollReceipts),
                };

            setServerQuickStats(nextQuickStats);
          } else {
            // fallback to earnings payload if daily-report summary isn't available
            setServerQuickStats({
              totalSales: Number(data.totalSales ?? 0),
              totalItems: Number(data.totalItems ?? 0),
              totalNewProducts: Number(data.totalNewProducts ?? 0),
              totalEditedProducts: Number(data.totalEditedProducts ?? 0),
              totalCopiedProducts: Number(data.totalCopiedProducts ?? 0),
              walkInsServed: Number(data.walkInsServed ?? 0),
              walkInsPurchased: Number(data.walkInsPurchased ?? 0),
              totalReceipts: Number(data.totalReceipts ?? 0),
            });
          }
        } catch {
          setServerQuickStats({
            totalSales: Number(data.totalSales ?? 0),
            totalItems: Number(data.totalItems ?? 0),
            totalNewProducts: Number(data.totalNewProducts ?? 0),
            totalEditedProducts: Number(data.totalEditedProducts ?? 0),
            totalCopiedProducts: Number(data.totalCopiedProducts ?? 0),
            walkInsServed: Number(data.walkInsServed ?? 0),
            walkInsPurchased: Number(data.walkInsPurchased ?? 0),
            totalReceipts: Number(data.totalReceipts ?? 0),
          });
        }
        return data;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        console.error("Failed to load earnings summary", err);
        return null;
      }
    },
    [impersonateId, selectedPeriodKey],
  );

  useEffect(() => {
    if (!selectedPeriodKey) return;
    const controller = new AbortController();
    loadEarnings(controller.signal);
    return () => controller.abort();
  }, [loadEarnings, selectedPeriodKey]);

  const fetchPeriodSummary = useCallback(
    async (signal?: AbortSignal) => {
      if (!selectedPeriodKey || typeof window === "undefined") return null;
      try {
        const url = new URL("/api/marketing/report/summary", window.location.origin);
        url.searchParams.set("periodKey", selectedPeriodKey);
        url.searchParams.set("date", date);
        if (impersonateId) {
          url.searchParams.set("impersonateId", impersonateId);
        }
        const res = await fetch(url.toString(), {
          method: "GET",
          cache: "no-store",
          credentials: "same-origin",
          signal,
        });
        if (!res.ok) return null;
        const data = await res.json().catch(() => null);
        if (!data) return null;
        if (isBrendahView) {
          setServerQuickStats((prev) => ({
            totalSales: Number(data.aggregates?.totalSales ?? 0),
            totalItems: Number(data.aggregates?.totalItems ?? 0),
            totalNewProducts: Number(prev?.totalNewProducts ?? 0),
            totalEditedProducts: Number(prev?.totalEditedProducts ?? 0),
            totalCopiedProducts: Number(prev?.totalCopiedProducts ?? 0),
            walkInsServed: Number(prev?.walkInsServed ?? 0),
            walkInsPurchased: Number(prev?.walkInsPurchased ?? 0),
            totalReceipts: Number(data.aggregates?.totalReceipts ?? 0),
          }));
        }
        const commission = data?.aggregates?.commission?.commission;
        if (
          canResolveCommissionOwner &&
          isBrendahView &&
          typeof commission === "number" &&
          Number.isFinite(commission)
        ) {
          const roundedCommission = Math.round(commission);
          setCommissionForPeriod(roundedCommission);
          setEarningsSummary((prev) =>
            prev
              ? {
                  ...prev,
                  salesCommission: roundedCommission,
                  grossCommission: roundedCommission,
                  commission: roundedCommission,
                  totalEarnings:
                    Number(prev.baseSalary ?? 0) +
                    Number(prev.transportAllowance ?? 0) +
                    roundedCommission +
                    Number(prev.bonusTotal ?? 0),
                  netPay:
                    Number(prev.baseSalary ?? 0) +
                    Number(prev.transportAllowance ?? 0) +
                    roundedCommission +
                    Number(prev.bonusTotal ?? 0) -
                    Number(prev.totalDeductions ?? 0),
                }
              : prev,
          );
        }
        if (
          canResolveCommissionOwner &&
          !hasAuthoritativeCommission &&
          !isBrendahView &&
          typeof commission === "number"
        ) {
          setCommissionForPeriod(Math.round(commission));
        }
        return data;
      } catch (err) {
        if ((err as Error).name === "AbortError") return null;
        console.error("Failed to load marketing period summary", err);
        return null;
      }
    },
    [
      canResolveCommissionOwner,
      date,
      hasAuthoritativeCommission,
      impersonateId,
      isBrendahView,
      selectedPeriodKey,
      sessionStatus,
    ],
  );

  const downloadPerformanceReceiptPdf = useCallback(() => {
    const periodKey = selectedPeriodKey || currentPeriod.key;
    const params = new URLSearchParams({ periodKey });
    if (impersonateId) params.set("impersonateId", impersonateId);
    const url = `/api/attendant/daily-report/performance-receipt/pdf?${params.toString()}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }, [currentPeriod.key, impersonateId, selectedPeriodKey]);

  useEffect(() => {
    if (!selectedPeriodKey) return;
    const controller = new AbortController();
    fetchPeriodSummary(controller.signal);
    return () => controller.abort();
  }, [fetchPeriodSummary, selectedPeriodKey]);

  const clamp0 = (value: unknown) => Math.max(0, Number(value ?? 0) || 0);

  const { totalReceipts, totalSales, totalItems, totalNewProducts } = useMemo(() => {
    let totalReceipts = 0;
    let totalSales = 0;
    let totalItems = 0;

    receipts.forEach((r) => {
      const receiptNumber = String(r.receiptNumber ?? "").trim();
      const sellingTotal = clamp0(r.sellingTotal);
      const hasAnyProduct = (r.products ?? []).some((p) => String(p?.name ?? "").trim().length > 0);

      // Ignore the default empty receipt row so Quick Stats doesn't show
      // 1 receipt / 0 sales when nothing has been entered yet.
      const isMeaningful = receiptNumber.length > 0 || sellingTotal > 0 || hasAnyProduct;
      if (!isMeaningful) return;

      totalReceipts += 1;
      totalSales += sellingTotal;
      totalItems += (r.products ?? []).filter((p) => String(p?.name ?? "").trim().length > 0).length;
    });

    const totalNewProducts = clamp0(productsUploaded);
    return { totalReceipts, totalSales, totalItems, totalNewProducts };
  }, [receipts, productsUploaded]);

  const totalEditedProducts = clamp0(productsEdited);
  const totalCopiedProducts = clamp0(productsCopied);
  const totalWalkinsServed = Number(walkinsServed || 0);
  const totalWalkinsPurchased = Number(walkinsPurchased || 0);

  const serverStats = serverQuickStats;
  const displayedSalesKes = clamp0(serverStats?.totalSales) + totalSales;
  const displayedItems = clamp0(serverStats?.totalItems) + totalItems;
  const displayedReceipts = clamp0(serverStats?.totalReceipts) + totalReceipts;
  const displayedNewProducts =
    clamp0(serverStats?.totalNewProducts) + clamp0(productsUploaded);
  const displayedEditedProducts =
    clamp0(serverStats?.totalEditedProducts) + clamp0(productsEdited);
  const displayedCopiedProducts =
    clamp0(serverStats?.totalCopiedProducts) + clamp0(productsCopied);
  const displayedWalkInsServed =
    clamp0(serverStats?.walkInsServed) + clamp0(walkinsServed);
  const displayedWalkInsPurchased =
    clamp0(serverStats?.walkInsPurchased) + clamp0(walkinsPurchased);

  // Build a public fallback earnings summary when the server restricts detailed
  // earnings data to authenticated attendants. This lets the UI show a card
  // with basic values even when the user is not signed in.
  const publicFallbackSummary: EarningsSummary = {
    periodKey: selectedPeriodKey,
    periodLabel: selectedPeriodLabel,
    totalSales: serverStats?.totalSales ?? 0,
    totalProfit: 0,
    totalNewProducts: serverStats?.totalNewProducts ?? 0,
    totalEditedProducts: serverStats?.totalEditedProducts ?? 0,
    totalCopiedProducts: serverStats?.totalCopiedProducts ?? 0,
    baseSalary: 0,
    transportAllowance: 0,
    salesCommission: commissionForPeriod,
    newProductCommission: 0,
    copiedCommission: 0,
    editedCommission: 0,
    grossCommission: commissionForPeriod,
    batteryEarnings: 0,
    bonusTotal: 0,
    commissionTopUpTotal: 0,
    chamaTotal: 0,
    latenessTotal: 0,
    disciplineTotal: 0,
    otherDeductionsTotal: 0,
    totalEarnings: commissionForPeriod,
    totalDeductions: 0,
    netPay: commissionForPeriod,
  };

  const salesTotals = {
    receipts: totalReceipts,
    sales: totalSales,
    items: totalItems,
  };

  const handleResetDay = () => {
    setReceipts([]);
    setWalkinsServed("");
    setWalkinsPurchased("");
    setShopNeatness({ cleaned: false, neat: false, labeled: false });
    setProductsUploaded("");
    setProductsEdited("");
    setProductsCopied("");
    setCommunications({
      repliedFbComments: false,
      repliedFbDms: false,
      repliedIgComments: false,
      repliedIgDms: false,
      clearedFbInbox: false,
      clearedIgInbox: false,
    });
    setMarketplace({
      stockChecked: false,
      pricingConfirmed: false,
      competitorsReviewed: false,
      oosReview: false,
    });
    setLiveSession({ hosted: 0, viewers: 0, durationMinutes: 0, platforms: "" });
    setThursdayActivities({ attendedMeeting: false, attendedShoot: false, videosShot: 0 });
    setFridayTasks({ promoVideosPosted: 0, preparedWeekendPromos: false, improvementSummary: "" });
    setSaturdaySummary({ liveSessionNotes: "", weeklySummary: "" });
  };

  const buildSalesEntries = (): SaleEntryPayload[] => {
    const rows: SaleEntryPayload[] = [];
    receipts.forEach((receipt) => {
      const total = normalizeNumber(receipt.sellingTotal);
      const productCount = receipt.products.length;
      if (productCount === 0) {
        rows.push({
          productName: receipt.receiptNumber ? `Receipt ${receipt.receiptNumber}` : "Receipt sale",
          price: total,
          paymentMethod: receipt.paymentMethod,
          receiptNumber: receipt.receiptNumber,
        });
        return;
      }
      const base = Math.floor(total / productCount);
      let remainder = total - base * productCount;
      receipt.products.forEach((product, index) => {
        const incremental = base + (remainder > 0 ? 1 : 0);
        if (remainder > 0) remainder -= 1;
        rows.push({
          productName: product.name || `Product ${index + 1}`,
          price: incremental,
          paymentMethod: receipt.paymentMethod,
          receiptNumber: receipt.receiptNumber,
        });
      });
    });
    return rows;
  };

  const buildTasksPayload = () => ({
    receipts,
    totals: salesTotals,
    walkIns: {
      served: normalizeNumber(walkinsServed),
      purchased: normalizeNumber(walkinsPurchased),
    },
    neatness: shopNeatness,
    productTasks: {
      uploaded: normalizeNumber(productsUploaded),
      edited: normalizeNumber(productsEdited),
      copied: normalizeNumber(productsCopied),
    },
    communications,
    marketplace,
    liveSession,
    thursdayActivities,
    fridayTasks,
    saturdaySummary,
    commissionForPeriod,
    sales: buildSalesEntries(),
  });

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(null);

    const tasksPayload = buildTasksPayload();
    const requestBody = {
      date,
      day: dayOfWeek,
      productsCount: salesTotals.items,
      totalSales: salesTotals.sales,
      tasks: tasksPayload,
      newProducts: normalizeNumber(productsUploaded),
      productsEdited: normalizeNumber(productsEdited),
      copiesUploaded: normalizeNumber(productsCopied),
      walkInServed: normalizeNumber(walkinsServed),
      purchasesMade: normalizeNumber(walkinsPurchased),
      liveSessionsCount: normalizeNumber(liveSession.hosted),
      commissionEarned: commissionForPeriod,
      confirmedCompetitiveness: marketplace.pricingConfirmed,
      marketEngagement: {
        communications,
        marketplace,
        liveSession,
      },
      concerns: saturdaySummary.weeklySummary,
    };

    try {
      const endpoint = impersonateId
        ? `/api/daily-report?impersonateId=${encodeURIComponent(impersonateId)}`
        : "/api/daily-report";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Failed to submit daily report");
      }
      showToast("Daily report submitted", "success");
      setSubmitSuccess("Daily report submitted successfully.");
      await loadEarnings();
      await fetchPeriodSummary();
      handleResetDay();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to submit daily report";
      setSubmitError(message);
      showToast(message, "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const datePicker = (
    <div className="flex items-center gap-2">
      <CalendarIcon size={16} className="text-slate-400" />
      <input
        type="date"
        value={date}
        onChange={(e) => {
          setDate(e.target.value);
          const d = new Date(e.target.value);
          if (!Number.isNaN(d.getTime())) {
            setDayOfWeek(
              d.toLocaleDateString(kenyanLocale, { weekday: "long", timeZone: kenyaTimeZone }),
            );
          }
        }}
        className={inputClasses}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => {
            const d = new Date();
            const iso = d.toISOString().split("T")[0];
            setDate(iso);
            setDayOfWeek(
              d.toLocaleDateString(kenyanLocale, { weekday: "long", timeZone: kenyaTimeZone }),
            );
          }}
          className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-900/70"
        >
          Today
        </button>
        <button
          type="button"
          onClick={() => {
            const d = new Date();
            d.setDate(d.getDate() - 1);
            const iso = d.toISOString().split("T")[0];
            setDate(iso);
            setDayOfWeek(
              d.toLocaleDateString(kenyanLocale, { weekday: "long", timeZone: kenyaTimeZone }),
            );
          }}
          className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-900/70"
        >
          Yesterday
        </button>
      </div>
    </div>
  );


  const dayOfWeekSelect = (
    <select value={dayOfWeek} onChange={(e) => setDayOfWeek(e.target.value)} className={inputClasses}>
      {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map(
        (day) => (
          <option key={day} value={day}>
            {day}
          </option>
        ),
      )}
    </select>
  );

  if (showMyReceipts) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <main className="mx-auto max-w-5xl space-y-6 p-6">
          <header className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold">Receipts history</h1>
              <p className="text-sm text-slate-300">Browse every receipt captured in the system. Use the range pills or custom dates to narrow the window.</p>
            </div>
            <Link
              href={withImpersonateId("/attendant/daily-report", impersonateId)}
              className="rounded-full border border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/40 hover:bg-white/10"
            >
              Back to dashboard
            </Link>
          </header>

          <Card className="space-y-5 border-slate-800 bg-slate-900/80 shadow-xl shadow-black/40">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Receipts list</p>
                <h2 className="text-lg font-semibold text-slate-100">Read-only receipts history</h2>
                <p className="text-sm text-slate-400">Explore every receipt captured across the system and filter by date, range, or attendant.</p>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
                <button onClick={() => setRange("today")} className={`rounded-full border px-4 py-1 transition ${startDate === new Date().toISOString().split("T")[0] && endDate === new Date().toISOString().split("T")[0] ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"}`}>
                  Today
                </button>
                <button onClick={() => setRange("yesterday")} className={`rounded-full border px-4 py-1 transition ${(() => { const d = new Date(); d.setDate(d.getDate()-1); const iso = d.toISOString().split("T")[0]; return startDate===iso && endDate===iso ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white" })()}`}>
                  Yesterday
                </button>
                <button onClick={() => setRange("thisWeek")} className={`rounded-full border px-4 py-1 transition ${(() => { const now=new Date(); const day=now.getDay(); const diffToMonday = day===0?-6:1-day; const monday=new Date(now); monday.setDate(now.getDate()+diffToMonday); const isoMonday=monday.toISOString().split("T")[0]; const isoToday=new Date().toISOString().split("T")[0]; return startDate===isoMonday && endDate===isoToday ? "border-emerald-500 bg-emerald-500/20 text-emerald-200" : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white" })()}`}>
                  This week
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    applyThisTradingPeriodRange();
                  }}
                  className={`rounded-full border px-4 py-1 transition ${(() => {
                    const p = getTradingPeriodFor(new Date());
                    const s = toLocalIsoDate(p.start);
                    const en = toLocalIsoDate(p.end);
                    return startDate === s && endDate === en
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                      : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white";
                  })()}`}
                >
                  This period
                </button>
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-4">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Search
                <input placeholder="Customer, attendant, receipt..." value={searchTerm} onChange={(e)=>setSearchTerm(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Start date
                <input type="date" value={startDate} onChange={(e)=>setStartDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                End date
                <input type="date" value={endDate} onChange={(e)=>setEndDate(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500" />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Range</p>
                <p className="text-sm font-semibold text-slate-100">Selected</p>
                <p className="text-xs text-slate-400">Showing receipts from {startDate} to {endDate}</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Receipts</p>
                <p className="text-2xl font-semibold text-emerald-300">{receiptsSummary.count}</p>
                <p className="text-xs text-slate-400">Captured in the selected window</p>
              </div>
              <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-4 py-3">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">Total sales</p>
                <p className="text-2xl font-semibold text-emerald-300">{formatKES(receiptsSummary.totalSales ?? 0)}</p>
                <p className="text-xs text-slate-400">Aggregated from the receipts below</p>
              </div>
            </div>

            <div>
              {/* Include the receipts list - hide the small header inside the panel */}
              <DailyReportReceiptsPanel
                start={startDate}
                end={endDate}
                q={debouncedSearch}
                attendantId={attendantId}
                hideHeader
                onlyPos
                onSummary={(s) => setReceiptsSummary({ count: s.count, totalSales: s.totalSales })}
              />
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 px-6 py-8 space-y-6">
      <section className="mb-2 space-y-6">
        <div className="rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl lg:text-3xl font-semibold">Marketing Operations Dashboard</h1>
              <p className="text-slate-400 text-sm">
                Daily tracker for uploads, engagement, walk-ins and live sessions.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={downloadPerformanceReceiptPdf}
                className="rounded-xl border border-white/10 bg-transparent px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
              >
                Download performance receipt (PDF)
              </button>
              {/* Header actions extracted to shared component */}
              <HeaderActions
                receiptsHref="#my-receipts"
                createHref={`/receipts?view=create`}
                onSignOut={() => signOut({ callbackUrl: "/attendant/login" })}
                onReceiptsClick={() => setShowMyReceipts(true)}
                showDot={true}
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Statistics period</p>
              <p className="text-lg font-semibold text-slate-50">{selectedPeriodLabel}</p>
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

      <section className="rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-4 md:px-8 md:py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:gap-8">
          <div className="flex-1">
            <label className="block text-xs font-medium uppercase tracking-wide text-slate-400">Date</label>
          </div>

            <div className="md:flex md:items-center md:justify-end md:gap-3">
              <div className="md:w-[150px]">{datePicker}</div>
              <div className="mt-3 md:mt-0 md:w-[150px]">{dayOfWeekSelect}</div>
            </div>
          </div>
        </section>
      </section>

      {!showMyReceipts && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-12">
            <div className="xl:col-span-6">
              <QuickStats
                receipts={displayedReceipts}
                salesKes={displayedSalesKes}
                newProducts={displayedNewProducts}
                editedProducts={displayedEditedProducts}
                copiedProducts={displayedCopiedProducts}
                walkInsServed={displayedWalkInsServed}
                walkInsPurchased={displayedWalkInsPurchased}
                commissionKes={commissionForPeriod}
                periodLabel={selectedPeriodLabel}
              />
            </div>

            <div className="xl:col-span-6">
              <EarningsCard summary={earningsSummary ?? publicFallbackSummary} lockKey="dailyreport:earnings" />
            </div>
          </div>

          <DaySpecificBlocks
            selectedDay={dayOfWeek}
            walkIns={Number(walkinsServed || 0)}
            onWalkInsChange={(val) => setWalkinsServed(val)}
            neatness={shopNeatness}
            onNeatnessChange={setShopNeatness}
            productTasks={{
              uploaded: productsUploaded,
              edited: productsEdited,
              copied: productsCopied,
            }}
            onProductTasksChange={(next) => {
              setProductsUploaded(next.uploaded);
              setProductsEdited(next.edited);
              setProductsCopied(next.copied);
            }}
            communications={communications}
            onCommunicationsChange={setCommunications}
            marketplace={marketplace}
            onMarketplaceChange={setMarketplace}
            liveSession={liveSession}
            onLiveSessionChange={setLiveSession}
            thursdayActivities={thursdayActivities}
            onThursdayActivitiesChange={setThursdayActivities}
            fridayTasks={fridayTasks}
            onFridayTasksChange={setFridayTasks}
            saturdaySummary={saturdaySummary}
            onSaturdaySummaryChange={setSaturdaySummary}
          />

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleResetDay}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Reset day
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-xl bg-emerald-500 px-6 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
            >
              {isSubmitting ? "Submitting..." : "Submit report"}
            </button>
          </div>
        </div>
      )}

      {showMyReceipts && <DailyReportReceiptsPanel start={date} end={date} attendantId={attendantId} onlyPos />}
    </div>
  );
}

// Helper components

function DaySpecificBlocks(props: DaySpecificBlocksProps) {
  const {
    selectedDay,
    walkIns,
    onWalkInsChange,
    neatness,
    onNeatnessChange,
    productTasks,
    onProductTasksChange,
    communications,
    onCommunicationsChange,
    marketplace,
    onMarketplaceChange,
    liveSession,
    onLiveSessionChange,
    thursdayActivities,
    onThursdayActivitiesChange,
    fridayTasks,
    onFridayTasksChange,
    saturdaySummary,
    onSaturdaySummaryChange,
  } = props;

  const showNeatness = ["Monday", "Thursday", "Friday", "Saturday"].includes(selectedDay);

  return (
    <div className="space-y-6">
      <WalkInsNeatnessCard
        valueWalkIns={walkIns}
        onWalkInsChange={onWalkInsChange}
        neatness={neatness}
        onNeatnessChange={onNeatnessChange}
        showNeatness={showNeatness}
      />
      <ProductStockCard productTasks={productTasks} onChange={onProductTasksChange} />
      <CustomerCommunicationsCard value={communications} onChange={onCommunicationsChange} />
      <MarketplaceReviewCard value={marketplace} onChange={onMarketplaceChange} />
      {selectedDay === "Tuesday" && <TuesdayPromoCard value={productTasks} onChange={onProductTasksChange} />}
      {selectedDay === "Wednesday" && (
        <>
          <LiveSessionCoreCard value={liveSession} onChange={onLiveSessionChange} />
          <WednesdayFollowUpCard />
          <WednesdayEngagementCard />
        </>
      )}
      {selectedDay === "Thursday" && (
        <WeeklyMarketingActivitiesCard value={thursdayActivities} onChange={onThursdayActivitiesChange} />
      )}
      {selectedDay === "Friday" && (
        <FridayPromoTasksCard value={fridayTasks} onChange={onFridayTasksChange} />
      )}
      {selectedDay === "Saturday" && (
        <>
          <LiveSessionCoreCard value={liveSession} onChange={onLiveSessionChange} />
          <SaturdaySummaryCard value={saturdaySummary} onChange={onSaturdaySummaryChange} />
        </>
      )}
    </div>
  );
}

function WalkInsNeatnessCard(props: {
  valueWalkIns: number;
  onWalkInsChange: (val: number) => void;
  neatness: { cleaned: boolean; neat: boolean; labeled: boolean };
  onNeatnessChange: (next: { cleaned: boolean; neat: boolean; labeled: boolean }) => void;
  showNeatness: boolean;
}) {
  const { valueWalkIns, onWalkInsChange, neatness, onNeatnessChange, showNeatness } = props;

  return (
    <section className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Walk-ins & shop neatness</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Walk-ins who purchased
          </label>
          <input
            type="number"
            min={0}
            className={inputClasses}
            value={valueWalkIns}
            onChange={(e) => onWalkInsChange(Number(e.target.value) || 0)}
          />
        </div>
        {showNeatness && (
          <div className="space-y-3">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Shop condition
            </label>
            <div className="flex flex-col gap-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={neatness.cleaned}
                  onChange={(e) => onNeatnessChange({ ...neatness, cleaned: e.target.checked })}
                />
                <span>Shop cleaned</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={neatness.neat}
                  onChange={(e) => onNeatnessChange({ ...neatness, neat: e.target.checked })}
                />
                <span>Shop neatness</span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={neatness.labeled}
                  onChange={(e) => onNeatnessChange({ ...neatness, labeled: e.target.checked })}
                />
                <span>Display labeled</span>
              </label>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function ProductStockCard(props: {
  productTasks: { uploaded: number | ""; edited: number | ""; copied: number | "" };
  onChange: (val: { uploaded: number | ""; edited: number | ""; copied: number | "" }) => void;
}) {
  const { productTasks, onChange } = props;
  return (
    <section className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Product & stock management</h2>
      <div className="space-y-3">
        <NumberRow label="Products uploaded" value={productTasks.uploaded} onChange={(v) => onChange({ ...productTasks, uploaded: v })} />
        <NumberRow label="Products edited" value={productTasks.edited} onChange={(v) => onChange({ ...productTasks, edited: v })} />
        <NumberRow label="Products copied" value={productTasks.copied} onChange={(v) => onChange({ ...productTasks, copied: v })} />
      </div>
    </section>
  );
}

function CustomerCommunicationsCard(props: {
  value: CommunicationsState;
  onChange: (val: CommunicationsState) => void;
}) {
  const { value, onChange } = props;
  const entries = [
    { label: "Replied to FB comments", key: "repliedFbComments" },
    { label: "Replied to FB DMs", key: "repliedFbDms" },
    { label: "Replied to IG comments", key: "repliedIgComments" },
    { label: "Replied to IG DMs", key: "repliedIgDms" },
    { label: "Cleared FB inbox", key: "clearedFbInbox" },
    { label: "Cleared IG inbox", key: "clearedIgInbox" },
  ];
  return (
    <section className={cardClasses + " p-6 space-y-3"}>
      <h2 className="text-lg font-semibold">Customer & communications</h2>
      <div className="flex flex-wrap gap-2">
        {entries.map((item) => (
          <PillCheckbox
            key={item.key}
            label={item.label}
            checked={value[item.key as keyof typeof value]}
            onChange={(next) => onChange({ ...value, [item.key]: next })}
          />
        ))}
      </div>
    </section>
  );
}

function MarketplaceReviewCard(props: {
  value: MarketplaceState;
  onChange: (val: MarketplaceState) => void;
}) {
  const { value, onChange } = props;
  const entries = [
    { label: "Stock checked", key: "stockChecked" },
    { label: "Pricing confirmed", key: "pricingConfirmed" },
    { label: "Competitors reviewed", key: "competitorsReviewed" },
    { label: "Out of stock review", key: "oosReview" },
  ];
  return (
    <section className={cardClasses + " p-6 space-y-3"}>
      <h2 className="text-lg font-semibold">Marketplace review</h2>
      <div className="flex flex-wrap gap-2">
        {entries.map((item) => (
          <PillCheckbox
            key={item.key}
            label={item.label}
            checked={value[item.key as keyof typeof value]}
            onChange={(next) => onChange({ ...value, [item.key]: next })}
          />
        ))}
      </div>
    </section>
  );
}

function TuesdayPromoCard(props: {
  value: { uploaded: number | ""; edited: number | ""; copied: number | "" };
  onChange: (val: { uploaded: number | ""; edited: number | ""; copied: number | "" }) => void;
}) {
  const { value, onChange } = props;
  return (
    <section className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Tuesday – promo content</h2>
      <p className="text-sm text-slate-400">
        Post product highlights or promotional videos and record at least one demo video for future content scheduling.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Promo videos / highlights posted
          </label>
          <input
            type="number"
            min={0}
            className={inputClasses}
            value={value.uploaded}
            onChange={(e) => onChange({ ...value, uploaded: Number(e.target.value) || 0 })}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Product demo videos recorded
          </label>
          <input
            type="number"
            min={0}
            className={inputClasses}
            value={value.edited}
            onChange={(e) => onChange({ ...value, edited: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    </section>
  );
}

function LiveSessionCoreCard(props: {
  value: LiveSessionState;
  onChange: (val: LiveSessionState) => void;
}) {
  const { value, onChange } = props;
  const v = value;
  return (
    <section className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Live session</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: "Live sessions hosted", key: "hosted" },
          { label: "Viewers (estimated)", key: "viewers" },
          { label: "Duration (minutes)", key: "durationMinutes" },
        ].map((field) => (
          <div key={field.key}>
            <label className="text-xs uppercase tracking-wide text-slate-400">{field.label}</label>
            <input
              type="number"
              min={0}
              className={inputClasses}
              value={v[field.key as keyof typeof v]}
              onChange={(e) => onChange({ ...v, [field.key]: Number(e.target.value) || 0 })}
            />
          </div>
        ))}
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Platform used (TikTok / IG / FB / YT)
        </label>
        <textarea
          rows={2}
          className={textareaClasses}
          value={v.platforms}
          onChange={(e) => onChange({ ...v, platforms: e.target.value })}
        />
      </div>
    </section>
  );
}

function WednesdayFollowUpCard() {
  return (
    <section className={cardClasses + " p-6 space-y-3"}>
      <h2 className="text-lg font-semibold">Live session follow-ups</h2>
      <p className="text-sm text-slate-400">
        Conduct timely follow-ups on leads generated from the live session.
      </p>
      <textarea rows={3} className={textareaClasses} placeholder="Notes on follow-ups, customers contacted, next actions…" />
    </section>
  );
}

function WednesdayEngagementCard() {
  return (
    <section className={cardClasses + " p-6 space-y-3"}>
      <h2 className="text-lg font-semibold">Content engagement tracking</h2>
      <p className="text-sm text-slate-400">
        Track engagement data to identify top-performing content (views, comments, saves, shares).
      </p>
      <textarea rows={3} className={textareaClasses} placeholder="Top-performing posts, engagement numbers, lessons learnt…" />
    </section>
  );
}

function WeeklyMarketingActivitiesCard(props: {
  value: ThursdayActivitiesState;
  onChange: (val: ThursdayActivitiesState) => void;
}) {
  const { value, onChange } = props;
  return (
    <section className={cardClasses + " p-6 space-y-5"}>
      <h2 className="text-lg font-semibold">Weekly marketing activities (Thursday)</h2>
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Weekly meeting</p>
          <div className="flex flex-wrap gap-3">
            <TogglePill
              active={value.attendedMeeting}
              onClick={() => onChange({ ...value, attendedMeeting: true })}
            >
              Attended weekly marketing meeting
            </TogglePill>
            <TogglePill
              active={!value.attendedMeeting}
              onClick={() => onChange({ ...value, attendedMeeting: false })}
            >
              Did not attend
            </TogglePill>
          </div>
        </div>
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-400 mb-2">Video shoot</p>
          <div className="flex flex-wrap gap-3">
            <TogglePill
              active={value.attendedShoot}
              onClick={() => onChange({ ...value, attendedShoot: true })}
            >
              Participated in weekly video shoot
            </TogglePill>
            <TogglePill
              active={!value.attendedShoot}
              onClick={() => onChange({ ...value, attendedShoot: false })}
            >
              Did not participate
            </TogglePill>
          </div>
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Number of videos participated in (shooting)
          </label>
          <input
            type="number"
            min={0}
            className={inputClasses}
            value={value.videosShot}
            onChange={(e) => onChange({ ...value, videosShot: Number(e.target.value) || 0 })}
          />
        </div>
      </div>
    </section>
  );
}

function FridayPromoTasksCard(props: {
  value: FridayTasksState;
  onChange: (val: FridayTasksState) => void;
}) {
  const { value, onChange } = props;
  return (
    <section className={cardClasses + " p-6 space-y-5"}>
      <h2 className="text-lg font-semibold">Friday – weekend prep & improvements</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Post engaging product videos or testimonials
          </label>
          <input
            type="number"
            min={0}
            className={inputClasses}
            value={value.promoVideosPosted}
            onChange={(e) => onChange({ ...value, promoVideosPosted: Number(e.target.value) || 0 })}
          />
        </div>
        <div className="flex items-center gap-2 mt-6 sm:mt-0">
          <input
            type="checkbox"
            checked={value.preparedWeekendPromos}
            onChange={(e) => onChange({ ...value, preparedWeekendPromos: e.target.checked })}
          />
          <span className="text-sm">Prepare weekend promotions or schedule future posts</span>
        </div>
      </div>
      <div>
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Final improvement suggestions for the week (based on competitor activities)
        </label>
        <textarea
          rows={3}
          className={textareaClasses}
          value={value.improvementSummary}
          onChange={(e) => onChange({ ...value, improvementSummary: e.target.value })}
          placeholder="Improvements, competitor moves, ideas for next week…"
        />
      </div>
    </section>
  );
}

function SaturdaySummaryCard(props: {
  value: SaturdaySummaryState;
  onChange: (val: SaturdaySummaryState) => void;
}) {
  const { value, onChange } = props;
  return (
    <section className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Weekly performance summary</h2>
      <p className="text-sm text-slate-400">
        Submit weekly performance summary including performance suggestions, improvement ideas,
        complaints or any issues that need management attention.
      </p>
      <div className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Live session highlights / key learnings
          </label>
          <textarea
            rows={3}
            className={textareaClasses}
            value={value.liveSessionNotes}
            onChange={(e) => onChange({ ...value, liveSessionNotes: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Weekly performance summary & issues needing management attention
          </label>
          <textarea
            rows={4}
            className={textareaClasses}
            value={value.weeklySummary}
            onChange={(e) => onChange({ ...value, weeklySummary: e.target.value })}
          />
        </div>
      </div>
    </section>
  );
}

function TogglePill(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  const { active, onClick, children } = props;
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "rounded-full px-4 py-2 text-xs sm:text-sm font-medium border transition-colors " +
        (active
          ? "bg-emerald-500 text-black border-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.35)]"
          : "bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800")
      }
    >
      {children}
    </button>
  );
}

function NumberRow(props: { label: string; value: number | ""; onChange: (v: number | "") => void }) {
  const { label, value, onChange } = props;
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-slate-100">{label}</span>
      <input
        type="number"
        min={0}
        value={value}
        onChange={(e) => {
          if (e.target.value === "") {
            onChange("");
            return;
          }
          const next = Number(e.target.value);
          onChange(Number.isFinite(next) ? Math.max(0, next) : 0);
        }}
        className="w-24 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-1.5 text-sm text-right text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}

type QuickStatsProps = {
  receipts: number;
  salesKes: number;
  newProducts: number;
  editedProducts: number;
  copiedProducts: number;
  walkInsServed: number;
  walkInsPurchased: number;
  commissionKes: number;
  periodLabel?: string;
};

function QuickStats({
  receipts,
  salesKes,
  newProducts,
  editedProducts,
  copiedProducts,
  walkInsServed,
  walkInsPurchased,
  commissionKes,
  periodLabel,
}: QuickStatsProps) {
  const { locked, toggle } = useCardLock("dailyreport:quickstats");
  const mask = (v: React.ReactNode) => (locked ? "•••" : v);

  return (
    <section className="rounded-3xl border border-slate-800 bg-slate-950/70 px-6 py-6 md:px-8 md:py-7">
      <div className="flex flex-col gap-4 md:flex-row md:items-baseline md:justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-50">Quick stats</h2>
          <LockButton locked={locked} onToggle={toggle} />
        </div>
        <p className="text-xs text-slate-400 md:text-right">{periodLabel || "TRADING PERIOD 25TH LAST MONTH - 24TH THIS MONTH"}</p>
      </div>

      <div className="mt-5 grid gap-3 grid-cols-1 sm:grid-cols-3">
        <div className="rounded-2xl bg-slate-900/70 px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Receipts</div>
          <div className="mt-1 text-xl font-semibold text-emerald-400">{mask(receipts ?? 0)}</div>
        </div>
        <div className="rounded-2xl bg-slate-900/70 px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Sales (KES)</div>
          <div className="mt-1 text-xl font-semibold text-emerald-400">{mask(salesKes?.toLocaleString() ?? "0")}</div>
        </div>
        <div className="rounded-2xl bg-slate-900/70 px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">New products</div>
          <div className="mt-1 text-xl font-semibold text-emerald-400">{mask(newProducts ?? 0)}</div>
        </div>
        <div className="rounded-2xl bg-slate-900/70 px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Edited products</div>
          <div className="mt-1 text-xl font-semibold text-emerald-400">{mask(editedProducts ?? 0)}</div>
        </div>
        <div className="rounded-2xl bg-slate-900/70 px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Copied products</div>
          <div className="mt-1 text-xl font-semibold text-emerald-400">{mask(copiedProducts ?? 0)}</div>
        </div>
        <div className="rounded-2xl bg-slate-900/70 px-3 py-2">
          <div className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Commission (KES)</div>
          <div className="mt-1 text-xl font-semibold text-emerald-400">
            <SensitiveValue
              value={commissionKes ?? 0}
              format={(v) => Number(v).toLocaleString()}
              storageKey={`dailyreport:commission`}
              forceHidden={locked}
              forceVisible={!locked}
            />
          </div>
        </div>
      </div>
    </section>
  );
}

function PillCheckbox(props: { label: string; checked: boolean; onChange: (next: boolean) => void }) {
  const { label, checked, onChange } = props;
  return (
    <label
      className={
        "inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-medium border transition-colors " +
        (checked
          ? "bg-emerald-500 text-black border-emerald-500"
          : "bg-slate-900 text-slate-200 border-slate-700 hover:bg-slate-800")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="hidden"
      />
      <span>{label}</span>
    </label>
  );
}

type CommunicationsState = {
  repliedFbComments: boolean;
  repliedFbDms: boolean;
  repliedIgComments: boolean;
  repliedIgDms: boolean;
  clearedFbInbox: boolean;
  clearedIgInbox: boolean;
};

type MarketplaceState = {
  stockChecked: boolean;
  pricingConfirmed: boolean;
  competitorsReviewed: boolean;
  oosReview: boolean;
};

type LiveSessionState = {
  hosted: number;
  viewers: number;
  durationMinutes: number;
  platforms: string;
};

type ThursdayActivitiesState = {
  attendedMeeting: boolean;
  attendedShoot: boolean;
  videosShot: number;
};

type FridayTasksState = {
  promoVideosPosted: number;
  preparedWeekendPromos: boolean;
  improvementSummary: string;
};

type SaturdaySummaryState = {
  liveSessionNotes: string;
  weeklySummary: string;
};

type DaySpecificBlocksProps = {
  selectedDay: string;
  walkIns: number;
  onWalkInsChange: (val: number) => void;
  neatness: { cleaned: boolean; neat: boolean; labeled: boolean };
  onNeatnessChange: (val: { cleaned: boolean; neat: boolean; labeled: boolean }) => void;
  productTasks: { uploaded: number | ""; edited: number | ""; copied: number | "" };
  onProductTasksChange: (val: { uploaded: number | ""; edited: number | ""; copied: number | "" }) => void;
  communications: CommunicationsState;
  onCommunicationsChange: (val: CommunicationsState) => void;
  marketplace: MarketplaceState;
  onMarketplaceChange: (val: MarketplaceState) => void;
  liveSession: LiveSessionState;
  onLiveSessionChange: (val: LiveSessionState) => void;
  thursdayActivities: ThursdayActivitiesState;
  onThursdayActivitiesChange: (val: ThursdayActivitiesState) => void;
  fridayTasks: FridayTasksState;
  onFridayTasksChange: (val: FridayTasksState) => void;
  saturdaySummary: SaturdaySummaryState;
  onSaturdaySummaryChange: (val: SaturdaySummaryState) => void;
};
  
const normalizeNumber = (value: number | "" | undefined) => {
  if (typeof value === "number") return value;
  if (value === "" || typeof value === "undefined") return 0;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
