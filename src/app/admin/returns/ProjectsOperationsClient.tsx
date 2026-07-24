"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { showToast } from "@/lib/ui/toast";

type StaffOption = {
  id: string;
  name: string;
  email?: string | null;
};

type ProjectRow = {
  id: string;
  orderRef?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  attendantName?: string | null;
  total?: number | string | null;
  createdAt: string;
  projectStage?: string | null;
  projectPaymentTerm?: string | null;
  projectPaymentStatus?: string | null;
  projectDepositType?: "PERCENT" | "AMOUNT" | null;
  projectDepositValue?: number | null;
  projectDepositRequiredAmount?: number | null;
  projectDepositPaidAmount?: number | null;
  projectDepositPendingAmount?: number | null;
  projectDepositPaymentMethod?: "MPESA" | "CASH" | "BANK" | "MIXED" | "UNSPECIFIED" | null;
  projectDepositReference?: string | null;
  projectBalanceExpectedAmount?: number | null;
  projectBalancePaidAmount?: number | null;
  projectBalancePendingAmount?: number | null;
  projectBalancePaymentMethod?: "MPESA" | "CASH" | "BANK" | "MIXED" | "UNSPECIFIED" | null;
  projectBalanceReference?: string | null;
  projectTotalPaidAmount?: number | null;
  projectRemainingAmount?: number | null;
  projectScheduledDate?: string | null;
  projectHandlerType?: "STAFF" | "EXTERNAL" | null;
  projectHandlerStaffId?: string | null;
  projectHandlerStaffName?: string | null;
  projectExternalAgentName?: string | null;
  projectExternalAgentPhone?: string | null;
};

type ProjectEditor = {
  paymentTerm: "FULL_BEFORE_INSTALLATION" | "DEPOSIT_AND_BALANCE" | "FULL_AFTER_INSTALLATION";
  depositType: "PERCENT" | "AMOUNT";
  depositValue: string;
  depositPaidAmount: string;
  depositPaymentMethod: "MPESA" | "CASH" | "BANK" | "MIXED" | "UNSPECIFIED";
  depositReference: string;
  balancePaidAmount: string;
  balancePaymentMethod: "MPESA" | "CASH" | "BANK" | "MIXED" | "UNSPECIFIED";
  balanceReference: string;
  scheduledDate: string;
  paymentNotes: string;
  handlerType: "STAFF" | "EXTERNAL" | "";
  handlerStaffId: string;
  externalAgentName: string;
  externalAgentPhone: string;
};

type ProjectsOperationsClientProps = {
  scope?: "admin" | "technical";
  viewerId?: string | null;
};

type ProjectStageFilter = "ALL" | "RECEIPT_CREATED" | "PROJECT_IN_PROGRESS" | "COMPLETED_POSTED";

