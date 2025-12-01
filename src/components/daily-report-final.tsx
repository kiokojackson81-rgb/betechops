"use client";

/**
 * Final redesign for the marketing attendant daily report page.
 *
 * This component retains every data-entry field from the original daily report
 * while adopting the dark, card-based layout used in the marketing tracker.
 * It supports multi-receipt entry, per-day checklists with booleans and
 * numeric counts, live session details for Wednesday and Saturday, and
 * weekly marketing activities on Thursday.  All inputs are grouped into
 * cards with consistent styling.  The state is maintained in a single
 * object keyed by field identifiers, making it easy to construct a
 * submission payload matching the existing API.
 */

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
  "use client";

  import { useState } from "react";
  import { CalendarIcon } from "lucide-react";

  const cardClasses =
    "rounded-2xl border border-white/10 bg-[var(--card,#171b23)] border-slate-800 bg-slate-900/60 shadow-xl shadow-black/20";

  function getWeekday(date: Date): string {
    return date.toLocaleDateString("en-US", { weekday: "long" });
  }

  type FieldDef = {
    key: string;
    label: string;
    type: "boolean" | "number" | "text" | "select";
    options?: string[];
  };

  type SectionDef = {
    title: string;
    fields: FieldDef[];
  };

  const dayConfig: Record<string, SectionDef[]> = {
    Monday: [
      {
        title: "Walk‑ins & Shop Neatness",
        fields: [
          { key: "walkInsWhoPurchased", label: "Walk‑ins who purchased", type: "number" },
          { key: "shopCleaned", label: "Shop cleaned", type: "boolean" },
          { key: "shopNeatness", label: "Shop neatness", type: "boolean" },
          { key: "displayLabeled", label: "Display labeled", type: "boolean" },
        ],
      },
      {
        title: "Product & Stock Management",
        fields: [
          { key: "productsUploaded", label: "Products uploaded", type: "number" },
          { key: "productsEdited", label: "Products edited", type: "number" },
          { key: "productsCopied", label: "Products copied", type: "number" },
        ],
      },
    ],
    Tuesday: [
      {
        title: "Product Marketing Output (Videos)",
        fields: [
          { key: "recordedPromotionalVideos", label: "Recorded promotional videos", type: "boolean" },
          { key: "recordedDemoVideos", label: "Recorded demo videos", type: "boolean" },
        ],
      },
    ],
    Wednesday: [
      {
        title: "Live Session & Content Output",
        fields: [
          { key: "liveSessionHostedWednesday", label: "Hosted live session", type: "boolean" },
          { key: "generatedLeadsWednesday", label: "Generated leads", type: "boolean" },
        ],
      },
    ],
    Thursday: [
      {
        title: "Weekly Marketing Activities",
        fields: [
          { key: "weeklyMeetingAttended", label: "Weekly marketing meeting attended", type: "boolean" },
        ],
      },
    ],
    Friday: [
      {
        title: "Promotional Preparation",
        fields: [
          { key: "shotPromotionalVideos", label: "Shot promotional videos", type: "boolean" },
        ],
      },
    ],
    Saturday: [
      {
        title: "Live Sessions & Weekend Prep",
        fields: [
          { key: "liveSessionHostedSaturday", label: "Hosted live session", type: "boolean" },
        ],
      },
    ],
  };

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
    return state;
  }

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
    const [selectedDate, setSelectedDate] = useState(() => new Date());
    const dayName = getWeekday(selectedDate);
    const [fieldsState, setFieldsState] = useState<Record<string, any>>(() => createInitialState());
    const [receipts, setReceipts] = useState<Receipt[]>([{
      receiptNumber: "",
      sellingTotal: 0,
      paymentMethod: "MPESA",
      items: [],
    }]);

    const handleFieldChange = (key: string, value: any) => setFieldsState((p) => ({ ...p, [key]: value }));

    const addReceipt = () => setReceipts((p) => [...p, { receiptNumber: "", sellingTotal: 0, paymentMethod: "MPESA", items: [] }]);
    const removeReceipt = (i: number) => setReceipts((p) => p.filter((_, idx) => idx !== i));
    const addItemToReceipt = (rIndex: number) => setReceipts((p) => { const c = [...p]; c[rIndex].items.push({ name: "", buyingPrice: 0 }); return c; });
    const removeItemFromReceipt = (rIndex: number, iIndex: number) => setReceipts((p) => { const c = [...p]; c[rIndex].items = c[rIndex].items.filter((_, idx) => idx !== iIndex); return c; });
    const updateReceiptField = (rIndex: number, field: keyof Receipt, value: any) => setReceipts((p) => { const c = [...p]; (c[rIndex] as any)[field] = value; return c; });
    const updateReceiptItem = (rIndex: number, iIndex: number, field: keyof ReceiptItem, value: any) => setReceipts((p) => { const c = [...p]; c[rIndex].items = c[rIndex].items.map((it, idx) => idx === iIndex ? { ...it, [field]: value } : it); return c; });

    const totalReceipts = receipts.length;
    const totalSales = receipts.reduce((s, r) => s + r.sellingTotal, 0);
    const totalItems = receipts.reduce((s, r) => s + r.items.length, 0);
    const totalProfit = receipts.reduce((profit, r) => profit + (r.sellingTotal - r.items.reduce((s, i) => s + i.buyingPrice, 0)), 0);

    const handleSubmit = () => {
      const payload = { date: selectedDate.toISOString().split("T")[0], day: dayName, receipts, fields: fieldsState };
      console.log("Submitting payload", payload);
      alert(`Report submitted for ${dayName}`);
    };

    const resetDay = () => { setFieldsState(createInitialState()); setReceipts([{ receiptNumber: "", sellingTotal: 0, paymentMethod: "MPESA", items: [] }]); };

    const sections = dayConfig[dayName] ?? [];

    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 space-y-8">
        <div className={cardClasses + " p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4"}>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-xs uppercase tracking-wide text-slate-400">Date</label>
            <div className="flex items-center gap-2">
              <CalendarIcon size={16} className="text-slate-400" />
              <input type="date" className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={selectedDate.toISOString().split("T")[0]} onChange={(e) => { const d = new Date(e.target.value); if (!isNaN(d.getTime())) setSelectedDate(d); }} />
            </div>
          </div>
          <div className="flex flex-col gap-2 w-full md:w-auto">
            <label className="text-xs uppercase tracking-wide text-slate-400">Day of week</label>
            <select className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={sections.length ? sections[0].title : getWeekday(selectedDate)} onChange={() => {}}>
              {Object.keys(dayConfig).map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="flex items-end gap-4">
            <button type="button" className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={resetDay}>Reset day</button>
            <button type="button" className="rounded-xl px-4 py-2 text-sm font-semibold bg-emerald-500 text-black hover:brightness-95" onClick={handleSubmit}>Submit report</button>
          </div>
        </div>

        <div className={cardClasses + " p-6 space-y-4"}>
          <h2 className="text-lg font-semibold">Add each receipt for today</h2>
          <p className="text-sm text-slate-400">Totals are calculated automatically.</p>
          {receipts.map((receipt, rIndex) => (
            <div key={rIndex} className="border border-slate-700 rounded-xl p-4 space-y-4 bg-black/20">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Selling total (KES)</label>
                  <input type="number" className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={receipt.sellingTotal} onChange={(e) => updateReceiptField(rIndex, "sellingTotal", parseFloat(e.target.value) || 0)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Receipt number (required)</label>
                  <input type="text" className="w-full rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" placeholder="Required" value={receipt.receiptNumber} onChange={(e) => updateReceiptField(rIndex, "receiptNumber", e.target.value)} />
                </div>
                <div className="space-y-1">
                  <label className="text-xs uppercase tracking-wide text-slate-400">Payment method (required)</label>
                  <div className="flex items-center gap-2">
                    <button type="button" className={`px-4 py-1 rounded-full text-xs font-medium border transition-colors ${receipt.paymentMethod === "MPESA" ? "bg-emerald-500 text-black border-emerald-600" : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"}`} onClick={() => updateReceiptField(rIndex, "paymentMethod", "MPESA")}>MPESA</button>
                    <button type="button" className={`px-4 py-1 rounded-full text-xs font-medium border transition-colors ${receipt.paymentMethod === "CASH" ? "bg-emerald-500 text-black border-emerald-600" : "bg-slate-800 text-slate-200 border-slate-700 hover:bg-slate-700"}`} onClick={() => updateReceiptField(rIndex, "paymentMethod", "CASH")}>Cash</button>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-wide text-slate-400">Products in this receipt</label>
                {receipt.items.map((item, iIndex) => (
                  <div key={iIndex} className="grid grid-cols-1 md:grid-cols-[3fr_1fr_auto] gap-2 items-center">
                    <input type="text" value={item.name} className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" onChange={(e) => updateReceiptItem(rIndex, iIndex, "name", e.target.value)} />
                    <input type="number" value={item.buyingPrice} className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" onChange={(e) => updateReceiptItem(rIndex, iIndex, "buyingPrice", parseFloat(e.target.value) || 0)} />
                    <button type="button" className="text-xs text-red-400 hover:text-red-300" onClick={() => removeItemFromReceipt(rIndex, iIndex)}>Remove</button>
                  </div>
                ))}
                <button type="button" className="mt-2 inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={() => addItemToReceipt(rIndex)}>+ Add product to this receipt</button>
              </div>
              {receipts.length > 1 && <button type="button" className="text-xs text-red-400 hover:text-red-300" onClick={() => removeReceipt(rIndex)}>Remove receipt</button>}
            </div>
          ))}
          <button type="button" className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 hover:bg-white/5" onClick={addReceipt}>+ Add receipt</button>
          <div className="mt-4 flex flex-col gap-1 text-sm text-slate-400">
            <span>Total receipts: {totalReceipts}</span>
            <span>Total sales (KES): {totalSales.toLocaleString()}</span>
            <span>Total profit (KES): {totalProfit.toLocaleString()}</span>
            <span>Total items: {totalItems}</span>
          </div>
        </div>

        {sections.map((section) => (
          <div key={section.title} className={cardClasses + " p-6 space-y-4"}>
            <h3 className="text-lg font-semibold">{section.title}</h3>
            <div className="space-y-4">
              {section.fields.map((field) => {
                const value = fieldsState[field.key];
                if (field.type === "boolean") return (
                  <label key={field.key} className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4 rounded border-slate-700 bg-black/30 text-emerald-500 focus:ring-emerald-500" checked={value} onChange={(e) => handleFieldChange(field.key, e.target.checked)} /><span className="text-sm">{field.label}</span></label>
                );
                if (field.type === "number") return (
                  <div key={field.key} className="flex flex-col md:flex-row md:items-center gap-2"><label className="text-sm md:w-1/2">{field.label}</label><input type="number" className="md:w-1/2 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={value} onChange={(e) => handleFieldChange(field.key, parseFloat(e.target.value) || 0)} /></div>
                );
                if (field.type === "text") return (
                  <div key={field.key} className="flex flex-col gap-2"><label className="text-sm">{field.label}</label><textarea rows={3} className="rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={value} onChange={(e) => handleFieldChange(field.key, e.target.value)} /></div>
                );
                if (field.type === "select" && field.options) return (
                  <div key={field.key} className="flex flex-col md:flex-row md:items-center gap-2"><label className="text-sm md:w-1/2">{field.label}</label><select className="md:w-1/2 rounded-lg border border-slate-700 bg-black/30 px-2 py-1 text-sm text-slate-100" value={value} onChange={(e) => handleFieldChange(field.key, e.target.value)}>{field.options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}</select></div>
                );
                return null;
              })}
            </div>
          </div>
        ))}

        <div className={cardClasses + " p-6 space-y-2"}>
          <label className="text-sm font-semibold">Notes / Summary</label>
          <textarea rows={4} className="w-full rounded-lg border border-slate-700 bg-black/30 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500" placeholder="Any additional comments, highlights or issues…" value={fieldsState["notes"] || ""} onChange={(e) => handleFieldChange("notes", e.target.value)} />
        </div>
      </div>
    );
  }
