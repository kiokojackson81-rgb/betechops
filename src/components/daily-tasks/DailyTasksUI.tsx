"use client"

import React, { useMemo, useState } from "react";
import Button from "@/app/_components/Button";
import Card from "@/app/_components/Card";
import Input from "@/app/_components/Input";
import Checkbox from "@/app/_components/Checkbox";
import Textarea from "@/app/_components/Textarea";

export type DayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday";

export type SaleRow = { id: string; name: string; price: number | "" };

export type MarketplaceState = {
  newUploaded: number | "";
  copiesUploaded: number | "";
  productsEdited: number | "";
  sales: SaleRow[];
};

const defaultMarketplaceState = (): MarketplaceState => ({
  newUploaded: "",
  copiesUploaded: "",
  productsEdited: "",
  sales: [{ id: crypto.randomUUID(), name: "", price: "" }],
});

type TaskField =
  | { kind: "check"; key: string; label: string }
  | { kind: "number"; key: string; label: string; min?: number; step?: number }
  | { kind: "text"; key: string; label: string; placeholder?: string };

type DayDefinition = {
  title: string;
  focus: string;
  targetUploads?: number;
  fields: TaskField[];
};

const shared: Record<string, TaskField> = {
  customersServed: { kind: "number", key: "customersServed", label: "Customers served (walk-in/online)", min: 0, step: 1 },
  commentsDMs: { kind: "number", key: "commentsDMs", label: "Engagements (comments/DMs)", min: 0, step: 1 },
  promoVideos: { kind: "number", key: "promoVideos", label: "Promotional/product videos posted", min: 0, step: 1 },
  demoRecorded: { kind: "check", key: "demoRecorded", label: "Product demo video recorded" },
  liveSessions: { kind: "number", key: "liveSessions", label: "Live sessions hosted", min: 0, step: 1 },
  leadsFollowed: { kind: "number", key: "leadsFollowed", label: "Leads followed-up", min: 0, step: 1 },
  officeClean: { kind: "check", key: "officeClean", label: "Office/display/photo area cleaned & organized" },
  competitorNotes: { kind: "text", key: "competitorNotes", label: "Notes on competitors / market observations", placeholder: "Pricing, offers, content ideas…" },
  improvementIdeas: { kind: "text", key: "improvementIdeas", label: "Improvement suggestions", placeholder: "Actionable ideas from the week/day" },
  meetingAttended: { kind: "check", key: "meetingAttended", label: "Weekly marketing meeting attended" },
  videoShoot: { kind: "check", key: "videoShoot", label: "Participated in weekly video shoot" },
  weekendPromos: { kind: "check", key: "weekendPromos", label: "Weekend promos prepared / posts scheduled" },
  stockChecked: { kind: "check", key: "stockChecked", label: "Stock & pricing confirmed (Jumia/Kilimall)" },
  inboxCleared: { kind: "check", key: "inboxCleared", label: "WhatsApp/calls/inquiries cleared" },
  weeklySummary: { kind: "text", key: "weeklySummary", label: "Weekly performance summary (Sat)", placeholder: "Total videos, lives, leads, pending follow-ups…" },
};

export const dayTaskDefinitions: Record<DayKey, DayDefinition> = {
  monday: { title: "Monday", focus: "Product & Stock Management", targetUploads: 50, fields: [shared.stockChecked, shared.inboxCleared, shared.customersServed, shared.competitorNotes, shared.improvementIdeas] },
  tuesday: { title: "Tuesday", focus: "Product Marketing & Engagement", targetUploads: 50, fields: [shared.promoVideos, shared.demoRecorded, shared.commentsDMs, shared.customersServed, shared.competitorNotes, shared.improvementIdeas] },
  wednesday: { title: "Wednesday", focus: "Live Session & Sales Day", targetUploads: 50, fields: [shared.liveSessions, shared.promoVideos, shared.leadsFollowed, shared.customersServed, shared.commentsDMs] },
  thursday: { title: "Thursday", focus: "Weekly Marketing & Video Shoot", targetUploads: 50, fields: [shared.meetingAttended, shared.videoShoot, shared.promoVideos, shared.officeClean, shared.customersServed] },
  friday: { title: "Friday", focus: "Promotion & Sales Push", targetUploads: 50, fields: [shared.promoVideos, shared.customersServed, shared.officeClean, shared.weekendPromos, shared.improvementIdeas] },
  saturday: { title: "Saturday", focus: "Customer Service & Summary", targetUploads: 50, fields: [shared.customersServed, shared.liveSessions, shared.officeClean, shared.leadsFollowed, shared.weeklySummary] },
};

