"use client";

import { useState, useEffect } from "react";
import Button from "@/app/_components/Button";
import Card from "@/app/_components/Card";
import Sparkline from "@/app/_components/Sparkline";
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
    const filteredReports = (reports || []).filter((r) => {
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
          <div className="ml-6">
            <Button onClick={downloadCsv} variant="primary">Download CSV</Button>
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
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-emerald-400 rounded-full" />
                <span className="text-xs text-slate-300">Complete</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-amber-400 rounded-full" />
                <span className="text-xs text-slate-300">Partial</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-block w-3 h-3 bg-rose-500 rounded-full" />
                <span className="text-xs text-slate-300">Missing</span>
              </div>
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
                    const checks = [s.stockChecked, s.pricingConfirmed, s.competitorsReviewed, s.oosReviewed];
                    const done = checks.filter(Boolean).length;
                    const notes = String(s.notes ?? "").trim();
                    return (
                      <td key={shop} className="px-3 py-2 text-sm hidden sm:table-cell" title={notes || undefined}>
                        <div className="font-mono">{done}/4</div>
                        {notes ? <div className="text-xs text-slate-400 truncate max-w-[12rem]">{notes}</div> : null}
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
                            <li key={i}>{s.productName || '—'} — KES {Number(s.price || 0).toLocaleString()}</li>
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
        </main>
      </div>
    </div>
  );
}

// Sparkline is now provided by `src/app/_components/Sparkline`
