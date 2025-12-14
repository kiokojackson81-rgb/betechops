"use client";

// This page implements the updated online operations dashboard for attendants.
// It replaces the static sales records call‑to‑action with an interactive
// receipt form (inspired by the daily report page) and computes summary
// statistics such as total receipts, sales, items and a simple commission.

import { useState } from "react";
import Link from "next/link";

/**
 * Type definition for a single receipt entry.
 */
type Receipt = {
  sellingTotal: number;
  receiptNumber: string;
  paymentMethod: "MPESA" | "Cash";
  products: string[];
};

export default function AttendantOnlineOpsPage() {
  // Maintain an array of receipt entries. Start with one empty receipt so
  // attendants have a place to begin inputting data.
  const [receipts, setReceipts] = useState<Receipt[]>([
    { sellingTotal: 0, receiptNumber: "", paymentMethod: "MPESA", products: [""] },
  ]);

  /**
   * Update a given receipt with partial data. This helper spreads the
   * existing receipt object with the provided changes and returns a new
   * array to trigger a re‑render.
   */
  const updateReceipt = (index: number, data: Partial<Receipt>) => {
    setReceipts((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...data } : r))
    );
  };

  /**
   * Append a blank receipt to the receipts array so the attendant can
   * continue logging additional transactions.
   */
  const addReceipt = () => {
    setReceipts((prev) => [
      ...prev,
      { sellingTotal: 0, receiptNumber: "", paymentMethod: "MPESA", products: [""] },
    ]);
  };

  /**
   * Update a single product name within a given receipt. If an attendant
   * edits a product name, this helper returns a new receipts array with
   * the updated string at the correct index.
   */
  const updateProduct = (
    receiptIndex: number,
    productIndex: number,
    value: string
  ) => {
    setReceipts((prev) => {
      const newReceipts = [...prev];
      const products = [...newReceipts[receiptIndex].products];
      products[productIndex] = value;
      newReceipts[receiptIndex] = {
        ...newReceipts[receiptIndex],
        products,
      };
      return newReceipts;
    });
  };

  /**
   * Append a blank product field to the selected receipt. This allows
   * attendants to log multiple items under one receipt.
   */
  const addProduct = (receiptIndex: number) => {
    setReceipts((prev) => {
      const newReceipts = [...prev];
      const products = [...newReceipts[receiptIndex].products, ""];
      newReceipts[receiptIndex] = {
        ...newReceipts[receiptIndex],
        products,
      };
      return newReceipts;
    });
  };

  // Derived totals: compute total sales, number of receipts, total items and
  // a simple commission (2% of sales) to give attendants immediate feedback.
  const totalSales = receipts.reduce((sum, r) => sum + r.sellingTotal, 0);
  const numReceipts = receipts.length;
  const numItems = receipts.reduce(
    (sum, r) => sum + r.products.filter((p) => p.trim() !== "").length,
    0
  );
  const commissionRate = 0.02; // Example commission: 2% of gross sales
  const commission = totalSales * commissionRate;

  return (
    <div className="min-h-screen bg-slate-950 px-4 pb-16 text-slate-50">
      <div className="mx-auto w-full max-w-6xl space-y-8 pt-8">
        {/* Page header */}
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-400">
            Jumia / Kilimall Ops
          </p>
          <h1 className="text-2xl font-semibold">Online sales dashboard</h1>
          <p className="text-sm text-slate-400">
            Record every receipt through the form below. Marketplace statements now
            sync automatically and are reviewed by admins. Only approved entries
            contribute to your commissions.
          </p>
        </header>

        {/* Main grid layout: stats + receipts and earnings summary */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.1fr)]">
          <div className="space-y-4">
            {/* Inline quick stats for the day */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl bg-slate-900 p-4">
                <p className="text-xs uppercase text-slate-400">Receipts</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-400">
                  {numReceipts}
                </p>
              </div>
              <div className="rounded-xl bg-slate-900 p-4">
                <p className="text-xs uppercase text-slate-400">Sales (KES)</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-400">
                  {totalSales.toFixed(0)}
                </p>
              </div>
              <div className="rounded-xl bg-slate-900 p-4">
                <p className="text-xs uppercase text-slate-400">Items</p>
                <p className="mt-1 text-2xl font-semibold text-emerald-400">
                  {numItems}
                </p>
              </div>
            </div>

            {/* Receipt entry form */}
            <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">
                Sales records
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Add each receipt for today
              </h2>

              {receipts.map((receipt, rIndex) => (
                <div
                  key={rIndex}
                  className="mt-4 space-y-3 rounded-xl border border-white/10 bg-slate-950/40 p-4"
                >
                  {/* Top row: selling total, receipt number, payment method */}
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm text-slate-400">
                        Selling total (KES)
                      </label>
                      <input
                        type="number"
                        value={receipt.sellingTotal}
                        onChange={(e) =>
                          updateReceipt(rIndex, {
                            sellingTotal: Number(e.target.value),
                          })
                        }
                        className="mt-1 w-full rounded-lg bg-slate-900 p-2 text-white placeholder-slate-500"
                        placeholder="0"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400">
                        Receipt number (required)
                      </label>
                      <input
                        type="text"
                        value={receipt.receiptNumber}
                        onChange={(e) =>
                          updateReceipt(rIndex, { receiptNumber: e.target.value })
                        }
                        className="mt-1 w-full rounded-lg bg-slate-900 p-2 text-white placeholder-slate-500"
                        placeholder="Required"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400">
                        Payment method
                      </label>
                        <div className="mt-1 flex">
                        {(["MPESA", "Cash"] as const).map((method) => (
                          <button
                            key={method}
                            type="button"
                            onClick={() =>
                              updateReceipt(rIndex, { paymentMethod: method })
                            }
                            className={`flex-1 rounded-lg px-4 py-2 text-sm font-semibold ${
   receipt.paymentMethod === method
     ? "bg-emerald-500 text-black"
                                : "border border-white/10 bg-slate-900 text-slate-300"
                            }`}
                          >
                            {method}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Products list */}
                  <div>
                    <label className="block text-sm text-slate-400">
                      Products in this receipt
                    </label>
                    {receipt.products.map((prod, pIndex) => (
                      <input
                        key={pIndex}
                        type="text"
                        value={prod}
                        onChange={(e) =>
                          updateProduct(rIndex, pIndex, e.target.value)
                        }
                        className="mt-1 w-full rounded-lg bg-slate-900 p-2 text-white placeholder-slate-500"
                        placeholder="Product name"
                      />
                    ))}
                    <button
                      type="button"
                      onClick={() => addProduct(rIndex)}
                      className="mt-2 rounded-full border border-emerald-500 px-4 py-1 text-xs font-semibold text-emerald-500 hover:bg-emerald-500 hover:text-black"
                    >
                      + Add product
                    </button>
                  </div>
                </div>
              ))}

              {/* Button to append a new receipt */}
              <button
                type="button"
                onClick={addReceipt}
                className="mt-4 rounded-full border border-emerald-500 px-6 py-2 text-sm font-semibold text-emerald-500 hover:bg-emerald-500 hover:text-black"
              >
                + Add receipt
              </button>
            </section>
          </div>
          {/* Earnings summary column */}
          <div>
            <div className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-400">
                Earnings summary
              </p>
              <h3 className="mt-2 text-xl font-semibold text-white">Net pay</h3>
              <div className="mt-4 space-y-2 text-sm text-slate-300">
                <p>
                  Total sales: KES {totalSales.toFixed(0)}
                </p>
                <p>
                  Commission ({(commissionRate * 100).toFixed(0)}%): KES {commission.toFixed(0)}
                </p>
                <p className="text-emerald-400">
                  Net pay: KES {(totalSales + commission).toFixed(0)}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Links to other tools for convenience */}
        <div className="mt-8 flex flex-wrap gap-2">
          <Link
            href="/attendant/daily-report"
            className="rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-black hover:brightness-95"
          >
            Open daily report
          </Link>
          <Link
            href="/admin/online/manual"
            className="rounded-full border border-white/20 px-5 py-2 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Admin desk
          </Link>
        </div>
      </div>
    </div>
  );
}
