"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type FormEvent, type ReactNode } from "react";

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

const inputClass =
  "rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-400/50";
const textareaClass = `${inputClass} min-h-[108px] resize-y`;
const primaryButtonClass =
  "rounded-2xl border border-cyan-400/30 bg-cyan-500/15 px-4 py-3 text-sm font-semibold text-cyan-100 transition hover:border-cyan-300 hover:bg-cyan-500/25 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryButtonClass =
  "rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-sm font-semibold text-slate-100 transition hover:border-white/20 hover:bg-white/[0.06] disabled:cursor-not-allowed disabled:opacity-50";

function formatKes(value: number) {
  return `KES ${Math.round(Number(value || 0)).toLocaleString("en-KE")}`;
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

function progressTone(value: number) {
  if (value >= 100) return "bg-emerald-500";
  if (value >= 70) return "bg-cyan-500";
  if (value >= 40) return "bg-amber-500";
  return "bg-rose-500";
}

function statusTone(status: string) {
  if (["AWAITING_CONVERSION", "CONVERTED_TO_POS", "CONVERTED_TO_PROJECT", "CLOSED"].includes(status)) {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-200";
  }
  if (["OVERDUE", "CANCELLED"].includes(status)) {
    return "border-rose-500/30 bg-rose-500/10 text-rose-200";
  }
  if (["DUE_SOON"].includes(status)) {
    return "border-amber-500/30 bg-amber-500/10 text-amber-200";
  }
  return "border-cyan-500/30 bg-cyan-500/10 text-cyan-100";
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
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
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
  const [isPending, startTransition] = useTransition();
  const [isSubmittingCreate, setIsSubmittingCreate] = useState(false);
  const [isSubmittingAssign, setIsSubmittingAssign] = useState(false);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);
  const [isConvertingPos, setIsConvertingPos] = useState(false);
  const [isConvertingProject, setIsConvertingProject] = useState(false);
  const [isReleasing, setIsReleasing] = useState(false);
  const [customer, setCustomer] = useState<SearchOption | null>(null);
  const [product, setProduct] = useState<SearchOption | null>(null);
  const [salesperson, setSalesperson] = useState<SearchOption | null>(null);
  const [assignedAgent, setAssignedAgent] = useState<SearchOption | null>(null);
  const [assignAgent, setAssignAgent] = useState<SearchOption | null>(null);
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
  const [isSubmittingFollowUp, setIsSubmittingFollowUp] = useState(false);
  const [isSubmittingPromise, setIsSubmittingPromise] = useState(false);

  useEffect(() => {
    setItems(initialItems);
  }, [initialItems]);

  useEffect(() => {
    setDetail(initialDetail);
    setSelectedId(initialDetail?.account.id ?? initialItems[0]?.id ?? "");
  }, [initialDetail, initialItems]);

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
    setItems(data.items || []);
    const targetId = nextSelectedId || selectedId || data.items?.[0]?.id || "";
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

  async function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBanner(null);
    startTransition(() => {
      void refreshList().catch(showError);
    });
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
    } catch (error) {
      showError(error);
    } finally {
      setIsSubmittingPromise(false);
    }
  }

  const activeCount = items.filter((item) => ["ACTIVE", "DUE_SOON", "OVERDUE"].includes(item.status)).length;
  const overdueCount = items.filter((item) => item.status === "OVERDUE").length;
  const outstandingBalance = items.reduce((sum, item) => sum + Number(item.balance ?? 0), 0);

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-6 text-slate-100 lg:px-8 xl:px-10">
      <div className="mx-auto max-w-[1700px] space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Collections Desk</div>
            <h1 className="mt-2 text-3xl font-semibold text-white">Lipa Pole Pole</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Create accounts, assign handlers, collect installment payments, and reverse incorrect entries before conversion.
            </p>
          </div>
          <Link
            href="/admin/receipts"
            className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-100 transition hover:border-cyan-400/40 hover:text-cyan-100"
          >
            Receipts
          </Link>
        </div>

        {banner ? <Banner tone={banner.tone} text={banner.text} /> : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Accounts in view" value={String(items.length)} sub="Current filtered LPP accounts" />
          <StatCard label="Active / due" value={String(activeCount)} sub="Accounts still collecting payments" />
          <StatCard label="Overdue" value={String(overdueCount)} sub="Accounts past expected completion date" />
          <StatCard label="Outstanding" value={formatKes(outstandingBalance)} sub="Live unpaid balance across current results" />
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(360px,0.9fr)_minmax(0,1.2fr)_minmax(360px,0.9fr)]">
          <Panel title="Create Account" description="Open a new LPP account and optionally capture the first deposit.">
            <form className="space-y-4" onSubmit={handleCreate}>
              <SearchSelector label="Customer" placeholder="Search customer by name, phone, or email" value={customer} onChange={setCustomer} search={searchCustomers} />
              <SearchSelector label="Product" placeholder="Search POS product" value={product} onChange={setProduct} search={searchProducts} />
              <SearchSelector label="Salesperson" placeholder="Search salesperson" value={salesperson} onChange={setSalesperson} search={searchUsers} />
              <SearchSelector label="Assigned agent" placeholder="Search assigned agent" value={assignedAgent} onChange={setAssignedAgent} search={searchUsers} />

              <div className="grid gap-3 sm:grid-cols-2">
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

              <Field label="Source">
                <input className={inputClass} value={createForm.source} onChange={(event) => setCreateForm((current) => ({ ...current, source: event.target.value }))} placeholder="Walk-in, referral, call center..." />
              </Field>
              <Field label="Notes">
                <textarea className={textareaClass} value={createForm.notes} onChange={(event) => setCreateForm((current) => ({ ...current, notes: event.target.value }))} />
              </Field>

              <div className="rounded-[24px] border border-white/10 bg-white/[0.02] p-4">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Initial payment</div>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
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

              <button type="submit" className={primaryButtonClass} disabled={isSubmittingCreate}>
                {isSubmittingCreate ? "Creating..." : "Create account"}
              </button>
            </form>
          </Panel>

          <div className="space-y-6">
            <Panel title="Accounts" description="Filter and open accounts for payment operations.">
              <form className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto]" onSubmit={handleFilterSubmit}>
                <input
                  type="text"
                  value={q}
                  onChange={(event) => setQ(event.target.value)}
                  placeholder="Search by LPP ref, customer, phone, or product"
                  className={inputClass}
                />
                <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
                  {STATUSES.map((item) => (
                    <option key={item} value={item}>
                      {item === "ALL" ? "All statuses" : item.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
                <button type="submit" className={secondaryButtonClass} disabled={isPending}>
                  {isPending ? "Loading..." : "Apply filters"}
                </button>
              </form>

              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white/[0.03] text-left text-xs uppercase tracking-[0.18em] text-slate-400">
                    <tr>
                      <th className="px-4 py-3">LPP</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Product</th>
                      <th className="px-4 py-3 text-right">Balance</th>
                      <th className="px-4 py-3">Assigned</th>
                      <th className="px-4 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                          No Lipa Pole Pole accounts found for the current filters.
                        </td>
                      </tr>
                    ) : null}
                    {items.map((item) => (
                      <tr
                        key={item.id}
                        className={`cursor-pointer border-t border-white/5 transition hover:bg-white/[0.03] ${selectedId === item.id ? "bg-cyan-500/5" : ""}`}
                        onClick={() => {
                          setBanner(null);
                          startTransition(() => {
                            void loadDetail(item.id).catch(showError);
                          });
                        }}
                      >
                        <td className="px-4 py-3 font-semibold text-cyan-100">{item.reference}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-white">{item.customerName || "Unknown customer"}</div>
                          <div className="text-xs text-slate-500">{item.customerPhone || "No phone"}</div>
                        </td>
                        <td className="px-4 py-3 text-slate-200">{item.productName || "No product"}</td>
                        <td className="px-4 py-3 text-right text-amber-200">{formatKes(item.balance)}</td>
                        <td className="px-4 py-3 text-slate-300">{item.assignedToName || "Unassigned"}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(item.status)}`}>
                            {item.status.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>

            <Panel title="Account Detail" description="Selected account summary, payment history, and event timeline.">
              {!detail ? (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] p-8 text-center text-sm text-slate-500">
                  Select an account to view its detail.
                </div>
              ) : (
                <div className="space-y-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">{detail.account.reference}</div>
                      <h2 className="mt-2 text-2xl font-semibold text-white">{detail.account.customerName || "Unknown customer"}</h2>
                      <div className="mt-1 text-sm text-slate-400">
                        {detail.account.customerPhone || "No phone"} · {detail.account.productName || "No product selected"}
                      </div>
                    </div>
                    <span className={`inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${statusTone(detail.account.status)}`}>
                      {detail.account.status.replace(/_/g, " ")}
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard label="Agreed amount" value={formatKes(detail.summary.agreedTotal)} />
                    <MetricCard label="Total paid" value={formatKes(detail.summary.totalPaid)} tone="text-emerald-300" />
                    <MetricCard label="Balance" value={formatKes(detail.summary.balance)} tone="text-amber-200" />
                    <MetricCard label="Progress" value={`${detail.summary.percentagePaid.toFixed(2)}%`} />
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payment progress</div>
                    <div className="h-3 overflow-hidden rounded-full bg-white/10">
                      <div className={`h-full ${progressTone(detail.summary.percentagePaid)}`} style={{ width: `${Math.max(0, Math.min(100, detail.summary.percentagePaid))}%` }} />
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard label="Assigned to" value={detail.account.assignedToName || "Unassigned"} />
                    <MetricCard label="Due date" value={formatDate(detail.account.expectedCompletionDate)} />
                    <MetricCard label="Created" value={formatDate(detail.account.createdAt)} />
                    <MetricCard label="Completed" value={formatDate(detail.account.completedAt)} />
                  </div>

                  {detail.summary.isFullyPaid && !detail.account.convertedReceiptId && !detail.account.convertedProjectId ? (
                    <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <div className="text-sm font-semibold text-emerald-100">Fully paid and awaiting conversion</div>
                      <div className="mt-1 text-sm text-emerald-200/80">
                        Choose whether this account should enter the normal POS engine or the project workflow.
                      </div>
                      <div className="mt-4 flex flex-wrap gap-3">
                        <button type="button" className={primaryButtonClass} onClick={() => void handleConvertToPos()} disabled={isConvertingPos || isConvertingProject}>
                          {isConvertingPos ? "Converting..." : "Complete Through POS"}
                        </button>
                        <button type="button" className={secondaryButtonClass} onClick={() => void handleConvertToProject()} disabled={isConvertingPos || isConvertingProject}>
                          {isConvertingProject ? "Converting..." : "Complete As Project"}
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {detail.account.convertedReceiptId ? (
                    <div className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/10 p-4">
                      <div className="text-sm font-semibold text-cyan-100">Converted to POS</div>
                      <div className="mt-2 text-sm text-cyan-200/80">
                        Final receipt is linked to this LPP account.
                      </div>
                      <Link href={`/receipts/${detail.account.convertedReceiptId}`} className="mt-3 inline-flex text-sm font-semibold text-cyan-100 underline underline-offset-4">
                        View Final Receipt
                      </Link>
                    </div>
                  ) : null}

                  {detail.account.convertedProjectId ? (
                    <div className="rounded-[24px] border border-cyan-500/20 bg-cyan-500/10 p-4">
                      <div className="text-sm font-semibold text-cyan-100">Converted to Project</div>
                      <div className="mt-2 text-sm text-cyan-200/80">
                        Project workflow is linked to this LPP account.
                      </div>
                      <Link href={`/admin/quotation-center/${detail.account.convertedProjectId}`} className="mt-3 inline-flex text-sm font-semibold text-cyan-100 underline underline-offset-4">
                        Open Project Workflow
                      </Link>
                    </div>
                  ) : null}

                  {(detail.account.convertedReceiptId || detail.account.convertedProjectId) && !detail.account.fulfilledAt ? (
                    <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/10 p-4">
                      <div className="text-sm font-semibold text-amber-100">Ready for release</div>
                      <div className="mt-1 text-sm text-amber-200/80">
                        Record the final collection, delivery, or installation once the linked transaction is complete.
                      </div>
                      <form className="mt-4 grid gap-3" onSubmit={handleRelease}>
                        <Field label="Fulfillment method">
                          <select className={inputClass} value={releaseForm.fulfillmentMethod} onChange={(event) => setReleaseForm((current) => ({ ...current, fulfillmentMethod: event.target.value }))}>
                            <option value="Customer Collection">Customer Collection</option>
                            <option value="Delivery">Delivery</option>
                            <option value="Installation">Installation</option>
                            <option value="Courier">Courier</option>
                            <option value="Other">Other</option>
                          </select>
                        </Field>
                        <div className="grid gap-3 sm:grid-cols-2">
                          <Field label="Collector / receiver">
                            <input className={inputClass} value={releaseForm.collectorName} onChange={(event) => setReleaseForm((current) => ({ ...current, collectorName: event.target.value }))} placeholder="Customer or authorized receiver" />
                          </Field>
                          <Field label="ID / reference">
                            <input className={inputClass} value={releaseForm.collectorReference} onChange={(event) => setReleaseForm((current) => ({ ...current, collectorReference: event.target.value }))} placeholder="National ID, phone, delivery ref..." />
                          </Field>
                        </div>
                        <Field label="Release notes">
                          <textarea className={textareaClass} value={releaseForm.notes} onChange={(event) => setReleaseForm((current) => ({ ...current, notes: event.target.value }))} />
                        </Field>
                        <button type="submit" className={primaryButtonClass} disabled={isReleasing}>
                          {isReleasing ? "Saving..." : "Release Product"}
                        </button>
                      </form>
                    </div>
                  ) : null}

                  {detail.account.fulfilledAt ? (
                    <div className="rounded-[24px] border border-emerald-500/20 bg-emerald-500/10 p-4">
                      <div className="text-sm font-semibold text-emerald-100">Fulfillment recorded</div>
                      <div className="mt-2 grid gap-3 sm:grid-cols-3">
                        <MetricCard label="Released on" value={formatDate(detail.account.fulfilledAt)} />
                        <MetricCard label="Method" value={detail.account.fulfillmentMethod || "Not set"} />
                        <MetricCard label="Released by" value={detail.account.fulfilledByName || "Recorded"} />
                      </div>
                    </div>
                  ) : null}

                  <div className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Payments</div>
                      {detail.payments.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-500">No payments recorded yet.</div>
                      ) : null}
                      {detail.payments.map((payment) => (
                        <div key={payment.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <div className="font-semibold text-white">{formatKes(payment.amount)}</div>
                              <div className="mt-1 text-xs text-slate-400">
                                {payment.method} · {formatDate(payment.receivedAt)}{payment.reference ? ` · Ref ${payment.reference}` : ""}
                              </div>
                            </div>
                            <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${statusTone(payment.status)}`}>
                              {payment.status}
                            </span>
                          </div>
                          {payment.notes ? <div className="mt-2 text-sm text-slate-300">{payment.notes}</div> : null}
                          {payment.status === "SUCCESS" ? (
                            <button type="button" className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-rose-200 transition hover:text-rose-100" onClick={() => void handleReversePayment(payment.id)}>
                              Reverse payment
                            </button>
                          ) : null}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Timeline</div>
                      {detail.events.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-500">No events recorded yet.</div>
                      ) : null}
                      {detail.events.map((event) => (
                        <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="text-sm font-semibold text-white">{event.eventType.replace(/_/g, " ")}</div>
                          <div className="mt-1 text-xs text-slate-400">{formatDate(event.createdAt)}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid gap-4 xl:grid-cols-3">
                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Follow-ups</div>
                      {detail.followUps.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-500">No follow-up tasks yet.</div>
                      ) : null}
                      {detail.followUps.slice(0, 5).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="text-sm font-semibold text-white">{item.taskType.replace(/_/g, " ")}</div>
                          <div className="mt-1 text-xs text-slate-400">
                            {formatDate(item.taskDate || item.createdAt)} · {item.assignedToName || "Unassigned"}
                          </div>
                          {item.outcome ? <div className="mt-2 text-xs uppercase tracking-[0.16em] text-cyan-200">{item.outcome}</div> : null}
                          {item.notes ? <div className="mt-2 text-sm text-slate-300">{item.notes}</div> : null}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Promises</div>
                      {detail.promises.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-500">No promises recorded yet.</div>
                      ) : null}
                      {detail.promises.slice(0, 5).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="text-sm font-semibold text-white">{formatKes(item.promiseAmount)}</div>
                          <div className="mt-1 text-xs text-slate-400">{formatDate(item.promiseDate)} · {item.status.replace(/_/g, " ")}</div>
                          {item.notes ? <div className="mt-2 text-sm text-slate-300">{item.notes}</div> : null}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-3">
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reminders</div>
                      {detail.reminders.length === 0 ? (
                        <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 text-sm text-slate-500">No reminders generated yet.</div>
                      ) : null}
                      {detail.reminders.slice(0, 5).map((item) => (
                        <div key={item.id} className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                          <div className="text-sm font-semibold text-white">{item.reminderType.replace(/_/g, " ")}</div>
                          <div className="mt-1 text-xs text-slate-400">{formatDate(item.scheduledFor)} · {item.status}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </Panel>
          </div>

          <div className="space-y-6">
            <Panel title="Assign / Reassign" description="Set a specific owner or leave blank for round-robin routing.">
              <form className="space-y-4" onSubmit={handleAssign}>
                <SearchSelector label="Assigned agent" placeholder="Search customer service user" value={assignAgent} onChange={setAssignAgent} search={searchUsers} />
                <button type="submit" className={primaryButtonClass} disabled={!selectedId || isSubmittingAssign}>
                  {isSubmittingAssign ? "Saving..." : assignAgent ? "Assign selected agent" : "Run round robin"}
                </button>
              </form>
            </Panel>

            <Panel title="Record Payment" description="Capture a new installment against the selected account.">
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
                <button type="submit" className={primaryButtonClass} disabled={!selectedId || isSubmittingPayment}>
                  {isSubmittingPayment ? "Saving..." : "Record payment"}
                </button>
              </form>
            </Panel>

            <Panel title="Follow-Up Task" description="Create a manual follow-up task or outcome for the selected account.">
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
                <button type="submit" className={primaryButtonClass} disabled={!selectedId || isSubmittingFollowUp}>
                  {isSubmittingFollowUp ? "Saving..." : "Record Follow-Up"}
                </button>
              </form>
            </Panel>

            <Panel title="Promise To Pay" description="Record a promised amount and date for collection follow-up.">
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
                <button type="submit" className={primaryButtonClass} disabled={!selectedId || isSubmittingPromise}>
                  {isSubmittingPromise ? "Saving..." : "Record Promise"}
                </button>
              </form>
            </Panel>
          </div>
        </div>
      </div>
    </main>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-[30px] border border-white/10 bg-slate-900/70 p-5">
      <div className="border-b border-white/10 pb-4">
        <div className="text-lg font-semibold text-white">{title}</div>
        <div className="mt-1 text-sm text-slate-400">{description}</div>
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-[26px] border border-white/10 bg-white/[0.03] p-5">
      <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</div>
      <div className="mt-3 text-2xl font-semibold text-white">{value}</div>
      <div className="mt-2 text-sm text-slate-500">{sub}</div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className={`mt-2 text-xl font-semibold ${tone || "text-white"}`}>{value}</div>
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

function Banner({ tone, text }: { tone: "success" | "error"; text: string }) {
  return (
    <div
      className={`rounded-2xl border px-4 py-3 text-sm ${
        tone === "success"
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
          : "border-rose-500/30 bg-rose-500/10 text-rose-100"
      }`}
    >
      {text}
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
          if (!cancelled) {
            setOptions(items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setOptions([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
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
        <div className="flex items-center justify-between rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3">
          <div>
            <div className="text-sm font-semibold text-cyan-100">{value.label}</div>
            {value.hint ? <div className="text-xs text-cyan-200/70">{value.hint}</div> : null}
          </div>
          <button type="button" className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-100" onClick={() => onChange(null)}>
            Clear
          </button>
        </div>
      ) : null}
      {loading ? <div className="text-xs text-slate-500">Searching...</div> : null}
      {!loading && options.length > 0 ? (
        <div className="max-h-48 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-slate-950/80 p-2">
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
