
"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReceiptsSummary from "./list/ReceiptsSummary";
import RowActions from "./list/RowActions";
import MarkdownRendererClient, { RichFormattingToggle } from "@/components/MarkdownRendererClient";
import { showToast } from "@/lib/ui/toast";

type ReceiptRow = {
  id: string;
  orderRef?: string;
  docType: string;
  createdAt: string;
  customerName?: string | null;
  attendantName?: string | null;
  total?: number | string | null;
  status?: string | null;
  items?: Array<{ id: string }> | null;
  paymentMethod?: "MPESA" | "CASH" | null;
  paymentStatus?: string | null;
  source?: "pos" | "marketing" | "support";
  detailUrl?: string | null;
};

type ReceiptSummary = {
  totalCount: number;
  totalValue: number;
  averageValue: number;
  lastReceipt?: { id: string; createdAt: string; customerName?: string | null };
};

type FilterState = {
  q: string;
  docType: string;
  start: string;
  end: string;
  attendantId: string;
  paymentMethod: "MPESA" | "CASH" | "";
};

type PaymentTotals = {
  mpesa: { totalSales: number; count: number };
  cash: { totalSales: number; count: number };
};

type StaffOption = { id: string; name: string };

type AdminQuickRangeKey = "today" | "yesterday" | "this-week" | "custom";

type SupportItemDetail = {
  id: string;
  buyingPrice: number | null;
  productName?: string | null;
};

type ReceiptDetailPayload = {
  receipt: any;
  supportItems?: SupportItemDetail[];
  supportReceiptSummary?: { id: string; buyingTotal?: number | null } | null;
};

type ItemWithCost = {
  id: string;
  quantity: number;
  sellingPrice: number;
  serial?: string | null;
  warranty?: string | null;
  product?: { name?: string | null } | null;
  buyingPrice: number | null;
  displayName: string;
};

type CostSummary = {
  itemsWithCost: ItemWithCost[];
  supportBuyingTotal: number;
  hasCompleteCosts: boolean;
};

type EditItem = {
  id: string;
  title: string;
  quantity: number;
  unitPrice: number;
  serial?: string | null;
  warranty?: string | null;
  buyingPrice: number;
};

type EditDraft = {
  docType: string;
  attendantId: string | null;
  customerName: string;
  customerPhone?: string | null;
  taxRate: number;
  showTax: boolean;
  discount: number;
  showDiscount: boolean;
  paymentDetailsShown: boolean;
  notes?: string | null;
  warrantyText?: string | null;
  items: EditItem[];
};

type Props = {
  initial?: ReceiptRow[];
  allowEdit?: boolean;
  onSummaryChange?: (summary: ReceiptSummary) => void;
  refreshSignal?: number;
  scope?: "mine" | "global";
};

const DOC_TYPES = ["RECEIPT", "INVOICE", "QUOTATION", "LAYAWAY"];
const WARRANTY_OPTIONS = ["", "3 Months", "6 Months", "1 Year", "2 Years", "3 Years", "5 Years"];
const PAGE_SIZE = 50;

const randomId = () => Math.random().toString(36).slice(2, 9);

const computeSummary = (rows: ReceiptRow[]): ReceiptSummary => {
  const totalValue = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
  const totalCount = rows.length;
  const averageValue = totalCount ? totalValue / totalCount : 0;
  const head = rows[0];
  const lastReceipt = head
    ? { id: head.id, createdAt: head.createdAt, customerName: head.customerName }
    : undefined;
  return { totalCount, totalValue, averageValue, lastReceipt };
};

const formatCurrency = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "KES 0";
  return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Date(value).toLocaleString();
};

const formatDateInput = (date: Date) =>
  date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });

const formatRangeLabel = (value?: string) => {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
};

const makeDefaultFilters = (): FilterState => {
  const today = new Date();
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  return {
    q: "",
    docType: "",
    start: formatDateInput(start),
    end: formatDateInput(end),
    attendantId: "",
    paymentMethod: "",
  };
};

const startOfDayForRange = (value = new Date()) => {
  const clone = new Date(value);
  clone.setHours(0, 0, 0, 0);
  return clone;
};

