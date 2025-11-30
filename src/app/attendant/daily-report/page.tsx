"use client";

import { useState } from "react";
import { CalendarIcon } from "lucide-react";

const cardClasses =
  "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

const dayItems: Record<string, { title: string; items: string[] }[]> = {
  Monday: [
    {
      title: "Product & Stock Management",
      items: ["Uploaded new products", "Uploaded product copies", "Edited products"],
    },
    {
      title: "Customer & Communications",
      items: [
        "Replied to FB comments",
        "Replied to FB DMs",
        "Replied to IG comments",
        "Replied to IG DMs",
        "Cleared FB inbox",
        "Cleared IG inbox",
      ],
    },
    {
      title: "Marketplace Review",
      items: ["Stock checked", "Pricing confirmed", "Competitors reviewed", "OOS review"],
    },
  ],
  Tuesday: [
    {
      title: "Product Marketing Output (Videos)",
      items: [
        "Recorded promotional videos",
        "Recorded demo videos",
        "Posted to Facebook",
        "Posted to Instagram",
        "Posted to TikTok",
      ],
    },
    {
      title: "Customer & Communications",
      items: [
        "Replied to FB comments",
        "Replied to FB DMs",
        "Replied to IG comments",
        "Replied to IG DMs",
        "Cleared FB inbox",
        "Cleared IG inbox",
      ],
    },
  ],
  Wednesday: [
    {
      title: "Live Sessions & Content Output",
      items: [
        "Hosted live session",
        "Produced product clips",
        "Generated leads",
        "Posted promotional clips",
      ],
    },
    {
      title: "Customer & Communications",
      items: [
        "Replied to FB comments",
        "Replied to FB DMs",
        "Replied to IG comments",
        "Replied to IG DMs",
        "Cleared FB inbox",
        "Cleared IG inbox",
      ],
    },
  ],
  Thursday: [
    {
      title: "Weekly Marketing Activities",
      items: ["Attended weekly meeting", "Participated in video shoot", "Uploaded promo videos"],
    },
    {
      title: "Customer & Communications",
      items: [
        "Replied to FB comments",
        "Replied to FB DMs",
        "Replied to IG comments",
        "Replied to IG DMs",
        "Cleared FB inbox",
        "Cleared IG inbox",
      ],
    },
  ],
  Friday: [
    {
      title: "Promotional Preparation",
      items: ["Shot promotional videos", "Cleaned office", "Scheduled weekend posts"],
    },
  ],
  Saturday: [
    {
      title: "Live Sessions & Weekend Prep",
      items: ["Hosted live session", "Cleaned office", "Organised store"],
    },
  ],
};

export default function DailyReportPage() {
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dayName = formatDay(selectedDate);

  function ReceiptSection() {
    const [sellingTotal, setSellingTotal] = useState(0);
    const [receiptNumber, setReceiptNumber] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"MPESA" | "CASH">("MPESA");
    const [products, setProducts] = useState<{ name: string; price: number }[]>([]);

    return (
      <div className={`${cardClasses} p-6 space-y-4`}>
        <h2 className="text-lg font-semibold">Add each receipt for today</h2>
        <p className="text-sm text-slate-400">Totals are calculated automatically.</p>
        <div className="space-y-4">
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

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wide text-slate-400">Products in this receipt</label>
            {products.map((item, idx) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-[3fr_1fr_auto] gap-2 items-center">
                <input
                  type="text"
                  value={item.name}
                  className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                  onChange={(e) => {
                    const next = [...products];
                    next[idx].name = e.target.value;
                    setProducts(next);
                  }}
                />
                <input
                  type="number"
                  value={item.price}
                  className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                  onChange={(e) => {
                    const next = [...products];
                    next[idx].price = parseFloat(e.target.value) || 0;
                    setProducts(next);
                  }}
                />
                <button
                  type="button"
                  className="text-xs text-red-400 hover:text-red-300"
                  onClick={() => {
                    const next = products.filter((_, i) => i !== idx);
                    setProducts(next);
                  }}
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              type="button"
              className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
              onClick={() => setProducts([...products, { name: "", price: 0 }])}
            >
              + Add product to this receipt
            </button>
          </div>
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

  function DayChecklist({
    title,
    items,
  }: {
    title: string;
    items: string[];
  }) {
    const [selected, setSelected] = useState<string[]>([]);
    return (
      <div className={`${cardClasses} p-6 space-y-4`}>
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex flex-wrap gap-3">
          {items.map((text) => {
            const active = selected.includes(text);
            return (
              <button
                key={text}
                type="button"
                className={`rounded-full px-4 py-2 text-sm border transition-all ${
                  active
                    ? "bg-emerald-500 text-black border-emerald-600"
                    : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                }`}
                onClick={() => {
                  setSelected((prev) =>
                    prev.includes(text) ? prev.filter((v) => v !== text) : [...prev, text],
                  );
                }}
              >
                {text}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const sections = dayItems[dayName] ?? dayItems.Monday;

  function handleSubmit() {
    alert(`Submit for ${dayName}`);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
      <div className={`${cardClasses} p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between`}>
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <label className="text-xs uppercase tracking-wide text-slate-400">Date</label>
          <div className="flex items-center gap-2">
            <CalendarIcon size={16} className="text-slate-400" />
            <input
              type="date"
              className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
              value={selectedDate.toISOString().split("T")[0]}
              onChange={(e) => {
                const d = new Date(e.target.value);
                if (!isNaN(d.getTime())) setSelectedDate(d);
              }}
            />
          </div>
        </div>
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <label className="text-xs uppercase tracking-wide text-slate-400">Day of week</label>
          <select
            className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
            value={dayName}
            onChange={(e) => {
              const nextDate = new Date(selectedDate);
              const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
              const currentDayIndex = nextDate.getDay();
              const targetIndex = days.indexOf(e.target.value);
              const diff = targetIndex - currentDayIndex;
              nextDate.setDate(nextDate.getDate() + diff);
              setSelectedDate(nextDate);
            }}
          >
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-4">
          <button
            type="button"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            onClick={() => location.reload()}
          >
            Reset day
          </button>
          <button
            type="button"
            className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95"
            onClick={handleSubmit}
          >
            Submit report
          </button>
        </div>
      </div>

      <ReceiptSection />

      {sections.map((sec) => (
        <DayChecklist key={sec.title} title={sec.title} items={sec.items} />
      ))}

      <div className={`${cardClasses} p-6 space-y-2`}>
        <label className="text-sm font-semibold">Notes / Summary</label>
        <textarea
          rows={4}
          className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Any additional comments, highlights or issues…"
        />
      </div>
    </div>
  );
}
