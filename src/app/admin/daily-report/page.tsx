"use client";

import { useState } from "react";

interface Report {
  id: string;
  date: string;
  productsCount: number;
  totalSales: number;
  user?: { id: string; name: string | null } | null;
}
interface Summary {
  totalProducts: number;
  totalSales: number;
}

export default function AdminDailyReportPage() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string>("");

  async function fetchReports() {
    setError("");
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to)   params.append("to", to);
    const url = `/api/daily-report${params.toString() ? "?" + params.toString() : ""}`;
    try {
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReports(data.reports ?? []);
        setSummary(data.summary ?? null);
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Failed to fetch reports.");
      }
    } catch {
      setError("Failed to fetch reports.");
    }
  }

  function downloadCsv() {
    const header = ["Date", "Attendant", "Products Count", "Total Sales"];
    const rows = reports.map((r) => {
      const dateStr   = new Date(r.date).toISOString().split("T")[0];
      const attendant = r.user?.name ?? "";
      return [dateStr, attendant, String(r.productsCount), String(r.totalSales)];
    });
    const csv = [header, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", "daily_reports.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="mx-auto max-w-7xl p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Daily Sales Reports</h1>
      <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <div className="flex flex-col">
          <label className="text-sm mb-1">From</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-white/10 bg-transparent px-3 py-2"
          />
        </div>
        <div className="flex flex-col">
          <label className="text-sm mb-1">To</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-white/10 bg-transparent px-3 py-2"
          />
        </div>
        <button onClick={fetchReports} className="rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-2 self-end">
          Filter
        </button>
        {reports.length > 0 && (
          <button onClick={downloadCsv} className="rounded-xl bg-green-600 hover:bg-green-700 px-4 py-2 self-end">
            Download CSV
          </button>
        )}
      </div>
      {summary && (
        <div className="mb-4 space-y-1">
          <p>
            <span className="font-medium">Total Products:</span> {summary.totalProducts}
          </p>
          <p>
            <span className="font-medium">Total Sales:</span> KES {summary.totalSales}
          </p>
        </div>
      )}
      {error && <p className="text-red-400 mb-4">{error}</p>}
      <div className="overflow-auto border border-white/10 rounded-lg">
        <table className="min-w-full divide-y divide-white/10 text-sm">
          <thead className="bg-[var(--panel,#121723)]">
            <tr>
              <th className="px-3 py-2 text-left">Date</th>
              <th className="px-3 py-2 text-left">Attendant</th>
              <th className="px-3 py-2 text-right">Products</th>
              <th className="px-3 py-2 text-right">Sales (KES)</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="odd:bg-[#11161e] even:bg-[#0e131b]">
                <td className="px-3 py-2">{new Date(r.date).toLocaleDateString()}</td>
                <td className="px-3 py-2">{r.user?.name ?? "—"}</td>
                <td className="px-3 py-2 text-right">{r.productsCount}</td>
                <td className="px-3 py-2 text-right">{r.totalSales}</td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-4 text-center text-slate-400">No reports found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
