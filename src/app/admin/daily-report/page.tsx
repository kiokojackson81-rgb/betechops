"use client";

import { useState } from "react";

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

export default function AdminDailyReportPage() {
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [day, setDay] = useState<string>("");
  const [reports, setReports] = useState<Report[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string>("");

  async function fetchReports() {
    setError("");
    const params = new URLSearchParams();
    if (from) params.append("from", from);
    if (to) params.append("to", to);
    if (day) params.append("day", day);
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
    const header = ["Date", "Day", "Attendant", "Products", "Sales", "Tasks"];
    const rows = reports.map((r) => {
      const dateStr   = new Date(r.date).toISOString().split("T")[0];
      const attendant = r.user?.name ?? "";
      return [
        dateStr,
        r.day,
        attendant,
        String(r.productsCount),
        String(r.totalSales),
        JSON.stringify(r.tasks ?? {}),
      ];
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
      <h1 className="text-2xl font-semibold mb-4">Daily Performance Reports</h1>
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
        <div className="flex flex-col">
          <label className="text-sm mb-1">Day of Week</label>
          <select
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="rounded-lg border border-white/10 bg-transparent px-3 py-2"
          >
            <option value="">All</option>
            {DAY_KEYS.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </div>
        <button onClick={fetchReports} className="self-end rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-2">
          Filter
        </button>
        {reports.length > 0 && (
          <button onClick={downloadCsv} className="self-end rounded-xl bg-green-600 hover:bg-green-700 px-4 py-2">
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
              <th className="px-3 py-2 text-left">Day</th>
              <th className="px-3 py-2 text-left">Attendant</th>
              <th className="px-3 py-2 text-right">Products</th>
              <th className="px-3 py-2 text-right">Sales (KES)</th>
              <th className="px-3 py-2 text-left">Tasks</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((r) => (
              <tr key={r.id} className="odd:bg-[#11161e] even:bg-[#0e131b]">
                <td className="px-3 py-2">{new Date(r.date).toLocaleDateString()}</td>
                <td className="px-3 py-2">{r.day}</td>
                <td className="px-3 py-2">{r.user?.name ?? "—"}</td>
                <td className="px-3 py-2 text-right">{r.productsCount}</td>
                <td className="px-3 py-2 text-right">{r.totalSales}</td>
                <td className="px-3 py-2 whitespace-pre-wrap break-all">
                  {r.tasks ? JSON.stringify(r.tasks) : "—"}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-4 text-center text-slate-400">
                  No reports found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
