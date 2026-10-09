"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

type PodRow = {
  id: string;
  orderRef?: string | null;
  createdAt: string;
  podCreatedAt?: string | null;
  podDispatchedAt?: string | null;
  podSpeedafSettlementStatus?: string | null;
  podSpeedafSettledAt?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  attendantName?: string | null;
  total?: number | string | null;
  profit?: number | string | null;
  podDeliveryFee?: number | null;
  podDeliveryStatus?: string | null;
  podPickupStation?: string | null;
  podPickupArea?: string | null;
  podEvidenceUrl?: string | null;
  podReturnTrackingNumber?: string | null;
  podTrackingNumbers?: string[];
  publicReceiptToken?: string | null;
};
type FeeDraft = {
  row: PodRow;
  mode: "dispatch" | "edit";
  fee: string;
  tracking: string;
  files: File[];
  error: string | null;
};
type OutcomeDraft = {
  row: PodRow;
  status: "delivered" | "delivery_failed";
  note: string;
  returnTracking: string;
  file: File | null;
  error: string | null;
};
const number = (value: unknown) => Number(value) || 0;
const money = (value: unknown) =>
  `KES ${number(value).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
const normal = (value: string | null | undefined) =>
  String(value || "pending")
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
const speedafPaymentIsRequired = (status: string | null | undefined) =>
  !["cancelled", "canceled", "delivery_failed", "failed"].includes(
    normal(status),
  );
const dateTime = (value: string | null | undefined) => {
  if (!value) return "Not dispatched";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Not available"
    : new Intl.DateTimeFormat("en-KE", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Africa/Nairobi",
      }).format(date);
};

async function upload(file: File) {
  const form = new FormData();
  form.set("file", file);
  const response = await fetch("/api/receipts/pod-evidence-upload", {
    method: "POST",
    credentials: "same-origin",
    body: form,
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok || !json.url)
    throw new Error(json.error || `Could not upload ${file.name}`);
  return {
    url: String(json.url),
    fileName: String(json.fileName || file.name),
  };
}

export default function PodDeliveryCentreClient({
  initialRows,
}: {
  initialRows: PodRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [fee, setFee] = useState<FeeDraft | null>(null);
  const [outcome, setOutcome] = useState<OutcomeDraft | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [settlementFile, setSettlementFile] = useState<File | null>(null);
  const [settling, setSettling] = useState(false);
  const rows = useMemo(
    () =>
      initialRows.filter((row) => {
        const state = normal(row.podDeliveryStatus);
        const speedafPaid = normal(row.podSpeedafSettlementStatus) === "paid";
        const matches =
          filter === "all" ||
          state === filter ||
          (filter === "failed" && state.includes("fail")) ||
          (filter === "awaiting_fee" &&
            state === "pending" &&
            !number(row.podDeliveryFee)) ||
          (filter === "speedaf_paid" && speedafPaid) ||
          (filter === "speedaf_unpaid" &&
            speedafPaymentIsRequired(state) &&
            !speedafPaid);
        const text =
          `${row.orderRef} ${row.customerName} ${row.customerPhone} ${row.podPickupStation} ${row.attendantName}`.toLowerCase();
        return matches && text.includes(query.toLowerCase());
      }),
    [filter, initialRows, query],
  );
  const metrics = useMemo(() => {
    const pending = initialRows.filter(
      (row) => normal(row.podDeliveryStatus) === "pending",
    );
    const count = (state: string) =>
      initialRows.filter((row) => normal(row.podDeliveryStatus) === state)
        .length;
    const delivered = initialRows.filter(
      (row) => normal(row.podDeliveryStatus) === "delivered",
    );
    const speedafPaymentRows = initialRows.filter((row) =>
      speedafPaymentIsRequired(row.podDeliveryStatus),
    );
    const speedafPaid = speedafPaymentRows.filter(
      (row) => normal(row.podSpeedafSettlementStatus) === "paid",
    );
    return {
      total: initialRows.length,
      value: initialRows.reduce((sum, row) => sum + number(row.total), 0),
      pending: pending.length,
      pendingValue: pending.reduce((sum, row) => sum + number(row.total), 0),
      dispatched: count("dispatched"),
      delivered: delivered.length,
      failed: initialRows.filter((row) =>
        normal(row.podDeliveryStatus).includes("fail"),
      ).length,
      speedafPaid: speedafPaid.length,
      speedafUnpaid: speedafPaymentRows.length - speedafPaid.length,
      fees: initialRows.reduce(
        (sum, row) => sum + number(row.podDeliveryFee),
        0,
      ),
      profit: initialRows.reduce((sum, row) => sum + number(row.profit), 0),
    };
  }, [initialRows]);
  const cards = [
    ["Total PODs", metrics.total, "all"],
    ["POD value", money(metrics.value), "all"],
    ["Pending PODs", metrics.pending, "pending"],
    ["Pending POD value", money(metrics.pendingValue), "pending"],
    ["Awaiting dispatch fee", metrics.pending, "awaiting_fee"],
    ["Dispatched", metrics.dispatched, "dispatched"],
    ["Delivered", metrics.delivered, "delivered"],
    ["Paid by Speedaf", metrics.speedafPaid, "speedaf_paid"],
    ["Awaiting Speedaf pay", metrics.speedafUnpaid, "speedaf_unpaid"],
    ["Failed", metrics.failed, "failed"],
  ] as const;
  const openFee = (row: PodRow, mode: "dispatch" | "edit") =>
    setFee({
      row,
      mode,
      fee: row.podDeliveryFee == null ? "" : String(row.podDeliveryFee),
      tracking: row.podTrackingNumbers?.join(", ") || "",
      files: [],
      error: null,
    });
  const refresh = (message: string) => {
    setNotice(message);
    setFee(null);
    setOutcome(null);
    router.refresh();
  };
  const copyWaybill = async (waybill: string) => {
    try {
      await navigator.clipboard.writeText(waybill);
      setNotice("POD waybill copied. Paste it on the Speedaf tracking page.");
    } catch {
      setNotice("Could not copy the POD waybill. Select and copy it manually.");
    }
  };
  const importSpeedafSettlement = async () => {
    if (!settlementFile)
      return setNotice(
        "Choose the Speedaf payment image, CSV, or Excel file first.",
      );
    setSettling(true);
    try {
      const form = new FormData();
      form.set("file", settlementFile);
      const response = await fetch(
        "/api/admin/pod/speedaf-settlements/import",
        { method: "POST", credentials: "same-origin", body: form },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(json.error || "Unable to import Speedaf payments.");
      setSettlementFile(null);
      router.refresh();
      setNotice(
        `Speedaf reconciliation complete: ${json.markedPaid} newly marked paid, ${json.alreadyPaid || 0} already paid${json.unmatchedTrackingNumbers?.length ? `, ${json.unmatchedTrackingNumbers.length} unmatched` : ""}.`,
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to import Speedaf payments.",
      );
    } finally {
      setSettling(false);
    }
  };
  const markSpeedafPaidManually = async (row: PodRow) => {
    const reference = window.prompt(
      `Confirm Speedaf has paid ${row.customerName || "this customer"} (${money(row.total)}). Enter the settlement reference if available:`,
      "",
    );
    if (reference === null) return;
    if (
      !window.confirm(
        "Mark this delivered POD as paid by Speedaf? This is reconciliation only and does not change POD profit.",
      )
    )
      return;
    setSaving(row.id);
    try {
      const response = await fetch(
        "/api/admin/pod/speedaf-settlements/manual",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ receiptId: row.id, reference }),
        },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(json.error || "Unable to mark the Speedaf settlement.");
      router.refresh();
      setNotice(
        "POD marked paid by Speedaf for reconciliation. POD sales and profit were not changed.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Unable to mark the Speedaf settlement.",
      );
    } finally {
      setSaving(null);
    }
  };
  const saveFee = async () => {
    if (!fee) return;
    const amount = Number(fee.fee);
    const trackingNumbers = fee.tracking.split(/[\s,]+/).filter(Boolean);
    if (!Number.isFinite(amount) || amount < 0)
      return setFee({ ...fee, error: "Enter a valid delivery fee." });
    if (fee.mode === "dispatch" && !trackingNumbers.length)
      return setFee({
        ...fee,
        error: "Enter the Speedaf tracking number before dispatching.",
      });
    setSaving(fee.row.id);
    try {
      const speedafReceipts = await Promise.all(fee.files.map(upload));
      const response = await fetch(
        `/api/receipts/${fee.row.id}/pod-delivery-fee`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            amount,
            trackingNumbers,
            speedafReceipts,
            editOnly: fee.mode === "edit",
          }),
        },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(json.error || "Unable to save delivery fee.");
      refresh(
        fee.mode === "edit"
          ? "Delivery fee saved and POD totals recalculated."
          : json?.notification?.sms === "SENT"
            ? "POD dispatched and customer SMS sent."
            : "POD dispatched. Check notification history if SMS needs attention.",
      );
    } catch (error) {
      setFee((current) =>
        current
          ? {
              ...current,
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to save delivery fee.",
            }
          : current,
      );
    } finally {
      setSaving(null);
    }
  };
  const saveOutcome = async () => {
    if (!outcome) return;
    if (!outcome.file)
      return setOutcome({
        ...outcome,
        error: "Attach delivery or return evidence.",
      });
    if (outcome.status === "delivery_failed" && !outcome.returnTracking.trim())
      return setOutcome({
        ...outcome,
        error: "Enter the return tracking or ticket number.",
      });
    setSaving(outcome.row.id);
    try {
      const evidence = await upload(outcome.file);
      const response = await fetch(
        `/api/receipts/${outcome.row.id}/pod-delivered`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            status: outcome.status,
            reason: outcome.note || undefined,
            evidenceUrl: evidence.url,
            evidenceFileName: evidence.fileName,
            returnTrackingNumber: outcome.returnTracking || undefined,
          }),
        },
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok)
        throw new Error(json.error || "Unable to save POD outcome.");
      refresh(
        outcome.status === "delivered"
          ? "POD marked delivered."
          : "POD marked failed and customer notified.",
      );
    } catch (error) {
      setOutcome((current) =>
        current
          ? {
              ...current,
              error:
                error instanceof Error
                  ? error.message
                  : "Unable to save POD outcome.",
            }
          : current,
      );
    } finally {
      setSaving(null);
    }
  };
  return (
    <main className="space-y-6 bg-slate-950 text-slate-100">
      <section className="rounded-[26px] border border-white/10 bg-slate-900/70 p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.24em] text-amber-300">
              POD Delivery Centre
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Pay on Delivery operations
            </h1>
            <p className="mt-2 text-sm text-slate-400">
              Manage the full POD lifecycle here. Speedaf settlement is a
              reconciliation record and never changes POD sales or profit.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              accept="image/*,.csv,.xlsx,.xls"
              onChange={(event) =>
                setSettlementFile(event.target.files?.[0] || null)
              }
              className="max-w-[210px] text-xs"
            />
            <button
              type="button"
              disabled={settling || !settlementFile}
              onClick={() => void importSpeedafSettlement()}
              className="rounded-xl border border-emerald-400/45 px-3 py-2 text-sm font-semibold text-emerald-100 disabled:opacity-50"
            >
              {settling ? "Reconciling…" : "Import Speedaf payment"}
            </button>
            <Link
              href="/admin/receipts?customerType=pod"
              className="rounded-xl border border-cyan-400/35 px-4 py-2 text-sm font-semibold text-cyan-100"
            >
              Open receipts queue
            </Link>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map(([label, value, valueFilter]) => (
            <button
              type="button"
              key={label}
              onClick={() => setFilter(valueFilter)}
              className="rounded-2xl border border-white/10 bg-slate-950/70 p-4 text-left hover:border-emerald-400/40"
            >
              <p className="text-xs uppercase text-slate-400">{label}</p>
              <p className="mt-2 text-2xl font-semibold text-emerald-200">
                {value}
              </p>
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm">
            Internal Speedaf fees{" "}
            <strong className="ml-2 text-amber-200">
              {money(metrics.fees)}
            </strong>
          </div>
          <div className="rounded-xl border border-white/10 bg-slate-950/60 p-3 text-sm">
            Recorded POD profit{" "}
            <strong className="ml-2 text-emerald-200">
              {money(metrics.profit)}
            </strong>
          </div>
        </div>
      </section>
      {notice ? (
        <div
          role="status"
          className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-cyan-100"
        >
          {notice}
          <button
            type="button"
            className="float-right underline"
            onClick={() => setNotice(null)}
          >
            Dismiss
          </button>
        </div>
      ) : null}
      <section className="rounded-[26px] border border-white/10 bg-slate-900/70 p-5">
        <div className="flex gap-3">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search customer, receipt, station or staff"
            className="min-w-0 flex-1 rounded-xl border border-white/10 bg-slate-950 px-4 py-3"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-xl border border-white/10 bg-slate-950 px-4 py-3"
          >
            <option value="all">All POD statuses</option>
            <option value="pending">Pending</option>
            <option value="awaiting_fee">Awaiting delivery fee</option>
            <option value="dispatched">Dispatched</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
          </select>
        </div>
        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[1200px] text-left text-sm">
            <thead className="border-b border-white/10 text-xs uppercase text-slate-400">
              <tr>
                <th className="p-3">Receipt / customer</th>
                <th className="p-3">Amount</th>
                <th className="p-3">Delivery</th>
                <th className="p-3">Speedaf payment</th>
                <th className="p-3">Order / dispatch date</th>
                <th className="p-3">Speedaf pickup</th>
                <th className="p-3">POD waybill / evidence</th>
                <th className="p-3">Staff</th>
                <th className="p-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const state = normal(row.podDeliveryStatus);
                const waybill =
                  row.podTrackingNumbers?.filter(Boolean).join(" · ") ||
                  row.podReturnTrackingNumber ||
                  "";
                const busy = saving === row.id;
                const speedafPaid =
                  normal(row.podSpeedafSettlementStatus) === "paid";
                const speedafPaymentRequired = speedafPaymentIsRequired(state);
                return (
                  <tr key={row.id} className="border-b border-white/5">
                    <td className="p-3 font-semibold">
                      {row.orderRef || row.id}
                      <div className="font-normal">
                        {row.customerName || "Customer"}
                      </div>
                      <div className="text-xs font-normal text-slate-400">
                        {row.customerPhone || "No phone"}
                      </div>
                    </td>
                    <td className="p-3 font-semibold">{money(row.total)}</td>
                    <td className="p-3">
                      <span className="font-semibold uppercase">
                        {state.replace(/_/g, " ")}
                      </span>
                      <div className="mt-1 text-xs text-slate-400">
                        Fee:{" "}
                        {row.podDeliveryFee == null
                          ? "Not entered"
                          : money(row.podDeliveryFee)}
                      </div>
                    </td>
                    <td className="p-3 text-xs">
                      <span
                        className={
                          speedafPaid
                            ? "font-semibold text-emerald-300"
                            : speedafPaymentRequired
                              ? "font-semibold text-amber-300"
                              : "font-semibold text-slate-500"
                        }
                      >
                        {speedafPaid
                          ? "PAID BY SPEEDAF"
                          : speedafPaymentRequired
                            ? "AWAITING SPEEDAF PAYMENT"
                            : "SPEEDAF PAYMENT NOT REQUIRED"}
                      </span>
                      {speedafPaid ? (
                        <div className="mt-1 text-slate-400">
                          {dateTime(row.podSpeedafSettledAt)}
                        </div>
                      ) : null}
                    </td>
                    <td className="p-3 text-xs">
                      <div>
                        <span className="text-slate-400">Created:</span>{" "}
                        {dateTime(row.podCreatedAt || row.createdAt)}
                      </div>
                      <div className="mt-1">
                        <span className="text-slate-400">Dispatched:</span>{" "}
                        {dateTime(row.podDispatchedAt)}
                      </div>
                    </td>
                    <td className="p-3">
                      {row.podPickupStation || "Not set"}
                      <div className="text-xs text-slate-400">
                        {row.podPickupArea || ""}
                      </div>
                    </td>
                    <td className="p-3 break-all">
                      <div className="font-semibold text-slate-100">
                        {waybill || "Not entered"}
                      </div>
                      {waybill ? (
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => void copyWaybill(waybill)}
                            className="rounded-full border border-cyan-400/30 px-2 py-1 text-cyan-100 hover:bg-cyan-500/10"
                          >
                            Copy
                          </button>
                          <a
                            href="https://speedaf.com/cn-en/send-parcel"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-emerald-400/30 px-2 py-1 text-emerald-100 hover:bg-emerald-500/10"
                          >
                            Track ↗
                          </a>
                        </div>
                      ) : null}
                      <a
                        href={`/receipts/${row.id}/customer-view`}
                        className="mt-2 inline-block text-xs font-semibold text-cyan-200 underline"
                      >
                        Customer receipt
                      </a>
                      {row.podEvidenceUrl ? (
                        <a
                          href={row.podEvidenceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1 block text-xs text-cyan-300 underline"
                        >
                          View Speedaf evidence
                        </a>
                      ) : null}
                    </td>
                    <td className="p-3">{row.attendantName || "Unassigned"}</td>
                    <td className="p-3">
                      <div className="flex flex-wrap gap-2">
                        {state === "pending" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openFee(row, "dispatch")}
                            className="button"
                          >
                            Fee & dispatch
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => openFee(row, "edit")}
                            className="button"
                          >
                            Edit fee
                          </button>
                        )}
                        {state === "dispatched" ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                              setOutcome({
                                row,
                                status: "delivered",
                                note: "",
                                returnTracking: "",
                                file: null,
                                error: null,
                              })
                            }
                            className="button"
                          >
                            Record outcome
                          </button>
                        ) : null}
                        {state === "delivered" && !speedafPaid ? (
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void markSpeedafPaidManually(row)}
                            className="button"
                          >
                            Compare & mark Speedaf paid
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {rows.length === 0 ? (
            <p className="p-8 text-center text-slate-400">
              No POD deliveries match these filters.
            </p>
          ) : null}
        </div>
      </section>
      {fee ? (
        <FeeModal
          draft={fee}
          busy={saving === fee.row.id}
          onClose={() => setFee(null)}
          onChange={(patch) =>
            setFee((current) => (current ? { ...current, ...patch } : current))
          }
          onSubmit={() => void saveFee()}
        />
      ) : null}
      {outcome ? (
        <OutcomeModal
          draft={outcome}
          busy={saving === outcome.row.id}
          onClose={() => setOutcome(null)}
          onChange={(patch) =>
            setOutcome((current) =>
              current ? { ...current, ...patch } : current,
            )
          }
          onSubmit={() => void saveOutcome()}
        />
      ) : null}
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/85 p-4">
      <section className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/10 bg-slate-900 p-6">
        {children}
      </section>
    </div>
  );
}
function FeeModal({
  draft,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: FeeDraft;
  busy: boolean;
  onChange: (patch: Partial<FeeDraft>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const edit = draft.mode === "edit";
  return (
    <Shell>
      <p className="text-xs uppercase tracking-[.2em] text-emerald-300">
        {edit ? "Edit POD delivery fee" : "Dispatch POD"}
      </p>
      <h2 className="mt-2 text-2xl font-bold">{draft.row.orderRef}</h2>
      <p className="mt-2 text-sm text-slate-400">
        {edit
          ? "Save the corrected internal Speedaf fee. The POD status stays unchanged and profit totals are recalculated."
          : "Enter Speedaf’s charged fee and manual tracking number to dispatch."}
      </p>
      <label className="mt-5 block">
        Delivery fee (KES)
        <input
          value={draft.fee}
          inputMode="decimal"
          onChange={(event) => onChange({ fee: event.target.value })}
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 p-3"
        />
      </label>
      <label className="mt-4 block">
        Speedaf tracking number(s)
        <input
          value={draft.tracking}
          onChange={(event) => onChange({ tracking: event.target.value })}
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 p-3"
          placeholder="Separate multiple numbers with commas"
        />
      </label>
      <label className="mt-4 block">
        Attach Speedaf receipt image/PDF{" "}
        <span className="text-slate-400">(optional)</span>
        <input
          type="file"
          multiple
          accept="image/*,application/pdf"
          className="mt-2 block"
          onChange={(event) =>
            onChange({ files: Array.from(event.target.files || []) })
          }
        />
      </label>
      {draft.error ? <p className="mt-4 text-rose-300">{draft.error}</p> : null}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSubmit}
          className="rounded-xl bg-emerald-400 px-4 py-3 font-bold text-slate-950"
        >
          {busy
            ? "Saving..."
            : edit
              ? "Save & recalculate"
              : "Save fee & dispatch"}
        </button>
      </div>
    </Shell>
  );
}
function OutcomeModal({
  draft,
  busy,
  onChange,
  onClose,
  onSubmit,
}: {
  draft: OutcomeDraft;
  busy: boolean;
  onChange: (patch: Partial<OutcomeDraft>) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const failed = draft.status === "delivery_failed";
  return (
    <Shell>
      <p className="text-xs uppercase tracking-[.2em] text-cyan-300">
        POD outcome
      </p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => onChange({ status: "delivered" })}
          className="button"
        >
          Delivered
        </button>
        <button
          type="button"
          onClick={() => onChange({ status: "delivery_failed" })}
          className="button"
        >
          Failed
        </button>
      </div>
      <label className="mt-4 block">
        Note
        <textarea
          value={draft.note}
          onChange={(event) => onChange({ note: event.target.value })}
          className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 p-3"
        />
      </label>
      {failed ? (
        <label className="mt-4 block">
          Return tracking / ticket
          <input
            value={draft.returnTracking}
            onChange={(event) =>
              onChange({ returnTracking: event.target.value })
            }
            className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950 p-3"
          />
        </label>
      ) : null}
      <label className="mt-4 block">
        Evidence (required)
        <input
          type="file"
          accept="image/*,application/pdf"
          className="mt-2 block"
          onChange={(event) =>
            onChange({ file: event.target.files?.[0] || null })
          }
        />
      </label>
      {draft.error ? <p className="mt-4 text-rose-300">{draft.error}</p> : null}
      <div className="mt-6 flex justify-end gap-3">
        <button type="button" disabled={busy} onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onSubmit}
          className="rounded-xl bg-cyan-400 px-4 py-3 font-bold text-slate-950"
        >
          {busy ? "Saving..." : "Save outcome"}
        </button>
      </div>
    </Shell>
  );
}
