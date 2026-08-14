"use client";

import Link from "next/link";
import {
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Package2,
  Phone,
  Plus,
  RefreshCcw,
  Search,
  TrendingUp,
  Wallet,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";

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
};

type SearchSelectorProps = {
  label: string;
  placeholder: string;
  value: SearchOption | null;
  onChange: (option: SearchOption | null) => void;
  search: (query: string) => Promise<SearchOption[]>;
};

type DrawerTab = "OVERVIEW" | "PAYMENTS" | "FOLLOW_UPS" | "TIMELINE";
type ActionPanel = "PAYMENT" | "ASSIGN" | "FOLLOW_UP" | "PROMISE" | "RELEASE" | null;
type QuickFilter = "ALL" | "ACTIVE" | "DUE_TODAY" | "DUE_WEEK" | "OVERDUE" | "FULLY_PAID" | "CANCELLED";

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

const DRAWER_TABS: Array<{ id: DrawerTab; label: string }> = [
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
  item: { id: string; name?: string | null; email?: string | null; phone?: string | null; sku?: string | null },
  fallback: string,
): SearchOption {
  return {
    id: item.id,
    label: item.name || item.email || fallback,
    hint: item.phone || item.email || item.sku || null,
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
  const [q, setQ] = useState(initialQ);
  const [status, setStatus] = useState(initialStatus);
  const [banner, setBanner] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [, startTransition] = useTransition();
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isConvertingPos, setIsConvertingPos] = useState(false);
  const [isConvertingProject, setIsConvertingProject] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);
  const [isSubmittingPromise, setIsSubmittingPromise] = useState(false);
  const [customer, setCustomer] = useState<SearchOption | null>(null);
  const [product, setProduct] = useState<SearchOption | null>(null);
  const [salesperson, setSalesperson] = useState<SearchOption | null>(null);
  const [assignedAgent, setAssignedAgent] = useState<SearchOption | null>(null);
  const [assignAgent, setAssignAgent] = useState<SearchOption | null>(null);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>("OVERVIEW");
  const [actionPanel, setActionPanel] = useState<ActionPanel>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("ALL");
  const [agentFilter, setAgentFilter] = useState("ALL");
  const [productFilter, setProductFilter] = useState("ALL");
  const [dueFilter, setDueFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const hasHydratedRef = useRef(false);
  const [createForm, setCreateForm] = useState({
    quantity: "1",
    agreedUnitPrice: "",
    agreedTotal: "",
    expectedCompletionDate: "",
    paymentMode: "FLEXIBLE",
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
    setSelectedId(initialDetail?.account.id ?? initialItems[0]?.id ?? "");
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
    if (selectedId) params.set("id", selectedId);
    else params.delete("id");
    const next = params.toString();
    const href = next ? `${window.location.pathname}?${next}` : window.location.pathname;
    window.history.replaceState({}, "", href);
  }, [q, status, selectedId]);

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
    } else {
      setDetail(null);
      setSelectedId("");
    }
  }

  async function loadDetail(id: string) {
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
  }

  async function searchCustomers(query: string) {
    const data = await readJson<Array<{ id: string; name?: string | null; email?: string | null; phone?: string | null }>>(
      `/api/admin/customers/search?q=${encodeURIComponent(query)}`,
      { headers: {} },
    );
    return data.map((item) => toSearchOption(item, "Customer"));
  }

  async function searchUsers(query: string) {
    const data = await readJson<Array<{ id: string; name?: string | null; email?: string | null }>>(
      `/api/users/search?q=${encodeURIComponent(query)}`,
      { headers: {} },
    );
    return data.map((item) => toSearchOption(item, "User"));
  }

  async function searchProducts(query: string) {
    const data = await readJson<{ items: Array<{ id: string; name?: string | null; sku?: string | null }> }>(
      `/api/attendant/pos-products?q=${encodeURIComponent(query)}&limit=20`,
      { headers: {} },
    );
    return (data.items || []).map((item) => toSearchOption(item, "Product"));
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!customer) {
      setBanner({ tone: "error", text: "Select a customer before creating an account." });
      return;
    }
    if (!createForm.agreedUnitPrice.trim()) {
      setBanner({ tone: "error", text: "Agreed unit price is required." });
      return;
    }

    setIsSubmittingCreate(true);
    setBanner(null);
    try {
      const payload = {
        customerId: customer.id,
        productId: product?.id ?? null,
        quantity: Number(createForm.quantity || "1"),
        agreedUnitPrice: createForm.agreedUnitPrice,
        agreedTotal: createForm.agreedTotal.trim() ? createForm.agreedTotal : null,
        expectedCompletionDate: createForm.expectedCompletionDate || null,
        paymentMode: createForm.paymentMode,
        reservationMode: createForm.reservationMode,
        salespersonId: salesperson?.id ?? null,
        source: createForm.source.trim() || null,
        notes: createForm.notes.trim() || null,
        assignment: assignedAgent
          ? {
              assignedToId: assignedAgent.id,
              method: "MANUAL",
            }
          : null,
        initialPayment: createForm.initialPaymentAmount.trim()
          ? {
              amount: createForm.initialPaymentAmount,
              method: createForm.initialPaymentMethod,
              reference: createForm.initialPaymentReference.trim() || null,
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
      setCustomer(null);
      setProduct(null);
      setSalesperson(null);
      setAssignedAgent(null);
      setCreateForm({
        quantity: "1",
        agreedUnitPrice: "",
        agreedTotal: "",
        expectedCompletionDate: "",
        paymentMode: "FLEXIBLE",
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
      setActionPanel(null);
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
      setActionPanel(null);
      setDrawerTab("PAYMENTS");
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
      setActionPanel(null);
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
      setActionPanel(null);
      setDrawerTab("FOLLOW_UPS");
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
      setActionPanel(null);
      setDrawerTab("FOLLOW_UPS");
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmittingPromise(false);
    }
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
  const detailAccount = detail?.account ?? null;
  const activeDetail = detailAccount && detail ? detail : null;
  const selectedVisible = filteredItems.find((item) => item.id === selectedId) ?? detailAccount;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(29,78,216,0.18),transparent_28%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.7),transparent_36%),linear-gradient(180deg,#08111f_0%,#050b16_100%)] px-4 py-5 text-slate-100 lg:px-6 xl:px-8">
      <div className="mx-auto max-w-[1750px]">
        {banner ? <Banner tone={banner.tone} text={banner.text} /> : null}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.7fr)_390px]">
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
                <table className="min-w-full text-sm">
                  <thead className="border-b border-white/10 bg-slate-950/50 text-left text-[11px] uppercase tracking-[0.18em] text-slate-500">
                    <tr>
                      <th className="px-4 py-4">Customer</th>
                      <th className="px-4 py-4">LPP #</th>
                      <th className="px-4 py-4">Product</th>
                      <th className="px-4 py-4">Total Amount</th>
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
                        <td colSpan={11} className="px-4 py-16 text-center text-sm text-slate-500">
                          No Lipa Pole Pole accounts found for the current filters.
                        </td>
                      </tr>
                    ) : null}
                    {paginatedItems.map((item) => {
                      const due = describeDueDate(item.expectedCompletionDate);
                      return (
                        <tr
                          key={item.id}
                          className={`border-b border-white/6 transition hover:bg-white/[0.03] ${selectedVisible?.id === item.id ? "bg-blue-500/7" : ""}`}
                        >
                          <td className="px-4 py-4">
                            <button
                              type="button"
                              className="text-left"
                              onClick={() => {
                                setDrawerTab("OVERVIEW");
                                setActionPanel(null);
                                setBanner(null);
                                startTransition(() => {
                                  void loadDetail(item.id).catch(showError);
                                });
                              }}
                            >
                              <div className="font-medium text-white">{item.customerName || "Unknown customer"}</div>
                              <div className="mt-1 text-xs text-slate-500">{item.customerPhone || "No phone"}</div>
                            </button>
                          </td>
                          <td className="px-4 py-4 text-slate-300">{item.reference}</td>
                          <td className="px-4 py-4">
                            <div className="text-white">{item.productName || "No product"}</div>
                          </td>
                          <td className="px-4 py-4 text-slate-200">{formatKes(item.agreedTotal)}</td>
                          <td className="px-4 py-4 text-emerald-300">{formatKes(item.totalPaid)}</td>
                          <td className="px-4 py-4 font-medium text-amber-300">{formatKes(item.balance)}</td>
                          <td className="px-4 py-4">
                            <div className="w-[110px]">
                              <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                                <span>{Math.round(item.percentagePaid)}%</span>
                              </div>
                              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                                <div className={`h-full ${progressTone(item.percentagePaid)}`} style={{ width: `${Math.max(0, Math.min(100, item.percentagePaid))}%` }} />
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="text-white">{formatDate(item.expectedCompletionDate)}</div>
                            <div className={`mt-1 text-xs ${due.tone}`}>{due.label}</div>
                          </td>
                          <td className="px-4 py-4 text-slate-300">{item.assignedToName || "Unassigned"}</td>
                          <td className="px-4 py-4">
                            <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
                              {titleCase(item.status)}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <button
                              type="button"
                              className="rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-white/20 hover:text-white"
                              onClick={() => {
                                setDrawerTab("OVERVIEW");
                                setActionPanel(null);
                                startTransition(() => {
                                  void loadDetail(item.id).catch(showError);
                                });
                              }}
                            >
                              Open
                            </button>
                          </td>
                        </tr>
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

          <aside className="rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(7,14,26,0.98))] shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
            {!detailAccount || !activeDetail ? (
              <div className="flex min-h-[680px] items-center justify-center p-8 text-center text-sm text-slate-500">
                Select an account to view payment history, follow-ups, and completion actions.
              </div>
            ) : (
              <div className="flex h-full flex-col">
                <div className="border-b border-white/10 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-white">{detailAccount.reference}</div>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20 text-lg font-semibold text-blue-200">
                          {(detailAccount.customerName || "C").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-2xl font-semibold text-white">{detailAccount.customerName || "Unknown customer"}</div>
                          <div className="mt-1 text-sm text-slate-400">{detailAccount.customerPhone || "No phone"}</div>
                          <div className="mt-1 text-xs text-slate-500">Nairobi, Kenya</div>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 text-slate-400 transition hover:border-white/20 hover:text-white"
                      onClick={() => {
                        setDetail(null);
                        setSelectedId("");
                      }}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(detailAccount.status)}`}>
                      {titleCase(detailAccount.status)}
                    </span>
                    <div className="flex items-center gap-2">
                      <IconButton icon={<Phone className="h-4 w-4" />} />
                      <IconButton icon={<Bell className="h-4 w-4" />} />
                    </div>
                  </div>

                  <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                    <div className="grid grid-cols-3 gap-3">
                      <DrawerMetric label="Total Amount" value={formatKes(activeDetail.summary.agreedTotal)} />
                      <DrawerMetric label="Paid Amount" value={formatKes(activeDetail.summary.totalPaid)} />
                      <DrawerMetric label="Balance" value={formatKes(activeDetail.summary.balance)} emphasis="text-amber-300" />
                    </div>
                    <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
                      <div>
                        <div className="mb-2 text-xs uppercase tracking-[0.18em] text-slate-500">Progress</div>
                        <div className="h-2 overflow-hidden rounded-full bg-white/10">
                          <div className={`h-full ${progressTone(activeDetail.summary.percentagePaid)}`} style={{ width: `${Math.max(0, Math.min(100, activeDetail.summary.percentagePaid))}%` }} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold text-white">{Math.round(activeDetail.summary.percentagePaid)}%</div>
                        <div className="text-xs text-slate-500">{formatDate(detailAccount.expectedCompletionDate)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 flex gap-2 border-b border-white/10 pb-1">
                    {DRAWER_TABS.map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        className={`border-b-2 px-1 pb-3 text-sm font-medium transition ${
                          drawerTab === tab.id ? "border-blue-400 text-blue-200" : "border-transparent text-slate-400 hover:text-white"
                        }`}
                        onClick={() => setDrawerTab(tab.id)}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 space-y-4 overflow-y-auto p-5">
                  {drawerTab === "OVERVIEW" ? (
                    <>
                      <DetailBlock title="Product">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-xl text-white">{detailAccount.productName || "No product selected"}</div>
                            <div className="mt-2 text-sm text-slate-400">Quantity: 1</div>
                          </div>
                          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-slate-950/50 text-slate-400">
                            <Package2 className="h-7 w-7" />
                          </div>
                        </div>
                      </DetailBlock>

                      <DetailBlock title="Account Info">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <InfoPair label="Created Date" value={formatDate(detailAccount.createdAt)} />
                          <InfoPair label="Assigned Agent" value={detailAccount.assignedToName || "Unassigned"} />
                          <InfoPair label="Expected Completion" value={formatDate(detailAccount.expectedCompletionDate)} />
                          <InfoPair label="Salesperson" value={salesperson?.label || "Not captured"} />
                          <InfoPair label="Payment Mode" value="Flexible" />
                          <InfoPair label="Source" value="Walk-in" />
                        </div>
                      </DetailBlock>

                      <DetailBlock title="Next Action">
                        <div className="rounded-2xl border border-white/10 bg-slate-950/55 p-4">
                          <div className="text-xl font-semibold text-white">
                            {activeDetail.summary.balance > 0 ? (isDueToday(detailAccount.expectedCompletionDate) ? "Payment due today" : "Continue collection") : "Ready for completion"}
                          </div>
                          <div className="mt-2 text-sm text-slate-400">
                            {activeDetail.summary.balance > 0 ? `${formatKes(activeDetail.summary.balance)} outstanding` : "No outstanding balance remaining on this account."}
                          </div>
                          <div className="mt-4 flex gap-3">
                            <button type="button" className={primaryButtonClass} onClick={() => setActionPanel("PAYMENT")}>
                              Record Payment
                            </button>
                            <button type="button" className={secondaryButtonClass} onClick={() => setActionPanel("FOLLOW_UP")}>
                              More Actions
                              <ChevronDown className="ml-2 h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </DetailBlock>

                      {activeDetail.summary.isFullyPaid && !detailAccount.convertedReceiptId && !detailAccount.convertedProjectId ? (
                        <DetailBlock title="Completion">
                          <div className="space-y-3 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                            <div className="text-sm font-semibold text-emerald-100">Fully paid and awaiting conversion</div>
                            <div className="text-sm text-emerald-200/80">Choose whether this account should enter the normal POS engine or the project workflow.</div>
                            <div className="flex flex-wrap gap-3">
                              <button type="button" className={primaryButtonClass} onClick={() => void handleConvertToPos()} disabled={isConvertingPos || isConvertingProject}>
                                {isConvertingPos ? "Converting..." : "Complete Through POS"}
                              </button>
                              <button type="button" className={secondaryButtonClass} onClick={() => void handleConvertToProject()} disabled={isConvertingPos || isConvertingProject}>
                                {isConvertingProject ? "Converting..." : "Complete As Project"}
                              </button>
                            </div>
                          </div>
                        </DetailBlock>
                      ) : null}

                      {detailAccount.convertedReceiptId ? (
                        <DetailBlock title="POS Conversion">
                          <Link href={`/receipts/${detailAccount.convertedReceiptId}`} className="inline-flex text-sm font-semibold text-blue-200 underline underline-offset-4">
                            View Final Receipt
                          </Link>
                        </DetailBlock>
                      ) : null}

                      {detailAccount.convertedProjectId ? (
                        <DetailBlock title="Project Conversion">
                          <Link href={`/admin/quotation-center/${detailAccount.convertedProjectId}`} className="inline-flex text-sm font-semibold text-blue-200 underline underline-offset-4">
                            Open Project Workflow
                          </Link>
                        </DetailBlock>
                      ) : null}
                    </>
                  ) : null}

                  {drawerTab === "PAYMENTS" ? (
                    <div className="space-y-3">
                      {activeDetail.payments.length === 0 ? <EmptyBlock text="No payments recorded yet." /> : null}
                      {activeDetail.payments.map((payment) => (
                        <div key={payment.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="text-lg font-semibold text-white">{formatKes(payment.amount)}</div>
                              <div className="mt-1 text-xs text-slate-400">
                                {payment.method} · {formatDateTime(payment.receivedAt)}
                                {payment.reference ? ` · Ref ${payment.reference}` : ""}
                              </div>
                            </div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusTone(payment.status)}`}>
                              {titleCase(payment.status)}
                            </span>
                          </div>
                          {payment.notes ? <div className="mt-3 text-sm text-slate-300">{payment.notes}</div> : null}
                          {payment.status === "SUCCESS" ? (
                            <button type="button" className="mt-4 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 transition hover:text-rose-100" onClick={() => void handleReversePayment(payment.id)}>
                              Reverse payment
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {drawerTab === "FOLLOW_UPS" ? (
                    <div className="space-y-4">
                      <DetailBlock title="Follow-ups">
                        <div className="space-y-3">
                          {activeDetail.followUps.length === 0 ? <EmptyBlock text="No follow-up tasks yet." /> : null}
                          {activeDetail.followUps.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                              <div className="text-sm font-semibold text-white">{titleCase(item.taskType)}</div>
                              <div className="mt-1 text-xs text-slate-400">
                                {formatDate(item.taskDate || item.createdAt)} · {item.assignedToName || "Unassigned"}
                              </div>
                              {item.outcome ? <div className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-blue-200">{item.outcome}</div> : null}
                              {item.notes ? <div className="mt-2 text-sm text-slate-300">{item.notes}</div> : null}
                            </div>
                          ))}
                        </div>
                      </DetailBlock>
                      <DetailBlock title="Promises To Pay">
                        <div className="space-y-3">
                          {activeDetail.promises.length === 0 ? <EmptyBlock text="No promises recorded yet." /> : null}
                          {activeDetail.promises.map((item) => (
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
                    </div>
                  ) : null}

                  {drawerTab === "TIMELINE" ? (
                    <div className="space-y-4">
                      <DetailBlock title="Recent Activity">
                        <div className="space-y-3">
                          {activeDetail.events.length === 0 ? <EmptyBlock text="No events recorded yet." /> : null}
                          {activeDetail.events.map((event) => (
                            <div key={event.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                              <div className="text-sm font-semibold text-white">{titleCase(event.eventType)}</div>
                              <div className="mt-1 text-xs text-slate-400">{formatDateTime(event.createdAt)}</div>
                            </div>
                          ))}
                        </div>
                      </DetailBlock>
                      <DetailBlock title="Reminders">
                        <div className="space-y-3">
                          {activeDetail.reminders.length === 0 ? <EmptyBlock text="No reminders generated yet." /> : null}
                          {activeDetail.reminders.map((item) => (
                            <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-950/45 p-4">
                              <div className="text-sm font-semibold text-white">{titleCase(item.reminderType)}</div>
                              <div className="mt-1 text-xs text-slate-400">
                                {formatDateTime(item.scheduledFor)} · {titleCase(item.status)}
                              </div>
                            </div>
                          ))}
                        </div>
                      </DetailBlock>
                    </div>
                  ) : null}

                  {actionPanel ? (
                    <DetailBlock title={actionPanel === "PAYMENT" ? "Record Payment" : actionPanel === "ASSIGN" ? "Assign Account" : actionPanel === "FOLLOW_UP" ? "Follow-Up Task" : actionPanel === "PROMISE" ? "Promise To Pay" : "Release Product"}>
                      {actionPanel === "PAYMENT" ? (
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
                            <button type="submit" className={primaryButtonClass} disabled={!selectedId || isSubmittingPayment}>
                              {isSubmittingPayment ? "Saving..." : "Record payment"}
                            </button>
                            <button type="button" className={secondaryButtonClass} onClick={() => setActionPanel(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {actionPanel === "ASSIGN" ? (
                        <form className="space-y-4" onSubmit={handleAssign}>
                          <SearchSelector label="Assigned agent" placeholder="Search customer service user" value={assignAgent} onChange={setAssignAgent} search={searchUsers} />
                          <div className="flex gap-3">
                            <button type="submit" className={primaryButtonClass} disabled={!selectedId || isSubmittingAssign}>
                              {isSubmittingAssign ? "Saving..." : assignAgent ? "Assign selected agent" : "Run round robin"}
                            </button>
                            <button type="button" className={secondaryButtonClass} onClick={() => setActionPanel(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {actionPanel === "FOLLOW_UP" ? (
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
                            <button type="submit" className={primaryButtonClass} disabled={!selectedId || isSubmittingFollowUp}>
                              {isSubmittingFollowUp ? "Saving..." : "Record Follow-Up"}
                            </button>
                            <button type="button" className={secondaryButtonClass} onClick={() => setActionPanel(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {actionPanel === "PROMISE" ? (
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
                            <button type="submit" className={primaryButtonClass} disabled={!selectedId || isSubmittingPromise}>
                              {isSubmittingPromise ? "Saving..." : "Record Promise"}
                            </button>
                            <button type="button" className={secondaryButtonClass} onClick={() => setActionPanel(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}

                      {actionPanel === "RELEASE" ? (
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
                            <button type="button" className={secondaryButtonClass} onClick={() => setActionPanel(null)}>
                              Cancel
                            </button>
                          </div>
                        </form>
                      ) : null}
                    </DetailBlock>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-3 border-t border-white/10 p-5">
                  <button type="button" className={secondaryButtonClass} onClick={() => setActionPanel("ASSIGN")}>
                    Assign
                  </button>
                  <button type="button" className={primaryButtonClass} onClick={() => setActionPanel("PAYMENT")}>
                    Record Payment
                  </button>
                  <button type="button" className={secondaryButtonClass} onClick={() => setActionPanel("FOLLOW_UP")}>
                    Follow-up
                  </button>
                  <button type="button" className={secondaryButtonClass} onClick={() => setActionPanel("PROMISE")}>
                    Promise
                  </button>
                  {(detailAccount.convertedReceiptId || detailAccount.convertedProjectId) && !detailAccount.fulfilledAt ? (
                    <button type="button" className="col-span-2 inline-flex items-center justify-center rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/15" onClick={() => setActionPanel("RELEASE")}>
                      Release Product
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>

      {showCreateModal ? (
        <ModalShell title="Create New Lipa Pole Pole" subtitle="Open a new LPP account and optionally capture the first deposit." onClose={() => setShowCreateModal(false)}>
          <form className="space-y-4" onSubmit={handleCreate}>
            <div className="grid gap-4 lg:grid-cols-2">
              <SearchSelector label="Customer" placeholder="Search customer by name, phone, or email" value={customer} onChange={setCustomer} search={searchCustomers} />
              <SearchSelector label="Product" placeholder="Search POS product" value={product} onChange={setProduct} search={searchProducts} />
              <SearchSelector label="Salesperson" placeholder="Search salesperson" value={salesperson} onChange={setSalesperson} search={searchUsers} />
              <SearchSelector label="Assigned agent" placeholder="Search assigned agent" value={assignedAgent} onChange={setAssignedAgent} search={searchUsers} />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              <Field label="Quantity">
                <input className={inputClass} value={createForm.quantity} onChange={(event) => setCreateForm((current) => ({ ...current, quantity: event.target.value }))} />
              </Field>
              <Field label="Agreed unit price">
                <input className={inputClass} value={createForm.agreedUnitPrice} onChange={(event) => setCreateForm((current) => ({ ...current, agreedUnitPrice: event.target.value }))} placeholder="15000" />
              </Field>
              <Field label="Agreed total override">
                <input className={inputClass} value={createForm.agreedTotal} onChange={(event) => setCreateForm((current) => ({ ...current, agreedTotal: event.target.value }))} placeholder="Optional" />
              </Field>
              <Field label="Expected completion">
                <input type="date" className={inputClass} value={createForm.expectedCompletionDate} onChange={(event) => setCreateForm((current) => ({ ...current, expectedCompletionDate: event.target.value }))} />
              </Field>
              <Field label="Payment mode">
                <select className={inputClass} value={createForm.paymentMode} onChange={(event) => setCreateForm((current) => ({ ...current, paymentMode: event.target.value }))}>
                  <option value="FLEXIBLE">Flexible</option>
                  <option value="SCHEDULED">Scheduled</option>
                </select>
              </Field>
              <Field label="Reservation mode">
                <select className={inputClass} value={createForm.reservationMode} onChange={(event) => setCreateForm((current) => ({ ...current, reservationMode: event.target.value }))}>
                  <option value="NONE">None</option>
                  <option value="SOFT_RESERVE">Soft reserve</option>
                  <option value="HARD_RESERVE">Hard reserve</option>
                </select>
              </Field>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Source">
                <input className={inputClass} value={createForm.source} onChange={(event) => setCreateForm((current) => ({ ...current, source: event.target.value }))} placeholder="Walk-in, referral, call center..." />
              </Field>
              <Field label="Notes">
                <textarea className={textareaClass} value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>
            </div>

            <div className="rounded-[24px] border border-white/10 bg-slate-950/45 p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Initial payment</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Amount">
                  <input className={inputClass} value={createForm.initialPaymentAmount} onChange={(event) => setCreateForm((current) => ({ ...current, initialPaymentAmount: event.target.value }))} placeholder="Optional" />
                </Field>
                <Field label="Method">
                  <select className={inputClass} value={createForm.initialPaymentMethod} onChange={(event) => setCreateForm((current) => ({ ...current, initialPaymentMethod: event.target.value }))}>
                    <option value="MPESA">M-Pesa</option>
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bank</option>
                    <option value="CARD">Card</option>
                    <option value="OTHER">Other</option>
                  </select>
                </Field>
                <Field label="Reference">
                  <input className={inputClass} value={createForm.initialPaymentReference} onChange={(event) => setCreateForm((current) => ({ ...current, initialPaymentReference: event.target.value }))} />
                </Field>
                <Field label="Payment notes">
                  <input className={inputClass} value={createForm.initialPaymentNotes} onChange={(event) => setCreateForm((current) => ({ ...current, initialPaymentNotes: event.target.value }))} />
                </Field>
              </div>
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
    </main>
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

function DrawerMetric({ label, value, emphasis }: { label: string; value: string; emphasis?: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${emphasis || "text-white"}`}>{value}</div>
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-[24px] border border-white/10 bg-slate-950/35 p-4">
      <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-500">{title}</div>
      {children}
    </section>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1 text-white">{value}</div>
    </div>
  );
}

function EmptyBlock({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/35 px-4 py-6 text-sm text-slate-500">{text}</div>;
}

function IconButton({ icon }: { icon: ReactNode }) {
  return <button type="button" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-slate-950/60 text-slate-400 transition hover:border-white/20 hover:text-white">{icon}</button>;
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
