/**
 * Final redesign for the marketing attendant daily report page.
 *
 * This component retains every data‑entry field from the original daily report
 * while adopting the dark, card‑based layout used in the marketing tracker.
 * It supports multi‑receipt entry, per‑day checklists with booleans and
 * numeric counts, live session details for Wednesday and Saturday, and
 * weekly marketing activities on Thursday.  All inputs are grouped into
 * cards with consistent styling.  The state is maintained in a single
 * object keyed by field identifiers, making it easy to construct a
 * submission payload matching the existing API.
 */

"use client";

import { useState } from "react";
import {
  CalendarIcon,
} from "lucide-react";

// Shared card styles.  These classes mirror the tracker UI to provide
// consistent dark backgrounds, subtle borders and rounded corners.
const cardClasses =
  "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";

// Utility to format a Date into the English weekday name.  You can localise
// this if needed.
function getWeekday(date: Date): string {
  return date.toLocaleDateString("en-US", { weekday: "long" });
}

// Field definition type for dynamic rendering of checklists.  Each field has
// a unique key, a label for display, and a type.  Select fields may
// optionally specify an array of options.
type FieldDef = {
  key: string;
  label: string;
  type: "boolean" | "number" | "text" | "select";
  options?: string[];
};

// Section definition groups related fields under a title.
type SectionDef = {
  title: string;
  fields: FieldDef[];
};

const livePlatformOptions = ["Facebook", "Instagram", "TikTok", "YouTube"];

