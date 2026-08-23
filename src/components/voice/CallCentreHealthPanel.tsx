"use client";

import { Activity, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useEffect, useState } from "react";

type HealthSnapshot = {
  currentHealth: "HEALTHY" | "WARNING";
  lastInboundCall: string | null;
  lastAnsweredCall: string | null;
  consecutiveBusy: number;
  lastHealthCheck: string | null;
  activeBusyIncident: boolean;
  activeInactivityIncident: boolean;
  lastWhatsAppAlert: string | null;
  alertReason: string | null;
  latestDeliveryStatus: string | null;
};

function formatDateTime(value: string | null) {
  if (!value) return "Not recorded";
  return new Date(value).toLocaleString("en-KE", {
    timeZone: "Africa/Nairobi",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function CallCentreHealthPanel() {
  const [snapshot, setSnapshot] = useState<HealthSnapshot | null>(null);

  useEffect(() => {
    let active = true;
    async function refresh() {
      const response = await fetch("/api/voice/health", { cache: "no-store" });
      if (!response.ok) return;
      const payload = (await response.json()) as { callCentre?: HealthSnapshot };
      if (active && payload.callCentre) setSnapshot(payload.callCentre);
    }
    void refresh().catch(() => undefined);
    const interval = window.setInterval(() => void refresh().catch(() => undefined), 60_000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const warning = snapshot?.currentHealth === "WARNING";
  const rows = [
    ["Last inbound", formatDateTime(snapshot?.lastInboundCall ?? null)],
    ["Last answered", formatDateTime(snapshot?.lastAnsweredCall ?? null)],
    ["Consecutive BUSY", String(snapshot?.consecutiveBusy ?? 0)],
    ["Last health check", formatDateTime(snapshot?.lastHealthCheck ?? null)],
    ["BUSY incident", snapshot?.activeBusyIncident ? "Active" : "Clear"],
    ["Inactivity incident", snapshot?.activeInactivityIncident ? "Active" : "Clear"],
    ["Last WhatsApp alert", formatDateTime(snapshot?.lastWhatsAppAlert ?? null)],
    ["Delivery", snapshot?.latestDeliveryStatus?.replace(/_/g, " ") || "No alert"],
  ];

  return (
    <section className="rounded-[24px] border border-slate-800/90 bg-slate-950/96 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <div className={`rounded-xl border p-2.5 ${warning ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"}`}>
            {warning ? <AlertTriangle className="h-5 w-5" /> : <Activity className="h-5 w-5" />}
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Call Centre Health</div>
            <div className="mt-1 text-base font-semibold text-white">Inbound availability monitoring</div>
          </div>
        </div>
        <div className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${warning ? "border-amber-500/30 bg-amber-500/10 text-amber-100" : "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"}`}>
          <CheckCircle2 className="h-4 w-4" />
          {snapshot?.currentHealth || "CHECKING"}
        </div>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.16em] text-slate-500">{label}</div>
            <div className="mt-1 text-sm font-semibold text-slate-100">{value}</div>
          </div>
        ))}
      </div>
      {snapshot?.alertReason ? (
        <div className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.07] px-3 py-2.5 text-sm text-amber-100">
          {snapshot.alertReason}
        </div>
      ) : null}
    </section>
  );
}
