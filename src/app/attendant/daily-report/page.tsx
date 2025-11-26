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

  return (
    <div className="mx-auto max-w-3xl p-6 text-slate-100">
      <h1 className="text-2xl font-semibold mb-4">Daily Performance Report</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
          <div className="sm:col-span-1">
            <label className="text-sm mb-1 block">Products</label>
            <input
              type="number"
              min="0"
              value={productsCount}
              onChange={(e) => setProductsCount(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
            />
          </div>
          <div className="sm:col-span-1">
            <label className="text-sm mb-1 block">Total Sales (KES)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={totalSales}
              onChange={(e) => setTotalSales(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-transparent px-3 py-2 outline-none"
            />
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
