"use strict";
"use client";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = ReceiptsAdminClient;
const jsx_runtime_1 = require("react/jsx-runtime");
const link_1 = __importDefault(require("next/link"));
const react_1 = require("react");
const ReceiptsSummary_1 = __importDefault(require("./list/ReceiptsSummary"));
const RowActions_1 = __importDefault(require("./list/RowActions"));
const MarkdownRendererClient_1 = __importStar(require("@/components/MarkdownRendererClient"));
const toast_1 = require("@/lib/ui/toast");
const DOC_TYPES = ["RECEIPT", "INVOICE", "QUOTATION", "LAYAWAY"];
const WARRANTY_OPTIONS = ["", "3 Months", "6 Months", "1 Year", "2 Years", "3 Years", "5 Years"];
const PAGE_SIZE = 50;
const randomId = () => Math.random().toString(36).slice(2, 9);
const computeSummary = (rows) => {
    const totalValue = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
    const totalCount = rows.length;
    const averageValue = totalCount ? totalValue / totalCount : 0;
    const head = rows[0];
    const lastReceipt = head
        ? { id: head.id, createdAt: head.createdAt, customerName: head.customerName }
        : undefined;
    return { totalCount, totalValue, averageValue, lastReceipt };
};
const formatCurrency = (value) => {
    const amount = Number(value ?? 0);
    if (!Number.isFinite(amount))
        return "KES 0";
    return `KES ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
};
const formatDateTime = (value) => {
    if (!value)
        return "-";
    return new Date(value).toLocaleString();
};
const formatDateInput = (date) => date.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
const formatRangeLabel = (value) => {
    if (!value)
        return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime()))
        return value;
    return parsed.toLocaleDateString("en-KE", { day: "numeric", month: "short" });
};
const makeDefaultFilters = () => {
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
const buildDateParam = (value, endOfDay) => {
    // Expect `value` in `YYYY-MM-DD` format (produced by `formatDateInput`).
    // Send an explicit Nairobi-local ISO timestamp so server-side parsing
    // is consistent regardless of the browser's timezone. The admin
    // summary endpoint also supports raw YYYY-MM-DD, but sending an
    // explicit `+03:00` offset keeps listing and summary behavior in sync.
    if (!value)
        return undefined;
    const match = /^\d{4}-\d{2}-\d{2}$/.test(value);
    if (!match)
        return undefined;
    return endOfDay ? `${value}T23:59:59.999+03:00` : `${value}T00:00:00+03:00`;
};
const csvEscape = (value) => {
    if (value === null || value === undefined)
        return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
};
const badgeBaseClass = "inline-flex items-center justify-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.3em]";
const DOC_BADGE_VARIANTS = {
    RECEIPT: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    INVOICE: "border border-amber-500/30 bg-amber-500/10 text-amber-200",
    QUOTATION: "border border-sky-500/30 bg-sky-500/10 text-sky-200",
    LAYAWAY: "border border-violet-500/30 bg-violet-500/10 text-violet-200",
};
const STATUS_BADGE_VARIANTS = {
    COMPLETED: "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
    PENDING: "border border-amber-500/40 bg-amber-500/10 text-amber-200",
    PROCESSING: "border border-sky-500/30 bg-sky-500/10 text-sky-200",
    FAILED: "border border-rose-500/30 bg-rose-500/10 text-rose-200",
    CANCELED: "border border-rose-500/30 bg-rose-500/10 text-rose-200",
    REVERSED: "border border-rose-500/30 bg-rose-500/10 text-rose-200",
};
const PAYMENT_BADGE_VARIANTS = {
    MPESA: "border border-emerald-500/20 bg-emerald-500/10 text-emerald-200",
    CASH: "border border-white/15 bg-white/5 text-slate-100",
};
const formatBadgeLabel = (value) => value
    ? value
        .trim()
        .replace(/_/g, " ")
        .toLowerCase()
        .replace(/\b\w/g, (match) => match.toUpperCase())
    : "-";
const getDocBadgeClass = (docType) => {
    if (!docType)
        return "border border-white/10 bg-white/5 text-white";
    return DOC_BADGE_VARIANTS[docType.toUpperCase()] ?? "border border-white/10 bg-white/5 text-white";
};
const getStatusBadgeClass = (status) => {
    if (!status)
        return "border border-white/10 bg-white/5 text-white";
    return STATUS_BADGE_VARIANTS[status.toUpperCase().trim()] ?? "border border-white/10 bg-white/5 text-white";
};
const getPaymentBadgeClass = (method) => {
    if (!method)
        return "border border-white/10 bg-white/5 text-white";
    return PAYMENT_BADGE_VARIANTS[method.toUpperCase()] ?? "border border-white/10 bg-white/5 text-white";
};
const buildDraftFromDetail = (detail) => {
    const receipt = detail.receipt;
    const order = receipt?.order ?? {};
    const dataItems = Array.isArray(receipt?.data?.items) ? receipt.data.items : [];
    const orderItems = Array.isArray(order?.items) ? order.items : [];
    const sourceItems = dataItems.length ? dataItems : orderItems;
    const supportCostMap = new Map();
    (detail.supportItems ?? []).forEach((item) => {
        const key = String(item.productName ?? "").trim().toLowerCase();
        if (key) {
            supportCostMap.set(key, Number(item.buyingPrice ?? 0));
        }
    });
    const items = sourceItems.length > 0
        ? sourceItems.map((it) => ({
            id: it.id || randomId(),
            title: it.title || it.productName || it.name || "",
            quantity: Number(it.quantity || 1),
            unitPrice: Number(it.unitPrice ?? it.sellingPrice ?? it.price ?? 0),
            serial: it.serial ?? null,
            warranty: it.warranty ?? null,
            buyingPrice: Number(it.buyingPrice ?? supportCostMap.get((it.title || it.productName || it.name || "").trim().toLowerCase()) ?? 0),
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
function ReceiptsAdminClient({ initial = [], allowEdit, onSummaryChange, refreshSignal = 0, scope, }) {
    const [rows, setRows] = (0, react_1.useState)(initial);
    const [loading, setLoading] = (0, react_1.useState)(false);
    const [error, setError] = (0, react_1.useState)(null);
    const [summaryTotals, setSummaryTotals] = (0, react_1.useState)(null);
    const [summaryLoading, setSummaryLoading] = (0, react_1.useState)(false);
    const [sseEnabled, setSseEnabled] = (0, react_1.useState)(false);
    // Start with SSE turned off by default to avoid unexpected snapshot reloads
    // flipping the UI; users can opt-in via the toggle in the UI.
    const [sseOn, setSseOn] = (0, react_1.useState)(false); // user preference: use SSE when supported
    const [sseStatus, setSseStatus] = (0, react_1.useState)("fallback");
    const sseRetryRef = (0, react_1.useRef)(0);
    const sseEsRef = (0, react_1.useRef)(null);
    const [quickRange, setQuickRange] = (0, react_1.useState)("today");
    const [filters, setFilters] = (0, react_1.useState)(() => makeDefaultFilters());
    const [appliedFilters, setAppliedFilters] = (0, react_1.useState)(() => makeDefaultFilters());
    const [staffList, setStaffList] = (0, react_1.useState)([]);
    const [page, setPage] = (0, react_1.useState)(1);
    const [hasMore, setHasMore] = (0, react_1.useState)(false);
    const [selected, setSelected] = (0, react_1.useState)(null);
    const [drawerOpen, setDrawerOpen] = (0, react_1.useState)(false);
    const [triggerSummaryLoading, setTriggerSummaryLoading] = (0, react_1.useState)(false);
    const [triggerSummaryResult, setTriggerSummaryResult] = (0, react_1.useState)(null);
    const [detail, setDetail] = (0, react_1.useState)(null);
    const [detailLoading, setDetailLoading] = (0, react_1.useState)(false);
    const [sendingChannel, setSendingChannel] = (0, react_1.useState)(null);
    const [pendingEditId, setPendingEditId] = (0, react_1.useState)(null);
    const [editState, setEditState] = (0, react_1.useState)({
        open: false,
        draft: null,
        saving: false,
    });
    const [deleting, setDeleting] = (0, react_1.useState)(false);
    const [exporting, setExporting] = (0, react_1.useState)(false);
    const firstLoadRef = (0, react_1.useRef)(true);
    const STORAGE_KEYS = {
        attendantId: "receipts.attendantId.v1",
        quickRange: "receipts.quickRange.v1",
        rangeStart: "receipts.rangeStart.v1",
        rangeEnd: "receipts.rangeEnd.v1",
        paymentMethod: "receipts.paymentMethod.v1",
    };
    const scopeMode = scope ?? "mine";
    // load persisted filters (attendant + quick range) on mount
    (0, react_1.useEffect)(() => {
        try {
            const savedAttendant = window.localStorage.getItem(STORAGE_KEYS.attendantId);
            const savedQuick = window.localStorage.getItem(STORAGE_KEYS.quickRange);
            const savedStart = window.localStorage.getItem(STORAGE_KEYS.rangeStart);
            const savedEnd = window.localStorage.getItem(STORAGE_KEYS.rangeEnd);
            const savedPaymentMethod = window.localStorage.getItem(STORAGE_KEYS.paymentMethod);
            setFilters((prev) => {
                let next = { ...prev };
                if (savedAttendant)
                    next.attendantId = savedAttendant;
                if (savedStart)
                    next.start = savedStart;
                if (savedEnd)
                    next.end = savedEnd;
                if (savedPaymentMethod)
                    next.paymentMethod = savedPaymentMethod;
                return next;
            });
            setAppliedFilters((prev) => {
                let next = { ...prev };
                if (savedAttendant)
                    next.attendantId = savedAttendant;
                if (savedStart)
                    next.start = savedStart;
                if (savedEnd)
                    next.end = savedEnd;
                if (savedPaymentMethod)
                    next.paymentMethod = savedPaymentMethod;
                return next;
            });
            if (savedQuick === "today" ||
                savedQuick === "yesterday" ||
                savedQuick === "this-week" ||
                savedQuick === "custom") {
                setQuickRange(savedQuick);
            }
        }
        catch (err) {
            // ignore storage errors
        }
    }, []);
    (0, react_1.useEffect)(() => {
        setRows(initial);
        setHasMore(initial.length === PAGE_SIZE);
        setPage(1);
    }, [initial]);
    (0, react_1.useEffect)(() => {
        onSummaryChange?.(computeSummary(rows));
    }, [rows, onSummaryChange]);
    (0, react_1.useEffect)(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await fetch("/api/receipts/staff", { cache: "no-store" });
                const data = await res.json().catch(() => ({}));
                if (!res.ok)
                    throw new Error(data?.error || "Failed to load staff");
                if (cancelled)
                    return;
                const options = (Array.isArray(data?.users) ? data.users : Array.isArray(data) ? data : [])
                    .filter((u) => u?.id)
                    .map((u) => ({ id: u.id, name: u.name || u.email || u.id }));
                setStaffList(options);
            }
            catch (err) {
                console.warn("[receipts] failed to load staff", err);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);
    const loadRows = (0, react_1.useCallback)(async (targetPage, opts) => {
        setError(null);
        if (!opts?.silent)
            setLoading(true);
        try {
            const params = new URLSearchParams();
            params.set("page", String(targetPage));
            params.set("size", String(PAGE_SIZE));
            params.set("includeItems", "false");
            if (appliedFilters.q.trim())
                params.set("q", appliedFilters.q.trim());
            if (appliedFilters.docType)
                params.set("docType", appliedFilters.docType);
            if (appliedFilters.attendantId)
                params.set("attendantId", appliedFilters.attendantId);
            if (appliedFilters.paymentMethod)
                params.set("paymentMethod", appliedFilters.paymentMethod);
            const startParam = buildDateParam(appliedFilters.start, false);
            const endParam = buildDateParam(appliedFilters.end, true);
            if (startParam)
                params.set("start", startParam);
            if (endParam)
                params.set("end", endParam);
            params.set("scope", scopeMode);
            const res = await fetch(`/api/receipts?${params.toString()}`, { cache: "no-store" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data?.error || "Failed to load receipts");
            const nextRows = Array.isArray(data?.receipts) ? data.receipts : [];
            setRows(nextRows);
            setHasMore(nextRows.length === PAGE_SIZE);
            setPage(targetPage);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to load receipts";
            setError(message);
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            if (!opts?.silent)
                setLoading(false);
        }
    }, [appliedFilters, scopeMode]);
    (0, react_1.useEffect)(() => {
        const silent = firstLoadRef.current;
        firstLoadRef.current = false;
        void loadRows(1, { silent });
    }, [appliedFilters, loadRows]);
    (0, react_1.useEffect)(() => {
        if (!firstLoadRef.current) {
            void loadRows(1);
        }
    }, [refreshSignal, loadRows]);
    // Fetch summary (extracted so it can be polled)
    const fetchSummary = (0, react_1.useCallback)(async (opts) => {
        setSummaryLoading(true);
        try {
            const params = new URLSearchParams();
            const startParam = buildDateParam(appliedFilters.start, false);
            const endParam = buildDateParam(appliedFilters.end, true);
            if (startParam)
                params.set("start", startParam);
            if (endParam)
                params.set("end", endParam);
            if (appliedFilters.paymentMethod)
                params.set("paymentMethod", appliedFilters.paymentMethod);
            if (appliedFilters.attendantId) {
                params.set("attendantId", appliedFilters.attendantId);
            }
            if (appliedFilters.docType) {
                params.set("docType", appliedFilters.docType);
            }
            if (appliedFilters.q.trim()) {
                params.set("q", appliedFilters.q.trim());
            }
            params.set("scope", scopeMode);
            const res = await fetch(`/api/admin/receipts/summary?${params.toString()}`, {
                cache: "no-store",
                signal: opts?.signal,
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data?.error || "Failed to load summary");
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
                paymentTotals: data?.paymentTotals ??
                    {
                        mpesa: { totalSales: 0, count: 0 },
                        cash: { totalSales: 0, count: 0 },
                    },
            });
        }
        catch (err) {
            console.warn("[receipts] summary error", err);
            setSummaryTotals(null);
        }
        finally {
            setSummaryLoading(false);
        }
    }, [appliedFilters, scopeMode]);
    const handleTriggerSummary = (0, react_1.useCallback)(async () => {
        if (triggerSummaryLoading)
            return;
        setTriggerSummaryLoading(true);
        setTriggerSummaryResult(null);
        try {
            const res = await fetch("/api/admin/daily-summary/trigger", { cache: "no-store" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data?.error || "Failed to trigger summary");
            setTriggerSummaryResult(`${data.slot2} · ${data.slot3} · ${data.slot4}`);
            (0, toast_1.showToast)("Admin summary triggered", "success");
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to trigger summary";
            setTriggerSummaryResult(message);
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setTriggerSummaryLoading(false);
        }
    }, [triggerSummaryLoading]);
    // initial fetch and when filters change
    (0, react_1.useEffect)(() => {
        const controller = new AbortController();
        void fetchSummary({ signal: controller.signal });
        return () => controller.abort();
    }, [fetchSummary]);
    // detect EventSource support and prefer SSE when available
    (0, react_1.useEffect)(() => {
        if (typeof window !== "undefined" && "EventSource" in window) {
            setSseEnabled(true);
        }
    }, []);
    // Poll the summary every 30 seconds when SSE is not enabled
    (0, react_1.useEffect)(() => {
        if (sseEnabled && sseOn)
            return; // SSE will handle updates
        // polling active when SSE not supported or user opted out
        const interval = setInterval(() => void fetchSummary(), 30000);
        // run an immediate fetch to ensure quick update when switching modes
        void fetchSummary();
        return () => clearInterval(interval);
    }, [fetchSummary, sseEnabled, sseOn]);
    // If SSE is enabled and user opted-in, open an EventSource with reconnect/backoff
    (0, react_1.useEffect)(() => {
        if (!sseEnabled || !sseOn) {
            // ensure any existing ES is closed
            try {
                sseEsRef.current?.close();
            }
            catch { }
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
            if (startParam)
                params.set("start", startParam);
            if (endParam)
                params.set("end", endParam);
            if (appliedFilters.attendantId)
                params.set("attendantId", appliedFilters.attendantId);
            if (appliedFilters.paymentMethod)
                params.set("paymentMethod", appliedFilters.paymentMethod);
            if (appliedFilters.docType)
                params.set("docType", appliedFilters.docType);
            if (appliedFilters.q.trim())
                params.set("q", appliedFilters.q.trim());
            params.set("scope", scopeMode);
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
                            paymentTotals: data?.paymentTotals ??
                                {
                                    mpesa: { totalSales: 0, count: 0 },
                                    cash: { totalSales: 0, count: 0 },
                                },
                        });
                    }
                    catch (err) {
                        console.warn("[receipts] failed to parse SSE data", err);
                    }
                };
                es.onerror = () => {
                    // close and attempt reconnect with backoff
                    try {
                        es.close();
                    }
                    catch { }
                    if (aborted)
                        return;
                    sseRetryRef.current = (sseRetryRef.current ?? 0) + 1;
                    const attempt = sseRetryRef.current;
                    const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 6)));
                    setSseStatus("reconnecting");
                    setTimeout(() => {
                        if (!aborted)
                            startEventSource();
                    }, delay);
                };
            }
            catch (err) {
                console.warn("[receipts] failed to create EventSource", err);
                // schedule reconnection
                sseRetryRef.current = (sseRetryRef.current ?? 0) + 1;
                const attempt = sseRetryRef.current;
                const delay = Math.min(30000, 1000 * Math.pow(2, Math.min(attempt, 6)));
                setSseStatus("reconnecting");
                setTimeout(() => {
                    if (!aborted)
                        startEventSource();
                }, delay);
            }
        };
        startEventSource();
        return () => {
            aborted = true;
            try {
                sseEsRef.current?.close();
            }
            catch { }
            sseEsRef.current = null;
        };
    }, [sseEnabled, sseOn, appliedFilters, scopeMode]);
    const persistFilterValues = (nextFilters) => {
        try {
            window.localStorage.setItem(STORAGE_KEYS.attendantId, nextFilters.attendantId || "");
            window.localStorage.setItem(STORAGE_KEYS.rangeStart, nextFilters.start || "");
            window.localStorage.setItem(STORAGE_KEYS.rangeEnd, nextFilters.end || "");
            window.localStorage.setItem(STORAGE_KEYS.paymentMethod, nextFilters.paymentMethod || "");
            window.localStorage.setItem(STORAGE_KEYS.quickRange, quickRange);
        }
        catch (err) {
            // ignore storage errors
        }
    };
    const applyFilters = (patch) => {
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
        }
        catch (err) {
            // ignore
        }
    };
    const applyQuickRange = (key) => {
        const now = new Date();
        const bounds = key === "today"
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
        }
        catch (err) {
            // ignore
        }
    };
    const gotoPage = (next) => {
        if (next < 1)
            return;
        void loadRows(next);
    };
    const handleManualRefresh = () => {
        void loadRows(page);
    };
    const handleRowClick = (row) => {
        if ((row.source ?? "pos") !== "pos") {
            (0, toast_1.showToast)("Receipt detail view is only available for POS receipts", "info");
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
                if (!res.ok)
                    throw new Error(payload?.error || "Failed to load receipt");
                setDetail(payload);
            }
            catch (err) {
                const message = err instanceof Error ? err.message : "Failed to load receipt";
                (0, toast_1.showToast)(message, "error");
            }
            finally {
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
    const handleSend = async (channel) => {
        if (!selected)
            return;
        if ((selected.source ?? "pos") !== "pos") {
            (0, toast_1.showToast)("Sending is only supported for POS receipts", "info");
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
            let data = {};
            try {
                data = await res.json();
            }
            catch (e) {
                console.error('[receipts][client] failed to parse response JSON', e);
            }
            console.log('[receipts][client] send response', { status: res.status, body: data });
            if (!res.ok)
                throw new Error(data?.error || "Failed to queue send");
            (0, toast_1.showToast)(`Queued ${channel === "email" ? "email" : "WhatsApp"} send`, "success");
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to queue send";
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setSendingChannel(null);
        }
    };
    const sendReceiptById = async (receiptId, channel) => {
        if (receiptId.startsWith("marketing-") || receiptId.startsWith("support-")) {
            (0, toast_1.showToast)("Sending is only supported for POS receipts", "info");
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
            if (!res.ok)
                throw new Error(data?.error || "Failed to queue send");
            (0, toast_1.showToast)(`Queued ${channel === "email" ? "email" : "WhatsApp"} send`, "success");
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to queue send";
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setSendingChannel(null);
        }
    };
    const handleDeleteReceipt = async () => {
        if (!selected || !allowEdit)
            return;
        if (!window.confirm("Delete this receipt and all related records from the system?"))
            return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/receipts/${selected.id}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data?.error || "Failed to delete receipt");
            (0, toast_1.showToast)("Receipt deleted", "success");
            closeDrawer();
            await loadRows(page);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delete receipt";
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setDeleting(false);
        }
    };
    const deleteReceiptById = async (receiptId) => {
        if (!allowEdit)
            return;
        if (receiptId.startsWith("marketing-") || receiptId.startsWith("support-")) {
            (0, toast_1.showToast)("Deletion is only supported for POS receipts", "info");
            return;
        }
        if (!window.confirm("Delete this receipt and all related records from the system?"))
            return;
        setDeleting(true);
        try {
            const res = await fetch(`/api/receipts/${receiptId}`, { method: "DELETE" });
            const data = await res.json().catch(() => ({}));
            if (!res.ok)
                throw new Error(data?.error || "Failed to delete receipt");
            (0, toast_1.showToast)("Receipt deleted", "success");
            // if we deleted the currently selected, close drawer
            if (selected?.id === receiptId)
                closeDrawer();
            await loadRows(page);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to delete receipt";
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setDeleting(false);
        }
    };
    (0, react_1.useEffect)(() => {
        if (pendingEditId && detail?.receipt?.id === pendingEditId) {
            setPendingEditId(null);
            openEditModal();
        }
    }, [pendingEditId, detail?.receipt?.id]);
    const openEditModal = () => {
        if (!allowEdit)
            return;
        if (!detail?.receipt) {
            (0, toast_1.showToast)("Load receipt details first", "warn");
            return;
        }
        const draft = buildDraftFromDetail(detail);
        setEditState({ open: true, draft, saving: false });
    };
    const updateDraft = (next) => {
        setEditState((prev) => ({ ...prev, draft: next }));
    };
    const handleSaveEdit = async () => {
        if (!detail?.receipt || !editState.draft)
            return;
        if (!editState.draft.items.length) {
            (0, toast_1.showToast)("Add at least one item before saving", "warn");
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
            if (!res.ok)
                throw new Error(data?.error || "Failed to update receipt");
            (0, toast_1.showToast)("Receipt updated", "success");
            setEditState({ open: false, draft: null, saving: false });
            setDetail((prev) => (prev ? { ...prev, receipt: data.receipt ?? prev.receipt } : prev));
            setSelected((prev) => prev && prev.id === detail.receipt.id
                ? {
                    ...prev,
                    total: data?.receipt?.totals?.total ?? prev.total,
                    customerName: data?.receipt?.order?.customerName ?? prev.customerName,
                }
                : prev);
            await loadRows(page, { silent: true });
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to update receipt";
            (0, toast_1.showToast)(message, "error");
            setEditState((prev) => ({ ...prev, saving: false }));
        }
    };
    const costSummary = (0, react_1.useMemo)(() => {
        const orderItems = detail?.receipt?.order?.items ?? [];
        if (!orderItems.length) {
            return { itemsWithCost: [], supportBuyingTotal: 0, hasCompleteCosts: false };
        }
        // If the server provided a supportReceiptSummary with a stored buyingTotal,
        // prefer that authoritative DB value for the admin UI to match the DB.
        const supportReceiptBuyingTotal = detail?.supportReceiptSummary && Number(detail.supportReceiptSummary.buyingTotal ?? 0) > 0
            ? Number(detail.supportReceiptSummary.buyingTotal ?? 0)
            : null;
        const supportQueue = (detail?.supportItems ?? []).map((item) => ({ ...item }));
        let allItemCostsKnown = true;
        const itemsWithCost = orderItems.map((item) => {
            const normalizedName = (item.product?.name ?? "").trim();
            const matchIndex = normalizedName.length > 0
                ? supportQueue.findIndex((support) => support.productName &&
                    support.productName.trim().toLowerCase() === normalizedName.toLowerCase())
                : -1;
            const matched = matchIndex >= 0 ? supportQueue.splice(matchIndex, 1)[0] : null;
            const displayName = item.product?.name ?? matched?.productName ?? "Item";
            const hasCost = matched?.buyingPrice !== null && Number(matched?.buyingPrice ?? 0) > 0;
            if (!hasCost)
                allItemCostsKnown = false;
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
            if (item.buyingPrice === null || Number(item.buyingPrice ?? 0) <= 0)
                return sum;
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
            (0, toast_1.showToast)("No rows to export", "warn");
            return;
        }
        setExporting(true);
        try {
            const header = ["Receipt ID", "Order Ref", "Doc Type", "Customer", "Staff", "Total", "Status", "Created At"];
            const csv = [header.join(",")];
            for (const row of rows) {
                csv.push([
                    csvEscape(row.id),
                    csvEscape(row.orderRef || ""),
                    csvEscape(row.docType),
                    csvEscape(row.customerName || ""),
                    csvEscape(row.attendantName || ""),
                    csvEscape(Number(row.total ?? 0).toFixed(2)),
                    csvEscape(row.status || ""),
                    csvEscape(new Date(row.createdAt).toISOString()),
                ].join(","));
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
            (0, toast_1.showToast)("Export ready", "success");
        }
        catch (err) {
            const message = err instanceof Error ? err.message : "Failed to export CSV";
            (0, toast_1.showToast)(message, "error");
        }
        finally {
            setExporting(false);
        }
    };
    const { itemsWithCost, supportBuyingTotal, hasCompleteCosts } = costSummary;
    const receiptGrandTotal = Number(detail?.receipt?.totals?.total ?? detail?.receipt?.order?.totalAmount ?? 0);
    const profitAmount = hasCompleteCosts ? receiptGrandTotal - supportBuyingTotal : 0;
    const profitColor = hasCompleteCosts && profitAmount >= 0 ? "text-emerald-300" : hasCompleteCosts ? "text-rose-400" : "text-slate-400";
    const hasSupportItems = Boolean(detail?.supportItems?.length);
    const rangeLabelText = quickRange === "today"
        ? "Today"
        : quickRange === "yesterday"
            ? "Yesterday"
            : quickRange === "this-week"
                ? "This week"
                : "Custom range";
    const partialTotals = (0, react_1.useMemo)(() => {
        const totals = { MPESA: 0, CASH: 0 };
        rows.forEach((row) => {
            if ((row.status ?? "").toUpperCase() !== "PARTIAL")
                return;
            const method = (row.paymentMethod ?? "").toUpperCase();
            if (method === "MPESA" || method === "CASH") {
                totals[method] += Number(row.total ?? 0);
            }
        });
        return totals;
    }, [rows]);
    const derivedSummary = (0, react_1.useMemo)(() => {
        const paymentTotals = rows.reduce((acc, row) => {
            const method = row.paymentMethod ?? "";
            const amount = Number(row.total ?? 0);
            if (method === "MPESA") {
                acc.mpesa.totalSales += amount;
                acc.mpesa.count += 1;
            }
            else if (method === "CASH") {
                acc.cash.totalSales += amount;
                acc.cash.count += 1;
            }
            return acc;
        }, {
            mpesa: { totalSales: 0, count: 0 },
            cash: { totalSales: 0, count: 0 },
        });
        const itemsCount = rows.reduce((sum, row) => {
            const itemList = Array.isArray(row.items) && row.items.length > 0 ? row.items.length : 1;
            return sum + itemList;
        }, 0);
        const totalSales = rows.reduce((sum, row) => sum + Number(row.total ?? 0), 0);
        return {
            totalSales,
            totalCost: 0,
            totalProfit: 0,
            totalProfitPriced: 0,
            totalProfitInclusive: 0,
            receiptsCount: rows.length,
            itemsCount,
            hasCompleteCosts: rows.length === 0,
            awaitingPricingCount: 0,
            paymentTotals,
        };
    }, [rows]);
    const shouldUseDerivedSummary = rows.length > 0 && (!summaryTotals || summaryTotals.totalSales === 0);
    const summaryForDisplay = shouldUseDerivedSummary ? derivedSummary : summaryTotals ?? derivedSummary;
    const summarySalesLabel = summaryLoading
        ? "Loading..."
        : formatCurrency(summaryForDisplay?.totalSales ?? 0);
    const summaryProfitLabel = summaryLoading
        ? "Loading..."
        : formatCurrency(summaryForDisplay?.totalProfit ?? 0);
    const profitColorClass = (summaryForDisplay?.totalProfit ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300";
    const formattedRangeStart = formatRangeLabel(appliedFilters.start);
    const formattedRangeEnd = formatRangeLabel(appliedFilters.end);
    const rangeDisplay = formattedRangeStart && formattedRangeEnd
        ? formattedRangeStart === formattedRangeEnd
            ? formattedRangeStart
            : `${formattedRangeStart} - ${formattedRangeEnd}`
        : rangeLabelText;
    const handlePaymentMethodSelect = (method) => {
        const next = appliedFilters.paymentMethod === method ? "" : method;
        applyFilters({ paymentMethod: next });
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-6", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleTriggerSummary, disabled: triggerSummaryLoading, className: `rounded-full border px-4 py-1 text-xs font-semibold uppercase tracking-wide transition ${triggerSummaryLoading
                            ? "border-white/20 bg-slate-900 text-slate-400 cursor-wait"
                            : "border-emerald-500 text-emerald-200 hover:border-emerald-300 hover:bg-emerald-500/10"}`, children: triggerSummaryLoading ? "Sending summary…" : "Send 8PM summary now" }), triggerSummaryResult && ((0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-400", children: triggerSummaryResult }))] }), (0, jsx_runtime_1.jsx)(ReceiptsSummary_1.default, { summary: summaryForDisplay ?? null, loading: summaryLoading, quickRange: quickRange, onApplyQuickRange: (k) => applyQuickRange(k), sseOn: sseOn && sseEnabled, sseStatus: sseStatus, onToggleSse: (v) => setSseOn(v), rangeLabel: rangeDisplay }), (0, jsx_runtime_1.jsx)(PaymentMethodFilterCard, { totals: summaryForDisplay?.paymentTotals ?? null, partialTotals: partialTotals, activeMethod: appliedFilters.paymentMethod, loading: summaryLoading, onSelect: handlePaymentMethodSelect }), (0, jsx_runtime_1.jsxs)("section", { className: "rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-black/30", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid gap-3 md:grid-cols-2 lg:grid-cols-4", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Search customer / order / staff", (0, jsx_runtime_1.jsx)("input", { value: filters.q, onChange: (e) => setFilters((prev) => ({ ...prev, q: e.target.value })), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 placeholder-slate-500", placeholder: "eg. Jane, OR-123..." })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Document type", (0, jsx_runtime_1.jsxs)("select", { value: filters.docType, onChange: (e) => setFilters((prev) => ({ ...prev, docType: e.target.value })), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All" }), DOC_TYPES.map((type) => ((0, jsx_runtime_1.jsx)("option", { value: type, children: type }, type)))] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["From", (0, jsx_runtime_1.jsx)("input", { type: "date", value: filters.start, onChange: (e) => {
                                            setQuickRange("custom");
                                            setFilters((prev) => {
                                                const next = { ...prev, start: e.target.value };
                                                if (next.end && next.start && next.start > next.end)
                                                    next.end = next.start;
                                                return next;
                                            });
                                        }, className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["To", (0, jsx_runtime_1.jsx)("input", { type: "date", value: filters.end, onChange: (e) => {
                                            setQuickRange("custom");
                                            setFilters((prev) => {
                                                const next = { ...prev, end: e.target.value };
                                                if (next.start && next.end && next.end < next.start)
                                                    next.start = next.end;
                                                return next;
                                            });
                                        }, className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-3 md:grid-cols-[2fr_1fr]", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Staff", (0, jsx_runtime_1.jsxs)("select", { value: filters.attendantId, onChange: (e) => setFilters((prev) => ({ ...prev, attendantId: e.target.value })), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All staff" }), staffList.map((a) => ((0, jsx_runtime_1.jsx)("option", { value: a.id, children: a.name }, a.id)))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-end gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => applyFilters(), className: "flex-1 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95", children: "Apply filters" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: resetFilters, className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5", children: "Reset" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleManualRefresh, className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/5", disabled: loading, children: loading ? "Refreshing..." : "Refresh" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleExport, className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/5 disabled:opacity-50", disabled: exporting, children: exporting ? "Preparing CSV..." : "Export CSV" })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: "overflow-x-auto rounded-2xl border border-white/5 bg-slate-950/40 p-2 shadow-inner shadow-black/40", children: [(0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "text-xs uppercase tracking-wide text-slate-400", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-left", children: "Order" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-left", children: "Doc" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-left", children: "Customer" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-left", children: "Staff" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-left", children: "Total" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-left", children: "Payment" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-left", children: "Status" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-left", children: "Created" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-right", children: "Actions" })] }) }), (0, jsx_runtime_1.jsxs)("tbody", { className: "divide-y divide-white/5", children: [rows.length === 0 && ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: 9, className: "px-3 py-6 text-center text-slate-400", children: loading ? "Loading receipts..." : "No receipts match this filter." }) })), rows.map((row) => {
                                        const isSelected = row.id === selected?.id && drawerOpen;
                                        return ((0, jsx_runtime_1.jsxs)("tr", { className: `cursor-pointer transition hover:bg-white/5 ${isSelected ? "bg-white/5" : ""}`, onClick: () => handleRowClick(row), children: [(0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "font-semibold text-white", children: row.orderRef || "-" }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["#", row.id.slice(0, 6)] })] }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-3", children: (0, jsx_runtime_1.jsx)("span", { className: `${badgeBaseClass} ${getDocBadgeClass(row.docType)}`, children: formatBadgeLabel(row.docType) }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-3", children: (0, jsx_runtime_1.jsx)("div", { className: "text-white", children: row.customerName || "Walk-in" }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-3 text-slate-300", children: row.attendantName || "-" }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-3 font-semibold text-emerald-300", children: formatCurrency(row.total) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-3", children: (0, jsx_runtime_1.jsx)("span", { className: `${badgeBaseClass} ${getPaymentBadgeClass(row.paymentMethod)}`, children: formatBadgeLabel(row.paymentMethod) }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-3", children: (0, jsx_runtime_1.jsx)("span", { className: `${badgeBaseClass} ${getStatusBadgeClass(row.status)}`, children: formatBadgeLabel(row.status) }) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-3 text-slate-300", children: formatDateTime(row.createdAt) }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-3 text-right", children: (0, jsx_runtime_1.jsx)(RowActions_1.default, { onEdit: () => {
                                                            // load detail then open edit modal when ready
                                                            setPendingEditId(row.id);
                                                            handleRowClick(row);
                                                        }, onEditItems: () => {
                                                            setPendingEditId(row.id);
                                                            handleRowClick(row);
                                                        }, onDelete: () => void deleteReceiptById(row.id), onDownload: () => window.open(`/receipts/${row.id}`, "_blank"), onSendWhatsapp: () => void sendReceiptById(row.id, "whatsapp"), onPrint: () => window.open(`/receipts/${row.id}`, "_blank"), disabled: loading || (row.source ?? "pos") !== "pos" }) })] }, row.id));
                                    })] })] }), error && (0, jsx_runtime_1.jsx)("p", { className: "px-3 py-2 text-sm text-rose-300", children: error }), rows.length > 0 && ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between border-t border-white/5 px-3 py-3 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Page ", page, ", showing ", rows.length, " receipts"] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => gotoPage(page - 1), disabled: page === 1 || loading, className: "rounded-xl border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 disabled:opacity-40", children: "Prev" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => gotoPage(page + 1), disabled: !hasMore || loading, className: "rounded-xl border border-white/10 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 disabled:opacity-40", children: "Next" })] })] }))] }), drawerOpen && ((0, jsx_runtime_1.jsxs)(jsx_runtime_1.Fragment, { children: [(0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-40 bg-black/60", onClick: closeDrawer }), (0, jsx_runtime_1.jsxs)("aside", { className: "fixed inset-y-0 right-0 z-50 w-full max-w-xl transform bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/60 transition-transform", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-500", children: "Receipt detail" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-xl font-semibold text-white", children: selected?.orderRef || selected?.id })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: closeDrawer, className: "rounded-full border border-white/10 px-3 py-1 text-sm text-slate-300 hover:bg-white/10", children: "Close" })] }), detailLoading && (0, jsx_runtime_1.jsx)("p", { className: "mt-6 text-sm text-slate-400", children: "Loading details..." }), !detailLoading && detail?.receipt && ((0, jsx_runtime_1.jsxs)("div", { className: "mt-6 space-y-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/5 bg-slate-900/60 p-4 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-4 text-slate-300", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Customer" }), (0, jsx_runtime_1.jsx)("p", { className: "text-base text-white", children: detail.receipt.order?.customerName || detail.receipt.data?.customerName || "Walk-in" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Served by" }), (0, jsx_runtime_1.jsx)("p", { children: detail.receipt.order?.attendant?.name || selected?.attendantName || "-" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Created" }), (0, jsx_runtime_1.jsx)("p", { children: formatDateTime(detail.receipt.generatedAt) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Doc type" }), (0, jsx_runtime_1.jsx)("p", { children: detail.receipt.docType })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 rounded-xl border border-white/5 bg-slate-950/40 p-3 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-4", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Subtotal" }), (0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-white", children: formatCurrency(detail.receipt.totals?.subtotal) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Tax" }), (0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-white", children: formatCurrency(detail.receipt.totals?.tax) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Discount" }), (0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-white", children: formatCurrency(detail.receipt.discount) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Total" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-emerald-300", children: formatCurrency(detail.receipt.totals?.total) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 flex flex-wrap gap-4 text-sm text-slate-300", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Buying total" }), (0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-white", children: formatCurrency(supportBuyingTotal) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Profit" }), (0, jsx_runtime_1.jsx)("p", { className: `text-lg font-semibold ${profitColor}`, children: hasCompleteCosts ? formatCurrency(profitAmount) : "Awaiting cost data" })] })] }), detail.receipt.docType === "LAYAWAY" && ((0, jsx_runtime_1.jsxs)("p", { className: "mt-2 text-xs text-amber-300", children: ["Balance: ", formatCurrency(detail.receipt.totals?.balance ?? detail.receipt.order?.layawayPlan?.balance)] }))] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/5 bg-slate-900/40 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Items" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 space-y-2", children: [itemsWithCost.map((item) => {
                                                        const quantity = Math.max(1, Number(item.quantity ?? 1));
                                                        const sellingPrice = Number(item.sellingPrice ?? 0);
                                                        const lineTotal = sellingPrice * quantity;
                                                        const unitCost = item.buyingPrice;
                                                        const totalCost = unitCost !== null ? unitCost * quantity : null;
                                                        const lineProfit = totalCost !== null ? lineTotal - totalCost : null;
                                                        const profitLabelClass = lineProfit === null
                                                            ? "text-slate-400"
                                                            : lineProfit >= 0
                                                                ? "text-emerald-300"
                                                                : "text-rose-300";
                                                        return ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-xl border border-white/5 px-3 py-2 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-white", children: item.displayName || "Item" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400 flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsxs)("span", { children: ["Qty ", quantity.toLocaleString()] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Selling ", formatCurrency(sellingPrice)] }), (0, jsx_runtime_1.jsxs)("span", { children: ["Cost ", unitCost !== null ? formatCurrency(unitCost) : "N/A"] }), lineProfit !== null ? ((0, jsx_runtime_1.jsxs)("span", { className: profitLabelClass, children: ["Profit ", formatCurrency(lineProfit)] })) : ((0, jsx_runtime_1.jsx)("span", { className: "text-slate-400", children: "Profit N/A" })), item.serial && (0, jsx_runtime_1.jsxs)("span", { children: ["SN ", item.serial] })] })] }), (0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-emerald-300", children: formatCurrency(lineTotal) })] }, item.id));
                                                    }), itemsWithCost.length === 0 && ((0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "No items recorded." }))] })] }), hasSupportItems && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/5 bg-slate-900/60 p-4 text-sm", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Support buying costs" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-3 space-y-2", children: detail.supportItems?.map((support) => ((0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between rounded-xl border border-white/5 bg-slate-950/40 px-3 py-2", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "font-semibold text-white", children: support.productName || "Support entry" }), (0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Captured via support ledger" })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-emerald-300", children: support.buyingPrice !== null ? formatCurrency(support.buyingPrice) : "-" })] }, support.id))) })] })), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)(link_1.default, { href: `/receipts/${detail.receipt.id}`, target: "_blank", rel: "noopener noreferrer", className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/10", children: "Open printable" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleSend("email"), disabled: sendingChannel === "email", className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:opacity-50", children: sendingChannel === "email" ? "Sending..." : "Send email" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => handleSend("whatsapp"), disabled: sendingChannel === "whatsapp", className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-100 hover:bg-white/10 disabled:opacity-50", children: sendingChannel === "whatsapp" ? "Sending..." : "Send WhatsApp" }), allowEdit && ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: openEditModal, className: "rounded-xl bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95", children: "Edit receipt" })), allowEdit && ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: handleDeleteReceipt, disabled: deleting, className: "rounded-xl bg-rose-500 px-4 py-2 text-sm font-semibold text-white hover:brightness-95 disabled:opacity-60", children: deleting ? "Deleting..." : "Delete receipt" }))] }), detail.receipt.notes && ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-white/5 bg-slate-900/60 p-3 text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Notes" }), (0, jsx_runtime_1.jsx)("div", { className: "no-print", children: (0, jsx_runtime_1.jsx)(MarkdownRendererClient_1.RichFormattingToggle, {}) })] }), (0, jsx_runtime_1.jsx)(MarkdownRendererClient_1.default, { mdText: detail.receipt.notes })] }))] }))] })] })), (0, jsx_runtime_1.jsx)(EditModal, { open: editState.open, draft: editState.draft, staffList: staffList, saving: editState.saving, onClose: () => setEditState({ open: false, draft: null, saving: false }), onDraftChange: updateDraft, onSave: handleSaveEdit })] }));
}
function PaymentMethodFilterCard({ totals, partialTotals, activeMethod, loading, onSelect, }) {
    const methods = [
        { key: "MPESA", label: "MPESA" },
        { key: "CASH", label: "Cash" },
    ];
    return ((0, jsx_runtime_1.jsxs)("section", { className: "isolate rounded-2xl border border-white/10 bg-slate-900/60 p-4 shadow-inner shadow-black/30", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center justify-between gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Payments" }), (0, jsx_runtime_1.jsx)("h2", { className: "text-lg font-semibold text-white", children: "Filter by method" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-400", children: "Tap a method to lock the list to MPESA or cash receipts." })] }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => onSelect(""), className: "rounded-full border border-white/15 px-3 py-1 text-xs uppercase tracking-wide text-slate-200 hover:border-emerald-500 hover:text-white", children: "Show all" })] }), (0, jsx_runtime_1.jsx)("div", { className: "mt-4 grid gap-3 sm:grid-cols-2", children: methods.map((method) => {
                    const isActive = activeMethod === method.key;
                    const pool = method.key === "MPESA" ? totals?.mpesa : totals?.cash;
                    const amountLabel = loading ? "Loading..." : formatCurrency(pool?.totalSales ?? 0);
                    const countLabel = loading ? "" : `${pool?.count ?? 0} receipts`;
                    const partialLabel = formatCurrency(partialTotals[method.key]);
                    return ((0, jsx_runtime_1.jsxs)("button", { type: "button", onClick: () => onSelect(method.key), className: `flex flex-col items-start justify-between gap-2 rounded-2xl border px-4 py-3 text-left transition ${isActive
                            ? "border-emerald-500 bg-emerald-500/10 text-white shadow-[0_0_25px_rgba(16,185,129,0.25)]"
                            : "border-white/10 bg-slate-950/70 text-slate-100 hover:border-emerald-500 hover:bg-slate-900/70"}`, "aria-pressed": isActive, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between w-full", children: [(0, jsx_runtime_1.jsx)("span", { className: "text-xs uppercase tracking-[0.3em] text-slate-400", children: method.label }), (0, jsx_runtime_1.jsx)("span", { className: "text-[11px] text-slate-400", children: countLabel })] }), (0, jsx_runtime_1.jsx)("p", { className: "text-2xl font-semibold", children: amountLabel }), (0, jsx_runtime_1.jsxs)("p", { className: "text-xs text-slate-400", children: ["Partial sum: ", (0, jsx_runtime_1.jsx)("span", { className: "font-semibold text-slate-100", children: partialLabel })] })] }, method.key));
                }) })] }));
}
function EditModal({ open, draft, staffList, saving, onClose, onDraftChange, onSave }) {
    const totals = (0, react_1.useMemo)(() => {
        if (!draft)
            return { subtotal: 0, tax: 0, total: 0 };
        const subtotal = draft.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
        const tax = draft.showTax ? subtotal * (draft.taxRate / 100) : 0;
        const total = subtotal + tax - draft.discount;
        return { subtotal, tax, total };
    }, [draft]);
    if (!open || !draft)
        return null;
    const updateItem = (id, patch) => {
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
    const removeItem = (id) => {
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
    return ((0, jsx_runtime_1.jsx)("div", { className: "fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-white/10 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/70", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h3", { className: "text-lg font-semibold text-white", children: "Edit receipt" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onClose, className: "rounded-full border border-white/10 px-3 py-1 text-sm text-slate-200 hover:bg-white/10", children: "Close" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Staff", (0, jsx_runtime_1.jsxs)("select", { value: draft.attendantId ?? "", onChange: (e) => onDraftChange({ ...draft, attendantId: e.target.value || null }), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Keep existing" }), staffList.map((att) => ((0, jsx_runtime_1.jsx)("option", { value: att.id, children: att.name }, att.id)))] })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Document type", (0, jsx_runtime_1.jsx)("select", { value: draft.docType, onChange: (e) => onDraftChange({ ...draft, docType: e.target.value }), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white", children: DOC_TYPES.map((type) => ((0, jsx_runtime_1.jsx)("option", { value: type, children: type }, type))) })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Customer name", (0, jsx_runtime_1.jsx)("input", { value: draft.customerName, onChange: (e) => onDraftChange({ ...draft, customerName: e.target.value }), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Customer phone", (0, jsx_runtime_1.jsx)("input", { value: draft.customerPhone || "", onChange: (e) => onDraftChange({ ...draft, customerPhone: e.target.value }), className: "mt-1 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white" })] })] }), (0, jsx_runtime_1.jsx)("section", { className: "mt-4 space-y-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4", children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-4 text-xs text-slate-300", children: [(0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: draft.showTax, onChange: (e) => onDraftChange({ ...draft, showTax: e.target.checked }), className: "h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500" }), "Show tax (rate ", draft.taxRate, "%)"] }), draft.showTax && ((0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, value: draft.taxRate, onChange: (e) => onDraftChange({ ...draft, taxRate: Number(e.target.value || 0) }), className: "w-24 rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-1 text-sm text-white" })), (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: draft.showDiscount, onChange: (e) => onDraftChange({ ...draft, showDiscount: e.target.checked }), className: "h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500" }), "Show discount"] }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, value: draft.discount, onChange: (e) => onDraftChange({ ...draft, discount: Number(e.target.value || 0) }), className: "w-32 rounded-xl border border-slate-800 bg-slate-950/70 px-2 py-1 text-sm text-white", placeholder: "Discount" }), (0, jsx_runtime_1.jsxs)("label", { className: "inline-flex items-center gap-2", children: [(0, jsx_runtime_1.jsx)("input", { type: "checkbox", checked: draft.paymentDetailsShown, onChange: (e) => onDraftChange({ ...draft, paymentDetailsShown: e.target.checked }), className: "h-4 w-4 rounded border-slate-700 bg-slate-900 text-emerald-500 focus:ring-emerald-500" }), "Show payment instructions"] })] }) }), (0, jsx_runtime_1.jsxs)("section", { className: "mt-4 space-y-3 rounded-2xl border border-white/5 bg-slate-900/40 p-4", children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsx)("h4", { className: "text-sm font-semibold text-white", children: "Items" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: addItem, className: "rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/10", children: "+ Add item" })] }), (0, jsx_runtime_1.jsx)("div", { className: "space-y-3", children: draft.items.map((item) => ((0, jsx_runtime_1.jsxs)("div", { className: "grid gap-2 rounded-2xl border border-white/5 bg-slate-950/60 p-3 md:grid-cols-12", children: [(0, jsx_runtime_1.jsx)("input", { value: item.title, onChange: (e) => updateItem(item.id, { title: e.target.value }), placeholder: "Item description", className: "md:col-span-4 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 1, value: item.quantity, onChange: (e) => updateItem(item.id, { quantity: Math.max(1, Number(e.target.value || 1)) }), className: "md:col-span-1 rounded-xl border border-slate-800 bg-slate-900/70 px-2 py-2 text-sm text-white" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, value: item.unitPrice, onChange: (e) => updateItem(item.id, { unitPrice: Math.max(0, Number(e.target.value || 0)) }), className: "md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white", placeholder: "Unit price" }), (0, jsx_runtime_1.jsx)("input", { type: "number", min: 0, value: item.buyingPrice, onChange: (e) => updateItem(item.id, { buyingPrice: Math.max(0, Number(e.target.value || 0)) }), className: "md:col-span-2 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white", placeholder: "Cost price" }), (0, jsx_runtime_1.jsx)("input", { value: item.serial || "", onChange: (e) => updateItem(item.id, { serial: e.target.value }), placeholder: "Serial", className: "md:col-span-1 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white" }), (0, jsx_runtime_1.jsx)("select", { value: item.warranty || "", onChange: (e) => updateItem(item.id, { warranty: e.target.value || null }), className: "md:col-span-1 rounded-xl border border-slate-800 bg-slate-900/70 px-3 py-2 text-sm text-white", children: WARRANTY_OPTIONS.map((option) => ((0, jsx_runtime_1.jsx)("option", { value: option, children: option || "No warranty" }, option || "none"))) }), (0, jsx_runtime_1.jsxs)("div", { className: "md:col-span-1 flex flex-col items-end justify-between gap-2", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs text-slate-500", children: "Line total" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm font-semibold text-emerald-300", children: formatCurrency(item.quantity * item.unitPrice) }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => removeItem(item.id), className: "text-xs text-rose-300 hover:underline", children: "Remove" })] })] }, item.id))) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-4 grid gap-4 md:grid-cols-2", children: [(0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Notes", (0, jsx_runtime_1.jsx)("textarea", { value: draft.notes || "", onChange: (e) => onDraftChange({ ...draft, notes: e.target.value }), className: "mt-1 min-h-[60px] w-full rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-sm text-white" })] }), (0, jsx_runtime_1.jsxs)("label", { className: "text-xs uppercase tracking-wide text-slate-400", children: ["Warranty text", (0, jsx_runtime_1.jsx)("textarea", { value: draft.warrantyText || "", onChange: (e) => onDraftChange({ ...draft, warrantyText: e.target.value }), className: "mt-1 min-h-[60px] w-full rounded-xl border border-slate-800 bg-slate-900/70 p-2 text-sm text-white" })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-6 flex flex-col gap-2 rounded-2xl border border-white/5 bg-slate-900/60 p-4 text-sm text-slate-200 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("p", { children: ["Subtotal: ", formatCurrency(totals.subtotal)] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Tax: ", formatCurrency(totals.tax)] }), (0, jsx_runtime_1.jsxs)("p", { children: ["Discount: ", formatCurrency(draft.discount)] }), (0, jsx_runtime_1.jsxs)("p", { className: "text-lg font-semibold text-white", children: ["Total: ", formatCurrency(totals.total)] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onClose, className: "rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/10", children: "Cancel" }), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: onSave, disabled: saving, className: "rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60", children: saving ? "Saving..." : "Save changes" })] })] })] }) }));
}
