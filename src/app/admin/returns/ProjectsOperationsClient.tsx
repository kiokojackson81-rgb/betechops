"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { showToast } from "@/lib/ui/toast";

type StaffOption = {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  whatsappNumber?: string | null;
  technicalPhoneNumber?: string | null;
  attendantCategory?: string | null;
};

type ExternalAgentOption = {
  id: string;
  name: string;
  whatsappNumber: string;
  isActive?: boolean;
};

type AssignedHandler = {
  kind: "STAFF" | "EXTERNAL";
  staffId?: string | null;
  staffName?: string | null;
  externalAgentId?: string | null;
  externalAgentName?: string | null;
  phone?: string | null;
};

type ProjectRow = {
  id: string;
  orderRef?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  customerLocation?: string | null;
  attendantName?: string | null;
  total?: number | string | null;
  createdAt: string;
  projectStage?: string | null;
  projectPaymentTerm?: "FULL_BEFORE_INSTALLATION" | "DEPOSIT_AND_BALANCE" | "FULL_AFTER_INSTALLATION" | null;
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
  projectPaymentNotes?: string | null;
  projectScheduledDate?: string | null;
  projectHandlerType?: "STAFF" | "EXTERNAL" | null;
  projectHandlerStaffId?: string | null;
  projectHandlerStaffName?: string | null;
  projectHandlerStaffIds?: string[] | null;
  projectExternalAgentId?: string | null;
  projectExternalAgentName?: string | null;
  projectExternalAgentIds?: string[] | null;
  projectExternalAgentPhone?: string | null;
  projectAssignedHandlers?: AssignedHandler[] | null;
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
  handlerStaffIds: string[];
  externalAgentIds: string[];
};

type ProjectsOperationsClientProps = {
  scope?: "admin" | "technical";
  viewerId?: string | null;
};

type ProjectStageFilter = "ALL" | "RECEIPT_CREATED" | "PROJECT_IN_PROGRESS" | "COMPLETED_POSTED";

type AssignmentModalState =
  | { type: "staff"; rowId: string }
  | { type: "external"; rowId: string }
  | null;

const PROJECT_COMPLETION_COMMISSION = 2000;

