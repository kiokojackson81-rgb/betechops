"use client";

import { useState } from "react";

export default function DailyReportForm() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState<string>(today);
  const [productsCount, setProductsCount] = useState<string>("");
  const [totalSales, setTotalSales] = useState<string>("");
  const [message, setMessage] = useState<string>("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, productsCount: Number(productsCount), totalSales: Number(totalSales) }),
      });
      if (res.ok) {
        setProductsCount("");
        setTotalSales("");
        setMessage("Report saved successfully.");
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage(data.error || "Failed to save report.");
      }
    } catch {
      setMessage("Failed to save report.");
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Daily Sales Report</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="date" className="block text-sm mb-1">Date</label>
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
          />
        </div>
        <div>
          <label htmlFor="productsCount" className="block text-sm mb-1">Number of Products</label>
          <input
            id="productsCount"
            type="number"
            min={0}
            value={productsCount}
            onChange={(e) => setProductsCount(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
          />
        </div>
        <div>
          <label htmlFor="totalSales" className="block text-sm mb-1">Total Sales (KES)</label>
          <input
            id="totalSales"
            type="number"
            min={0}
            step="0.01"
            value={totalSales}
            onChange={(e) => setTotalSales(e.target.value)}
            className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
          />
        </div>
        <button type="submit" className="rounded-xl bg-sky-600 hover:bg-sky-700 px-4 py-2 font-semibold">Submit Report</button>
        {message && <p className="mt-2 text-sm text-green-400">{message}</p>}
      </form>
    </div>
  );
}
