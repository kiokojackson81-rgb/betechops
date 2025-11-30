/**
 * Polished redesign of the marketing attendant daily report page.
 *
 * This version matches the look and feel of the marketing tracker: dark
 * background, clearly delineated cards, and a modern header with date
 * selectors.  It preserves core functionality such as recording sales
 * receipts, counting product management activities, toggling customer
 * communication tasks, capturing live session details, and taking notes.
 */

"use client";

import { useState } from "react";
import {
  CalendarIcon,
} from "lucide-react";

/**
 * Shared card classes consistent with the tracker UI.  Cards have a
 * translucent dark background, subtle borders, rounded corners and
 * soft shadows.
 */
const cardClasses =
  "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";

// Type definitions for receipts
interface ReceiptItem {
  name: string;
  price: number;
}

interface Receipt {
  sellingTotal: number;
  receiptNumber: string;
  paymentMethod: "MPESA" | "CASH";
  items: ReceiptItem[];
}

export default function DailyReportStyled() {
  // Date and day state
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = weekdays[selectedDate.getDay()];

  // Sales receipts state
  const [receipts, setReceipts] = useState<Receipt[]>([{
    sellingTotal: 0,
    receiptNumber: "",
    paymentMethod: "MPESA",
    items: [],
  }]);

  // Stats counts
  const [newProducts, setNewProducts] = useState(0);
  const [productsEdited, setProductsEdited] = useState(0);
  const [copiesUploaded, setCopiesUploaded] = useState(0);

  // Communications toggles
  const [shopNeat, setShopNeat] = useState(false);
  const [walkInCustomers, setWalkInCustomers] = useState(false);
  const [callsHandled, setCallsHandled] = useState(false);
  const [whatsAppHandled, setWhatsAppHandled] = useState(false);

  // Live session details
  const [liveDuration, setLiveDuration] = useState(0);
  const [livePlatform, setLivePlatform] = useState("Facebook");
  const [liveViewers, setLiveViewers] = useState(0);

  // Notes
  const [notes, setNotes] = useState("");

  // Helpers for receipts
  const addReceipt = () => {
    setReceipts((prev) => [...prev, { sellingTotal: 0, receiptNumber: "", paymentMethod: "MPESA", items: [] }]);
  };
  const removeReceipt = (index: number) => {
    setReceipts((prev) => prev.filter((_, i) => i !== index));
  };
  const updateReceiptField = (rIndex: number, field: keyof Receipt, value: any) => {
    setReceipts((prev) => {
      const copy = [...prev];
      (copy[rIndex] as any)[field] = value;
      return copy;
    });
  };
  const addItemToReceipt = (rIndex: number) => {
    setReceipts((prev) => {
      const copy = [...prev];
      copy[rIndex].items.push({ name: "", price: 0 });
      return copy;
    });
  };
  const removeItemFromReceipt = (rIndex: number, iIndex: number) => {
    setReceipts((prev) => {
      const copy = [...prev];
      copy[rIndex].items = copy[rIndex].items.filter((_, idx) => idx !== iIndex);
      return copy;
    });
  };
  const updateReceiptItem = (rIndex: number, iIndex: number, field: keyof ReceiptItem, value: any) => {
    setReceipts((prev) => {
      const copy = [...prev];
      copy[rIndex].items[iIndex] = { ...copy[rIndex].items[iIndex], [field]: value } as ReceiptItem;
      return copy;
    });
  };

  // Compute totals
  const totalReceipts = receipts.length;
  const totalSales = receipts.reduce((sum, r) => sum + r.sellingTotal, 0);
  const totalItems = receipts.reduce((sum, r) => sum + r.items.length, 0);
  const totalProfit = receipts.reduce((profit, r) => {
    const cost = r.items.reduce((c, i) => c + i.price, 0);
    return profit + (r.sellingTotal - cost);
  }, 0);

  // Submit report handler – build a payload with all data
  const handleSubmit = () => {
    const payload = {
      date: selectedDate.toISOString().split("T")[0],
      day: dayName,
      receipts: receipts.map((r) => ({
        sellingTotal: r.sellingTotal,
        receiptNumber: r.receiptNumber,
        paymentMethod: r.paymentMethod,
        items: r.items,
      })),
      newProducts,
      productsEdited,
      copiesUploaded,
      communications: {
        shopNeat,
        walkInCustomers,
        callsHandled,
        whatsAppHandled,
      },
      liveSession: {
        duration: liveDuration,
        platform: livePlatform,
        viewers: liveViewers,
      },
      notes,
    };
    console.log("Submitting report", payload);
    alert(`Report submitted for ${dayName}! Check console for payload.`);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 space-y-10">
      {/* Header with title, date selector, and day selector */}
      <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <h1 className="text-3xl font-semibold">Daily Report</h1>
        <div className="flex flex-wrap gap-4">
          {/* Date selector styled as pill */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900">
            <CalendarIcon size={16} className="text-slate-400" />
            <input
              type="date"
              className="bg-transparent focus:outline-none text-sm"
              value={selectedDate.toISOString().split("T")[0]}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) setSelectedDate(d);
              }}
            />
          </div>
          {/* Day selector styled as pill */}
          <div className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-700 bg-slate-900">
            <select
              className="bg-transparent focus:outline-none text-sm"
              value={dayName}
              onChange={(e) => {
                const nextIndex = weekdays.indexOf(e.target.value);
                const currentIndex = selectedDate.getDay();
                const diff = nextIndex - currentIndex;
                const nextDate = new Date(selectedDate);
                nextDate.setDate(selectedDate.getDate() + diff);
                setSelectedDate(nextDate);
              }}
            >
              {weekdays.map((d) => (
                <option key={d} value={d} className="bg-slate-800">
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Top grid: Receipts on the left; Stats and Communications on the right */}
      <div className="grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-8">
        {/* Sales Receipts card */}
        <div className={cardClasses + " p-6 space-y-4"}>
          <h2 className="text-xl font-semibold">Sales Receipts</h2>
          {receipts.map((receipt, rIndex) => (
            <div key={rIndex} className="space-y-4 p-4 border border-slate-700 rounded-xl bg-black/20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Selling total (KES)</label>
                  <input
                    type="number"
                    value={receipt.sellingTotal}
                    onChange={(e) => updateReceiptField(rIndex, "sellingTotal", parseFloat(e.target.value) || 0)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Payment method</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => updateReceiptField(rIndex, "paymentMethod", "MPESA")}
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        receipt.paymentMethod === "MPESA"
                          ? "bg-emerald-500 text-black border-emerald-600"
                          : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      MPESA
                    </button>
                    <button
                      type="button"
                      onClick={() => updateReceiptField(rIndex, "paymentMethod", "CASH")}
                      className={`px-3 py-1 rounded-full text-xs font-medium border ${
                        receipt.paymentMethod === "CASH"
                          ? "bg-emerald-500 text-black border-emerald-600"
                          : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                      }`}
                    >
                      Cash
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Receipt number (required)</label>
                  <input
                    type="text"
                    value={receipt.receiptNumber}
                    onChange={(e) => updateReceiptField(rIndex, "receiptNumber", e.target.value)}
                    className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  />
                </div>
              </div>
              {/* Products table */}
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Products</label>
                {receipt.items.map((item, iIndex) => (
                  <div
                    key={iIndex}
                    className="grid grid-cols-1 md:grid-cols-[2fr_1fr_auto] gap-2 items-center"
                  >
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => updateReceiptItem(rIndex, iIndex, "name", e.target.value)}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                      placeholder="Product name"
                    />
                    <input
                      type="number"
                      value={item.price}
                      onChange={(e) => updateReceiptItem(rIndex, iIndex, "price", parseFloat(e.target.value) || 0)}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                      placeholder="Buying price"
                    />
                    <button
                      type="button"
                      className="text-xs text-red-400 hover:text-red-300"
                      onClick={() => removeItemFromReceipt(rIndex, iIndex)}
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => addItemToReceipt(rIndex)}
                  className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/5"
                >
                  + Add product
                </button>
              </div>
              {/* Remove receipt button */}
              {receipts.length > 1 && (
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => removeReceipt(rIndex)}
                >
                  Remove receipt
                </button>
              )}
            </div>
          ))}
          <div className="flex justify-between items-center pt-4">
            <button
              type="button"
              onClick={addReceipt}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            >
              + Add Receipt
            </button>
            <div className="flex flex-col text-xs text-slate-400 gap-1 text-right">
              <span>Total receipts: {totalReceipts}</span>
              <span>Total sales (KES): {totalSales.toLocaleString()}</span>
              <span>Total profit (KES): {totalProfit.toLocaleString()}</span>
              <span>Total items: {totalItems}</span>
            </div>
          </div>
        </div>
        {/* Right column: Stats card and Communications card */}
        <div className="space-y-8">
          {/* Stats card */}
          <div className={cardClasses + " p-6 space-y-4"}>
            <h3 className="text-lg font-semibold">Product Management</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">New products uploaded</span>
                <input
                  type="number"
                  min={0}
                  value={newProducts}
                  onChange={(e) => setNewProducts(parseInt(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-right"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Products edited</span>
                <input
                  type="number"
                  min={0}
                  value={productsEdited}
                  onChange={(e) => setProductsEdited(parseInt(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-right"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Copies uploaded</span>
                <input
                  type="number"
                  min={0}
                  value={copiesUploaded}
                  onChange={(e) => setCopiesUploaded(parseInt(e.target.value) || 0)}
                  className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm text-right"
                />
              </div>
            </div>
          </div>
          {/* Communications card */}
          <div className={cardClasses + " p-6 space-y-4"}>
            <h3 className="text-lg font-semibold">Customer Communications</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Shop neat</span>
                <input
                  type="checkbox"
                  checked={shopNeat}
                  onChange={(e) => setShopNeat(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Walk-in customers</span>
                <input
                  type="checkbox"
                  checked={walkInCustomers}
                  onChange={(e) => setWalkInCustomers(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Calls</span>
                <input
                  type="checkbox"
                  checked={callsHandled}
                  onChange={(e) => setCallsHandled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">WhatsApp</span>
                <input
                  type="checkbox"
                  checked={whatsAppHandled}
                  onChange={(e) => setWhatsAppHandled(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom grid: Live Session and Notes */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Live Session card */}
          <div className={cardClasses + " p-6 space-y-4"}>
            <h3 className="text-lg font-semibold">Live Session</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Duration (min)</label>
                <input
                  type="number"
                  min={0}
                  value={liveDuration}
                  onChange={(e) => setLiveDuration(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Platform</label>
                <select
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                  value={livePlatform}
                  onChange={(e) => setLivePlatform(e.target.value)}
                >
                  {[
                    "Facebook",
                    "Instagram",
                    "TikTok",
                    "YouTube",
                  ].map((opt) => (
                    <option key={opt} value={opt} className="bg-slate-700">
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs uppercase tracking-wide text-slate-400">Viewers</label>
                <input
                  type="number"
                  min={0}
                  value={liveViewers}
                  onChange={(e) => setLiveViewers(parseInt(e.target.value) || 0)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-sm"
                />
              </div>
            </div>
          </div>
          {/* Notes card */}
          <div className={cardClasses + " p-6 space-y-4"}>
            <h3 className="text-lg font-semibold">Notes</h3>
            <textarea
              rows={4}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional comments or highlights…"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            />
          </div>
      </div>
      {/* Submit button centered at bottom */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleSubmit}
          className="rounded-xl px-5 py-3 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95"
        >
          Submit report
        </button>
      </div>
    </div>
  );
}
