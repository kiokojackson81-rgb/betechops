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
  const handleSubmit = () => {
    const payload = {
      date: selectedDate.toISOString().split("T")[0],
      day: dayName,
      receipts: receipts.map((r) => ({
        receiptNumber: r.receiptNumber,
        sellingTotal: r.sellingTotal,
        paymentMethod: r.paymentMethod,
        items: r.items,
      })),
      fields: fieldsState,
    };
    console.log("Submitting payload", payload);
    // TODO: call your API to save the report
    alert(`Report submitted for ${dayName} – check the console for payload.`);
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
      {/* Date & Day selector bar */}
      <div className={cardClasses + " p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"}>
        {/* Date selector */}
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
        {/* Day selector */}
        <div className="flex flex-col gap-2 w-full md:w-auto">
          <label className="text-xs uppercase tracking-wide text-slate-400">Day of week</label>
          <select
            className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
            value={dayName}
            onChange={(e) => {
              const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
              const targetIndex = days.indexOf(e.target.value);
              const next = new Date(selectedDate);
              const currentIndex = next.getDay();
              const diff = targetIndex - currentIndex;
              next.setDate(next.getDate() + diff);
              setSelectedDate(next);
            }}
          >
            {[
              "Sunday",
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
            ].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        {/* Action buttons */}
        <div className="flex items-end gap-4">
          <button
            type="button"
            className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
            onClick={resetDay}
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

      {/* Receipt entry section */}
      <div className={cardClasses + " p-6 space-y-4"}>
        <h2 className="text-lg font-semibold">Add each receipt for today</h2>
        <p className="text-sm text-slate-400">Totals are calculated automatically.</p>
        {receipts.map((receipt, rIndex) => (
          <div key={rIndex} className="border border-slate-700 rounded-xl p-4 space-y-4 bg-black/20">
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
                    className={`px-4 py-1 rounded-full text-xs font-medium border transition-colors ${
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
                    className={`px-4 py-1 rounded-full text-xs font-medium border transition-colors ${
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
              <label className="text-xs uppercase tracking-wide text-slate-400">Products in this receipt</label>
              {receipt.items.map((item, iIndex) => (
                <div
                  key={iIndex}
                  className="grid grid-cols-1 md:grid-cols-[3fr_1fr_auto] gap-2 items-center"
                >
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
                className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
                onClick={() => addItemToReceipt(rIndex)}
              >
                + Add product to this receipt
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
        <button
          type="button"
          className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5"
          onClick={addReceipt}
        >
          + Add receipt
        </button>

        {/* Totals summary */}
        <div className="mt-4 flex flex-col gap-1 text-sm text-slate-400">
          <span>Total receipts: {totalReceipts}</span>
          <span>Total sales (KES): {totalSales.toLocaleString()}</span>
          <span>Total profit (KES): {totalProfit.toLocaleString()}</span>
          <span>Total items: {totalItems}</span>
        </div>
      </div>

      {/* Dynamic checklist sections based on day */}
      {sections.map((section) => (
        <div key={section.title} className={cardClasses + " p-6 space-y-4"}>
          <h3 className="text-lg font-semibold">{section.title}</h3>
          {/* Fields rendering */}
          <div className="space-y-4">
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
                  <div key={field.key} className="flex flex-col md:flex-row md:items-center gap-2">
                    <label className="text-sm md:w-1/2">{field.label}</label>
                    <input
                      type="number"
                      className="md:w-1/2 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
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
                      className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
                      value={value}
                      onChange={(e) => handleFieldChange(field.key, e.target.value)}
                    />
                  </div>
                );
              }
              if (field.type === "select" && field.options) {
                return (
                  <div key={field.key} className="flex flex-col md:flex-row md:items-center gap-2">
                    <label className="text-sm md:w-1/2">{field.label}</label>
                    <select
                      className="md:w-1/2 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100"
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

      {/* Notes / Summary */}
      <div className={cardClasses + " p-6 space-y-2"}>
        <label className="text-sm font-semibold">Notes / Summary</label>
        <textarea
          rows={4}
          className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
          placeholder="Any additional comments, highlights or issues…"
          value={fieldsState["notes"] || ""}
          onChange={(e) => handleFieldChange("notes", e.target.value)}
        />
      </div>
    </div>
  );
}