const formatCurrency = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "Ksh 0";
  return `Ksh ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
};

const formatProjectStageLabel = (value?: string | null) => {
  switch (value) {
    case "RECEIPT_CREATED":
      return "Project pending";
    case "PROJECT_IN_PROGRESS":
      return "Project in progress";
    case "COMPLETED_POSTED":
      return "Completed and posted";
    default:
      return "Project pending";
  }
};

const formatPaymentTermLabel = (value?: string | null) => {
  switch (value) {
    case "FULL_BEFORE_INSTALLATION":
      return "Pay fully before installation";
    case "DEPOSIT_AND_BALANCE":
      return "Deposit and balance";
    case "FULL_AFTER_INSTALLATION":
      return "Pay fully after installation";
    default:
      return "30% deposit and balance";
  }
};

const formatPaymentStatusLabel = (value?: string | null) => {
  switch (value) {
    case "FULLY_PAID":
      return "Fully paid";
    case "PARTIALLY_PAID":
      return "Partially paid";
    default:
      return "Unpaid";
  }
};

const formatPaymentMethodLabel = (value?: string | null) => {
  switch (value) {
    case "MPESA":
      return "M-Pesa";
    case "CASH":
      return "Cash";
    case "BANK":
      return "Bank";
    case "MIXED":
      return "Mixed";
    default:
      return "Unspecified";
  }
};

const formatProjectDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const PROJECT_COMPLETION_COMMISSION = 2000;

const makeEditor = (row: ProjectRow): ProjectEditor => ({
  paymentTerm:
    row.projectPaymentTerm === "FULL_BEFORE_INSTALLATION" ||
    row.projectPaymentTerm === "FULL_AFTER_INSTALLATION" ||
    row.projectPaymentTerm === "DEPOSIT_AND_BALANCE"
      ? row.projectPaymentTerm
      : "DEPOSIT_AND_BALANCE",
  depositType: row.projectDepositType === "AMOUNT" ? "AMOUNT" : "PERCENT",
  depositValue: String(
    row.projectDepositType === "AMOUNT"
      ? row.projectDepositRequiredAmount ?? row.projectDepositValue ?? 0
      : row.projectDepositValue ?? 30,
  ),
  depositPaidAmount: String(row.projectDepositPaidAmount ?? 0),
  depositPaymentMethod: row.projectDepositPaymentMethod ?? "UNSPECIFIED",
  depositReference: row.projectDepositReference ?? "",
  balancePaidAmount: String(row.projectBalancePaidAmount ?? 0),
  balancePaymentMethod: row.projectBalancePaymentMethod ?? "UNSPECIFIED",
  balanceReference: row.projectBalanceReference ?? "",
  scheduledDate: row.projectScheduledDate ? row.projectScheduledDate.slice(0, 10) : "",
  paymentNotes: "",
  handlerType: row.projectHandlerType ?? "",
  handlerStaffId: row.projectHandlerStaffId ?? "",
  externalAgentName: row.projectExternalAgentName ?? "",
  externalAgentPhone: row.projectExternalAgentPhone ?? "",
});

export default function ProjectsOperationsClient({
  scope = "admin",
  viewerId = null,
}: ProjectsOperationsClientProps) {
  const isTechnicalScope = scope === "technical";
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<ProjectStageFilter>("ALL");
  const [editors, setEditors] = useState<Record<string, ProjectEditor>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [firstReceiptsRes, staffRes] = await Promise.all([
        fetch("/api/receipts?customerType=project&scope=global&page=1&size=200", {
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch("/api/receipts/staff", {
          cache: "no-store",
          credentials: "same-origin",
        }),
      ]);
      const receiptsPayload = await firstReceiptsRes.json().catch(() => ({}));
      const staffPayload = await staffRes.json().catch(() => []);
      if (!firstReceiptsRes.ok) {
        throw new Error(receiptsPayload?.error || "Failed to load project receipts");
      }
      let nextRows = Array.isArray(receiptsPayload?.receipts) ? receiptsPayload.receipts : [];
      const totalPages = Math.max(1, Number(receiptsPayload?.paging?.totalPages || 1));

      if (totalPages > 1) {
        const remainingPayloads = await Promise.all(
          Array.from({ length: totalPages - 1 }, (_, index) =>
            fetch(`/api/receipts?customerType=project&scope=global&page=${index + 2}&size=200`, {
              cache: "no-store",
              credentials: "same-origin",
            }).then((response) => response.json().catch(() => ({}))),
          ),
        );

        for (const payload of remainingPayloads) {
          if (Array.isArray(payload?.receipts)) {
            nextRows = nextRows.concat(payload.receipts);
          }
        }
      }

      setRows(nextRows);
      setEditors(
        Object.fromEntries(nextRows.map((row: ProjectRow) => [row.id, makeEditor(row)])),
      );
      setStaff(Array.isArray(staffPayload) ? staffPayload : []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load projects", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (
        scope === "technical" &&
        String(row.projectHandlerStaffId || "").trim() !== String(viewerId || "").trim()
      ) {
        return false;
      }
      if (stageFilter !== "ALL" && row.projectStage !== stageFilter) return false;
      if (!term) return true;
      return [
        row.orderRef,
        row.customerName,
        row.customerPhone,
        row.projectHandlerStaffName,
        row.projectExternalAgentName,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term));
    });
  }, [query, rows, scope, stageFilter, viewerId]);

  const scopedRows = useMemo(() => {
    if (!isTechnicalScope) return rows;
    return rows.filter(
      (row) => String(row.projectHandlerStaffId || "").trim() === String(viewerId || "").trim(),
    );
  }, [isTechnicalScope, rows, viewerId]);

  const summary = useMemo(() => {
    return {
      total: scopedRows.length,
      receiptCreated: scopedRows.filter((row) => row.projectStage === "RECEIPT_CREATED").length,
      inProgress: scopedRows.filter((row) => row.projectStage === "PROJECT_IN_PROGRESS").length,
      completed: scopedRows.filter((row) => row.projectStage === "COMPLETED_POSTED").length,
    };
  }, [scopedRows]);

  const stageFilterLabel = useMemo(() => {
    switch (stageFilter) {
      case "RECEIPT_CREATED":
        return "pending projects";
      case "PROJECT_IN_PROGRESS":
        return "projects in progress";
      case "COMPLETED_POSTED":
        return "completed projects";
      default:
        return "all projects";
    }
  }, [stageFilter]);

  const toggleStageFilter = (value: ProjectStageFilter) => {
    setStageFilter((current) => (current === value ? "ALL" : value));
  };

  const setEditorValue = (receiptId: string, patch: Partial<ProjectEditor>) => {
    setEditors((current) => ({
      ...current,
      [receiptId]: {
        ...(current[receiptId] ?? makeEditor(rows.find((row) => row.id === receiptId) ?? { id: receiptId, createdAt: new Date().toISOString() })),
        ...patch,
      },
    }));
  };

  const saveProject = async (
    receiptId: string,
    override?: { stage?: "RECEIPT_CREATED" | "PROJECT_IN_PROGRESS" | "COMPLETED_POSTED" },
  ) => {
    const editor = editors[receiptId];
    const selectedStaff = staff.find((member) => member.id === editor?.handlerStaffId);
    if (!editor) return;
    setSavingId(receiptId);
    try {
      const res = await fetch(`/api/receipts/${receiptId}/project`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          ...override,
          paymentTerm: editor.paymentTerm,
          depositType: editor.depositType,
          depositValue: Number(editor.depositValue || 0),
          depositPaidAmount: Number(editor.depositPaidAmount || 0),
          depositPaymentMethod: editor.depositPaymentMethod,
          depositReference: editor.depositReference || null,
          balancePaidAmount: Number(editor.balancePaidAmount || 0),
          balancePaymentMethod: editor.balancePaymentMethod,
          balanceReference: editor.balanceReference || null,
          scheduledDate: editor.scheduledDate || null,
          paymentNotes: editor.paymentNotes || null,
          handlerType: editor.handlerType || null,
          handlerStaffId: editor.handlerType === "STAFF" ? editor.handlerStaffId || null : null,
          handlerStaffName:
            editor.handlerType === "STAFF" ? selectedStaff?.name || null : null,
          externalAgentName:
            editor.handlerType === "EXTERNAL" ? editor.externalAgentName || null : null,
          externalAgentPhone:
            editor.handlerType === "EXTERNAL" ? editor.externalAgentPhone || null : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to update project");
      }
      showToast(
        override?.stage === "COMPLETED_POSTED"
          ? "Project marked complete and left in POS for normal pricing flow"
          : override?.stage === "PROJECT_IN_PROGRESS"
            ? "Project marked in progress"
            : "Project assignment updated",
        "success",
      );
      await load();
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to update project", "error");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl p-6">
      <header className="rounded-3xl border border-cyan-500/20 bg-slate-950/60 p-6">
        <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Projects</p>
        <h1 className="mt-3 text-3xl font-semibold text-white">Project receipts operations</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-300">
          Manage scheduled installations, assign the handler, move the project into progress, and complete it before the receipt continues through the normal POS pricing flow.
        </p>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => setStageFilter("ALL")}
            className={`rounded-2xl border p-4 text-left transition ${
              stageFilter === "ALL"
                ? "border-cyan-400/40 bg-cyan-500/10"
                : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]"
            }`}
          >
            <div className="text-xs uppercase tracking-[0.25em] text-slate-400">Visible projects</div>
            <div className="mt-2 text-3xl font-semibold text-white">{filteredRows.length}</div>
            <div className="mt-2 text-xs text-slate-400">Showing {stageFilterLabel}</div>
          </button>
          <button
            type="button"
            onClick={() => toggleStageFilter("RECEIPT_CREATED")}
            className={`rounded-2xl border p-4 text-left transition ${
              stageFilter === "RECEIPT_CREATED"
                ? "border-amber-400/50 bg-amber-500/15"
                : "border-amber-500/20 bg-amber-500/10 hover:border-amber-400/35 hover:bg-amber-500/15"
            }`}
          >
            <div className="text-xs uppercase tracking-[0.25em] text-amber-200">Project pending</div>
            <div className="mt-2 text-3xl font-semibold text-amber-100">{summary.receiptCreated}</div>
          </button>
          <button
            type="button"
            onClick={() => toggleStageFilter("PROJECT_IN_PROGRESS")}
            className={`rounded-2xl border p-4 text-left transition ${
              stageFilter === "PROJECT_IN_PROGRESS"
                ? "border-sky-400/50 bg-sky-500/15"
                : "border-sky-500/20 bg-sky-500/10 hover:border-sky-400/35 hover:bg-sky-500/15"
            }`}
          >
            <div className="text-xs uppercase tracking-[0.25em] text-sky-200">In progress</div>
            <div className="mt-2 text-3xl font-semibold text-sky-100">{summary.inProgress}</div>
          </button>
          <button
            type="button"
            onClick={() => toggleStageFilter("COMPLETED_POSTED")}
            className={`rounded-2xl border p-4 text-left transition ${
              stageFilter === "COMPLETED_POSTED"
                ? "border-emerald-400/50 bg-emerald-500/15"
                : "border-emerald-500/20 bg-emerald-500/10 hover:border-emerald-400/35 hover:bg-emerald-500/15"
            }`}
          >
            <div className="text-xs uppercase tracking-[0.25em] text-emerald-200">Completed</div>
            <div className="mt-2 text-3xl font-semibold text-emerald-100">{summary.completed}</div>
          </button>
        </div>
      </header>

      <section className="mt-6 flex flex-col gap-3 rounded-3xl border border-white/10 bg-slate-950/50 p-4 md:flex-row md:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer, phone, reference, or handler"
          className="w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60 md:max-w-md"
        />
        <select
          value={stageFilter}
          onChange={(e) => setStageFilter(e.target.value as typeof stageFilter)}
          className="rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/60"
        >
          <option value="ALL">All stages</option>
          <option value="RECEIPT_CREATED">Project pending</option>
          <option value="PROJECT_IN_PROGRESS">Project in progress</option>
          <option value="COMPLETED_POSTED">Completed</option>
        </select>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
        >
          Refresh
        </button>
      </section>

      <div className="mt-6 space-y-4">
        {loading ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 text-sm text-slate-300">
            Loading project receipts...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-3xl border border-white/10 bg-slate-950/50 p-6 text-sm text-slate-300">
            No project receipts found.
          </div>
        ) : (
          filteredRows.map((row) => {
            const editor = editors[row.id] ?? makeEditor(row);
            const isSaving = savingId === row.id;
            return (
              <article
                key={row.id}
                className="rounded-3xl border border-white/10 bg-slate-950/60 p-5"
              >
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-lg font-semibold text-white">
                        {row.customerName || row.orderRef || "Project"}
                      </h2>
                      <span className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-100">
                        Project
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-200">
                        {formatProjectStageLabel(row.projectStage)}
                      </span>
                      <Link
                        href={`/receipts/print/${encodeURIComponent(row.id)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-full border border-emerald-400/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                      >
                        Preview receipt
                      </Link>
                    </div>
                    <div className="mt-2 text-sm text-slate-300">
                      {[row.orderRef, row.customerPhone, formatCurrency(row.total)].filter(Boolean).join(" · ")}
                    </div>
                    <div className="mt-1 text-xs text-slate-400">
                      Created {new Date(row.createdAt).toLocaleString("en-KE")}
                    </div>
                    {row.projectScheduledDate ? (
                      <div className="mt-1 text-xs text-slate-400">
                        Installation date: {formatProjectDate(row.projectScheduledDate)}
                      </div>
                    ) : null}
                    {row.projectHandlerType === "STAFF" && row.projectHandlerStaffId ? (
                      <div className="mt-2 text-xs text-slate-400">
                        {row.projectStage === "PROJECT_IN_PROGRESS"
                          ? `Pending assigned project commission: ${formatCurrency(PROJECT_COMPLETION_COMMISSION)}`
                          : row.projectStage === "COMPLETED_POSTED"
                            ? `Project commission earned: ${formatCurrency(PROJECT_COMPLETION_COMMISSION)}`
                            : `Project commission unlocks after this assigned project moves into progress.`}
                      </div>
                    ) : null}
                  </div>
                  {row.attendantName ? (
                    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                      Assigned by receipt: {row.attendantName}
                    </div>
                  ) : null}
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Payment status
                    </div>
                    <div className="mt-2 text-base font-semibold text-white">
                      {formatPaymentStatusLabel(row.projectPaymentStatus)}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {formatPaymentTermLabel(row.projectPaymentTerm)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Paid so far
                    </div>
                    <div className="mt-2 text-base font-semibold text-white">
                      {formatCurrency(row.projectTotalPaidAmount)}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      Remaining {formatCurrency(row.projectRemainingAmount)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Deposit
                    </div>
                    <div className="mt-2 text-base font-semibold text-white">
                      {formatCurrency(row.projectDepositPaidAmount)} / {formatCurrency(row.projectDepositRequiredAmount)}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {formatPaymentMethodLabel(row.projectDepositPaymentMethod)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                    <div className="text-[11px] uppercase tracking-[0.2em] text-slate-400">
                      Balance
                    </div>
                    <div className="mt-2 text-base font-semibold text-white">
                      {formatCurrency(row.projectBalancePendingAmount)}
                    </div>
                    <div className="mt-1 text-sm text-slate-400">
                      {row.projectPaymentTerm === "FULL_AFTER_INSTALLATION"
                        ? "Pay after installation"
                        : formatPaymentMethodLabel(row.projectBalancePaymentMethod)}
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-4">
                  <label className="text-sm text-slate-200">
                    Installation date
                    <input
                      type="date"
                      value={editor.scheduledDate}
                      onChange={(e) => setEditorValue(row.id, { scheduledDate: e.target.value })}
                      onClick={(e) => e.currentTarget.showPicker?.()}
                      className="mt-2 w-full cursor-pointer rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60"
                    />
                  </label>
                  <label className="text-sm text-slate-200">
                    Handler type
                    <select
                      value={editor.handlerType}
                      disabled={isTechnicalScope}
                      onChange={(e) =>
                        setEditorValue(row.id, {
                          handlerType: e.target.value as ProjectEditor["handlerType"],
                          handlerStaffId: e.target.value === "STAFF" ? editor.handlerStaffId : "",
                          externalAgentName: e.target.value === "EXTERNAL" ? editor.externalAgentName : "",
                          externalAgentPhone: e.target.value === "EXTERNAL" ? editor.externalAgentPhone : "",
                        })
                      }
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      <option value="">Unassigned</option>
                      <option value="STAFF">Staff</option>
                      <option value="EXTERNAL">External agent</option>
                    </select>
                  </label>

                  {editor.handlerType === "STAFF" ? (
                    <label className="text-sm text-slate-200 xl:col-span-2">
                      Assigned staff
                      <select
                        value={editor.handlerStaffId}
                        disabled={isTechnicalScope}
                        onChange={(e) => setEditorValue(row.id, { handlerStaffId: e.target.value })}
                        className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <option value="">Select staff</option>
                        {staff.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : editor.handlerType === "EXTERNAL" ? (
                    <>
                      <label className="text-sm text-slate-200">
                        Agent name
                        <input
                          value={editor.externalAgentName}
                          disabled={isTechnicalScope}
                          onChange={(e) => setEditorValue(row.id, { externalAgentName: e.target.value })}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                      <label className="text-sm text-slate-200">
                        Agent phone
                        <input
                          value={editor.externalAgentPhone}
                          disabled={isTechnicalScope}
                          onChange={(e) => setEditorValue(row.id, { externalAgentPhone: e.target.value })}
                          className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/80 px-4 py-3 text-white outline-none focus:border-cyan-400/60 disabled:cursor-not-allowed disabled:opacity-70"
                        />
                      </label>
                    </>
                  ) : null}
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => void saveProject(row.id)}
                    disabled={isSaving}
                    className="rounded-2xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save project setup"}
                  </button>
                  {row.projectStage !== "PROJECT_IN_PROGRESS" && row.projectStage !== "COMPLETED_POSTED" ? (
                    <button
                      type="button"
                      onClick={() => void saveProject(row.id, { stage: "PROJECT_IN_PROGRESS" })}
                      disabled={isSaving}
                      className="rounded-2xl border border-sky-400/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 hover:bg-sky-500/20 disabled:opacity-50"
                    >
                      Mark as progressing
                    </button>
                  ) : null}
                  {row.projectStage !== "COMPLETED_POSTED" ? (
                    <button
                      type="button"
                      onClick={() => void saveProject(row.id, { stage: "COMPLETED_POSTED" })}
                      disabled={isSaving}
                      className="rounded-2xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      Mark complete and post to POS flow
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })
        )}
      </div>
    </div>
  );
}
