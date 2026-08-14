"use client";

import Link from "next/link";
import {
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Minus,
  Plus,
  RefreshCcw,
  Search,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { Fragment, useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

type LppListItem = {
  id: string;
  reference: string;
  customerId: string;
  customerName: string | null;
  customerPhone: string | null;
  productId: string | null;
  productName: string | null;
  assignedToId: string | null;
  assignedToName: string | null;
  agreedTotal: number;
  totalPaid: number;
  balance: number;
  percentagePaid: number;
  status: string;
  expectedCompletionDate: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  convertedAt: string | null;
  convertedReceiptId: string | null;
  convertedProjectId: string | null;
  fulfilledAt: string | null;
  fulfilledById: string | null;
  fulfilledByName: string | null;
  fulfillmentMethod: string | null;
};

type LppDetail = {
  account: LppListItem;
  payments: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    status: string;
    receivedById: string | null;
    receivedAt: string;
    notes: string | null;
    reversedAt: string | null;
    reversalReason: string | null;
    createdAt: string;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    actorId: string | null;
    metadata: unknown;
    createdAt: string;
  }>;
  reminders: Array<{
    id: string;
    reminderType: string;
    scheduledFor: string;
    sentAt: string | null;
    channel: string;
    status: string;
    providerMessageId: string | null;
    idempotencyKey: string;
    payloadSnapshot: unknown;
    createdAt: string;
  }>;
  followUps: Array<{
    id: string;
    assignedToId: string | null;
    assignedToName: string | null;
    outcome: string | null;
    taskType: string;
    taskDate: string | null;
    notes: string | null;
    createdById: string | null;
    createdByName: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  promises: Array<{
    id: string;
    promiseAmount: number;
    promiseDate: string;
    status: string;
    notes: string | null;
    createdById: string | null;
    createdByName: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  summary: {
    agreedTotal: number;
    totalPaid: number;
    balance: number;
    percentagePaid: number;
    isFullyPaid: boolean;
  };
};

type SearchOption = {
  id: string;
  label: string;
  hint?: string | null;
  amount?: number | null;
};

type SearchSelectorProps = {
  label: string;
  placeholder: string;
  value: SearchOption | null;
  onChange: (option: SearchOption | null) => void;
  search: (query: string) => Promise<SearchOption[]>;
};

type DetailsTab = "OVERVIEW" | "PAYMENTS" | "FOLLOW_UPS" | "TIMELINE";
type ActionModal = "PAYMENT" | "ASSIGN" | "FOLLOW_UP" | "PROMISE" | "RELEASE" | null;
type QuickFilter = "ALL" | "ACTIVE" | "DUE_TODAY" | "DUE_WEEK" | "OVERDUE" | "FULLY_PAID" | "CANCELLED";
type InstallmentFrequency = "WEEKLY" | "MONTHLY";

const STATUSES = [
  "ALL",
  "ACTIVE",
  "DUE_SOON",
  "OVERDUE",
  "AWAITING_CONVERSION",
  "CONVERTED_TO_POS",
  "CONVERTED_TO_PROJECT",
  "CANCELLED",
  "CLOSED",
] as const;

const TAB_ITEMS: Array<{ id: DetailsTab; label: string }> = [
  { id: "OVERVIEW", label: "Overview" },
  { id: "PAYMENTS", label: "Payments" },
  { id: "FOLLOW_UPS", label: "Follow-ups" },
  { id: "TIMELINE", label: "Timeline" },
];

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-blue-400/50";
const textareaClass = `${inputClass} min-h-[112px] resize-y`;
const primaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-blue-400/30 bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:border-blue-300 hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50";

function formatKes(value: number) {
  return `KES ${Math.round(Number(value || 0)).toLocaleString("en-KE")}`;
}

function formatCompactKes(value: number) {
  const amount = Number(value || 0);
  if (amount >= 1_000_000) return `KES ${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `KES ${(amount / 1_000).toFixed(0)}K`;
  return formatKes(amount);
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleDateString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not set";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not set";
  return date.toLocaleString("en-KE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function toDateInputValue(value: Date) {
  const year = value.getFullYear();
  const month = `${value.getMonth() + 1}`.padStart(2, "0");
  const day = `${value.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addInstallmentPeriods(count: number, frequency: InstallmentFrequency) {
  const next = new Date();
  if (frequency === "WEEKLY") {
    next.setDate(next.getDate() + count * 7);
    return next;
  }
  next.setMonth(next.getMonth() + count);
  return next;
}

function titleCase(value: string) {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (char) => char.toUpperCase());
}

function progressTone(value: number) {
  if (value >= 100) return "bg-emerald-500";
  if (value >= 70) return "bg-blue-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function statusTone(status: string) {
  if (["AWAITING_CONVERSION", "CONVERTED_TO_POS", "CONVERTED_TO_PROJECT", "CLOSED"].includes(status)) {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-200";
  }
  if (["OVERDUE", "CANCELLED"].includes(status)) {
    return "border-rose-500/25 bg-rose-500/10 text-rose-200";
  }
  if (["DUE_SOON"].includes(status)) {
    return "border-blue-500/25 bg-blue-500/10 text-blue-200";
  }
  return "border-amber-500/25 bg-amber-500/10 text-amber-200";
}

function getDueDate(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysDiffFromToday(value: string | null | undefined) {
  const due = getDueDate(value);
  if (!due) return null;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86400000);
}

function describeDueDate(value: string | null | undefined) {
  const diff = daysDiffFromToday(value);
  if (diff === null) return { label: "Not set", tone: "text-slate-500" };
  if (diff < 0) return { label: "Overdue", tone: "text-rose-400" };
  if (diff === 0) return { label: "Today", tone: "text-amber-300" };
  if (diff === 1) return { label: "Tomorrow", tone: "text-blue-300" };
  return { label: `${diff} days`, tone: "text-slate-400" };
}

function isDueThisWeek(value: string | null | undefined) {
  const diff = daysDiffFromToday(value);
  return diff !== null && diff >= 0 && diff <= 7;
}

function isDueToday(value: string | null | undefined) {
  return daysDiffFromToday(value) === 0;
}

function isOverdue(value: string | null | undefined) {
  const diff = daysDiffFromToday(value);
  return diff !== null && diff < 0;
}

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
  const res = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers || {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

function toSearchOption(
  item: { id: string; name?: string | null; email?: string | null; phone?: string | null; sku?: string | null; sellingPrice?: number | null },
  fallback: string,
): SearchOption {
  return {
    id: item.id,
    label: item.name || item.email || fallback,
    hint: item.phone || item.email || item.sku || null,
    amount: typeof item.sellingPrice === "number" ? item.sellingPrice : null,
  };
}

export default function LipaPolePoleAdminClient({
  initialItems,
  initialDetail,
  initialQ,
  initialStatus,
}: {
  initialItems: LppListItem[];
  initialDetail: LppDetail | null;
  initialQ: string;
  initialStatus: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [detail, setDetail] = useState<LppDetail | null>(initialDetail);
  const [selectedId, setSelectedId] = useState(initialDetail?.account.id ?? initialItems[0]?.id ?? "");
  const [expandedLppId, setExpandedLppId] = useState(initialDetail?.account.id ?? "");
  const [activeTab, setActiveTab] = useState<DetailsTab>("OVERVIEW");
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [loadingDetailId, setLoadingDetailId] = useState("");
  const [, startTransition] = useTransition();
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isConvertingPos, setIsConvertingPos] = useState(false);
  const [isConvertingProject, setIsConvertingProject] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);
  const [isSubmittingPromise, setIsSubmittingPromise] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCreateMoreDetails, setShowCreateMoreDetails] = useState(false);
  const [actionModal, setActionModal] = useState<ActionModal>(null);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [dueFilter, setDueFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const hasHydratedRef = useRef(false);

  const [product, setProduct] = useState<SearchOption | null>(null);
  const [salesperson, setSalesperson] = useState<SearchOption | null>(null);
  const [assignedAgent, setAssignedAgent] = useState<SearchOption | null>(null);
  const [assignAgent, setAssignAgent] = useState<SearchOption | null>(null);

  const [createForm, setCreateForm] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    county: "",
    town: "",
    estateLandmark: "",
    locationNotes: "",
    quantity: "1",
    agreedUnitPrice: "",
    agreedTotal: "",
    installmentFrequency: "MONTHLY" as InstallmentFrequency,
    installmentCount: "3",
    expectedCompletionDateOverride: "",
    paymentMode: "SCHEDULED",
    reservationMode: "SOFT_RESERVE",
    source: "",
    notes: "",
    initialPaymentAmount: "",
    initialPaymentMethod: "MPESA",
    initialPaymentReference: "",
    initialPaymentNotes: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    amount: "",
    method: "MPESA",
    reference: "",
    notes: "",
  });
  const [releaseForm, setReleaseForm] = useState({
    fulfillmentMethod: "Customer Collection",
    collectorName: "",
    collectorReference: "",
    notes: "",
  });
  const [followUpForm, setFollowUpForm] = useState({
    taskType: "FOLLOW_UP_TODAY",
    taskDate: "",
    outcome: "",
    notes: "",
  });
  const [promiseForm, setPromiseForm] = useState({
    promiseAmount: "",
    promiseDate: "",
    notes: "",
  });

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setDetail(initialDetail);
    const nextId = initialDetail?.account.id ?? initialItems[0]?.id ?? "";
    setSelectedId(nextId);
    setExpandedLppId(initialDetail?.account.id ?? "");
  }, [initialDetail, initialItems]);

  useEffect(() => {
    setPage(1);
  }, [q, status, quickFilter, agentFilter, productFilter, dueFilter]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const trimmedQ = q.trim();
    if (trimmedQ) params.set("q", trimmedQ);
    else params.delete("q");
    if (status !== "ALL") params.set("status", status);
    else params.delete("status");
    if (expandedLppId) params.set("id", expandedLppId);
    else params.delete("id");
    const next = params.toString();
    const href = next ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history.replaceState({}, "", href);
  }, [expandedLppId, q, status]);

  // The backend query is intentionally driven by debounced `q` and `status`.
  useEffect(() => {
    if (!hasHydratedRef.current) {
      hasHydratedRef.current = true;
      return;
    }
    const timer = window.setTimeout(() => {
      setBanner(null);
      startTransition(() => {
        void refreshList().catch(showError);
      });
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, status]);

  function showError(error: unknown) {
    setBanner({
      tone: "error",
      text: error instanceof Error ? error.message : "Request failed",
    });
  }

  async function refreshList(nextSelectedId?: string) {
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (status !== "ALL") params.set("status", status);
    params.set("limit", "100");
    const data = await readJson<{ items: LppListItem[] }>(`/api/lipa-pole-pole?${params.toString()}`);
    const nextItems = data.items || [];
    setItems(nextItems);
    const fallbackId = nextSelectedId || selectedId || nextItems[0]?.id || "";
    const targetId = nextItems.some((item) => item.id === fallbackId) ? fallbackId : nextItems[0]?.id || "";
    if (targetId) {
      await loadDetail(targetId);
      setExpandedLppId(targetId);
    } else {
      setDetail(null);
      setSelectedId("");
      setExpandedLppId("");
    }
  }

  async function loadDetail(id: string) {
    setLoadingDetailId(id);
    try {
      const data = await readJson<{ ok: true } & LppDetail>(`/api/lipa-pole-pole/${id}`);
      setDetail({
        account: data.account,
        payments: data.payments,
        events: data.events,
        reminders: data.reminders,
        followUps: data.followUps,
        promises: data.promises,
        summary: data.summary,
      });
      setSelectedId(id);
    } finally {
      setLoadingDetailId("");
    }
  }

  async function searchUsers(query: string) {
    const data = await readJson<Array<{ id: string; name?: string | null; email?: string | null }>>(
      `/api/users/search?q=${encodeURIComponent(query)}`,
      { headers: {} },
    );
    return data.map((item) => toSearchOption(item, "User"));
  }

  async function searchProducts(query: string) {
    const data = await readJson<{ items: Array<{ id: string; name?: string | null; sku?: string | null; sellingPrice?: number | null }> }>(
      `/api/attendant/pos-products?q=${encodeURIComponent(query)}&limit=20`,
      { headers: {} },
    );
    return (data.items || []).map((item) => toSearchOption(item, "Product"));
  }

  function handleProductChange(option: SearchOption | null) {
    setProduct(option);
    if (!option) return;
    if (typeof option.amount === "number" && option.amount > 0) {
      setCreateForm((current) => ({
        ...current,
        agreedUnitPrice: String(Number(option.amount)),
      }));
    }
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!createForm.customerName.trim()) {
      setBanner({ tone: "error", text: "Customer name is required." });
      return;
    }
    if (!createForm.customerPhone.trim()) {
      setBanner({ tone: "error", text: "Customer phone is required." });
      return;
    }
    if (!product?.id) {
      setBanner({ tone: "error", text: "Select a product." });
      return;
    }
    if (!createForm.agreedUnitPrice.trim()) {
      setBanner({ tone: "error", text: "Agreed unit price is required." });
      return;
    }
    if (createQuantity < 1) {
      setBanner({ tone: "error", text: "Quantity must be at least 1." });
      return;
    }
    if (createUnitPrice <= 0) {
      setBanner({ tone: "error", text: "Agreed unit price must be greater than zero." });
      return;
    }
    if (createInstallmentCount < 1) {
      setBanner({ tone: "error", text: "Installments must be at least 1." });
      return;
    }
    if (createDeposit < 0) {
      setBanner({ tone: "error", text: "Deposit cannot be negative." });
      return;
    }
    if (createDeposit > createAgreedTotal) {
      setBanner({ tone: "error", text: `Deposit cannot exceed ${formatKes(createAgreedTotal)}.` });
      return;
    }

    setIsSubmittingCreate(true);
    setBanner(null);
    try {
      const derivedCompletionDate = createForm.expectedCompletionDateOverride || toDateInputValue(createExpectedCompletionDate);
      const payload = {
        customer: {
          name: createForm.customerName.trim(),
          phone: createForm.customerPhone.trim(),
          email: createForm.customerEmail.trim() || null,
          county: createForm.county.trim() || null,
          town: createForm.town.trim() || null,
          estateLandmark: createForm.estateLandmark.trim() || null,
          locationNotes: createForm.locationNotes.trim() || null,
        },
        productId: product?.id ?? null,
        quantity: createQuantity,
        agreedUnitPrice: createForm.agreedUnitPrice,
        agreedTotal: createForm.agreedTotal.trim() ? createForm.agreedTotal : null,
        expectedCompletionDate: derivedCompletionDate,
        paymentMode: createForm.paymentMode,
        reservationMode: createForm.reservationMode,
        salespersonId: salesperson?.id ?? null,
        source: createForm.source.trim() || null,
        notes: createForm.notes.trim() || null,
        installmentPlan: createBalance > 0
          ? {
              frequency: createForm.installmentFrequency,
              count: createInstallmentCount,
            }
          : null,
        assignment: assignedAgent
          ? {
              assignedToId: assignedAgent.id,
              method: "MANUAL",
            }
          : null,
        initialPayment: createDeposit > 0
          ? {
              amount: createDeposit,
              method: createForm.initialPaymentMethod,
              reference:
                createForm.initialPaymentMethod === "CASH"
                  ? null
                  : createForm.initialPaymentReference.trim() || null,
              notes: createForm.initialPaymentNotes.trim() || null,
            }
          : null,
      };
      const data = await readJson<{ ok: true; account: { id: string } }>("/api/lipa-pole-pole", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      await refreshList(data.account.id);
      setBanner({ tone: "success", text: "Lipa Pole Pole account created." });
      setShowCreateModal(false);
      setShowCreateMoreDetails(false);
      setProduct(null);
      setSalesperson(null);
      setAssignedAgent(null);
      setCreateForm({
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        county: "",
        town: "",
        estateLandmark: "",
        locationNotes: "",
        quantity: "1",
        agreedUnitPrice: "",
        agreedTotal: "",
        installmentFrequency: "MONTHLY",
        installmentCount: "3",
        expectedCompletionDateOverride: "",
        paymentMode: "SCHEDULED",
        reservationMode: "SOFT_RESERVE",
        source: "",
        notes: "",
        initialPaymentAmount: "",
        initialPaymentMethod: "MPESA",
        initialPaymentReference: "",
        initialPaymentNotes: "",
      });
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmittingCreate(false);
    }
  }

  async function handleAssign(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    setIsSubmittingAssign(true);
    setBanner(null);
    try {
      await readJson(`/api/lipa-pole-pole/${selectedId}/assign`, {
        method: "POST",
        body: JSON.stringify({
          assignedToId: assignAgent?.id ?? null,
          method: assignAgent ? "MANUAL" : "ROUND_ROBIN",
        }),
      });
      await refreshList(selectedId);
      setBanner({ tone: "success", text: assignAgent ? "Account reassigned." : "Account assigned using round robin." });
      setActionModal(null);
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmittingAssign(false);
    }
  }

  async function handlePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    if (!paymentForm.amount.trim()) {
      setBanner({ tone: "error", text: "Payment amount is required." });
      return;
    }

    setIsSubmittingPayment(true);
    setBanner(null);
    try {
      await readJson(`/api/lipa-pole-pole/${selectedId}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount: paymentForm.amount,
          method: paymentForm.method,
          reference: paymentForm.reference.trim() || null,
          notes: paymentForm.notes.trim() || null,
        }),
      });
      await refreshList(selectedId);
      setBanner({ tone: "success", text: "Payment recorded." });
      setPaymentForm({
        amount: "",
        method: "MPESA",
        reference: "",
        notes: "",
      });
      setActionModal(null);
      setActiveTab("PAYMENTS");
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmittingPayment(false);
    }
  }

  async function handleReversePayment(paymentId: string) {
    if (!selectedId) return;
    const reason = window.prompt("Enter reversal reason");
    if (!reason || !reason.trim()) return;
    setBanner(null);
    try {
      await readJson(`/api/lipa-pole-pole/${selectedId}/payments/${paymentId}/reverse`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      await refreshList(selectedId);
      setBanner({ tone: "success", text: "Payment reversed." });
    } catch (error) {
      showError(error);
    }
  }

  async function handleConvertToPos() {
    if (!selectedId) return;
    setIsConvertingPos(true);
    setBanner(null);
    try {
      await readJson(`/api/lipa-pole-pole/${selectedId}/convert/pos`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshList(selectedId);
      setBanner({ tone: "success", text: "LPP converted through POS." });
    } catch (error) {
      showError(error);
    } finally {
      setIsConvertingPos(false);
    }
  }

  async function handleConvertToProject() {
    if (!selectedId) return;
    setIsConvertingProject(true);
    setBanner(null);
    try {
      await readJson(`/api/lipa-pole-pole/${selectedId}/convert/project`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      await refreshList(selectedId);
      setBanner({ tone: "success", text: "LPP converted into project workflow." });
    } catch (error) {
      showError(error);
    } finally {
      setIsConvertingProject(false);
    }
  }

  async function handleRelease(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    if (!releaseForm.fulfillmentMethod.trim()) {
      setBanner({ tone: "error", text: "Fulfillment method is required." });
      return;
    }

    setIsReleasing(true);
    setBanner(null);
    try {
      await readJson(`/api/lipa-pole-pole/${selectedId}/release`, {
        method: "POST",
        body: JSON.stringify({
          fulfillmentMethod: releaseForm.fulfillmentMethod,
          collectorName: releaseForm.collectorName.trim() || null,
          collectorReference: releaseForm.collectorReference.trim() || null,
          notes: releaseForm.notes.trim() || null,
        }),
      });
      await refreshList(selectedId);
      setBanner({ tone: "success", text: "Product release recorded." });
      setActionModal(null);
    } catch (error) {
      showError(error);
    } finally {
      setIsReleasing(false);
    }
  }

  async function handleCreateFollowUp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    if (!followUpForm.taskType.trim()) {
      setBanner({ tone: "error", text: "Follow-up task type is required." });
      return;
    }

    setIsSubmittingFollowUp(true);
    setBanner(null);
    try {
      await readJson(`/api/lipa-pole-pole/${selectedId}/follow-ups`, {
        method: "POST",
        body: JSON.stringify({
          taskType: followUpForm.taskType,
          taskDate: followUpForm.taskDate || null,
          outcome: followUpForm.outcome.trim() || null,
          notes: followUpForm.notes.trim() || null,
        }),
      });
      await refreshList(selectedId);
      setBanner({ tone: "success", text: "Follow-up task recorded." });
      setFollowUpForm({
        taskType: "FOLLOW_UP_TODAY",
        taskDate: "",
        outcome: "",
        notes: "",
      });
      setActionModal(null);
      setActiveTab("FOLLOW_UPS");
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmittingFollowUp(false);
    }
  }

  async function handleCreatePromise(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return;
    if (!promiseForm.promiseAmount.trim() || !promiseForm.promiseDate.trim()) {
      setBanner({ tone: "error", text: "Promise amount and promise date are required." });
      return;
    }

    setIsSubmittingPromise(true);
    setBanner(null);
    try {
      await readJson(`/api/lipa-pole-pole/${selectedId}/promise`, {
        method: "POST",
        body: JSON.stringify({
          promiseAmount: promiseForm.promiseAmount,
          promiseDate: promiseForm.promiseDate,
          notes: promiseForm.notes.trim() || null,
        }),
      });
      await refreshList(selectedId);
      setBanner({ tone: "success", text: "Promise to pay recorded." });
      setPromiseForm({
        promiseAmount: "",
        promiseDate: "",
        notes: "",
      });
      setActionModal(null);
      setActiveTab("FOLLOW_UPS");
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmittingPromise(false);
    }
  }

  async function toggleExpandedRow(id: string) {
    if (expandedLppId === id) {
      setExpandedLppId("");
      setSelectedId("");
      return;
    }

    setBanner(null);
    setActiveTab("OVERVIEW");
    setExpandedLppId(id);
    await loadDetail(id).catch(showError);
  }

  const agentOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(items.map((item) => item.assignedToName).filter(Boolean) as string[])).sort()],
    [items],
  );
  const productOptions = useMemo(
    () => ["ALL", ...Array.from(new Set(items.map((item) => item.productName).filter(Boolean) as string[])).sort()],
    [items],
  );

  const activeCount = useMemo(
    () => items.filter((item) => ["ACTIVE", "DUE_SOON", "OVERDUE"].includes(item.status) && Number(item.balance) > 0).length,
    [items],
  );
  const outstandingBalance = useMemo(() => items.reduce((sum, item) => sum + Number(item.balance ?? 0), 0), [items]);
  const dueThisWeekCount = useMemo(() => items.filter((item) => Number(item.balance) > 0 && isDueThisWeek(item.expectedCompletionDate)).length, [items]);
  const overdueCount = useMemo(
    () => items.filter((item) => item.status === "OVERDUE" || (Number(item.balance) > 0 && isOverdue(item.expectedCompletionDate))).length,
    [items],
  );
  const completedThisMonthCount = useMemo(() => {
    const now = new Date();
    return items.filter((item) => {
      const value = item.completedAt || item.fulfilledAt;
      if (!value) return false;
      const date = new Date(value);
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    }).length;
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (agentFilter !== "ALL" && (item.assignedToName || "Unassigned") !== agentFilter) return false;
      if (productFilter !== "ALL" && (item.productName || "No product") !== productFilter) return false;

      if (dueFilter === "TODAY" && !isDueToday(item.expectedCompletionDate)) return false;
      if (dueFilter === "THIS_WEEK" && !isDueThisWeek(item.expectedCompletionDate)) return false;
      if (dueFilter === "OVERDUE" && !isOverdue(item.expectedCompletionDate)) return false;
      if (dueFilter === "NO_DATE" && item.expectedCompletionDate) return false;

      if (quickFilter === "ACTIVE" && !["ACTIVE", "DUE_SOON", "OVERDUE"].includes(item.status)) return false;
      if (quickFilter === "DUE_TODAY" && !(Number(item.balance) > 0 && isDueToday(item.expectedCompletionDate))) return false;
      if (quickFilter === "DUE_WEEK" && !(Number(item.balance) > 0 && isDueThisWeek(item.expectedCompletionDate))) return false;
      if (quickFilter === "OVERDUE" && !(item.status === "OVERDUE" || (Number(item.balance) > 0 && isOverdue(item.expectedCompletionDate)))) return false;
      if (quickFilter === "FULLY_PAID" && Number(item.balance) !== 0) return false;
      if (quickFilter === "CANCELLED" && item.status !== "CANCELLED") return false;

      return true;
    });
  }, [agentFilter, dueFilter, items, productFilter, quickFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedItems = filteredItems.slice((safePage - 1) * pageSize, safePage * pageSize);
  const activeDetail = expandedLppId && detail?.account.id === expandedLppId ? detail : null;
  const createQuantity = Math.max(1, Number(createForm.quantity || "1"));
  const createUnitPrice = Math.max(0, Number(createForm.agreedUnitPrice || 0));
  const createBaseTotal = createQuantity * createUnitPrice;
  const createAgreedTotal = Math.max(0, Number(createForm.agreedTotal || createBaseTotal || 0));
  const createDeposit = Math.max(0, Number(createForm.initialPaymentAmount || 0));
  const createBalance = Math.max(0, createAgreedTotal - createDeposit);
  const createInstallmentCount = Math.max(1, Number(createForm.installmentCount || "1"));
  const createInstallmentAmount = createInstallmentCount > 0 ? createBalance / createInstallmentCount : createBalance;
  const createExpectedCompletionDate = addInstallmentPeriods(createInstallmentCount, createForm.installmentFrequency);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.7),transparent_36%),linear-gradient(180deg,#08111f_0%,#050b16_100%)] px-4 py-5 text-slate-100 lg:px-6 xl:px-8">
      <div className="mx-auto max-w-[1750px]">
        {banner ? <Banner tone={banner.tone} text={banner.text} /> : null}

        <section className="space-y-4">
          <div className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.9),rgba(7,14,26,0.94))] p-5 shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Lipa Pole Pole</h1>
                <p className="mt-1 text-sm text-slate-400">Manage lay-by accounts, collections and completion</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="flex min-w-[280px] items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/55 px-4 py-3">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    placeholder="Search accounts, customers, LPP #, phone..."
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                  <span className="hidden rounded-lg border border-white/10 px-2 py-1 text-[10px] font-semibold text-slate-500 md:inline-flex">
                    Ctrl + K
                  </span>
                </div>
                <button type="button" className={primaryButtonClass} onClick={() => setShowCreateModal(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  New Lipa Pole Pole
                </button>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <KpiCard
              icon={<Wallet className="h-4 w-4" />}
              iconTone="bg-blue-500/15 text-blue-300"
              label="Active Accounts"
              value={String(activeCount)}
              sub="Current active collections"
              change="Live"
              onClick={() => setQuickFilter("ACTIVE")}
              active={quickFilter === "ACTIVE"}
            />
            <KpiCard
              icon={<TrendingUp className="h-4 w-4" />}
              iconTone="bg-emerald-500/15 text-emerald-300"
              label="Outstanding Balance"
              value={formatCompactKes(outstandingBalance)}
              sub="Across current results"
              change="Receivable"
              onClick={() => setQuickFilter("ALL")}
              active={quickFilter === "ALL"}
            />
            <KpiCard
              icon={<Calendar className="h-4 w-4" />}
              iconTone="bg-amber-500/15 text-amber-300"
              label="Due This Week"
              value={String(dueThisWeekCount)}
              sub="Upcoming completions"
              change="7 days"
              onClick={() => setQuickFilter("DUE_WEEK")}
              active={quickFilter === "DUE_WEEK"}
            />
            <KpiCard
              icon={<Clock3 className="h-4 w-4" />}
              iconTone="bg-rose-500/15 text-rose-300"
              label="Overdue Accounts"
              value={String(overdueCount)}
              sub="Need follow-up now"
              change="Priority"
              onClick={() => setQuickFilter("OVERDUE")}
              active={quickFilter === "OVERDUE"}
            />
            <KpiCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              iconTone="bg-emerald-500/15 text-emerald-300"
              label="Completed This Month"
              value={String(completedThisMonthCount)}
              sub="Closed or fulfilled"
              change="This month"
              onClick={() => setQuickFilter("FULLY_PAID")}
              active={quickFilter === "FULLY_PAID"}
            />
          </div>

          <section className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.84),rgba(8,15,28,0.92))] shadow-[0_24px_60px_rgba(0,0,0,0.32)]">
            <div className="border-b border-white/10 p-4">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                <div className="flex flex-1 items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                  <Search className="h-4 w-4 text-slate-500" />
                  <input
                    value={q}
                    onChange={(event) => setQ(event.target.value)}
                    placeholder="Search by name, phone, LPP #, product, reference..."
                    className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
                  />
                </div>
                <FilterSelect value={status} onChange={setStatus}>
                  {STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item === "ALL" ? "All Statuses" : titleCase(item)}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect value={agentFilter} onChange={setAgentFilter}>
                  {agentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "ALL" ? "All Agents" : option}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect value={productFilter} onChange={setProductFilter}>
                  {productOptions.map((option) => (
                    <option key={option} value={option}>
                      {option === "ALL" ? "All Products" : option}
                    </option>
                  ))}
                </FilterSelect>
                <FilterSelect value={dueFilter} onChange={setDueFilter}>
                  <option value="ALL">Due Date</option>
                  <option value="TODAY">Due Today</option>
                  <option value="THIS_WEEK">Due This Week</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="NO_DATE">No Due Date</option>
                </FilterSelect>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  onClick={() => {
                    setQuickFilter("ALL");
                    setStatus("ALL");
                    setAgentFilter("ALL");
                    setProductFilter("ALL");
                    setDueFilter("ALL");
                  }}
                >
                  <RefreshCcw className="mr-2 h-4 w-4" />
                  Filters
                </button>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <QuickFilterChip label="All" count={items.length} active={quickFilter === "ALL"} onClick={() => setQuickFilter("ALL")} />
                <QuickFilterChip label="Active" count={activeCount} active={quickFilter === "ACTIVE"} onClick={() => setQuickFilter("ACTIVE")} />
                <QuickFilterChip
                  label="Due Today"
                  count={items.filter((item) => Number(item.balance) > 0 && isDueToday(item.expectedCompletionDate)).length}
                  active={quickFilter === "DUE_TODAY"}
                  onClick={() => setQuickFilter("DUE_TODAY")}
                />
                <QuickFilterChip label="Due This Week" count={dueThisWeekCount} active={quickFilter === "DUE_WEEK"} onClick={() => setQuickFilter("DUE_WEEK")} />
                <QuickFilterChip label="Overdue" count={overdueCount} active={quickFilter === "OVERDUE"} onClick={() => setQuickFilter("OVERDUE")} />
                <QuickFilterChip
                  label="Fully Paid"
                  count={items.filter((item) => Number(item.balance) === 0).length}
                  active={quickFilter === "FULLY_PAID"}
                  onClick={() => setQuickFilter("FULLY_PAID")}
                />
                <QuickFilterChip
                  label="Cancelled"
                  count={items.filter((item) => item.status === "CANCELLED").length}
                  active={quickFilter === "CANCELLED"}
                  onClick={() => setQuickFilter("CANCELLED")}
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead className="bg-slate-950/50 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                  <tr>
                    <th className="px-4 py-4">Select</th>
                    <th className="px-4 py-4">Open</th>
                    <th className="px-4 py-4">Customer</th>
                    <th className="px-4 py-4">LPP #</th>
                    <th className="px-4 py-4">Product</th>
                    <th className="px-4 py-4">Total</th>
                    <th className="px-4 py-4">Paid</th>
                    <th className="px-4 py-4">Balance</th>
                    <th className="px-4 py-4">Progress</th>
                    <th className="px-4 py-4">Due Date</th>
                    <th className="px-4 py-4">Agent</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedItems.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="px-4 py-16 text-center text-sm text-slate-500">
                        No Lipa Pole Pole accounts found for the current filters.
                      </td>
                    </tr>
                  ) : null}
                  {paginatedItems.map((item) => {
                    const isExpanded = expandedLppId === item.id;
                    const rowDetail = isExpanded ? activeDetail : null;
                    const due = describeDueDate(item.expectedCompletionDate);
                    const rowId = `lpp-details-${item.id}`;
                    return (
                      <Fragment key={item.id}>
                        <tr className={`border-t border-white/6 transition hover:bg-white/[0.03] ${isExpanded ? "bg-blue-500/[0.06]" : ""}`}>
                          <td className="border-t border-white/6 px-4 py-4 align-top">
                            <input
                              type="checkbox"
                              aria-label={`Select ${item.reference}`}
                              className="h-4 w-4 rounded border-white/20 bg-slate-950/70 text-blue-500"
                            />
                          </td>
                          <td className="border-t border-white/6 px-4 py-4 align-top">
                            <button
                              type="button"
                              aria-expanded={isExpanded}
                              aria-controls={rowId}
                              aria-label={`${isExpanded ? "Close" : "Open"} details for ${item.reference}`}
                              onClick={() => {
                                void toggleExpandedRow(item.id);
                              }}
                              className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-white/10 bg-slate-950/70 text-slate-100 transition hover:border-white/20 hover:text-white"
                            >
                              {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </button>
                          </td>
                          <td className="border-t border-white/6 px-4 py-4 align-top">
                            <div className="font-medium text-white">{item.customerName || "Unknown customer"}</div>
                            <div className="mt-1 text-xs text-slate-500">{item.customerPhone || "No phone"}</div>
                          </td>
                          <td className="border-t border-white/6 px-4 py-4 align-top text-slate-300">{item.reference}</td>
                          <td className="border-t border-white/6 px-4 py-4 align-top">
                            <div className="text-white">{item.productName || "No product"}</div>
                            <div className="mt-1 text-xs text-slate-500">Qty 1</div>
                          </td>
                          <td className="border-t border-white/6 px-4 py-4 align-top text-slate-200">{formatKes(item.agreedTotal)}</td>
                          <td className="border-t border-white/6 px-4 py-4 align-top text-emerald-300">{formatKes(item.totalPaid)}</td>
                          <td className="border-t border-white/6 px-4 py-4 align-top font-medium text-amber-300">{formatKes(item.balance)}</td>
                          <td className="border-t border-white/6 px-4 py-4 align-top">
                            <div className="w-[110px]">
                              <div className="mb-1 text-xs text-slate-400">{Math.round(item.percentagePaid)}%</div>
                              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                <div className={`h-full ${progressTone(item.percentagePaid)}`} style={{ width: `${Math.max(0, Math.min(100, item.percentagePaid))}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="border-t border-white/6 px-4 py-4 align-top">
                            <div className="text-white">{formatDate(item.expectedCompletionDate)}</div>
                            <div className={`mt-1 text-xs ${due.tone}`}>{due.label}</div>
                          </td>
                          <td className="border-t border-white/6 px-4 py-4 align-top text-slate-300">{item.assignedToName || "Unassigned"}</td>
                          <td className="border-t border-white/6 px-4 py-4 align-top">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
                              {titleCase(item.status)}
                            </span>
                          </td>
                          <td className="border-t border-white/6 px-4 py-4 align-top text-right">
                            <button
                              type="button"
                              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
                              onClick={() => {
                                setExpandedLppId(item.id);
                                setSelectedId(item.id);
                                setActionModal("PAYMENT");
                                setActiveTab("PAYMENTS");
                                if (detail?.account.id !== item.id) {
                                  startTransition(() => {
                                    void loadDetail(item.id).catch(showError);
                                  });
                                }
                              }}
                            >
                              Record
                            </button>
                          </td>
                        </tr>
                        {isExpanded ? (
                          <tr id={rowId}>
                            <td colSpan={13} className="border-t border-white/6 px-4 pb-5">
                              {!rowDetail || loadingDetailId === item.id ? (
                                <div className="rounded-[24px] border border-white/10 bg-slate-950/40 px-5 py-8 text-sm text-slate-400">
                                  Loading account details...
                                </div>
                              ) : (
                                <ExpandedRowDetails
                                  detail={rowDetail}
                                  activeTab={activeTab}
                                  onTabChange={setActiveTab}
                                  onOpenAction={setActionModal}
                                  onConvertToPos={() => void handleConvertToPos()}
                                  onConvertToProject={() => void handleConvertToProject()}
                                  onReversePayment={handleReversePayment}
                                  isConvertingPos={isConvertingPos}
                                  isConvertingProject={isConvertingProject}
                                />
                              )}
                            </td>
                          </tr>
                        ) : null}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-4 border-t border-white/10 px-4 py-4 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-slate-400">
                Showing {filteredItems.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to {Math.min(safePage * pageSize, filteredItems.length)} of {filteredItems.length} accounts
              </div>
              <div className="flex items-center gap-2">
                <div className="rounded-2xl border border-white/10 bg-slate-950/60 px-3 py-2 text-sm text-slate-300">Show {pageSize}</div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-950/50 text-slate-300 transition hover:border-white/20 hover:text-white disabled:opacity-40"
                  onClick={() => setPage((current) => Math.max(1, current - 1))}
                  disabled={safePage <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="rounded-xl border border-blue-400/30 bg-blue-500/15 px-4 py-2 text-sm font-semibold text-blue-100">{safePage}</div>
                <div className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-2 text-sm text-slate-300">{totalPages}</div>
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-slate-950/50 text-slate-300 transition hover:border-white/20 hover:text-white disabled:opacity-40"
                  onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                  disabled={safePage >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </section>
        </section>
      </div>

      {showCreateModal ? (
        <ModalShell title="Create New Lipa Pole Pole" subtitle="Capture customer details, product, deposit, and installment plan in one simple flow." onClose={() => setShowCreateModal(false)}>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
              <div className="space-y-4">
                <section className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
                  <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Customer details</div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <Field label="Customer name">
                      <input className={inputClass} value={createForm.customerName} onChange={(event) => setCreateForm((current) => ({ ...current, customerName: event.target.value }))} placeholder="John Kamau" />
                    </Field>
                    <Field label="Phone number">
                      <input className={inputClass} value={createForm.customerPhone} onChange={(event) => setCreateForm((current) => ({ ...current, customerPhone: event.target.value }))} placeholder="0701 123 321" />
                    </Field>
                    <Field label="Email">
                      <input type="email" className={inputClass} value={createForm.customerEmail} onChange={(event) => setCreateForm((current) => ({ ...current, customerEmail: event.target.value }))} placeholder="customer@example.com" />
                    </Field>
                  </div>
                </section>

                <section className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
                  <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Product and pricing</div>
                  <div className="space-y-4">
                    <SearchSelector label="Product" placeholder="Search POS product" value={product} onChange={handleProductChange} search={searchProducts} />
                    <div className="grid gap-4 md:grid-cols-2">
                      <StepperInput
                        label="Quantity"
                        value={createForm.quantity}
                        onChange={(value) => setCreateForm((current) => ({ ...current, quantity: value }))}
                        min={1}
                      />
                      <Field label="Agreed unit price">
                        <input className={inputClass} value={createForm.agreedUnitPrice} onChange={(event) => setCreateForm((current) => ({ ...current, agreedUnitPrice: event.target.value }))} placeholder="15000" />
                      </Field>
                      <Field label="Agreed total override">
                        <input className={inputClass} value={createForm.agreedTotal} onChange={(event) => setCreateForm((current) => ({ ...current, agreedTotal: event.target.value }))} placeholder="Optional override" />
                      </Field>
                      <Field label="Deposit paid">
                        <input className={inputClass} value={createForm.initialPaymentAmount} onChange={(event) => setCreateForm((current) => ({ ...current, initialPaymentAmount: event.target.value }))} placeholder="0" />
                      </Field>
                    </div>
                  </div>
                </section>

                <section className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
                  <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Payment plan</div>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Payment frequency</div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {(["WEEKLY", "MONTHLY"] as InstallmentFrequency[]).map((frequency) => (
                          <button
                            key={frequency}
                            type="button"
                            onClick={() => setCreateForm((current) => ({ ...current, installmentFrequency: frequency }))}
                            className={`rounded-2xl border px-4 py-3 text-left transition ${
                              createForm.installmentFrequency === frequency
                                ? "border-blue-400/30 bg-blue-500/15 text-blue-100"
                                : "border-white/10 bg-slate-950/50 text-slate-300 hover:border-white/20 hover:text-white"
                            }`}
                          >
                            <div className="text-sm font-semibold">{titleCase(frequency)}</div>
                            <div className="mt-1 text-xs text-slate-400">{frequency === "WEEKLY" ? "Shorter payment cycle" : "Standard monthly collection"}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <StepperInput
                        label="Future installments"
                        value={createForm.installmentCount}
                        onChange={(value) => setCreateForm((current) => ({ ...current, installmentCount: value }))}
                        min={1}
                      />
                      <Field label="Expected completion">
                        <input
                          className={`${inputClass} cursor-not-allowed text-slate-400`}
                          value={toDateInputValue(createExpectedCompletionDate)}
                          readOnly
                        />
                      </Field>
                    </div>
                  </div>
                </section>

                {createDeposit > 0 ? (
                  <section className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
                    <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Deposit payment details</div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      <Field label="Method">
                        <select className={inputClass} value={createForm.initialPaymentMethod} onChange={(event) => setCreateForm((current) => ({ ...current, initialPaymentMethod: event.target.value }))}>
                          <option value="MPESA">M-Pesa</option>
                          <option value="CASH">Cash</option>
                          <option value="BANK">Bank</option>
                          <option value="CARD">Card</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </Field>
                      {createForm.initialPaymentMethod !== "CASH" ? (
                        <Field label="Reference">
                          <input className={inputClass} value={createForm.initialPaymentReference} onChange={(event) => setCreateForm((current) => ({ ...current, initialPaymentReference: event.target.value }))} placeholder="MPESA / bank reference" />
                        </Field>
                      ) : null}
                      <Field label="Payment notes">
                        <input className={inputClass} value={createForm.initialPaymentNotes} onChange={(event) => setCreateForm((current) => ({ ...current, initialPaymentNotes: event.target.value }))} placeholder="Optional note" />
                      </Field>
                    </div>
                  </section>
                ) : null}

                <section className="rounded-[24px] border border-white/10 bg-slate-950/40 p-4">
                  <button
                    type="button"
                    onClick={() => setShowCreateMoreDetails((current) => !current)}
                    className="flex w-full items-center justify-between gap-3 text-left"
                  >
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">More details</div>
                      <div className="mt-1 text-sm text-slate-400">Optional operational fields, overrides, and delivery notes.</div>
                    </div>
                    <ChevronDown className={`h-4 w-4 text-slate-400 transition ${showCreateMoreDetails ? "rotate-180" : ""}`} />
                  </button>

                  {showCreateMoreDetails ? (
                    <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                      <div className="grid gap-4 md:grid-cols-2">
                        <SearchSelector label="Salesperson" placeholder="Search salesperson" value={salesperson} onChange={setSalesperson} search={searchUsers} />
                        <SearchSelector label="Assigned agent" placeholder="Search assigned agent" value={assignedAgent} onChange={setAssignedAgent} search={searchUsers} />
                        <Field label="Source">
                          <input className={inputClass} value={createForm.source} onChange={(event) => setCreateForm((current) => ({ ...current, source: event.target.value }))} placeholder="Walk-in, referral, call center..." />
                        </Field>
                        <Field label="Expected completion override">
                          <input type="date" className={inputClass} value={createForm.expectedCompletionDateOverride} onChange={(event) => setCreateForm((current) => ({ ...current, expectedCompletionDateOverride: event.target.value }))} />
                        </Field>
                        <Field label="Payment mode">
                          <select className={inputClass} value={createForm.paymentMode} onChange={(event) => setCreateForm((current) => ({ ...current, paymentMode: event.target.value }))}>
                            <option value="SCHEDULED">Scheduled</option>
                            <option value="FLEXIBLE">Flexible</option>
                          </select>
                        </Field>
                        <Field label="Reservation mode">
                          <select className={inputClass} value={createForm.reservationMode} onChange={(event) => setCreateForm((current) => ({ ...current, reservationMode: event.target.value }))}>
                            <option value="NONE">None</option>
                            <option value="SOFT_RESERVE">Soft reserve</option>
                            <option value="HARD_RESERVE">Hard reserve</option>
                          </select>
                        </Field>
                        <Field label="County">
                          <input className={inputClass} value={createForm.county} onChange={(event) => setCreateForm((current) => ({ ...current, county: event.target.value }))} placeholder="Nairobi" />
                        </Field>
                        <Field label="Town">
                          <input className={inputClass} value={createForm.town} onChange={(event) => setCreateForm((current) => ({ ...current, town: event.target.value }))} placeholder="Ruiru" />
                        </Field>
                        <Field label="Estate / landmark">
                          <input className={inputClass} value={createForm.estateLandmark} onChange={(event) => setCreateForm((current) => ({ ...current, estateLandmark: event.target.value }))} placeholder="Stage 2, near shell" />
                        </Field>
                        <Field label="Location notes">
                          <input className={inputClass} value={createForm.locationNotes} onChange={(event) => setCreateForm((current) => ({ ...current, locationNotes: event.target.value }))} placeholder="Gate color, delivery notes..." />
                        </Field>
                      </div>
                      <Field label="Notes">
                        <textarea className={textareaClass} value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Optional internal notes" />
                      </Field>
                    </div>
                  ) : null}
                </section>
              </div>

              <aside className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4 text-sm text-slate-300 xl:sticky xl:top-0 xl:self-start">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">Payment plan summary</div>
                <div className="mt-4 space-y-3">
                  <PlanRow label="Product" value={product?.label || "Select product"} />
                  <PlanRow label="Quantity" value={String(createQuantity)} />
                  <PlanRow label="Unit price" value={formatKes(createUnitPrice)} />
                  <PlanRow label="Agreed total" value={formatKes(createAgreedTotal)} emphasis="text-white" />
                  <PlanRow label="Deposit paid" value={formatKes(createDeposit)} emphasis="text-emerald-300" />
                  <PlanRow label="Pending balance" value={formatKes(createBalance)} emphasis="text-amber-300" />
                  <PlanRow
                    label={`${titleCase(createForm.installmentFrequency)} installments`}
                    value={createBalance > 0 ? `${createInstallmentCount} x ${formatKes(createInstallmentAmount)}` : "No balance remaining"}
                  />
                  <PlanRow label="Expected completion" value={formatDate(createForm.expectedCompletionDateOverride || toDateInputValue(createExpectedCompletionDate))} />
                </div>
              </aside>
            </div>

            <div className="flex flex-wrap gap-3">
              <button type="submit" className={primaryButtonClass} disabled={isSubmittingCreate}>
                {isSubmittingCreate ? "Creating..." : "Create account"}
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
            </div>
          </form>
        </ModalShell>
      ) : null}

      {actionModal && activeDetail ? (
        <ModalShell
          title={
            actionModal === "PAYMENT"
              ? "Record Payment"
              : actionModal === "ASSIGN"
                ? "Assign / Reassign Account"
                : actionModal === "FOLLOW_UP"
                  ? "Record Follow-Up"
                  : actionModal === "PROMISE"
                    ? "Record Promise To Pay"
                    : "Release Product"
          }
          subtitle={`${activeDetail.account.reference} · ${activeDetail.account.customerName || "Unknown customer"}`}
          onClose={() => setActionModal(null)}
        >
          {actionModal === "PAYMENT" ? (
            <form className="space-y-4" onSubmit={handlePayment}>
              <Field label="Amount">
                <input className={inputClass} value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} placeholder="5000" />
              </Field>
              <Field label="Method">
                <select className={inputClass} value={paymentForm.method} onChange={(event) => setPaymentForm((current) => ({ ...current, method: event.target.value }))}>
                  <option value="MPESA">M-Pesa</option>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bank</option>
                  <option value="CARD">Card</option>
                  <option value="OTHER">Other</option>
                </select>
              </Field>
              <Field label="Reference">
                <input className={inputClass} value={paymentForm.reference} onChange={(event) => setPaymentForm((current) => ({ ...current, reference: event.target.value }))} />
              </Field>
              <Field label="Notes">
                <textarea className={textareaClass} value={paymentForm.notes} onChange={(event) => setPaymentForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <div className="flex gap-3">
                <button type="submit" className={primaryButtonClass} disabled={isSubmittingPayment}>
                  {isSubmittingPayment ? "Saving..." : "Record payment"}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setActionModal(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {actionModal === "ASSIGN" ? (
            <form className="space-y-4" onSubmit={handleAssign}>
              <SearchSelector label="Assigned agent" placeholder="Search customer service user" value={assignAgent} onChange={setAssignAgent} search={searchUsers} />
              <div className="flex gap-3">
                <button type="submit" className={primaryButtonClass} disabled={isSubmittingAssign}>
                  {isSubmittingAssign ? "Saving..." : assignAgent ? "Assign selected agent" : "Run round robin"}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setActionModal(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {actionModal === "FOLLOW_UP" ? (
            <form className="space-y-4" onSubmit={handleCreateFollowUp}>
              <Field label="Task type">
                <select className={inputClass} value={followUpForm.taskType} onChange={(event) => setFollowUpForm((current) => ({ ...current, taskType: event.target.value }))}>
                  <option value="FOLLOW_UP_TODAY">Follow up today</option>
                  <option value="PAYMENT_OVERDUE">Payment overdue</option>
                  <option value="CUSTOMER_PROMISED_PAYMENT">Customer promised payment</option>
                  <option value="NO_ANSWER">No answer</option>
                  <option value="WHATSAPP_SENT">WhatsApp sent</option>
                  <option value="CUSTOMER_REQUESTED_EXTENSION">Customer requested extension</option>
                </select>
              </Field>
              <Field label="Task date">
                <input type="date" className={inputClass} value={followUpForm.taskDate} onChange={(event) => setFollowUpForm((current) => ({ ...current, taskDate: event.target.value }))} />
              </Field>
              <Field label="Outcome">
                <input className={inputClass} value={followUpForm.outcome} onChange={(event) => setFollowUpForm((current) => ({ ...current, outcome: event.target.value }))} placeholder="Called, no answer, customer promised..." />
              </Field>
              <Field label="Notes">
                <textarea className={textareaClass} value={followUpForm.notes} onChange={(event) => setFollowUpForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <div className="flex gap-3">
                <button type="submit" className={primaryButtonClass} disabled={isSubmittingFollowUp}>
                  {isSubmittingFollowUp ? "Saving..." : "Record Follow-Up"}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setActionModal(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {actionModal === "PROMISE" ? (
            <form className="space-y-4" onSubmit={handleCreatePromise}>
              <Field label="Promise amount">
                <input className={inputClass} value={promiseForm.promiseAmount} onChange={(event) => setPromiseForm((current) => ({ ...current, promiseAmount: event.target.value }))} placeholder="30000" />
              </Field>
              <Field label="Promise date">
                <input type="date" className={inputClass} value={promiseForm.promiseDate} onChange={(event) => setPromiseForm((current) => ({ ...current, promiseDate: event.target.value }))} />
              </Field>
              <Field label="Notes">
                <textarea className={textareaClass} value={promiseForm.notes} onChange={(event) => setPromiseForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <div className="flex gap-3">
                <button type="submit" className={primaryButtonClass} disabled={isSubmittingPromise}>
                  {isSubmittingPromise ? "Saving..." : "Record Promise"}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setActionModal(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}

          {actionModal === "RELEASE" ? (
            <form className="space-y-4" onSubmit={handleRelease}>
              <Field label="Fulfillment method">
                <select className={inputClass} value={releaseForm.fulfillmentMethod} onChange={(event) => setReleaseForm((current) => ({ ...current, fulfillmentMethod: event.target.value }))}>
                  <option value="Customer Collection">Customer Collection</option>
                  <option value="Delivery">Delivery</option>
                  <option value="Installation">Installation</option>
                  <option value="Courier">Courier</option>
                  <option value="Other">Other</option>
                </select>
              </Field>
              <Field label="Collector / receiver">
                <input className={inputClass} value={releaseForm.collectorName} onChange={(event) => setReleaseForm((current) => ({ ...current, collectorName: event.target.value }))} placeholder="Customer or authorized receiver" />
              </Field>
              <Field label="ID / reference">
                <input className={inputClass} value={releaseForm.collectorReference} onChange={(event) => setReleaseForm((current) => ({ ...current, collectorReference: event.target.value }))} placeholder="National ID, phone, delivery ref..." />
              </Field>
              <Field label="Release notes">
                <textarea className={textareaClass} value={releaseForm.notes} onChange={(event) => setReleaseForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
              <div className="flex gap-3">
                <button type="submit" className={primaryButtonClass} disabled={isReleasing}>
                  {isReleasing ? "Saving..." : "Release Product"}
                </button>
                <button type="button" className={secondaryButtonClass} onClick={() => setActionModal(null)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </ModalShell>
      ) : null}
    </main>
  );
}

function ExpandedRowDetails({
  detail,
  activeTab,
  onTabChange,
  onOpenAction,
  onConvertToPos,
  onConvertToProject,
  onReversePayment,
  isConvertingPos,
  isConvertingProject,
}: {
  detail: LppDetail;
  activeTab: DetailsTab;
  onTabChange: (tab: DetailsTab) => void;
  onOpenAction: (action: ActionModal) => void;
  onConvertToPos: () => void;
  onConvertToProject: () => void;
  onReversePayment: (paymentId: string) => void;
  isConvertingPos: boolean;
  isConvertingProject: boolean;
}) {
  const account = detail.account;
  const due = describeDueDate(account.expectedCompletionDate);

  return (
    <div className="overflow-hidden rounded-[24px] border border-white/10 bg-[linear-gradient(180deg,rgba(9,16,28,0.94),rgba(7,12,22,0.98))]">
      <div className="grid gap-4 border-b border-white/10 p-5 xl:grid-cols-3">
        <SummaryCard title="Account Summary">
          <SummaryValue label={account.reference} value={account.customerName || "Unknown customer"} />
          <div className="text-sm text-slate-400">{account.customerPhone || "No phone"}</div>
          <div className="mt-4 text-white">{account.productName || "No product selected"}</div>
          <div className="mt-1 text-sm text-slate-500">Qty 1</div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <InfoPair label="Created" value={formatDate(account.createdAt)} />
            <InfoPair label="Expected Completion" value={formatDate(account.expectedCompletionDate)} />
          </div>
        </SummaryCard>

        <SummaryCard title="Payment Overview">
          <div className="grid gap-3 sm:grid-cols-2">
            <MetricTile label="Agreed Total" value={formatKes(detail.summary.agreedTotal)} />
            <MetricTile label="Paid" value={formatKes(detail.summary.totalPaid)} tone="text-emerald-300" />
            <MetricTile label="Balance" value={formatKes(detail.summary.balance)} tone="text-amber-300" />
            <MetricTile label="Progress" value={`${Math.round(detail.summary.percentagePaid)}%`} />
          </div>
          <div className="mt-4">
            <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] text-slate-500">
              <span>Progress</span>
              <span>{Math.round(detail.summary.percentagePaid)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className={`h-full ${progressTone(detail.summary.percentagePaid)}`} style={{ width: `${Math.max(0, Math.min(100, detail.summary.percentagePaid))}%` }} />
            </div>
          </div>
        </SummaryCard>

        <SummaryCard title="Ownership">
          <div className="grid gap-3 sm:grid-cols-2">
            <InfoPair label="Customer Service" value={account.assignedToName || "Unassigned"} />
            <InfoPair label="Salesperson" value="Not captured" />
            <InfoPair label="Payment Mode" value="Flexible" />
            <InfoPair label="Source" value="Not captured" />
            <InfoPair label="Status" value={titleCase(account.status)} />
            <InfoPair label="Due" value={due.label} tone={due.tone} />
          </div>
        </SummaryCard>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-white/10 px-5 pt-4">
        {TAB_ITEMS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`border-b-2 px-1 pb-3 text-sm font-medium transition ${
              activeTab === tab.id ? "border-blue-400 text-blue-200" : "border-transparent text-slate-400 hover:text-white"
            }`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 p-5">
        {activeTab === "OVERVIEW" ? (
          <>
            <div className="grid gap-4 xl:grid-cols-4">
              <DetailBlock title="Customer" className="xl:col-span-1">
                <div className="space-y-3">
                  <InfoPair label="Name" value={account.customerName || "Unknown customer"} />
                  <InfoPair label="Phone" value={account.customerPhone || "No phone"} />
                  <InfoPair label="Location" value="Kenya" />
                </div>
              </DetailBlock>
              <DetailBlock title="Agreement" className="xl:col-span-2">
                <div className="grid gap-3 sm:grid-cols-2">
                  <InfoPair label="Product" value={account.productName || "No product selected"} />
                  <InfoPair label="Quantity" value="1" />
                  <InfoPair label="Agreed Price" value={formatKes(detail.summary.agreedTotal)} />
                  <InfoPair label="Completion Date" value={formatDate(account.expectedCompletionDate)} />
                  <InfoPair label="Reservation Mode" value="Not captured" />
                  <InfoPair label="Payment Mode" value="Flexible" />
                </div>
              </DetailBlock>
              <DetailBlock title="Ownership" className="xl:col-span-1">
                <div className="space-y-3">
                  <InfoPair label="Customer Service" value={account.assignedToName || "Unassigned"} />
                  <InfoPair label="Salesperson" value="Not captured" />
                  <InfoPair label="Source" value="Not captured" />
                </div>
              </DetailBlock>
            </div>

            <DetailBlock title="Next Action">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                <div>
                  <div className="text-xl font-semibold text-white">
                    {detail.summary.balance > 0 ? (isDueToday(account.expectedCompletionDate) ? "Payment due today" : "Continue collection") : "Fully paid"}
                  </div>
                  <div className="mt-2 text-sm text-slate-400">
                    {detail.summary.balance > 0 ? `Outstanding ${formatKes(detail.summary.balance)}` : "This account is ready for conversion."}
                  </div>
                </div>
                <div className="flex flex-wrap gap-3">
                  {detail.summary.balance > 0 ? (
                    <>
                      <button type="button" className={primaryButtonClass} onClick={() => onOpenAction("PAYMENT")}>
                        Record Payment
                      </button>
                      <button type="button" className={secondaryButtonClass} onClick={() => onOpenAction("FOLLOW_UP")}>
                        Follow Up
                      </button>
                      <button type="button" className={secondaryButtonClass} onClick={() => onOpenAction("ASSIGN")}>
                        More Actions
                        <ChevronDown className="ml-2 h-4 w-4" />
                      </button>
                    </>
                  ) : !account.convertedReceiptId && !account.convertedProjectId ? (
                    <>
                      <button type="button" className={primaryButtonClass} onClick={onConvertToPos} disabled={isConvertingPos || isConvertingProject}>
                        {isConvertingPos ? "Converting..." : "Send to POS"}
                      </button>
                      <button type="button" className={secondaryButtonClass} onClick={onConvertToProject} disabled={isConvertingPos || isConvertingProject}>
                        {isConvertingProject ? "Converting..." : "Create Project"}
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            </DetailBlock>
          </>
        ) : null}

        {activeTab === "PAYMENTS" ? (
          <DetailBlock title="Payment History">
            {detail.payments.length === 0 ? (
              <EmptyBlock text="No payments recorded yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="pb-3">Date</th>
                      <th className="pb-3">Amount</th>
                      <th className="pb-3">Method</th>
                      <th className="pb-3">Reference</th>
                      <th className="pb-3">Status</th>
                      <th className="pb-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.payments.map((payment) => (
                      <tr key={payment.id} className="border-t border-white/6 text-slate-200">
                        <td className="py-3">{formatDateTime(payment.receivedAt)}</td>
                        <td className="py-3 font-semibold text-white">{formatKes(payment.amount)}</td>
                        <td className="py-3">{payment.method}</td>
                        <td className="py-3">{payment.reference || "-"}</td>
                        <td className="py-3">
                          <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(payment.status)}`}>
                            {titleCase(payment.status)}
                          </span>
                        </td>
                        <td className="py-3 text-right">
                          {payment.status === "SUCCESS" ? (
                            <button type="button" className="text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 transition hover:text-rose-100" onClick={() => void onReversePayment(payment.id)}>
                              Reverse
                            </button>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-5 flex flex-col gap-4 rounded-2xl border border-white/10 bg-slate-950/45 p-4 md:flex-row md:items-center md:justify-between">
              <div className="grid gap-2 text-sm text-slate-300">
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">Total Paid</span>
                  <span className="font-semibold text-white">{formatKes(detail.summary.totalPaid)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500">Remaining</span>
                  <span className="font-semibold text-amber-300">{formatKes(detail.summary.balance)}</span>
                </div>
              </div>
              <button type="button" className={primaryButtonClass} onClick={() => onOpenAction("PAYMENT")}>
                + Record Payment
              </button>
            </div>
          </DetailBlock>
        ) : null}

        {activeTab === "FOLLOW_UPS" ? (
          <div className="grid gap-4 xl:grid-cols-2">
            <DetailBlock title="Follow-Ups">
              <div className="space-y-3">
                {detail.followUps.length === 0 ? <EmptyBlock text="No follow-up tasks yet." /> : null}
                {detail.followUps.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="text-sm font-semibold text-white">{formatDateTime(item.taskDate || item.createdAt)}</div>
                    <div className="mt-1 text-xs text-slate-400">{item.assignedToName || item.createdByName || "Unassigned"}</div>
                    {item.outcome ? <div className="mt-3 text-sm text-white">{item.outcome}</div> : null}
                    {item.notes ? <div className="mt-2 text-sm text-slate-300">{item.notes}</div> : null}
                  </div>
                ))}
              </div>
            </DetailBlock>
            <DetailBlock title="Promises To Pay">
              <div className="space-y-3">
                {detail.promises.length === 0 ? <EmptyBlock text="No promises recorded yet." /> : null}
                {detail.promises.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="text-sm font-semibold text-white">{formatKes(item.promiseAmount)}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {formatDate(item.promiseDate)} · {titleCase(item.status)}
                    </div>
                    {item.notes ? <div className="mt-2 text-sm text-slate-300">{item.notes}</div> : null}
                  </div>
                ))}
              </div>
            </DetailBlock>
            <div className="xl:col-span-2 flex flex-wrap gap-3">
              <button type="button" className={primaryButtonClass} onClick={() => onOpenAction("FOLLOW_UP")}>
                + Follow Up
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => onOpenAction("PROMISE")}>
                + Promise To Pay
              </button>
            </div>
          </div>
        ) : null}

        {activeTab === "TIMELINE" ? (
          <DetailBlock title="Audit Timeline">
            <div className="space-y-3">
              {detail.events.length === 0 && detail.reminders.length === 0 ? <EmptyBlock text="No timeline entries recorded yet." /> : null}
              {detail.events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="text-sm font-semibold text-white">{formatDateTime(event.createdAt)}</div>
                  <div className="mt-2 text-sm text-slate-200">{titleCase(event.eventType)}</div>
                </div>
              ))}
              {detail.reminders.map((item) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                  <div className="text-sm font-semibold text-white">{formatDateTime(item.scheduledFor)}</div>
                  <div className="mt-2 text-sm text-slate-200">{titleCase(item.reminderType)}</div>
                  <div className="mt-1 text-xs text-slate-400">{titleCase(item.status)}</div>
                </div>
              ))}
            </div>
          </DetailBlock>
        ) : null}

        <div className="flex flex-wrap gap-3 border-t border-white/10 pt-4">
          {detail.summary.balance > 0 ? (
            <>
              <button type="button" className={primaryButtonClass} onClick={() => onOpenAction("PAYMENT")}>
                Record Payment
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => onOpenAction("FOLLOW_UP")}>
                Follow Up
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => onOpenAction("PROMISE")}>
                Promise To Pay
              </button>
              <button type="button" className={secondaryButtonClass} onClick={() => onOpenAction("ASSIGN")}>
                Assign / Reassign
              </button>
            </>
          ) : null}

          {detail.summary.isFullyPaid && !account.convertedReceiptId && !account.convertedProjectId ? (
            <>
              <button type="button" className={primaryButtonClass} onClick={onConvertToPos} disabled={isConvertingPos || isConvertingProject}>
                {isConvertingPos ? "Converting..." : "Send to POS"}
              </button>
              <button type="button" className={secondaryButtonClass} onClick={onConvertToProject} disabled={isConvertingPos || isConvertingProject}>
                {isConvertingProject ? "Converting..." : "Create Project"}
              </button>
            </>
          ) : null}

          {account.convertedReceiptId ? (
            <Link href={`/receipts/${account.convertedReceiptId}`} className={secondaryButtonClass}>
              View Receipt
            </Link>
          ) : null}

          {account.convertedProjectId ? (
            <Link href={`/admin/quotation-center/${account.convertedProjectId}`} className={secondaryButtonClass}>
              Open Project
            </Link>
          ) : null}

          {(account.convertedReceiptId || account.convertedProjectId) && !account.fulfilledAt ? (
            <button type="button" className="inline-flex items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15" onClick={() => onOpenAction("RELEASE")}>
              Release Product
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Banner({ tone, text }: { tone: "success" | "error"; text: string }) {
  return (
    <div
      className={`mb-4 rounded-2xl border px-4 py-3 text-sm ${
        tone === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100" : "border-rose-500/30 bg-rose-500/10 text-rose-100"
      }`}
    >
      {text}
    </div>
  );
}

function KpiCard({
  icon,
  iconTone,
  label,
  value,
  sub,
  change,
  onClick,
  active,
}: {
  icon: ReactNode;
  iconTone: string;
  label: string;
  value: string;
  sub: string;
  change: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-[24px] border p-4 text-left transition ${
        active ? "border-blue-400/40 bg-blue-500/10 shadow-[0_18px_40px_rgba(37,99,235,0.12)]" : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]"
      }`}
    >
      <div className={`inline-flex h-10 w-10 items-center justify-center rounded-2xl ${iconTone}`}>{icon}</div>
      <div className="mt-4 text-sm text-slate-400">{label}</div>
      <div className="mt-1 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-3 flex items-center justify-between gap-3 text-xs">
        <span className="text-slate-500">{sub}</span>
        <span className="text-slate-400">{change}</span>
      </div>
    </button>
  );
}

function QuickFilterChip({ label, count, active, onClick }: { label: string; count: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
        active ? "border-blue-400/30 bg-blue-500/15 text-blue-100" : "border-white/10 bg-slate-950/35 text-slate-300 hover:border-white/20 hover:text-white"
      }`}
    >
      <span>{label}</span>
      <span className="rounded-full bg-white/8 px-2 py-0.5 text-xs">{count}</span>
    </button>
  );
}

function FilterSelect({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <select className="min-w-[150px] rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-400/50" value={value} onChange={(event) => onChange(event.target.value)}>
      {children}
    </select>
  );
}

function SummaryCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[22px] border border-white/10 bg-slate-950/45 p-4">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</div>
      {children}
    </div>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs uppercase tracking-[0.18em] text-blue-300">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-white">{value}</div>
    </div>
  );
}

function MetricTile({ label, value, tone, className = "" }: { label: string; value: string; tone?: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-900/60 p-3 ${className}`.trim()}>
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-2 text-lg font-semibold ${tone || "text-white"}`}>{value}</div>
    </div>
  );
}

function DetailBlock({ title, children, className = "" }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-[24px] border border-white/10 bg-slate-950/35 p-4 ${className}`.trim()}>
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</div>
      {children}
    </section>
  );
}

function InfoPair({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 ${tone || "text-white"}`}>{value}</div>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 px-4 py-6 text-sm text-slate-500">{text}</div>;
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/80 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-6xl rounded-[30px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(7,14,26,1))] shadow-[0_30px_90px_rgba(0,0,0,0.5)]">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
          <div>
            <h2 className="text-2xl font-semibold text-white">{title}</h2>
            <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
          </div>
          <button type="button" className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/50 text-slate-400 transition hover:border-white/20 hover:text-white" onClick={onClose}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="max-h-[calc(100vh-140px)] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</span>
      {children}
    </label>
  );
}

function StepperInput({
  label,
  value,
  onChange,
  min = 0,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: number;
}) {
  const currentValue = Number(value || String(min));

  return (
    <Field label={label}>
      <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2">
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:border-white/20 hover:text-white"
          onClick={() => onChange(String(Math.max(min, currentValue - 1)))}
        >
          <Minus className="h-4 w-4" />
        </button>
        <input
          className="w-full bg-transparent text-center text-sm text-white outline-none"
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-200 transition hover:border-white/20 hover:text-white"
          onClick={() => onChange(String(Math.max(min, currentValue + 1)))}
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
    </Field>
  );
}

function PlanRow({ label, value, emphasis }: { label: string; value: string; emphasis?: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/8 bg-slate-950/35 px-4 py-3">
      <span className="text-slate-500">{label}</span>
      <span className={`text-right font-semibold ${emphasis || "text-slate-100"}`}>{value}</span>
    </div>
  );
}

function SearchSelector({ label, placeholder, value, onChange, search }: SearchSelectorProps) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<SearchOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!query.trim()) {
      setOptions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const handle = window.setTimeout(() => {
      void search(query)
        .then((items) => {
          if (!cancelled) setOptions(items);
        })
        .catch(() => {
          if (!cancelled) setOptions([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 250);

    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [query, search]);

  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <input className={inputClass} value={query} onChange={(event) => setQuery(event.target.value)} placeholder={placeholder} />
      {value ? (
        <div className="flex items-center justify-between rounded-2xl border border-blue-500/20 bg-blue-500/10 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-blue-100">{value.label}</div>
            {value.hint ? <div className="text-xs text-blue-200/70">{value.hint}</div> : null}
          </div>
          <button type="button" className="text-xs font-semibold uppercase tracking-[0.16em] text-blue-100" onClick={() => onChange(null)}>
            Clear
          </button>
        </div>
      ) : null}
      {loading ? <div className="text-xs text-slate-500">Searching...</div> : null}
      {!loading && options.length > 0 ? (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/95 p-2">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className="block w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/[0.06]"
              onClick={() => {
                onChange(option);
                setQuery("");
                setOptions([]);
              }}
            >
              <div className="text-sm font-medium text-white">{option.label}</div>
              {option.hint ? <div className="text-xs text-slate-400">{option.hint}</div> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
