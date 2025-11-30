"use client";

import { useState, useEffect } from "react";
import Button from "@/app/_components/Button";
import Card from "@/app/_components/Card";
import Sparkline from "@/app/_components/Sparkline";
import Modal from "@/app/_components/Modal";
import { computeRowStatus } from '@/lib/dailyReportHelpers';
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
}

// Define the days with tasks for drop‑down options.  This mirrors the keys
// used on the attendant form.  If you change the tasks mapping in the
// attendant page, update this list accordingly.
const DAY_KEYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

// Marketplace shop list used for CSV export and admin table columns
const MARKETPLACE_SHOPS = [
  "Betech Store",
  "JM Collection",
  "Hitech Power",
  "Maxton",
  "Sky Store",
  "Betech Solar",
  "Kilimall",
];

export default function AdminDailyReportPage() {
  const [shopFilter, setShopFilter] = useState<string>("");
  const [minComplete, setMinComplete] = useState<number>(0);
  const [sortByCompleteness, setSortByCompleteness] = useState<boolean>(false);
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [day, setDay] = useState<string>("");
  const [submittedBy, setSubmittedBy] = useState<string>("");
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string>("");
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [exportScope, setExportScope] = useState<'page' | 'all' | 'json'>('all');
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string>('');
  const [legendFilters, setLegendFilters] = useState<Array<'complete' | 'partial' | 'missing'>>(['complete','partial','missing']);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailReport, setDetailReport] = useState<Report | null>(null);

  function getFilteredReports() {
    return (reports || []).filter((r) => {
      if (!shopFilter) return true;
      const mr = (r.tasks as any)?.marketplaceReview ?? {};
      const s = mr[shopFilter] || {};
      const checks = [s.stockChecked, s.pricingConfirmed, s.competitorsReviewed, s.oosReviewed];
      const done = checks.filter(Boolean).length;
      return done >= (minComplete || 0);
    }).sort((a, b) => {
      if (!sortByCompleteness) return 0;
      // compare by selected shop completeness (desc)
      const sa = (a.tasks as any)?.marketplaceReview ?? {};
      const sb = (b.tasks as any)?.marketplaceReview ?? {};
      const aa = (sa[shopFilter] || {});
      const bb = (sb[shopFilter] || {});
      const ca = [aa.stockChecked, aa.pricingConfirmed, aa.competitorsReviewed, aa.oosReviewed].filter(Boolean).length;
      const cb = [bb.stockChecked, bb.pricingConfirmed, bb.competitorsReviewed, bb.oosReviewed].filter(Boolean).length;
      return cb - ca;
    });
  }

  // fetch on mount so header KPIs render immediately
  useEffect(() => {
    void fetchReports();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchReports() {
    setError("");
    const params = new URLSearchParams();
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
        // if empty and page>1, step back
        if ((data.reports ?? []).length === 0 && page > 1) setPage(1);
        showToast("Reports loaded", "success");
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
    const marketplaceShops = [
      "Betech Store",
      "JM Collection",
      "Hitech Power",
      "Maxton",
      "Sky Store",
      "Betech Solar",
      "Kilimall",
    ];

    const shopCols: string[] = [];
    for (const shop of marketplaceShops) {
      const safe = shop.replace(/\s+/g, '_');
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
      // keep raw marketplace JSON for compatibility
      "MarketplaceReview",
      // flattened per-shop columns
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
      // include customerComms JSON
      "CustomerComms",
      "Tasks",
    ];
    // safer CSV: quote fields, escape quotes, preserve JSON tasks
    const quote = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
    // filtered + sorted reports for table and CSV export
    const filteredReports = getFilteredReports();

    const csvSource = filteredReports;

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

      // per-shop flattened values
      const mr = (tasks as any).marketplaceReview || {};
      const shopValues: string[] = [];
      for (const shop of marketplaceShops) {
        const s = mr[shop] || {};
        shopValues.push(String(s.stockChecked ? 'Yes' : ''));
        shopValues.push(String(s.pricingConfirmed ? 'Yes' : ''));
        shopValues.push(String(s.competitorsReviewed ? 'Yes' : ''));
        shopValues.push(String(s.oosReviewed ? 'Yes' : ''));
        shopValues.push(String(s.notes ?? ''));
      }

      const cc = (tasks as any).customerComms || {};
      const ccValues = [
        String(cc.walkInServed ?? ''),
        String(cc.onlineServed ?? ''),
        String(cc.callsHandled ?? ''),
        String(cc.whatsappSmsReplied ?? ''),
        String(cc.fbCommentsReplied ?? ''),
        String(cc.fbDmsReplied ?? ''),
        String(cc.igCommentsReplied ?? ''),
        String(cc.igDmsReplied ?? ''),
        String(cc.fbAllCleared ? 'Yes' : ''),
        String(cc.igAllCleared ? 'Yes' : ''),
        String(cc.competitorNotes ?? ''),
        String(cc.improvementSuggestions ?? ''),
      ];

      return [
        dateStr,
        r.day,
        attendant,
        submitted,
        // per-shop flattened columns
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
        // flattened customerComms
        ...ccValues,
        // customerComms JSON
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
    'Date', 'Day', 'Attendant', 'SubmittedBy', 'MarketplaceReview (JSON)',
    // per-shop flattened
    ...MARKETPLACE_SHOPS.flatMap((s) => {
      const safe = s.replace(/\s+/g, '_');
      return [`${safe}_stockChecked`, `${safe}_pricingConfirmed`, `${safe}_competitorsReviewed`, `${safe}_oosReviewed`, `${safe}_notes`];
    }),
    'Products', 'Sales', 'NewUploads', 'CopiesUploaded', 'ProductsEdited',
    'Attended Marketing Meeting', 'Participated In Video Shoot', 'Marketing Videos Posted',
    'WalkInCustomers', 'CustomersPurchased', 'LiveViewers', 'LivePurchases',
    'OfficeCleaned', 'OfficeNotes', 'CustomerComms (JSON)', 'Tasks (JSON)'
  ];

  // Aggregates for currently filtered reports (used in header KPIs and PDF export)
  const filteredReportsForAgg = getFilteredReports();
  const aggNewUploads = filteredReportsForAgg.reduce((sum, r) => sum + ((r.tasks?.categories?.newUploads) ? Number(r.tasks.categories.newUploads) : 0), 0);
  const aggCopies = filteredReportsForAgg.reduce((sum, r) => sum + ((r.tasks?.categories?.copiesUploaded) ? Number(r.tasks.categories.copiesUploaded) : 0), 0);
  const aggEdited = filteredReportsForAgg.reduce((sum, r) => sum + ((r.tasks?.categories?.productsEdited) ? Number(r.tasks.categories.productsEdited) : 0), 0);
  const aggSalesCount = filteredReportsForAgg.reduce((sum, r) => sum + ((Array.isArray(r.tasks?.sales)) ? r.tasks.sales.length : 0), 0);

  function downloadPdf() {
    const rows = filteredReportsForAgg.map((r) => {
      const dateStr = new Date(r.date).toISOString().split('T')[0];
      const attendant = r.user?.name ?? '';
      const submitted = r.tasks?.submittedBy ?? '';
      const products = r.tasks?.categories ?? {};
      const sales = Array.isArray(r.tasks?.sales) ? r.tasks.sales : [];
      return `<tr>
        <td style="padding:6px;border:1px solid #ddd">${dateStr}</td>
        <td style="padding:6px;border:1px solid #ddd">${r.day}</td>
        <td style="padding:6px;border:1px solid #ddd">${attendant}</td>
        <td style="padding:6px;border:1px solid #ddd">${submitted}</td>
        <td style="padding:6px;border:1px solid #ddd">${products.newUploads ?? ''}</td>
        <td style="padding:6px;border:1px solid #ddd">${products.copiesUploaded ?? ''}</td>
        <td style="padding:6px;border:1px solid #ddd">${products.productsEdited ?? ''}</td>
        <td style="padding:6px;border:1px solid #ddd">${sales.length}</td>
      </tr>`;
    }).join('');

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
          <h2>Daily Reports — Export</h2>
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

    const w = window.open('', '_blank', 'noopener');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.print(); }, 350);
  }

  // New: generate HTML for chosen scope and optionally include JSON block
  function generateExportHtml(scope: 'page' | 'all' | 'json') {
    let sourceReports: Report[] = [];
    if (scope === 'page') {
      sourceReports = reports; // current page
    } else if (scope === 'all' || scope === 'json') {
      sourceReports = filteredReportsForAgg; // all filtered
    }

    const marketplaceShops = MARKETPLACE_SHOPS;

    const rows = sourceReports.map((r) => {
      const dateStr = new Date(r.date).toISOString().split('T')[0];
      const attendant = r.user?.name ?? '';
      const submitted = r.tasks?.submittedBy ?? '';
      // flattened per-shop columns
      const mr = (r.tasks as any)?.marketplaceReview || {};
      const shopVals = marketplaceShops.map((s) => {
        const v = mr[s] || {};
        return `<td style="padding:6px;border:1px solid #ddd">${v.stockChecked ? 'Yes' : ''}</td>
                <td style="padding:6px;border:1px solid #ddd">${v.pricingConfirmed ? 'Yes' : ''}</td>
                <td style="padding:6px;border:1px solid #ddd">${v.competitorsReviewed ? 'Yes' : ''}</td>
                <td style="padding:6px;border:1px solid #ddd">${v.oosReviewed ? 'Yes' : ''}</td>`;
      }).join('');

      return `<tr>
        <td style="padding:6px;border:1px solid #ddd">${dateStr}</td>
        <td style="padding:6px;border:1px solid #ddd">${r.day}</td>
        <td style="padding:6px;border:1px solid #ddd">${attendant}</td>
        <td style="padding:6px;border:1px solid #ddd">${submitted}</td>
        ${shopVals}
      </tr>`;
    }).join('');

    const shopHeaderCells = MARKETPLACE_SHOPS.map((s) => `<th colspan="4" style="padding:6px;border:1px solid #ddd">${s}</th>`).join('');

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
          <h2>Daily Reports — Export (${scope})</h2>
          <p>Exported ${sourceReports.length} reports</p>
          <table>
            <thead>
              <tr>
                <th rowspan="2">Date</th><th rowspan="2">Day</th><th rowspan="2">Attendant</th><th rowspan="2">SubmittedBy</th>
                ${shopHeaderCells}
              </tr>
              <tr>
                ${MARKETPLACE_SHOPS.map(() => '<th>Stock</th><th>Pricing</th><th>Comp</th><th>OOS</th>').join('')}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
          ${scope === 'json' ? `<h3>Full JSON</h3><pre class="json">${JSON.stringify(sourceReports.map(r=>({ id:r.id,date:r.date,day:r.day,tasks:r.tasks,user:r.user })), null, 2)}</pre>` : ''}
        </body>
      </html>`;

    return html;
  }

  function openPreview(scope: 'page'|'all'|'json'){
    const html = generateExportHtml(scope);
    setPreviewHtml(html);
    setShowPreviewModal(true);
  }

  async function downloadServerPdf(scope: 'page'|'all'|'json'){
    const params = new URLSearchParams();
    if (from) params.append('from', from);
    if (to) params.append('to', to);
    if (day) params.append('day', day);
    if (submittedBy) params.append('user', submittedBy);
    if (shopFilter) params.append('shop', shopFilter);
    if (scope === 'json') params.append('includeJson', '1');
    params.append('scope', scope);
    const url = `/api/daily-report/export/pdf?${params.toString()}`;
    const w = window.open(url, '_blank');
    if (!w) showToast('Unable to open PDF in a new tab', 'error');
  }

  function renderShopBadges(s: any) {
    // s: marketplace shop object with boolean flags
    const present = Boolean(s && Object.keys(s).length > 0);
    if (!present) return <div className="text-slate-400">—</div>;
    const IconCheck = () => (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block mr-1">
        <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
    const IconX = () => (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="inline-block mr-1">
        <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );

    const badge = (label: string, ok: boolean, key: string) => (
      <span key={key} title={label + (ok ? ': Yes' : ': No')} className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold mr-1 ${ok ? 'bg-status-complete text-black' : 'bg-status-missing text-white'}`}>
        {ok ? <IconCheck /> : <IconX />}{label}
      </span>
    );
    return (
      <div>
        <div className="mb-1">
          {badge('Stock', Boolean(s.stockChecked), 'stock')}
          {badge('Pricing', Boolean(s.pricingConfirmed), 'pricing')}
          {badge('Competitors', Boolean(s.competitorsReviewed), 'comp')}
          {badge('OOS', Boolean(s.oosReviewed), 'oos')}
        </div>
        {s.notes ? <div className="text-xs text-slate-400 truncate max-w-[12rem]">{String(s.notes)}</div> : null}
      </div>
    );
  }

  // computeRowStatus moved to `src/lib/dailyReportHelpers.ts` for reuse and testing

  return (
    <div className="mx-auto max-w-8xl p-6 text-slate-100">
      <div className="flex items-start gap-6 mb-6">
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Daily Performance Reports</h1>
          <p className="text-sm text-slate-400 mt-1">Team submissions, marketplace checks, and operational notes — at a glance.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <div className="text-xs text-slate-400">Total products</div>
            <div className="text-lg font-semibold">{summary ? summary.totalProducts : '—'}</div>
          </div>
          <div className="text-right ml-4">
            <div className="text-xs text-slate-400">Total sales (KES)</div>
            <div className="text-lg font-semibold">{summary ? Number(summary.totalSales).toLocaleString() : '—'}</div>
          </div>
          <div className="ml-6 flex items-center gap-3">
            <div className="text-sm text-slate-300 text-right">
              <div>New uploads: <strong className="text-white">{aggNewUploads}</strong></div>
              <div>Copies: <strong className="text-white">{aggCopies}</strong></div>
              <div>Edited: <strong className="text-white">{aggEdited}</strong></div>
              <div>Sales Count: <strong className="text-white">{aggSalesCount}</strong></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center bg-[rgba(255,255,255,0.02)] rounded-md p-1">
                <button onClick={() => setExportScope('page')} className={`px-3 py-1 rounded ${exportScope === 'page' ? 'bg-white/8 ring-1 ring-white/10' : ''}`}>Current page</button>
                <button onClick={() => setExportScope('all')} className={`px-3 py-1 rounded ${exportScope === 'all' ? 'bg-white/8 ring-1 ring-white/10' : ''}`}>All filtered</button>
                <button onClick={() => setExportScope('json')} className={`px-3 py-1 rounded ${exportScope === 'json' ? 'bg-white/8 ring-1 ring-white/10' : ''}`}>Full JSON</button>
              </div>
              <Button onClick={() => setShowCsvModal(true)} variant="secondary">CSV columns</Button>
              <Button onClick={downloadCsv} variant="secondary">Download CSV</Button>
              <Button onClick={() => openPreview(exportScope)} variant="muted">Preview</Button>
              <Button onClick={() => downloadServerPdf(exportScope)} variant="primary">Download PDF</Button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6">
        {/* Left: filters */}
        <aside className="col-span-3 bg-[rgba(255,255,255,0.02)] border border-white/6 rounded-lg p-4 space-y-4">
          <div className="text-sm font-medium mb-2">Filters</div>
          <div>
            <label className="text-xs text-slate-400">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full rounded px-2 py-1 mt-1 bg-transparent border border-white/10 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-full rounded px-2 py-1 mt-1 bg-transparent border border-white/10 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Day</label>
            <select value={day} onChange={(e) => setDay(e.target.value)} className="w-full rounded px-2 py-1 mt-1 bg-transparent border border-white/10 text-sm">
              <option value="">All</option>
              {DAY_KEYS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Submitted by</label>
            <input type="text" value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)} placeholder="Name or email" className="w-full rounded px-2 py-1 mt-1 bg-transparent border border-white/10 text-sm" />
          </div>
          <div>
            <label className="text-xs text-slate-400">Filter shop</label>
            <select value={shopFilter} onChange={(e) => setShopFilter(e.target.value)} className="w-full rounded px-2 py-1 mt-1 bg-transparent border border-white/10 text-sm">
              <option value="">All shops</option>
              {MARKETPLACE_SHOPS.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400">Min checks</label>
            <select value={String(minComplete)} onChange={(e) => setMinComplete(Number(e.target.value))} className="w-full rounded px-2 py-1 mt-1 bg-transparent border border-white/10 text-sm">
              <option value={0}>0</option>
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
              <option value={4}>4</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => { setPage(1); fetchReports(); }} variant="primary">Apply</Button>
            <Button onClick={() => { window.location.href = `/api/daily-report/export?${new URLSearchParams({ ...(from?{from}:{}), ...(to?{to}:{}), ...(day?{day}:{}), ...(submittedBy?{user:submittedBy}:{}) }).toString()}`; }} variant="secondary">Export</Button>
          </div>
          <div className="text-xs text-slate-500 pt-2">Tip: use the CSV export for bulk analysis. New flattened shop columns and Saturday fields are included.</div>
        </aside>

        {/* Main: table */}
        <main className="col-span-9">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => {
                  const s = legendFilters.includes('complete') ? (legendFilters.filter(x => x !== 'complete') as Array<'complete'|'partial'|'missing'>) : ([...legendFilters, 'complete'] as Array<'complete'|'partial'|'missing'>);
                  setLegendFilters(s);
                }} className={`flex items-center gap-2 px-2 py-1 rounded ${legendFilters.includes('complete') ? 'ring-2 ring-white/20' : ''}`}>
                <span className="inline-block w-3 h-3 bg-status-complete rounded-full" />
                <span className="text-xs text-slate-300">Complete</span>
              </button>
              <button onClick={() => {
                  const s = legendFilters.includes('partial') ? (legendFilters.filter(x => x !== 'partial') as Array<'complete'|'partial'|'missing'>) : ([...legendFilters, 'partial'] as Array<'complete'|'partial'|'missing'>);
                  setLegendFilters(s);
                }} className={`flex items-center gap-2 px-2 py-1 rounded ${legendFilters.includes('partial') ? 'ring-2 ring-white/20' : ''}`}>
                <span className="inline-block w-3 h-3 bg-status-partial rounded-full" />
                <span className="text-xs text-slate-300">Partial</span>
              </button>
              <button onClick={() => {
                  const s = legendFilters.includes('missing') ? (legendFilters.filter(x => x !== 'missing') as Array<'complete'|'partial'|'missing'>) : ([...legendFilters, 'missing'] as Array<'complete'|'partial'|'missing'>);
                  setLegendFilters(s);
                }} className={`flex items-center gap-2 px-2 py-1 rounded ${legendFilters.includes('missing') ? 'ring-2 ring-white/20' : ''}`}>
                <span className="inline-block w-3 h-3 bg-status-missing rounded-full" />
                <span className="text-xs text-slate-300">Missing</span>
              </button>
              <button onClick={() => setLegendFilters(['complete','partial','missing'])} className={`flex items-center gap-2 px-2 py-1 rounded ${legendFilters.length === 3 ? 'ring-2 ring-white/20' : ''}`}>
                <span className="inline-block w-3 h-3 bg-status-muted rounded-full" />
                <span className="text-xs text-slate-300">All</span>
              </button>
            </div>
            <div className="text-xs text-slate-400">Showing page {page} — {Math.min((page-1)*pageSize+1, totalCount)} to {Math.min(page*pageSize, totalCount)} of {totalCount}</div>
          </div>

          {error && <p className="text-red-400 mb-4">{error}</p>}
          <div className="overflow-auto border border-white/6 rounded-lg bg-[rgba(255,255,255,0.01)]">
            <table className="min-w-full divide-y divide-white/6 text-sm">
          <thead className="bg-[var(--panel,#121723)]">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Day</th>
              <th className="px-3 py-2 text-left">Attendant</th>
              <th className="px-3 py-2 text-left">Submitted By</th>
              <th className="px-3 py-2 text-left">Marketplace</th>
              <th className="px-3 py-2 text-left">Marketplace (JSON)</th>
              {MARKETPLACE_SHOPS.map((s) => (
                <th key={s} className="px-3 py-2 text-left hidden sm:table-cell">{s}</th>
              ))}
              <th className="px-3 py-2 text-right">Products</th>
              <th className="px-3 py-2 text-right">Sales (KES)</th>
              <th className="px-3 py-2 text-left">Tasks</th>
              <th className="px-3 py-2 text-left">Marketing</th>
              <th className="px-3 py-2 text-left">Customer Ops</th>
              <th className="px-3 py-2 text-left">Office</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => {
              const rowStatus = computeRowStatus(r);
              if (!legendFilters.includes(rowStatus as any)) return null;
              const tasks = r.tasks ?? {};
              const categories = tasks.categories ?? {};
              const marketing = tasks.marketing ?? {};
              const customerOps = tasks.customerOperations ?? {};
              const office = tasks.officeMaintenance ?? {};
              return (
                <tr key={r.id} className="odd:bg-[#11161e] even:bg-[#0e131b]">
                  <td className="px-3 py-2">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="px-3 py-2">{r.day}</td>
                  <td className="px-3 py-2">{r.user?.name ?? "—"}</td>
                  <td className="px-3 py-2">{r.tasks?.submittedBy ?? "—"}</td>
                  <td className="px-3 py-2">
                    {(() => {
                      const mr = r.tasks?.marketplaceReview ?? {};
                      const shops = Object.keys(mr || {});
                      if (!shops || shops.length === 0) return <span className="text-slate-400">—</span>;
                      const complete = shops.filter((k) => {
                        const s = mr[k];
                        return s && s.stockChecked && s.pricingConfirmed && s.competitorsReviewed && s.oosReviewed;
                      }).length;
                      return <span>{complete}/{shops.length} shops complete</span>;
                    })()}
                  </td>
                  <td className="px-3 py-2">
                    <pre className="text-xs whitespace-pre-wrap max-w-[28rem] max-h-28 overflow-auto bg-black/20 p-2 rounded">{JSON.stringify((r.tasks as any)?.marketplaceReview ?? {}, null, 0)}</pre>
                  </td>
                  {MARKETPLACE_SHOPS.map((shop) => {
                    const mr = (r.tasks as any)?.marketplaceReview ?? {};
                    const s = mr[shop] || {};
                    return (
                      <td key={shop} className="px-3 py-2 text-sm hidden sm:table-cell" title={String(s.notes ?? '') || undefined}>
                        {renderShopBadges(s)}
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right">{r.productsCount}</td>
                  <td className="px-3 py-2 text-right">{Number(r.totalSales).toLocaleString()}</td>
                  <td className="px-3 py-2">
                    <div className="text-sm mb-1">
                      <strong>Categories:</strong>{' '}
                      {categories ? (
                        <span>
                          New: {categories.newUploads ?? 0} • Copies: {categories.copiesUploaded ?? 0} • Edited: {categories.productsEdited ?? 0}
                        </span>
                      ) : (
                        <span>—</span>
                      )}
                    </div>
                    <div className="text-sm">
                      <strong>Sales:</strong>
                      {Array.isArray(tasks.sales) && tasks.sales.length > 0 ? (
                        <ul className="list-disc pl-5 text-xs mt-1">
                          {tasks.sales.map((s: any, i: number) => (
                            <li key={i}>{s.productName || '—'} — KES {Number(s.price || 0).toLocaleString()} {s.paymentMethod ? `• ${String(s.paymentMethod)}` : ''} {s.receiptNumber ? `(#${String(s.receiptNumber)})` : ''}</li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-xs text-slate-400">No sales recorded</div>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <div>Video Shoot: {marketing.participatedVideoShoot ? 'Yes' : 'No'}</div>
                    <div>Marketing Meeting: {marketing.attendedMarketingMeeting ? 'Yes' : 'No'}</div>
                    <div>Videos Shot: {marketing.marketingVideosShot ?? 0}</div>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <div>Walk-ins: {customerOps.walkInCustomers ?? 0}</div>
                    <div>Customers Purchased: {customerOps.customersPurchased ?? 0}</div>
                    <div>Live Viewers: {customerOps.liveViewers ?? 0}</div>
                    <div>Live Purchases: {customerOps.livePurchases ?? 0}</div>
                  </td>
                  <td className="px-3 py-2 text-sm">
                    <div>Cleaned: {office.officeCleaned ? 'Yes' : 'No'}</div>
                    <div className="text-xs text-slate-400">{office.officeNotes ?? ''}</div>
                    <div className="mt-2">
                      <Button onClick={() => { setDetailReport(r); setShowDetailModal(true); }} variant="secondary">View</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {reports.length === 0 && (
              <tr>
                <td colSpan={10} className="px-3 py-4 text-center text-slate-400">
                  No reports found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
          <div className="mt-3 flex items-center justify-between">
            <div className="flex gap-2">
              <Button onClick={() => { if (page>1) { setPage(page-1); fetchReports(); } }} variant="secondary">Prev</Button>
              <Button onClick={() => { const max = Math.max(1, Math.ceil(totalCount / pageSize)); if (page < max) { setPage(page+1); fetchReports(); } }} variant="secondary">Next</Button>
            </div>
            <div className="text-xs text-slate-500">Page size
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded ml-2 border border-white/10 bg-transparent px-2 py-1">
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
          <Modal title="CSV Columns Included" open={showCsvModal} onClose={() => setShowCsvModal(false)}>
            <div className="space-y-2 text-sm text-slate-200">
              <p className="text-slate-300">This export includes the following columns (flattened per-shop columns are named using the shop label):</p>
              <ul className="list-disc pl-5">
                {CSV_COLUMNS.map((c) => <li key={c} className="py-0.5">{c}</li>)}
              </ul>
            </div>
          </Modal>
          <Modal title="Export Preview" open={showPreviewModal} onClose={() => setShowPreviewModal(false)}>
            <div className="space-y-3">
              <div className="text-sm text-slate-300">Preview the export layout below. Use Print to open the browser print dialog.</div>
              <div className="border border-white/6 rounded bg-black/10 p-3 max-h-[60vh] overflow-auto">
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              </div>
              <div className="flex gap-2 justify-end">
                <Button onClick={() => { const w = window.open('', '_blank'); if (!w) return; w.document.write(previewHtml); w.document.close(); setTimeout(() => w.print(), 250); }} variant="primary">Print</Button>
                <Button onClick={() => setShowPreviewModal(false)} variant="secondary">Close</Button>
              </div>
            </div>
          </Modal>
          <Modal title="Report Details" open={showDetailModal} onClose={() => { setShowDetailModal(false); setDetailReport(null); }}>
            {detailReport ? (
              <div className="space-y-3 text-sm">
                <div><strong>Date:</strong> {new Date(detailReport.date).toLocaleDateString()} — <strong>Day:</strong> {detailReport.day}</div>
                <div><strong>Attendant:</strong> {detailReport.user?.name ?? '—'} — <strong>Submitted By:</strong> {detailReport.tasks?.submittedBy ?? '—'}</div>
                <div>
                  <strong>Marketplace Review:</strong>
                  <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-auto bg-black/20 p-2 rounded mt-1">{JSON.stringify(detailReport.tasks?.marketplaceReview ?? {}, null, 2)}</pre>
                </div>
                <div>
                  <strong>Categories:</strong>
                  <div className="text-xs mt-1">New: {detailReport.tasks?.categories?.newUploads ?? 0} • Copies: {detailReport.tasks?.categories?.copiesUploaded ?? 0} • Edited: {detailReport.tasks?.categories?.productsEdited ?? 0}</div>
                </div>
                <div>
                  <strong>Sales ({Array.isArray(detailReport.tasks?.sales) ? detailReport.tasks.sales.length : 0}):</strong>
                      {Array.isArray(detailReport.tasks?.sales) && detailReport.tasks.sales.length > 0 ? (
                        <ul className="list-disc pl-5 text-xs mt-1">
                          {detailReport.tasks.sales.map((s: any, i: number) => (
                            <li key={i}>{s.productName || '—'} — KES {Number(s.price || 0).toLocaleString()} {s.paymentMethod ? `• ${String(s.paymentMethod)}` : ''} {s.receiptNumber ? `(#${String(s.receiptNumber)})` : ''}</li>
                          ))}
                        </ul>
                      ) : <div className="text-xs text-slate-400">No sales recorded</div>}
                </div>
                <div>
                  <strong>Customer Comms:</strong>
                  <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-auto bg-black/20 p-2 rounded mt-1">{JSON.stringify(detailReport.tasks?.customerComms ?? {}, null, 2)}</pre>
                </div>
                <div>
                  <strong>Full Tasks JSON:</strong>
                  <pre className="text-xs whitespace-pre-wrap max-h-60 overflow-auto bg-black/20 p-2 rounded mt-1">{JSON.stringify(detailReport.tasks ?? {}, null, 2)}</pre>
                </div>
              </div>
            ) : (
              <div className="text-sm">No report selected.</div>
            )}
          </Modal>
        </main>
      </div>
    </div>
  );
}

// Sparkline is now provided by `src/app/_components/Sparkline`