const dayConfig: Record<string, SectionDef[]> = {
  Monday: [
    {
      title: "Product & Stock Management",
      fields: [
        { key: "mondayProductsUploadedCount", label: "Products uploaded (target 50)", type: "number" },
        { key: "mondayStockChecked", label: "Stock levels checked (Jumia/Kilimall)", type: "boolean" },
        { key: "mondayPricingChecked", label: "Pricing confirmed across marketplaces", type: "boolean" },
      ],
    },
    {
      title: "Customer Servicing",
      fields: [
        { key: "mondayCustomersServedCount", label: "Customers served (walk-in / online)", type: "number" },
        { key: "mondayRespondedToWhatsApp", label: "WhatsApp cleared", type: "boolean" },
        { key: "mondayRespondedToCalls", label: "Calls handled", type: "boolean" },
      ],
    },
    {
      title: "Market Intelligence",
      fields: [
        { key: "mondayCompetitorNotes", label: "Competitor notes", type: "text" },
        { key: "mondayImprovementIdeas", label: "Improvement ideas", type: "text" },
      ],
    },
  ],
  Tuesday: [
    {
      title: "Product Marketing & Engagement",
      fields: [
        { key: "tuesdayProductsUploadedCount", label: "Products uploaded / updated", type: "number" },
        { key: "tuesdayPromoVideoPosted", label: "Promo video posted", type: "boolean" },
        { key: "tuesdayDemoVideoRecorded", label: "Demo video recorded", type: "boolean" },
        { key: "tuesdayEngagementsDone", label: "Engagement replies (comments/DMs/stories)", type: "number" },
      ],
    },
    {
      title: "Customer Service",
      fields: [
        { key: "tuesdayCustomersServedCount", label: "Customers served (walk-in/online/WhatsApp)", type: "number" },
      ],
    },
    {
      title: "Market Intelligence",
      fields: [
        { key: "tuesdayCompetitorNotes", label: "Competitor notes", type: "text" },
        { key: "tuesdayImprovementIdeas", label: "Improvement ideas", type: "text" },
      ],
    },
  ],
  Wednesday: [
    {
      title: "Live Session & Sales Focus",
      fields: [
        { key: "wednesdayProductsUploadedCount", label: "Products uploaded", type: "number" },
        { key: "wednesdayMarketingClipsPosted", label: "Marketing clips posted", type: "boolean" },
        { key: "wednesdayFollowUpsCompleted", label: "Follow-ups completed", type: "boolean" },
        { key: "wednesdayCustomersServedCount", label: "Customers served", type: "number" },
      ],
    },
    {
      title: "Live Session Details",
      fields: [
        { key: "wednesdayLiveSessionHosted", label: "Hosted live session", type: "boolean" },
        { key: "wednesdayLiveDuration", label: "Live session duration (minutes)", type: "number" },
        { key: "wednesdayLivePlatform", label: "Platform", type: "select", options: livePlatformOptions },
        { key: "wednesdayLiveViewers", label: "Estimated viewers", type: "number" },
        { key: "wednesdayLiveLeadsGenerated", label: "Leads generated", type: "number" },
        { key: "wednesdayLiveNotes", label: "Live session notes", type: "text" },
      ],
    },
    {
      title: "Engagement Insights",
      fields: [
        { key: "wednesdayEngagementInsights", label: "Engagement insights", type: "text" },
      ],
    },
  ],
  Thursday: [
    {
      title: "Weekly Marketing & Video Shoot",
      fields: [
        { key: "thursdayMeetingAttended", label: "Weekly marketing meeting attended", type: "boolean" },
        { key: "thursdayVideoShootParticipated", label: "Participated in weekly video shoot", type: "boolean" },
        { key: "thursdayProductsUploadedCount", label: "Products uploaded (target 50)", type: "number" },
        { key: "thursdayListingsUpdated", label: "Listings updated", type: "boolean" },
        { key: "thursdayMarketingVideoPosted", label: "Marketing video posted", type: "boolean" },
      ],
    },
    {
      title: "Office & Display",
      fields: [
        { key: "thursdayOfficeCleaned", label: "Office cleaned", type: "boolean" },
        { key: "thursdayDisplayOrganised", label: "Display organised", type: "boolean" },
      ],
    },
    {
      title: "Customer Service",
      fields: [
        { key: "thursdayCustomersServedCount", label: "Customers served today", type: "number" },
      ],
    },
    {
      title: "Observations & Improvements",
      fields: [
        { key: "thursdayObservations", label: "Notes / improvement ideas", type: "text" },
      ],
    },
  ],
  Friday: [
    {
      title: "Promotion & Sales Push",
      fields: [
        { key: "fridayProductsUploadedCount", label: "Products uploaded (target 50)", type: "number" },
        { key: "fridayPromoVideosPosted", label: "Promo videos posted or testimonials", type: "boolean" },
        { key: "fridayWeekendPromotionsPrepared", label: "Weekend promos prepared / scheduled", type: "boolean" },
      ],
    },
    {
      title: "Office & Display",
      fields: [
        { key: "fridayOfficeCleaned", label: "Office cleaned", type: "boolean" },
        { key: "fridayDisplayOrganised", label: "Display organised", type: "boolean" },
      ],
    },
    {
      title: "Customer Insights",
      fields: [
        { key: "fridayCustomersServedCount", label: "Customers served", type: "number" },
      ],
    },
    {
      title: "Improvement Ideas",
      fields: [
        { key: "fridayImprovementIdeas", label: "Improvement ideas", type: "text" },
      ],
    },
  ],
  Saturday: [
    {
      title: "Customer Service & Summary",
      fields: [
        { key: "saturdayProductsUpdatedCount", label: "Products updated / final uploads", type: "number" },
        { key: "saturdayWalkInCustomersServed", label: "Walk-in customers served", type: "number" },
        { key: "saturdayPendingFollowUpsHandled", label: "Pending follow-ups handled", type: "boolean" },
      ],
    },
    {
      title: "Light Live Session",
      fields: [
        { key: "saturdayLightLiveSession", label: "Hosted light live session", type: "boolean" },
        { key: "saturdayLiveDuration", label: "Live duration (minutes)", type: "number" },
        { key: "saturdayLivePlatform", label: "Platform", type: "select", options: livePlatformOptions },
        { key: "saturdayLiveViewers", label: "Estimated viewers", type: "number" },
        { key: "saturdayLiveNotes", label: "Light live notes", type: "text" },
      ],
    },
    {
      title: "Office & Display",
      fields: [
        { key: "saturdayOfficeCleaned", label: "Office cleaned", type: "boolean" },
        { key: "saturdayDisplayOrganised", label: "Display organised", type: "boolean" },
      ],
    },
    {
      title: "Weekly Summary",
      fields: [
        { key: "saturdayWeeklySummary", label: "Weekly summary (uploads, videos, leads, follow-ups)", type: "text" },
      ],
    },
  ],
};

