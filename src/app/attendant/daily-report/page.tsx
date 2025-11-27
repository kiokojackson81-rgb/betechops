"use client";

import { useState } from "react";
import Button from "@/app/_components/Button";
import Card from "@/app/_components/Card";
import { showToast } from "@/lib/ui/toast";

// Mapping of day names to their respective task definitions.  Each task
// definition has a unique name, a label for the form, and an input type.
const dayTaskDefinitions: Record<string, { name: string; label: string; type: "number" | "checkbox" | "text" }[]> = {
  MONDAY: [
    { name: "stockChecked", label: "Stock checked?", type: "checkbox" },
    { name: "productsUploaded", label: "Products uploaded", type: "number" },
    { name: "customerInquiriesHandled", label: "Customer inquiries handled", type: "number" },
    { name: "walkInSalesAssisted", label: "Walk‑in sales assisted", type: "number" },
    { name: "competitorNotes", label: "Notes on competitors", type: "text" },
  ],
  TUESDAY: [
    { name: "productsUploaded", label: "Products uploaded", type: "number" },
    { name: "promotionalVideosPosted", label: "Promotional videos posted", type: "number" },
    { name: "demoVideosRecorded", label: "Demo videos recorded", type: "number" },
    { name: "customerEngagements", label: "Customer engagements (comments/DMs)", type: "number" },
    { name: "customersServed", label: "Customers served", type: "number" },
    { name: "competitorNotes", label: "Notes on competitors", type: "text" },
  ],
  WEDNESDAY: [
    { name: "liveSessionsHosted", label: "Live sessions hosted", type: "number" },
    { name: "productsUploaded", label: "Products uploaded", type: "number" },
    { name: "marketingClipsPosted", label: "Marketing clips posted", type: "number" },
    { name: "leadsFollowedUp", label: "Leads followed up", type: "number" },
    { name: "customersServed", label: "Customers served", type: "number" },
    { name: "engagementInsights", label: "Top engagement insights", type: "text" },
  ],
  THURSDAY: [
    { name: "marketingMeetingAttended", label: "Attended marketing meeting", type: "checkbox" },
    { name: "videoShootParticipated", label: "Participated in video shoot", type: "checkbox" },
    { name: "productsUploaded", label: "Products uploaded", type: "number" },
    { name: "marketingVideosPosted", label: "Marketing videos posted", type: "number" },
    { name: "officeMaintenance", label: "Office cleaned and organized", type: "checkbox" },
    { name: "customersServed", label: "Customers served", type: "number" },
  ],
  FRIDAY: [
    { name: "productsUploaded", label: "Products uploaded", type: "number" },
    { name: "testimonialsPosted", label: "Testimonials or product videos posted", type: "number" },
    { name: "clientsServed", label: "Online/in‑store clients served", type: "number" },
    { name: "officeMaintenance", label: "Office & photo area cleaned", type: "checkbox" },
    { name: "promotionsPrepared", label: "Weekend promotions prepared", type: "checkbox" },
    { name: "improvementSuggestions", label: "Improvement suggestions", type: "text" },
  ],
  SATURDAY: [
    { name: "productsUploaded", label: "Products uploaded/updated", type: "number" },
    { name: "customersServed", label: "Walk‑in customers served", type: "number" },
    { name: "lightLiveSessionsHosted", label: "Light live sessions or recap videos hosted", type: "number" },
    { name: "officeMaintenance", label: "Office/display area cleaned", type: "checkbox" },
    { name: "weeklySummarySubmitted", label: "Weekly summary submitted", type: "checkbox" },
    { name: "weeklySummaryDetails", label: "Weekly summary details", type: "text" },
  ],
};

// Determine today’s day of week in upper case (MONDAY .. SUNDAY).  Uses the
// browser’s locale; defaults to MONDAY if locale is unavailable.
function getTodayDay(): string {
  try {
    const days = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
    const idx = new Date().getDay();
    return days[idx];
  } catch {
    return "MONDAY";
  }
}

