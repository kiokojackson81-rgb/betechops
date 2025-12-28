
"use client";

import { useEffect, useMemo, useState } from "react";
import Button from "@/app/_components/Button";
import Modal from "@/app/_components/Modal";
import MarkdownRendererClient from "@/components/MarkdownRendererClient";
import { computeRowStatus } from "@/lib/dailyReportHelpers";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";
import { showToast } from "@/lib/ui/toast";

interface Report {
  id: string;
  date: string;
  day: string;
  productsCount: number;
  totalSales: number;
  tasks: any;
  user?: { id: string; name: string | null } | null;
}
interface Summary {
  totalProducts: number;
  totalSales: number;
  totalNewProducts?: number;
  totalProductsEdited?: number;
  totalCopiesUploaded?: number;
  totalWalkInsServed?: number;
  totalPurchasesMade?: number;
  totalLiveSessions?: number;
  totalCommissionEarned?: number;
}

const EMPTY_SUMMARY: Summary = {
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
const pillClasses =
  "rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition";

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTradingRange(date = new Date()) {
  const period = getTradingPeriodFor(date);
  return {
    start: period.start.toISOString().split("T")[0],
    end: period.end.toISOString().split("T")[0],
    label: `${formatShortDate(period.start)} – ${formatShortDate(period.end)}`,
  };
}

export default function AdminDailyReportPage() {
  const [shopFilter, setShopFilter] = useState<string>("");
  const [minComplete, setMinComplete] = useState<number>(0);
  const [sortByCompleteness, setSortByCompleteness] = useState<boolean>(false);
  const [from, setFrom] = useState<string>(() => getTradingRange().start);
  const [to, setTo] = useState<string>(() => getTradingRange().end);
  const [day, setDay] = useState<string>("");
  const [submittedBy, setSubmittedBy] = useState<string>("");
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [exportScope, setExportScope] = useState<"page" | "all" | "json">("all");
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [legendFilters, setLegendFilters] = useState<Array<"complete" | "partial" | "missing">>([
    "complete",
    "partial",
    "missing",
  ]);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailReport, setDetailReport] = useState<Report | null>(null);
  const [jsonPreview, setJsonPreview] = useState<{ title: string; payload: any } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Derived + memoized to keep render lean
  const filteredReports = useMemo(() => {
    return (reports || [])
      .filter((r) => {
        if (!shopFilter) return true;
        const mr = (r.tasks as any)?.marketplaceReview ?? {};
        const s = mr[shopFilter] || {};
        const checks = [s.stockChecked, s.pricingConfirmed, s.competitorsReviewed, s.oosReviewed];
        const done = checks.filter(Boolean).length;
        return done >= (minComplete || 0);
      })
      .sort((a, b) => {
        if (!sortByCompleteness || !shopFilter) return 0;
        const sa = (a.tasks as any)?.marketplaceReview ?? {};
        const sb = (b.tasks as any)?.marketplaceReview ?? {};
        const aa = sa[shopFilter] || {};
        const bb = sb[shopFilter] || {};
        const ca = [aa.stockChecked, aa.pricingConfirmed, aa.competitorsReviewed, aa.oosReviewed].filter(
          Boolean,
        ).length;
        const cb = [bb.stockChecked, bb.pricingConfirmed, bb.competitorsReviewed, bb.oosReviewed].filter(
          Boolean,
        ).length;
        return cb - ca;
      });
  }, [reports, shopFilter, minComplete, sortByCompleteness]);

  const filteredReportsForAgg = filteredReports;

  // Aggregates for KPIs fall back to summary if present
  const agg = useMemo(() => {
    const sum = filteredReportsForAgg.reduce(
      (acc, r) => {
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
      },
      {
        newUploads: 0,
        copiesUploaded: 0,
        productsEdited: 0,
        salesCount: 0,
        walkIns: 0,
        purchases: 0,
        liveSessions: 0,
        commission: 0,
      },
    );

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

  const scopeOptions: { label: string; value: "page" | "all" | "json" }[] = [
    { label: "Current page", value: "page" },
    { label: "All filtered", value: "all" },
    { label: "Full JSON", value: "json" },
  ];
  const legendOptions: { key: "complete" | "partial" | "missing"; label: string }[] = [
    { key: "complete", label: "Complete" },
    { key: "partial", label: "Partial" },
    { key: "missing", label: "Missing" },
  ];

  const tradingRange = getTradingRange();
  const pageStart = totalCount === 0 ? 0 : Math.min((page - 1) * pageSize + 1, totalCount);
  const pageEnd = Math.min(page * pageSize, totalCount);
  const maxPage = Math.max(1, Math.ceil(totalCount / pageSize) || 1);

  useEffect(() => {
    void fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If the admin is impersonating a user via query param, fetch the
  // CommissionLedger for the current trading period and prefer its
  // stored commission value when displaying the KPI. This ensures the
  // admin view shows the authoritative (possibly zero) commission.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const imp = params.get("impersonateId");
    if (!imp) return;

    const dt = new Date();
    const url = `/api/marketing/ledger?impersonateId=${encodeURIComponent(imp)}&date=${dt.toISOString().split("T")[0]}`;
    (async () => {
      try {
        const res = await fetch(url, { method: "GET", credentials: "same-origin" });
        if (!res.ok) return;
        const j = await res.json().catch(() => null);
        const ledger = j?.ledger ?? null;
        if (ledger) {
          const marketingCommission = Number(ledger.detail?.marketing?.commission ?? 0);
          const supportCommission = Number(ledger.detail?.support?.commission ?? 0);
          const net = Number(ledger.netCommission ?? ledger.grossCommission ?? 0);
          const final = marketingCommission + supportCommission || net || 0;
          setSummary((s) =>
            s ? { ...s, totalCommissionEarned: Number(final) } : { ...EMPTY_SUMMARY, totalCommissionEarned: Number(final) },
          );
        }
      } catch (e) {
        // ignore
      }
    })();
  }, []);

  async function fetchReports(opts?: { silent?: boolean }) {
    setError("");
    const params = new URLSearchParams();
    if (typeof window !== "undefined") {
      const imp = new URLSearchParams(window.location.search).get("impersonateId");
      if (imp) params.append("impersonateId", imp);
    }
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    if (day) params.append("day", day);
    if (submittedBy) params.append("user", submittedBy);
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
        if ((data.reports ?? []).length === 0 && page > 1) setPage(1);
        if (!opts?.silent) showToast("Reports loaded", "success");
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to fetch reports.");
        showToast(data.error || "Failed to fetch reports.", "error");
      }
    } catch {
      setError("Failed to fetch reports.");
      showToast("Failed to fetch reports.", "error");
    }
  }

  function downloadCsv() {
    const shopCols: string[] = [];
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
    const quote = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
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
      const mr = (tasks as any).marketplaceReview || {};
      const shopValues: string[] = [];
      for (const shop of MARKETPLACE_SHOPS) {
        const s = mr[shop] || {};
        shopValues.push(String(s.stockChecked ? "Yes" : ""));
        shopValues.push(String(s.pricingConfirmed ? "Yes" : ""));
        shopValues.push(String(s.competitorsReviewed ? "Yes" : ""));
        shopValues.push(String(s.oosReviewed ? "Yes" : ""));
        shopValues.push(String(s.notes ?? ""));
      }

      const cc = (tasks as any).customerComms || {};
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
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => {
      w.print();
    }, 350);
  }

  function generateExportHtml(scope: "page" | "all" | "json") {
    let sourceReports: Report[] = [];
    if (scope === "page") {
      sourceReports = reports;
    } else if (scope === "all" || scope === "json") {
      sourceReports = filteredReportsForAgg;
    }

    const shopHeaderCells = MARKETPLACE_SHOPS.map(
      (s) => `<th colspan="4" style="padding:6px;border:1px solid #ddd">${s}</th>`,
    ).join("");
    const rows = sourceReports
      .map((r) => {
        const dateStr = new Date(r.date).toISOString().split("T")[0];
        const attendant = r.user?.name ?? "";
        const submitted = r.tasks?.submittedBy ?? "";
        const mr = (r.tasks as any)?.marketplaceReview || {};
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
          ${
            scope === "json"
              ? `<h3>Full JSON</h3><pre class="json">${JSON.stringify(
                  sourceReports.map((r) => ({ id: r.id, date: r.date, day: r.day, tasks: r.tasks, user: r.user })),
                  null,
                  2,
                )}</pre>`
              : ""
          }
        </body>
      </html>`;

    return html;
  }

  function openPreview(scope: "page" | "all" | "json") {
    const html = generateExportHtml(scope);
    setPreviewHtml(html);
    setShowPreviewModal(true);
  }

  async function downloadServerPdf(scope: "page" | "all" | "json") {
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    if (day) params.append("day", day);
    if (submittedBy) params.append("user", submittedBy);
    if (shopFilter) params.append("shop", shopFilter);
    if (scope === "json") params.append("includeJson", "1");
    params.append("scope", scope);
    const url = `/api/daily-report/export/pdf?${params.toString()}`;
    const w = window.open(url, "_blank");
    if (!w) showToast("Unable to open PDF in a new tab", "error");
  }

  function renderShopBadges(s: any) {
    const present = Boolean(s && Object.keys(s).length > 0);
    if (!present) return <div className="text-slate-400">-</div>;
    const IconCheck = () => (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-1 inline-block">
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
    const IconX = () => (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="mr-1 inline-block">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

    const badge = (label: string, ok: boolean, key: string) => (
      <span
        key={key}
        title={label + (ok ? ": Yes" : ": No")}
        className={`mr-1 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
          ok ? "bg-status-complete text-black" : "bg-status-missing text-white"
        }`}
      >
        {ok ? <IconCheck /> : <IconX />}
        {label}
      </span>
    );

    return (
      <div>
        <div className="mb-1">
          {badge("Stock", Boolean(s.stockChecked), "stock")}
          {badge("Pricing", Boolean(s.pricingConfirmed), "pricing")}
          {badge("Competitors", Boolean(s.competitorsReviewed), "comp")}
          {badge("OOS", Boolean(s.oosReviewed), "oos")}
        </div>
        {s.notes ? (
          <div className="max-w-[12rem] text-xs text-slate-400">
            <MarkdownRendererClient mdText={String(s.notes)} />
          </div>
        ) : null}
      </div>
    );
  }
  const deleteReport = async (reportId: string) => {
    if (typeof window !== "undefined") {
      const ok = window.confirm("Delete this daily report entry? This action cannot be undone.");
      if (!ok) return;
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
      showToast("Entry deleted", "success");
      await fetchReports({ silent: true });
    } catch (err: any) {
      showToast(err?.message || "Delete failed", "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="min-h-screen bg-[radial-gradient(circle_at_20%_0%,#1d2a5c_0%,transparent_38%),radial-gradient(circle_at_90%_10%,#251147_0%,transparent_32%),linear-gradient(180deg,#070b12,#0a0f1a)] text-white"
    >
      <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
        {/* Hero */}
        <section className={`${shellCard} border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-950 to-black p-6`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Daily Ops</p>
              <h1 className="text-3xl font-semibold tracking-tight">Daily Performance Reports</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Team submissions, marketplace checks, and operational notes—refined for admin review.
              </p>
            </div>
            <div className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100 shadow-[0_0_30px_rgba(52,211,153,0.18)]">
              <div className="text-xs uppercase tracking-wide text-emerald-200">Trading period</div>
              <div className="text-base font-semibold text-emerald-50">{tradingRange.label}</div>
              <div className="text-[11px] text-emerald-200/80">25th to 24th</div>
            </div>
          </div>
        </section>

        {/* KPI grid */}
        <section className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          {kpiCards.map((k) => (
            <div
              key={k.label}
              className={`${shellCard} bg-slate-900/70 p-4 transition hover:-translate-y-0.5 hover:border-white/20`}
            >
              <div className="text-xs uppercase tracking-wide text-slate-400">{k.label}</div>
              <div className="mt-2 text-2xl font-semibold">{k.value}</div>
            </div>
          ))}
        </section>

        {/* Filters */}
        <section className={`${shellCard} p-4`}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="grid w-full gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs text-slate-400">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Day</label>
                <select
                  value={day}
                  onChange={(e) => setDay(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  <option value="">Any</option>
                  {DAY_KEYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Submitted by</label>
                <input
                  type="text"
                  value={submittedBy}
                  onChange={(e) => setSubmittedBy(e.target.value)}
                  placeholder="Name or ID"
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400">Marketplace shop focus</label>
                <select
                  value={shopFilter}
                  onChange={(e) => setShopFilter(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  <option value="">All shops</option>
                  {MARKETPLACE_SHOPS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400">Min checks done (selected shop)</label>
                <select
                  value={minComplete}
                  onChange={(e) => setMinComplete(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-white"
                >
                  {[0, 1, 2, 3, 4].map((v) => (
                    <option key={v} value={v}>
                      {v}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setSortByCompleteness((prev) => !prev);
                }}
              >
                {sortByCompleteness ? "Sorted by completeness" : "Sort by completeness"}
              </Button>
              <Button
                variant="primary"
                onClick={() => {
                  setPage(1);
                  void fetchReports();
                }}
              >
                Apply filters
              </Button>
              <Button
                variant="muted"
                onClick={() => {
                  const params = new URLSearchParams({
                    ...(from ? { from } : {}),
                    ...(to ? { to } : {}),
                    ...(day ? { day } : {}),
                    ...(submittedBy ? { user: submittedBy } : {}),
                  });
                  window.location.href = `/api/daily-report/export${params.toString() ? `?${params.toString()}` : ""}`;
                }}
              >
                Quick export
              </Button>
            </div>
          </div>
        </section>
        {/* Export + legend */}
        <section className={`${shellCard} flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between`}>
          <div className="flex flex-wrap gap-2">
            {scopeOptions.map((scope) => (
              <button
                key={scope.value}
                type="button"
                onClick={() => setExportScope(scope.value)}
                className={`${pillClasses} ${
                  exportScope === scope.value
                    ? "border-emerald-500 bg-emerald-500 text-black"
                    : "border-slate-700 text-slate-200 hover:border-white/40"
                }`}
              >
                {scope.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => setShowCsvModal(true)} variant="secondary">
              CSV columns
            </Button>
            <Button onClick={downloadCsv} variant="secondary">
              Download CSV
            </Button>
            <Button onClick={() => openPreview(exportScope)} variant="muted">
              Preview
            </Button>
            <Button onClick={() => downloadServerPdf(exportScope)} variant="primary">
              Download PDF
            </Button>
          </div>
        </section>

        <section className={`${shellCard} flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between`}>
          <div className="flex flex-wrap gap-2">
            {legendOptions.map((legend) => (
              <button
                key={legend.key}
                type="button"
                onClick={() =>
                  setLegendFilters((prev) =>
                    prev.includes(legend.key)
                      ? (prev.filter((item) => item !== legend.key) as Array<"complete" | "partial" | "missing">)
                      : ([...prev, legend.key] as Array<"complete" | "partial" | "missing">),
                  )
                }
                className={`${pillClasses} ${
                  legendFilters.includes(legend.key)
                    ? "border-emerald-500 bg-emerald-500 text-black"
                    : "border-slate-700 text-slate-200 hover:border-white/40"
                }`}
              >
                {legend.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLegendFilters(["complete", "partial", "missing"])}
              className="rounded-full border border-slate-700 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 hover:border-white/40"
            >
              All statuses
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-300">
            <span>{totalCount ? `Showing ${pageStart} - ${pageEnd} of ${totalCount}` : "No entries yet"}</span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  if (page > 1) {
                    setPage(page - 1);
                    void fetchReports();
                  }
                }}
                disabled={page <= 1}
              >
                Prev
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  if (page < maxPage) {
                    setPage(page + 1);
                    void fetchReports();
                  }
                }}
                disabled={page >= maxPage}
              >
                Next
              </Button>
              <label className="flex items-center gap-2 text-xs">
                Page size
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-lg border border-slate-700 bg-slate-950/80 px-2 py-1 text-xs text-slate-100"
                >
                  {[10, 25, 50, 100].map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-rose-900/50 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}
        {/* Table */}
        <section className="rounded-2xl border border-white/10 bg-slate-950/70 shadow-xl shadow-black/30">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="sticky top-0 z-10 bg-slate-950/90 text-left text-xs uppercase tracking-wide text-slate-400 backdrop-blur">
                <tr>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Day</th>
                  <th className="px-3 py-2">Attendant</th>
                  <th className="px-3 py-2">Submitted By</th>
                  <th className="px-3 py-2">Marketplace</th>
                  <th className="px-3 py-2">Marketplace JSON</th>
                  {MARKETPLACE_SHOPS.map((s) => (
                    <th key={s} className="hidden px-3 py-2 text-left sm:table-cell">
                      {s}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right">Products</th>
                  <th className="px-3 py-2 text-right">Sales (KES)</th>
                  <th className="px-3 py-2">Tasks</th>
                  <th className="px-3 py-2">Marketing</th>
                  <th className="px-3 py-2">Customer Ops</th>
                  <th className="px-3 py-2">Office</th>
                  <th className="px-3 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {reports.length === 0 ? (
                  <tr>
                    <td colSpan={MARKETPLACE_SHOPS.length + 13} className="px-3 py-6 text-center text-slate-400">
                      No reports found
                    </td>
                  </tr>
                ) : (
                  reports.map((r, idx) => {
                    const rowStatus = computeRowStatus(r);
                    if (!legendFilters.includes(rowStatus as any)) return null;
                    const tasks = r.tasks ?? {};
                    const categories = tasks.categories ?? {};
                    const marketing = tasks.marketing ?? {};
                    const customerOps = tasks.customerOperations ?? {};
                    const office = tasks.officeMaintenance ?? {};
                    const rowClass = idx % 2 === 0 ? "bg-slate-950/40" : "bg-slate-900/40";
                    return (
                      <tr key={r.id} className={`border-t border-slate-800 ${rowClass}`}>
                        <td className="px-3 py-2 text-slate-200">{new Date(r.date).toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-slate-200">{r.day}</td>
                        <td className="px-3 py-2 text-slate-200">{r.user?.name ?? "-"}</td>
                        <td className="px-3 py-2 text-slate-200">{r.tasks?.submittedBy ?? "-"}</td>
                        <td className="px-3 py-2 text-slate-200">
                          {(() => {
                            const mr = r.tasks?.marketplaceReview ?? {};
                            const shops = Object.keys(mr || {});
                            if (!shops || shops.length === 0) return <span className="text-slate-500">-</span>;
                            const complete = shops.filter((k) => {
                              const s = mr[k];
                              return s && s.stockChecked && s.pricingConfirmed && s.competitorsReviewed && s.oosReviewed;
                            }).length;
                            return <span className="text-sm font-medium text-white">{complete}/{shops.length} shops complete</span>;
                          })()}
                        </td>
                        <td className="px-3 py-2 text-slate-200">
                          <button
                            type="button"
                            className="text-xs text-sky-300 underline hover:text-sky-200"
                            onClick={() =>
                              setJsonPreview({
                                title: `${new Date(r.date).toLocaleDateString()} marketplace review`,
                                payload: (r.tasks as any)?.marketplaceReview ?? {},
                              })
                            }
                          >
                            View JSON
                          </button>
                        </td>
                        {MARKETPLACE_SHOPS.map((shop) => {
                          const mr = (r.tasks as any)?.marketplaceReview ?? {};
                          const shopData = mr[shop] || {};
                          return (
                            <td key={shop} className="hidden px-3 py-2 text-sm sm:table-cell" title={String(shopData.notes ?? "") || undefined}>
                              {renderShopBadges(shopData)}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right text-white">{r.productsCount}</td>
                        <td className="px-3 py-2 text-right text-white">{Number(r.totalSales).toLocaleString()}</td>
                        <td className="px-3 py-2 text-slate-200">
                          <div className="text-sm">
                            <div className="font-semibold">Receipts: {Array.isArray(tasks.sales) ? tasks.sales.length : 0}</div>
                            <div className="text-xs text-slate-400">
                              New: {categories.newUploads ?? 0} · Copies: {categories.copiesUploaded ?? 0} · Edited: {categories.productsEdited ?? 0}
                            </div>
                            {Array.isArray(tasks.sales) && tasks.sales.length > 0 ? (
                              <ul className="mt-2 list-disc pl-5 text-xs text-slate-300">
                                {tasks.sales.map((sale: any, saleIdx: number) => (
                                  <li key={saleIdx}>
                                    {sale.productName || "-"} - KES {Number(sale.price || 0).toLocaleString()}
                                    {sale.paymentMethod ? ` - ${String(sale.paymentMethod)}` : ""}
                                    {sale.receiptNumber ? ` (#${String(sale.receiptNumber)})` : ""}
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <div className="text-xs text-slate-500">No sales recorded</div>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-200">
                          <div>Video Shoot: {marketing.participatedVideoShoot ? "Yes" : "No"}</div>
                          <div>Marketing Meeting: {marketing.attendedMarketingMeeting ? "Yes" : "No"}</div>
                          <div>Videos Shot: {marketing.marketingVideosShot ?? 0}</div>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-200">
                          <div>Walk-ins: {customerOps.walkInCustomers ?? 0}</div>
                          <div>Customers Purchased: {customerOps.customersPurchased ?? 0}</div>
                          <div>Live Viewers: {customerOps.liveViewers ?? 0}</div>
                          <div>Live Purchases: {customerOps.livePurchases ?? 0}</div>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-200">
                          <div>Cleaned: {office.officeCleaned ? "Yes" : "No"}</div>
                          <div className="text-xs text-slate-400">{office.officeNotes ?? ""}</div>
                          <button
                            type="button"
                            className="mt-2 text-xs text-emerald-300 underline hover:text-emerald-200"
                            onClick={() => {
                              setDetailReport(r);
                              setShowDetailModal(true);
                            }}
                          >
                            View details
                          </button>
                        </td>
                        <td className="px-3 py-2 text-sm text-slate-200">
                          <button
                            type="button"
                            onClick={() => deleteReport(r.id)}
                            disabled={deletingId === r.id}
                            className="text-xs text-rose-400 underline hover:text-rose-300 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {deletingId === r.id ? "Deleting..." : "Delete"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
        {/* Modals */}
        <Modal title="CSV Columns Included" open={showCsvModal} onClose={() => setShowCsvModal(false)}>
          <div className="space-y-2 text-sm text-slate-200">
            <p className="text-slate-300">
              This export includes the following columns (flattened per-shop columns are named using the shop label):
            </p>
            <ul className="list-disc pl-5">
              {CSV_COLUMNS.map((c) => (
                <li key={c} className="py-0.5">
                  {c}
                </li>
              ))}
            </ul>
          </div>
        </Modal>

        <Modal title="Export Preview" open={showPreviewModal} onClose={() => setShowPreviewModal(false)}>
          <div className="space-y-3">
            <div className="text-sm text-slate-300">Preview the export layout below. Use Print to open the browser print dialog.</div>
            <div className="max-h-[60vh] overflow-auto rounded border border-white/6 bg-black/10 p-3">
              <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="primary"
                onClick={() => {
                  const w = window.open("", "_blank");
                  if (!w) return;
                  w.document.write(previewHtml);
                  w.document.close();
                  setTimeout(() => w.print(), 250);
                }}
              >
                Print
              </Button>
              <Button variant="secondary" onClick={() => setShowPreviewModal(false)}>
                Close
              </Button>
            </div>
          </div>
        </Modal>

        <Modal
          title="Report Details"
          open={showDetailModal}
          onClose={() => {
            setShowDetailModal(false);
            setDetailReport(null);
          }}
        >
          {detailReport ? (
            <div className="space-y-3 text-sm text-slate-200">
              <div>
                <strong>Date:</strong> {new Date(detailReport.date).toLocaleDateString()} - <strong>Day:</strong>{" "}
                {detailReport.day}
              </div>
              <div>
                <strong>Attendant:</strong> {detailReport.user?.name ?? "-"} - <strong>Submitted By:</strong>{" "}
                {detailReport.tasks?.submittedBy ?? "-"}
              </div>
              <div>
                <strong>Marketplace Review:</strong>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/20 p-2 text-xs text-slate-300">
                  {JSON.stringify(detailReport.tasks?.marketplaceReview ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <strong>Categories:</strong>
                <div className="mt-1 text-xs">
                  New: {detailReport.tasks?.categories?.newUploads ?? 0} - Copies:{" "}
                  {detailReport.tasks?.categories?.copiesUploaded ?? 0} - Edited:{" "}
                  {detailReport.tasks?.categories?.productsEdited ?? 0}
                </div>
              </div>
              <div>
                <strong>
                  Sales ({Array.isArray(detailReport.tasks?.sales) ? detailReport.tasks.sales.length : 0}):
                </strong>
                {Array.isArray(detailReport.tasks?.sales) && detailReport.tasks.sales.length > 0 ? (
                  <ul className="mt-1 list-disc pl-5 text-xs">
                    {detailReport.tasks.sales.map((s: any, i: number) => (
                      <li key={i}>
                        {s.productName || "-"} - KES {Number(s.price || 0).toLocaleString()} {s.paymentMethod ? ` - ${String(s.paymentMethod)}` : ""} {s.receiptNumber ? `(#${String(s.receiptNumber)})` : ""} {s.buyingPrice ? `(buying KES ${Number(s.buyingPrice).toLocaleString()})` : ""}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-xs text-slate-400">No sales recorded</div>
                )}
              </div>
              <div>
                <strong>Customer Comms:</strong>
                <pre className="mt-1 max-h-40 overflow-auto rounded bg-black/20 p-2 text-xs text-slate-300">
                  {JSON.stringify(detailReport.tasks?.customerComms ?? {}, null, 2)}
                </pre>
              </div>
              <div>
                <strong>Full Tasks JSON:</strong>
                <pre className="mt-1 max-h-60 overflow-auto rounded bg-black/20 p-2 text-xs text-slate-300">
                  {JSON.stringify(detailReport.tasks ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-sm text-slate-300">No report selected.</div>
          )}
        </Modal>

        <Modal
          title={jsonPreview?.title || "Marketplace Review"}
          open={Boolean(jsonPreview)}
          onClose={() => setJsonPreview(null)}
        >
          <pre className="max-h-80 overflow-auto rounded bg-black/20 p-3 text-xs text-slate-200">
            {JSON.stringify(jsonPreview?.payload ?? {}, null, 2)}
          </pre>
        </Modal>
      </main>
    </div>
  );
}
