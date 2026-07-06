"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, ExternalLink, Loader2, Plus, RefreshCcw, Trash2 } from "lucide-react";
import type {
  ManualQuotationCreateInput,
  QuoteContactMethod,
  QuoteContactTime,
  QuoteInstallationStatus,
  QuoteRequestResponseInput,
  QuoteProjectType,
  QuoteRequestStatus,
  QuoteUrgency,
  SerializedQuoteRequest,
  SerializedQuotationTemplate,
} from "@/lib/quoteRequests";
import {
  formatQuoteCurrency,
  getQuotePaymentMethodLabel,
  getQuotePaymentTermsLabel,
  parseStoredQuoteProposal,
  PAYMENT_METHOD_DETAILS,
  QUOTE_PAYMENT_METHODS,
  QUOTE_PAYMENT_TERMS,
  type QuotePaymentMethod,
  type QuotePaymentTerms,
} from "@/lib/quoteProposal";
import {
  isCarriedForwardPendingItem,
  isOpenQuotationStatus,
  shouldShowPendingWorkItem,
} from "@/lib/operationsWorkQueue";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";

type QuoteRequestStatusFilter = "ALL" | QuoteRequestStatus;

type Props = {
  apiBasePath: string;
  apiQueryParams?: Record<string, string | null | undefined>;
  defaultStatusFilter?: QuoteRequestStatusFilter;
  filterStorageKey?: string;
  deskTitle?: string;
  deskDescription?: string;
  emptyMessage?: string;
  q?: string;
  start?: string;
  end?: string;
  compactMode?: boolean;
  createApiPath?: string;
  templateApiPath?: string;
  enableCreate?: boolean;
  allowTemplateManager?: boolean;
};

const QUOTE_REQUEST_STATUSES: QuoteRequestStatus[] = [
  "DRAFT",
  "NEW",
  "PENDING_APPROVAL",
  "APPROVED",
  "CONTACTED",
  "SENT",
  "VIEWED",
  "QUOTED",
  "FOLLOW_UP",
  "ACCEPTED",
  "REJECTED",
  "CONVERTED",
  "CLOSED",
  "EXPIRED",
];

const STATUS_OPTIONS: QuoteRequestStatusFilter[] = ["ALL", ...QUOTE_REQUEST_STATUSES];

const PROJECT_TYPE_OPTIONS: QuoteProjectType[] = [
  "SOLAR_HOME_SYSTEM",
  "SOLAR_WATER_PUMP",
  "SOLAR_WATER_HEATER",
  "BOREHOLE_SOLAR_SYSTEM",
  "COMMERCIAL_SOLAR_SYSTEM",
  "CCTV_PLUS_SOLAR",
  "STREET_LIGHTS",
  "OTHER",
];

const CONTACT_METHOD_OPTIONS: QuoteContactMethod[] = ["PHONE_CALL", "WHATSAPP", "EMAIL"];
const CONTACT_TIME_OPTIONS: QuoteContactTime[] = ["ANYTIME", "MORNING", "AFTERNOON", "EVENING"];
const URGENCY_OPTIONS: QuoteUrgency[] = ["TODAY", "THIS_WEEK", "THIS_MONTH", "JUST_RESEARCHING"];
const INSTALLATION_OPTIONS: QuoteInstallationStatus[] = [
  "NEW_INSTALLATION",
  "UPGRADE_EXISTING_SYSTEM",
  "REPAIR_OR_REPLACEMENT",
];

function buildApiUrl(
  apiBasePath: string,
  apiQueryParams: Props["apiQueryParams"],
  pathSuffix = "",
  extraParams?: Record<string, string>,
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(apiQueryParams ?? {})) {
    if (value) params.set(key, value);
  }
  for (const [key, value] of Object.entries(extraParams ?? {})) {
    if (value) params.set(key, value);
  }
  const suffix = pathSuffix ? `/${pathSuffix.replace(/^\/+/, "")}` : "";
  const queryString = params.toString();
  return `${apiBasePath}${suffix}${queryString ? `?${queryString}` : ""}`;
}

function formatDateTime(value: string | null) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-KE");
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ");
}

function isWithinRange(value: string | null | undefined, start?: string, end?: string) {
  if (!value) return false;
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return false;
  const min = start ? new Date(`${start}T00:00:00`).getTime() : -Infinity;
  const max = end ? new Date(`${end}T23:59:59.999`).getTime() : Infinity;
  return timestamp >= min && timestamp <= max;
}

function isCarriedForwardQuote(
  request: Pick<SerializedQuoteRequest, "status" | "createdAt">,
  start?: string,
) {
  if (!start) return false;
  return isCarriedForwardPendingItem({
    status: request.status,
    createdAt: request.createdAt,
    periodStart: new Date(`${start}T00:00:00`),
  });
}

function buildCustomerProfileHref(
  request: Pick<
    SerializedQuoteRequest,
    "customerUserId" | "customerPhone" | "customerEmail" | "customerName"
  >,
  impersonateId?: string | null,
) {
  return buildAdminCustomerProfileHref({
    customerUserId: request.customerUserId,
    phone: request.customerPhone,
    email: request.customerEmail,
    displayName: request.customerName,
    impersonateId,
  });
}

