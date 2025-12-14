"use client";

import { useMemo, useState } from "react";
import Card from "@/app/_components/Card";
import ReceiptsEditor from "@/app/_components/ReceiptsEditor";
import { showToast } from "@/lib/ui/toast";

type PaymentMethod = "MPESA" | "CASH" | "";

type ReceiptItem = { id: string; productName: string; buyingPrice: number | "" };
type ReceiptRow = {
  id: string;
  receiptNumber: string;
  sellingTotal: number | "";
  paymentMethod: PaymentMethod;
  items: ReceiptItem[];
};

const NEW_RECEIPT = (): ReceiptRow => ({
  id: crypto.randomUUID(),
  receiptNumber: "",
  sellingTotal: "",
  paymentMethod: "MPESA",
  items: [{ id: crypto.randomUUID(), productName: "", buyingPrice: 0 }],
});

export default function OnlineSalesForm() {
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [dayOfWeek, setDayOfWeek] = useState(() =>
    new Date().toLocaleDateString("en-KE", { weekday: "long" }),
  );
  const [receipts, setReceipts] = useState<ReceiptRow[]>([NEW_RECEIPT()]);
  const [submitting, setSubmitting] = useState(false);

  const totals = useMemo(() => {
    return receipts.reduce(
      (acc, receipt) => {
        const sale = Number(receipt.sellingTotal || 0);
        acc.totalSales += sale;
        acc.totalItems += receipt.items.length;
        return acc;
      },
      { totalSales: 0, totalProfit: 0, totalItems: 0 },
    );
  }, [receipts]);

  const resetForm = () => {
    setReceipts([NEW_RECEIPT()]);
    setDate(new Date().toISOString().split("T")[0]);
    setDayOfWeek(new Date().toLocaleDateString("en-KE", { weekday: "long" }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/online/direct-sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, dayOfWeek, receipts }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => null);
        throw new Error(error?.error || "Failed to save sales");
      }
      showToast("Direct sales saved", "success");
      resetForm();
      window.dispatchEvent(new CustomEvent("onlineOps:refresh"));
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save sales", "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="space-y-5 border-slate-800 bg-slate-900/60 p-5 shadow-lg shadow-black/40">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">Direct sales</p>
        <h2 className="text-xl font-semibold">Record walk-in / WhatsApp receipts</h2>
        <p className="text-sm text-slate-400">
          Buying price will be captured later on the pricing tab. Add every receipt so finance can reconcile.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-400">
          Date
          <input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value);
              const next = new Date(e.target.value);
              if (!Number.isNaN(next.getTime())) {
                setDayOfWeek(next.toLocaleDateString("en-KE", { weekday: "long" }));
              }
            }}
            className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          />
        </label>
        <label className="flex flex-col text-xs font-semibold uppercase tracking-wide text-slate-400">
          Day
          <select
            value={dayOfWeek}
            onChange={(e) => setDayOfWeek(e.target.value)}
            className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
          >
            {["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </label>
      </div>

      <ReceiptsEditor receipts={receipts} setReceipts={setReceipts} totals={totals} hideBuyingPrice />

      <div className="flex justify-end">
        <button
          type="button"
          className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95 disabled:opacity-60"
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting ? "Saving…" : "Save today’s sales"}
        </button>
      </div>
    </Card>
  );
}