const getWeekBounds = (reference = new Date()) => {
  const day = reference.getDay();
  const diff = (day + 6) % 7;
  const start = new Date(reference);
  start.setDate(reference.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const buildDateParam = (value: string, endOfDay: boolean) => {
  // Expect `value` in `YYYY-MM-DD` format (produced by `formatDateInput`).
  // Send an explicit Nairobi-local ISO timestamp so server-side parsing
  // is consistent regardless of the browser's timezone. The admin
  // summary endpoint also supports raw YYYY-MM-DD, but sending an
  // explicit `+03:00` offset keeps listing and summary behavior in sync.
  if (!value) return undefined;
  const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!match) return undefined;
  return endOfDay ? `${value}T23:59:59.999+03:00` : `${value}T00:00:00+03:00`;
};

const csvEscape = (value: string | number | null | undefined) => {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

const buildDraftFromDetail = (detail: ReceiptDetailPayload): EditDraft => {
  const receipt = detail.receipt;
  const order = receipt?.order ?? {};
  const dataItems = Array.isArray(receipt?.data?.items) ? receipt.data.items : [];
  const orderItems = Array.isArray(order?.items) ? order.items : [];
  const sourceItems = dataItems.length ? dataItems : orderItems;
  const supportCostMap = new Map<string, number>();
  (detail.supportItems ?? []).forEach((item) => {
    const key = String(item.productName ?? "").trim().toLowerCase();
    if (key) {
      supportCostMap.set(key, Number(item.buyingPrice ?? 0));
    }
  });
  const items: EditItem[] =
    sourceItems.length > 0
      ? sourceItems.map((it: any) => ({
          id: it.id || randomId(),
          title: it.title || it.productName || it.name || "",
          quantity: Number(it.quantity || 1),
          unitPrice: Number(it.unitPrice ?? it.sellingPrice ?? it.price ?? 0),
          serial: it.serial ?? null,
          warranty: it.warranty ?? null,
          buyingPrice: Number(
            it.buyingPrice ?? supportCostMap.get((it.title || it.productName || it.name || "").trim().toLowerCase()) ?? 0,
          ),
        }))
      : [
        {
          id: randomId(),
          title: "",
          quantity: 1,
          unitPrice: 0,
          serial: null,
          warranty: null,
          buyingPrice: 0,
        },
      ];

  return {
    docType: String(receipt?.docType || "RECEIPT").toUpperCase(),
    attendantId: order?.attendant?.id ?? order?.attendantId ?? null,
    customerName: order?.customerName || receipt?.data?.customerName || "",
    customerPhone: order?.customerPhone || receipt?.data?.customerPhone || "",
    taxRate: Number(receipt?.taxRate ?? 0),
    showTax: Boolean(receipt?.showTax),
    discount: Number(receipt?.discount ?? 0),
    showDiscount: Boolean(receipt?.showDiscount),
    paymentDetailsShown: Boolean(receipt?.paymentDetailsShown),
    notes: receipt?.notes ?? null,
    warrantyText: receipt?.warrantyText ?? null,
    items,
  };
};
export default function ReceiptsAdminClient({
  initial = [],
  allowEdit,
  onSummaryChange,
  refreshSignal = 0,
  scope,
}: Props) {
  const [rows, setRows] = useState<ReceiptRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaryTotals, setSummaryTotals] = useState<{
    totalSales: number;
    totalProfit: number;
    totalCost: number;
    totalProfitPriced?: number;
    totalProfitInclusive?: number;
    receiptsCount: number;
    itemsCount: number;
    hasCompleteCosts: boolean;
    awaitingPricingCount?: number;
    paymentTotals: {
      mpesa: { totalSales: number; count: number };
      cash: { totalSales: number; count: number };
    };
  } | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [sseEnabled, setSseEnabled] = useState(false);
  // Start with SSE turned off by default to avoid unexpected snapshot reloads
  // flipping the UI; users can opt-in via the toggle in the UI.
  const [sseOn, setSseOn] = useState<boolean>(false); // user preference: use SSE when supported
  const [sseStatus, setSseStatus] = useState<"connected" | "reconnecting" | "fallback" | "closed">("fallback");
  const sseRetryRef = useRef(0);
  const sseEsRef = useRef<EventSource | null>(null);
  const [quickRange, setQuickRange] = useState<AdminQuickRangeKey>("today");
  const [filters, setFilters] = useState<FilterState>(() => makeDefaultFilters());
  const [appliedFilters, setAppliedFilters] = useState<FilterState>(() => makeDefaultFilters());
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [selected, setSelected] = useState<ReceiptRow | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState<ReceiptDetailPayload | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [sendingChannel, setSendingChannel] = useState<"email" | "whatsapp" | null>(null);
  const [pendingEditId, setPendingEditId] = useState<string | null>(null);
  const [editState, setEditState] = useState<{ open: boolean; draft: EditDraft | null; saving: boolean }>({
    open: false,
    draft: null,
    saving: false,
  });
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const firstLoadRef = useRef(true);
  const STORAGE_KEYS = {
    attendantId: "receipts.attendantId.v1",
    quickRange: "receipts.quickRange.v1",
    rangeStart: "receipts.rangeStart.v1",
    rangeEnd: "receipts.rangeEnd.v1",
    paymentMethod: "receipts.paymentMethod.v1",
  } as const;
  const scopeMode = scope ?? "mine";

  // load persisted filters (attendant + quick range) on mount
  useEffect(() => {
    try {
      const savedAttendant = window.localStorage.getItem(STORAGE_KEYS.attendantId);
      const savedQuick = window.localStorage.getItem(STORAGE_KEYS.quickRange) as AdminQuickRangeKey | null;
      const savedStart = window.localStorage.getItem(STORAGE_KEYS.rangeStart);
      const savedEnd = window.localStorage.getItem(STORAGE_KEYS.rangeEnd);
      const savedPaymentMethod = window.localStorage.getItem(STORAGE_KEYS.paymentMethod) as "MPESA" | "CASH" | "" | null;
      setFilters((prev) => {
        let next = { ...prev };
        if (savedAttendant) next.attendantId = savedAttendant;
        if (savedStart) next.start = savedStart;
        if (savedEnd) next.end = savedEnd;
        if (savedPaymentMethod) next.paymentMethod = savedPaymentMethod;
        return next;
      });
      setAppliedFilters((prev) => {
        let next = { ...prev };
        if (savedAttendant) next.attendantId = savedAttendant;
        if (savedStart) next.start = savedStart;
        if (savedEnd) next.end = savedEnd;
        if (savedPaymentMethod) next.paymentMethod = savedPaymentMethod;
        return next;
      });
      if (
        savedQuick === "today" ||
        savedQuick === "yesterday" ||
        savedQuick === "this-week" ||
        savedQuick === "custom"
      ) {
        setQuickRange(savedQuick);
      }
    } catch (err) {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    setRows(initial);
    setHasMore(initial.length === PAGE_SIZE);
    setPage(1);
  }, [initial]);

  useEffect(() => {
    onSummaryChange?.(computeSummary(rows));
  }, [rows, onSummaryChange]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/receipts/staff", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load staff");
        if (cancelled) return;
        const options: StaffOption[] = (Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [])
          .filter((u: any) => u?.id)
          .map((u: any) => ({ id: u.id, name: u.name || u.email || u.id }));
        setStaffList(options);
      } catch (err) {
        console.warn("[receipts] failed to load staff", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const loadRows = useCallback(
    async (targetPage: number, opts?: { silent?: boolean }) => {
      setError(null);
      if (!opts?.silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(targetPage));
        params.set("size", String(PAGE_SIZE));
        params.set("includeItems", "false");
        if (appliedFilters.q.trim()) params.set("q", appliedFilters.q.trim());
        if (appliedFilters.docType) params.set("docType", appliedFilters.docType);
        if (appliedFilters.attendantId) params.set("attendantId", appliedFilters.attendantId);
        if (appliedFilters.paymentMethod) params.set("paymentMethod", appliedFilters.paymentMethod);
        const startParam = buildDateParam(appliedFilters.start, false);
        const endParam = buildDateParam(appliedFilters.end, true);
        if (startParam) params.set("start", startParam);
        if (endParam) params.set("end", endParam);
        params.set("scope", scopeMode);

        const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data?.error || "Failed to load receipts");
        const nextRows = Array.isArray(data?.receipts) ? data.receipts : [];
        setRows(nextRows);
        setHasMore(nextRows.length === PAGE_SIZE);
        setPage(targetPage);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load receipts";
        setError(message);
        showToast(message, "error");
      } finally {
        if (!opts?.silent) setLoading(false);
      }
    },
    [appliedFilters, scopeMode],
  );

  useEffect(() => {
    const silent = firstLoadRef.current;
    firstLoadRef.current = false;
    void loadRows(1, { silent });
  }, [appliedFilters, loadRows]);

  useEffect(() => {
    if (!firstLoadRef.current) {
      void loadRows(1);
    }
  }, [refreshSignal, loadRows]);

  // Fetch summary (extracted so it can be polled)
  const fetchSummary = useCallback(async (opts?: { signal?: AbortSignal }) => {
    setSummaryLoading(true);
    try {
      const params = new URLSearchParams();
      const startParam = buildDateParam(appliedFilters.start, false);
      const endParam = buildDateParam(appliedFilters.end, true);
      if (startParam) params.set("start", startParam);
      if (endParam) params.set("end", endParam);
      if (appliedFilters.paymentMethod) params.set("paymentMethod", appliedFilters.paymentMethod);
      if (appliedFilters.attendantId) {
        params.set("attendantId", appliedFilters.attendantId);
      }
      const res = await fetch(`/api/admin/receipts/summary?${params.toString()}`, {
        cache: "no-store",
        signal: opts?.signal,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to load summary");
      setSummaryTotals({
        totalSales: Number(data.totalSales ?? 0),
        // Prefer the inclusive per-receipt sum if provided, fall back to legacy
        totalProfit: Number(data.totalProfitInclusive ?? data.totalProfit ?? 0),
        totalCost: Number(data.totalCost ?? 0),
        // expose both variants on data for potential UI use
        totalProfitPriced: Number(data.totalProfitPriced ?? 0),
        totalProfitInclusive: Number(data.totalProfitInclusive ?? data.totalProfit ?? 0),
        receiptsCount: Number(data.receiptsCount ?? 0),
        itemsCount: Number(data.itemsCount ?? 0),
        hasCompleteCosts: Boolean(data.hasCompleteCosts ?? false),
        awaitingPricingCount: Number(data.awaitingPricingCount ?? 0),
        paymentTotals:
          data?.paymentTotals ??
          {
            mpesa: { totalSales: 0, count: 0 },
            cash: { totalSales: 0, count: 0 },
          },
      });
    } catch (err) {
      console.warn("[receipts] summary error", err);
      setSummaryTotals(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [appliedFilters]);

  // initial fetch and when filters change
  useEffect(() => {
    const controller = new AbortController();
    void fetchSummary({ signal: controller.signal });
    return () => controller.abort();
  }, [fetchSummary]);

  // detect EventSource support and prefer SSE when available
  useEffect(() => {
    if (typeof window !== "undefined" && "EventSource" in window) {
      setSseEnabled(true);
    }
  }, []);

  // Poll the summary every 30 seconds when SSE is not enabled
  useEffect(() => {
    if (sseEnabled && sseOn) return; // SSE will handle updates
    // polling active when SSE not supported or user opted out
    const interval = setInterval(() => void fetchSummary(), 30_000);
    // run an immediate fetch to ensure quick update when switching modes
    void fetchSummary();
    return () => clearInterval(interval);
  }, [fetchSummary, sseEnabled, sseOn]);

  // If SSE is enabled and user opted-in, open an EventSource with reconnect/backoff
  useEffect(() => {
    if (!sseEnabled || !sseOn) {
      // ensure any existing ES is closed
      try {
        sseEsRef.current?.close();
      } catch {}
      sseEsRef.current = null;
      setSseStatus("fallback");
      return;
    }

    let aborted = false;

      const startEventSource = () => {
        sseRetryRef.current = Math.max(0, sseRetryRef.current);
        const params = new URLSearchParams();
        const startParam = buildDateParam(appliedFilters.start, false);
        const endParam = buildDateParam(appliedFilters.end, true);
        if (startParam) params.set("start", startParam);
        if (endParam) params.set("end", endParam);
        if (appliedFilters.attendantId) params.set("attendantId", appliedFilters.attendantId);
        if (appliedFilters.paymentMethod) params.set("paymentMethod", appliedFilters.paymentMethod);
        const url = `/api/admin/receipts/summary/stream?${params.toString()}`;

      try {
        const es = new EventSource(url);
        sseEsRef.current = es;
        setSseStatus("reconnecting");

        es.onopen = () => {
          sseRetryRef.current = 0;
          setSseStatus("connected");
        };

        es.onmessage = (e) => {
          try {
            const data = JSON.parse(e.data);
            setSummaryTotals({
              totalSales: Number(data.totalSales ?? 0),
              totalProfit: Number(data.totalProfitInclusive ?? data.totalProfit ?? 0),
              totalCost: Number(data.totalCost ?? 0),
              totalProfitPriced: Number(data.totalProfitPriced ?? 0),
              totalProfitInclusive: Number(data.totalProfitInclusive ?? data.totalProfit ?? 0),
              receiptsCount: Number(data.receiptsCount ?? 0),
              itemsCount: Number(data.itemsCount ?? 0),
              hasCompleteCosts: Boolean(data.hasCompleteCosts ?? false),
              awaitingPricingCount: Number(data.awaitingPricingCount ?? 0),
              paymentTotals:
                data?.paymentTotals ??
                {
                  mpesa: { totalSales: 0, count: 0 },
                  cash: { totalSales: 0, count: 0 },
                },
            });
          } catch (err) {
            console.warn("[receipts] failed to parse SSE data", err);
          }
        };

        es.onerror = () => {
          // close and attempt reconnect with backoff
          try {
            es.close();
          } catch {}
          if (aborted) return;
          sseRetryRef.current = (sseRetryRef.current ?? 0) + 1;
          const attempt = sseRetryRef.current;
          const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(attempt, 6)));
          setSseStatus("reconnecting");
          setTimeout(() => {
            if (!aborted) startEventSource();
          }, delay);
        };
      } catch (err) {
        console.warn("[receipts] failed to create EventSource", err);
        // schedule reconnection
        sseRetryRef.current = (sseRetryRef.current ?? 0) + 1;
        const attempt = sseRetryRef.current;
        const delay = Math.min(30_000, 1000 * Math.pow(2, Math.min(attempt, 6)));
        setSseStatus("reconnecting");
        setTimeout(() => {
          if (!aborted) startEventSource();
        }, delay);
      }
    };

    startEventSource();

    return () => {
      aborted = true;
      try {
        sseEsRef.current?.close();
      } catch {}
      sseEsRef.current = null;
    };
  }, [sseEnabled, sseOn, appliedFilters]);

  const persistFilterValues = (nextFilters: FilterState) => {
    try {
      window.localStorage.setItem(STORAGE_KEYS.attendantId, nextFilters.attendantId || "");
      window.localStorage.setItem(STORAGE_KEYS.rangeStart, nextFilters.start || "");
      window.localStorage.setItem(STORAGE_KEYS.rangeEnd, nextFilters.end || "");
      window.localStorage.setItem(STORAGE_KEYS.paymentMethod, nextFilters.paymentMethod || "");
      window.localStorage.setItem(STORAGE_KEYS.quickRange, quickRange);
    } catch (err) {
      // ignore storage errors
    }
  };

  const applyFilters = (patch?: Partial<FilterState>) => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      setAppliedFilters(next);
      persistFilterValues(next);
      return next;
    });
  };

  const resetFilters = () => {
    const defaults = makeDefaultFilters();
    setFilters(defaults);
    setAppliedFilters(defaults);
    setQuickRange("today");
    try {
      window.localStorage.removeItem(STORAGE_KEYS.attendantId);
      window.localStorage.removeItem(STORAGE_KEYS.rangeStart);
      window.localStorage.removeItem(STORAGE_KEYS.rangeEnd);
      window.localStorage.removeItem(STORAGE_KEYS.paymentMethod);
      window.localStorage.setItem(STORAGE_KEYS.quickRange, "today");
    } catch (err) {
      // ignore
    }
  };

  const applyQuickRange = (key: AdminQuickRangeKey) => {
    const now = new Date();
    const bounds =
      key === "today"
        ? {
            start: formatDateInput(startOfDayForRange(now)),
            end: formatDateInput(startOfDayForRange(now)),
          }
        : key === "yesterday"
        ? (() => {
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            const dayStart = startOfDayForRange(yesterday);
            return {
              start: formatDateInput(dayStart),
              end: formatDateInput(dayStart),
            };
          })()
        : (() => {
            const { start, end } = getWeekBounds(now);
            return { start: formatDateInput(start), end: formatDateInput(end) };
          })();
    const nextFilters = { ...filters, ...bounds };
    setFilters(nextFilters);
    setAppliedFilters(nextFilters);
    setQuickRange(key);
    try {
      window.localStorage.setItem(STORAGE_KEYS.attendantId, nextFilters.attendantId || "");
      window.localStorage.setItem(STORAGE_KEYS.rangeStart, nextFilters.start || "");
      window.localStorage.setItem(STORAGE_KEYS.rangeEnd, nextFilters.end || "");
      window.localStorage.setItem(STORAGE_KEYS.quickRange, key);
    } catch (err) {
      // ignore
    }
  };

  const gotoPage = (next: number) => {
    if (next < 1) return;
    void loadRows(next);
  };

  const handleManualRefresh = () => {
    void loadRows(page);
  };
  const handleRowClick = (row: ReceiptRow) => {
    if ((row.source ?? "pos") !== "pos") {
      showToast("Receipt detail view is only available for POS receipts", "info");
      return;
    }
    setSelected(row);
    setDrawerOpen(true);
    setDetail(null);
    setDetailLoading(true);
    (async () => {
      try {
        const res = await fetch(`/api/receipts/${row.id}`, { cache: "no-store" });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(payload?.error || "Failed to load receipt");
        setDetail(payload as ReceiptDetailPayload);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load receipt";
        showToast(message, "error");
      } finally {
        setDetailLoading(false);
      }
    })();
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setSelected(null);
    setDetail(null);
    setDetailLoading(false);
  };

  const handleSend = async (channel: "email" | "whatsapp") => {
    if (!selected) return;
    if ((selected.source ?? "pos") !== "pos") {
      showToast("Sending is only supported for POS receipts", "info");
      return;
    }
    setSendingChannel(channel);
    try {
      console.log('[receipts][client] sending', { id: selected.id, channel });
      const res = await fetch(`/api/receipts/${selected.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: [channel] }),
      });
      let data: any = {};
      try {
        data = await res.json();
      } catch (e) {
        console.error('[receipts][client] failed to parse response JSON', e);
      }
      console.log('[receipts][client] send response', { status: res.status, body: data });
      if (!res.ok) throw new Error(data?.error || "Failed to queue send");
      showToast(`Queued ${channel === "email" ? "email" : "WhatsApp"} send`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to queue send";
      showToast(message, "error");
    } finally {
      setSendingChannel(null);
    }
  };

  const sendReceiptById = async (receiptId: string, channel: "email" | "whatsapp") => {
    if (receiptId.startsWith("marketing-") || receiptId.startsWith("support-")) {
      showToast("Sending is only supported for POS receipts", "info");
      return;
    }
    setSendingChannel(channel);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: [channel] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to queue send");
      showToast(`Queued ${channel === "email" ? "email" : "WhatsApp"} send`, "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to queue send";
      showToast(message, "error");
    } finally {
      setSendingChannel(null);
    }
  };

  const handleDeleteReceipt = async () => {
    if (!selected || !allowEdit) return;
    if (!window.confirm("Delete this receipt and all related records from the system?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/receipts/${selected.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete receipt");
      showToast("Receipt deleted", "success");
      closeDrawer();
      await loadRows(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete receipt";
      showToast(message, "error");
    } finally {
      setDeleting(false);
    }
  };

  const deleteReceiptById = async (receiptId: string) => {
    if (!allowEdit) return;
    if (receiptId.startsWith("marketing-") || receiptId.startsWith("support-")) {
      showToast("Deletion is only supported for POS receipts", "info");
      return;
    }
    if (!window.confirm("Delete this receipt and all related records from the system?")) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to delete receipt");
      showToast("Receipt deleted", "success");
      // if we deleted the currently selected, close drawer
      if (selected?.id === receiptId) closeDrawer();
      await loadRows(page);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to delete receipt";
      showToast(message, "error");
    } finally {
      setDeleting(false);
    }
  };

  useEffect(() => {
    if (pendingEditId && detail?.receipt?.id === pendingEditId) {
      setPendingEditId(null);
      openEditModal();
    }
  }, [pendingEditId, detail?.receipt?.id]);

  const openEditModal = () => {
    if (!allowEdit) return;
    if (!detail?.receipt) {
      showToast("Load receipt details first", "warn");
      return;
    }
    const draft = buildDraftFromDetail(detail);
    setEditState({ open: true, draft, saving: false });
  };

  const updateDraft = (next: EditDraft) => {
    setEditState((prev) => ({ ...prev, draft: next }));
  };

  const handleSaveEdit = async () => {
    if (!detail?.receipt || !editState.draft) return;
    if (!editState.draft.items.length) {
      showToast("Add at least one item before saving", "warn");
      return;
    }
    setEditState((prev) => ({ ...prev, saving: true }));
    try {
      const payload = {
        ...editState.draft,
        items: editState.draft.items.map((it) => ({
          title: it.title,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          buyingPrice: Math.max(0, Number(it.buyingPrice)),
          serial: it.serial,
          warranty: it.warranty,
        })),
      };
      const res = await fetch(`/api/receipts/${detail.receipt.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || "Failed to update receipt");
      showToast("Receipt updated", "success");
      setEditState({ open: false, draft: null, saving: false });
      setDetail((prev) => (prev ? { ...prev, receipt: data.receipt ?? prev.receipt } : prev));
      setSelected((prev) =>
        prev && prev.id === detail.receipt.id
          ? {
              ...prev,
              total: data?.receipt?.totals?.total ?? prev.total,
              customerName: data?.receipt?.order?.customerName ?? prev.customerName,
            }
          : prev,
      );
      await loadRows(page, { silent: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to update receipt";
      showToast(message, "error");
      setEditState((prev) => ({ ...prev, saving: false }));
    }
  };

  const costSummary = useMemo<CostSummary>(() => {
    const orderItems = detail?.receipt?.order?.items ?? [];
  if (!orderItems.length) {
      return { itemsWithCost: [], supportBuyingTotal: 0, hasCompleteCosts: false };
    }
    // If the server provided a supportReceiptSummary with a stored buyingTotal,
    // prefer that authoritative DB value for the admin UI to match the DB.
    const supportReceiptBuyingTotal =
      detail?.supportReceiptSummary && Number(detail.supportReceiptSummary.buyingTotal ?? 0) > 0
        ? Number(detail.supportReceiptSummary.buyingTotal ?? 0)
        : null;
    const supportQueue = (detail?.supportItems ?? []).map((item) => ({ ...item }));
    let allItemCostsKnown = true;
    const itemsWithCost: ItemWithCost[] = orderItems.map((item: any) => {
      const normalizedName = (item.product?.name ?? "").trim();
      const matchIndex =
        normalizedName.length > 0
          ? supportQueue.findIndex(
              (support) =>
                support.productName &&
                support.productName.trim().toLowerCase() === normalizedName.toLowerCase(),
            )
          : -1;
      const matched = matchIndex >= 0 ? supportQueue.splice(matchIndex, 1)[0] : null;
      const displayName = item.product?.name ?? matched?.productName ?? "Item";
      const hasCost = matched?.buyingPrice !== null && Number(matched?.buyingPrice ?? 0) > 0;
      if (!hasCost) allItemCostsKnown = false;
      return {
        ...item,
        buyingPrice: matched?.buyingPrice ?? null,
        displayName,
      };
    });

    // Sum support costs by support-item (do not multiply by order.quantity).
    // The support receipt `buyingPrice` is treated as the per-support-item cost
    // and the admin summary/receipt UI uses a per-support-item aggregation.
    const matchedCost = itemsWithCost.reduce((sum, item) => {
      // treat missing or non-positive buyingPrice as unknown (do not count)
      if (item.buyingPrice === null || Number(item.buyingPrice ?? 0) <= 0) return sum;
      return sum + Number(item.buyingPrice ?? 0);
    }, 0);
    let supportCostSum = 0;
    let supportHasUnknown = false;
    for (const entry of supportQueue) {
      if (entry.buyingPrice === null || Number(entry.buyingPrice ?? 0) <= 0) {
        supportHasUnknown = true;
        continue;
      }
      supportCostSum += Math.max(0, Number(entry.buyingPrice));
    }
    const hasCompleteCosts = allItemCostsKnown && !supportHasUnknown;
    return {
      itemsWithCost,
      supportBuyingTotal: supportReceiptBuyingTotal !== null ? supportReceiptBuyingTotal : matchedCost + supportCostSum,
      hasCompleteCosts,
    };
  }, [detail]);

  const handleExport = () => {
    if (!rows.length) {
      showToast("No rows to export", "warn");
      return;
    }
    setExporting(true);
    try {
      const header = ["Receipt ID", "Order Ref", "Doc Type", "Customer", "Staff", "Total", "Status", "Created At"];
      const csv = [header.join(",")];
      for (const row of rows) {
        csv.push(
          [
            csvEscape(row.id),
            csvEscape(row.orderRef || ""),
            csvEscape(row.docType),
            csvEscape(row.customerName || ""),
            csvEscape(row.attendantName || ""),
            csvEscape(Number(row.total ?? 0).toFixed(2)),
            csvEscape(row.status || ""),
            csvEscape(new Date(row.createdAt).toISOString()),
          ].join(","),
        );
      }
      const blob = new Blob([csv.join("\n")], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `receipts-${appliedFilters.start || "start"}-${appliedFilters.end || "end"}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast("Export ready", "success");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to export CSV";
      showToast(message, "error");
    } finally {
      setExporting(false);
    }
  };
  const { itemsWithCost, supportBuyingTotal, hasCompleteCosts } = costSummary;
  const receiptGrandTotal = Number(detail?.receipt?.totals?.total ?? detail?.receipt?.order?.totalAmount ?? 0);
  const profitAmount = hasCompleteCosts ? receiptGrandTotal - supportBuyingTotal : 0;
  const profitColor =
    hasCompleteCosts && profitAmount >= 0 ? "text-emerald-300" : hasCompleteCosts ? "text-rose-400" : "text-slate-400";
  const hasSupportItems = Boolean(detail?.supportItems?.length);
  const rangeLabelText =
    quickRange === "today"
      ? "Today"
      : quickRange === "yesterday"
      ? "Yesterday"
      : quickRange === "this-week"
      ? "This week"
      : "Custom range";
  const profitColorClass =
    (summaryTotals?.totalProfit ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300";
  const summarySalesLabel = summaryLoading
    ? "Loading..."
    : formatCurrency(summaryTotals?.totalSales ?? 0);
  const summaryProfitLabel = summaryLoading
    ? "Loading..."
    : formatCurrency(summaryTotals?.totalProfit ?? 0);
  const formattedRangeStart = formatRangeLabel(appliedFilters.start);
  const formattedRangeEnd = formatRangeLabel(appliedFilters.end);
  const rangeDisplay =
    formattedRangeStart && formattedRangeEnd
      ? formattedRangeStart === formattedRangeEnd
        ? formattedRangeStart
        : `${formattedRangeStart} - ${formattedRangeEnd}`
      : rangeLabelText;
  const partialTotals = useMemo(() => {
    const totals: Record<"MPESA" | "CASH", number> = { MPESA: 0, CASH: 0 };
    rows.forEach((row) => {
      if ((row.status ?? "").toUpperCase() !== "PARTIAL") return;
      const method = (row.paymentMethod ?? "").toUpperCase();
      if (method === "MPESA" || method === "CASH") {
        totals[method] += Number(row.total ?? 0);
      }
    });
    return totals;
  }, [rows]);
  const handlePaymentMethodSelect = (method: "" | "MPESA" | "CASH") => {
    const next = appliedFilters.paymentMethod === method ? "" : method;
    applyFilters({ paymentMethod: next });
  };
  return (
    <div className="space-y-6">
      <ReceiptsSummary
        summary={summaryTotals ?? null}
        loading={summaryLoading}
        quickRange={quickRange}
        onApplyQuickRange={(k) => applyQuickRange(k)}
        sseOn={sseOn && sseEnabled}
        sseStatus={sseStatus}
        onToggleSse={(v: boolean) => setSseOn(v)}
        rangeLabel={rangeDisplay}
      />
      <PaymentMethodFilterCard
        totals={summaryTotals?.paymentTotals ?? null}
        partialTotals={partialTotals}
        activeMethod={appliedFilters.paymentMethod}
        loading={summaryLoading}
        onSelect={handlePaymentMethodSelect}
      />
      <section className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-black/30">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Search customer / order / staff
            <input
              value={filters.q}
              onChange={(e) => setFilters((prev) => ({ ...prev, q: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500"
              placeholder="eg. Jane, OR-123..."
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Document type
            <select
              value={filters.docType}
              onChange={(e) => setFilters((prev) => ({ ...prev, docType: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">All</option>
              {DOC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            From
              <input
                type="date"
                value={filters.start}
                onChange={(e) => {
                  setQuickRange("custom");
                  setFilters((prev) => {
                    const next = { ...prev, start: e.target.value };
                    if (next.end && next.start && next.start > next.end) next.end = next.start;
                    return next;
                  });
                }}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
              />
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            To
            <input
              type="date"
              value={filters.end}
              onChange={(e) => {
                setQuickRange("custom");
                setFilters((prev) => {
                  const next = { ...prev, end: e.target.value };
                  if (next.start && next.end && next.end < next.start) next.start = next.end;
                  return next;
                });
              }}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            />
          </label>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[2fr_1fr]">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Staff
            <select
              value={filters.attendantId}
              onChange={(e) => setFilters((prev) => ({ ...prev, attendantId: e.target.value }))}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100"
            >
              <option value="">All staff</option>
              {staffList.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <button
              type="button"
              onClick={() => applyFilters()}
              className="flex-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              Reset
            </button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleManualRefresh}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/5"
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/5 disabled:opacity-50"
            disabled={exporting}
          >
            {exporting ? "Preparing CSV..." : "Export CSV"}
          </button>
        </div>
      </section>
      <section className="overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/40 p-2 shadow-inner shadow-black/40">
        <table className="min-w-full text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2 text-left">Order</th>
              <th className="px-3 py-2 text-left">Doc</th>
              <th className="px-3 py-2 text-left">Customer</th>
              <th className="px-3 py-2 text-left">Staff</th>
              <th className="px-3 py-2 text-left">Total</th>
              <th className="px-3 py-2 text-left">Payment</th>
              <th className="px-3 py-2 text-left">Status</th>
              <th className="px-3 py-2 text-left">Created</th>
              <th className="px-3 py-2 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-3 py-6 text-center text-slate-400">
                  {loading ? "Loading receipts..." : "No receipts match this filter."}
                </td>
              </tr>
            )}
            {rows.map((row) => {
              const isSelected = row.id === selected?.id && drawerOpen;
              return (
                <tr
                  key={row.id}
                  className={`cursor-pointer transition hover:bg-white/5 ${isSelected ? "bg-white/5" : ""}`}
                  onClick={() => handleRowClick(row)}
                >
                  <td className="px-3 py-3">
                    <div className="font-semibold text-white">{row.orderRef || "-"}</div>
                    <div className="text-xs text-slate-400">#{row.id.slice(0, 6)}</div>
                  </td>
                  <td className="px-3 py-3">
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-xs uppercase text-slate-100">
                      {row.docType}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <div className="text-white">{row.customerName || "Walk-in"}</div>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{row.attendantName || "-"}</td>
                  <td className="px-3 py-3 font-semibold text-emerald-300">{formatCurrency(row.total)}</td>
                  <td className="px-3 py-3 text-slate-300">{row.paymentMethod ?? "Unknown"}</td>
                  <td className="px-3 py-3">
                    <span className="text-xs uppercase tracking-wide text-slate-400">{row.status || "-"}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-300">{formatDateTime(row.createdAt)}</td>
                  <td className="px-3 py-3 text-right">
                      <RowActions
                        onEdit={() => {
                        // load detail then open edit modal when ready
                        setPendingEditId(row.id);
                        handleRowClick(row);
                      }}
                      onEditItems={() => {
                        setPendingEditId(row.id);
                        handleRowClick(row);
                      }}
                      onDelete={() => void deleteReceiptById(row.id)}
                      onDownload={() => window.open(`/receipts/${row.id}`, "_blank")}
                      onSendWhatsapp={() => void sendReceiptById(row.id, "whatsapp")}
                      onPrint={() => window.open(`/receipts/${row.id}`, "_blank")}
                        disabled={loading || (row.source ?? "pos") !== "pos"}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {error && <p className="px-3 py-2 text-sm text-rose-300">{error}</p>}
        {rows.length > 0 && (
          <div className="flex items-center justify-between border-t border-white/5 px-3 py-3 text-sm text-slate-300">
            <span>
              Page {page}, showing {rows.length} receipts
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => gotoPage(page - 1)}
                disabled={page === 1 || loading}
                className="rounded-xl border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 disabled:opacity-40"
              >
                Prev
              </button>
              <button
                type="button"
                onClick={() => gotoPage(page + 1)}
                disabled={!hasMore || loading}
                className="rounded-xl border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </section>
      {drawerOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-black/60" onClick={closeDrawer} />
          <aside className="fixed inset-y-0 right-0 z-50 w-full max-w-xl transform bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/60 transition-transform">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Receipt detail</p>
                <h2 className="text-xl font-semibold text-white">{selected?.orderRef || selected?.id}</h2>
              </div>
              <button
                type="button"
                onClick={closeDrawer}
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/10"
              >
                Close
              </button>
            </div>
            {detailLoading && <p className="mt-6 text-sm text-slate-400">Loading details...</p>}
            {!detailLoading && detail?.receipt && (
              <div className="mt-6 space-y-4">
                <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 text-sm">
                  <div className="flex flex-wrap gap-4 text-slate-300">
                    <div>
                      <p className="text-xs text-slate-500">Customer</p>
                      <p className="text-base text-white">
                        {detail.receipt.order?.customerName || detail.receipt.data?.customerName || "Walk-in"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Served by</p>
                      <p>{detail.receipt.order?.attendant?.name || selected?.attendantName || "-"}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Created</p>
                      <p>{formatDateTime(detail.receipt.generatedAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Doc type</p>
                      <p>{detail.receipt.docType}</p>
                    </div>
                  </div>
                  <div className="mt-4 rounded-xl border border-white/5 bg-slate-950/40 p-3 text-sm">
                    <div className="flex flex-wrap gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Subtotal</p>
                        <p className="font-semibold text-white">{formatCurrency(detail.receipt.totals?.subtotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Tax</p>
                        <p className="font-semibold text-white">{formatCurrency(detail.receipt.totals?.tax)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Discount</p>
                        <p className="font-semibold text-white">{formatCurrency(detail.receipt.discount)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Total</p>
                        <p className="text-lg font-semibold text-emerald-300">
                          {formatCurrency(detail.receipt.totals?.total)}
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4 text-sm text-slate-300">
                      <div>
                        <p className="text-xs text-slate-500">Buying total</p>
                        <p className="font-semibold text-white">{formatCurrency(supportBuyingTotal)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Profit</p>
                        <p className={`text-lg font-semibold ${profitColor}`}>
                          {hasCompleteCosts ? formatCurrency(profitAmount) : "Awaiting cost data"}
                        </p>
                      </div>
                    </div>
                    {detail.receipt.docType === "LAYAWAY" && (
                      <p className="mt-2 text-xs text-amber-300">
                        Balance: {formatCurrency(detail.receipt.totals?.balance ?? detail.receipt.order?.layawayPlan?.balance)}
                      </p>
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border border-white/5 bg-slate-900/40 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-400">Items</p>
                  <div className="mt-3 space-y-2">
                    {itemsWithCost.map((item) => {
                      const quantity = Math.max(1, Number(item.quantity ?? 1));
                      const sellingPrice = Number(item.sellingPrice ?? 0);
                      const lineTotal = sellingPrice * quantity;
                      const unitCost = item.buyingPrice;
                      const totalCost = unitCost !== null ? unitCost * quantity : null;
                      const lineProfit = totalCost !== null ? lineTotal - totalCost : null;
                      const profitLabelClass =
                        lineProfit === null
                          ? "text-slate-400"
                          : lineProfit >= 0
                            ? "text-emerald-300"
                            : "text-rose-300";

                      return (
                        <div
                          key={item.id}
                          className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm"
                        >
                          <div>
                            <p className="font-semibold text-white">{item.displayName || "Item"}</p>
                            <p className="text-xs text-slate-400 flex flex-wrap gap-2">
                              <span>Qty {quantity.toLocaleString()}</span>
                              <span>Selling {formatCurrency(sellingPrice)}</span>
                              <span>Cost {unitCost !== null ? formatCurrency(unitCost) : "N/A"}</span>
                              {lineProfit !== null ? (
                                <span className={profitLabelClass}>Profit {formatCurrency(lineProfit)}</span>
                              ) : (
                                <span className="text-slate-400">Profit N/A</span>
                              )}
                              {item.serial && <span>SN {item.serial}</span>}
                            </p>
                          </div>
                          <p className="font-semibold text-emerald-300">{formatCurrency(lineTotal)}</p>
                        </div>
                      );
                    })}
                    {itemsWithCost.length === 0 && (
                      <p className="text-sm text-slate-400">No items recorded.</p>
                    )}
                  </div>
                </div>

                {hasSupportItems && (
                  <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-4 text-sm">
                    <p className="text-xs uppercase tracking-wide text-slate-400">Support buying costs</p>
                    <div className="mt-3 space-y-2">
                      {detail.supportItems?.map((support) => (
                        <div
                          key={support.id}
                          className="flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2"
                        >
                          <div>
                            <p className="font-semibold text-white">{support.productName || "Support entry"}</p>
                            <p className="text-xs text-slate-500">Captured via support ledger</p>
                          </div>
                          <p className="text-sm font-semibold text-emerald-300">
                            {support.buyingPrice !== null ? formatCurrency(support.buyingPrice) : "-"}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap gap-2">
                  <Link
                    href={`/receipts/${detail.receipt.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/10"
                  >
                    Open printable
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleSend("email")}
                    disabled={sendingChannel === "email"}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:opacity-50"
                  >
                    {sendingChannel === "email" ? "Sending..." : "Send email"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSend("whatsapp")}
                    disabled={sendingChannel === "whatsapp"}
                    className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:opacity-50"
                  >
                    {sendingChannel === "whatsapp" ? "Sending..." : "Send WhatsApp"}
                  </button>
                  {allowEdit && (
                    <button
                      type="button"
                      onClick={openEditModal}
                      className="rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95"
                    >
                      Edit receipt
                    </button>
                  )}
                  {allowEdit && (
                    <button
                      type="button"
                      onClick={handleDeleteReceipt}
                      disabled={deleting}
                      className="rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60"
                    >
                      {deleting ? "Deleting..." : "Delete receipt"}
                    </button>
                  )}
                </div>

                {detail.receipt.notes && (
                  <div className="rounded-2xl border border-white/5 bg-slate-900/60 p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-xs uppercase tracking-wide text-slate-400">Notes</p>
                      {/* Toggle lives here to let admins preview formatting */}
                      <div className="no-print">
                        {/* dynamic import not necessary; component is client side */}
                        {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                        {/* @ts-ignore-next-line */}
                        <RichFormattingToggle />
                      </div>
                    </div>
                    {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                    {/* @ts-ignore-next-line */}
                    <MarkdownRendererClient mdText={detail.receipt.notes} />
                  </div>
                )}
              </div>
            )}
          </aside>
        </>
      )}

  <EditModal
    open={editState.open}
    draft={editState.draft}
    staffList={staffList}
    saving={editState.saving}
    onClose={() => setEditState({ open: false, draft: null, saving: false })}
    onDraftChange={updateDraft}
    onSave={handleSaveEdit}
  />
</div>
);
}

type PaymentMethodCardProps = {
  totals: PaymentTotals | null;
  partialTotals: Record<"MPESA" | "CASH", number>;
  activeMethod: "" | "MPESA" | "CASH";
  loading: boolean;
  onSelect: (method: "" | "MPESA" | "CASH") => void;
};

function PaymentMethodFilterCard({
  totals,
  partialTotals,
  activeMethod,
  loading,
  onSelect,
}: PaymentMethodCardProps) {
  const methods: Array<{ key: "MPESA" | "CASH"; label: string }> = [
    { key: "MPESA", label: "MPESA" },
    { key: "CASH", label: "Cash" },
  ];
  return (
    <section className="isolate rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-black/30">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Payments</p>
          <h2 className="text-lg font-semibold text-white">Filter by method</h2>
          <p className="text-sm text-slate-400">Tap a method to lock the list to MPESA or cash receipts.</p>
        </div>
        <button
          type="button"
          onClick={() => onSelect("")}
          className="rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 hover:border-emerald-500 hover:text-white"
        >
          Show all
        </button>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {methods.map((method) => {
          const isActive = activeMethod === method.key;
          const pool = method.key === "MPESA" ? totals?.mpesa : totals?.cash;
          const amountLabel = loading ? "Loading..." : formatCurrency(pool?.totalSales ?? 0);
          const countLabel = loading ? "" : `${pool?.count ?? 0} receipts`;
          const partialLabel = formatCurrency(partialTotals[method.key]);
          return (
            <button
              key={method.key}
              type="button"
              onClick={() => onSelect(method.key)}
              className={`flex flex-col items-start justify-between gap-2 rounded-2xl border px-4 py-3 text-left transition ${
                isActive
                  ? "border-emerald-500 bg-emerald-500/10 text-white shadow-[0_0_25px_rgba(16,185,129,0.25)]"
                  : "border-white/10 bg-slate-950/70 text-slate-100 hover:border-emerald-500 hover:bg-slate-900/70"
              }`}
              aria-pressed={isActive}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-xs uppercase tracking-[0.3em] text-slate-400">{method.label}</span>
                <span className="text-[11px] text-slate-400">{countLabel}</span>
              </div>
              <p className="text-2xl font-semibold">{amountLabel}</p>
              <p className="text-xs text-slate-400">
                Partial sum: <span className="font-semibold text-slate-100">{partialLabel}</span>
              </p>
            </button>
          );
        })}
      </div>
    </section>
  );
}
type EditModalProps = {
  open: boolean;
  draft: EditDraft | null;
  staffList: StaffOption[];
  saving: boolean;
  onClose: () => void;
  onDraftChange: (draft: EditDraft) => void;
  onSave: () => void;
};

function EditModal({ open, draft, staffList, saving, onClose, onDraftChange, onSave }: EditModalProps) {
  const totals = useMemo(() => {
    if (!draft) return { subtotal: 0, tax: 0, total: 0 };
    const subtotal = draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
    const tax = draft.showTax ? subtotal * (draft.taxRate / 100) : 0;
    const total = subtotal + tax - draft.discount;
    return { subtotal, tax, total };
  }, [draft]);

  if (!open || !draft) return null;

  const updateItem = (id: string, patch: Partial<EditItem>) => {
    const nextItems = draft.items.map((item) => (item.id === id ? { ...item, ...patch } : item));
    onDraftChange({ ...draft, items: nextItems });
  };

  const addItem = () => {
    onDraftChange({
      ...draft,
      items: [
        ...draft.items,
        { id: randomId(), title: "", quantity: 1, unitPrice: 0, serial: null, warranty: null, buyingPrice: 0 },
      ],
    });
  };

  const removeItem = (id: string) => {
    const remaining = draft.items.filter((item) => item.id !== id);
    onDraftChange({
      ...draft,
      items: remaining.length
        ? remaining
        : [
            {
              id: randomId(),
              title: "",
              quantity: 1,
              unitPrice: 0,
              serial: null,
              warranty: null,
              buyingPrice: 0,
            },
          ],
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
      <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/70">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Edit receipt</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-200 hover:bg-white/10"
          >
            Close
          </button>
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Staff
            <select
              value={draft.attendantId ?? ""}
              onChange={(e) => onDraftChange({ ...draft, attendantId: e.target.value || null })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
            >
              <option value="">Keep existing</option>
              {staffList.map((att) => (
                <option key={att.id} value={att.id}>
                  {att.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Document type
            <select
              value={draft.docType}
              onChange={(e) => onDraftChange({ ...draft, docType: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
            >
              {DOC_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Customer name
            <input
              value={draft.customerName}
              onChange={(e) => onDraftChange({ ...draft, customerName: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Customer phone
            <input
              value={draft.customerPhone || ""}
              onChange={(e) => onDraftChange({ ...draft, customerPhone: e.target.value })}
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
            />
          </label>
        </div>

        <section className="mt-4 space-y-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4">
          <div className="flex flex-wrap gap-4 text-xs text-slate-300">
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showTax}
                onChange={(e) => onDraftChange({ ...draft, showTax: e.target.checked })}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              Show tax (rate {draft.taxRate}%)
            </label>
            {draft.showTax && (
              <input
                type="number"
                min={0}
                value={draft.taxRate}
                onChange={(e) => onDraftChange({ ...draft, taxRate: Number(e.target.value || 0) })}
                className="w-24 rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-1 text-sm text-white"
              />
            )}
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.showDiscount}
                onChange={(e) => onDraftChange({ ...draft, showDiscount: e.target.checked })}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              Show discount
            </label>
            <input
              type="number"
              min={0}
              value={draft.discount}
              onChange={(e) => onDraftChange({ ...draft, discount: Number(e.target.value || 0) })}
              className="w-32 rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-1 text-sm text-white"
              placeholder="Discount"
            />
            <label className="inline-flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.paymentDetailsShown}
                onChange={(e) => onDraftChange({ ...draft, paymentDetailsShown: e.target.checked })}
                className="h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500"
              />
              Show payment instructions
            </label>
          </div>
        </section>

        <section className="mt-4 space-y-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">Items</h4>
            <button
              type="button"
              onClick={addItem}
              className="rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/10"
            >
              + Add item
            </button>
          </div>
          <div className="space-y-3">
            {draft.items.map((item) => (
              <div key={item.id} className="grid gap-2 rounded-2xl border border-white/5 bg-slate-950/60 p-3 md:grid-cols-12">
                <input
                  value={item.title}
                  onChange={(e) => updateItem(item.id, { title: e.target.value })}
                  placeholder="Item description"
                  className="md:col-span-4 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
                />
                <input
                  type="number"
                  min={1}
                  value={item.quantity}
                  onChange={(e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value || 1)) })}
                  className="md:col-span-1 rounded-xl border border-slate-800 bg-slate-900/70 px-2 py-2 text-sm text-white"
                />
                <input
                  type="number"
                  min={0}
                  value={item.unitPrice}
                  onChange={(e) => updateItem(item.id, { unitPrice: Math.max(0, Number(e.target.value || 0)) })}
                  className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
                  placeholder="Unit price"
                />
                <input
                  type="number"
                  min={0}
                  value={item.buyingPrice}
                  onChange={(e) =>
                    updateItem(item.id, { buyingPrice: Math.max(0, Number(e.target.value || 0)) })
                  }
                  className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
                  placeholder="Cost price"
                />
                <input
                  value={item.serial || ""}
                  onChange={(e) => updateItem(item.id, { serial: e.target.value })}
                  placeholder="Serial"
                  className="md:col-span-1 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
                />
                <select
                  value={item.warranty || ""}
                  onChange={(e) => updateItem(item.id, { warranty: e.target.value || null })}
                  className="md:col-span-1 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white"
                >
                  {WARRANTY_OPTIONS.map((option) => (
                    <option key={option || "none"} value={option}>
                      {option || "No warranty"}
                    </option>
                  ))}
                </select>
                <div className="md:col-span-1 flex flex-col items-end justify-between gap-2">
                  <p className="text-xs text-slate-500">Line total</p>
                  <p className="text-sm font-semibold text-emerald-300">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </p>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    className="text-xs text-rose-300 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Notes
            <textarea
              value={draft.notes || ""}
              onChange={(e) => onDraftChange({ ...draft, notes: e.target.value })}
              className="mt-1 min-h-[60px] w-full rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-sm text-white"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Warranty text
            <textarea
              value={draft.warrantyText || ""}
              onChange={(e) => onDraftChange({ ...draft, warrantyText: e.target.value })}
              className="mt-1 min-h-[60px] w-full rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-sm text-white"
            />
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-2 rounded-2xl border border-white/5 bg-slate-900/60 p-4 text-sm text-slate-200 md:flex-row md:items-center md:justify-between">
          <div>
            <p>Subtotal: {formatCurrency(totals.subtotal)}</p>
            <p>Tax: {formatCurrency(totals.tax)}</p>
            <p>Discount: {formatCurrency(draft.discount)}</p>
            <p className="text-lg font-semibold text-white">Total: {formatCurrency(totals.total)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving}
              className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
            >
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