type QuoteItemDraft = {
  itemName: string;
  quantity: string;
  unitPrice: string;
};

type QuoteDeskFormState = {
  status: QuoteRequestStatus;
  quoteTitle: string;
  quoteMessage: string;
  quoteItems: QuoteItemDraft[];
  paymentMethod: QuotePaymentMethod | "";
  paymentTerms: QuotePaymentTerms;
  depositAmount: string;
  balanceAmount: string;
  followUpNotes: string;
  sendEmail: boolean;
  sendSms: boolean;
};

type CreateQuotationMode = "manual" | "template";

type CreateQuotationDraft = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerLocation: string;
  county: string;
  town: string;
  specificLocation: string;
  projectType: QuoteProjectType;
  preferredContactMethod: QuoteContactMethod;
  bestTimeToContact: QuoteContactTime;
  urgency: QuoteUrgency;
  installationStatus: QuoteInstallationStatus;
  preferredProducts: string;
  notes: string;
  quoteTitle: string;
  quoteMessage: string;
  templateId: string;
};

function createEmptyQuoteItem(): QuoteItemDraft {
  return {
    itemName: "",
    quantity: "1",
    unitPrice: "",
  };
}

function createDefaultFormState(status: QuoteRequestStatus): QuoteDeskFormState {
  return {
    status,
    quoteTitle: "",
    quoteMessage: "",
    quoteItems: [createEmptyQuoteItem()],
    paymentMethod: "",
    paymentTerms: "FULL_PAYMENT",
    depositAmount: "",
    balanceAmount: "",
    followUpNotes: "",
    sendEmail: true,
    sendSms: true,
  };
}

function createDefaultQuotationDraft(): CreateQuotationDraft {
  return {
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    customerLocation: "",
    county: "",
    town: "",
    specificLocation: "",
    projectType: "SOLAR_HOME_SYSTEM",
    preferredContactMethod: "PHONE_CALL",
    bestTimeToContact: "ANYTIME",
    urgency: "THIS_WEEK",
    installationStatus: "NEW_INSTALLATION",
    preferredProducts: "",
    notes: "",
    quoteTitle: "",
    quoteMessage: "",
    templateId: "",
  };
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildQuoteRequestPayload(formState: QuoteDeskFormState): QuoteRequestResponseInput {
  const quoteItems = formState.quoteItems
    .map((item) => ({
      itemName: item.itemName.trim(),
      quantity: parseMoneyInput(item.quantity),
      unitPrice: parseMoneyInput(item.unitPrice),
    }))
    .filter((item) => item.itemName.length > 0);

  return {
    status: formState.status,
    quoteTitle: formState.quoteTitle.trim() || undefined,
    quoteMessage: formState.quoteMessage.trim() || undefined,
    quoteItems,
    paymentMethod: formState.paymentMethod || undefined,
    paymentTerms: formState.paymentTerms,
    depositAmount:
      formState.paymentTerms === "DEPOSIT_AND_BALANCE" && formState.depositAmount.trim()
        ? parseMoneyInput(formState.depositAmount)
        : undefined,
    balanceAmount:
      formState.paymentTerms === "DEPOSIT_AND_BALANCE" && formState.balanceAmount.trim()
        ? parseMoneyInput(formState.balanceAmount)
        : undefined,
    followUpNotes: formState.followUpNotes.trim() || undefined,
    sendEmail: formState.sendEmail,
    sendSms: formState.sendSms,
  };
}

function formatProjectType(value: QuoteProjectType | string | null | undefined) {
  if (!value) return "-";
  return value
    .replace(/PLUS/g, "PLUS")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace("Cctv", "CCTV");
}

function formatContactMethod(value: QuoteContactMethod | string | null | undefined) {
  if (!value) return "-";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatContactTime(value: QuoteContactTime | string | null | undefined) {
  if (!value) return "-";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatUrgency(value: QuoteUrgency | string | null | undefined) {
  if (!value) return "-";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatInstallationStatus(value: QuoteInstallationStatus | string | null | undefined) {
  if (!value) return "-";
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function renderAnswerValue(value: unknown): string {
  if (typeof value === "string") return value.trim() || "-";
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    const values = value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry)))
      .filter(Boolean);
    return values.length ? values.join(", ") : "-";
  }
  if (value && typeof value === "object") {
    const objectEntries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== null && entry !== undefined && `${entry}`.trim() !== "");
    return objectEntries.length
      ? objectEntries.map(([key, entry]) => `${key}: ${renderAnswerValue(entry)}`).join(" | ")
      : "-";
  }
  return "-";
}

