"use client";

import { Dispatch, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { CalendarIcon } from "lucide-react";

const cardClasses =
  "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";

function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

type SaleRow = { id: string; name?: string; price?: number | string; paymentMethod?: "MPESA" | "CASH" | ""; receiptNumber?: string };

type MarketplaceState = {
  newUploaded: number | "";
  copiesUploaded: number | "";
  productsEdited: number | "";
  sales: SaleRow[];
  review?: Record<string, any>;
};

const defaultMarketplaceState = (): MarketplaceState => ({
  newUploaded: "",
  copiesUploaded: "",
  productsEdited: "",
  sales: [{ id: crypto.randomUUID(), name: "", price: "", paymentMethod: "MPESA", receiptNumber: "" }],
  review: undefined,
});

const defaultDayState = () => ({
  customersServed: 0,
  commentsDMs: 0,
  liveSessions: 0,
  officeClean: false,
  videosParticipated: 0,
  competitorNotes: "",
  improvementIdeas: "",
  meetingAttended: false,
  videoShoot: false,
  weekendPromos: false,
  stockChecked: false,
  inboxCleared: false,
});

type CustomerCommsActivity = {
  walkInServed: number;
  walkInsWhoPurchased: number;
  callsHandled: number;
  whatsappSmsReplied: number;
  fbCommentsReplied: boolean;
  fbDmsReplied: boolean;
  igCommentsReplied: boolean;
  igDmsReplied: boolean;
  fbAllCleared: boolean;
  igAllCleared: boolean;
  competitorNotes: string;
  improvementSuggestions: string;
};

const defaultCustomerComms = (): CustomerCommsActivity => ({
  walkInServed: 0,
  walkInsWhoPurchased: 0,
  callsHandled: 0,
  whatsappSmsReplied: 0,
  fbCommentsReplied: false,
  fbDmsReplied: false,
  igCommentsReplied: false,
  igDmsReplied: false,
  fbAllCleared: false,
  igAllCleared: false,
  competitorNotes: "",
  improvementSuggestions: "",
});

function ReceiptSection({ receipts, setReceipts, salesErrors }: { receipts: any[]; setReceipts: Dispatch<SetStateAction<any[]>>; salesErrors: Record<string, string | null> }) {
  const updateReceipt = (idx: number, patch: Partial<any>) => setReceipts((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <div className={cardClasses + " p-6 space-y-4"}>
      <h2 className="text-lg font-semibold">Add each receipt for today</h2>
      <p className="text-sm text-slate-400">Totals are calculated automatically.</p>

      {receipts.map((rec, i) => (
        <div key={rec.id} className="border border-slate-800 rounded-lg p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Selling total (KES)</label>
              <input
                type="number"
                className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                value={rec.sellingTotal}
                onChange={(e) => updateReceipt(i, { sellingTotal: parseFloat(e.target.value) || 0 })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Receipt number (required)</label>
              <input
                type="text"
                className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                placeholder="Required"
                value={rec.receiptNumber}
                onChange={(e) => updateReceipt(i, { receiptNumber: e.target.value })}
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs uppercase tracking-wide text-slate-400">Payment method (required)</label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className={`px-4 py-1 rounded-full text-xs font-medium border transition-colors ${
                    rec.paymentMethod === "MPESA"
                      ? "bg-emerald-500 text-black border-emerald-600"
                      : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                  }`}
                  onClick={() => updateReceipt(i, { paymentMethod: "MPESA" })}
                >
                  MPESA
                </button>
                <button
                  type="button"
                  className={`px-4 py-1 rounded-full text-xs font-medium border transition-colors ${
                    rec.paymentMethod === "CASH"
                      ? "bg-emerald-500 text-black border-emerald-600"
                      : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                  }`}
                  onClick={() => updateReceipt(i, { paymentMethod: "CASH" })}
                >
                  Cash
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-2 mt-4">
            <label className="text-xs uppercase tracking-wide text-slate-400">Products in this receipt</label>
            {rec.products.map((p: any, idx: number) => (
              <div key={idx} className="grid grid-cols-1 md:grid-cols-[3fr_1fr_auto] gap-2 items-center">
                <input
                  type="text"
                  value={p.name}
                  className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                  onChange={(e) => updateReceipt(i, { products: rec.products.map((it: any, j: number) => (j === idx ? { ...it, name: e.target.value } : it)) })}
                />
                <input
                  type="number"
                  value={p.price}
                  className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                  onChange={(e) => updateReceipt(i, { products: rec.products.map((it: any, j: number) => (j === idx ? { ...it, price: parseFloat(e.target.value) || 0 } : it)) })}
                />
                <button type="button" className="text-xs text-red-400 hover:text-red-300" onClick={() => updateReceipt(i, { products: rec.products.filter((_: any, j: number) => j !== idx) })}>
                  Remove
                </button>
              </div>
            ))}

            {/* inline sales errors per product row */}
            {rec.products.map((p: any) => {
              const id = `${rec.id}:${p.name}:${p.price}`;
              const err = salesErrors[id];
              return err ? (
                <div key={`err-${id}`} className="text-xs text-rose-300 mt-1">{err}</div>
              ) : null;
            })}

            <div>
              <button type="button" className="mt-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200" onClick={() => updateReceipt(i, { products: [...rec.products, { name: "", price: 0 }] })}>
                + Add product to this receipt
              </button>
            </div>
          </div>

          <div className="mt-4 flex flex-col gap-1 text-sm text-slate-400">
            <span>Total sales (KES): {Number(rec.sellingTotal).toLocaleString()}</span>
            <span>Total items: {rec.products.length}</span>
          </div>
        </div>
      ))}

      <div className="flex gap-2">
        <button type="button" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200" onClick={() => setReceipts((r) => [...r, { id: crypto.randomUUID(), sellingTotal: 0, receiptNumber: "", paymentMethod: "MPESA", products: [] }])}>
          + Add receipt
        </button>
      </div>
    </div>
  );
}

function DayChecklist({ title, items, dayKey, dayState, setDayState }: { title: string; items: string[]; dayKey: DayKey; dayState: Record<DayKey, Record<string, number | boolean | string>>; setDayState: Dispatch<SetStateAction<Record<DayKey, Record<string, number | boolean | string>>>> }) {
  const keyFor = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return (
    <div className={cardClasses + " p-6 space-y-4"}>
      <h3 className="text-lg font-semibold">{title}</h3>
      <div className="flex flex-wrap gap-3">
        {items.map((text) => {
          const k = keyFor(text);
          const active = Boolean(dayState[dayKey]?.[k]);
          return (
            <button
              key={text}
              type="button"
              className={`rounded-full px-4 py-2 text-sm border transition-all ${
                active ? "bg-emerald-500 text-black border-emerald-600" : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
              }`}
              onClick={() => setDayState((prev) => ({ ...prev, [dayKey]: { ...prev[dayKey], [k]: !Boolean(prev[dayKey]?.[k]) } }))}
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

  // per-day state to better mirror DailyTasksUI
  const [dayState, setDayState] = useState<Record<DayKey, Record<string, number | boolean | string>>>( {
    monday: defaultDayState(),
    tuesday: defaultDayState(),
    wednesday: defaultDayState(),
    thursday: defaultDayState(),
    friday: defaultDayState(),
    saturday: defaultDayState(),
  });

  const [market, setMarket] = useState<Record<DayKey, MarketplaceState>>({
    monday: defaultMarketplaceState(),
    tuesday: defaultMarketplaceState(),
    wednesday: defaultMarketplaceState(),
    thursday: defaultMarketplaceState(),
    friday: defaultMarketplaceState(),
    saturday: defaultMarketplaceState(),
  });

  const [customerComms, setCustomerComms] = useState<Record<DayKey, CustomerCommsActivity>>({
    monday: defaultCustomerComms(),
    tuesday: defaultCustomerComms(),
    wednesday: defaultCustomerComms(),
    thursday: defaultCustomerComms(),
    friday: defaultCustomerComms(),
    saturday: defaultCustomerComms(),
  });

  const [receipts, setReceipts] = useState<any[]>(() => [
    { id: crypto.randomUUID(), sellingTotal: 0, receiptNumber: "", paymentMethod: "MPESA", products: [] },
  ]);
  const [notes, setNotes] = useState("");
  const [autosaveStatus, setAutosaveStatus] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const autosaveTimer = useRef<number | null>(null);
  const isAutoSaving = useRef(false);
  const pendingAutosave = useRef(false);
  const autosaveRetryTimer = useRef<number | null>(null);
  const autosaveRetryCount = useRef(0);
  const backoffs = [1500, 3000, 6000];

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

  const totalSales = useMemo(() => receipts.reduce((acc, r) => acc + Number(r.sellingTotal || 0), 0), [receipts]);
  const [salesErrors, setSalesErrors] = useState<Record<string, string | null>>({});

  const validatePayload = (body: any) => {
    if (!body.day) return "day is required";
    if (body.productsCount < 0) return "productsCount must be >= 0";
    if (body.totalSales < 0) return "totalSales must be >= 0";
    if (!Array.isArray(body.tasks.sales)) return "sales must be an array";
    if (body.tasks.marketplaceReview && typeof body.tasks.marketplaceReview !== "object") return "marketplaceReview must be object";
    if (body.tasks.customerComms && typeof body.tasks.customerComms !== "object") return "customerComms must be object";
    if (body.submittedBy && typeof body.submittedBy !== "string") return "submittedBy must be a string";
    for (const s of body.tasks.sales) {
      if (typeof s.productName !== "string") return "each sale must have a productName";
      if (Number(s.price) < 0) return "sale price must be >= 0";
    }
    return null;
  };

  async function doSave() {
    // prevent overlapping autosaves
    if (isAutoSaving.current) {
      pendingAutosave.current = true;
      return;
    }
    isAutoSaving.current = true;
    setAutosaveStatus("saving");
    try {
      const rawSales = receipts.flatMap((r) => {
        const base = { receiptNumber: String(r.receiptNumber || ""), paymentMethod: r.paymentMethod || "MPESA", total: Number(r.sellingTotal || 0) };
        if (Array.isArray(r.products) && r.products.length > 0) {
          return r.products.map((p: any) => ({ id: `${r.id}:${p.name}:${p.price}`, ...base, productName: String(p.name || "").trim(), price: Number(p.price || 0) }));
        }
        return [{ id: `${r.id}:receipt`, ...base, productName: "", price: Number(r.sellingTotal || 0) }];
      });

      // Validate sales rows: require that rows are either empty or have productName and price>0
      const newSalesErrors: Record<string, string | null> = {};
      for (const s of rawSales) {
        const hasName = String(s.productName || "").trim() !== "";
        const hasPrice = Number(s.price) > 0;
        if (hasName && !hasPrice) newSalesErrors[s.id] = "Enter a valid price (> 0) or remove row";
        else if (!hasName && hasPrice) newSalesErrors[s.id] = "Enter product name or clear price";
        else newSalesErrors[s.id] = null;
      }
      setSalesErrors(newSalesErrors);

      const hasSalesError = Object.values(newSalesErrors).some((v) => v);
      if (hasSalesError) {
        setAutosaveStatus("Autosave paused — fix sales rows");
        isAutoSaving.current = false;
        return;
      }

      const sales = rawSales.map((s) => ({ productName: s.productName, price: Number(s.price || 0), receiptNumber: s.receiptNumber, paymentMethod: s.paymentMethod }));

      const productsCount = receipts.reduce((acc, r) => acc + (Array.isArray(r.products) ? r.products.length : 0), 0);

      const dayKey = (dayName.toLowerCase() as DayKey) || ("monday" as DayKey);

      const categories = {
        newUploads: Number(market[dayKey].newUploaded) || 0,
        copiesUploaded: Number(market[dayKey].copiesUploaded) || 0,
        productsEdited: Number(market[dayKey].productsEdited) || 0,
      };

      const marketing = {
        attendedMarketingMeeting: Boolean(dayState[dayKey]["meetingAttended"]),
        participatedVideoShoot: Boolean(dayState[dayKey]["videoShoot"]),
        marketingVideosShot: Number(dayState[dayKey]["promoVideosPosted"] || 0) + Number(dayState[dayKey]["demoVideosRecorded"] || 0),
      };

      const customerOperations = {
        walkInCustomers: Number(dayState[dayKey]["customersServed"]) || 0,
        customersPurchased: 0,
        liveViewers: Number(dayState[dayKey]["liveSessions"]) || 0,
        livePurchases: 0,
      };

      const officeMaintenance = {
        officeCleaned: Boolean(dayState[dayKey]["officeClean"]),
        officeNotes: String((dayState[dayKey]["competitorNotes"] || "").toString().trim()),
      };

      const marketplaceReview = market[dayKey].review || undefined;
      const customerCommsForDay = customerComms[dayKey] || undefined;

      const trimmedDayFields = { ...dayState[dayKey], competitorNotes: String((dayState[dayKey]["competitorNotes"] || "")).trim(), improvementIdeas: String((dayState[dayKey]["improvementIdeas"] || "")).trim() };

      const body = {
        date: selectedDate.toISOString(),
        day: dayKey,
        productsCount,
        totalSales,
        submittedBy: null,
        tasks: {
          categories,
          marketing,
          customerOperations,
          officeMaintenance,
          marketplaceReview,
          customerComms: customerCommsForDay,
          sales,
          dayFields: trimmedDayFields,
        },
      };

      const validationErr = validatePayload(body);
      if (validationErr) {
        setAutosaveStatus(validationErr);
        isAutoSaving.current = false;
        return;
      }

      const res = await fetch("/api/daily-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error(`Save failed ${res.status}`);
      const now = new Date();
      setSavedAt(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      setAutosaveStatus("saved");
      autosaveRetryCount.current = 0;
      if (pendingAutosave.current) {
        pendingAutosave.current = false;
        void doSave();
      }
      setTimeout(() => setAutosaveStatus(null), 3000);
    } catch (err) {
      // retry logic
      if (autosaveRetryCount.current < backoffs.length) {
        autosaveRetryCount.current += 1;
        setAutosaveStatus("Autosave failed — retrying...");
        const wait = backoffs[autosaveRetryCount.current - 1];
        if (autosaveRetryTimer.current) window.clearTimeout(autosaveRetryTimer.current);
        autosaveRetryTimer.current = window.setTimeout(() => {
          void doSave();
        }, wait) as unknown as number;
      } else {
        setAutosaveStatus("Autosave paused");
      }
    } finally {
      isAutoSaving.current = false;
    }
  }

  function handleSubmit() {
    void doSave();
  }

  // autosave: debounce changes to receipts/notes
  useEffect(() => {
    if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    autosaveTimer.current = window.setTimeout(() => {
      void doSave();
    }, 700);
    return () => {
      if (autosaveTimer.current) window.clearTimeout(autosaveTimer.current);
    };
  }, [receipts, notes, selectedDate]);

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
          <div className="flex items-center gap-3">
            <div className="text-sm text-slate-400">{autosaveStatus === "saved" && savedAt ? `Saved at ${savedAt}` : autosaveStatus || "Autosave paused"}</div>
            <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95" onClick={handleSubmit}>
              Submit report
            </button>
          </div>
        </div>
      </div>

      <ReceiptSection receipts={receipts} setReceipts={setReceipts} salesErrors={salesErrors} />

      {sections.map((sec) => (
        <DayChecklist key={sec.title} title={sec.title} items={sec.items} dayKey={dayName.toLowerCase() as DayKey} dayState={dayState} setDayState={setDayState} />
      ))}

      <div className={cardClasses + " p-6 space-y-2"}>
        <label className="text-sm font-semibold">Notes / Summary</label>
        <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500" placeholder="Any additional comments, highlights or issues…" />
      </div>
    </div>
  );
}