// Define initial state for all fields.  Numbers start at 0, booleans at false,
// text fields as an empty string, and select fields default to the first
// option if provided.
function createInitialState(): Record<string, any> {
  const state: Record<string, any> = {};
  Object.values(dayConfig).forEach((sections) => {
    sections.forEach((section) => {
      section.fields.forEach((field) => {
        if (field.type === "number") state[field.key] = 0;
        else if (field.type === "boolean") state[field.key] = false;
        else if (field.type === "text") state[field.key] = "";
        else if (field.type === "select") state[field.key] = field.options ? field.options[0] : "";
      });
    });
  });
  state["notes"] = "";
  return state;
}

// Receipt and item types for managing sales entries.
interface ReceiptItem {
  name: string;
  buyingPrice: number;
}

interface Receipt {
  receiptNumber: string;
  sellingTotal: number;
  paymentMethod: "MPESA" | "CASH";
  items: ReceiptItem[];
}

export default function DailyReportFinal() {
  // Date state and derived weekday
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const dayName = getWeekday(selectedDate);

  // Checklist state for all fields
  const [fieldsState, setFieldsState] = useState<Record<string, any>>(() => createInitialState());

  // New metrics state requested in spec
  const [newProducts, setNewProducts] = useState<number>(0);
  const [productsEditedCount, setProductsEditedCount] = useState<number>(0);
  const [copiesUploaded, setCopiesUploaded] = useState<number>(0);
  const [walkInServed, setWalkInServed] = useState<number>(0);
  const [purchasesMade, setPurchasesMade] = useState<number>(0);
  const [liveSessionsCount, setLiveSessionsCount] = useState<number>(0);
  const [commissionEarned, setCommissionEarned] = useState<number>(0);
  const [confirmedCompetitiveness, setConfirmedCompetitiveness] = useState<boolean>(false);

  // Tuesday / engagement metrics
  const [promoVideos, setPromoVideos] = useState<number>(0);
  const [demoVideos, setDemoVideos] = useState<number>(0);
  const [engagementReplies, setEngagementReplies] = useState<number>(0);
  const [allCommentsReplied, setAllCommentsReplied] = useState<boolean>(false);

  // Concerns / weekly summary renamed
  const [concernsText, setConcernsText] = useState<string>(fieldsState["notes"] || "");

  // Receipt list state.  Users can add multiple receipts, each with multiple items.
  const [receipts, setReceipts] = useState<Receipt[]>([{
    receiptNumber: "",
    sellingTotal: 0,
    paymentMethod: "MPESA",
    items: [],
  }]);

  // Handler to change field values.  Handles different input types.
  const handleFieldChange = (key: string, value: any) => {
    setFieldsState((prev) => ({ ...prev, [key]: value }));
  };

  // Receipt handlers
  const addReceipt = () => {
    setReceipts((prev) => [
      ...prev,
      {
        receiptNumber: "",
        sellingTotal: 0,
        paymentMethod: "MPESA",
        items: [],
      },
    ]);
  };

  const removeReceipt = (index: number) => {
    setReceipts((prev) => prev.filter((_, i) => i !== index));
  };

  const addItemToReceipt = (rIndex: number) => {
    setReceipts((prev) => {
      const copy = [...prev];
      copy[rIndex].items.push({ name: "", buyingPrice: 0 });
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

  const updateReceiptField = (rIndex: number, field: keyof Receipt, value: any) => {
    setReceipts((prev) => {
      const copy = [...prev];
      (copy[rIndex] as any)[field] = value;
      return copy;
    });
  };

  const updateReceiptItem = (rIndex: number, iIndex: number, field: keyof ReceiptItem, value: any) => {
    setReceipts((prev) => {
      const copy = [...prev];
      copy[rIndex].items = copy[rIndex].items.map((item, idx) => {
        if (idx !== iIndex) return item;
        return { ...item, [field]: value };
      });
      return copy;
    });
  };

  // Compute totals for display.  Profit is total selling minus sum of buying prices.
  const totalReceipts = receipts.length;
  const totalSales = receipts.reduce((sum, r) => sum + r.sellingTotal, 0);
  const totalItems = receipts.reduce((sum, r) => sum + r.items.length, 0);
  const totalProfit = receipts.reduce((profit, r) => {
    const cost = r.items.reduce((s, i) => s + i.buyingPrice, 0);
    return profit + (r.sellingTotal - cost);
  }, 0);

  // Submit handler – build payload with date, day, receipts, and checklist fields
  const [showConfirm, setShowConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Open confirm modal (preserves original behavior until confirmed)
  const handleSubmit = () => {
    setShowConfirm(true);
  };

  // Actual API submit logic executed when user confirms
  const submitToApi = async () => {
    setIsSubmitting(true);
    setSubmitError(null);
    try {
      // Build tasks payload: include existing fields and convert receipts into sales rows
      const sales = receipts.map((r) => ({
        productName: (r.items && r.items.length) ? r.items.map((it) => it.name).filter(Boolean).join(", ") : undefined,
        price: Number(r.sellingTotal || 0),
        paymentMethod: r.paymentMethod || undefined,
        receiptNumber: r.receiptNumber || undefined,
      }));

      const body = {
        date: selectedDate.toISOString().split("T")[0],
        day: dayName,
        receipts: receipts.map((r) => ({ ...r })),
        newProducts,
        productsEdited: productsEditedCount,
        copiesUploaded,
        walkInServed,
        purchasesMade,
        liveSessionsCount,
        commissionEarned,
        marketEngagement: {
          promoVideos,
          demoVideos,
          engagementReplies,
          allCommentsReplied,
        },
        concerns: concernsText,
        // keep original tasks for backward compatibility
        tasks: { ...fieldsState, sales },
        productsCount: totalItems,
        totalSales: totalSales,
      } as any;

      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || `HTTP ${res.status}`);
      }
      // Success — reset or give feedback
      const json = await res.json().catch(() => null);
      setShowConfirm(false);
      setIsSubmitting(false);
      alert(`Report submitted for ${dayName}.`);
      // Optionally reset the form
      resetDay();
      return json;
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : String(err ?? "Unknown error");
      setSubmitError(msg);
      console.error("daily report submit failed", err);
    }
  };

  // Reset all state to initial values
  const resetDay = () => {
    setFieldsState(createInitialState());
    setReceipts([
      { receiptNumber: "", sellingTotal: 0, paymentMethod: "MPESA", items: [] },
    ]);
  };

  // Determine which sections to show for the selected day
  const sections = dayConfig[dayName] ?? [];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      {/* Header: date + day pills */}
      <div className={cardClasses + " p-4 mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"}>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
              <CalendarIcon size={16} className="text-slate-400" />
              <input
                type="date"
                className="rounded-full border border-slate-700 bg-black/30 px-4 py-2 text-sm text-slate-100"
                value={selectedDate.toISOString().split("T")[0]}
                onChange={(e) => {
                  const d = new Date(e.target.value);
                  if (!isNaN(d.getTime())) setSelectedDate(d);
                }}
              />
          </div>
          <div className="hidden md:flex items-center gap-2">
            <span className="text-xs uppercase tracking-wide text-slate-400">Day</span>
            {[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((d) => {
              const active = d === dayName;
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => {
                    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
                    const targetIndex = days.indexOf(d);
                    const next = new Date(selectedDate);
                    const currentIndex = next.getDay();
                    const diff = targetIndex - currentIndex;
                    next.setDate(next.getDate() + diff);
                    setSelectedDate(next);
                  }}
                  className={`text-xs px-2 py-1 rounded-full border transition-colors ${
                    active
                      ? "bg-emerald-500 text-black border-emerald-600"
                      : "bg-transparent text-slate-200 border-slate-700 hover:bg-white/5"
                  }`}
                >
                  {d.slice(0, 3)}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/5"
              onClick={resetDay}
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="rounded-full px-5 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95"
            >
              Submit
            </button>
        </div>
      </div>

      {/* Top grid: receipts (2/3) and right column stats/communications (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: receipts - spans 2 columns on large screens */}
        <div className="lg:col-span-2">
          <div className={cardClasses + " p-6 space-y-4"}>
            <h2 className="text-lg font-semibold">Receipts</h2>
            <p className="text-sm text-slate-400">Add each receipt for today. Totals calculate automatically.</p>
            {receipts.map((receipt, rIndex) => (
              <div key={rIndex} className="border border-slate-700 rounded-xl p-4 space-y-3 bg-black/20">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                  <div>
                    <label className="text-xs uppercase tracking-wide text-slate-400">Selling (KES)</label>
                    <input
                      type="number"
                      className="w-full rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                      value={receipt.sellingTotal}
                      onChange={(e) => updateReceiptField(rIndex, "sellingTotal", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-slate-400">Receipt #</label>
                    <input
                      type="text"
                      className="w-full rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                      placeholder="Required"
                      value={receipt.receiptNumber}
                      onChange={(e) => updateReceiptField(rIndex, "receiptNumber", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs uppercase tracking-wide text-slate-400">Payment</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          receipt.paymentMethod === "MPESA"
                            ? "bg-emerald-500 text-black border-emerald-600"
                            : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                        }`}
                        onClick={() => updateReceiptField(rIndex, "paymentMethod", "MPESA")}
                      >
                        MPESA
                      </button>
                      <button
                        type="button"
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                          receipt.paymentMethod === "CASH"
                            ? "bg-emerald-500 text-black border-emerald-600"
                            : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"
                        }`}
                        onClick={() => updateReceiptField(rIndex, "paymentMethod", "CASH")}
                      >
                        Cash
                      </button>
                    </div>
                  </div>
                </div>

                {/* Items list */}
                <div className="space-y-2">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Products</label>
                  {receipt.items.map((item, iIndex) => (
                    <div key={iIndex} className="grid grid-cols-1 md:grid-cols-[3fr_1fr_auto] gap-2 items-center">
                      <input
                        type="text"
                        value={item.name}
                        className="rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                        onChange={(e) => updateReceiptItem(rIndex, iIndex, "name", e.target.value)}
                      />
                      <input
                        type="number"
                        value={item.buyingPrice}
                        className="rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                        onChange={(e) => updateReceiptItem(rIndex, iIndex, "buyingPrice", parseFloat(e.target.value) || 0)}
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
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-1 text-sm text-slate-200 hover:bg-white/5"
                      onClick={() => addItemToReceipt(rIndex)}
                    >
                      + Add product
                    </button>
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
                </div>
              </div>
            ))}

            <div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                onClick={addReceipt}
              >
                + Add receipt
              </button>
            </div>

            {/* Totals (compact) */}
            <div className="mt-2 flex flex-wrap gap-3 text-sm text-slate-300">
              <div className="px-3 py-1 bg-black/20 rounded-md">Receipts: {totalReceipts}</div>
              <div className="px-3 py-1 bg-black/20 rounded-md">Sales: KES {totalSales.toLocaleString()}</div>
              <div className="px-3 py-1 bg-black/20 rounded-md">Items: {totalItems}</div>
            </div>
          </div>
        </div>

        {/* Right column: stats & communications */}
        <div>
          <div className={cardClasses + " p-6 mb-6 space-y-4"}>
            <h3 className="text-lg font-semibold">Quick Stats</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm text-slate-300">
              <div className="bg-black/20 p-4 rounded-md flex flex-col">Receipts <span className="mt-2 text-2xl font-semibold text-emerald-400">{totalReceipts}</span></div>
              <div className="bg-black/20 p-4 rounded-md flex flex-col">Sales <span className="mt-2 text-2xl font-semibold text-emerald-400">KES {totalSales.toLocaleString()}</span></div>
              <div className="bg-black/20 p-4 rounded-md flex flex-col">New products <span className="mt-2 text-2xl font-semibold text-emerald-400">{newProducts}</span></div>
              <div className="bg-black/20 p-4 rounded-md flex flex-col">Products edited <span className="mt-2 text-2xl font-semibold text-emerald-400">{productsEditedCount}</span></div>
              <div className="bg-black/20 p-4 rounded-md flex flex-col">Copies uploaded <span className="mt-2 text-2xl font-semibold text-emerald-400">{copiesUploaded}</span></div>
              <div className="bg-black/20 p-4 rounded-md flex flex-col">Walk-ins served <span className="mt-2 text-2xl font-semibold text-emerald-400">{walkInServed}</span></div>
              <div className="bg-black/20 p-4 rounded-md flex flex-col">Purchases made <span className="mt-2 text-2xl font-semibold text-emerald-400">{purchasesMade}</span></div>
              <div className="bg-black/20 p-4 rounded-md flex flex-col">Live sessions <span className="mt-2 text-2xl font-semibold text-emerald-400">{liveSessionsCount}</span></div>
              <div className="bg-black/20 p-4 rounded-md flex flex-col">Commission <span className="mt-2 text-2xl font-semibold text-emerald-400">KES {commissionEarned}</span></div>
            </div>
          </div>

          <div className={cardClasses + " p-6 space-y-4"}>
            <h3 className="text-lg font-semibold">Communications</h3>
            <p className="text-sm text-slate-400">Short notes to marketing / ops teams</p>
            <textarea
              rows={4}
              className="w-full rounded-md border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="Mention follow-ups, urgent issues, or highlights..."
              value={fieldsState["notes"] || ""}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
            />
          </div>

          {/* Product & Stock Management card */}
          <div className={cardClasses + " p-6 mb-6 space-y-4"}>
            <h3 className="text-lg font-semibold">Product & Stock</h3>
            <p className="text-sm text-slate-400">Track uploads, edits and copies for the day.</p>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm w-1/2">New products uploaded</label>
                <input type="number" className="w-24 rounded-md border border-slate-700 bg-black/30 p-3 text-sm text-slate-100" value={newProducts} onChange={(e) => setNewProducts(parseInt(e.target.value || "0", 10))} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm w-1/2">Products edited</label>
                <input type="number" className="w-24 rounded-md border border-slate-700 bg-black/30 p-3 text-sm text-slate-100" value={productsEditedCount} onChange={(e) => setProductsEditedCount(parseInt(e.target.value || "0", 10))} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm w-1/2">Copies uploaded</label>
                <input type="number" className="w-24 rounded-md border border-slate-700 bg-black/30 p-3 text-sm text-slate-100" value={copiesUploaded} onChange={(e) => setCopiesUploaded(parseInt(e.target.value || "0", 10))} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm">Competitiveness confirmed</label>
                <input type="checkbox" className="h-4 w-4 rounded border-slate-700 bg-black/30 text-emerald-500" checked={confirmedCompetitiveness} onChange={(e) => setConfirmedCompetitiveness(e.target.checked)} />
              </div>
            </div>
          </div>

          {/* Customer Servicing compact card */}
          <div className={cardClasses + " p-6 mb-6 space-y-4"}>
            <h3 className="text-lg font-semibold">Customer Servicing</h3>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <label className="text-sm w-1/2">Walk-ins served</label>
                <input type="number" className="w-24 rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={walkInServed} onChange={(e) => setWalkInServed(parseInt(e.target.value || "0", 10))} />
              </div>
              <div className="flex items-center gap-3">
                <label className="text-sm w-1/2">Purchases made</label>
                <input type="number" className="w-24 rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={purchasesMade} onChange={(e) => setPurchasesMade(parseInt(e.target.value || "0", 10))} />
              </div>
            </div>
          </div>

          {/* Tuesday-only Market & Engagement card */}
          {dayName === "Tuesday" && (
            <div className={cardClasses + " p-6 mb-6 space-y-4"}>
              <h3 className="text-lg font-semibold">Tuesday — Market & Engagement</h3>
              <p className="text-sm text-slate-400">Record video outputs and engagement actions for Tuesday.</p>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <label className="text-sm w-1/2">Promo videos</label>
                  <input type="number" className="w-24 rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={promoVideos} onChange={(e) => setPromoVideos(parseInt(e.target.value || "0", 10))} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm w-1/2">Demo videos</label>
                  <input type="number" className="w-24 rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={demoVideos} onChange={(e) => setDemoVideos(parseInt(e.target.value || "0", 10))} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm w-1/2">Engagement replies</label>
                  <input type="number" className="w-24 rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={engagementReplies} onChange={(e) => setEngagementReplies(parseInt(e.target.value || "0", 10))} />
                </div>
                <div className="flex items-center gap-3">
                  <label className="text-sm">All comments replied</label>
                  <input type="checkbox" className="h-4 w-4 rounded border-slate-700 bg-black/30 text-emerald-500" checked={allCommentsReplied} onChange={(e) => setAllCommentsReplied(e.target.checked)} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom grid: live session (left) + notes / day sections (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        <div className="lg:col-span-2">
          {/* Render only the Live/Wednesday, Thursday weekly activities etc. as cards */}
          {sections.map((section) => (
            <div key={section.title} className={cardClasses + " p-6 mb-4 space-y-4"}>
              <h3 className="text-lg font-semibold">{section.title}</h3>
              <div className="space-y-3">
                {section.fields.map((field) => {
                  const value = fieldsState[field.key];
                  if (field.type === "boolean") {
                    return (
                      <label key={field.key} className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-slate-700 bg-black/30 text-emerald-500 focus:ring-emerald-500"
                          checked={value}
                          onChange={(e) => handleFieldChange(field.key, e.target.checked)}
                        />
                        <span className="text-sm">{field.label}</span>
                      </label>
                    );
                  }
                  if (field.type === "number") {
                    return (
                      <div key={field.key} className="flex items-center gap-3">
                        <label className="text-sm w-1/2">{field.label}</label>
                        <input
                          type="number"
                          className="w-24 rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                          value={value}
                          onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    );
                  }
                  if (field.type === "text") {
                    return (
                      <div key={field.key} className="flex flex-col gap-2">
                        <label className="text-sm">{field.label}</label>
                        <textarea
                          rows={3}
                          className="rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                          value={value}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        />
                      </div>
                    );
                  }
                  if (field.type === "select" && field.options) {
                    return (
                      <div key={field.key} className="flex items-center gap-3">
                        <label className="text-sm w-1/2">{field.label}</label>
                        <select
                          className="w-40 rounded-md border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                          value={value}
                          onChange={(e) => handleFieldChange(field.key, e.target.value)}
                        >
                          {field.options.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
        </div>

        <div>
          <div className={cardClasses + " p-6 space-y-4"}>
            <h3 className="text-lg font-semibold">Notes / Summary</h3>
            <textarea
              rows={8}
              className="w-full rounded-md border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
              placeholder="Any additional comments, highlights or issues…"
              value={fieldsState["notes"] || ""}
              onChange={(e) => handleFieldChange("notes", e.target.value)}
            />
            <div className="flex justify-center">
              <button
                type="button"
                className="mt-2 rounded-full px-6 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95"
                onClick={handleSubmit}
              >
                Submit report
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* Confirmation modal for submit */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => !isSubmitting && setShowConfirm(false)} />
          <div className={cardClasses + " z-60 p-6 w-full max-w-lg mx-4"} role="dialog" aria-modal="true">
            <h3 className="text-lg font-semibold">Confirm submit</h3>
            <p className="text-sm text-slate-300 mt-2">You're about to submit the report for <strong>{dayName}</strong> ({selectedDate.toISOString().split('T')[0]}).</p>
            <div className="mt-4 text-sm text-slate-300 space-y-2">
              <div>Receipts: <strong className="text-emerald-400">{totalReceipts}</strong></div>
              <div>Total sales: <strong className="text-emerald-400">KES {totalSales.toLocaleString()}</strong></div>
              <div>Total items: <strong className="text-emerald-400">{totalItems}</strong></div>
            </div>
            {submitError && <div className="mt-3 text-sm text-red-400">Error: {submitError}</div>}
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                className="rounded-full border border-white/10 px-3 py-1 text-sm text-slate-200 hover:bg-white/5"
                onClick={() => !isSubmitting && setShowConfirm(false)}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="rounded-full px-4 py-1 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95"
                onClick={() => !isSubmitting && submitToApi()}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Submitting…" : "Confirm & Submit"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