const defaultDayState = (day: DayKey) => Object.fromEntries(dayTaskDefinitions[day].fields.map((f) => [f.key, f.kind === "number" ? 0 : f.kind === "check" ? false : ""])) as Record<string, number | boolean | string>;

export function computeAdminSummary(dayState: Record<string, number | boolean | string>, market: MarketplaceState) {
  const num = (k: string) => (typeof dayState[k] === "number" ? (dayState[k] as number) : 0);
  const yes = (k: string) => (typeof dayState[k] === "boolean" && (dayState[k] as boolean) ? 1 : 0);
  return {
    videos: num("promoVideos") + yes("demoRecorded"),
    lives: num("liveSessions"),
    leads: num("leadsFollowed"),
    customers: num("customersServed"),
    maintenance: yes("officeClean"),
    stockCheck: yes("stockChecked"),
    meeting: yes("meetingAttended"),
    videoShoot: yes("videoShoot"),
    weekendPrep: yes("weekendPromos"),
    mk_new: market.newUploaded || 0,
    mk_copies: market.copiesUploaded || 0,
    mk_edits: market.productsEdited || 0,
    mk_sales: market.sales.filter((r) => r.name && r.price !== "").length,
  };
}

export default function DailyTasksUI() {
  const [day, setDay] = useState<DayKey>("monday");
  const [dayState, setDayState] = useState<Record<DayKey, Record<string, number | boolean | string>>>({
    monday: defaultDayState("monday"),
    tuesday: defaultDayState("tuesday"),
    wednesday: defaultDayState("wednesday"),
    thursday: defaultDayState("thursday"),
    friday: defaultDayState("friday"),
    saturday: defaultDayState("saturday"),
  });

  const [market, setMarket] = useState<Record<DayKey, MarketplaceState>>({
    monday: defaultMarketplaceState(),
    tuesday: defaultMarketplaceState(),
    wednesday: defaultMarketplaceState(),
    thursday: defaultMarketplaceState(),
    friday: defaultMarketplaceState(),
    saturday: defaultMarketplaceState(),
  });

  const def = dayTaskDefinitions[day];
  const adminSummary = useMemo(() => computeAdminSummary(dayState[day], market[day]), [day, dayState, market]);

  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const validatePayload = (body: any) => {
    if (!body.day) return "day is required";
    if (body.productsCount < 0) return "productsCount must be >= 0";
    if (body.totalSales < 0) return "totalSales must be >= 0";
    if (!Array.isArray(body.tasks.sales)) return "sales must be an array";
    for (const s of body.tasks.sales) {
      if (typeof s.productName !== "string") return "each sale must have a productName";
      if (Number(s.price) < 0) return "sale price must be >= 0";
    }
    return null;
  };

  const handleSave = async () => {
    setBusy(true);
    setSuccess(null);
    setError(null);
    try {
      // build tasks payload expected by server/export
      const categories = {
        newUploads: Number(market[day].newUploaded) || 0,
        copiesUploaded: Number(market[day].copiesUploaded) || 0,
        productsEdited: Number(market[day].productsEdited) || 0,
      };
      const marketing = {
        attendedMarketingMeeting: Boolean(dayState[day]["meetingAttended"]),
        participatedVideoShoot: Boolean(dayState[day]["videoShoot"]),
        marketingVideosShot: Number(dayState[day]["promoVideos"]) || 0,
      };
      const customerOperations = {
        walkInCustomers: Number(dayState[day]["customersServed"]) || 0,
        customersPurchased: 0,
        liveViewers: Number(dayState[day]["liveSessions"]) || 0,
        livePurchases: 0,
      };
      const officeMaintenance = {
        officeCleaned: Boolean(dayState[day]["officeClean"]),
        officeNotes: String(dayState[day]["competitorNotes"] || ""),
      };

      const sales = (market[day].sales || []).map((s) => ({ productName: s.name || "", price: Number(s.price || 0) }));

      const productsCount = categories.newUploads + categories.copiesUploaded + categories.productsEdited;
      const totalSales = sales.reduce((acc, s) => acc + (Number(s.price) || 0), 0);

      const body = {
        date: new Date().toISOString(),
        day,
        productsCount,
        totalSales,
        tasks: {
          categories,
          marketing,
          customerOperations,
          officeMaintenance,
          sales,
          // include the raw dayState for completeness
          dayFields: dayState[day],
        },
      };

      const validationErr = validatePayload(body);
      if (validationErr) {
        setError(validationErr);
        setBusy(false);
        return;
      }

      const res = await fetch("/api/daily-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error || `Server responded ${res.status}`);
        // keep error and allow user to retry
      } else {
        setSuccess("Saved successfully");
        // optionally clear the day's inputs
        // setDayState((s) => ({ ...s, [day]: defaultDayState(day) }));
        // setMarket((m) => ({ ...m, [day]: defaultMarketplaceState() }));
        // auto-dismiss success after a short time
        setTimeout(() => setSuccess(null), 5000);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = () => {
    // simple retry invokes handleSave again
    handleSave();
  };

  return (
    <div className="w-full p-6 space-y-6">
      {success ? (
        <div className="p-3 rounded bg-emerald-900/10 text-emerald-300">{success}</div>
      ) : null}
      {error ? (
        <div className="p-3 rounded bg-rose-900/10 text-rose-300 flex items-center justify-between">
          <span>{error}</span>
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={handleRetry}>Retry</Button>
          </div>
        </div>
      ) : null}
      <div>
        <h1 className="text-2xl font-bold">Daily Task Categories (Mon–Sat)</h1>
        <p className="text-sm opacity-80">Core duties + Jumia/Kilimall operations are captured for EVERY day.</p>
      </div>

      <div className="grid grid-cols-6 gap-2 w-full">
        {Object.keys(dayTaskDefinitions).map((k) => (
          <Button key={k} className={`py-2 px-3 text-xs ${day === k ? "bg-gray-800 text-white" : "bg-white"}`} onClick={() => setDay(k as DayKey)} variant={day === k ? "primary" : "secondary"}>
            {dayTaskDefinitions[k as DayKey].title.slice(0, 3)}
          </Button>
        ))}
      </div>

      <div className="space-y-6">
        <Card className="shadow-md p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{def.title}</h2>
              <p className="text-sm opacity-70">Focus: {def.focus}</p>
            </div>
            {def.targetUploads ? <div className="text-xs">Target uploads: {def.targetUploads}/day</div> : null}
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            {def.fields.map((f) => (
              <div key={f.key} className="flex items-start gap-3 p-3 rounded-2xl border" >
                {f.kind === "check" && (
                  <label className="flex items-center gap-2">
                    <Checkbox checked={Boolean(dayState[day][f.key])} onCheckedChange={(v) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], [f.key]: v } }))} />
                    <span className="text-sm">{f.label}</span>
                  </label>
                )}
                {f.kind === "number" && (
                  <div className="w-full">
                    <label className="text-sm block mb-1">{f.label}</label>
                    <Input type="number" min={f.min} step={f.step} value={String(dayState[day][f.key] || 0)} onChange={(e) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], [f.key]: Number((e.target as HTMLInputElement).value) } }))} />
                  </div>
                )}
                {f.kind === "text" && (
                  <div className="w-full">
                    <label className="text-sm block mb-1">{f.label}</label>
                    <Textarea rows={3} className="" placeholder={f.placeholder} value={String(dayState[day][f.key] || "")} onChange={(e) => setDayState((prev) => ({ ...prev, [day]: { ...prev[day], [f.key]: e.target.value } }))} />
                  </div>
                )}
              </div>
            ))}
          </div>

          <Card className="mt-4 bg-gray-50 space-y-4 p-4">
            <h3 className="font-semibold text-sm">Jumia / Kilimall Operations</h3>
            <div className="grid md:grid-cols-3 gap-3">
              <LabeledNumber label="New products uploaded" value={market[day].newUploaded} onChange={(v) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], newUploaded: v } }))} />
              <LabeledNumber label="Copies of products uploaded" value={market[day].copiesUploaded} onChange={(v) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], copiesUploaded: v } }))} />
              <LabeledNumber label="Products edited" value={market[day].productsEdited} onChange={(v) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], productsEdited: v } }))} />
            </div>

            <div className="space-y-2 mt-3">
              <div className="text-sm font-medium">Sales Records</div>
              {market[day].sales.map((row) => (
                <div key={row.id} className="grid grid-cols-12 gap-2 items-center">
                  <Input className="col-span-6" placeholder="Product name" value={row.name} onChange={(e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => (r.id === row.id ? { ...r, name: (e.target as HTMLInputElement).value } : r)) } }))} />
                  <Input className="col-span-4" type="number" placeholder="0" value={row.price === "" ? "" : String(row.price)} onChange={(e) => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.map((r) => (r.id === row.id ? { ...r, price: (e.target as HTMLInputElement).value === "" ? "" : Number((e.target as HTMLInputElement).value) } : r)) } }))} />
                  <div className="col-span-2">
                    <Button variant="secondary" onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: prev[day].sales.filter((r) => r.id !== row.id) } }))}>Remove</Button>
                  </div>
                </div>
              ))}

               <div className="flex justify-end">
                 <Button onClick={() => setMarket((prev) => ({ ...prev, [day]: { ...prev[day], sales: [...prev[day].sales, { id: crypto.randomUUID(), name: "", price: "" }] } }))}>Add row</Button>
               </div>
            </div>
          </Card>

          <Card className="mt-4 p-4 space-y-3 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm">Admin Summary (collapsed fields)</h3>
              <div className="text-xs opacity-70">Auto‑computed</div>
            </div>

            <div className="grid md:grid-cols-5 gap-3 text-sm">
              <SummaryItem label="Videos" value={adminSummary.videos} />
              <SummaryItem label="Live Sessions" value={adminSummary.lives} />
              <SummaryItem label="Leads" value={adminSummary.leads} />
              <SummaryItem label="Customers" value={adminSummary.customers} />
              <SummaryItem label="Maintenance" value={adminSummary.maintenance ? "Yes" : "No"} />
            </div>

            <div className="grid md:grid-cols-4 gap-3 text-sm mt-3">
              <SummaryItem label="Mk New" value={adminSummary.mk_new as number} />
              <SummaryItem label="Mk Copies" value={adminSummary.mk_copies as number} />
              <SummaryItem label="Mk Edits" value={adminSummary.mk_edits as number} />
              <SummaryItem label="Mk Sales Rows" value={adminSummary.mk_sales as number} />
            </div>
          </Card>

            <Card className="mt-4 p-3 flex gap-2 justify-end">
              <Button variant="secondary" onClick={() => { setDayState((s) => ({ ...s, [day]: defaultDayState(day) })); setMarket((m) => ({ ...m, [day]: defaultMarketplaceState() })); }}>Reset day</Button>
              <Button onClick={busy ? undefined : handleSave}>{busy ? "Saving..." : "Save"}</Button>
            </Card>
        </Card>
      </div>
    </div>
  );
}

const SummaryItem: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="p-3 rounded-xl border bg-white">
    <div className="text-[11px] opacity-70 mb-1">{label}</div>
    <div className="font-semibold">{value}</div>
  </div>
);

const LabeledNumber: React.FC<{ label: string; value: number | ""; onChange: (v: number | "") => void }> = ({ label, value, onChange }) => (
  <div>
    <label className="text-sm block mb-1">{label}</label>
    <Input type="number" value={value === "" ? "" : String(value)} onChange={(e) => onChange((e.target as HTMLInputElement).value === "" ? "" : Number((e.target as HTMLInputElement).value))} />
  </div>
);