export default function DailyReportForm() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState<string>(today);
  const [day, setDay] = useState<string>(getTodayDay());
  const [productsCount, setProductsCount] = useState<string>("");
  const [totalSales, setTotalSales] = useState<string>("");
  const [salesRecords, setSalesRecords] = useState<Array<{ productName: string; price: string }>>([
    { productName: "", price: "" },
  ]);
  const [newUploads, setNewUploads] = useState<string>("");
  const [copiesUploaded, setCopiesUploaded] = useState<string>("");
  const [productsEdited, setProductsEdited] = useState<string>("");
  const [taskValues, setTaskValues] = useState<Record<string, any>>({});
  const [message, setMessage] = useState<string>("");
  const tasksForDay = dayTaskDefinitions[day] || [];

  // Handle change for dynamic task inputs
  function handleTaskChange(name: string, value: any) {
    setTaskValues((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    // basic validation
    const errors: string[] = [];
    if (!day) errors.push("Please select the day of week.");
    if (productsCount && Number(productsCount) < 0) errors.push("Products count cannot be negative.");
    if (totalSales && Number(totalSales) < 0) errors.push("Total sales cannot be negative.");
    // validate sales rows
    for (let i = 0; i < salesRecords.length; i++) {
      const r = salesRecords[i];
      if (r.productName && r.productName.trim().length === 0) errors.push(`Sale #${i + 1}: product name is required`);
      if (r.price && Number(r.price) < 0) errors.push(`Sale #${i + 1}: price cannot be negative`);
    }
    if (errors.length) {
      setMessage(errors.join(" "));
      return;
    }
    // Build tasks object; convert numeric strings to numbers and
    // unchecked checkboxes to false
    const normalizedTasks: Record<string, any> = {};
    for (const def of tasksForDay) {
      const val = taskValues[def.name];
      if (def.type === "number") {
        normalizedTasks[def.name] = val ? Number(val) : 0;
      } else if (def.type === "checkbox") {
        normalizedTasks[def.name] = Boolean(val);
      } else {
        normalizedTasks[def.name] = val || "";
      }
    }
    // attach sales records and categorized counts into tasks
    const normalizedSales = salesRecords
      .filter((s) => s.productName || s.price)
      .map((s) => ({ productName: s.productName || "", price: Number(s.price || 0) }));
    normalizedTasks.sales = normalizedSales;
    normalizedTasks.categories = {
      newUploads: Number(newUploads) || 0,
      copiesUploaded: Number(copiesUploaded) || 0,
      productsEdited: Number(productsEdited) || 0,
    };
    try {
      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          day,
          productsCount: Number(productsCount) || 0,
          totalSales: Number(totalSales) || 0,
          tasks: normalizedTasks,
        }),
      });
      if (res.ok) {
        setProductsCount("");
        setTotalSales("");
        setTaskValues({});
        setSalesRecords([{ productName: "", price: "" }]);
        setNewUploads("");
        setCopiesUploaded("");
        setProductsEdited("");
          showToast("Report saved successfully.", "success");
        // briefly show success then clear
        setTimeout(() => setMessage(""), 3000);
      } else {
        const data = await res.json().catch(() => ({}));
          showToast(data.error || "Failed to save report.", "error");
      }
    } catch {
        showToast("Failed to save report.", "error");
    }
  }

  function addSaleRow() {
    setSalesRecords((s) => [...s, { productName: "", price: "" }]);
  }
  function removeSaleRow(idx: number) {
    setSalesRecords((s) => s.filter((_, i) => i !== idx));
  }
  function updateSaleRow(idx: number, key: "productName" | "price", value: string) {
    setSalesRecords((s) => s.map((r, i) => (i === idx ? { ...r, [key]: value } : r)));
  }

  return (
    <div className="mx-auto max-w-3xl p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Daily Performance Report</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-1">
            <label className="text-sm mb-1 block">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="text-sm mb-1 block">Day</label>
            <select
              value={day}
              onChange={(e) => { setDay(e.target.value); setTaskValues({}); }}
              className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
            >
              {Object.keys(dayTaskDefinitions).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          {/* Products and Total Sales fields removed from top - moved/hidden per design */}
        </div>
        {/* Jumia / Kilimall Operations (moved directly below date/day) */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Jumia / Kilimall Operations</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-sm mb-1 block">New products uploaded</label>
              <input
                type="number"
                min="0"
                value={newUploads}
                onChange={(e) => setNewUploads(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Copies of products uploaded</label>
              <input
                type="number"
                min="0"
                value={copiesUploaded}
                onChange={(e) => setCopiesUploaded(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
              />
            </div>
            <div>
              <label className="text-sm mb-1 block">Products edited</label>
              <input
                type="number"
                min="0"
                value={productsEdited}
                onChange={(e) => setProductsEdited(e.target.value)}
                className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Dynamic tasks */}
        <div className="space-y-4">
          {tasksForDay.map((def) => (
            <div key={def.name} className="flex flex-col">
              <label className="text-sm mb-1">{def.label}</label>
              {def.type === "number" ? (
                <input
                  type="number"
                  min="0"
                  value={taskValues[def.name] ?? ""}
                  onChange={(e) => handleTaskChange(def.name, e.target.value)}
                  className="rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
                />
              ) : def.type === "checkbox" ? (
                <input
                  type="checkbox"
                  checked={Boolean(taskValues[def.name])}
                  onChange={(e) => handleTaskChange(def.name, e.target.checked)}
                  className="h-5 w-5"
                />
              ) : (
                <textarea
                  rows={3}
                  value={taskValues[def.name] ?? ""}
                  onChange={(e) => handleTaskChange(def.name, e.target.value)}
                  className="rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
                />
              )}
            </div>
          ))}
        </div>
        {/* Sales records: multiple product name + selling price rows */}
        <div className="space-y-3">
          <h2 className="text-lg font-medium">Sales Records</h2>
          <div className="space-y-2">
            {salesRecords.map((r, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <input
                    type="text"
                    placeholder="Product name"
                    value={r.productName}
                    onChange={(e) => updateSaleRow(idx, "productName", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Price (KES)"
                    value={r.price}
                    onChange={(e) => updateSaleRow(idx, "price", e.target.value)}
                    className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
                  />
                </div>
                <div className="col-span-2">
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => removeSaleRow(idx)}>Remove</Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div>
            <Button type="button" variant="primary" onClick={addSaleRow}>Add Sale</Button>
          </div>
        </div>

        {/* Categorized operations block moved above; original block removed */}

        <div className="flex items-center gap-4">
            <Button type="submit" variant="primary">Submit Report</Button>
            <Button type="button" variant="secondary" onClick={() => { setProductsCount(""); setTotalSales(""); setTaskValues({}); }}>Reset</Button>
        </div>
        {message && (
          <div className="mt-2 text-sm">
            <div className="rounded-md bg-white/5 px-3 py-2 text-slate-200">{message}</div>
          </div>
        )}
      </form>
    </div>
  );
}
