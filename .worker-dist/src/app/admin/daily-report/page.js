"use strict";
"use client";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = AdminDailyReportPage;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
const Button_1 = __importDefault(require("@/app/_components/Button"));
const Modal_1 = __importDefault(require("@/app/_components/Modal"));
const MarkdownRendererClient_1 = __importDefault(require("@/components/MarkdownRendererClient"));
const dailyReportHelpers_1 = require("@/lib/dailyReportHelpers");
const daily_report_receipts_1 = __importDefault(require("@/components/daily-report-receipts"));
const tradingPeriod_1 = require("@/lib/tradingPeriod");
const toast_1 = require("@/lib/ui/toast");
const EMPTY_SUMMARY = {
    totalProducts: 0,
    totalSales: 0,
    totalNewProducts: 0,
    totalProductsEdited: 0,
    totalCopiesUploaded: 0,
    totalWalkInsServed: 0,
    totalPurchasesMade: 0,
    totalLiveSessions: 0,
    totalCommissionEarned: 0,
};
const DAY_KEYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
const MARKETPLACE_SHOPS = [
    "Betech Store",
    "JM Collection",
    "Hitech Power",
    "Maxton",
    "Sky Store",
    "Betech Solar",
    "Kilimall",
];
const shellCard = "rounded-2xl border border-white/10 bg-slate-900/70 shadow-xl shadow-black/20";
const pillClasses = "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition";
function formatShortDate(date) {
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
function getTradingRange(date = new Date()) {
    const period = (0, tradingPeriod_1.getTradingPeriodFor)(date);
    return {
        start: period.start.toISOString().split("T")[0],
        end: period.end.toISOString().split("T")[0],
        label: `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`,
    };
}
function AdminDailyReportPage() {
    const [shopFilter, setShopFilter] = (0, react_1.useState)("");
    const [minComplete, setMinComplete] = (0, react_1.useState)(0);
    const [sortByCompleteness, setSortByCompleteness] = (0, react_1.useState)(false);
    const [from, setFrom] = (0, react_1.useState)(() => getTradingRange().start);
    const [to, setTo] = (0, react_1.useState)(() => getTradingRange().end);
    const [day, setDay] = (0, react_1.useState)("");
    const [submittedBy, setSubmittedBy] = (0, react_1.useState)("");
    const [reports, setReports] = (0, react_1.useState)([]);
    const [summary, setSummary] = (0, react_1.useState)(null);
    const [error, setError] = (0, react_1.useState)("");
    const [page, setPage] = (0, react_1.useState)(1);
    const [pageSize, setPageSize] = (0, react_1.useState)(25);
    const [totalCount, setTotalCount] = (0, react_1.useState)(0);
    const [showCsvModal, setShowCsvModal] = (0, react_1.useState)(false);
    const [impersonateId, setImpersonateId] = (0, react_1.useState)(null);
    const [showReceiptsPanel, setShowReceiptsPanel] = (0, react_1.useState)(false);
    const [impersonateReceiptsSummary, setImpersonateReceiptsSummary] = (0, react_1.useState)(null);
    const [exportScope, setExportScope] = (0, react_1.useState)("all");
    const [showPreviewModal, setShowPreviewModal] = (0, react_1.useState)(false);
    const [previewHtml, setPreviewHtml] = (0, react_1.useState)("");
    const [legendFilters, setLegendFilters] = (0, react_1.useState)([
        "complete",
        "partial",
        "missing",
    ]);
    const [showDetailModal, setShowDetailModal] = (0, react_1.useState)(false);
    const [detailReport, setDetailReport] = (0, react_1.useState)(null);
    const [jsonPreview, setJsonPreview] = (0, react_1.useState)(null);
    const [deletingId, setDeletingId] = (0, react_1.useState)(null);
    // Derived + memoized to keep render lean
    const filteredReports = (0, react_1.useMemo)(() => {
        return (reports || [])
            .filter((r) => {
            if (!shopFilter)
                return true;
            const mr = r.tasks?.marketplaceReview ?? {};
            const s = mr[shopFilter] || {};
            const checks = [s.stockChecked, s.pricingConfirmed, s.competitorsReviewed, s.oosReviewed];
            const done = checks.filter(Boolean).length;
            return done >= (minComplete || 0);
        })
            .sort((a, b) => {
            if (!sortByCompleteness || !shopFilter)
                return 0;
            const sa = a.tasks?.marketplaceReview ?? {};
            const sb = b.tasks?.marketplaceReview ?? {};
            const aa = sa[shopFilter] || {};
            const bb = sb[shopFilter] || {};
            const ca = [aa.stockChecked, aa.pricingConfirmed, aa.competitorsReviewed, aa.oosReviewed].filter(Boolean).length;
            const cb = [bb.stockChecked, bb.pricingConfirmed, bb.competitorsReviewed, bb.oosReviewed].filter(Boolean).length;
            return cb - ca;
        });
    }, [reports, shopFilter, minComplete, sortByCompleteness]);
    const filteredReportsForAgg = filteredReports;
    // Aggregates for KPIs fall back to summary if present
    const agg = (0, react_1.useMemo)(() => {
        const sum = filteredReportsForAgg.reduce((acc, r) => {
            const metrics = r.tasks?.metrics ?? {};
            const cats = r.tasks?.categories ?? {};
            acc.newUploads += Number(cats.newUploads ?? 0);
            acc.copiesUploaded += Number(cats.copiesUploaded ?? 0);
            acc.productsEdited += Number(cats.productsEdited ?? 0);
            acc.salesCount += Array.isArray(r.tasks?.sales) ? r.tasks.sales.length : 0;
            acc.walkIns += Number(metrics.walkInServed ?? 0);
            acc.purchases += Number(metrics.purchasesMade ?? 0);
            acc.liveSessions += Number(metrics.liveSessionsCount ?? 0);
            acc.commission += Number(metrics.commissionEarned ?? 0);
            return acc;
        }, {
            newUploads: 0,
            copiesUploaded: 0,
            productsEdited: 0,
            salesCount: 0,
            walkIns: 0,
            purchases: 0,
            liveSessions: 0,
            commission: 0,
        });
        return {
            totalProducts: Number(summary?.totalProducts ?? 0),
            totalSales: Number(summary?.totalSales ?? 0),
            totalNewProducts: Number(summary?.totalNewProducts ?? sum.newUploads),
            totalProductsEdited: Number(summary?.totalProductsEdited ?? sum.productsEdited),
            totalCopiesUploaded: Number(summary?.totalCopiesUploaded ?? sum.copiesUploaded),
            totalWalkInsServed: Number(summary?.totalWalkInsServed ?? sum.walkIns),
            totalPurchasesMade: Number(summary?.totalPurchasesMade ?? sum.purchases),
            totalLiveSessions: Number(summary?.totalLiveSessions ?? sum.liveSessions),
            totalCommissionEarned: Number(summary?.totalCommissionEarned ?? sum.commission),
            salesCount: sum.salesCount,
        };
    }, [filteredReportsForAgg, summary]);
    const kpiCards = [
        { label: "Total products", value: agg.totalProducts.toLocaleString() },
        { label: "Total sales", value: `KES ${agg.totalSales.toLocaleString()}` },
        { label: "Live sessions", value: agg.totalLiveSessions.toLocaleString() },
        { label: "Commission", value: `KES ${agg.totalCommissionEarned.toLocaleString()}` },
        { label: "New products", value: agg.totalNewProducts.toLocaleString() },
        { label: "Products edited", value: agg.totalProductsEdited.toLocaleString() },
        { label: "Copies uploaded", value: agg.totalCopiesUploaded.toLocaleString() },
        { label: "Walk-ins served", value: agg.totalWalkInsServed.toLocaleString() },
        { label: "Customers purchased", value: agg.totalPurchasesMade.toLocaleString() },
    ];
    // If impersonating an attendant, show quick receipts summary and allow viewing receipts
    const impersonatePanel = impersonateId ? ((0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-slate-800 bg-slate-950/70 p-4", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Impersonated attendant receipts" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-2 grid grid-cols-2 gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-900/60 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: "Total sales (KES)" }), (0, jsx_runtime_1.jsxs)("p", { className: "text-lg font-semibold text-emerald-300", children: ["KES ", (impersonateReceiptsSummary?.totalSales ?? 0).toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-900/60 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: "Total receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-emerald-300", children: impersonateReceiptsSummary?.totalReceipts ?? 0 })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-900/60 p-3", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-[10px] uppercase tracking-wide text-slate-400", children: "Products sold" }), (0, jsx_runtime_1.jsx)("p", { className: "text-lg font-semibold text-emerald-300", children: impersonateReceiptsSummary?.totalItems ?? 0 })] }), (0, jsx_runtime_1.jsx)("div", { className: "rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center justify-center", children: (0, jsx_runtime_1.jsx)("button", { className: "rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-black", onClick: () => setShowReceiptsPanel((s) => !s), children: showReceiptsPanel ? "Hide receipts" : "View receipts" }) })] })] })) : null;
    const scopeOptions = [
        { label: "Current page", value: "page" },
        { label: "All filtered", value: "all" },
        { label: "Full JSON", value: "json" },
    ];
    const legendOptions = [
        { key: "complete", label: "Complete" },
        { key: "partial", label: "Partial" },
        { key: "missing", label: "Missing" },
    ];
    const tradingRange = getTradingRange();
    const pageStart = totalCount === 0 ? 0 : Math.min((page - 1) * pageSize + 1, totalCount);
    const pageEnd = Math.min(page * pageSize, totalCount);
    const maxPage = Math.max(1, Math.ceil(totalCount / pageSize) || 1);
    (0, react_1.useEffect)(() => {
        void fetchReports();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined")
            return;
        const params = new URLSearchParams(window.location.search);
        const imp = params.get("impersonateId");
        if (!imp)
            return;
        setImpersonateId(imp);
        (async () => {
            try {
                const res = await fetch(`/api/attendant/earnings/summary?impersonateId=${encodeURIComponent(imp)}`, { cache: "no-store", credentials: "same-origin" });
                if (!res.ok)
                    return;
                const data = await res.json().catch(() => null);
                if (!data)
                    return;
                setImpersonateReceiptsSummary({
                    totalSales: Number(data.totalSales ?? 0),
                    totalProfit: Number(data.totalProfit ?? 0),
                    totalReceipts: Number(data.totalReceipts ?? 0),
                    totalItems: Number(data.totalItems ?? 0),
                });
            }
            catch (e) {
                // ignore
            }
        })();
    }, []);
    // If the admin is impersonating a user via query param, fetch the
    // CommissionLedger for the current trading period and prefer its
    // stored commission value when displaying the KPI. This ensures the
    // admin view shows the authoritative (possibly zero) commission.
    (0, react_1.useEffect)(() => {
        if (typeof window === "undefined")
            return;
        const params = new URLSearchParams(window.location.search);
        const imp = params.get("impersonateId");
        if (!imp)
            return;
        const dt = new Date();
        const url = `/api/marketing/ledger?impersonateId=${encodeURIComponent(imp)}&date=${dt.toISOString().split("T")[0]}`;
        (async () => {
            try {
                const res = await fetch(url, { method: "GET", credentials: "same-origin" });
                if (!res.ok)
                    return;
                const j = await res.json().catch(() => null);
                const ledger = j?.ledger ?? null;
                if (ledger) {
                    const marketingCommission = Number(ledger.detail?.marketing?.commission ?? 0);
                    const supportCommission = Number(ledger.detail?.support?.commission ?? 0);
                    const net = Number(ledger.netCommission ?? ledger.grossCommission ?? 0);
                    const final = marketingCommission + supportCommission || net || 0;
                    setSummary((s) => s ? { ...s, totalCommissionEarned: Number(final) } : { ...EMPTY_SUMMARY, totalCommissionEarned: Number(final) });
                }
            }
            catch (e) {
                // ignore
            }
        })();
    }, []);
    async function fetchReports(opts) {
        setError("");
        const params = new URLSearchParams();
        if (typeof window !== "undefined") {
            const imp = new URLSearchParams(window.location.search).get("impersonateId");
            if (imp)
                params.append("impersonateId", imp);
        }
        if (from)
            params.append("from", from);
        if (to)
            params.append("to", to);
        if (day)
            params.append("day", day);
        if (submittedBy)
            params.append("user", submittedBy);
        params.append("page", String(page));
        params.append("pageSize", String(pageSize));
        const url = `/api/daily-report${params.toString() ? "?" + params.toString() : ""}`;
        try {
            const res = await fetch(url);
            if (res.ok) {
                const data = await res.json();
                setReports(data.reports ?? []);
                setSummary(data.summary ?? null);
                setTotalCount(data.totalCount ?? 0);
                if ((data.reports ?? []).length === 0 && page > 1)
                    setPage(1);
                if (!opts?.silent)
                    (0, toast_1.showToast)("Reports loaded", "success");
            }
            else {
                const data = await res.json().catch(() => ({}));
                setError(data.error || "Failed to fetch reports.");
                (0, toast_1.showToast)(data.error || "Failed to fetch reports.", "error");
            }
        }
        catch {
            setError("Failed to fetch reports.");
            (0, toast_1.showToast)("Failed to fetch reports.", "error");
        }
    }
    function downloadCsv() {
        const shopCols = [];
        for (const shop of MARKETPLACE_SHOPS) {
            const safe = shop.replace(/\s+/g, "_");
            shopCols.push(`${safe}_stockChecked`);
            shopCols.push(`${safe}_pricingConfirmed`);
            shopCols.push(`${safe}_competitorsReviewed`);
            shopCols.push(`${safe}_oosReviewed`);
            shopCols.push(`${safe}_notes`);
        }
        const header = [
            "Date",
            "Day",
            "Attendant",
            "SubmittedBy",
            "MarketplaceReview",
            ...shopCols,
            "Products",
            "Sales",
            "NewUploads",
            "CopiesUploaded",
            "ProductsEdited",
            "Attended Marketing Meeting",
            "Participated In Video Shoot",
            "Marketing Videos Posted",
            "WalkInCustomers",
            "CustomersPurchased",
            "LiveViewers",
            "LivePurchases",
            "OfficeCleaned",
            "OfficeNotes",
            "SalesDetails",
            "CustomerComms",
            "Tasks",
        ];
        const quote = (s) => `"${String(s).replace(/"/g, '""')}"`;
        const rows = filteredReports.map((r) => {
            const dateStr = new Date(r.date).toISOString().split("T")[0];
            const attendant = r.user?.name ?? "";
            const submitted = r.tasks?.submittedBy ?? "";
            const tasks = r.tasks ?? {};
            const categories = tasks.categories ?? {};
            const marketing = tasks.marketing ?? {};
            const customerOps = tasks.customerOperations ?? {};
            const office = tasks.officeMaintenance ?? {};
            const salesDetails = Array.isArray(tasks.sales) ? JSON.stringify(tasks.sales) : "[]";
            const mr = tasks.marketplaceReview || {};
            const shopValues = [];
            for (const shop of MARKETPLACE_SHOPS) {
                const s = mr[shop] || {};
                shopValues.push(String(s.stockChecked ? "Yes" : ""));
                shopValues.push(String(s.pricingConfirmed ? "Yes" : ""));
                shopValues.push(String(s.competitorsReviewed ? "Yes" : ""));
                shopValues.push(String(s.oosReviewed ? "Yes" : ""));
                shopValues.push(String(s.notes ?? ""));
            }
            const cc = tasks.customerComms || {};
            const ccValues = [
                String(cc.walkInServed ?? ""),
                String(cc.onlineServed ?? ""),
                String(cc.callsHandled ?? ""),
                String(cc.whatsappSmsReplied ?? ""),
                String(cc.fbCommentsReplied ?? ""),
                String(cc.fbDmsReplied ?? ""),
                String(cc.igCommentsReplied ?? ""),
                String(cc.igDmsReplied ?? ""),
                String(cc.fbAllCleared ? "Yes" : ""),
                String(cc.igAllCleared ? "Yes" : ""),
                String(cc.competitorNotes ?? ""),
                String(cc.improvementSuggestions ?? ""),
            ];
            return [
                dateStr,
                r.day,
                attendant,
                submitted,
                ...shopValues,
                String(r.productsCount),
                String(r.totalSales),
                String(categories.newUploads ?? ""),
                String(categories.copiesUploaded ?? ""),
                String(categories.productsEdited ?? ""),
                String(marketing.attendedMarketingMeeting ? "Yes" : "No"),
                String(marketing.participatedVideoShoot ? "Yes" : "No"),
                String(marketing.marketingVideosShot ?? ""),
                String(customerOps.walkInCustomers ?? ""),
                String(customerOps.customersPurchased ?? ""),
                String(customerOps.liveViewers ?? ""),
                String(customerOps.livePurchases ?? ""),
                String(office.officeCleaned ? "Yes" : "No"),
                String(office.officeNotes ?? ""),
                salesDetails,
                ...ccValues,
                JSON.stringify(tasks.customerComms ?? {}),
                JSON.stringify(tasks ?? {}),
            ];
        });
        const csv = [header, ...rows]
            .map((row) => row.map((c) => quote(c)).join(","))
            .join("\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.setAttribute("download", "daily_reports.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
    const CSV_COLUMNS = [
        "Date",
        "Day",
        "Attendant",
        "SubmittedBy",
        "MarketplaceReview (JSON)",
        ...MARKETPLACE_SHOPS.flatMap((s) => {
            const safe = s.replace(/\s+/g, "_");
            return [
                `${safe}_stockChecked`,
                `${safe}_pricingConfirmed`,
                `${safe}_competitorsReviewed`,
                `${safe}_oosReviewed`,
                `${safe}_notes`,
            ];
        }),
        "Products",
        "Sales",
        "NewUploads",
        "CopiesUploaded",
        "ProductsEdited",
        "Attended Marketing Meeting",
        "Participated In Video Shoot",
        "Marketing Videos Posted",
        "WalkInCustomers",
        "CustomersPurchased",
        "LiveViewers",
        "LivePurchases",
        "OfficeCleaned",
        "OfficeNotes",
        "CustomerComms (JSON)",
        "Tasks (JSON)",
    ];
    function downloadPdf() {
        const rows = filteredReportsForAgg
            .map((r) => {
            const dateStr = new Date(r.date).toISOString().split("T")[0];
            const attendant = r.user?.name ?? "";
            const submitted = r.tasks?.submittedBy ?? "";
            const products = r.tasks?.categories ?? {};
            const sales = Array.isArray(r.tasks?.sales) ? r.tasks.sales : [];
            return `<tr>
        <td style="padding:6px;border:1px solid #ddd">${dateStr}</td>
        <td style="padding:6px;border:1px solid #ddd">${r.day}</td>
        <td style="padding:6px;border:1px solid #ddd">${attendant}</td>
        <td style="padding:6px;border:1px solid #ddd">${submitted}</td>
        <td style="padding:6px;border:1px solid #ddd">${products.newUploads ?? ""}</td>
        <td style="padding:6px;border:1px solid #ddd">${products.copiesUploaded ?? ""}</td>
        <td style="padding:6px;border:1px solid #ddd">${products.productsEdited ?? ""}</td>
        <td style="padding:6px;border:1px solid #ddd">${sales.length}</td>
      </tr>`;
        })
            .join("");
        const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Daily Reports</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color:#111; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background: #f4f4f4; }
          </style>
        </head>
        <body>
          <h2>Daily Reports - Export</h2>
          <p>Exported ${filteredReportsForAgg.length} reports</p>
          <table>
            <thead>
              <tr>
                <th>Date</th><th>Day</th><th>Attendant</th><th>SubmittedBy</th><th>NewUploads</th><th>Copies</th><th>Edited</th><th>SalesCount</th>
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </body>
      </html>`;
        const w = window.open("", "_blank", "noopener");
        if (!w)
            return;
        w.document.write(html);
        w.document.close();
        setTimeout(() => {
            w.print();
        }, 350);
    }
    function generateExportHtml(scope) {
        let sourceReports = [];
        if (scope === "page") {
            sourceReports = reports;
        }
        else if (scope === "all" || scope === "json") {
            sourceReports = filteredReportsForAgg;
        }
        const shopHeaderCells = MARKETPLACE_SHOPS.map((s) => `<th colspan="4" style="padding:6px;border:1px solid #ddd">${s}</th>`).join("");
        const rows = sourceReports
            .map((r) => {
            const dateStr = new Date(r.date).toISOString().split("T")[0];
            const attendant = r.user?.name ?? "";
            const submitted = r.tasks?.submittedBy ?? "";
            const mr = r.tasks?.marketplaceReview || {};
            const shopVals = MARKETPLACE_SHOPS.map((s) => {
                const v = mr[s] || {};
                return `<td style="padding:6px;border:1px solid #ddd">${v.stockChecked ? "Yes" : ""}</td>
                <td style="padding:6px;border:1px solid #ddd">${v.pricingConfirmed ? "Yes" : ""}</td>
                <td style="padding:6px;border:1px solid #ddd">${v.competitorsReviewed ? "Yes" : ""}</td>
                <td style="padding:6px;border:1px solid #ddd">${v.oosReviewed ? "Yes" : ""}</td>`;
            }).join("");
            return `<tr>
        <td style="padding:6px;border:1px solid #ddd">${dateStr}</td>
        <td style="padding:6px;border:1px solid #ddd">${r.day}</td>
        <td style="padding:6px;border:1px solid #ddd">${attendant}</td>
        <td style="padding:6px;border:1px solid #ddd">${submitted}</td>
        ${shopVals}
      </tr>`;
        })
            .join("");
        const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Daily Reports</title>
          <style>
            body { font-family: Arial, Helvetica, sans-serif; color:#111; }
            table { border-collapse: collapse; width: 100%; }
            th, td { border: 1px solid #ddd; padding: 8px; }
            th { background: #f4f4f4; }
            pre.json { background:#f8f8f8; padding:8px; border:1px solid #eee; font-size:11px; white-space:pre-wrap; }
          </style>
        </head>
        <body>
          <h2>Daily Reports - Export (${scope})</h2>
          <p>Exported ${sourceReports.length} reports</p>
          <table>
            <thead>
              <tr>
                <th rowspan="2">Date</th><th rowspan="2">Day</th><th rowspan="2">Attendant</th><th rowspan="2">SubmittedBy</th>
                ${shopHeaderCells}
              </tr>
              <tr>
                ${MARKETPLACE_SHOPS.map(() => "<th>Stock</th><th>Pricing</th><th>Comp</th><th>OOS</th>").join("")}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          ${scope === "json"
            ? `<h3>Full JSON</h3><pre class="json">${JSON.stringify(sourceReports.map((r) => ({ id: r.id, date: r.date, day: r.day, tasks: r.tasks, user: r.user })), null, 2)}</pre>`
            : ""}
        </body>
      </html>`;
        return html;
    }
    function openPreview(scope) {
        const html = generateExportHtml(scope);
        setPreviewHtml(html);
        setShowPreviewModal(true);
    }
    async function downloadServerPdf(scope) {
        const params = new URLSearchParams();
        if (from)
            params.append("from", from);
        if (to)
            params.append("to", to);
        if (day)
            params.append("day", day);
        if (submittedBy)
            params.append("user", submittedBy);
        if (shopFilter)
            params.append("shop", shopFilter);
        if (scope === "json")
            params.append("includeJson", "1");
        params.append("scope", scope);
        const url = `/api/daily-report/export/pdf?${params.toString()}`;
        const w = window.open(url, "_blank");
        if (!w)
            (0, toast_1.showToast)("Unable to open PDF in a new tab", "error");
    }
    function renderShopBadges(s) {
        const present = Boolean(s && Object.keys(s).length > 0);
        if (!present)
            return (0, jsx_runtime_1.jsx)("div", { className: "text-slate-400", children: "-" });
        const IconCheck = () => ((0, jsx_runtime_1.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", className: "mr-1 inline-block", children: (0, jsx_runtime_1.jsx)("path", { d: "M5 13l4 4L19 7", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) }));
        const IconX = () => ((0, jsx_runtime_1.jsx)("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "none", xmlns: "http://www.w3.org/2000/svg", className: "mr-1 inline-block", children: (0, jsx_runtime_1.jsx)("path", { d: "M18 6L6 18M6 6l12 12", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round" }) }));
        const badge = (label, ok, key) => ((0, jsx_runtime_1.jsxs)("span", { title: label + (ok ? ": Yes" : ": No"), className: `mr-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${ok ? "bg-status-complete text-black" : "bg-status-missing text-white"}`, children: [ok ? (0, jsx_runtime_1.jsx)(IconCheck, {}) : (0, jsx_runtime_1.jsx)(IconX, {}), label] }, key));
        return ((0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("div", { className: "mb-1", children: [badge("Stock", Boolean(s.stockChecked), "stock"), badge("Pricing", Boolean(s.pricingConfirmed), "pricing"), badge("Competitors", Boolean(s.competitorsReviewed), "comp"), badge("OOS", Boolean(s.oosReviewed), "oos")] }), s.notes ? ((0, jsx_runtime_1.jsx)("div", { className: "max-w-[12rem] text-xs text-slate-400", children: (0, jsx_runtime_1.jsx)(MarkdownRendererClient_1.default, { mdText: String(s.notes) }) })) : null] }));
    }
    const deleteReport = async (reportId) => {
        if (typeof window !== "undefined") {
            const ok = window.confirm("Delete this daily report entry? This action cannot be undone.");
            if (!ok)
                return;
        }
        setDeletingId(reportId);
        try {
            const res = await fetch("/api/admin/daily-report/delete-entry", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ entryId: reportId }),
            });
            const payload = await res.json().catch(() => ({}));
            if (!res.ok) {
                throw new Error(payload?.error || "Delete failed");
            }
            setReports((prev) => prev.filter((r) => r.id !== reportId));
            setTotalCount((count) => Math.max(0, count - 1));
            (0, toast_1.showToast)("Entry deleted", "success");
            await fetchReports({ silent: true });
        }
        catch (err) {
            (0, toast_1.showToast)(err?.message || "Delete failed", "error");
        }
        finally {
            setDeletingId(null);
        }
    };
    return ((0, jsx_runtime_1.jsx)("div", { className: "min-h-screen bg-[radial-gradient(circle_at_20%_0%,#1d2a5c_0%,transparent_38%),radial-gradient(circle_at_90%_10%,#251147_0%,transparent_32%),linear-gradient(180deg,#070b12,#0a0f1a)] text-white", children: (0, jsx_runtime_1.jsxs)("main", { className: "mx-auto max-w-7xl space-y-6 px-6 py-8", children: [(0, jsx_runtime_1.jsx)("section", { className: `${shellCard} border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950 to-black p-6`, children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-4 md:flex-row md:items-center md:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-[0.2em] text-slate-400", children: "Daily Ops" }), (0, jsx_runtime_1.jsx)("h1", { className: "text-3xl font-semibold tracking-tight", children: "Daily Performance Reports" }), (0, jsx_runtime_1.jsx)("p", { className: "mt-2 max-w-2xl text-sm text-slate-300", children: "Team submissions, marketplace checks, and operational notes\u2014refined for admin review." })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 shadow-[0_0_30px_rgba(52,211,153,0.18)]", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-emerald-200", children: "Trading period" }), (0, jsx_runtime_1.jsx)("div", { className: "text-base font-semibold text-emerald-50", children: tradingRange.label }), (0, jsx_runtime_1.jsx)("div", { className: "text-[11px] text-emerald-200/80", children: "25th to 24th" })] })] }) }), impersonateId && ((0, jsx_runtime_1.jsxs)("section", { className: `${shellCard} p-4`, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex items-center justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("p", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Impersonated attendant receipts" }), (0, jsx_runtime_1.jsx)("p", { className: "text-sm text-slate-300", children: "Showing receipts summary for the impersonated user for this trading period." })] }), (0, jsx_runtime_1.jsx)("div", { children: (0, jsx_runtime_1.jsx)("button", { className: "rounded-xl bg-emerald-500 px-3 py-2 text-sm font-semibold text-black", onClick: () => setShowReceiptsPanel((s) => !s), children: showReceiptsPanel ? "Hide receipts" : "View receipts" }) })] }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-3 grid grid-cols-3 gap-3", children: [(0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-900/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Total sales (KES)" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 text-lg font-semibold text-emerald-300", children: ["KES ", (impersonateReceiptsSummary?.totalSales ?? 0).toLocaleString()] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-900/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Total receipts" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-lg font-semibold text-emerald-300", children: impersonateReceiptsSummary?.totalReceipts ?? 0 })] }), (0, jsx_runtime_1.jsxs)("div", { className: "rounded-xl border border-slate-800 bg-slate-900/60 p-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: "Products sold" }), (0, jsx_runtime_1.jsx)("div", { className: "mt-1 text-lg font-semibold text-emerald-300", children: impersonateReceiptsSummary?.totalItems ?? 0 })] })] }), showReceiptsPanel && ((0, jsx_runtime_1.jsx)("div", { className: "mt-4", children: (0, jsx_runtime_1.jsx)(daily_report_receipts_1.default, { start: from, end: to, attendantId: impersonateId }) }))] })), (0, jsx_runtime_1.jsx)("section", { className: "grid gap-3 md:grid-cols-3 lg:grid-cols-4", children: kpiCards.map((k) => ((0, jsx_runtime_1.jsxs)("div", { className: `${shellCard} bg-slate-900/70 p-4 transition hover:-translate-y-0.5 hover:border-white/20`, children: [(0, jsx_runtime_1.jsx)("div", { className: "text-xs uppercase tracking-wide text-slate-400", children: k.label }), (0, jsx_runtime_1.jsx)("div", { className: "mt-2 text-2xl font-semibold", children: k.value })] }, k.label))) }), (0, jsx_runtime_1.jsx)("section", { className: `${shellCard} p-4`, children: (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between", children: [(0, jsx_runtime_1.jsxs)("div", { className: "grid w-full gap-4 md:grid-cols-3", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "From" }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: from, onChange: (e) => setFrom(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "To" }), (0, jsx_runtime_1.jsx)("input", { type: "date", value: to, onChange: (e) => setTo(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Day" }), (0, jsx_runtime_1.jsxs)("select", { value: day, onChange: (e) => setDay(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "Any" }), DAY_KEYS.map((d) => ((0, jsx_runtime_1.jsx)("option", { value: d, children: d }, d)))] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Submitted by" }), (0, jsx_runtime_1.jsx)("input", { type: "text", value: submittedBy, onChange: (e) => setSubmittedBy(e.target.value), placeholder: "Name or ID", className: "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white" })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Marketplace shop focus" }), (0, jsx_runtime_1.jsxs)("select", { value: shopFilter, onChange: (e) => setShopFilter(e.target.value), className: "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white", children: [(0, jsx_runtime_1.jsx)("option", { value: "", children: "All shops" }), MARKETPLACE_SHOPS.map((s) => ((0, jsx_runtime_1.jsx)("option", { value: s, children: s }, s)))] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("label", { className: "text-xs text-slate-400", children: "Min checks done (selected shop)" }), (0, jsx_runtime_1.jsx)("select", { value: minComplete, onChange: (e) => setMinComplete(Number(e.target.value)), className: "mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white", children: [0, 1, 2, 3, 4].map((v) => ((0, jsx_runtime_1.jsx)("option", { value: v, children: v }, v))) })] })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap justify-end gap-2", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: () => {
                                            setSortByCompleteness((prev) => !prev);
                                        }, children: sortByCompleteness ? "Sorted by completeness" : "Sort by completeness" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "primary", onClick: () => {
                                            setPage(1);
                                            void fetchReports();
                                        }, children: "Apply filters" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "muted", onClick: () => {
                                            const params = new URLSearchParams({
                                                ...(from ? { from } : {}),
                                                ...(to ? { to } : {}),
                                                ...(day ? { day } : {}),
                                                ...(submittedBy ? { user: submittedBy } : {}),
                                            });
                                            window.location.href = `/api/daily-report/export${params.toString() ? `?${params.toString()}` : ""}`;
                                        }, children: "Quick export" })] })] }) }), (0, jsx_runtime_1.jsxs)("section", { className: `${shellCard} flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between`, children: [(0, jsx_runtime_1.jsx)("div", { className: "flex flex-wrap gap-2", children: scopeOptions.map((scope) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setExportScope(scope.value), className: `${pillClasses} ${exportScope === scope.value
                                    ? "border-emerald-500 bg-emerald-500 text-black"
                                    : "border-slate-700 text-slate-200 hover:border-white/40"}`, children: scope.label }, scope.value))) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { onClick: () => setShowCsvModal(true), variant: "secondary", children: "CSV columns" }), (0, jsx_runtime_1.jsx)(Button_1.default, { onClick: downloadCsv, variant: "secondary", children: "Download CSV" }), (0, jsx_runtime_1.jsx)(Button_1.default, { onClick: () => openPreview(exportScope), variant: "muted", children: "Preview" }), (0, jsx_runtime_1.jsx)(Button_1.default, { onClick: () => downloadServerPdf(exportScope), variant: "primary", children: "Download PDF" })] })] }), (0, jsx_runtime_1.jsxs)("section", { className: `${shellCard} flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between`, children: [(0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap gap-2", children: [legendOptions.map((legend) => ((0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setLegendFilters((prev) => prev.includes(legend.key)
                                        ? prev.filter((item) => item !== legend.key)
                                        : [...prev, legend.key]), className: `${pillClasses} ${legendFilters.includes(legend.key)
                                        ? "border-emerald-500 bg-emerald-500 text-black"
                                        : "border-slate-700 text-slate-200 hover:border-white/40"}`, children: legend.label }, legend.key))), (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => setLegendFilters(["complete", "partial", "missing"]), className: "rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:border-white/40", children: "All statuses" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-3 text-xs text-slate-300", children: [(0, jsx_runtime_1.jsx)("span", { children: totalCount ? `Showing ${pageStart} - ${pageEnd} of ${totalCount}` : "No entries yet" }), (0, jsx_runtime_1.jsxs)("div", { className: "flex flex-wrap items-center gap-2", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: () => {
                                                if (page > 1) {
                                                    setPage(page - 1);
                                                    void fetchReports();
                                                }
                                            }, disabled: page <= 1, children: "Prev" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: () => {
                                                if (page < maxPage) {
                                                    setPage(page + 1);
                                                    void fetchReports();
                                                }
                                            }, disabled: page >= maxPage, children: "Next" }), (0, jsx_runtime_1.jsxs)("label", { className: "flex items-center gap-2 text-xs", children: ["Page size", (0, jsx_runtime_1.jsx)("select", { value: pageSize, onChange: (e) => {
                                                        setPageSize(Number(e.target.value));
                                                        setPage(1);
                                                    }, className: "rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-100", children: [10, 25, 50, 100].map((size) => ((0, jsx_runtime_1.jsx)("option", { value: size, children: size }, size))) })] })] })] })] }), error && ((0, jsx_runtime_1.jsx)("div", { className: "rounded-2xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200", children: error })), (0, jsx_runtime_1.jsx)("section", { className: "rounded-2xl border border-white/10 bg-slate-950/70 shadow-xl shadow-black/30", children: (0, jsx_runtime_1.jsx)("div", { className: "overflow-x-auto", children: (0, jsx_runtime_1.jsxs)("table", { className: "min-w-full text-sm", children: [(0, jsx_runtime_1.jsx)("thead", { className: "sticky top-0 z-10 bg-slate-950/90 text-left text-xs uppercase tracking-wide text-slate-400 backdrop-blur", children: (0, jsx_runtime_1.jsxs)("tr", { children: [(0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Date" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Day" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Attendant" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Submitted By" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Marketplace" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Marketplace JSON" }), MARKETPLACE_SHOPS.map((s) => ((0, jsx_runtime_1.jsx)("th", { className: "hidden px-3 py-2 text-left sm:table-cell", children: s }, s))), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-right", children: "Products" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2 text-right", children: "Sales (KES)" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Tasks" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Marketing" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Customer Ops" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Office" }), (0, jsx_runtime_1.jsx)("th", { className: "px-3 py-2", children: "Actions" })] }) }), (0, jsx_runtime_1.jsx)("tbody", { children: reports.length === 0 ? ((0, jsx_runtime_1.jsx)("tr", { children: (0, jsx_runtime_1.jsx)("td", { colSpan: MARKETPLACE_SHOPS.length + 13, className: "px-3 py-6 text-center text-slate-400", children: "No reports found" }) })) : (reports.map((r, idx) => {
                                        const rowStatus = (0, dailyReportHelpers_1.computeRowStatus)(r);
                                        if (!legendFilters.includes(rowStatus))
                                            return null;
                                        const tasks = r.tasks ?? {};
                                        const categories = tasks.categories ?? {};
                                        const marketing = tasks.marketing ?? {};
                                        const customerOps = tasks.customerOperations ?? {};
                                        const office = tasks.officeMaintenance ?? {};
                                        const rowClass = idx % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/40";
                                        return ((0, jsx_runtime_1.jsxs)("tr", { className: `border-t border-slate-800 ${rowClass}`, children: [(0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: new Date(r.date).toLocaleDateString() }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: r.day }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: r.user?.name ?? "-" }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: r.tasks?.submittedBy ?? "-" }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: (() => {
                                                        const mr = r.tasks?.marketplaceReview ?? {};
                                                        const shops = Object.keys(mr || {});
                                                        if (!shops || shops.length === 0)
                                                            return (0, jsx_runtime_1.jsx)("span", { className: "text-slate-500", children: "-" });
                                                        const complete = shops.filter((k) => {
                                                            const s = mr[k];
                                                            return s && s.stockChecked && s.pricingConfirmed && s.competitorsReviewed && s.oosReviewed;
                                                        }).length;
                                                        return (0, jsx_runtime_1.jsxs)("span", { className: "text-sm font-medium text-white", children: [complete, "/", shops.length, " shops complete"] });
                                                    })() }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: (0, jsx_runtime_1.jsx)("button", { type: "button", className: "text-xs text-sky-300 underline hover:text-sky-200", onClick: () => setJsonPreview({
                                                            title: `${new Date(r.date).toLocaleDateString()} marketplace review`,
                                                            payload: r.tasks?.marketplaceReview ?? {},
                                                        }), children: "View JSON" }) }), MARKETPLACE_SHOPS.map((shop) => {
                                                    const mr = r.tasks?.marketplaceReview ?? {};
                                                    const shopData = mr[shop] || {};
                                                    return ((0, jsx_runtime_1.jsx)("td", { className: "hidden px-3 py-2 text-sm sm:table-cell", title: String(shopData.notes ?? "") || undefined, children: renderShopBadges(shopData) }, shop));
                                                }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-right text-white", children: r.productsCount }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-right text-white", children: Number(r.totalSales).toLocaleString() }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-slate-200", children: (0, jsx_runtime_1.jsxs)("div", { className: "text-sm", children: [(0, jsx_runtime_1.jsxs)("div", { className: "font-semibold", children: ["Receipts: ", Array.isArray(tasks.sales) ? tasks.sales.length : 0] }), (0, jsx_runtime_1.jsxs)("div", { className: "text-xs text-slate-400", children: ["New: ", categories.newUploads ?? 0, " \u00B7 Copies: ", categories.copiesUploaded ?? 0, " \u00B7 Edited: ", categories.productsEdited ?? 0] }), Array.isArray(tasks.sales) && tasks.sales.length > 0 ? ((0, jsx_runtime_1.jsx)("ul", { className: "mt-2 list-disc pl-5 text-xs text-slate-300", children: tasks.sales.map((sale, saleIdx) => ((0, jsx_runtime_1.jsxs)("li", { children: [sale.productName || "-", " - KES ", Number(sale.price || 0).toLocaleString(), sale.paymentMethod ? ` - ${String(sale.paymentMethod)}` : "", sale.receiptNumber ? ` (#${String(sale.receiptNumber)})` : ""] }, saleIdx))) })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-500", children: "No sales recorded" }))] }) }), (0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Video Shoot: ", marketing.participatedVideoShoot ? "Yes" : "No"] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Marketing Meeting: ", marketing.attendedMarketingMeeting ? "Yes" : "No"] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Videos Shot: ", marketing.marketingVideosShot ?? 0] })] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Walk-ins: ", customerOps.walkInCustomers ?? 0] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Customers Purchased: ", customerOps.customersPurchased ?? 0] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Live Viewers: ", customerOps.liveViewers ?? 0] }), (0, jsx_runtime_1.jsxs)("div", { children: ["Live Purchases: ", customerOps.livePurchases ?? 0] })] }), (0, jsx_runtime_1.jsxs)("td", { className: "px-3 py-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { children: ["Cleaned: ", office.officeCleaned ? "Yes" : "No"] }), (0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: office.officeNotes ?? "" }), (0, jsx_runtime_1.jsx)("button", { type: "button", className: "mt-2 text-xs text-emerald-300 underline hover:text-emerald-200", onClick: () => {
                                                                setDetailReport(r);
                                                                setShowDetailModal(true);
                                                            }, children: "View details" })] }), (0, jsx_runtime_1.jsx)("td", { className: "px-3 py-2 text-sm text-slate-200", children: (0, jsx_runtime_1.jsx)("button", { type: "button", onClick: () => deleteReport(r.id), disabled: deletingId === r.id, className: "text-xs text-rose-400 underline hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-60", children: deletingId === r.id ? "Deleting..." : "Delete" }) })] }, r.id));
                                    })) })] }) }) }), (0, jsx_runtime_1.jsx)(Modal_1.default, { title: "CSV Columns Included", open: showCsvModal, onClose: () => setShowCsvModal(false), children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-2 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsx)("p", { className: "text-slate-300", children: "This export includes the following columns (flattened per-shop columns are named using the shop label):" }), (0, jsx_runtime_1.jsx)("ul", { className: "list-disc pl-5", children: CSV_COLUMNS.map((c) => ((0, jsx_runtime_1.jsx)("li", { className: "py-0.5", children: c }, c))) })] }) }), (0, jsx_runtime_1.jsx)(Modal_1.default, { title: "Export Preview", open: showPreviewModal, onClose: () => setShowPreviewModal(false), children: (0, jsx_runtime_1.jsxs)("div", { className: "space-y-3", children: [(0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-300", children: "Preview the export layout below. Use Print to open the browser print dialog." }), (0, jsx_runtime_1.jsx)("div", { className: "max-h-[60vh] overflow-auto rounded border border-white/6 bg-black/10 p-3", children: (0, jsx_runtime_1.jsx)("div", { dangerouslySetInnerHTML: { __html: previewHtml } }) }), (0, jsx_runtime_1.jsxs)("div", { className: "flex justify-end gap-2", children: [(0, jsx_runtime_1.jsx)(Button_1.default, { variant: "primary", onClick: () => {
                                            const w = window.open("", "_blank");
                                            if (!w)
                                                return;
                                            w.document.write(previewHtml);
                                            w.document.close();
                                            setTimeout(() => w.print(), 250);
                                        }, children: "Print" }), (0, jsx_runtime_1.jsx)(Button_1.default, { variant: "secondary", onClick: () => setShowPreviewModal(false), children: "Close" })] })] }) }), (0, jsx_runtime_1.jsx)(Modal_1.default, { title: "Report Details", open: showDetailModal, onClose: () => {
                        setShowDetailModal(false);
                        setDetailReport(null);
                    }, children: detailReport ? ((0, jsx_runtime_1.jsxs)("div", { className: "space-y-3 text-sm text-slate-200", children: [(0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Date:" }), " ", new Date(detailReport.date).toLocaleDateString(), " - ", (0, jsx_runtime_1.jsx)("strong", { children: "Day:" }), " ", detailReport.day] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Attendant:" }), " ", detailReport.user?.name ?? "-", " - ", (0, jsx_runtime_1.jsx)("strong", { children: "Submitted By:" }), " ", detailReport.tasks?.submittedBy ?? "-"] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Marketplace Review:" }), (0, jsx_runtime_1.jsx)("pre", { className: "mt-1 max-h-40 overflow-auto rounded bg-black/20 p-2 text-xs text-slate-300", children: JSON.stringify(detailReport.tasks?.marketplaceReview ?? {}, null, 2) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Categories:" }), (0, jsx_runtime_1.jsxs)("div", { className: "mt-1 text-xs", children: ["New: ", detailReport.tasks?.categories?.newUploads ?? 0, " - Copies:", " ", detailReport.tasks?.categories?.copiesUploaded ?? 0, " - Edited:", " ", detailReport.tasks?.categories?.productsEdited ?? 0] })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsxs)("strong", { children: ["Sales (", Array.isArray(detailReport.tasks?.sales) ? detailReport.tasks.sales.length : 0, "):"] }), Array.isArray(detailReport.tasks?.sales) && detailReport.tasks.sales.length > 0 ? ((0, jsx_runtime_1.jsx)("ul", { className: "mt-1 list-disc pl-5 text-xs", children: detailReport.tasks.sales.map((s, i) => ((0, jsx_runtime_1.jsxs)("li", { children: [s.productName || "-", " - KES ", Number(s.price || 0).toLocaleString(), " ", s.paymentMethod ? ` - ${String(s.paymentMethod)}` : "", " ", s.receiptNumber ? `(#${String(s.receiptNumber)})` : "", " ", s.buyingPrice ? `(buying KES ${Number(s.buyingPrice).toLocaleString()})` : ""] }, i))) })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-xs text-slate-400", children: "No sales recorded" }))] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Customer Comms:" }), (0, jsx_runtime_1.jsx)("pre", { className: "mt-1 max-h-40 overflow-auto rounded bg-black/20 p-2 text-xs text-slate-300", children: JSON.stringify(detailReport.tasks?.customerComms ?? {}, null, 2) })] }), (0, jsx_runtime_1.jsxs)("div", { children: [(0, jsx_runtime_1.jsx)("strong", { children: "Full Tasks JSON:" }), (0, jsx_runtime_1.jsx)("pre", { className: "mt-1 max-h-60 overflow-auto rounded bg-black/20 p-2 text-xs text-slate-300", children: JSON.stringify(detailReport.tasks ?? {}, null, 2) })] })] })) : ((0, jsx_runtime_1.jsx)("div", { className: "text-sm text-slate-300", children: "No report selected." })) }), (0, jsx_runtime_1.jsx)(Modal_1.default, { title: jsonPreview?.title || "Marketplace Review", open: Boolean(jsonPreview), onClose: () => setJsonPreview(null), children: (0, jsx_runtime_1.jsx)("pre", { className: "max-h-80 overflow-auto rounded bg-black/20 p-3 text-xs text-slate-200", children: JSON.stringify(jsonPreview?.payload ?? {}, null, 2) }) })] }) }));
}