function renderAnswerBlock(title: string, answers?: Record<string, unknown> | null) {
  if (!answers) return null;
  const entries = Object.entries(answers).filter(([, value]) => {
    if (value === null || value === undefined) return false;
    if (typeof value === "string") return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
    return true;
  });

  if (!entries.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
        {title}
      </div>
      <div className="mt-3 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
        {entries.map(([key, value]) => (
          <div key={key} className="min-w-0">
            <div className="font-semibold text-white">
              {key.replace(/([A-Z])/g, " $1").replace(/^./, (letter) => letter.toUpperCase())}
            </div>
            <div className="mt-1 whitespace-pre-wrap break-words text-slate-300">
              {renderAnswerValue(value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuotationRequestsDeskClient({
  apiBasePath,
  apiQueryParams,
  defaultStatusFilter = "NEW",
  filterStorageKey,
  deskTitle = "Assigned quotation requests",
  deskDescription = "Review customer quote requests, recommend products, and notify customers by email or SMS.",
  emptyMessage = "No quotation requests assigned right now.",
  q = "",
  start,
  end,
  compactMode = false,
  createApiPath = "/api/attendant/quotation-center/create",
  templateApiPath = "/api/attendant/quotation-center/templates",
  enableCreate = true,
  allowTemplateManager = false,
}: Props) {
  const [requests, setRequests] = useState<SerializedQuoteRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<QuoteRequestStatusFilter>(defaultStatusFilter);
  const [query, setQuery] = useState(q);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const [createMode, setCreateMode] = useState<CreateQuotationMode>("manual");
  const [createDraft, setCreateDraft] = useState<CreateQuotationDraft>(createDefaultQuotationDraft());
  const [templates, setTemplates] = useState<SerializedQuotationTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [draftOpening, setDraftOpening] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const impersonateId = apiQueryParams?.impersonateId ?? null;

  const expandedRequest = useMemo(
    () => requests.find((request) => request.id === expandedId) ?? null,
    [requests, expandedId],
  );

  const initialResponseStatus = defaultStatusFilter === "ALL" ? "CONTACTED" : defaultStatusFilter;
  const [formState, setFormState] = useState<QuoteDeskFormState>(createDefaultFormState(initialResponseStatus));

  const quoteItemsPreview = useMemo(() => {
    return formState.quoteItems.map((item) => {
      const quantity = parseMoneyInput(item.quantity);
      const unitPrice = parseMoneyInput(item.unitPrice);
      const lineTotal = quantity * unitPrice;
      return {
        ...item,
        quantityValue: quantity,
        unitPriceValue: unitPrice,
        lineTotal,
      };
    });
  }, [formState.quoteItems]);

  const quoteSubtotalPreview = useMemo(
    () => quoteItemsPreview.reduce((sum, item) => sum + item.lineTotal, 0),
    [quoteItemsPreview],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter((request) => {
        const outsideSelectedWindow =
          !isWithinRange(request.updatedAt || request.createdAt, start, end) &&
          !isWithinRange(request.createdAt, start, end);
        const shouldKeepVisible =
          isOpenQuotationStatus(request.status) &&
          shouldShowPendingWorkItem({
            status: request.status,
            createdAt: request.createdAt,
            updatedAt: request.updatedAt,
            periodStart: start ? new Date(`${start}T00:00:00`) : new Date(-8640000000000000),
            periodEnd: end ? new Date(`${end}T23:59:59.999`) : new Date(8640000000000000),
          });
        if (outsideSelectedWindow && !shouldKeepVisible) {
          return false;
        }
        if (!query.trim()) return true;
        const value = query.trim().toLowerCase();
        return [
          request.quoteRef,
          request.customerName,
          request.customerPhone,
          request.customerEmail || "",
          request.customerLocation || "",
          request.town || "",
          request.county || "",
        ].some((entry) => entry.toLowerCase().includes(value));
      }),
    [end, query, requests, start],
  );

  const quoteBalancePreview = useMemo(() => {
    if (formState.paymentTerms !== "DEPOSIT_AND_BALANCE") return null;
    const depositAmount = parseMoneyInput(formState.depositAmount);
    const explicitBalance = formState.balanceAmount.trim() ? parseMoneyInput(formState.balanceAmount) : null;
    return explicitBalance ?? Math.max(0, quoteSubtotalPreview - depositAmount);
  }, [formState.balanceAmount, formState.depositAmount, formState.paymentTerms, quoteSubtotalPreview]);

  async function refreshRequests(nextStatus = statusFilter, nextQuery = query) {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        buildApiUrl(apiBasePath, apiQueryParams, "", {
          status: nextStatus,
          ...(nextQuery.trim() ? { q: nextQuery.trim() } : {}),
        }),
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load quotation requests.");
      }
      setRequests(data.requests);
      setExpandedId((current) => current && data.requests.some((request: SerializedQuoteRequest) => request.id === current)
        ? current
        : data.requests[0]?.id ?? null);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load quotation requests.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshTemplates() {
    setTemplatesLoading(true);
    try {
      const response = await fetch(
        buildApiUrl(templateApiPath, apiQueryParams, "", allowTemplateManager ? { all: "1" } : undefined),
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load quotation templates.");
      }
      setTemplates(Array.isArray(data.templates) ? data.templates : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load quotation templates.");
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function handleCreateQuotation() {
    setCreateSaving(true);
    setMessage(null);
    try {
      const selectedTemplate = templates.find((template) => template.id === createDraft.templateId) ?? null;
      const payload: ManualQuotationCreateInput = {
        name: createDraft.customerName,
        phone: createDraft.customerPhone,
        email: createDraft.customerEmail || undefined,
        location: createDraft.customerLocation || undefined,
        county: createDraft.county || undefined,
        town: createDraft.town || undefined,
        specificLocation: createDraft.specificLocation || undefined,
        projectType: createDraft.projectType,
        preferredContactMethod: createDraft.preferredContactMethod,
        bestTimeToContact: createDraft.bestTimeToContact,
        urgency: createDraft.urgency,
        installationStatus: createDraft.installationStatus,
        preferredProducts: createDraft.preferredProducts || undefined,
        notes: createDraft.notes || undefined,
        propertyType: "",
        source: createMode === "template" ? "TEMPLATE" : "MANUAL",
        templateId: selectedTemplate?.id,
        templateName: selectedTemplate?.templateName,
        quoteTitle:
          createDraft.quoteTitle ||
          selectedTemplate?.templateName ||
          createDraft.preferredProducts ||
          formatProjectType(createDraft.projectType),
        quoteMessage:
          createDraft.quoteMessage ||
          selectedTemplate?.projectOverview ||
          selectedTemplate?.scopeOfWork ||
          undefined,
        quoteItems: selectedTemplate?.items || [],
        paymentMethod: selectedTemplate?.defaultPaymentMethod || undefined,
        paymentTerms: selectedTemplate?.defaultPaymentTerms || undefined,
        depositAmount: selectedTemplate?.defaultDepositAmount ?? undefined,
        balanceAmount: selectedTemplate?.defaultBalanceAmount ?? undefined,
      };

      const response = await fetch(buildApiUrl(createApiPath, apiQueryParams), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to create quotation draft.");
      }
      setShowCreatePanel(false);
      setCreateDraft(createDefaultQuotationDraft());
      await refreshRequests("ALL", query);
      if (data.request?.id) {
        setExpandedId(data.request.id);
      }
      setMessage("Quotation draft created successfully.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create quotation draft.");
    } finally {
      setCreateSaving(false);
    }
  }

  useEffect(() => {
    if (filterStorageKey && typeof window !== "undefined") {
      const stored = window.localStorage.getItem(filterStorageKey);
      if (stored && STATUS_OPTIONS.includes(stored as QuoteRequestStatusFilter)) {
        setStatusFilter(stored as QuoteRequestStatusFilter);
      }
    }
  }, [filterStorageKey]);

  useEffect(() => {
    if (filterStorageKey && typeof window !== "undefined") {
      window.localStorage.setItem(filterStorageKey, statusFilter);
    }
  }, [filterStorageKey, statusFilter]);

  useEffect(() => {
    refreshRequests().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!showCreatePanel) return;
    if (templates.length) return;
    refreshTemplates().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showCreatePanel]);

  useEffect(() => {
    setQuery(q);
  }, [q]);

  useEffect(() => {
    if (!expandedRequest) return;
    const storedProposal = parseStoredQuoteProposal(expandedRequest.quotationData);
    setFormState({
      status: expandedRequest.status,
      quoteTitle: expandedRequest.quoteTitle || "",
      quoteMessage: expandedRequest.quoteMessage || "",
      quoteItems: storedProposal.items.length
        ? storedProposal.items.map((item) => ({
            itemName: item.itemName,
            quantity: String(item.quantity),
            unitPrice: String(item.unitPrice),
          }))
        : [createEmptyQuoteItem()],
      paymentMethod: storedProposal.paymentMethod || "",
      paymentTerms: storedProposal.paymentTerms || "FULL_PAYMENT",
      depositAmount:
        typeof storedProposal.depositAmount === "number" ? String(storedProposal.depositAmount) : "",
      balanceAmount:
        typeof storedProposal.balanceAmount === "number" ? String(storedProposal.balanceAmount) : "",
      followUpNotes:
        typeof expandedRequest.responseMetadata?.followUpNotes === "string"
          ? expandedRequest.responseMetadata.followUpNotes
          : "",
      sendEmail: expandedRequest.customerEmail ? true : false,
      sendSms: expandedRequest.customerPhone ? true : false,
    });
  }, [expandedRequest]);

  async function handleRespond() {
    if (!expandedRequest) return;
    setSaving(expandedRequest.id);
    setMessage(null);
    try {
      const response = await fetch(
        buildApiUrl(apiBasePath, apiQueryParams, `${expandedRequest.id}/respond`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildQuoteRequestPayload(formState)),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save quotation response.");
      }

      setRequests((current) =>
        current.map((request) => (request.id === expandedRequest.id ? data.request : request)),
      );
      const delivered = (data.notifications || [])
        .filter((entry: { ok: boolean }) => entry.ok)
        .map((entry: { channel: string }) => entry.channel.toUpperCase())
        .join(" + ");
      setMessage(
        delivered
          ? `Quotation saved and customer notified via ${delivered}.`
          : "Quotation saved successfully.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save quotation response.");
    } finally {
      setSaving(null);
    }
  }

  async function handleOpenReceiptDraft(
    request: SerializedQuoteRequest,
    mode: "receipt" | "quotation",
  ) {
    setDraftOpening(`${request.id}:${mode}`);
    setMessage(null);
    try {
      const response = await fetch(
        buildApiUrl(apiBasePath, apiQueryParams, `${request.id}/create-receipt-draft`),
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode }),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok || !data?.url) {
        throw new Error(data?.error || "Failed to open the receipts desk draft.");
      }
      window.location.assign(data.url);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to open the receipts desk draft.");
    } finally {
      setDraftOpening(null);
    }
  }

  return (
    <div className="space-y-4">
      {!compactMode ? (
      <div className="rounded-2xl border border-white/10 bg-[var(--panel,#121723)] p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
              Quotation requests
            </div>
            <h2 className="mt-2 text-xl font-semibold text-white">{deskTitle}</h2>
            <p className="mt-1 text-sm text-slate-300">{deskDescription}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {enableCreate ? (
              <button
                type="button"
                onClick={() => setShowCreatePanel((current) => !current)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Quotation
              </button>
            ) : null}
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search customer, phone, quote ref..."
              className="min-w-[260px] rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => refreshRequests()}
              className="inline-flex items-center gap-2 rounded-full border border-white/15 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-emerald-500 hover:text-white"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Refresh
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-semibold uppercase tracking-wide">
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => {
                setStatusFilter(status);
                refreshRequests(status, query).catch(() => undefined);
              }}
              className={`rounded-full border px-4 py-1 transition ${
                statusFilter === status
                  ? "border-emerald-500 bg-emerald-500/20 text-emerald-200"
                  : "border-white/15 text-slate-200 hover:border-emerald-500 hover:text-white"
              }`}
            >
              {status === "ALL" ? "All quotation requests" : formatStatus(status)}
            </button>
          ))}
        </div>

        {loadError ? (
          <div className="mt-4 rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
            {loadError}
          </div>
        ) : null}
        {message ? (
          <div className="mt-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
            {message}
          </div>
        ) : null}
      </div>
      ) : (
        <>
          {enableCreate ? (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setShowCreatePanel((current) => !current)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Quotation
              </button>
            </div>
          ) : null}
          {loadError ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
              {loadError}
            </div>
          ) : null}
          {message ? (
            <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
              {message}
            </div>
          ) : null}
        </>
      )}

        {showCreatePanel ? (
          <div className={`rounded-[28px] border border-emerald-500/20 bg-slate-950/60 ${compactMode ? "p-4" : "mt-5 p-5"}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Quotation Center
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  Create quotation draft
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Start a quotation for walk-in, WhatsApp, phone, or template-based customers without waiting for the website form.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ["manual", "Manual quotation"],
                  ["template", "From prepared template"],
                ] as Array<[CreateQuotationMode, string]>).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setCreateMode(mode)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      createMode === mode
                        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-200"
                        : "border-white/10 text-slate-200 hover:border-white/25"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Customer name
                <input
                  value={createDraft.customerName}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, customerName: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Phone number
                <input
                  value={createDraft.customerPhone}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, customerPhone: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Email
                <input
                  value={createDraft.customerEmail}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, customerEmail: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Project type
                <select
                  value={createDraft.projectType}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, projectType: event.target.value as QuoteProjectType }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                >
                  {PROJECT_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatProjectType(option)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
                Location
                <input
                  value={createDraft.customerLocation}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, customerLocation: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Quotation title
                <input
                  value={createDraft.quoteTitle}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, quoteTitle: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Preferred contact
                <select
                  value={createDraft.preferredContactMethod}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, preferredContactMethod: event.target.value as QuoteContactMethod }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                >
                  {CONTACT_METHOD_OPTIONS.map((option) => (
                    <option key={option} value={option}>
                      {formatContactMethod(option)}
                    </option>
                  ))}
                </select>
              </label>
              {createMode === "template" ? (
                <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
                  Prepared quotation template
                  <select
                    value={createDraft.templateId}
                    onChange={(event) => {
                      const nextId = event.target.value;
                      const nextTemplate = templates.find((template) => template.id === nextId) ?? null;
                      setCreateDraft((current) => ({
                        ...current,
                        templateId: nextId,
                        quoteTitle: current.quoteTitle || nextTemplate?.templateName || current.quoteTitle,
                        quoteMessage: current.quoteMessage || nextTemplate?.projectOverview || current.quoteMessage,
                      }));
                    }}
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                  >
                    <option value="">{templatesLoading ? "Loading templates..." : "Select template"}</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.templateName}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
                Customer requirement / notes
                <textarea
                  value={createDraft.notes}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, notes: event.target.value }))}
                  rows={4}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={
                  createSaving ||
                  !createDraft.customerName.trim() ||
                  !createDraft.customerPhone.trim() ||
                  (createMode === "template" && !createDraft.templateId)
                }
                onClick={() => void handleCreateQuotation()}
                className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {createSaving ? "Creating..." : "Create Draft"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowCreatePanel(false);
                  setCreateDraft(createDefaultQuotationDraft());
                }}
                className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/20"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        <div className={compactMode ? "space-y-3" : "mt-5 space-y-4"}>
          {filteredRequests.length ? (
            filteredRequests.map((request) => {
              const expanded = request.id === expandedId;
              const storedProposal = parseStoredQuoteProposal(request.quotationData);
              const canOpenReceiptDraft = storedProposal.items.length > 0;
              return (
                <div
                  key={request.id}
                  className={`rounded-[28px] border border-white/10 ${compactMode ? "bg-white/[0.03] p-4" : "bg-slate-950/60 p-5"}`}
                >
                  {compactMode ? (
                    <div className="grid gap-3 lg:grid-cols-[140px_1.3fr_1fr_160px_140px_150px] lg:items-center">
                      <div>
                        <span className="rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-violet-100">
                          QUOTATION
                        </span>
                        {isCarriedForwardQuote(request, start) ? (
                          <span className="ml-2 rounded-full border border-amber-400/25 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-100">
                            Carried forward
                          </span>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={buildCustomerProfileHref(request, impersonateId)}
                          className="font-semibold text-white transition hover:text-cyan-200"
                        >
                          {request.customerName}
                        </Link>
                        <div className="mt-1 text-xs text-slate-400">{request.customerPhone}</div>
                        <div className="mt-1 text-xs text-slate-500">{request.quoteRef}</div>
                      </div>
                      <div className="text-sm text-slate-300">
                        <div>{request.customerLocation || [request.town, request.county].filter(Boolean).join(" - ") || "Location pending"}</div>
                        <div className="mt-1 text-xs text-slate-500">{request.assignedAttendant?.name || "Unassigned"}</div>
                      </div>
                      <div>
                        <div className="font-semibold text-white">
                          {request.quotationData ? formatQuoteCurrency(parseStoredQuoteProposal(request.quotationData).total) : "-"}
                        </div>
                        <div className="mt-1 text-xs text-slate-400">{request.customerEmail || "No email saved"}</div>
                      </div>
                      <div>
                        <span className="inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-300">
                          {formatStatus(request.status)}
                        </span>
                        <div className="mt-2 text-xs text-slate-500">{formatDateTime(request.updatedAt || request.createdAt)}</div>
                      </div>
                      <div className="flex justify-start lg:justify-end">
                        <button
                          type="button"
                          onClick={() => setExpandedId(expanded ? null : request.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/25 hover:bg-white/[0.06]"
                        >
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                          {expanded ? "Close" : "View quotation"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : request.id)}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        <span className="mt-1 rounded-full border border-white/10 bg-white/5 p-2 text-slate-300">
                          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Open quotation request
                          </div>
                          <Link
                            href={buildCustomerProfileHref(request, impersonateId)}
                            className="mt-2 block text-2xl font-semibold text-white transition hover:text-cyan-200"
                          >
                            {request.customerName}
                          </Link>
                          <div className="mt-1 text-sm text-slate-400">{request.quoteRef}</div>
                          <div className="mt-2 grid gap-1 text-sm text-slate-300 md:grid-cols-2 xl:grid-cols-3">
                            <div>{request.customerPhone}</div>
                            <div>{request.customerEmail || "No email saved yet"}</div>
                            <div>{request.customerLocation || [request.town, request.county].filter(Boolean).join(" - ") || "Location pending"}</div>
                          </div>
                        </div>
                      </button>
                      <div className="flex flex-col items-start gap-3 lg:items-end">
                        <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-emerald-300">
                          {formatStatus(request.status)}
                        </div>
                        <div className="text-sm text-slate-400">{formatDateTime(request.createdAt)}</div>
                      </div>
                    </div>
                  )}

                  {expanded ? (
                    <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Customer request
                          </div>
                          <div className="mt-3 flex flex-wrap gap-3">
                            <Link
                              href={buildCustomerProfileHref(request, impersonateId)}
                              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/15"
                            >
                              Open customer profile
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              disabled={!canOpenReceiptDraft || draftOpening === `${request.id}:quotation`}
                              onClick={() => void handleOpenReceiptDraft(request, "quotation")}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {draftOpening === `${request.id}:quotation` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Open quotation draft
                            </button>
                            <button
                              type="button"
                              disabled={!canOpenReceiptDraft || draftOpening === `${request.id}:receipt`}
                              onClick={() => void handleOpenReceiptDraft(request, "receipt")}
                              className="inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-300/30 hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {draftOpening === `${request.id}:receipt` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Convert to receipt draft
                            </button>
                          </div>
                          {!canOpenReceiptDraft ? (
                            <div className="mt-3 text-xs text-amber-200">
                              Save at least one quoted item first before opening the receipts desk.
                            </div>
                          ) : null}
                          <div className="mt-3 grid gap-3 text-sm text-slate-200 sm:grid-cols-2">
                            <div>
                              <div className="font-semibold text-white">Project type</div>
                              <div className="mt-1 text-slate-300">
                                {formatProjectType(request.projectType || request.propertyType)}
                              </div>
                            </div>
                            <div>
                              <div className="font-semibold text-white">Budget range</div>
                              <div className="mt-1 text-slate-300">{request.budgetRange || "-"}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-white">Preferred contact</div>
                              <div className="mt-1 text-slate-300">{formatContactMethod(request.preferredContactMethod)}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-white">Best time to contact</div>
                              <div className="mt-1 text-slate-300">{formatContactTime(request.bestTimeToContact)}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-white">Urgency</div>
                              <div className="mt-1 text-slate-300">{formatUrgency(request.urgency)}</div>
                            </div>
                            <div>
                              <div className="font-semibold text-white">Installation status</div>
                              <div className="mt-1 text-slate-300">{formatInstallationStatus(request.installationStatus)}</div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="font-semibold text-white">Power/load description</div>
                              <div className="mt-1 whitespace-pre-wrap text-slate-300">{request.loadDescription || "-"}</div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="font-semibold text-white">Preferred products</div>
                              <div className="mt-1 whitespace-pre-wrap text-slate-300">{request.preferredProducts || "-"}</div>
                            </div>
                            <div className="sm:col-span-2">
                              <div className="font-semibold text-white">Customer notes</div>
                              <div className="mt-1 whitespace-pre-wrap text-slate-300">{request.notes || "-"}</div>
                            </div>
                          </div>
                        </div>

                        {renderAnswerBlock(
                          "Structured project answers",
                          request.answers as Record<string, unknown> | null | undefined,
                        )}

                        {renderAnswerBlock(
                          "Solar home details",
                          request.answers?.solarHome as Record<string, unknown> | null | undefined,
                        )}
                        {renderAnswerBlock(
                          "Water pump / borehole details",
                          request.answers?.solarWaterPump as Record<string, unknown> | null | undefined,
                        )}
                        {renderAnswerBlock(
                          "Solar water heater details",
                          request.answers?.solarWaterHeater as Record<string, unknown> | null | undefined,
                        )}
                        {renderAnswerBlock(
                          "Commercial solar details",
                          request.answers?.commercialSolar as Record<string, unknown> | null | undefined,
                        )}
                        {renderAnswerBlock(
                          "CCTV + solar details",
                          request.answers?.cctvSolar as Record<string, unknown> | null | undefined,
                        )}
                        {renderAnswerBlock(
                          "Street lights details",
                          request.answers?.streetLights as Record<string, unknown> | null | undefined,
                        )}
                        {renderAnswerBlock(
                          "General project details",
                          request.answers?.general as Record<string, unknown> | null | undefined,
                        )}

                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Quotation response
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              Status
                              <select
                                value={formState.status}
                                onChange={(event) =>
                                  setFormState((current) => ({
                                    ...current,
                                    status: event.target.value as QuoteRequestStatus,
                                  }))
                                }
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              >
                                {QUOTE_REQUEST_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {formatStatus(status)}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400">
                              Quote title
                              <input
                                value={formState.quoteTitle}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, quoteTitle: event.target.value }))
                                }
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                            <div className="md:col-span-2 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                                    Itemized quotation builder
                                  </div>
                                  <div className="mt-1 text-sm text-slate-300">
                                    Add each quoted item, quantity, and unit price. The system will calculate totals automatically.
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setFormState((current) => ({
                                      ...current,
                                      quoteItems: [...current.quoteItems, createEmptyQuoteItem()],
                                    }))
                                  }
                                  className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/20"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Add item
                                </button>
                              </div>

                              <div className="mt-4 space-y-3">
                                {formState.quoteItems.map((item, index) => (
                                  <div key={`quote-item-${index}`} className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_140px_160px_auto]">
                                      <label className="text-xs uppercase tracking-wide text-slate-400">
                                        Item name
                                        <textarea
                                          rows={2}
                                          value={item.itemName}
                                          onChange={(event) =>
                                            setFormState((current) => ({
                                              ...current,
                                              quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                                entryIndex === index ? { ...entry, itemName: event.target.value } : entry,
                                              ),
                                            }))
                                          }
                                          placeholder="Example: 5KW Hybrid Inverter + 5.12kWh Lithium Battery"
                                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                        />
                                      </label>
                                      <label className="text-xs uppercase tracking-wide text-slate-400">
                                        Quantity
                                        <input
                                          value={item.quantity}
                                          onChange={(event) =>
                                            setFormState((current) => ({
                                              ...current,
                                              quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                                entryIndex === index ? { ...entry, quantity: event.target.value } : entry,
                                              ),
                                            }))
                                          }
                                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                        />
                                      </label>
                                      <label className="text-xs uppercase tracking-wide text-slate-400">
                                        Unit price
                                        <input
                                          value={item.unitPrice}
                                          onChange={(event) =>
                                            setFormState((current) => ({
                                              ...current,
                                              quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                                entryIndex === index ? { ...entry, unitPrice: event.target.value } : entry,
                                              ),
                                            }))
                                          }
                                          placeholder="275000"
                                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                        />
                                      </label>
                                      <div className="flex items-end justify-between gap-3 lg:flex-col lg:items-end">
                                        <div className="text-right">
                                          <div className="text-xs uppercase tracking-wide text-slate-400">Line total</div>
                                          <div className="mt-1 text-sm font-semibold text-white">
                                            {formatQuoteCurrency(quoteItemsPreview[index]?.lineTotal || 0)}
                                          </div>
                                        </div>
                                        <button
                                          type="button"
                                          disabled={formState.quoteItems.length <= 1}
                                          onClick={() =>
                                            setFormState((current) => ({
                                              ...current,
                                              quoteItems:
                                                current.quoteItems.length <= 1
                                                  ? current.quoteItems
                                                  : current.quoteItems.filter((_, entryIndex) => entryIndex !== index),
                                            }))
                                          }
                                          className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          Remove
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                  Payment method
                                  <select
                                    value={formState.paymentMethod}
                                    onChange={(event) =>
                                      setFormState((current) => ({
                                        ...current,
                                        paymentMethod: event.target.value as QuotePaymentMethod | "",
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                  >
                                    <option value="">Select payment method</option>
                                    {QUOTE_PAYMENT_METHODS.map((method) => (
                                      <option key={method} value={method}>
                                        {getQuotePaymentMethodLabel(method)}
                                      </option>
                                    ))}
                                  </select>
                                  {formState.paymentMethod ? (
                                    <div className="mt-2 rounded-xl border border-white/10 bg-slate-950/60 px-3 py-2 text-[11px] normal-case tracking-normal text-slate-300">
                                      {PAYMENT_METHOD_DETAILS[formState.paymentMethod].lines.map((line) => (
                                        <div key={line}>{line}</div>
                                      ))}
                                    </div>
                                  ) : null}
                                </label>
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                  Payment terms
                                  <select
                                    value={formState.paymentTerms}
                                    onChange={(event) =>
                                      setFormState((current) => ({
                                        ...current,
                                        paymentTerms: event.target.value as QuotePaymentTerms,
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                  >
                                    {QUOTE_PAYMENT_TERMS.map((term) => (
                                      <option key={term} value={term}>
                                        {getQuotePaymentTermsLabel(term)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                {formState.paymentTerms === "DEPOSIT_AND_BALANCE" ? (
                                  <>
                                    <label className="text-xs uppercase tracking-wide text-slate-400">
                                      Deposit amount
                                      <input
                                        value={formState.depositAmount}
                                        onChange={(event) =>
                                          setFormState((current) => ({ ...current, depositAmount: event.target.value }))
                                        }
                                        placeholder="100000"
                                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                      />
                                    </label>
                                    <label className="text-xs uppercase tracking-wide text-slate-400">
                                      Balance amount
                                      <input
                                        value={formState.balanceAmount}
                                        onChange={(event) =>
                                          setFormState((current) => ({ ...current, balanceAmount: event.target.value }))
                                        }
                                        placeholder={quoteBalancePreview !== null ? String(quoteBalancePreview) : ""}
                                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                      />
                                    </label>
                                  </>
                                ) : null}
                              </div>

                              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                                <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                                  <div>
                                    <span className="font-semibold text-white">Subtotal:</span>{" "}
                                    {formatQuoteCurrency(quoteSubtotalPreview)}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-white">Total quoted amount:</span>{" "}
                                    {formatQuoteCurrency(quoteSubtotalPreview)}
                                  </div>
                                  {formState.paymentTerms === "DEPOSIT_AND_BALANCE" ? (
                                    <>
                                      <div>
                                        <span className="font-semibold text-white">Deposit:</span>{" "}
                                        {formatQuoteCurrency(parseMoneyInput(formState.depositAmount))}
                                      </div>
                                      <div>
                                        <span className="font-semibold text-white">Balance:</span>{" "}
                                        {formatQuoteCurrency(quoteBalancePreview || 0)}
                                      </div>
                                    </>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                            <label className="text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
                              Customer message
                              <textarea
                                rows={5}
                                value={formState.quoteMessage}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, quoteMessage: event.target.value }))
                                }
                                placeholder="Explain the recommended setup, delivery plan, and next step for the customer."
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                            <label className="text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
                              Follow-up notes
                              <textarea
                                rows={3}
                                value={formState.followUpNotes}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, followUpNotes: event.target.value }))
                                }
                                placeholder="Internal follow-up notes for the next call or message."
                                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                              />
                            </label>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Notification delivery
                          </div>
                          <div className="mt-3 space-y-3 text-sm text-slate-200">
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={formState.sendEmail}
                                disabled={!request.customerEmail}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, sendEmail: event.target.checked }))
                                }
                              />
                              <span>Email customer {request.customerEmail ? `(${request.customerEmail})` : "(no email saved)"}</span>
                            </label>
                            <label className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={formState.sendSms}
                                disabled={!request.customerPhone}
                                onChange={(event) =>
                                  setFormState((current) => ({ ...current, sendSms: event.target.checked }))
                                }
                              />
                              <span>SMS customer ({request.customerPhone || "no phone"})</span>
                            </label>
                          </div>
                          <button
                            type="button"
                            onClick={handleRespond}
                            disabled={saving === request.id}
                            className="mt-5 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-70"
                          >
                            {saving === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            Save quotation response
                          </button>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Assignment
                          </div>
                          <div className="mt-3">
                            {request.assignedAttendant?.name || request.assignedAttendant?.email || "Unassigned"}
                          </div>
                          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Conversion
                            </div>
                            <div className="mt-2">
                              {canOpenReceiptDraft
                                ? "Open a quotation print draft or convert this approved draft into the receipts desk."
                                : "Quotation items are still empty. Build the quote first, then open the receipts desk."}
                            </div>
                          </div>
                          {request.respondedAt ? (
                            <div className="mt-3 text-xs text-slate-400">
                              Last responded: {formatDateTime(request.respondedAt)}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-5 py-8 text-center text-sm text-slate-400">
              {loading ? "Loading quotation requests..." : emptyMessage}
            </div>
          )}
        </div>
    </div>
  );
}
