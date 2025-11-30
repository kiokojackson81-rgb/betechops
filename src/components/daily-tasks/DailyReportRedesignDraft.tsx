"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

const cardClasses =
  "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

function ReceiptSection() {
  const [sellingTotal, setSellingTotal] = useState(0);
  const [receiptNumber, setReceiptNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"MPESA" | "CASH">("MPESA");
  const [products, setProducts] = useState<{ name: string; price: number }[]>([]);

  return (
    <div className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Add each receipt for today</h2>
      <p className="text-sm text-slate-400">Totals are calculated automatically.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">Selling total (KES)</label>
          <input
            type="number"
            className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
            value={sellingTotal}
            onChange={(e) => setSellingTotal(parseFloat(e.target.value) || 0)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">Receipt number (required)</label>
          <input
            type="text"
            className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
            placeholder="Required"
            value={receiptNumber}
            onChange={(e) => setReceiptNumber(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <label className="text-xs uppercase tracking-wide text-slate-400">Payment method (required)</label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`px-4 py-1 rounded-full text-xs font-medium border transition-colors ${
                paymentMethod === "MPESA"
                  ? "bg-emerald-500 text-black border-emerald-600"
                  : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              }`}
              onClick={() => setPaymentMethod("MPESA")}
            >
              MPESA
            </button>
            <button
              type="button"
              className={`px-4 py-1 rounded-full text-xs font-medium border transition-colors ${
                paymentMethod === "CASH"
                  ? "bg-emerald-500 text-black border-emerald-600"
                  : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              }`}
              onClick={() => setPaymentMethod("CASH")}
            >
              Cash
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-2 mt-4">
        <label className="text-xs uppercase tracking-wide text-slate-400">Products in this receipt</label>
        {products.map((p, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-[3fr_1fr_auto] gap-2 items-center">
            <input
              type="text"
              value={p.name}
              className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
              onChange={(e) => setProducts((prev) => prev.map((it, idx) => (idx === i ? { ...it, name: e.target.value } : it)))}
            />
            <input
              type="number"
              value={p.price}
              className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
              onChange={(e) => setProducts((prev) => prev.map((it, idx) => (idx === i ? { ...it, price: parseFloat(e.target.value) || 0 } : it)))}
            />
            <button type="button" className="text-xs text-red-400 hover:text-red-300" onClick={() => setProducts((prev) => prev.filter((_, idx) => idx !== i))}>
              Remove
            </button>
          </div>
        ))}

        <button type="button" className="mt-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200" onClick={() => setProducts((p) => [...p, { name: "", price: 0 }])}>
          + Add product to this receipt
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-1 text-sm text-slate-400">
        <span>Total receipts: {1}</span>
        <span>Total sales (KES): {sellingTotal.toLocaleString()}</span>
        <span>Total profit (KES): 0</span>
        <span>Total items: {products.length}</span>
      </div>
    </div>
  );
}

function DayChecklist({ title, items }: { title: string; items: string[] }) {
  const [selected, setSelected] = useState<string[]>([]);
  return (
    <div className={cardClasses + " p-6 space-y-4"}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {items.map((text) => {
          const active = selected.includes(text);
          return (
            <button
              key={text}
              type="button"
              className={`rounded-full px-4 py-2 text-sm border transition-all ${
                active ? "bg-emerald-500 text-black border-emerald-600" : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              }`}
              onClick={() => setSelected((prev) => (prev.includes(text) ? prev.filter((v) => v !== text) : [...prev, text]))}
            >
              {text}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function DailyReportRedesignDraft() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dayName = formatDay(selectedDate);

  const dayItems: Record<string, { title: string; items: string[] }[]> = {
    Monday: [
      { title: "Product & Stock Management", items: ["Uploaded new products", "Uploaded product copies", "Edited products"] },
      { title: "Customer & Communications", items: ["Replied to FB comments", "Replied to FB DMs", "Cleared FB inbox"] },
    ],
    Tuesday: [
      { title: "Product Marketing Output (Videos)", items: ["Recorded promotional videos", "Posted to Facebook", "Posted to Instagram"] },
    ],
    Wednesday: [
      { title: "Live Sessions & Content Output", items: ["Hosted live session", "Produced product clips"] },
    ],
    Thursday: [
      { title: "Weekly Marketing Activities", items: ["Attended weekly meeting", "Uploaded promo videos"] },
    ],
    Friday: [{ title: "Promotional Preparation", items: ["Shot promotional videos", "Scheduled weekend posts"] }],
    Saturday: [{ title: "Live Sessions & Weekend Prep", items: ["Hosted live session", "Organised store"] }],
  };

  const sections = dayItems[dayName] ?? dayItems.Monday;

  function handleSubmit() {
    alert(`Submit for ${dayName}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
      <div className={cardClasses + " p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"}>
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <label className="text-xs uppercase tracking-wide text-slate-400">Date</label>
          <div className="flex items-center gap-2">
            <CalendarIcon size={16} className="text-slate-400" />
            <input
              type="date"
              className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
              value={selectedDate.toISOString().split("T")[0]}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) setSelectedDate(d);
              }}
            />
          </div>
        </div>

        <div className="flex items-end gap-4">
          <button type="button" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={() => location.reload()}>
            Reset day
          </button>
          <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95" onClick={handleSubmit}>
            Submit report
          </button>
        </div>
      </div>

      <ReceiptSection />

      {sections.map((sec) => (
        <DayChecklist key={sec.title} title={sec.title} items={sec.items} />
      ))}

      <div className={cardClasses + " p-6 space-y-2"}>
        <label className="text-sm font-semibold">Notes / Summary</label>
        <textarea rows={4} className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500" placeholder="Any additional comments, highlights or issues…" />
      </div>
    </div>
  );
}
