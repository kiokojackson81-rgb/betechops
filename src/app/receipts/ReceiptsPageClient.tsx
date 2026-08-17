"use client";

import { useState, useEffect, useRef } from "react";
import ReceiptFormClient from "./ReceiptFormClient";
import DailyReportReceiptsPanel from "@/components/daily-report-receipts";
import QuotationRequestsDeskClient from "@/components/QuotationRequestsDeskClient";
import LipaPolePoleAdminClient from "@/app/admin/lipa-pole-pole/LipaPolePoleAdminClient";
import { getTradingPeriodFor } from "@/lib/tradingPeriod";

type ReceiptRow = {
  id: string;
  orderRef?: string;
  docType: string;
  createdAt: string;
  customerName?: string | null;
  attendantName?: string | null;
  total?: number | null;
  status?: string | null;
  items?: unknown[];
  source?: "pos" | "marketing" | "support";
  detailUrl?: string | null;
};

type PublicStaffOption = {
  id: string;
  name: string | null;
  email: string | null;
  attendantCategory?: string | null;
};

export default function ReceiptsPageClient({
  initialOnlyPos = true,
  initialView = "create",
}: {
  initial: ReceiptRow[];
  initialOnlyPos?: boolean;
  initialView?: "create" | "list";
}) {
  const [view, setView] = useState<"create" | "list">(initialView);
  const [attendantId, setAttendantId] = useState<string | null>(null);
  const onlyPos = initialOnlyPos;
  const defaultTradingPeriod = getTradingPeriodFor(new Date());
  const defaultPeriodStart = defaultTradingPeriod.start.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const defaultPeriodEnd = defaultTradingPeriod.end.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" });
  const [historyStart, setHistoryStart] = useState<string>(defaultPeriodStart);
  const [historyEnd, setHistoryEnd] = useState<string>(defaultPeriodEnd);
  const [historySearch, setHistorySearch] = useState("");
  const [debouncedHistorySearch, setDebouncedHistorySearch] = useState("");
  const [historySummary, setHistorySummary] = useState<{
    count: number;
    totalSales: number;
    podReceipts: number;
    pendingProjectReceipts: number;
    completedProjectReceipts: number;
  }>({
    count: 0,
    totalSales: 0,
    podReceipts: 0,
    pendingProjectReceipts: 0,
    completedProjectReceipts: 0,
  });
  const [historyCommission, setHistoryCommission] = useState(0);
  const [historyCommissionLoading, setHistoryCommissionLoading] = useState(false);
  const [createDocumentType, setCreateDocumentType] = useState<"RECEIPT" | "QUOTATION" | "LPP">("RECEIPT");
  const [quotationStaffOptions, setQuotationStaffOptions] = useState<PublicStaffOption[]>([]);
  const [quotationStaffLoading, setQuotationStaffLoading] = useState(false);

  const listRef = useRef<HTMLDivElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  const scrollIntoView = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (ref.current) {
      ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleCreated = (
    _receipt?: unknown,
    context?: { staffId: string | null; serial: string; receiptId: string | null }
  ) => {
    if (context?.staffId) {
      setAttendantId(context.staffId);
      setHistorySearch(context.serial);
      setView("list");
      setTimeout(() => scrollIntoView(listRef), 100);
      return;
    }
    setView("create");
    setTimeout(() => scrollIntoView(formRef), 100);
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedHistorySearch(historySearch), 250);
    return () => clearTimeout(t);
  }, [historySearch]);

  useEffect(() => {
    if (view !== "list") return;
    const controller = new AbortController();
    const loadCommission = async () => {
      setHistoryCommissionLoading(true);
      try {
        const start = new Date(`${historyStart}T00:00:00+03:00`).toISOString();
        const end = new Date(`${historyEnd}T23:59:59.999+03:00`).toISOString();
        const params = new URLSearchParams({ start, end });
        if (typeof window !== "undefined") {
          const impersonateId = new URLSearchParams(window.location.search).get("impersonateId");
          if (impersonateId) params.set("impersonateId", impersonateId);
        }
        const response = await fetch(`/api/online/preview-commission?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok) throw new Error(payload?.error || "Failed to load commission");
        const directLine = Array.isArray(payload?.lines)
          ? payload.lines.find((line: { channel?: string }) => line.channel === "DIRECT")
          : null;
        setHistoryCommission(Number(directLine?.commission ?? 0));
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) setHistoryCommission(0);
      } finally {
        if (!controller.signal.aborted) setHistoryCommissionLoading(false);
      }
    };
    void loadCommission();
    return () => controller.abort();
  }, [historyEnd, historyStart, view]);

  useEffect(() => {
    if (view !== "create" || createDocumentType !== "QUOTATION" || quotationStaffOptions.length) return;
    let cancelled = false;
    setQuotationStaffLoading(true);
    fetch("/api/receipts/staff", { cache: "no-store" })
      .then((response) => response.json().catch(() => []))
      .then((data) => {
        if (cancelled) return;
        setQuotationStaffOptions(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (cancelled) return;
        setQuotationStaffOptions([]);
      })
      .finally(() => {
        if (!cancelled) setQuotationStaffLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [createDocumentType, quotationStaffOptions.length, view]);

  // On mount, detect attendantId in the URL and open list view filtered to that attendant
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        const sp = new URLSearchParams(window.location.search);
        const aid = sp.get("attendantId");
        const start = sp.get("start");
        const end = sp.get("end");
        if (aid) {
          setAttendantId(aid);
          setView("list");
          if (start) setHistoryStart(start);
          if (end) setHistoryEnd(end);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  const openListView = () => {
    setView("list");
    setTimeout(() => scrollIntoView(listRef), 100);
  };

  const openCreateView = () => {
    setView("create");
    setTimeout(() => scrollIntoView(formRef), 100);
  };

  const setHistoryRange = (range: "today" | "yesterday" | "thisWeek" | "period") => {
    const now = new Date();
    if (range === "today") {
      const iso = now.toISOString().slice(0, 10);
      setHistoryStart(iso);
      setHistoryEnd(iso);
      return;
    }
    if (range === "yesterday") {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const iso = d.toISOString().slice(0, 10);
      setHistoryStart(iso);
      setHistoryEnd(iso);
      return;
    }
    if (range === "thisWeek") {
      const d = new Date(now);
      const day = d.getDay();
      const diffToMonday = day === 0 ? -6 : 1 - day;
      const start = new Date(d);
      start.setDate(d.getDate() + diffToMonday);
      setHistoryStart(start.toISOString().slice(0, 10));
      setHistoryEnd(now.toISOString().slice(0, 10));
      return;
    }
    const period = getTradingPeriodFor(now);
    setHistoryStart(period.start.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }));
    setHistoryEnd(period.end.toLocaleDateString("en-CA", { timeZone: "Africa/Nairobi" }));
  };

  if (view === "list") {
    return (
      <div className="page-shell space-y-4 py-3 sm:space-y-6 sm:py-6">
        <section className="rounded-[22px] border border-white/10 bg-slate-900/80 p-4 shadow-xl shadow-black/40 sm:rounded-3xl sm:p-6">
          <div className="flex flex-col items-start justify-between gap-3 sm:flex-row">
            <div>
              <h1 className="text-2xl font-semibold text-white sm:text-4xl">Receipts history</h1>
              <p className="mt-2 text-sm text-slate-300">
                Browse your POS receipts and open the same shared receipt page used across the system.
              </p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
              <button
                type="button"
                onClick={openCreateView}
                className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-950 hover:bg-emerald-300"
              >
                Create receipt
              </button>
              <button
                type="button"
                onClick={() => window.history.back()}
                className="rounded-full border border-white/20 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 hover:bg-white/10"
              >
                Back
              </button>
            </div>
          </div>
        </section>

        <section ref={listRef} className="rounded-[22px] border border-white/10 bg-slate-900/80 p-3 shadow-xl shadow-black/40 sm:rounded-3xl sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Current period by default</p>
              <h2 className="text-xl font-semibold text-white sm:text-2xl">POS receipts and project activity</h2>
              <p className="text-sm text-slate-400">
                Review receipt sales, commission, pending projects, and POD activity for any selected range.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold uppercase tracking-wide sm:flex sm:flex-wrap sm:text-[11px]">
              {[
                { key: "today", label: "Today" },
                { key: "yesterday", label: "Yesterday" },
                { key: "thisWeek", label: "This week" },
                { key: "period", label: "This period" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setHistoryRange(option.key as "today" | "yesterday" | "thisWeek" | "period")}
                  className="rounded-full border border-white/15 px-3 py-2 text-slate-200 hover:border-emerald-500 hover:text-white sm:px-4 sm:py-1"
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 grid gap-3 lg:grid-cols-3">
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Search
              <input
                type="search"
                placeholder="Customer, attendant, receipt..."
                value={historySearch}
                onChange={(event) => setHistorySearch(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-slate-400">
              Start date
              <input
                type="date"
                value={historyStart}
                onChange={(event) => setHistoryStart(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
            <label className="text-xs uppercase tracking-wide text-slate-400">
              End date
              <input
                type="date"
                value={historyEnd}
                onChange={(event) => setHistoryEnd(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
              />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-6">
            <div className="col-span-2 rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 sm:col-span-1 sm:px-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Selected period</p>
              <p className="mt-1 text-sm font-semibold text-slate-100">{historyStart}</p>
              <p className="text-xs text-slate-400">to {historyEnd}</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 sm:px-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Receipts</p>
              <p className="text-xl font-semibold text-emerald-300 sm:text-2xl">{historySummary.count}</p>
              <p className="text-xs text-slate-400">Captured in the selected window</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/70 px-3 py-3 sm:px-4">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">Total sales</p>
              <p className="break-words text-xl font-semibold text-emerald-300 sm:text-2xl">
                KES {historySummary.totalSales.toLocaleString("en-KE", { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-400">Aggregated from the receipts below</p>
            </div>
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/5 px-3 py-3 sm:px-4">
              <p className="text-[11px] uppercase tracking-wide text-cyan-200/70">Receipt commission</p>
              <p className="break-words text-xl font-semibold text-cyan-200 sm:text-2xl">
                {historyCommissionLoading
                  ? "Loading..."
                  : `KES ${historyCommission.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`}
              </p>
              <p className="text-xs text-slate-400">Direct commission for this range</p>
            </div>
            <div className="rounded-2xl border border-amber-400/20 bg-amber-400/5 px-3 py-3 sm:px-4">
              <p className="text-[11px] uppercase tracking-wide text-amber-200/70">Pending projects</p>
              <p className="text-xl font-semibold text-amber-200 sm:text-2xl">{historySummary.pendingProjectReceipts}</p>
              <p className="text-xs text-slate-400">Not completed and posted to POS sales</p>
            </div>
            <div className="rounded-2xl border border-yellow-400/20 bg-yellow-400/5 px-3 py-3 sm:px-4">
              <p className="text-[11px] uppercase tracking-wide text-yellow-200/70">POD receipts</p>
              <p className="text-xl font-semibold text-yellow-200 sm:text-2xl">{historySummary.podReceipts}</p>
              <p className="text-xs text-slate-400">Pay-on-delivery receipts in range</p>
            </div>
          </div>

          <div className="mt-4">
            <DailyReportReceiptsPanel
              start={historyStart}
              end={historyEnd}
              q={debouncedHistorySearch}
              attendantId={attendantId}
              hideHeader
              onlyPos={onlyPos}
              showPodFilters
              showProjectFilter
              emptyMessage="No receipts found for this date."
              onSummary={(summary) => setHistorySummary(summary)}
            />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-shell space-y-6 py-6">
      {view === "create" && (
        <section
          ref={formRef}
          className="rounded-3xl border border-white/10 bg-slate-900/80 p-4 shadow-xl shadow-black/40 sm:p-6"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Operations Desk</p>
              <h1 className="text-2xl font-semibold text-white">Receipts, PODs &amp; Quotations</h1>
              <p className="text-sm text-slate-400">Create, save, print, and manage customer documents.</p>
            </div>
            <button
              onClick={openListView}
              className="w-full rounded-full bg-emerald-500 px-4 py-2 text-sm font-semibold text-black hover:brightness-95 sm:w-auto"
            >
              View receipts
            </button>
          </div>

          {/* Totals panel removed per request */}
          <div className="mt-4">
            <div className="mb-4 grid gap-2 sm:flex sm:flex-wrap">
              {([
                ["RECEIPT", "Receipt / POD flow"],
                ["QUOTATION", "Quotation flow"],
                ["LPP", "Lipa Pole Pole"],
              ] as const).map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setCreateDocumentType(type)}
                  className={`w-full rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition sm:w-auto ${
                    createDocumentType === type
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                      : "border-white/10 text-slate-300 hover:border-white/20 hover:text-white"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {createDocumentType === "QUOTATION" ? (
              <div className="space-y-3">
                {quotationStaffLoading && !quotationStaffOptions.length ? (
                  <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-300">
                    Loading quotation staff...
                  </div>
                ) : null}
                <QuotationRequestsDeskClient
                  apiBasePath="/api/public/quotation-center"
                  deskTitle="Public quotation builder"
                  deskDescription="Choose the staff owner, build the quotation here, and notify the customer immediately after save."
                  compactMode
                  enableCreate
                  createOnlyMode
                  initialCreateOpen
                  allowTemplateSelection
                  allowTemplateManager={false}
                  createApiPath="/api/public/quotation-center/create"
                  createActionLabel="Save quotation and notify customer"
                  createSuccessMessage="Quotation saved and customer notification has been triggered."
                  assigneeOptions={quotationStaffOptions}
                  assigneeLabel="Assign quotation to staff"
                  requireAssigneeSelection
                />
              </div>
            ) : createDocumentType === "LPP" ? (
              <div>
                <LipaPolePoleAdminClient
                  initialItems={[]}
                  initialDetail={null}
                  initialQ=""
                  initialStatus="ALL"
                  embeddedCreateMode
                  onCancelInlineCreate={() => setCreateDocumentType("RECEIPT")}
                />
              </div>
            ) : (
              <ReceiptFormClient onCreated={handleCreated} showHero={false} />
            )}
          </div>
        </section>
      )}

    </div>
  );
}
