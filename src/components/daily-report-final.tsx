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

function formatShortDate(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getTradingPeriodFor(date: Date): string {
  const start = new Date(date);
  start.setDate(1);
  start.setMonth(start.getMonth() - 1);
  start.setDate(25);

  const end = new Date(date);
  end.setDate(1);
  end.setMonth(end.getMonth() + 1);
  end.setDate(24);

  return `${formatShortDate(start)} – ${formatShortDate(end)}`;
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
        confirmedCompetitiveness,
        marketEngagement: {
          promoVideos,
          demoVideos,
          engagementReplies,
          allCommentsReplied,
        },
        concerns: fieldsState["notes"] || "",
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
    setNewProducts(0);
    setProductsEditedCount(0);
    setCopiesUploaded(0);
    setWalkInServed(0);
    setPurchasesMade(0);
    setLiveSessionsCount(0);
    setCommissionEarned(0);
    setConfirmedCompetitiveness(false);
    setPromoVideos(0);
    setDemoVideos(0);
    setEngagementReplies(0);
    setAllCommentsReplied(false);
  };

  // Determine which sections to show for the selected day
  const sections = dayConfig[dayName] ?? [];
  const weekDays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const liveSectionTitle =
    dayName === "Wednesday"
      ? "Live Session Details"
      : dayName === "Saturday"
      ? "Light Live Session"
      : null;
  const liveSection = liveSectionTitle
    ? sections.find((section) => section.title === liveSectionTitle)
    : undefined;
  const tradingPeriod = getTradingPeriodFor(selectedDate);

  const renderFieldControl = (field: FieldDef) => {
    const value = fieldsState[field.key];
    if (field.type === "boolean") {
      return (
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-slate-700 bg-black/30 text-emerald-500 focus:ring-emerald-500"
            checked={Boolean(value)}
            onChange={(e) => handleFieldChange(field.key, e.target.checked)}
          />
          <span className="text-sm">{field.label}</span>
        </label>
      );
    }
    if (field.type === "number") {
      return (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <span className="text-sm md:w-1/2">{field.label}</span>
          <input
            type="number"
            className="md:w-1/2 w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
            value={value ?? 0}
            onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value) || 0)}
          />
        </div>
      );
    }
    if (field.type === "text") {
      return (
        <div className="flex flex-col gap-2">
          <span className="text-sm">{field.label}</span>
          <textarea
            rows={3}
            className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
            value={value ?? ""}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
          />
        </div>
      );
    }
    if (field.type === "select" && field.options) {
      return (
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <span className="text-sm md:w-1/2">{field.label}</span>
          <select
            className="md:w-1/2 w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
            value={value ?? field.options[0]}
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
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-6">
      <div className={cardClasses + " p-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"}>
        <div className="flex flex-col gap-2">
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
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide text-slate-400">Day of week</label>
          <select
            className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
            value={dayName}
            onChange={(e) => {
              const targetIndex = weekDays.indexOf(e.target.value);
              const next = new Date(selectedDate);
              const diff = targetIndex - next.getDay();
              next.setDate(next.getDate() + diff);
              setSelectedDate(next);
            }}
          >
            {weekDays.map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200 hover:bg-white/5"
            onClick={resetDay}
          >
            Reset day
          </button>
          <button
            type="button"
            className="rounded-full px-4 py-1.5 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95"
            onClick={handleSubmit}
          >
            Submit report
          </button>
        </div>
      </div>

      <div className="md:grid md:grid-cols-2 md:gap-6">
        <div className="flex flex-col gap-6">
          <div className={cardClasses + " p-6 space-y-5"}>
            <div>
              <h2 className="text-2xl font-semibold">Receipts</h2>
              <p className="text-sm text-slate-400">Add each receipt for today. Totals calculate automatically.</p>
            </div>
            {receipts.map((receipt, rIndex) => (
              <div key={rIndex} className="border border-slate-800 bg-black/20 rounded-2xl p-4 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wide text-slate-400">Selling total (KES)</label>
                    <input
                      type="number"
                      className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                      value={receipt.sellingTotal}
                      onChange={(e) => updateReceiptField(rIndex, "sellingTotal", parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wide text-slate-400">Receipt number (required)</label>
                    <input
                      type="text"
                      className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                      placeholder="Required"
                      value={receipt.receiptNumber}
                      onChange={(e) => updateReceiptField(rIndex, "receiptNumber", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs uppercase tracking-wide text-slate-400">Payment method (required)</label>
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
                <div className="space-y-3">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Products in this receipt</label>
                  {receipt.items.map((item, iIndex) => (
                    <div key={iIndex} className="grid grid-cols-1 md:grid-cols-[3fr_1fr_auto] gap-2 items-center">
                      <input
                        type="text"
                        value={item.name}
                        className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                        onChange={(e) => updateReceiptItem(rIndex, iIndex, "name", e.target.value)}
                      />
                      <input
                        type="number"
                        value={item.buyingPrice}
                        className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
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
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                    onClick={() => addItemToReceipt(rIndex)}
                  >
                    + Add product to this receipt
                  </button>
                </div>
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
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                onClick={addReceipt}
              >
                + Add receipt
              </button>
              <div className="flex flex-wrap gap-3 text-sm text-slate-300">
                <span>Receipts: {totalReceipts}</span>
                <span>Sales: KES {totalSales.toLocaleString()}</span>
                <span>Items: {totalItems}</span>
              </div>
            </div>
          </div>
          {liveSection && (
            <div className={cardClasses + " p-6 space-y-4"}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{liveSection.title}</h3>
                <span className="text-xs text-slate-400">Live details for {dayName}</span>
              </div>
              <div className="space-y-3">
                {liveSection.fields.map((field) => (
                  <div key={field.key}>{renderFieldControl(field)}</div>
                ))}
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm">Live sessions held</label>
                  <input
                    type="number"
                    className="w-20 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                    value={liveSessionsCount}
                    onChange={(e) => setLiveSessionsCount(parseInt(e.target.value || "0", 10))}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="flex flex-col gap-6">
          <div className={cardClasses + " p-6 space-y-3"}>
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Quick Stats</h2>
              <span className="text-xs text-slate-400">Trading period: {tradingPeriod}</span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-black/20 rounded-2xl p-3">
                <span className="text-sm opacity-70">Receipts</span>
                <h3 className="text-2xl font-semibold text-emerald-400">{totalReceipts}</h3>
              </div>
              <div className="bg-black/20 rounded-2xl p-3">
                <span className="text-sm opacity-70">Sales</span>
                <h3 className="text-2xl font-semibold text-emerald-400">KES {totalSales.toLocaleString()}</h3>
              </div>
              <div className="bg-black/20 rounded-2xl p-3">
                <span className="text-sm opacity-70">New products</span>
                <h3 className="text-2xl font-semibold text-emerald-400">{newProducts}</h3>
              </div>
              <div className="bg-black/20 rounded-2xl p-3">
                <span className="text-sm opacity-70">Products edited</span>
                <h3 className="text-2xl font-semibold text-emerald-400">{productsEditedCount}</h3>
              </div>
              <div className="bg-black/20 rounded-2xl p-3">
                <span className="text-sm opacity-70">Copies uploaded</span>
                <h3 className="text-2xl font-semibold text-emerald-400">{copiesUploaded}</h3>
              </div>
              <div className="bg-black/20 rounded-2xl p-3">
                <span className="text-sm opacity-70">Walk-ins served</span>
                <h3 className="text-2xl font-semibold text-emerald-400">{walkInServed}</h3>
              </div>
              <div className="bg-black/20 rounded-2xl p-3">
                <span className="text-sm opacity-70">Purchases made</span>
                <h3 className="text-2xl font-semibold text-emerald-400">{purchasesMade}</h3>
              </div>
              <div className="bg-black/20 rounded-2xl p-3">
                <span className="text-sm opacity-70">Live sessions held</span>
                <h3 className="text-2xl font-semibold text-emerald-400">{liveSessionsCount}</h3>
              </div>
              <div className="bg-black/20 rounded-2xl p-3">
                <span className="text-sm opacity-70">Commission earned</span>
                <h3 className="text-2xl font-semibold text-emerald-400">KES {commissionEarned.toLocaleString()}</h3>
                <p className="text-[10px] text-slate-500">Placeholder</p>
              </div>
            </div>
          </div>
          {dayName === "Tuesday" && (
            <div className={cardClasses + " p-6 space-y-3"}>
              <h3 className="text-lg font-semibold">Market & Engagement</h3>
              <p className="text-sm text-slate-400">Document Tuesday video outputs and engagement actions.</p>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm">Promo videos posted</label>
                  <input
                    type="number"
                    className="w-20 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                    value={promoVideos}
                    onChange={(e) => setPromoVideos(parseInt(e.target.value || "0", 10))}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm">Demo videos recorded</label>
                  <input
                    type="number"
                    className="w-20 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                    value={demoVideos}
                    onChange={(e) => setDemoVideos(parseInt(e.target.value || "0", 10))}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm">Engagement replies</label>
                  <input
                    type="number"
                    className="w-20 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                    value={engagementReplies}
                    onChange={(e) => setEngagementReplies(parseInt(e.target.value || "0", 10))}
                  />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <label className="text-sm">All comments replied</label>
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-700 bg-black/30 text-emerald-500"
                    checked={allCommentsReplied}
                    onChange={(e) => setAllCommentsReplied(e.target.checked)}
                  />
                </div>
              </div>
              <p className="text-xs text-slate-500">Confirm every FB/IG comment and DM was handled today.</p>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation modal for submit */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => !isSubmitting && setShowConfirm(false)} />
          <div className={cardClasses + " z-60 p-4 w-full max-w-lg mx-4"} role="dialog" aria-modal="true">
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
