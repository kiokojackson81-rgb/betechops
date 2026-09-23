"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AttendantCommissionSummary } from "@/lib/attendantCommission";
const money = (value: number) => `KSh ${Number(value).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export default function EmployeeSalesAudit({ periodKey, impersonateId }: { periodKey: string; impersonateId?: string | null }) {
  const [summary, setSummary] = useState<AttendantCommissionSummary | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const activeRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    const { signal } = controller;
    setLoading(true);
    try {
      const params = new URLSearchParams({ periodKey });
      if (impersonateId) params.set("impersonateId", impersonateId);
      const response = await fetch(`/api/attendant/sales-breakdown?${params}`, { cache: "no-store", signal });
      if (!response.ok) throw new Error("Unable to load the sales breakdown. Please retry.");
      const payload = await response.json();
      if (!Array.isArray(payload.receiptBreakdown)) throw new Error("Sales data is incomplete. Please refresh.");
      if (!signal?.aborted) { setSummary(payload); setError(""); }
    } catch (cause) { if (!signal?.aborted) { setSummary(null); setError(cause instanceof Error ? cause.message : "Unable to load sales"); } }
    finally { if (!signal?.aborted) setLoading(false); }
  }, [periodKey, impersonateId]);
  useEffect(() => {
    setSummary(null);
    const reload = () => void refresh();
    reload();
    window.addEventListener("focus", reload);
    const timer = window.setInterval(reload, 60000);
    return () => { activeRequest.current?.abort(); window.removeEventListener("focus", reload); window.clearInterval(timer); };
  }, [refresh]);
  return <section className="rounded-2xl border border-slate-700 bg-slate-950 p-4 text-slate-100">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Sales and commission breakdown</h2><button type="button" disabled={loading} onClick={() => void refresh()} className="rounded-lg border border-slate-500 px-4 py-2 disabled:opacity-50">{loading ? "Refreshing…" : "Refresh figures"}</button></div>
    <p className="mt-2 text-sm text-slate-300">Reporting dates use Nairobi time. Pending receipts remain visible; only eligible sales contribute to commission.</p>
    {error && <p role="alert" className="mt-3 text-red-300">{error}</p>}
    {summary && <><dl className="my-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[["Recorded receipt value", summary.recordedSales], ["Commission-eligible sales", summary.commissionEligibleSales], ["Eligible profit", summary.totalProfit], ["Total commission", summary.totalCommission]].map(([label, value]) => <div key={String(label)}><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 font-semibold">{money(Number(value))}</dd></div>)}</dl>
    <p className="mb-3 text-sm text-slate-300">Direct sales: {money(summary.directSalesCommission)} · Product commissions: {money(summary.posProductCommission)} · Marketplace: {money(summary.marketplaceCommission)} · Upload activity: {money(summary.newProductCommission + summary.copiedCommission + summary.editedCommission)} · Adjustments: {money(summary.commissionTopUpTotal)}</p>
    <details><summary className="cursor-pointer py-3 font-semibold">View each receipt ({summary.receiptBreakdown.length})</summary><p className="mb-3 text-sm text-slate-400">Direct commission contributions are calculated in reporting-date order using the configured period tiers. Their sum equals direct sales commission.</p><div className="overflow-x-auto"><table className="w-full min-w-[1000px] whitespace-nowrap text-left text-sm"><thead><tr>{["Receipt / customer", "Reporting date", "Receipt value", "Eligible sales", "Profit", "Direct commission", "Eligibility"].map(label => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{summary.receiptBreakdown.map(row => <tr key={row.receiptId} className="border-t border-slate-800"><td className="p-2">{row.receiptKey}<br/><span className="text-slate-400">{row.customerName}</span></td><td className="p-2">{row.salesDate ? new Date(row.salesDate).toLocaleDateString("en-KE", { timeZone: "Africa/Nairobi" }) : "Pending"}</td><td className="p-2">{money(row.sales)}</td><td className="p-2">{money(row.eligibleSales)}</td><td className="p-2">{row.eligible ? money(row.profit) : "—"}</td><td className="p-2">{money(row.commission ?? 0)}</td><td className="p-2">{row.reason}</td></tr>)}</tbody></table></div></details></>}
  </section>;
}