const formatCurrency = (value: number | string | null | undefined) => {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "Ksh 0";
  return `Ksh ${amount.toLocaleString("en-KE", { maximumFractionDigits: 0 })}`;
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

const formatProjectDateTime = (value?: string | null) => {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "Unknown";
  return date.toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
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

const getProjectStageRank = (value?: string | null) => {
  switch (value) {
    case "RECEIPT_CREATED":
      return 0;
    case "PROJECT_IN_PROGRESS":
      return 1;
    case "COMPLETED_POSTED":
      return 2;
    default:
      return 0;
  }
};

const getInitials = (value?: string | null) => {
  const tokens = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (tokens.length === 0) return "PR";
  return tokens.map((token) => token.charAt(0).toUpperCase()).join("");
};

const renderAssignedLabel = (handler: AssignedHandler) => {
  const name =
    handler.kind === "STAFF"
      ? handler.staffName || "Staff"
      : handler.externalAgentName || "External";
  return handler.phone ? `${name} · ${handler.phone}` : name;
};

const getDisplayStatus = (row: ProjectRow) => {
  if (row.projectStage === "COMPLETED_POSTED") {
    return {
      label: "Completed",
      tone: "border-emerald-500/30 bg-emerald-500/12 text-emerald-200",
    };
  }

  if (row.projectStage === "PROJECT_IN_PROGRESS") {
    return {
      label: "In Progress",
      tone: "border-sky-500/30 bg-sky-500/12 text-sky-200",
    };
  }

  if (Number(row.projectRemainingAmount ?? 0) > 0 && Number(row.projectTotalPaidAmount ?? 0) > 0 && !row.projectScheduledDate) {
    return {
      label: "Awaiting Payment",
      tone: "border-orange-500/30 bg-orange-500/12 text-orange-200",
    };
  }

  if (row.projectScheduledDate) {
    return {
      label: "Scheduled",
      tone: "border-fuchsia-500/30 bg-fuchsia-500/12 text-fuchsia-200",
    };
  }

  return {
    label: "Pending",
    tone: "border-amber-500/30 bg-amber-500/12 text-amber-200",
  };
};

const getLocationValue = (row: ProjectRow) => String(row.customerLocation || "Unspecified").trim();

const getAssignedHandlers = (row: ProjectRow) => row.projectAssignedHandlers ?? [];

const getAssignedStaffIds = (row: ProjectRow) => {
  const direct = Array.isArray(row.projectHandlerStaffIds) ? row.projectHandlerStaffIds.filter(Boolean) : [];
  const legacy = row.projectHandlerStaffId ? [row.projectHandlerStaffId] : [];
  const derived = getAssignedHandlers(row)
    .filter((entry) => entry.kind === "STAFF" && entry.staffId)
    .map((entry) => entry.staffId as string);
  return Array.from(new Set([...direct, ...legacy, ...derived]));
};

const getAssignedExternalIds = (row: ProjectRow) => {
  const direct = Array.isArray(row.projectExternalAgentIds) ? row.projectExternalAgentIds.filter(Boolean) : [];
  const legacy = row.projectExternalAgentId ? [row.projectExternalAgentId] : [];
  const derived = getAssignedHandlers(row)
    .filter((entry) => entry.kind === "EXTERNAL" && entry.externalAgentId)
    .map((entry) => entry.externalAgentId as string);
  return Array.from(new Set([...direct, ...legacy, ...derived]));
};

function makeEditor(row: ProjectRow): ProjectEditor {
  return {
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
    paymentNotes: row.projectPaymentNotes ?? "",
    handlerStaffIds: getAssignedStaffIds(row),
    externalAgentIds: getAssignedExternalIds(row),
  };
}

function toggleValue(values: string[], value: string) {
  return values.includes(value) ? values.filter((entry) => entry !== value) : [...values, value];
}

function ModalShell({
  title,
  description,
  children,
  onClose,
  footer,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-white/10 bg-[#07111f] shadow-[0_30px_80px_rgba(0,0,0,0.45)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <div className="text-[11px] uppercase tracking-[0.32em] text-cyan-300">Project Assignment</div>
            <h3 className="mt-2 text-xl font-semibold text-white">{title}</h3>
            <p className="mt-1 text-sm text-slate-400">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 hover:bg-white/10"
          >
            Close
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <div className="border-t border-white/10 bg-[#091321] px-5 py-4">{footer}</div> : null}
      </div>
    </div>
  );
}

export default function ProjectsOperationsClient({
  scope = "admin",
  viewerId = null,
}: ProjectsOperationsClientProps) {
  const isTechnicalScope = scope === "technical";
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [externalAgents, setExternalAgents] = useState<ExternalAgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [stageFilter, setStageFilter] = useState<ProjectStageFilter>("ALL");
  const [locationFilter, setLocationFilter] = useState("ALL");
  const [technicianFilter, setTechnicianFilter] = useState("ALL");
  const [installationDateFilter, setInstallationDateFilter] = useState("");
  const [editors, setEditors] = useState<Record<string, ProjectEditor>>({});
  const [newAgentName, setNewAgentName] = useState("");
  const [newAgentPhone, setNewAgentPhone] = useState("");
  const [agentSaving, setAgentSaving] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<string[]>([]);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [assignmentModal, setAssignmentModal] = useState<AssignmentModalState>(null);
  const [assignmentSearch, setAssignmentSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [firstReceiptsRes, staffRes, externalAgentsRes] = await Promise.all([
        fetch("/api/receipts?customerType=project&scope=global&page=1&size=200", {
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch("/api/receipts/staff", {
          cache: "no-store",
          credentials: "same-origin",
        }),
        fetch("/api/project-external-agents", {
          cache: "no-store",
          credentials: "same-origin",
        }),
      ]);
      const receiptsPayload = await firstReceiptsRes.json().catch(() => ({}));
      const staffPayload = await staffRes.json().catch(() => []);
      const externalAgentsPayload = await externalAgentsRes.json().catch(() => []);
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
      setEditors(Object.fromEntries(nextRows.map((row: ProjectRow) => [row.id, makeEditor(row)])));
      setStaff(Array.isArray(staffPayload) ? staffPayload : []);
      setExternalAgents(Array.isArray(externalAgentsPayload) ? externalAgentsPayload : []);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load projects", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const nextQuery = params.get("q") || "";
    const nextStage = params.get("status") || "ALL";
    const nextLocation = params.get("location") || "ALL";
    const nextTechnician = params.get("technician") || "ALL";
    const nextDate = params.get("installationDate") || "";
    setQuery(nextQuery);
    setStageFilter(
      nextStage === "RECEIPT_CREATED" || nextStage === "PROJECT_IN_PROGRESS" || nextStage === "COMPLETED_POSTED"
        ? nextStage
        : "ALL",
    );
    setLocationFilter(nextLocation);
    setTechnicianFilter(nextTechnician);
    setInstallationDateFilter(nextDate);
  }, []);

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (query) params.set("q", query);
    else params.delete("q");
    if (stageFilter !== "ALL") params.set("status", stageFilter);
    else params.delete("status");
    if (locationFilter !== "ALL") params.set("location", locationFilter);
    else params.delete("location");
    if (technicianFilter !== "ALL") params.set("technician", technicianFilter);
    else params.delete("technician");
    if (installationDateFilter) params.set("installationDate", installationDateFilter);
    else params.delete("installationDate");
    const next = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState(null, "", next);
  }, [installationDateFilter, locationFilter, query, stageFilter, technicianFilter]);

  const scopedRows = useMemo(() => {
    if (!isTechnicalScope) return rows;
    return rows.filter((row) => getAssignedStaffIds(row).includes(String(viewerId || "").trim()));
  }, [isTechnicalScope, rows, viewerId]);

  const locationOptions = useMemo(
    () =>
      Array.from(new Set(scopedRows.map((row) => getLocationValue(row)).filter(Boolean))).sort((left, right) =>
        left.localeCompare(right),
      ),
    [scopedRows],
  );

  const filteredRows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return scopedRows
      .filter((row) => {
        if (stageFilter !== "ALL" && row.projectStage !== stageFilter) return false;
        if (locationFilter !== "ALL" && getLocationValue(row) !== locationFilter) return false;
        if (technicianFilter !== "ALL" && !getAssignedStaffIds(row).includes(technicianFilter)) return false;
        if (installationDateFilter) {
          const currentDate = row.projectScheduledDate ? row.projectScheduledDate.slice(0, 10) : "";
          if (currentDate !== installationDateFilter) return false;
        }
        if (!term) return true;

        const searchableValues = [
          row.orderRef,
          row.customerName,
          row.customerPhone,
          row.customerLocation,
          row.projectHandlerStaffName,
          row.projectExternalAgentName,
          row.attendantName,
          ...getAssignedHandlers(row).map(renderAssignedLabel),
        ]
          .filter(Boolean)
          .map((value) => String(value).toLowerCase());

        return searchableValues.some((value) => value.includes(term));
      })
      .sort((left, right) => {
        const stageRankDiff = getProjectStageRank(left.projectStage) - getProjectStageRank(right.projectStage);
        if (stageRankDiff !== 0) return stageRankDiff;
        return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
      });
  }, [installationDateFilter, locationFilter, query, scopedRows, stageFilter, technicianFilter]);

  const summary = useMemo(
    () => ({
      total: scopedRows.length,
      pending: scopedRows.filter((row) => row.projectStage === "RECEIPT_CREATED" || !row.projectStage).length,
      inProgress: scopedRows.filter((row) => row.projectStage === "PROJECT_IN_PROGRESS").length,
      completed: scopedRows.filter((row) => row.projectStage === "COMPLETED_POSTED").length,
    }),
    [scopedRows],
  );

  const setEditorValue = (receiptId: string, patch: Partial<ProjectEditor>) => {
    setEditors((current) => ({
      ...current,
      [receiptId]: {
        ...(current[receiptId] ??
          makeEditor(rows.find((row) => row.id === receiptId) ?? { id: receiptId, createdAt: new Date().toISOString() })),
        ...patch,
      },
    }));
  };

  const clearFilters = () => {
    setQuery("");
    setStageFilter("ALL");
    setLocationFilter("ALL");
    setTechnicianFilter("ALL");
    setInstallationDateFilter("");
  };

  const toggleExpanded = (rowId: string) => {
    setExpandedRowIds((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : [rowId]));
  };

  const toggleSelected = (rowId: string) => {
    setSelectedRowIds((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]));
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = filteredRows.map((row) => row.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedRowIds.includes(id));
    setSelectedRowIds(allSelected ? selectedRowIds.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...selectedRowIds, ...visibleIds])));
  };

  const saveProject = async (
    receiptId: string,
    override?: { stage?: "RECEIPT_CREATED" | "PROJECT_IN_PROGRESS" | "COMPLETED_POSTED" },
  ) => {
    const editor = editors[receiptId];
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
          handlerStaffIds: editor.handlerStaffIds,
          externalAgentIds: editor.externalAgentIds,
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

  const createExternalAgent = async () => {
    setAgentSaving(true);
    try {
      const res = await fetch("/api/project-external-agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name: newAgentName, whatsappNumber: newAgentPhone }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to save external agent");
      }
      setNewAgentName("");
      setNewAgentPhone("");
      await load();
      showToast("External agent saved", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to save external agent", "error");
    } finally {
      setAgentSaving(false);
    }
  };

  const seedExternalAgents = async () => {
    setAgentSaving(true);
    try {
      const res = await fetch("/api/project-external-agents", {
        method: "PUT",
        credentials: "same-origin",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to load starter agents");
      }
      await load();
      showToast("Starter external agents loaded", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to load starter agents", "error");
    } finally {
      setAgentSaving(false);
    }
  };

  const deleteExternalAgent = async (id: string) => {
    setAgentSaving(true);
    try {
      const res = await fetch(`/api/project-external-agents?id=${encodeURIComponent(id)}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || "Failed to delete external agent");
      }
      await load();
      showToast("External agent removed", "success");
    } catch (error) {
      showToast(error instanceof Error ? error.message : "Failed to delete external agent", "error");
    } finally {
      setAgentSaving(false);
    }
  };

  const saveAssignmentsFromModal = async () => {
    if (!assignmentModal) return;
    await saveProject(assignmentModal.rowId);
    setAssignmentModal(null);
    setAssignmentSearch("");
  };

  const modalRow = assignmentModal ? rows.find((row) => row.id === assignmentModal.rowId) ?? null : null;
  const modalEditor = modalRow ? editors[modalRow.id] ?? makeEditor(modalRow) : null;
  const assignmentOptions = useMemo(() => {
    const term = assignmentSearch.trim().toLowerCase();
    if (!assignmentModal) return [];
    if (assignmentModal.type === "staff") {
      return staff.filter((member) => {
        if (!term) return true;
        return [member.name, member.whatsappNumber, member.technicalPhoneNumber, member.phone]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      });
    }
    return externalAgents.filter((agent) => {
      if (!term) return true;
      return [agent.name, agent.whatsappNumber].some((value) => String(value).toLowerCase().includes(term));
    });
  }, [assignmentModal, assignmentSearch, externalAgents, staff]);

  return (
    <div className="mx-auto max-w-[1700px] p-4 sm:p-6">
      <section className="rounded-[32px] border border-white/10 bg-[linear-gradient(180deg,rgba(6,12,24,0.98),rgba(8,16,31,0.96))] px-5 py-6 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:px-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-[0.38em] text-cyan-300">Admin Projects</div>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white">Projects</h1>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
              Track project receipts, schedule installations, assign internal technicians and external agents, and move each project through the live POS workflow.
            </p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="min-w-[260px] rounded-2xl border border-white/10 bg-[#0b1424] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Search</div>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Project, receipt, customer, phone"
                className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
              />
            </div>
            <button
              type="button"
              onClick={() => void load()}
              className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition hover:bg-cyan-500/20"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "All Projects", value: summary.total, accent: "text-white" },
            { label: "Pending", value: summary.pending, accent: "text-amber-200" },
            { label: "In Progress", value: summary.inProgress, accent: "text-sky-200" },
            { label: "Completed", value: summary.completed, accent: "text-emerald-200" },
          ].map((card) => (
            <div key={card.label} className="rounded-[26px] border border-white/8 bg-[#0a1322] px-5 py-4">
              <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500">{card.label}</div>
              <div className={`mt-3 text-2xl font-semibold ${card.accent}`}>{card.value}</div>
            </div>
          ))}
        </div>
      </section>

      {!isTechnicalScope ? (
        <section className="mt-6 rounded-[30px] border border-white/10 bg-[#07111f] p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">External Agents</div>
              <h2 className="mt-2 text-xl font-semibold text-white">Manage project external technicians</h2>
              <p className="mt-2 text-sm text-slate-400">
                Save, reuse, and delete external agents used for installation assignments and notifications.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void seedExternalAgents()}
              disabled={agentSaving}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10 disabled:opacity-50"
            >
              Load starter agents
            </button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[1fr_1fr_auto]">
            <input
              value={newAgentName}
              onChange={(event) => setNewAgentName(event.target.value)}
              placeholder="External agent name"
              className="rounded-2xl border border-white/10 bg-[#0b1424] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
            />
            <input
              value={newAgentPhone}
              onChange={(event) => setNewAgentPhone(event.target.value)}
              placeholder="+2547..."
              className="rounded-2xl border border-white/10 bg-[#0b1424] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-400/50"
            />
            <button
              type="button"
              onClick={() => void createExternalAgent()}
              disabled={agentSaving}
              className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
            >
              Save agent
            </button>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {externalAgents.map((agent) => (
              <div key={agent.id} className="rounded-[24px] border border-white/10 bg-white/[0.03] p-4">
                <div className="text-sm font-semibold text-white">{agent.name}</div>
                <div className="mt-1 text-xs text-slate-400">{agent.whatsappNumber}</div>
                <button
                  type="button"
                  onClick={() => void deleteExternalAgent(agent.id)}
                  disabled={agentSaving}
                  className="mt-4 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-100 hover:bg-red-500/20 disabled:opacity-50"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-[30px] border border-white/10 bg-[#07111f] p-5">
        <div className="grid gap-3 xl:grid-cols-[minmax(280px,1.5fr)_repeat(4,minmax(0,1fr))_auto]">
          <div className="rounded-2xl border border-white/10 bg-[#0b1424] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Search</div>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Customer, receipt, phone, handler"
              className="mt-2 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>
          <select
            value={stageFilter}
            onChange={(event) => setStageFilter(event.target.value as ProjectStageFilter)}
            className="rounded-2xl border border-white/10 bg-[#0b1424] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">All statuses</option>
            <option value="RECEIPT_CREATED">Pending / Scheduled</option>
            <option value="PROJECT_IN_PROGRESS">In Progress</option>
            <option value="COMPLETED_POSTED">Completed</option>
          </select>
          <select
            value={locationFilter}
            onChange={(event) => setLocationFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-[#0b1424] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">All counties</option>
            {locationOptions.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
          <select
            value={technicianFilter}
            onChange={(event) => setTechnicianFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-[#0b1424] px-4 py-3 text-sm text-white outline-none"
          >
            <option value="ALL">All technicians</option>
            {staff.map((member) => (
              <option key={member.id} value={member.id}>
                {member.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={installationDateFilter}
            onChange={(event) => setInstallationDateFilter(event.target.value)}
            className="rounded-2xl border border-white/10 bg-[#0b1424] px-4 py-3 text-sm text-white outline-none"
          />
          <button
            type="button"
            onClick={clearFilters}
            className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
          >
            Clear Filters
          </button>
        </div>
      </section>

      <section className="mt-6 overflow-hidden rounded-[32px] border border-white/10 bg-[#040b18]">
        <div className="overflow-x-auto">
          <table className="min-w-[1280px] w-full border-separate border-spacing-0">
            <thead>
              <tr className="bg-[#030916] text-left">
                <th className="px-4 py-5 text-[11px] uppercase tracking-[0.3em] text-slate-500">
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && filteredRows.every((row) => selectedRowIds.includes(row.id))}
                    onChange={toggleSelectAllVisible}
                    className="h-4 w-4 rounded border-white/20 bg-transparent"
                  />
                </th>
                <th className="px-4 py-5 text-[11px] uppercase tracking-[0.3em] text-slate-500">Open</th>
                <th className="px-4 py-5 text-[11px] uppercase tracking-[0.3em] text-slate-500">Project</th>
                <th className="px-4 py-5 text-[11px] uppercase tracking-[0.3em] text-slate-500">Customer</th>
                <th className="px-4 py-5 text-[11px] uppercase tracking-[0.3em] text-slate-500">Amount</th>
                <th className="px-4 py-5 text-[11px] uppercase tracking-[0.3em] text-slate-500">County / Location</th>
                <th className="px-4 py-5 text-[11px] uppercase tracking-[0.3em] text-slate-500">Assigned Technicians</th>
                <th className="px-4 py-5 text-[11px] uppercase tracking-[0.3em] text-slate-500">Installation Date</th>
                <th className="px-4 py-5 text-[11px] uppercase tracking-[0.3em] text-slate-500">Status</th>
                <th className="px-4 py-5 text-[11px] uppercase tracking-[0.3em] text-slate-500">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-sm text-slate-400">
                    Loading project receipts...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-sm text-slate-400">
                    No project receipts found for the current filters.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const editor = editors[row.id] ?? makeEditor(row);
                  const isExpanded = expandedRowIds.includes(row.id);
                  const isSaving = savingId === row.id;
                  const assignedHandlers = getAssignedHandlers(row);
                  const displayStatus = getDisplayStatus(row);
                  const percentagePaid = Math.max(
                    0,
                    Math.min(100, Math.round((Number(row.projectTotalPaidAmount ?? 0) / Math.max(Number(row.total ?? 0), 1)) * 100)),
                  );
                  const assignedStaff = assignedHandlers.filter((entry) => entry.kind === "STAFF");
                  const assignedExternal = assignedHandlers.filter((entry) => entry.kind === "EXTERNAL");
                  const quickTechLabels = assignedStaff.length > 0 ? assignedStaff : assignedHandlers;
                  return (
                    <Fragment key={row.id}>
                      <tr
                        className={`border-t border-white/5 align-top transition ${isExpanded ? "bg-[#0a1220]" : "bg-[#07101d] hover:bg-[#0b1424]"}`}
                      >
                        <td className="px-4 py-5">
                          <input
                            type="checkbox"
                            checked={selectedRowIds.includes(row.id)}
                            onChange={() => toggleSelected(row.id)}
                            className="h-4 w-4 rounded border-white/20 bg-transparent"
                          />
                        </td>
                        <td className="px-4 py-5">
                          <button
                            type="button"
                            onClick={() => toggleExpanded(row.id)}
                            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg text-slate-200 hover:bg-white/10"
                          >
                            {isExpanded ? "−" : "+"}
                          </button>
                        </td>
                        <td className="px-4 py-5">
                          <div className="text-base font-semibold text-white">{row.orderRef || "Project receipt"}</div>
                          <div className="mt-1 text-sm text-slate-400">{row.customerName || "Unnamed project"}</div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="text-sm font-medium text-white">{row.customerName || "No customer name"}</div>
                          <div className="mt-1 text-sm text-slate-400">{row.customerPhone || "No phone"}</div>
                        </td>
                        <td className="px-4 py-5">
                          <div className="text-lg font-semibold text-white">{formatCurrency(row.total)}</div>
                          <div className="mt-1 text-xs text-slate-500">{formatPaymentStatusLabel(row.projectPaymentStatus)}</div>
                        </td>
                        <td className="px-4 py-5 text-sm text-slate-300">{getLocationValue(row)}</td>
                        <td className="px-4 py-5">
                          <div className="flex flex-wrap items-center gap-2">
                            {quickTechLabels.length === 0 ? (
                              <span className="text-sm text-slate-500">Unassigned</span>
                            ) : (
                              <>
                                {quickTechLabels.slice(0, 2).map((handler, index) => (
                                  <div
                                    key={`${handler.kind}-${handler.staffId || handler.externalAgentId || index}`}
                                    title={renderAssignedLabel(handler)}
                                    className="flex h-10 w-10 items-center justify-center rounded-full border border-cyan-500/20 bg-cyan-500/10 text-xs font-semibold text-cyan-100"
                                  >
                                    {getInitials(handler.kind === "STAFF" ? handler.staffName : handler.externalAgentName)}
                                  </div>
                                ))}
                                {quickTechLabels.length > 2 ? (
                                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-300">
                                    +{quickTechLabels.length - 2}
                                  </div>
                                ) : null}
                              </>
                            )}
                          </div>
                          {assignedExternal.length > 0 ? (
                            <div className="mt-2 text-xs text-slate-500">
                              Agent: {assignedExternal.map((handler) => handler.externalAgentName || "External").join(", ")}
                            </div>
                          ) : null}
                        </td>
                        <td className="px-4 py-5">
                          <div className="text-sm text-white">{formatProjectDate(row.projectScheduledDate) || "Not scheduled"}</div>
                          <div className="mt-1 text-xs text-slate-500">Created {formatProjectDate(row.createdAt)}</div>
                        </td>
                        <td className="px-4 py-5">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${displayStatus.tone}`}>
                            {displayStatus.label}
                          </span>
                        </td>
                        <td className="px-4 py-5">
                          <div className="flex flex-wrap gap-2">
                            <Link
                              href={`/receipts/print/${encodeURIComponent(row.id)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/20"
                            >
                              Preview
                            </Link>
                            <button
                              type="button"
                              onClick={() => toggleExpanded(row.id)}
                              className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                            >
                              Details
                            </button>
                          </div>
                        </td>
                      </tr>
                      {isExpanded ? (
                        <tr className="bg-[#050d19]">
                          <td colSpan={10} className="border-t border-white/5 px-5 py-5">
                            <div className="grid gap-4 xl:grid-cols-[1.2fr_0.95fr_0.95fr]">
                              <div className="space-y-4">
                                <div className="rounded-[28px] border border-white/10 bg-[#0a1322] p-5">
                                  <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Project Summary</div>
                                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                                    {[
                                      ["Receipt number", row.orderRef || "Not available"],
                                      ["Project name", row.customerName || "Not available"],
                                      ["Customer name", row.customerName || "Not available"],
                                      ["Customer phone", row.customerPhone || "Not available"],
                                      ["County / location", getLocationValue(row)],
                                      ["Date created", formatProjectDateTime(row.createdAt)],
                                      ["Installation date", formatProjectDate(row.projectScheduledDate) || "Not scheduled"],
                                      ["Created by", row.attendantName || "Not available"],
                                    ].map(([label, value]) => (
                                      <div key={label} className="rounded-2xl border border-white/8 bg-[#08111d] px-4 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</div>
                                        <div className="mt-2 text-sm font-medium text-white">{value}</div>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                <div className="rounded-[28px] border border-white/10 bg-[#0a1322] p-5">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Quick Actions</div>
                                      <div className="mt-2 text-lg font-semibold text-white">Project workflow</div>
                                    </div>
                                    <div className="rounded-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-slate-400">
                                      {isSaving ? "Saving..." : "Ready"}
                                    </div>
                                  </div>
                                  <div className="mt-4 flex flex-wrap gap-3">
                                    <Link
                                      href={`/receipts/print/${encodeURIComponent(row.id)}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white hover:bg-white/10"
                                    >
                                      Preview Receipt
                                    </Link>
                                    <button
                                      type="button"
                                      onClick={() => setAssignmentModal({ type: "staff", rowId: row.id })}
                                      className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20"
                                    >
                                      Assign Technician
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setAssignmentModal({ type: "external", rowId: row.id })}
                                      className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
                                    >
                                      Assign Agent
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void saveProject(row.id)}
                                      disabled={isSaving}
                                      className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                                    >
                                      Save Project Setup
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void saveProject(row.id, { stage: "PROJECT_IN_PROGRESS" })}
                                      disabled={isSaving || row.projectStage === "PROJECT_IN_PROGRESS" || row.projectStage === "COMPLETED_POSTED"}
                                      className="rounded-2xl border border-sky-500/25 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-100 hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                      title={
                                        row.projectStage === "COMPLETED_POSTED"
                                          ? "Completed projects cannot move back to progress from here."
                                          : undefined
                                      }
                                    >
                                      Mark In Progress
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => void saveProject(row.id, { stage: "COMPLETED_POSTED" })}
                                      disabled={isSaving || row.projectStage === "COMPLETED_POSTED"}
                                      className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                      Complete and Post to POS
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="rounded-[28px] border border-white/10 bg-[#0a1322] p-5">
                                  <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Payment Overview</div>
                                  <div className="mt-4 grid gap-3">
                                    {[
                                      ["Total project value", formatCurrency(row.total)],
                                      ["Paid amount", formatCurrency(row.projectTotalPaidAmount)],
                                      ["Remaining balance", formatCurrency(row.projectRemainingAmount)],
                                      [
                                        "Deposit amount and status",
                                        `${formatCurrency(row.projectDepositPaidAmount)} / ${formatCurrency(row.projectDepositRequiredAmount)} · ${formatPaymentMethodLabel(row.projectDepositPaymentMethod)}`,
                                      ],
                                    ].map(([label, value]) => (
                                      <div key={label} className="rounded-2xl border border-white/8 bg-[#08111d] px-4 py-3">
                                        <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">{label}</div>
                                        <div className="mt-2 text-sm font-medium text-white">{value}</div>
                                      </div>
                                    ))}
                                  </div>
                                  <div className="mt-4">
                                    <div className="flex items-center justify-between text-xs text-slate-400">
                                      <span>Percentage paid</span>
                                      <span>{percentagePaid}%</span>
                                    </div>
                                    <div className="mt-2 h-3 overflow-hidden rounded-full bg-white/5">
                                      <div
                                        className="h-full rounded-full bg-[linear-gradient(90deg,#06b6d4,#22c55e)]"
                                        style={{ width: `${percentagePaid}%` }}
                                      />
                                    </div>
                                    <div className="mt-3 text-xs text-slate-500">{formatPaymentTermLabel(row.projectPaymentTerm)}</div>
                                  </div>
                                </div>

                                <div className="rounded-[28px] border border-white/10 bg-[#0a1322] p-5">
                                  <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Project Status</div>
                                  <div className="mt-4 flex items-center gap-3">
                                    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${displayStatus.tone}`}>
                                      {displayStatus.label}
                                    </span>
                                    <span className="text-xs text-slate-500">{formatPaymentStatusLabel(row.projectPaymentStatus)}</span>
                                  </div>
                                  <p className="mt-4 text-sm leading-6 text-slate-400">
                                    {editor.handlerStaffIds.length > 0
                                      ? row.projectStage === "PROJECT_IN_PROGRESS"
                                        ? `Pending assigned project commission: ${formatCurrency(PROJECT_COMPLETION_COMMISSION)}`
                                        : row.projectStage === "COMPLETED_POSTED"
                                          ? `Project commission earned: ${formatCurrency(PROJECT_COMPLETION_COMMISSION)}`
                                          : "Project commission unlocks after this project moves into progress."
                                      : "Assign technicians or agents to activate the project execution workflow."}
                                  </p>
                                </div>
                              </div>

                              <div className="space-y-4">
                                <div className="rounded-[28px] border border-white/10 bg-[#0a1322] p-5">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Internal Technicians</div>
                                      <div className="mt-2 text-lg font-semibold text-white">Assigned staff</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setAssignmentModal({ type: "staff", rowId: row.id })}
                                      className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/20"
                                    >
                                      Change Assignment
                                    </button>
                                  </div>
                                  <div className="mt-4 space-y-3">
                                    {assignedStaff.length === 0 ? (
                                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-slate-500">
                                        No internal technicians assigned.
                                      </div>
                                    ) : (
                                      assignedStaff.map((handler, index) => (
                                        <div
                                          key={`${handler.staffId || index}-staff`}
                                          className="rounded-2xl border border-white/8 bg-[#08111d] px-4 py-3"
                                        >
                                          <div className="text-sm font-semibold text-white">{handler.staffName || "Staff member"}</div>
                                          <div className="mt-1 text-xs text-slate-400">{handler.phone || "No phone saved"}</div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>

                                <div className="rounded-[28px] border border-white/10 bg-[#0a1322] p-5">
                                  <div className="flex items-center justify-between gap-3">
                                    <div>
                                      <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">External Agent</div>
                                      <div className="mt-2 text-lg font-semibold text-white">Assigned external support</div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setAssignmentModal({ type: "external", rowId: row.id })}
                                      className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/10"
                                    >
                                      Change Agent
                                    </button>
                                  </div>
                                  <div className="mt-4 space-y-3">
                                    {assignedExternal.length === 0 ? (
                                      <div className="rounded-2xl border border-dashed border-white/10 px-4 py-4 text-sm text-slate-500">
                                        No external agent assigned.
                                      </div>
                                    ) : (
                                      assignedExternal.map((handler, index) => (
                                        <div
                                          key={`${handler.externalAgentId || index}-external`}
                                          className="rounded-2xl border border-white/8 bg-[#08111d] px-4 py-3"
                                        >
                                          <div className="text-sm font-semibold text-white">{handler.externalAgentName || "External agent"}</div>
                                          <div className="mt-1 text-xs text-slate-400">{handler.phone || "No phone saved"}</div>
                                        </div>
                                      ))
                                    )}
                                  </div>
                                </div>

                                <div className="rounded-[28px] border border-white/10 bg-[#0a1322] p-5">
                                  <div className="text-[11px] uppercase tracking-[0.32em] text-slate-500">Project Setup</div>
                                  <div className="mt-4 space-y-3">
                                    <label className="block text-sm text-slate-300">
                                      Installation date
                                      <input
                                        type="date"
                                        value={editor.scheduledDate}
                                        onChange={(event) => setEditorValue(row.id, { scheduledDate: event.target.value })}
                                        onClick={(event) => event.currentTarget.showPicker?.()}
                                        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#08111d] px-4 py-3 text-white outline-none"
                                      />
                                    </label>
                                    <label className="block text-sm text-slate-300">
                                      Payment notes
                                      <textarea
                                        value={editor.paymentNotes}
                                        onChange={(event) => setEditorValue(row.id, { paymentNotes: event.target.value })}
                                        rows={4}
                                        className="mt-2 w-full rounded-2xl border border-white/10 bg-[#08111d] px-4 py-3 text-white outline-none"
                                        placeholder="Internal notes about deposit, balance, or scheduling."
                                      />
                                    </label>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {assignmentModal && modalRow && modalEditor ? (
        <ModalShell
          title={assignmentModal.type === "staff" ? "Change technician assignment" : "Change external agent"}
          description={`Update assignments for ${modalRow.orderRef || modalRow.customerName || "this project"}. Saving here writes the selected technicians or external agents directly to the project.`}
          onClose={() => {
            setAssignmentModal(null);
            setAssignmentSearch("");
          }}
          footer={
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-slate-500">
                {assignmentModal.type === "staff"
                  ? `${modalEditor.handlerStaffIds.length} technician${modalEditor.handlerStaffIds.length === 1 ? "" : "s"} selected`
                  : `${modalEditor.externalAgentIds.length} external agent${modalEditor.externalAgentIds.length === 1 ? "" : "s"} selected`}
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setAssignmentModal(null);
                    setAssignmentSearch("");
                  }}
                  className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-slate-200 hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => void saveAssignmentsFromModal()}
                  disabled={savingId === modalRow.id}
                  className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
                >
                  {savingId === modalRow.id ? "Saving..." : "Save Selection"}
                </button>
              </div>
            </div>
          }
        >
          <div className="rounded-2xl border border-white/10 bg-[#0b1424] px-4 py-2.5">
            <div className="text-[10px] uppercase tracking-[0.28em] text-slate-500">Search</div>
            <input
              value={assignmentSearch}
              onChange={(event) => setAssignmentSearch(event.target.value)}
              placeholder={assignmentModal.type === "staff" ? "Search technician" : "Search external agent"}
              className="mt-1.5 w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
            />
          </div>
          <div className="mt-3 rounded-[20px] border border-white/10 bg-[#0a1322] px-4 py-3">
            <div className="text-[10px] uppercase tracking-[0.24em] text-slate-500">Current Selection</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {assignmentModal.type === "staff"
                ? modalEditor.handlerStaffIds.length > 0
                  ? modalEditor.handlerStaffIds.map((staffId) => {
                      const member = staff.find((entry) => entry.id === staffId);
                      return (
                        <span key={staffId} className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-100">
                          {member?.name || "Technician"}
                        </span>
                      );
                    })
                  : <span className="text-sm text-slate-500">No technicians selected.</span>
                : modalEditor.externalAgentIds.length > 0
                  ? modalEditor.externalAgentIds.map((agentId) => {
                      const agent = externalAgents.find((entry) => entry.id === agentId);
                      return (
                        <span key={agentId} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-slate-200">
                          {agent?.name || "External agent"}
                        </span>
                      );
                    })
                  : <span className="text-sm text-slate-500">No external agents selected.</span>}
            </div>
          </div>
          <div className="mt-3 grid max-h-[40vh] gap-2 overflow-y-auto pr-1 md:grid-cols-2">
            {assignmentModal.type === "staff"
              ? assignmentOptions.map((option) => {
                  const member = option as StaffOption;
                  return (
                    <label key={member.id} className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-[#08111d] px-4 py-3 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={modalEditor.handlerStaffIds.includes(member.id)}
                        onChange={() =>
                          setEditorValue(modalRow.id, {
                            handlerStaffIds: toggleValue(modalEditor.handlerStaffIds, member.id),
                          })
                        }
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        <span className="block font-semibold">{member.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {member.whatsappNumber || member.technicalPhoneNumber || member.phone || "No phone saved"}
                        </span>
                      </span>
                    </label>
                  );
                })
              : assignmentOptions.map((option) => {
                  const agent = option as ExternalAgentOption;
                  return (
                    <label key={agent.id} className="flex items-start gap-3 rounded-[20px] border border-white/10 bg-[#08111d] px-4 py-3 text-sm text-white">
                      <input
                        type="checkbox"
                        checked={modalEditor.externalAgentIds.includes(agent.id)}
                        onChange={() =>
                          setEditorValue(modalRow.id, {
                            externalAgentIds: toggleValue(modalEditor.externalAgentIds, agent.id),
                          })
                        }
                        className="mt-1 h-4 w-4"
                      />
                      <span>
                        <span className="block font-semibold">{agent.name}</span>
                        <span className="mt-0.5 block text-xs text-slate-400">{agent.whatsappNumber}</span>
                      </span>
                    </label>
                  );
                })}
          </div>
        </ModalShell>
      ) : null}
    </div>
  );
}
