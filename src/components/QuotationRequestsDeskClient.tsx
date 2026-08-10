"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  FilePenLine,
  LayoutTemplate,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
} from "lucide-react";
import type {
  ManualQuotationCreateInput,
  QuoteContactMethod,
  QuoteContactTime,
  QuoteInstallationStatus,
  QuoteRequestResponseInput,
  QuoteRequestSource,
  QuoteProjectType,
  QuoteRequestStatus,
  QuoteUrgency,
  SerializedQuoteRequest,
  SerializedQuotationEvent,
  SerializedQuotationTemplate,
} from "@/lib/quoteRequests";
import {
  QUOTE_REQUEST_ACTIONABLE_STATUSES,
} from "@/lib/quoteRequestStatus";
import {
  formatQuoteCurrency,
  QUOTE_FEE_MODES,
  getQuotePaymentTermsLabel,
  parseStoredQuoteProposal,
  QUOTE_PAYMENT_TERMS,
  type QuotePaymentMethod,
  type QuotePaymentTerms,
  type QuoteFeeMode,
  type QuoteWarrantyMode,
  type QuoteWarrantySource,
  type QuoteWarrantyUnit,
} from "@/lib/quoteProposal";
import type {
  QuoteProjectPaymentTerm,
  QuoteProjectStage,
  SerializedQuoteProjectEvent,
  SerializedQuoteProjectOrder,
} from "@/lib/quoteProjects";
import {
  buildItemDrivenPowerSummary,
  getProjectTypeDefaultSections,
  type QuoteProposalSections,
  type QuoteSectionVisibility,
} from "@/lib/quoteProposalSections";
import {
  isCarriedForwardPendingItem,
  isOpenQuotationStatus,
  shouldShowPendingWorkItem,
} from "@/lib/operationsWorkQueue";
import { buildAdminCustomerProfileHref } from "@/lib/adminCustomerProfileLinks";

type QuoteRequestStatusFilter = "ALL" | QuoteRequestStatus;
type AdminQuotationView =
  | "ALL"
  | "WEBSITE"
  | "WEBSITE_PENDING"
  | "MANUAL"
  | "PENDING"
  | "QUOTED"
  | "CONVERTED";

type TemplateOwnerOption = {
  id: string;
  name: string | null;
  email: string | null;
};

const PROJECT_STAGE_OPTIONS: QuoteProjectStage[] = [
  "RECEIPT_CREATED",
  "PROJECT_IN_PROGRESS",
  "COMPLETED_POSTED",
];

const PROJECT_PAYMENT_TERM_OPTIONS: QuoteProjectPaymentTerm[] = [
  "FULL_BEFORE_INSTALLATION",
  "DEPOSIT_AND_BALANCE",
  "FULL_AFTER_INSTALLATION",
];

type ProjectDraft = {
  stage: QuoteProjectStage;
  paymentTerm: QuoteProjectPaymentTerm;
  totalAmount: string;
  depositPercent: string;
  depositPaidAmount: string;
  amountPaidTotal: string;
  scheduledDate: string;
  postedReceiptNumber: string;
  internalNotes: string;
};

type Props = {
  apiBasePath: string;
  apiQueryParams?: Record<string, string | null | undefined>;
  defaultStatusFilter?: QuoteRequestStatusFilter;
  initialExpandedId?: string | null;
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
  allowDelete?: boolean;
  templateOwnerOptions?: TemplateOwnerOption[];
  createOnlyMode?: boolean;
  initialCreateOpen?: boolean;
  allowTemplateSelection?: boolean;
  createActionLabel?: string;
  createSuccessMessage?: string;
  assigneeOptions?: TemplateOwnerOption[];
  assigneeLabel?: string;
  requireAssigneeSelection?: boolean;
  showMonitoringSummary?: boolean;
  enableAdminFilters?: boolean;
};

const QUOTE_REQUEST_STATUSES: QuoteRequestStatus[] = [
  "PENDING",
  "QUOTED",
  "FOLLOW_UP",
  "REVISED",
  "APPROVED",
  "CONVERTED",
  "CLOSED",
];

const STATUS_OPTIONS: QuoteRequestStatusFilter[] = ["ALL", ...QUOTE_REQUEST_STATUSES];
const SOURCE_OPTIONS: Array<QuoteRequestSource | "ALL"> = [
  "ALL",
  "WEBSITE_REQUEST",
  "MANUAL",
  "RECEIPTS",
  "ADMIN",
  "WHATSAPP",
  "PHONE",
  "TEMPLATE",
];

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

const CATALOG_SEARCH_MIN_CHARS = 2;

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

function formatSource(value: string) {
  return value.replace(/_/g, " ");
}

function formatProjectStage(value: QuoteProjectStage) {
  switch (value) {
    case "RECEIPT_CREATED":
      return "Project pending";
    case "PROJECT_IN_PROGRESS":
      return "Project in progress";
    case "COMPLETED_POSTED":
      return "Completed and posted to POS";
  }
}

function formatProjectPaymentTerm(value: QuoteProjectPaymentTerm) {
  switch (value) {
    case "FULL_BEFORE_INSTALLATION":
      return "Pay fully before installation";
    case "DEPOSIT_AND_BALANCE":
      return "Pay deposit and balance";
    case "FULL_AFTER_INSTALLATION":
      return "Pay fully after installation";
  }
}

function createProjectDraft(order: SerializedQuoteProjectOrder | null, totalAmount = 0): ProjectDraft {
  return {
    stage: order?.stage ?? "RECEIPT_CREATED",
    paymentTerm: order?.paymentTerm ?? "DEPOSIT_AND_BALANCE",
    totalAmount: String(order?.totalAmount ?? totalAmount ?? 0),
    depositPercent: String(order?.depositPercent ?? 30),
    depositPaidAmount: String(order?.depositPaidAmount ?? 0),
    amountPaidTotal: String(order?.amountPaidTotal ?? 0),
    scheduledDate: order?.scheduledDate ? order.scheduledDate.slice(0, 10) : "",
    postedReceiptNumber: order?.postedReceiptNumber ?? "",
    internalNotes: order?.internalNotes ?? "",
  };
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

function extractFirstProjectUrl(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "https://www.tiktok.com/@betechsolarprojects";
  const match = text.match(/https?:\/\/[^\s)]+/i);
  return match?.[0] || "https://www.tiktok.com/@betechsolarprojects";
}

function formatEventTypeLabel(value: string) {
  return value.replace(/_/g, " ");
}

function isConversionEvent(event: SerializedQuotationEvent) {
  return [
    "QUOTATION_DRAFT_OPENED",
    "RECEIPT_DRAFT_OPENED",
    "CONVERTED",
    "PDF_DOWNLOADED",
  ].includes(event.eventType);
}

function isWebsiteRequest(request: Pick<SerializedQuoteRequest, "source">) {
  return request.source === "WEBSITE_REQUEST";
}

function isPendingQuotationStatus(status: QuoteRequestStatus) {
  return (QUOTE_REQUEST_ACTIONABLE_STATUSES as readonly string[]).includes(status);
}

function getAdminViewLabel(view: AdminQuotationView) {
  switch (view) {
    case "WEBSITE":
      return "Website Requests";
    case "WEBSITE_PENDING":
      return "Pending Website";
    case "MANUAL":
      return "Manual / Desk";
    case "PENDING":
      return "Needs Action";
    case "QUOTED":
      return "Quoted";
    case "CONVERTED":
      return "Converted";
    default:
      return "All Activity";
  }
}

function matchesAdminView(request: SerializedQuoteRequest, view: AdminQuotationView) {
  switch (view) {
    case "WEBSITE":
      return isWebsiteRequest(request);
    case "WEBSITE_PENDING":
      return isWebsiteRequest(request) && isPendingQuotationStatus(request.status);
    case "MANUAL":
      return !isWebsiteRequest(request);
    case "PENDING":
      return isPendingQuotationStatus(request.status);
    case "QUOTED":
      return request.status === "QUOTED";
    case "CONVERTED":
      return request.status === "CONVERTED";
    default:
      return true;
  }
}

function groupTimelineEvents(events: SerializedQuotationEvent[]) {
  return {
    workflow: events.filter(
      (event) =>
        !isConversionEvent(event) &&
        !["CUSTOMER_VIEWED", "WHATSAPP_LINK_OPENED", "CUSTOMER_DOWNLOADED"].includes(event.eventType),
    ),
    conversion: events.filter(isConversionEvent),
    customer: events.filter((event) =>
      ["CUSTOMER_VIEWED", "WHATSAPP_LINK_OPENED", "CUSTOMER_DOWNLOADED"].includes(event.eventType),
    ),
  };
}

type QuoteItemDraft = {
  itemName: string;
  description: string;
  quantity: string;
  unitPrice: string;
  defaultWarranty: string;
  warranty: string;
  warrantyPeriod: string;
  warrantyUnit: QuoteWarrantyUnit;
  warrantyNotes: string;
  warrantySource: QuoteWarrantySource;
};

type ParsedQuotationTemplateDraft = {
  quoteItems: QuoteItemDraft[];
  discountAmount: string;
  quoteTitle: string;
  notes: string;
};

function normalizePastedTemplateLine(value: string) {
  return value
    .replace(/\*\*/g, "")
    .replace(/[•·]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseKesValue(value: string) {
  const match = value.match(/ksh\s*([\d,]+(?:\.\d+)?)/i);
  if (!match) return null;
  const parsed = Number(match[1].replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function isSectionHeadingLine(value: string) {
  if (!value) return false;
  if (/:/.test(value)) return false;
  if (/ksh/i.test(value)) return false;
  if (/@/.test(value)) return false;
  if (/[×x]/.test(value)) return false;
  return /^[a-z][a-z0-9/&,+()\-. ]+$/i.test(value);
}

function parsePastedTemplateItemLine(
  value: string,
  currentSection: string,
): QuoteItemDraft | null {
  const line = normalizePastedTemplateLine(value);
  if (!line) return null;
  if (/^itemized equipment list$/i.test(line)) return null;
  if (/^project summary$/i.test(line)) return null;
  if (/^(subtotal|special project discount|final project cost|main equipment|mounting materials|electrical accessories|services)\s*:/i.test(line)) {
    return null;
  }
  if (/total:\s*ksh/i.test(line) && !/@/i.test(line) && !/[×x]/.test(line)) {
    return null;
  }

  if (/@/i.test(line)) {
    const [leftRaw, rightRaw] = line.split(/\s+@\s+/i, 2);
    const right = rightRaw || "";
    let quantity = "1";
    let itemName = leftRaw.trim();

    const timesMatch = leftRaw.match(/^(\d+(?:\.\d+)?)\s*[×x]\s+(.+)$/i);
    const packMatch = leftRaw.match(/^(\d+(?:\.\d+)?)\s+(?:packs?\s+)?(.+)$/i);
    if (timesMatch) {
      quantity = timesMatch[1];
      itemName = timesMatch[2].trim();
    } else if (packMatch) {
      quantity = packMatch[1];
      itemName = packMatch[2].trim();
    }

    const unitPrice = parseKesValue(right);
    if (unitPrice === null) return null;

    return hydrateQuoteItemDraft({
      itemName,
      description: currentSection && currentSection !== "Project Summary" ? currentSection : "",
      quantity,
      unitPrice: String(unitPrice),
      warranty: suggestWarrantyForItem(itemName),
      warrantySource: "CUSTOM",
    });
  }

  const serviceMatch = line.match(/^(.+?)\s+[—-]\s+ksh\s*([\d,]+(?:\.\d+)?)(?:\s*\(.*\))?$/i);
  if (serviceMatch) {
    const amount = Number(serviceMatch[2].replace(/,/g, ""));
    if (!Number.isFinite(amount)) return null;
    return hydrateQuoteItemDraft({
      itemName: serviceMatch[1].trim(),
      description: currentSection && currentSection !== "Project Summary" ? currentSection : "",
      quantity: "1",
      unitPrice: String(amount),
      warranty: suggestWarrantyForItem(serviceMatch[1].trim()),
      warrantySource: "CUSTOM",
    });
  }

  return null;
}

function parsePastedQuotationTemplate(text: string): ParsedQuotationTemplateDraft {
  const lines = text
    .split(/\r?\n/)
    .map((line) => normalizePastedTemplateLine(line))
    .filter(Boolean);

  if (!lines.length) {
    throw new Error("Paste the itemized quotation text first.");
  }

  let currentSection = "";
  let subtotalAmount: number | null = null;
  let discountAmount: number | null = null;
  let finalProjectCost: number | null = null;
  const quoteItems: QuoteItemDraft[] = [];

  for (const line of lines) {
    if (isSectionHeadingLine(line)) {
      currentSection = line;
      continue;
    }
    if (/^subtotal\s*:/i.test(line)) {
      subtotalAmount = parseKesValue(line);
      continue;
    }
    if (/^special project discount\s*:/i.test(line)) {
      discountAmount = parseKesValue(line);
      continue;
    }
    if (/^final project cost\s*:/i.test(line)) {
      finalProjectCost = parseKesValue(line);
      continue;
    }

    const nextItem = parsePastedTemplateItemLine(line, currentSection);
    if (nextItem) {
      quoteItems.push(nextItem);
    }
  }

  if (!quoteItems.length) {
    throw new Error("No quotation items were found. Paste the full BOQ with item lines and prices.");
  }

  const computedSubtotal = buildSanitizedQuoteItems(quoteItems).reduce(
    (sum, item) => sum + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0,
  );
  const normalizedSubtotal = subtotalAmount ?? computedSubtotal;
  const normalizedDiscount =
    discountAmount ??
    (finalProjectCost !== null && normalizedSubtotal > finalProjectCost
      ? Math.max(0, normalizedSubtotal - finalProjectCost)
      : 0);

  const leadItems = dedupeItemNames(quoteItems).slice(0, 2);
  const quoteTitle = leadItems.length
    ? `${leadItems.join(" + ")} template`
    : "Quotation template";

  const notes = [
    subtotalAmount !== null ? `Parsed subtotal: ${formatQuoteCurrency(subtotalAmount)}` : null,
    finalProjectCost !== null ? `Parsed final project cost: ${formatQuoteCurrency(finalProjectCost)}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return {
    quoteItems,
    discountAmount: normalizedDiscount > 0 ? String(normalizedDiscount) : "",
    quoteTitle,
    notes,
  };
}

type QuoteDeskFormState = {
  status: QuoteRequestStatus;
  quoteTitle: string;
  quoteMessage: string;
  quoteItems: QuoteItemDraft[];
  discountAmount: string;
  warrantyMode: QuoteWarrantyMode;
  fullSystemWarranty: string;
  customWarranty: string;
  warrantyGeneralNotes: string;
  aiWarrantySummary: string;
  projectOverview: string;
  whatPriceIncludes: string;
  whatItCanPower: string;
  deliveryTimeline: string;
  installationTimeline: string;
  afterSalesSupport: string;
  importantNotes: string;
  scopeExclusions: string;
  similarProjects: string;
  termsAndConditions: string;
  preparedByDetails: string;
  companyLegalDetails: string;
  projectReferenceLinks: string;
  proposalVisibility: QuoteSectionVisibility;
  paymentMethod: QuotePaymentMethod | "";
  paymentTerms: QuotePaymentTerms;
  deliveryMode: QuoteFeeMode;
  installationMode: QuoteFeeMode;
  deliveryFee: string;
  installationFee: string;
  depositAmount: string;
  balanceAmount: string;
  followUpNotes: string;
  sendEmail: boolean;
  sendSms: boolean;
};

type CatalogQuoteProduct = {
  productName: string;
  price: number;
  availability: string;
  productCategory: string;
  productUrl: string;
  shortDescription: string | null;
  warranty: string | null;
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
  templateOwnerId: string;
  quoteItems: QuoteItemDraft[];
  discountAmount: string;
  warrantyMode: QuoteWarrantyMode;
  fullSystemWarranty: string;
  customWarranty: string;
  warrantyGeneralNotes: string;
  aiWarrantySummary: string;
  projectOverview: string;
  whatPriceIncludes: string;
  whatItCanPower: string;
  deliveryTimeline: string;
  installationTimeline: string;
  afterSalesSupport: string;
  importantNotes: string;
  scopeExclusions: string;
  similarProjects: string;
  termsAndConditions: string;
  preparedByDetails: string;
  companyLegalDetails: string;
  projectReferenceLinks: string;
  proposalVisibility: QuoteSectionVisibility;
  paymentMethod: QuotePaymentMethod | "";
  paymentTerms: QuotePaymentTerms;
  deliveryMode: QuoteFeeMode;
  installationMode: QuoteFeeMode;
  deliveryFee: string;
  installationFee: string;
  depositAmount: string;
  balanceAmount: string;
  followUpNotes: string;
  assignedAttendantId: string;
};

function createEmptyQuoteItem(): QuoteItemDraft {
  return {
    itemName: "",
    description: "",
    quantity: "1",
    unitPrice: "",
    defaultWarranty: "",
    warranty: "",
    warrantyPeriod: "",
    warrantyUnit: "YEARS",
    warrantyNotes: "",
    warrantySource: "CUSTOM",
  };
}

function createProposalSectionDraft(projectType: QuoteProjectType) {
  const defaults = getProjectTypeDefaultSections(projectType);
  return {
    projectOverview: defaults.projectOverview,
    whatPriceIncludes: defaults.whatPriceIncludes,
    whatItCanPower: defaults.whatItCanPower,
    deliveryTimeline: defaults.deliveryTimeline,
    installationTimeline: defaults.installationTimeline,
    afterSalesSupport: defaults.afterSalesSupport,
    importantNotes: defaults.importantNotes,
    scopeExclusions: defaults.scopeExclusions,
    similarProjects: defaults.similarProjects,
    termsAndConditions: defaults.termsAndConditions,
    preparedByDetails: defaults.preparedByDetails,
    companyLegalDetails: defaults.companyLegalDetails,
    projectReferenceLinks: "https://www.tiktok.com/@betechsolarprojects",
    proposalVisibility: defaults.visibility,
  };
}

function createDefaultFormState(status: QuoteRequestStatus): QuoteDeskFormState {
  const defaults = createProposalSectionDraft("SOLAR_HOME_SYSTEM");
  return {
    status,
    quoteTitle: "",
    quoteMessage: "",
    quoteItems: [],
    discountAmount: "",
    warrantyMode: "PER_ITEM",
    fullSystemWarranty: "",
    customWarranty: "",
    warrantyGeneralNotes:
      "Warranty applies under normal use, correct installation, and manufacturer operating conditions.",
    aiWarrantySummary: "",
    ...defaults,
    paymentMethod: "",
    paymentTerms: "DEPOSIT_AND_BALANCE",
    deliveryMode: "INCLUDED",
    installationMode: "INCLUDED",
    deliveryFee: "",
    installationFee: "",
    depositAmount: "",
    balanceAmount: "",
    followUpNotes: "",
    sendEmail: false,
    sendSms: false,
  };
}

function createDefaultQuotationDraft(): CreateQuotationDraft {
  const defaults = createProposalSectionDraft("SOLAR_HOME_SYSTEM");
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
    templateOwnerId: "",
    quoteItems: [],
    discountAmount: "",
    warrantyMode: "PER_ITEM",
    fullSystemWarranty: "",
    customWarranty: "",
    warrantyGeneralNotes:
      "Warranty applies under normal use, correct installation, and manufacturer operating conditions.",
    aiWarrantySummary: "",
    ...defaults,
    paymentMethod: "",
    paymentTerms: "DEPOSIT_AND_BALANCE",
    deliveryMode: "INCLUDED",
    installationMode: "INCLUDED",
    deliveryFee: "",
    installationFee: "",
    depositAmount: "",
    balanceAmount: "",
    followUpNotes: "",
    assignedAttendantId: "",
  };
}

function buildCreateDraftFromRequest(request: SerializedQuoteRequest): CreateQuotationDraft {
  const projectType = request.projectType || "SOLAR_HOME_SYSTEM";
  const defaults = createDefaultQuotationDraft();
  return {
    ...defaults,
    customerName: request.customerName || request.manualCustomerName || "",
    customerPhone: request.customerPhone || request.manualCustomerPhone || "",
    customerEmail: request.customerEmail || request.manualCustomerEmail || "",
    customerLocation: request.customerLocation || "",
    county: request.county || "",
    town: request.town || "",
    specificLocation: request.specificLocation || "",
    projectType,
    preferredContactMethod: request.preferredContactMethod || defaults.preferredContactMethod,
    bestTimeToContact: request.bestTimeToContact || defaults.bestTimeToContact,
    urgency: request.urgency || defaults.urgency,
    installationStatus: request.installationStatus || defaults.installationStatus,
    preferredProducts: request.preferredProducts || "",
    notes: request.notes || "",
    quoteTitle:
      request.quoteTitle ||
      request.preferredProducts ||
      formatProjectType(projectType),
    quoteMessage:
      request.loadDescription ||
      request.notes ||
      "",
    followUpNotes:
      typeof request.responseMetadata?.followUpNotes === "string"
        ? request.responseMetadata.followUpNotes
        : "",
    assignedAttendantId: request.assignedAttendant?.id || "",
  };
}

function buildCreateDraftFromExistingQuotation(request: SerializedQuoteRequest): CreateQuotationDraft {
  const projectType = request.projectType || "SOLAR_HOME_SYSTEM";
  const defaults = createDefaultQuotationDraft();
  const storedProposal = parseStoredQuoteProposal(request.quotationData);
  const feeState = splitQuoteItemsAndFees(storedProposal.items);
  const proposalDefaults = applyProposalDefaults(projectType, {
    projectOverview: storedProposal.proposalSections.projectOverview || undefined,
    whatPriceIncludes: storedProposal.proposalSections.whatPriceIncludes || undefined,
    whatItCanPower: storedProposal.proposalSections.whatItCanPower || undefined,
    deliveryTimeline: storedProposal.proposalSections.deliveryTimeline || undefined,
    installationTimeline: storedProposal.proposalSections.installationTimeline || undefined,
    afterSalesSupport: storedProposal.proposalSections.afterSalesSupport || undefined,
    importantNotes: storedProposal.proposalSections.importantNotes || undefined,
    scopeExclusions: storedProposal.proposalSections.scopeExclusions || undefined,
    similarProjects: storedProposal.proposalSections.similarProjects || undefined,
    termsAndConditions: storedProposal.proposalSections.termsAndConditions || undefined,
    preparedByDetails: storedProposal.proposalSections.preparedByDetails || undefined,
    companyLegalDetails: storedProposal.proposalSections.companyLegalDetails || undefined,
    projectReferenceLinks: storedProposal.proposalSections.projectReferenceLinks || undefined,
    visibility: storedProposal.proposalVisibility,
  });

  return {
    ...defaults,
    projectType,
    preferredContactMethod: request.preferredContactMethod || defaults.preferredContactMethod,
    bestTimeToContact: request.bestTimeToContact || defaults.bestTimeToContact,
    urgency: request.urgency || defaults.urgency,
    installationStatus: request.installationStatus || defaults.installationStatus,
    preferredProducts:
      request.preferredProducts || summarizeSelectedProducts(feeState.quoteItems),
    notes: request.notes || "",
    quoteTitle: request.quoteTitle || `${request.quoteRef} Copy`,
    quoteMessage: request.quoteMessage || request.loadDescription || request.notes || "",
    templateId: request.templateId || "",
    quoteItems: feeState.quoteItems,
    discountAmount:
      typeof storedProposal.discountAmount === "number" && storedProposal.discountAmount > 0
        ? String(storedProposal.discountAmount)
        : "",
    warrantyMode: storedProposal.warrantyMode || defaults.warrantyMode,
    fullSystemWarranty: storedProposal.fullSystemWarranty || "",
    customWarranty: storedProposal.customWarranty || "",
    warrantyGeneralNotes:
      storedProposal.warrantyGeneralNotes || defaults.warrantyGeneralNotes,
    aiWarrantySummary: storedProposal.aiWarrantySummary || "",
    ...proposalDefaults,
    paymentMethod: storedProposal.paymentMethod || "",
    paymentTerms: storedProposal.paymentTerms || defaults.paymentTerms,
    deliveryMode: storedProposal.deliveryMode || feeState.deliveryMode,
    installationMode: storedProposal.installationMode || feeState.installationMode,
    deliveryFee: feeState.deliveryFee,
    installationFee: feeState.installationFee,
    depositAmount:
      typeof storedProposal.depositAmount === "number" ? String(storedProposal.depositAmount) : "",
    balanceAmount:
      typeof storedProposal.balanceAmount === "number" ? String(storedProposal.balanceAmount) : "",
    followUpNotes:
      typeof request.responseMetadata?.followUpNotes === "string"
        ? request.responseMetadata.followUpNotes
        : "",
    assignedAttendantId: request.assignedAttendant?.id || "",
  };
}

function getQuotationTopicLabel(request: SerializedQuoteRequest) {
  return (
    request.quoteTitle?.trim() ||
    request.preferredProducts?.trim() ||
    request.templateName?.trim() ||
    ""
  );
}

function dedupeItemNames(items: Array<{ itemName: string }>) {
  return Array.from(
    new Set(
      items
        .map((item) => item.itemName.trim())
        .filter(Boolean),
    ),
  );
}

function summarizeSelectedProducts(items: Array<{ itemName: string }>) {
  const itemNames = dedupeItemNames(items);
  if (!itemNames.length) return "";
  if (itemNames.length === 1) return itemNames[0];
  if (itemNames.length === 2) return itemNames.join(" + ");
  return `${itemNames[0]} + ${itemNames.length - 1} more items`;
}

function generateQuoteTitleFromItems(
  items: Array<{ itemName: string }>,
  projectType: QuoteProjectType,
) {
  const itemNames = dedupeItemNames(items);
  if (!itemNames.length) return formatProjectType(projectType);
  if (itemNames.length === 1) return `${itemNames[0]} quotation`;
  return `${itemNames[0]} + ${itemNames.length - 1} more items quotation`;
}

function applyTemplateToCreateDraft(
  current: CreateQuotationDraft,
  nextTemplate: SerializedQuotationTemplate | null,
) {
  if (!nextTemplate) {
    return { ...current, templateId: "", templateOwnerId: "" };
  }

  const templateFeeState = nextTemplate.items?.length
    ? splitQuoteItemsAndFees(
        nextTemplate.items.map((item) => ({
          itemName: item.itemName,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          defaultWarranty: item.defaultWarranty || "",
          warranty: item.warranty || "",
          warrantyPeriod: (item as { warrantyPeriod?: number | null }).warrantyPeriod,
          warrantyUnit: (item as { warrantyUnit?: QuoteWarrantyUnit | null }).warrantyUnit,
          warrantyNotes: item.warrantyNotes || "",
          warrantySource: item.warrantySource || "TEMPLATE_DEFAULT",
        })),
      )
    : null;
  const templateItems = templateFeeState?.quoteItems || current.quoteItems;
  const preferredProducts = summarizeSelectedProducts(templateItems);

  return {
    ...current,
    templateId: nextTemplate.id,
    templateOwnerId: nextTemplate.ownerAttendantId || "",
    quoteTitle: nextTemplate.templateName || generateQuoteTitleFromItems(templateItems, current.projectType),
    quoteMessage: nextTemplate.projectOverview || nextTemplate.scopeOfWork || current.quoteMessage,
    quoteItems: templateItems,
    discountAmount:
      nextTemplate.defaultDiscountAmount !== null &&
      nextTemplate.defaultDiscountAmount !== undefined
        ? String(nextTemplate.defaultDiscountAmount)
        : current.discountAmount,
    preferredProducts,
    warrantyMode: current.warrantyMode === "PER_ITEM" ? current.warrantyMode : "PER_ITEM",
    fullSystemWarranty: nextTemplate.warranty || current.fullSystemWarranty,
    projectOverview: nextTemplate.projectOverview || current.projectOverview,
    whatItCanPower: nextTemplate.whatItCanPower || current.whatItCanPower,
    whatPriceIncludes: nextTemplate.scopeOfWork || current.whatPriceIncludes,
    deliveryTimeline: nextTemplate.deliveryTimeline || current.deliveryTimeline,
    installationTimeline: nextTemplate.installationTimeline || current.installationTimeline,
    afterSalesSupport: nextTemplate.afterSalesSupport || current.afterSalesSupport,
    termsAndConditions: nextTemplate.terms || current.termsAndConditions,
    projectReferenceLinks:
      nextTemplate.projectReferenceLinks || current.projectReferenceLinks,
    followUpNotes: nextTemplate.internalNotes || current.followUpNotes,
    paymentMethod: nextTemplate.defaultPaymentMethod || current.paymentMethod,
    paymentTerms: nextTemplate.defaultPaymentTerms || current.paymentTerms,
    deliveryMode: templateFeeState?.deliveryMode || current.deliveryMode,
    installationMode: templateFeeState?.installationMode || current.installationMode,
    deliveryFee: templateFeeState?.deliveryFee || current.deliveryFee,
    installationFee: templateFeeState?.installationFee || current.installationFee,
    depositAmount:
      nextTemplate.defaultDepositAmount !== null &&
      nextTemplate.defaultDepositAmount !== undefined
        ? String(nextTemplate.defaultDepositAmount)
        : current.depositAmount,
    balanceAmount:
      nextTemplate.defaultBalanceAmount !== null &&
      nextTemplate.defaultBalanceAmount !== undefined
        ? String(nextTemplate.defaultBalanceAmount)
        : current.balanceAmount,
  };
}

function applyTemplateToResponseForm(
  current: QuoteDeskFormState,
  nextTemplate: SerializedQuotationTemplate | null,
) {
  if (!nextTemplate) {
    return current;
  }

  const templateFeeState = nextTemplate.items?.length
    ? splitQuoteItemsAndFees(
        nextTemplate.items.map((item) => ({
          itemName: item.itemName,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          defaultWarranty: item.defaultWarranty || "",
          warranty: item.warranty || "",
          warrantyPeriod: (item as { warrantyPeriod?: number | null }).warrantyPeriod,
          warrantyUnit: (item as { warrantyUnit?: QuoteWarrantyUnit | null }).warrantyUnit,
          warrantyNotes: item.warrantyNotes || "",
          warrantySource: item.warrantySource || "TEMPLATE_DEFAULT",
        })),
      )
    : null;

  return {
    ...current,
    quoteTitle:
      nextTemplate.templateName ||
      generateQuoteTitleFromItems(templateFeeState?.quoteItems || current.quoteItems, "SOLAR_HOME_SYSTEM"),
    quoteMessage: nextTemplate.projectOverview || nextTemplate.scopeOfWork || current.quoteMessage,
    quoteItems: templateFeeState?.quoteItems || current.quoteItems,
    discountAmount:
      nextTemplate.defaultDiscountAmount !== null &&
      nextTemplate.defaultDiscountAmount !== undefined
        ? String(nextTemplate.defaultDiscountAmount)
        : current.discountAmount,
    fullSystemWarranty: nextTemplate.warranty || current.fullSystemWarranty,
    projectOverview: nextTemplate.projectOverview || current.projectOverview,
    whatItCanPower: nextTemplate.whatItCanPower || current.whatItCanPower,
    whatPriceIncludes: nextTemplate.scopeOfWork || current.whatPriceIncludes,
    deliveryTimeline: nextTemplate.deliveryTimeline || current.deliveryTimeline,
    installationTimeline: nextTemplate.installationTimeline || current.installationTimeline,
    afterSalesSupport: nextTemplate.afterSalesSupport || current.afterSalesSupport,
    termsAndConditions: nextTemplate.terms || current.termsAndConditions,
    projectReferenceLinks: nextTemplate.projectReferenceLinks || current.projectReferenceLinks,
    followUpNotes: nextTemplate.internalNotes || current.followUpNotes,
    paymentMethod: nextTemplate.defaultPaymentMethod || current.paymentMethod,
    paymentTerms: nextTemplate.defaultPaymentTerms || current.paymentTerms,
    deliveryMode: templateFeeState?.deliveryMode || current.deliveryMode,
    installationMode: templateFeeState?.installationMode || current.installationMode,
    deliveryFee: templateFeeState?.deliveryFee || current.deliveryFee,
    installationFee: templateFeeState?.installationFee || current.installationFee,
    depositAmount:
      nextTemplate.defaultDepositAmount !== null &&
      nextTemplate.defaultDepositAmount !== undefined
        ? String(nextTemplate.defaultDepositAmount)
        : current.depositAmount,
    balanceAmount:
      nextTemplate.defaultBalanceAmount !== null &&
      nextTemplate.defaultBalanceAmount !== undefined
        ? String(nextTemplate.defaultBalanceAmount)
        : current.balanceAmount,
  };
}

function parseMoneyInput(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildQuotedTotals(input: {
  lineTotal: number;
  deliveryMode: QuoteFeeMode;
  installationMode: QuoteFeeMode;
  deliveryFee: string;
  installationFee: string;
  discountAmount: string;
}) {
  const serviceTotal =
    (input.installationMode === "CHARGED" ? parseMoneyInput(input.installationFee) : 0) +
    (input.deliveryMode === "CHARGED" ? parseMoneyInput(input.deliveryFee) : 0);
  const subtotal = input.lineTotal + serviceTotal;
  const discountAmount = Math.max(0, parseMoneyInput(input.discountAmount));
  const total = Math.max(0, subtotal - discountAmount);
  return { subtotal, discountAmount, total };
}

function buildTemplateDownloadPayload(draft: CreateQuotationDraft) {
  return buildTemplatePayloadFromDraft(draft);
}

function buildTemplatePayloadFromDraft(draft: CreateQuotationDraft) {
  return {
    templateName: draft.quoteTitle.trim() || generateQuoteTitleFromItems(draft.quoteItems, draft.projectType),
    category: "",
    ownerAttendantId: draft.templateOwnerId || undefined,
    systemSize: "",
    brand: "",
    projectOverview: draft.projectOverview.trim() || "",
    whatItCanPower: draft.whatItCanPower.trim() || "",
    scopeOfWork: draft.whatPriceIncludes.trim() || "",
    deliveryTimeline: draft.deliveryTimeline.trim() || "",
    installationTimeline: draft.installationTimeline.trim() || "",
    projectReferenceLinks: draft.projectReferenceLinks.trim() || "",
    warranty:
      (draft.warrantyMode === "FULL_SYSTEM" ? draft.fullSystemWarranty : draft.customWarranty).trim() || "",
    afterSalesSupport: draft.afterSalesSupport.trim() || "",
    terms: draft.termsAndConditions.trim() || "",
    internalNotes: draft.followUpNotes.trim() || "",
    defaultPaymentMethod: draft.paymentMethod || undefined,
    defaultPaymentTerms: draft.paymentTerms,
    defaultDepositAmount:
      draft.paymentTerms === "DEPOSIT_AND_BALANCE" && draft.depositAmount.trim()
        ? parseMoneyInput(draft.depositAmount)
        : undefined,
    defaultBalanceAmount:
      draft.paymentTerms === "DEPOSIT_AND_BALANCE" && draft.balanceAmount.trim()
        ? parseMoneyInput(draft.balanceAmount)
        : undefined,
    defaultDiscountAmount: draft.discountAmount.trim() ? parseMoneyInput(draft.discountAmount) : 0,
    items: buildSanitizedQuoteItems(draft.quoteItems, {
      deliveryMode: draft.deliveryMode,
      installationMode: draft.installationMode,
      deliveryFee: draft.deliveryFee,
      installationFee: draft.installationFee,
    }),
  };
}

function calculateDepositAndBalance(total: number) {
  const safeTotal = Number.isFinite(total) ? Math.max(0, total) : 0;
  const depositAmount = Math.round(safeTotal * 0.3);
  const balanceAmount = Math.max(0, safeTotal - depositAmount);
  return {
    depositAmount: String(depositAmount),
    balanceAmount: String(balanceAmount),
  };
}

function suggestWarrantyForItem(itemName: string) {
  const normalized = itemName.trim().toLowerCase();
  if (!normalized) return "";
  if (/\b(jinko|solar panel|panel|mono crystalline|bifacial)\b/.test(normalized)) {
    return "25 Years performance warranty";
  }
  if (/\b(srne|hybrid inverter|inverter)\b/.test(normalized)) {
    return "10 Years manufacturer warranty";
  }
  if (/\b(lithium|battery|lifepo4)\b/.test(normalized)) {
    return "10 Years manufacturer warranty";
  }
  if (/\b(controller|charge controller)\b/.test(normalized)) {
    return "12 months manufacturer warranty";
  }
  if (/\b(installation|workmanship|commissioning|testing)\b/.test(normalized)) {
    return "12 months workmanship warranty";
  }
  if (/\b(pump|borehole|water heater|purifier|cctv)\b/.test(normalized)) {
    return "Manufacturer warranty";
  }
  return "Manufacturer warranty";
}

function createServiceFeeItems(input: {
  deliveryMode: QuoteFeeMode;
  installationMode: QuoteFeeMode;
  deliveryFee: string;
  installationFee: string;
}) {
  const serviceItems: Array<{
    itemName: string;
    description?: string;
    quantity: number;
    unitPrice: number;
    warrantySource: QuoteWarrantySource;
  }> = [];

  if (input.installationMode === "CHARGED") {
    const amount = parseMoneyInput(input.installationFee);
    if (amount <= 0) {
      throw new Error("Enter the installation fee amount or switch installation to Included / Not included.");
    }
    serviceItems.push({
      itemName: "Installation Fee",
      description: "Quoted installation service",
      quantity: 1,
      unitPrice: amount,
      warrantySource: "CUSTOM",
    });
  }

  if (input.deliveryMode === "CHARGED") {
    const amount = parseMoneyInput(input.deliveryFee);
    if (amount <= 0) {
      throw new Error("Enter the transport fee amount or switch transport to Included / Not included.");
    }
    serviceItems.push({
      itemName: "Transport Fee",
      description: "Quoted transport / delivery service",
      quantity: 1,
      unitPrice: amount,
      warrantySource: "CUSTOM",
    });
  }

  return serviceItems;
}

function isInstallationFeeItem(itemName: string) {
  return /\binstallation fee\b/i.test(itemName.trim());
}

function isTransportFeeItem(itemName: string) {
  return /\btransport fee\b/i.test(itemName.trim());
}

function splitQuoteItemsAndFees(items: Array<{
  itemName: string;
  description?: string | null;
  quantity: number;
  unitPrice: number;
  defaultWarranty?: string | null;
  warranty?: string | null;
  warrantyPeriod?: number | null;
  warrantyUnit?: QuoteWarrantyUnit | null;
  warrantyNotes?: string | null;
  warrantySource?: QuoteWarrantySource;
}>) {
  let installationMode: QuoteFeeMode = "INCLUDED";
  let deliveryMode: QuoteFeeMode = "INCLUDED";
  let installationFee = "";
  let deliveryFee = "";

  const quoteItems = items
    .filter((item) => {
      if (isInstallationFeeItem(item.itemName)) {
        installationMode = "CHARGED";
        installationFee = String(item.unitPrice || item.quantity * item.unitPrice || 0);
        return false;
      }
      if (isTransportFeeItem(item.itemName)) {
        deliveryMode = "CHARGED";
        deliveryFee = String(item.unitPrice || item.quantity * item.unitPrice || 0);
        return false;
      }
      return true;
    })
    .map((item) =>
      hydrateQuoteItemDraft({
        itemName: item.itemName,
        description: item.description || "",
        quantity: String(item.quantity),
        unitPrice: String(item.unitPrice),
        defaultWarranty: item.defaultWarranty || "",
        warranty: item.warranty || "",
        warrantyPeriod: item.warrantyPeriod ?? undefined,
        warrantyUnit: item.warrantyUnit || undefined,
        warrantyNotes: item.warrantyNotes || "",
        warrantySource: item.warrantySource || "CUSTOM",
      }),
    );

  return {
    quoteItems,
    installationMode,
    deliveryMode,
    installationFee,
    deliveryFee,
  };
}

function buildSanitizedQuoteItems(
  items: QuoteItemDraft[],
  serviceInput?: {
    deliveryMode: QuoteFeeMode;
    installationMode: QuoteFeeMode;
    deliveryFee: string;
    installationFee: string;
  },
) {
  const baseItems = items
    .map((item) => ({
      itemName: item.itemName.trim(),
      description: item.description.trim() || undefined,
      quantity: parseMoneyInput(item.quantity),
      unitPrice: parseMoneyInput(item.unitPrice),
      defaultWarranty: item.defaultWarranty.trim() || undefined,
      warranty: composeWarrantyLabel(item) || undefined,
      warrantyPeriod: item.warrantyPeriod.trim() ? parseMoneyInput(item.warrantyPeriod) : undefined,
      warrantyUnit: item.warrantyUnit,
      warrantyNotes: item.warrantyNotes.trim() || undefined,
      warrantySource: item.warrantySource,
    }))
    .filter((item) => item.itemName.length > 0);

  const serviceItems = serviceInput ? createServiceFeeItems(serviceInput) : [];
  return [...baseItems, ...serviceItems];
}

function buildQuoteRequestPayload(formState: QuoteDeskFormState): QuoteRequestResponseInput {
  const quoteItems = buildSanitizedQuoteItems(formState.quoteItems, {
    deliveryMode: formState.deliveryMode,
    installationMode: formState.installationMode,
    deliveryFee: formState.deliveryFee,
    installationFee: formState.installationFee,
  });

  return {
    status: formState.status,
    quoteTitle: formState.quoteTitle.trim() || undefined,
    quoteMessage: formState.quoteMessage.trim() || undefined,
    quoteItems,
    discountAmount: formState.discountAmount.trim() ? parseMoneyInput(formState.discountAmount) : undefined,
    warrantyMode: formState.warrantyMode,
    fullSystemWarranty: formState.fullSystemWarranty.trim() || undefined,
    customWarranty: formState.customWarranty.trim() || undefined,
    warrantyGeneralNotes: formState.warrantyGeneralNotes.trim() || undefined,
    aiWarrantySummary: formState.aiWarrantySummary.trim() || undefined,
    projectOverview: formState.projectOverview.trim() || undefined,
    whatPriceIncludes: formState.whatPriceIncludes.trim() || undefined,
    whatItCanPower: formState.whatItCanPower.trim() || undefined,
    deliveryTimeline: formState.deliveryTimeline.trim() || undefined,
    installationTimeline: formState.installationTimeline.trim() || undefined,
    afterSalesSupport: formState.afterSalesSupport.trim() || undefined,
    importantNotes: formState.importantNotes.trim() || undefined,
    scopeExclusions: formState.scopeExclusions.trim() || undefined,
    similarProjects: formState.similarProjects.trim() || undefined,
    termsAndConditions: formState.termsAndConditions.trim() || undefined,
    preparedByDetails: formState.preparedByDetails.trim() || undefined,
    companyLegalDetails: formState.companyLegalDetails.trim() || undefined,
    projectReferenceLinks: formState.projectReferenceLinks.trim() || undefined,
    proposalVisibility: formState.proposalVisibility,
    paymentMethod: formState.paymentMethod || undefined,
    paymentTerms: formState.paymentTerms,
    deliveryMode: formState.deliveryMode,
    installationMode: formState.installationMode,
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

function applyProposalDefaults(
  projectType: QuoteProjectType,
  overrides?: Partial<QuoteProposalSections> | null,
) {
  const defaults = getProjectTypeDefaultSections(projectType);
  return {
    projectOverview: overrides?.projectOverview?.trim() || defaults.projectOverview,
    whatPriceIncludes: overrides?.whatPriceIncludes?.trim() || defaults.whatPriceIncludes,
    whatItCanPower: overrides?.whatItCanPower?.trim() || defaults.whatItCanPower,
    deliveryTimeline: overrides?.deliveryTimeline?.trim() || defaults.deliveryTimeline,
    installationTimeline: overrides?.installationTimeline?.trim() || defaults.installationTimeline,
    afterSalesSupport: overrides?.afterSalesSupport?.trim() || defaults.afterSalesSupport,
    importantNotes: overrides?.importantNotes?.trim() || defaults.importantNotes,
    scopeExclusions: overrides?.scopeExclusions?.trim() || defaults.scopeExclusions,
    similarProjects: overrides?.similarProjects?.trim() || defaults.similarProjects,
    termsAndConditions: overrides?.termsAndConditions?.trim() || defaults.termsAndConditions,
    preparedByDetails: overrides?.preparedByDetails?.trim() || defaults.preparedByDetails,
    companyLegalDetails: overrides?.companyLegalDetails?.trim() || defaults.companyLegalDetails,
    projectReferenceLinks: extractFirstProjectUrl(
      overrides?.projectReferenceLinks?.trim() || defaults.projectReferenceLinks,
    ),
    proposalVisibility: overrides?.visibility || defaults.visibility,
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

function parseWarrantyPeriodText(value: string | null | undefined) {
  const text = String(value || "").trim();
  const match = text.match(/(\d+(?:\.\d+)?)\s*(year|years|month|months)/i);
  if (!match) {
    return { warrantyPeriod: "", warrantyUnit: "YEARS" as QuoteWarrantyUnit };
  }
  const numeric = Number(match[1]);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return { warrantyPeriod: "", warrantyUnit: "YEARS" as QuoteWarrantyUnit };
  }
  return {
    warrantyPeriod: match[1],
    warrantyUnit: /month/i.test(match[2]) ? ("MONTHS" as QuoteWarrantyUnit) : ("YEARS" as QuoteWarrantyUnit),
  };
}

function normalizeWarrantyText(value: string | null | undefined) {
  const text = String(value || "").trim();
  if (!text) return "";
  const zeroPeriodMatch = text.match(/^0+(?:\.0+)?\s*(years?|months?)?$/i);
  if (zeroPeriodMatch) return "";
  return text;
}

function composeWarrantyLabel(item: {
  warrantyPeriod?: string | null;
  warrantyUnit?: QuoteWarrantyUnit | null;
  warranty?: string | null;
  defaultWarranty?: string | null;
}) {
  const period = String(item.warrantyPeriod || "").trim();
  if (period) {
    const numeric = Number(period);
    if (Number.isFinite(numeric) && numeric > 0) {
      const normalized = Number.isInteger(numeric) ? String(numeric) : String(numeric);
      return `${normalized} ${item.warrantyUnit === "MONTHS" ? "Months" : "Years"}`;
    }
  }
  return normalizeWarrantyText(item.warranty);
}

function hydrateQuoteItemDraft(input: {
  itemName: string;
  description?: string | null;
  quantity?: string;
  unitPrice?: string;
  defaultWarranty?: string | null;
  warranty?: string | null;
  warrantyPeriod?: string | number | null;
  warrantyUnit?: QuoteWarrantyUnit | null;
  warrantyNotes?: string | null;
  warrantySource?: QuoteWarrantySource;
}) {
  const normalizedWarranty = normalizeWarrantyText(input.warranty);
  const parsedWarranty =
    input.warrantyPeriod !== undefined &&
    input.warrantyPeriod !== null &&
    Number(input.warrantyPeriod) > 0
      ? {
          warrantyPeriod: String(input.warrantyPeriod),
          warrantyUnit: input.warrantyUnit ?? "YEARS",
        }
      : parseWarrantyPeriodText(normalizedWarranty);
  const hasStructuredWarranty = Boolean(parsedWarranty.warrantyPeriod);
  return {
    itemName: input.itemName,
    description: input.description?.trim() || "",
    quantity: input.quantity ?? "1",
    unitPrice: input.unitPrice ?? "",
    defaultWarranty: input.defaultWarranty?.trim() || "",
    warranty: hasStructuredWarranty ? "" : normalizedWarranty,
    warrantyPeriod: parsedWarranty.warrantyPeriod,
    warrantyUnit: parsedWarranty.warrantyUnit,
    warrantyNotes: input.warrantyNotes?.trim() || "",
    warrantySource: input.warrantySource ?? "CUSTOM",
  } satisfies QuoteItemDraft;
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

function normalizeWhatsAppPhone(phone: string | null | undefined) {
  const digits = String(phone || "").replace(/\D+/g, "");
  if (!digits) return null;
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  return digits;
}

function buildQuoteWhatsAppHref(request: SerializedQuoteRequest) {
  const target = normalizeWhatsAppPhone(request.customerPhone);
  if (!target) return null;
  const proposal = parseStoredQuoteProposal(request.quotationData);
  const lines = [
    `Hello ${request.customerName}, your Betech Solar quotation ${request.quoteRef} is ready.`,
    `Quote: ${request.quoteTitle || "Betech Solar quotation"}`,
    `Total: ${formatQuoteCurrency(proposal.total)}`,
    "Login with your phone number at https://www.betech.co.ke/account to view quotation details and download the quotation.",
    "Call 0722151083 if you need help.",
  ];
  return `https://wa.me/${target}?text=${encodeURIComponent(lines.join("\n"))}`;
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
  defaultStatusFilter = "PENDING",
  initialExpandedId = null,
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
  allowDelete = false,
  templateOwnerOptions = [],
  createOnlyMode = false,
  initialCreateOpen = false,
  allowTemplateSelection = true,
  createActionLabel = "Save Quotation",
  createSuccessMessage = "Quotation saved successfully. You can now email, SMS, WhatsApp, or download it.",
  assigneeOptions = [],
  assigneeLabel = "Quotation owner",
  requireAssigneeSelection = false,
  showMonitoringSummary = false,
  enableAdminFilters = false,
}: Props) {
  const [requests, setRequests] = useState<SerializedQuoteRequest[]>([]);
  const [statusFilter, setStatusFilter] = useState<QuoteRequestStatusFilter>(defaultStatusFilter);
  const [sourceFilter, setSourceFilter] = useState<QuoteRequestSource | "ALL">("ALL");
  const [staffFilter, setStaffFilter] = useState<string>("ALL");
  const [adminView, setAdminView] = useState<AdminQuotationView>("ALL");
  const [query, setQuery] = useState(q);
  const [expandedId, setExpandedId] = useState<string | null>(initialExpandedId);
  const [loading, setLoading] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(initialCreateOpen || createOnlyMode);
  const [showTemplatesPanel, setShowTemplatesPanel] = useState(false);
  const [showCreateMoreOptions, setShowCreateMoreOptions] = useState(false);
  const [showResponseMoreOptions, setShowResponseMoreOptions] = useState(false);
  const [createMode, setCreateMode] = useState<CreateQuotationMode>("manual");
  const [createDraft, setCreateDraft] = useState<CreateQuotationDraft>(createDefaultQuotationDraft());
  const [createItemAccordion, setCreateItemAccordion] = useState<boolean[]>([true]);
  const [templates, setTemplates] = useState<SerializedQuotationTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [createSaving, setCreateSaving] = useState(false);
  const [templateSaving, setTemplateSaving] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | null>(null);
  const [templateDeletingId, setTemplateDeletingId] = useState<string | null>(null);
  const [templateBuilderMode, setTemplateBuilderMode] = useState(false);
  const [templatePasteText, setTemplatePasteText] = useState("");
  const [draftOpening, setDraftOpening] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [followUpSendingId, setFollowUpSendingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [createCatalogQuery, setCreateCatalogQuery] = useState("");
  const [createCatalogLoading, setCreateCatalogLoading] = useState(false);
  const [createCatalogResults, setCreateCatalogResults] = useState<CatalogQuoteProduct[]>([]);
  const [responseCatalogQuery, setResponseCatalogQuery] = useState("");
  const [responseCatalogLoading, setResponseCatalogLoading] = useState(false);
  const [responseCatalogResults, setResponseCatalogResults] = useState<CatalogQuoteProduct[]>([]);
  const [responseTemplateId, setResponseTemplateId] = useState("");
  const [eventsByRequestId, setEventsByRequestId] = useState<Record<string, SerializedQuotationEvent[]>>({});
  const [eventsLoadingId, setEventsLoadingId] = useState<string | null>(null);
  const [projectByRequestId, setProjectByRequestId] = useState<Record<string, SerializedQuoteProjectOrder | null>>({});
  const [projectEventsByRequestId, setProjectEventsByRequestId] = useState<Record<string, SerializedQuoteProjectEvent[]>>({});
  const [projectDrafts, setProjectDrafts] = useState<Record<string, ProjectDraft>>({});
  const [projectLoadingId, setProjectLoadingId] = useState<string | null>(null);
  const [projectSavingId, setProjectSavingId] = useState<string | null>(null);
  const [selectedRequestIds, setSelectedRequestIds] = useState<string[]>([]);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<QuoteRequestStatus | "">("");
  const [bulkAssigneeId, setBulkAssigneeId] = useState<string>("");
  const createPanelRef = useRef<HTMLDivElement | null>(null);
  const templateUploadInputRef = useRef<HTMLInputElement | null>(null);
  const createItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const responseItemRefs = useRef<Array<HTMLDivElement | null>>([]);
  const impersonateId = apiQueryParams?.impersonateId ?? null;

  const expandedRequest = useMemo(
    () => requests.find((request) => request.id === expandedId) ?? null,
    [requests, expandedId],
  );

  const initialResponseStatus: QuoteRequestStatus = "QUOTED";
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

  const quoteTotalsPreview = useMemo(
    () =>
      buildQuotedTotals({
        lineTotal: quoteItemsPreview.reduce((sum, item) => sum + item.lineTotal, 0),
        deliveryMode: formState.deliveryMode,
        installationMode: formState.installationMode,
        deliveryFee: formState.deliveryFee,
        installationFee: formState.installationFee,
        discountAmount: formState.discountAmount,
      }),
    [
      formState.deliveryFee,
      formState.deliveryMode,
      formState.discountAmount,
      formState.installationFee,
      formState.installationMode,
      quoteItemsPreview,
    ],
  );

  const filteredRequests = useMemo(
    () =>
      requests.filter((request) => {
        if (enableAdminFilters && !matchesAdminView(request, adminView)) {
          return false;
        }
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
        const storedProposal = parseStoredQuoteProposal(request.quotationData);
        return [
          request.quoteRef,
          request.customerName,
          request.customerPhone,
          request.customerEmail || "",
          request.customerLocation || "",
          request.town || "",
          request.county || "",
          request.quoteTitle || "",
          request.templateName || "",
          request.preferredProducts || "",
          request.quoteMessage || "",
          ...storedProposal.items.flatMap((item) => [item.itemName, item.description || ""]),
        ].some((entry) => entry.toLowerCase().includes(value));
      }).sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt).getTime() -
            new Date(left.updatedAt || left.createdAt).getTime() ||
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [adminView, enableAdminFilters, end, query, requests, start],
  );

  const quoteBalancePreview = useMemo(() => {
    if (formState.paymentTerms !== "DEPOSIT_AND_BALANCE") return null;
    const depositAmount = parseMoneyInput(formState.depositAmount);
    const explicitBalance = formState.balanceAmount.trim() ? parseMoneyInput(formState.balanceAmount) : null;
    return explicitBalance ?? Math.max(0, quoteTotalsPreview.total - depositAmount);
  }, [formState.balanceAmount, formState.depositAmount, formState.paymentTerms, quoteTotalsPreview.total]);

  const createQuoteItemsPreview = useMemo(() => {
    return createDraft.quoteItems.map((item) => {
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
  }, [createDraft.quoteItems]);

  const createQuoteTotalsPreview = useMemo(
    () =>
      buildQuotedTotals({
        lineTotal: createQuoteItemsPreview.reduce((sum, item) => sum + item.lineTotal, 0),
        deliveryMode: createDraft.deliveryMode,
        installationMode: createDraft.installationMode,
        deliveryFee: createDraft.deliveryFee,
        installationFee: createDraft.installationFee,
        discountAmount: createDraft.discountAmount,
      }),
    [
      createDraft.deliveryFee,
      createDraft.deliveryMode,
      createDraft.discountAmount,
      createDraft.installationFee,
      createDraft.installationMode,
      createQuoteItemsPreview,
    ],
  );

  const createQuoteBalancePreview = useMemo(() => {
    if (createDraft.paymentTerms !== "DEPOSIT_AND_BALANCE") return null;
    const depositAmount = parseMoneyInput(createDraft.depositAmount);
    const explicitBalance = createDraft.balanceAmount.trim()
      ? parseMoneyInput(createDraft.balanceAmount)
      : null;
    return explicitBalance ?? Math.max(0, createQuoteTotalsPreview.total - depositAmount);
  }, [
    createDraft.balanceAmount,
    createDraft.depositAmount,
    createDraft.paymentTerms,
    createQuoteTotalsPreview.total,
  ]);

  const requestSummary = useMemo(() => {
    const pendingStatuses = new Set<QuoteRequestStatus>(QUOTE_REQUEST_ACTIONABLE_STATUSES);
    const websitePending = requests.filter(
      (request) => request.source === "WEBSITE_REQUEST" && pendingStatuses.has(request.status),
    ).length;
    const manualRequests = requests.filter((request) => !isWebsiteRequest(request)).length;
    const manualPending = requests.filter(
      (request) => !isWebsiteRequest(request) && pendingStatuses.has(request.status),
    ).length;
    return {
      total: requests.length,
      pending: requests.filter((request) => pendingStatuses.has(request.status)).length,
      quoted: requests.filter((request) => request.status === "QUOTED").length,
      converted: requests.filter((request) => request.status === "CONVERTED").length,
      websiteRequests: requests.filter((request) => request.source === "WEBSITE_REQUEST").length,
      websitePending,
      manualRequests,
      manualPending,
    };
  }, [requests]);

  const conversionAnalytics = useMemo(() => {
    const websiteRequests = requests.filter((request) => isWebsiteRequest(request));
    const manualRequests = requests.filter((request) => !isWebsiteRequest(request));
    const pendingRequests = requests.filter((request) => isPendingQuotationStatus(request.status));
    const quotedRequests = requests.filter((request) => request.status === "QUOTED");
    const convertedRequests = requests.filter((request) => request.status === "CONVERTED");
    const safePercent = (numerator: number, denominator: number) =>
      denominator > 0 ? `${Math.round((numerator / denominator) * 100)}%` : "0%";

    return {
      websiteQuoteRate: safePercent(
        websiteRequests.filter((request) => ["QUOTED", "APPROVED", "CONVERTED"].includes(request.status)).length,
        websiteRequests.length,
      ),
      manualQuoteRate: safePercent(
        manualRequests.filter((request) => ["QUOTED", "APPROVED", "CONVERTED"].includes(request.status)).length,
        manualRequests.length,
      ),
      conversionRate: safePercent(
        convertedRequests.length,
        requests.filter((request) => ["APPROVED", "CONVERTED"].includes(request.status)).length,
      ),
      workloadSplit: `${pendingRequests.length} action / ${
        requests.filter((request) => ["QUOTED", "APPROVED", "CONVERTED"].includes(request.status)).length
      } delivered`,
    };
  }, [requests]);

  useEffect(() => {
    setSelectedRequestIds((current) => current.filter((id) => requests.some((request) => request.id === id)));
  }, [requests]);

  useEffect(() => {
    setCreateItemAccordion((current) => {
      const nextLength = createDraft.quoteItems.length;
      if (nextLength <= 0) return [];
      if (current.length === nextLength) return current;
      if (current.length < nextLength) {
        return [...current, ...Array.from({ length: nextLength - current.length }, () => true)];
      }
      return current.slice(0, nextLength);
    });
  }, [createDraft.quoteItems.length]);

  useEffect(() => {
    if (createDraft.paymentTerms !== "DEPOSIT_AND_BALANCE") {
      if (!createDraft.depositAmount && !createDraft.balanceAmount) return;
      setCreateDraft((current) => ({ ...current, depositAmount: "", balanceAmount: "" }));
      return;
    }
    const next = calculateDepositAndBalance(createQuoteTotalsPreview.total);
    if (
      createDraft.depositAmount === next.depositAmount &&
      createDraft.balanceAmount === next.balanceAmount
    ) {
      return;
    }
    setCreateDraft((current) => ({
      ...current,
      depositAmount: next.depositAmount,
      balanceAmount: next.balanceAmount,
    }));
  }, [
    createDraft.balanceAmount,
    createDraft.depositAmount,
    createDraft.paymentTerms,
    createQuoteTotalsPreview.total,
  ]);

  useEffect(() => {
    if (formState.paymentTerms !== "DEPOSIT_AND_BALANCE") {
      if (!formState.depositAmount && !formState.balanceAmount) return;
      setFormState((current) => ({ ...current, depositAmount: "", balanceAmount: "" }));
      return;
    }
    const next = calculateDepositAndBalance(quoteTotalsPreview.total);
    if (
      formState.depositAmount === next.depositAmount &&
      formState.balanceAmount === next.balanceAmount
    ) {
      return;
    }
    setFormState((current) => ({
      ...current,
      depositAmount: next.depositAmount,
      balanceAmount: next.balanceAmount,
    }));
  }, [
    formState.balanceAmount,
    formState.depositAmount,
    formState.paymentTerms,
    quoteTotalsPreview.total,
  ]);

  async function refreshRequests(
    nextStatus = statusFilter,
    nextQuery = query,
    nextSource: QuoteRequestSource | "ALL" = sourceFilter,
    nextStaffId = staffFilter,
  ) {
    if (createOnlyMode) {
      setRequests([]);
      setExpandedId(null);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch(
        buildApiUrl(apiBasePath, apiQueryParams, "", {
          status: nextStatus,
          ...(nextSource !== "ALL" ? { source: nextSource } : {}),
          ...(nextStaffId !== "ALL" ? { staffId: nextStaffId } : {}),
          ...(nextQuery.trim() ? { q: nextQuery.trim() } : {}),
        }),
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load quotation requests.");
      }
      setRequests(data.requests);
      setExpandedId((current) =>
        current && data.requests.some((request: SerializedQuoteRequest) => request.id === current)
          ? current
          : null,
      );
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Failed to load quotation requests.");
    } finally {
      setLoading(false);
    }
  }

  async function refreshTemplates() {
    if (!allowTemplateManager && !allowTemplateSelection) {
      setTemplates([]);
      return;
    }
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

  async function loadRequestEvents(requestId: string) {
    if (!enableAdminFilters || eventsByRequestId[requestId]) return;
    setEventsLoadingId(requestId);
    try {
      const response = await fetch(buildApiUrl(apiBasePath, apiQueryParams, `${requestId}/events`), {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load quotation activity.");
      }
      setEventsByRequestId((current) => ({ ...current, [requestId]: Array.isArray(data.events) ? data.events : [] }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load quotation activity.");
    } finally {
      setEventsLoadingId(null);
    }
  }

  async function loadProjectWorkflow(request: SerializedQuoteRequest) {
    if (!enableAdminFilters) return;
    setProjectLoadingId(request.id);
    try {
      const response = await fetch(buildApiUrl(apiBasePath, apiQueryParams, `${request.id}/project`), {
        cache: "no-store",
      });
      const data = await response.json().catch(() => null);
      if (response.status === 404) {
        setProjectByRequestId((current) => ({ ...current, [request.id]: null }));
        setProjectEventsByRequestId((current) => ({ ...current, [request.id]: [] }));
        setProjectDrafts((current) => ({
          ...current,
          [request.id]: createProjectDraft(
            null,
            parseStoredQuoteProposal(request.quotationData).total,
          ),
        }));
        return;
      }
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to load project workflow.");
      }
      const nextOrder = (data.projectOrder ?? null) as SerializedQuoteProjectOrder | null;
      const nextEvents = Array.isArray(data.projectEvents) ? (data.projectEvents as SerializedQuoteProjectEvent[]) : [];
      setProjectByRequestId((current) => ({ ...current, [request.id]: nextOrder }));
      setProjectEventsByRequestId((current) => ({ ...current, [request.id]: nextEvents }));
      setProjectDrafts((current) => ({
        ...current,
        [request.id]: createProjectDraft(nextOrder, parseStoredQuoteProposal(request.quotationData).total),
      }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to load project workflow.");
    } finally {
      setProjectLoadingId(null);
    }
  }

  async function createProjectWorkflow(request: SerializedQuoteRequest) {
    setProjectSavingId(request.id);
    setMessage(null);
    try {
      const draft = projectDrafts[request.id] ?? createProjectDraft(null, parseStoredQuoteProposal(request.quotationData).total);
      const response = await fetch(buildApiUrl(apiBasePath, apiQueryParams, `${request.id}/project`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentTerm: draft.paymentTerm,
          depositPercent: Number(draft.depositPercent || 30),
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to create project workflow.");
      }
      if (data.projectOrder) {
        setProjectByRequestId((current) => ({ ...current, [request.id]: data.projectOrder as SerializedQuoteProjectOrder }));
      }
      if (Array.isArray(data.projectEvents)) {
        setProjectEventsByRequestId((current) => ({ ...current, [request.id]: data.projectEvents as SerializedQuoteProjectEvent[] }));
      }
      setProjectDrafts((current) => ({
        ...current,
        [request.id]: createProjectDraft(
          (data.projectOrder ?? null) as SerializedQuoteProjectOrder | null,
          parseStoredQuoteProposal(request.quotationData).total,
        ),
      }));
      setMessage("Project workflow created.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to create project workflow.");
    } finally {
      setProjectSavingId(null);
    }
  }

  async function saveProjectWorkflow(request: SerializedQuoteRequest) {
    const draft = projectDrafts[request.id];
    if (!draft) return;
    setProjectSavingId(request.id);
    setMessage(null);
    try {
      const response = await fetch(buildApiUrl(apiBasePath, apiQueryParams, `${request.id}/project`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          stage: draft.stage,
          paymentTerm: draft.paymentTerm,
          totalAmount: Number(draft.totalAmount || 0),
          depositPercent: Number(draft.depositPercent || 0),
          depositPaidAmount: Number(draft.depositPaidAmount || 0),
          amountPaidTotal: Number(draft.amountPaidTotal || 0),
          scheduledDate: draft.scheduledDate || null,
          postedReceiptNumber: draft.postedReceiptNumber || null,
          internalNotes: draft.internalNotes || null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to update project workflow.");
      }
      const nextOrder = (data.projectOrder ?? null) as SerializedQuoteProjectOrder | null;
      const nextRequest = (data.quoteRequest ?? null) as SerializedQuoteRequest | null;
      if (nextRequest) {
        setRequests((current) => current.map((row) => (row.id === nextRequest.id ? nextRequest : row)));
      }
      setProjectByRequestId((current) => ({ ...current, [request.id]: nextOrder }));
      setProjectEventsByRequestId((current) => ({
        ...current,
        [request.id]: Array.isArray(data.projectEvents) ? (data.projectEvents as SerializedQuoteProjectEvent[]) : [],
      }));
      setProjectDrafts((current) => ({
        ...current,
        [request.id]: createProjectDraft(nextOrder, parseStoredQuoteProposal((nextRequest ?? request).quotationData).total),
      }));
      setMessage("Project workflow updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to update project workflow.");
    } finally {
      setProjectSavingId(null);
    }
  }

  async function handleBulkApply() {
    if (!selectedRequestIds.length) {
      setMessage("Select at least one quotation first.");
      return;
    }
    if (!bulkStatus && !bulkAssigneeId) {
      setMessage("Choose a bulk status or staff owner first.");
      return;
    }
    setBulkSaving(true);
    setMessage(null);
    try {
      const response = await fetch(buildApiUrl(apiBasePath, apiQueryParams, "bulk"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: selectedRequestIds,
          status: bulkStatus || undefined,
          assignedAttendantId: bulkAssigneeId || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to apply bulk quotation action.");
      }
      setSelectedRequestIds([]);
      setBulkStatus("");
      setBulkAssigneeId("");
      await refreshRequests();
      setMessage(`Updated ${data.updatedCount || selectedRequestIds.length} quotation record(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to apply bulk quotation action.");
    } finally {
      setBulkSaving(false);
    }
  }

  function applyAdminView(view: AdminQuotationView) {
    setAdminView(view);
    if (view === "WEBSITE") {
      setSourceFilter("WEBSITE_REQUEST");
      setStatusFilter("ALL");
      refreshRequests("ALL", query, "WEBSITE_REQUEST", staffFilter).catch(() => undefined);
      return;
    }
    if (view === "WEBSITE_PENDING") {
      setSourceFilter("WEBSITE_REQUEST");
      setStatusFilter("ALL");
      refreshRequests("ALL", query, "WEBSITE_REQUEST", staffFilter).catch(() => undefined);
      return;
    }
    if (view === "PENDING") {
      setSourceFilter("ALL");
      setStatusFilter("ALL");
      refreshRequests("ALL", query, "ALL", staffFilter).catch(() => undefined);
      return;
    }
    if (view === "QUOTED") {
      setSourceFilter("ALL");
      setStatusFilter("QUOTED");
      refreshRequests("QUOTED", query, "ALL", staffFilter).catch(() => undefined);
      return;
    }
    if (view === "CONVERTED") {
      setSourceFilter("ALL");
      setStatusFilter("CONVERTED");
      refreshRequests("CONVERTED", query, "ALL", staffFilter).catch(() => undefined);
      return;
    }
    if (view === "MANUAL") {
      setSourceFilter("ALL");
      setStatusFilter("ALL");
      refreshRequests("ALL", query, "ALL", staffFilter).catch(() => undefined);
      return;
    }
    setSourceFilter("ALL");
    setStatusFilter("ALL");
    refreshRequests("ALL", query, "ALL", staffFilter).catch(() => undefined);
  }

  function applyBulkPreset(input: { status?: QuoteRequestStatus; assigneeId?: string }) {
    if (input.status) setBulkStatus(input.status);
    if (typeof input.assigneeId === "string") setBulkAssigneeId(input.assigneeId);
  }

  async function handleCreateQuotation() {
    setCreateSaving(true);
    setMessage(null);
    try {
      const selectedTemplate = templates.find((template) => template.id === createDraft.templateId) ?? null;
      const quoteItems = buildSanitizedQuoteItems(createDraft.quoteItems, {
        deliveryMode: createDraft.deliveryMode,
        installationMode: createDraft.installationMode,
        deliveryFee: createDraft.deliveryFee,
        installationFee: createDraft.installationFee,
      });
      if (!quoteItems.length) {
        throw new Error("Add at least one quotation item before saving the quotation.");
      }
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
        assignedAttendantId: createDraft.assignedAttendantId || undefined,
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
        quoteItems,
        discountAmount: createDraft.discountAmount.trim()
          ? parseMoneyInput(createDraft.discountAmount)
          : undefined,
        warrantyMode: createDraft.warrantyMode,
        fullSystemWarranty: createDraft.fullSystemWarranty.trim() || undefined,
        customWarranty: createDraft.customWarranty.trim() || undefined,
        warrantyGeneralNotes: createDraft.warrantyGeneralNotes.trim() || undefined,
        aiWarrantySummary: createDraft.aiWarrantySummary.trim() || undefined,
        projectOverview: createDraft.projectOverview.trim() || undefined,
        whatPriceIncludes: createDraft.whatPriceIncludes.trim() || undefined,
        whatItCanPower: createDraft.whatItCanPower.trim() || undefined,
        deliveryTimeline: createDraft.deliveryTimeline.trim() || undefined,
        installationTimeline: createDraft.installationTimeline.trim() || undefined,
        afterSalesSupport: createDraft.afterSalesSupport.trim() || undefined,
        importantNotes: createDraft.importantNotes.trim() || undefined,
        scopeExclusions: createDraft.scopeExclusions.trim() || undefined,
        similarProjects: createDraft.similarProjects.trim() || undefined,
        termsAndConditions: createDraft.termsAndConditions.trim() || undefined,
        preparedByDetails: createDraft.preparedByDetails.trim() || undefined,
        companyLegalDetails: createDraft.companyLegalDetails.trim() || undefined,
        projectReferenceLinks: createDraft.projectReferenceLinks.trim() || undefined,
        proposalVisibility: createDraft.proposalVisibility,
        paymentMethod: createDraft.paymentMethod || undefined,
        paymentTerms: createDraft.paymentTerms,
        deliveryMode: createDraft.deliveryMode,
        installationMode: createDraft.installationMode,
        depositAmount:
          createDraft.paymentTerms === "DEPOSIT_AND_BALANCE" && createDraft.depositAmount.trim()
            ? parseMoneyInput(createDraft.depositAmount)
            : undefined,
        balanceAmount:
          createDraft.paymentTerms === "DEPOSIT_AND_BALANCE" && createDraft.balanceAmount.trim()
            ? parseMoneyInput(createDraft.balanceAmount)
            : undefined,
        followUpNotes: createDraft.followUpNotes.trim() || undefined,
      };

      const response = await fetch(buildApiUrl(createApiPath, apiQueryParams), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save quotation.");
      }
      setStatusFilter("ALL");
      setQuery("");
      if (data.request) {
        setRequests((current) => {
          const existing = current.filter((request) => request.id !== data.request.id);
          return [data.request, ...existing];
        });
        setExpandedId(null);
      }
      setShowCreatePanel(createOnlyMode);
      setShowCreateMoreOptions(false);
      setEditingTemplateId(null);
      setTemplateBuilderMode(false);
      setTemplatePasteText("");
      setCreateDraft(createDefaultQuotationDraft());
      setCreateItemAccordion([true]);
      setCreateCatalogQuery("");
      setCreateCatalogResults([]);
      if (!createOnlyMode) {
        await refreshRequests("ALL", "");
      }
      if (!createOnlyMode && data.request?.id) {
        setExpandedId(null);
      }
      setMessage(createSuccessMessage);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save quotation.");
    } finally {
      setCreateSaving(false);
    }
  }

  async function handleDeleteQuotation(request: SerializedQuoteRequest) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        `Delete quotation ${request.quoteRef} for ${request.customerName}? This cannot be undone.`,
      );
      if (!confirmed) return;
    }

    setDeletingId(request.id);
    setMessage(null);
    try {
      const response = await fetch(buildApiUrl(apiBasePath, apiQueryParams, request.id), {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to delete quotation.");
      }
      setRequests((current) => current.filter((entry) => entry.id !== request.id));
      setExpandedId((current) => (current === request.id ? null : current));
      setMessage(`Quotation ${request.quoteRef} deleted successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete quotation.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleSaveTemplateFromDraft() {
    setTemplateSaving(true);
    setMessage(null);
    try {
      const quoteItems = buildSanitizedQuoteItems(createDraft.quoteItems, {
        deliveryMode: createDraft.deliveryMode,
        installationMode: createDraft.installationMode,
        deliveryFee: createDraft.deliveryFee,
        installationFee: createDraft.installationFee,
      });
      if (!quoteItems.length) {
        throw new Error("Add at least one quotation item before saving a template.");
      }

      const templateName =
        createDraft.quoteTitle.trim() ||
        generateQuoteTitleFromItems(createDraft.quoteItems, createDraft.projectType);

      const payload = {
        ...buildTemplatePayloadFromDraft(createDraft),
        templateName,
        items: quoteItems,
      };
      const isEditing = Boolean(editingTemplateId);
      const response = await fetch(
        isEditing
          ? buildApiUrl(templateApiPath, apiQueryParams, editingTemplateId || "")
          : buildApiUrl(templateApiPath, apiQueryParams),
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save quotation template.");
      }
      await refreshTemplates();
      if (data.template?.id) {
        setEditingTemplateId(data.template.id);
        setCreateMode("template");
        setCreateDraft((current) => ({
          ...current,
          templateId: data.template.id,
          templateOwnerId: data.template.ownerAttendantId || "",
          quoteTitle: data.template.templateName,
        }));
      }
      setMessage(
        isEditing
          ? `Template ${data.template?.templateName || templateName} updated successfully.`
          : "Quotation template saved. You can now reuse it from prepared templates.",
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save quotation template.");
    } finally {
      setTemplateSaving(false);
    }
  }

  function handleDownloadTemplate(template: SerializedQuotationTemplate) {
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `${template.templateName.replace(/[^a-z0-9]+/gi, "_") || "quotation_template"}.json`;
    link.click();
    URL.revokeObjectURL(href);
  }

  function handleEditTemplate(template: SerializedQuotationTemplate) {
    const nextDraft = applyTemplateToCreateDraft(createDefaultQuotationDraft(), template);
    setEditingTemplateId(template.id);
    setTemplateBuilderMode(true);
    setTemplatePasteText("");
    setShowTemplatesPanel(false);
    setShowCreatePanel(true);
    setShowCreateMoreOptions(false);
    setCreateMode("template");
    setCreateDraft(nextDraft);
    setCreateItemAccordion(nextDraft.quoteItems.length ? nextDraft.quoteItems.map(() => true) : [true]);
    setCreateCatalogQuery("");
    setCreateCatalogResults([]);
    setMessage(`Editing template ${template.templateName}. Update the fields you need, then save the template.`);
  }

  function handleUseTemplate(template: SerializedQuotationTemplate) {
    const nextDraft = applyTemplateToCreateDraft(createDefaultQuotationDraft(), template);
    setEditingTemplateId(null);
    setTemplateBuilderMode(false);
    setTemplatePasteText("");
    setShowTemplatesPanel(false);
    setShowCreatePanel(true);
    setShowCreateMoreOptions(false);
    setCreateMode("template");
    setCreateDraft(nextDraft);
    setCreateItemAccordion(nextDraft.quoteItems.length ? nextDraft.quoteItems.map(() => true) : [true]);
    setCreateCatalogQuery("");
    setCreateCatalogResults([]);
  }

  async function handleDeleteTemplate(template: SerializedQuotationTemplate) {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`Delete template ${template.templateName}? This cannot be undone.`);
      if (!confirmed) return;
    }
    setTemplateDeletingId(template.id);
    setMessage(null);
    try {
      const response = await fetch(buildApiUrl(templateApiPath, apiQueryParams, template.id), {
        method: "DELETE",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to delete quotation template.");
      }
      setTemplates((current) => current.filter((entry) => entry.id !== template.id));
      if (editingTemplateId === template.id) {
        setEditingTemplateId(null);
        setCreateDraft((current) => ({ ...current, templateId: "" }));
      }
      setMessage(`Template ${template.templateName} deleted successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to delete quotation template.");
    } finally {
      setTemplateDeletingId(null);
    }
  }

  function openCreatePanel(prefillRequest?: SerializedQuoteRequest | null) {
    const nextOpen = !showCreatePanel || Boolean(prefillRequest);
    setShowCreatePanel(nextOpen);
    setShowTemplatesPanel(false);
    setShowCreateMoreOptions(false);
    setEditingTemplateId(null);
    setTemplateBuilderMode(false);
    setTemplatePasteText("");
    setCreateMode("manual");
    if (nextOpen) {
      const nextDraft = prefillRequest ? buildCreateDraftFromRequest(prefillRequest) : createDefaultQuotationDraft();
      setCreateDraft(nextDraft);
      setCreateItemAccordion(nextDraft.quoteItems.length ? nextDraft.quoteItems.map(() => true) : [true]);
      setCreateCatalogQuery("");
      setCreateCatalogResults([]);
    }
  }

  function handleCopyQuotation(request: SerializedQuoteRequest) {
    const nextDraft = buildCreateDraftFromExistingQuotation(request);
    setShowCreatePanel(true);
    setShowTemplatesPanel(false);
    setShowCreateMoreOptions(false);
    setEditingTemplateId(null);
    setTemplateBuilderMode(false);
    setTemplatePasteText("");
    setCreateMode("manual");
    setCreateDraft(nextDraft);
    setCreateItemAccordion(nextDraft.quoteItems.length ? nextDraft.quoteItems.map(() => true) : [true]);
    setCreateCatalogQuery("");
    setCreateCatalogResults([]);
    requestAnimationFrame(() => {
      createPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    setMessage(
      `Copied quotation ${request.quoteRef}. Update customer details, quantities, pricing, then save the new quotation.`,
    );
  }

  async function handleSaveRequestAsTemplate(request: SerializedQuoteRequest) {
    try {
      setTemplateSaving(true);
      setMessage(null);
      const draft = buildCreateDraftFromExistingQuotation(request);
      const quoteItems = buildSanitizedQuoteItems(draft.quoteItems, {
        deliveryMode: draft.deliveryMode,
        installationMode: draft.installationMode,
        deliveryFee: draft.deliveryFee,
        installationFee: draft.installationFee,
      });
      if (!quoteItems.length) {
        throw new Error("Add at least one quotation item before saving a template.");
      }

      const templateName =
        draft.quoteTitle.trim() ||
        request.quoteTitle?.trim() ||
        generateQuoteTitleFromItems(draft.quoteItems, draft.projectType);

      const payload = {
        ...buildTemplatePayloadFromDraft({
          ...draft,
          quoteTitle: templateName,
          templateOwnerId: request.assignedAttendant?.id || draft.templateOwnerId,
        }),
        templateName,
        items: quoteItems,
      };

      const response = await fetch(buildApiUrl(templateApiPath, apiQueryParams), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save quotation template.");
      }

      await refreshTemplates();
      setMessage(`Template ${data.template?.templateName || templateName} saved successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save quotation template.");
    } finally {
      setTemplateSaving(false);
    }
  }

  function openTemplateBuilder() {
    const nextDraft = createDefaultQuotationDraft();
    setShowCreatePanel(true);
    setShowTemplatesPanel(false);
    setShowCreateMoreOptions(true);
    setEditingTemplateId(null);
    setTemplateBuilderMode(true);
    setTemplatePasteText("");
    setCreateMode("manual");
    setCreateDraft(nextDraft);
    setCreateItemAccordion([true]);
    setCreateCatalogQuery("");
    setCreateCatalogResults([]);
    setMessage("Paste the quotation BOQ text, parse it, review the items, then save the template.");
  }

  function handleDownloadTemplateFormat() {
    const payload = buildTemplateDownloadPayload(createDraft);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = "betech-quotation-template.json";
    link.click();
    URL.revokeObjectURL(href);
  }

  async function handleTemplateFileSelected(file: File | null) {
    if (!file) return;
    setTemplateSaving(true);
    setMessage(null);
    try {
      const text = await file.text();
      const raw = JSON.parse(text) as Record<string, unknown>;
      const body = {
        ...raw,
        templateName: String(raw.templateName || "").trim() || file.name.replace(/\.json$/i, ""),
        ownerAttendantId: createDraft.templateOwnerId || raw.ownerAttendantId || undefined,
      };
      const response = await fetch(buildApiUrl(templateApiPath, apiQueryParams), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to upload quotation template.");
      }
      await refreshTemplates();
      if (data.template?.id) {
        const nextDraft = applyTemplateToCreateDraft(createDefaultQuotationDraft(), data.template);
        setCreateMode("template");
        setTemplateBuilderMode(true);
        setShowCreateMoreOptions(false);
        setCreateDraft(nextDraft);
        setCreateItemAccordion(nextDraft.quoteItems.length ? nextDraft.quoteItems.map(() => true) : [true]);
      }
      setMessage(`Template ${data.template?.templateName || body.templateName} uploaded successfully.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to upload quotation template.");
    } finally {
      if (templateUploadInputRef.current) {
        templateUploadInputRef.current.value = "";
      }
      setTemplateSaving(false);
    }
  }

  function handleParseTemplatePaste() {
    setMessage(null);
    try {
      const parsed = parsePastedQuotationTemplate(templatePasteText);
      const autoTitle = generateQuoteTitleFromItems(parsed.quoteItems, createDraft.projectType);
      setCreateDraft((current) => ({
        ...current,
        quoteItems: parsed.quoteItems,
        discountAmount: parsed.discountAmount,
        quoteTitle: current.quoteTitle.trim() || parsed.quoteTitle || autoTitle,
        preferredProducts: summarizeSelectedProducts(parsed.quoteItems),
        quoteMessage: current.quoteMessage.trim() || "Prepared quotation template parsed from the supplied BOQ.",
        followUpNotes: parsed.notes || current.followUpNotes,
      }));
      setCreateItemAccordion(parsed.quoteItems.map(() => true));
      setShowCreateMoreOptions(true);
      setMessage(`Parsed ${parsed.quoteItems.length} quotation item${parsed.quoteItems.length === 1 ? "" : "s"} from the pasted template.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to parse the pasted template.");
    }
  }

  async function searchCatalog(
    searchQuery: string,
    options: {
      setLoading: (value: boolean) => void;
      setResults: (value: CatalogQuoteProduct[]) => void;
    },
  ) {
    const normalizedQuery = searchQuery.trim();
    if (!normalizedQuery) {
      options.setResults([]);
      return;
    }

    options.setLoading(true);
    setMessage(null);
    try {
      const response = await fetch(
        buildApiUrl("/api/attendant/quotation-center/catalog-search", apiQueryParams, "", {
          query: normalizedQuery,
          limit: "6",
        }),
        { cache: "no-store" },
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to search the catalog.");
      }
      options.setResults(Array.isArray(data.products) ? data.products : []);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to search the catalog.");
      options.setResults([]);
    } finally {
      options.setLoading(false);
    }
  }

  function appendCreateQuoteItem(nextItem?: QuoteItemDraft) {
    setCreateDraft((current) => {
      const quoteItems = [...current.quoteItems, nextItem ?? createEmptyQuoteItem()];
      return {
        ...current,
        quoteItems,
      };
    });
    setCreateItemAccordion((current) => [...current, true]);
  }

  function appendResponseQuoteItem(nextItem?: QuoteItemDraft) {
    setFormState((current) => {
      const quoteItems = [...current.quoteItems, nextItem ?? createEmptyQuoteItem()];
      return {
        ...current,
        quoteItems,
      };
    });
  }

  function addCreateCatalogItem(product: CatalogQuoteProduct) {
    let nextIndex = 0;
    setCreateDraft((current) => {
      const currentItems = current.quoteItems.filter((item) => item.itemName.trim() || item.unitPrice.trim() || item.description.trim());
      const previousAutoTitle = generateQuoteTitleFromItems(currentItems, current.projectType);
      const nextItems = [
        ...currentItems,
        hydrateQuoteItemDraft({
          itemName: product.productName,
          description: "",
          quantity: "1",
          unitPrice: String(product.price),
          defaultWarranty: "",
          warranty: "",
          warrantySource: "CUSTOM",
        }),
      ];
      nextIndex = nextItems.length - 1;
      return {
        ...current,
        preferredProducts: summarizeSelectedProducts(nextItems),
        quoteTitle:
          !current.quoteTitle.trim() || current.quoteTitle.trim() === previousAutoTitle
            ? generateQuoteTitleFromItems(nextItems, current.projectType)
            : current.quoteTitle,
        quoteItems: nextItems,
      };
    });
    setCreateItemAccordion((current) => {
      const next = Array.from(
        { length: Math.max(current.length, nextIndex + 1) },
        (_, entryIndex) => current[entryIndex] ?? true,
      );
      next[nextIndex] = true;
      return next;
    });
    setCreateCatalogQuery("");
    setCreateCatalogResults([]);
  }

  function addResponseCatalogItem(product: CatalogQuoteProduct) {
    setFormState((current) => {
      const projectType = expandedRequest?.projectType || "SOLAR_HOME_SYSTEM";
      const currentItems = current.quoteItems.filter((item) => item.itemName.trim() || item.unitPrice.trim() || item.description.trim());
      const previousAutoTitle = generateQuoteTitleFromItems(currentItems, projectType);
      const nextItems = [
        ...currentItems,
        hydrateQuoteItemDraft({
          itemName: product.productName,
          description: "",
          quantity: "1",
          unitPrice: String(product.price),
          defaultWarranty: "",
          warranty: "",
          warrantySource: "CUSTOM",
        }),
      ];
      return {
        ...current,
        quoteTitle:
          !current.quoteTitle.trim() || current.quoteTitle.trim() === previousAutoTitle
            ? generateQuoteTitleFromItems(nextItems, projectType)
            : current.quoteTitle,
        quoteItems: nextItems,
      };
    });
    setResponseCatalogQuery("");
    setResponseCatalogResults([]);
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
    if (initialExpandedId) {
      setExpandedId(initialExpandedId);
    }
  }, [initialExpandedId]);

  useEffect(() => {
    if (createOnlyMode) return;
    refreshRequests().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createOnlyMode]);

  useEffect(() => {
    if (!showCreatePanel && !showTemplatesPanel) return;
    if (!allowTemplateManager && !allowTemplateSelection) return;
    if (templates.length) return;
    refreshTemplates().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowTemplateManager, allowTemplateSelection, showCreatePanel, showTemplatesPanel]);

  useEffect(() => {
    if (allowTemplateSelection) return;
    setCreateMode("manual");
  }, [allowTemplateSelection]);

  useEffect(() => {
    const normalizedQuery = createCatalogQuery.trim();
    if (normalizedQuery.length < CATALOG_SEARCH_MIN_CHARS) {
      setCreateCatalogLoading(false);
      setCreateCatalogResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchCatalog(normalizedQuery, {
        setLoading: setCreateCatalogLoading,
        setResults: setCreateCatalogResults,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [createCatalogQuery]);

  useEffect(() => {
    const normalizedQuery = responseCatalogQuery.trim();
    if (normalizedQuery.length < CATALOG_SEARCH_MIN_CHARS) {
      setResponseCatalogLoading(false);
      setResponseCatalogResults([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void searchCatalog(normalizedQuery, {
        setLoading: setResponseCatalogLoading,
        setResults: setResponseCatalogResults,
      });
    }, 250);

    return () => window.clearTimeout(timeoutId);
  }, [responseCatalogQuery]);

  useEffect(() => {
    if (!showCreatePanel) return;
    setCreateDraft((current) => {
      const selectedTemplate = templates.find((template) => template.id === current.templateId) ?? null;
      const sectionDraft = applyProposalDefaults(current.projectType, selectedTemplate
        ? {
            projectOverview: selectedTemplate.projectOverview || undefined,
            whatItCanPower: selectedTemplate.whatItCanPower || undefined,
            whatPriceIncludes: selectedTemplate.scopeOfWork || undefined,
            deliveryTimeline: selectedTemplate.deliveryTimeline || undefined,
            installationTimeline: selectedTemplate.installationTimeline || undefined,
            afterSalesSupport: selectedTemplate.afterSalesSupport || undefined,
            termsAndConditions: selectedTemplate.terms || undefined,
          }
        : null);

      return {
        ...current,
        ...sectionDraft,
        quoteMessage:
          current.quoteMessage ||
          selectedTemplate?.projectOverview ||
          selectedTemplate?.scopeOfWork ||
          sectionDraft.projectOverview,
      };
    });
  }, [createDraft.projectType, createDraft.templateId, showCreatePanel, templates]);

  useEffect(() => {
    if (!showCreatePanel) return;
    setCreateDraft((current) => {
      const preferredProducts = summarizeSelectedProducts(current.quoteItems);
      const autoTitle = generateQuoteTitleFromItems(current.quoteItems, current.projectType);
      const shouldReplaceTitle = !current.quoteTitle.trim();
      if (
        current.preferredProducts === preferredProducts &&
        (!shouldReplaceTitle || current.quoteTitle === autoTitle)
      ) {
        return current;
      }
      return {
        ...current,
        preferredProducts,
        quoteTitle: shouldReplaceTitle ? autoTitle : current.quoteTitle,
      };
    });
  }, [createDraft.projectType, createDraft.quoteItems, showCreatePanel]);

  useEffect(() => {
    setQuery(q);
  }, [q]);

  useEffect(() => {
    if (!expandedRequest) return;
    const storedProposal = parseStoredQuoteProposal(expandedRequest.quotationData);
    const feeState = splitQuoteItemsAndFees(storedProposal.items);
    const initialQuoteStatus: QuoteRequestStatus =
      expandedRequest.status === "PENDING"
        ? "QUOTED"
        : expandedRequest.status;
    const proposalDefaults = applyProposalDefaults(
      (expandedRequest.projectType as QuoteProjectType | null) || "SOLAR_HOME_SYSTEM",
      {
        projectOverview: storedProposal.proposalSections.projectOverview || undefined,
        whatPriceIncludes: storedProposal.proposalSections.whatPriceIncludes || undefined,
        whatItCanPower: storedProposal.proposalSections.whatItCanPower || undefined,
        deliveryTimeline: storedProposal.proposalSections.deliveryTimeline || undefined,
        installationTimeline: storedProposal.proposalSections.installationTimeline || undefined,
        afterSalesSupport: storedProposal.proposalSections.afterSalesSupport || undefined,
        importantNotes: storedProposal.proposalSections.importantNotes || undefined,
        scopeExclusions: storedProposal.proposalSections.scopeExclusions || undefined,
        similarProjects: storedProposal.proposalSections.similarProjects || undefined,
        termsAndConditions: storedProposal.proposalSections.termsAndConditions || undefined,
        preparedByDetails: storedProposal.proposalSections.preparedByDetails || undefined,
        companyLegalDetails: storedProposal.proposalSections.companyLegalDetails || undefined,
        projectReferenceLinks: storedProposal.proposalSections.projectReferenceLinks || undefined,
        visibility: storedProposal.proposalVisibility,
      },
    );
    setFormState({
      status: initialQuoteStatus,
      quoteTitle:
        expandedRequest.quoteTitle ||
        expandedRequest.preferredProducts ||
        formatProjectType((expandedRequest.projectType as QuoteProjectType | null) || "SOLAR_HOME_SYSTEM"),
      quoteMessage: expandedRequest.quoteMessage || expandedRequest.loadDescription || expandedRequest.notes || "",
      quoteItems: feeState.quoteItems,
      discountAmount:
        typeof storedProposal.discountAmount === "number" && storedProposal.discountAmount > 0
          ? String(storedProposal.discountAmount)
          : "",
      warrantyMode: storedProposal.warrantyMode || "PER_ITEM",
      fullSystemWarranty: storedProposal.fullSystemWarranty || "",
      customWarranty: storedProposal.customWarranty || "",
      warrantyGeneralNotes:
        storedProposal.warrantyGeneralNotes ||
        "Warranty applies under normal use, correct installation, and manufacturer operating conditions.",
      aiWarrantySummary: storedProposal.aiWarrantySummary || "",
      ...proposalDefaults,
      paymentMethod: storedProposal.paymentMethod || "",
      paymentTerms: storedProposal.paymentTerms || "DEPOSIT_AND_BALANCE",
      deliveryMode: storedProposal.deliveryMode || feeState.deliveryMode,
      installationMode: storedProposal.installationMode || feeState.installationMode,
      deliveryFee: feeState.deliveryFee,
      installationFee: feeState.installationFee,
      depositAmount:
        typeof storedProposal.depositAmount === "number" ? String(storedProposal.depositAmount) : "",
      balanceAmount:
        typeof storedProposal.balanceAmount === "number" ? String(storedProposal.balanceAmount) : "",
      followUpNotes:
        typeof expandedRequest.responseMetadata?.followUpNotes === "string"
          ? expandedRequest.responseMetadata.followUpNotes
          : "",
      sendEmail: Boolean(expandedRequest.responseMetadata?.sendEmail),
      sendSms: Boolean(expandedRequest.responseMetadata?.sendSms),
    });
    setResponseCatalogQuery("");
    setResponseCatalogResults([]);
    setResponseTemplateId(expandedRequest.templateId || "");
    setShowResponseMoreOptions(false);
  }, [expandedRequest]);

  async function handleRespond(channelOverrides?: { sendEmail?: boolean; sendSms?: boolean }) {
    if (!expandedRequest) return;
    setSaving(expandedRequest.id);
    setMessage(null);
    try {
      const payload = {
        ...buildQuoteRequestPayload(formState),
        ...(typeof channelOverrides?.sendEmail === "boolean"
          ? { sendEmail: channelOverrides.sendEmail }
          : {}),
        ...(typeof channelOverrides?.sendSms === "boolean"
          ? { sendSms: channelOverrides.sendSms }
          : {}),
      };
      const response = await fetch(
        buildApiUrl(apiBasePath, apiQueryParams, `${expandedRequest.id}/respond`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
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

  async function handleSendFollowUp(request: SerializedQuoteRequest) {
    setFollowUpSendingId(request.id);
    setMessage(null);
    try {
      const response = await fetch(buildApiUrl(apiBasePath, apiQueryParams, `${request.id}/follow-up`), {
        method: "POST",
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to send quotation follow-up.");
      }
      if (data.request?.id) {
        setRequests((current) =>
          current.map((row) => (row.id === data.request.id ? (data.request as SerializedQuoteRequest) : row)),
        );
      }
      setEventsByRequestId((current) => {
        const next = { ...current };
        delete next[request.id];
        return next;
      });
      await loadRequestEvents(request.id);
      setMessage(data.skipped ? data.reason || "Follow-up was skipped." : "Quotation follow-up sent.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to send quotation follow-up.");
    } finally {
      setFollowUpSendingId(null);
    }
  }

  async function handleDownloadQuotation(request: SerializedQuoteRequest) {
    setDownloadingId(request.id);
    setMessage(null);
    try {
      const response = await fetch(
        buildApiUrl(apiBasePath, apiQueryParams, `${request.id}/pdf`),
        { cache: "no-store" },
      );
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to download quotation PDF.");
      }
      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = href;
      link.download = `${request.quoteRef}.pdf`;
      link.click();
      URL.revokeObjectURL(href);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to download quotation PDF.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleOpenReceiptDraft(
    request: SerializedQuoteRequest,
    mode: "receipt" | "quotation" | "project",
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
      {!compactMode && !createOnlyMode ? (
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
                onClick={() => openCreatePanel(expandedRequest)}
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
              placeholder="Search customer, phone, quote title, battery, product..."
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
                setAdminView(
                  status === "PENDING"
                    ? "PENDING"
                    : status === "QUOTED"
                      ? "QUOTED"
                      : status === "CONVERTED"
                        ? "CONVERTED"
                        : "ALL",
                );
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

        {showMonitoringSummary ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 xl:grid-cols-[1.15fr_1fr_1.15fr]">
              <div className="rounded-2xl border border-fuchsia-500/20 bg-[linear-gradient(180deg,rgba(76,29,149,0.18),rgba(15,23,42,0.9))] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-fuchsia-200/80">
                      Website request desk
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">Front-end quotation demand</div>
                    <div className="mt-1 text-sm text-slate-300">
                      Track fresh website enquiries separately from manual desk work.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-fuchsia-400/30 bg-fuchsia-500/10 px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-fuchsia-200/80">Requests</div>
                    <div className="mt-1 text-3xl font-semibold text-white">{requestSummary.websiteRequests}</div>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Pending website</div>
                    <div className="mt-1 text-2xl font-semibold text-amber-200">{requestSummary.websitePending}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Quoted from web</div>
                    <div className="mt-1 text-2xl font-semibold text-emerald-200">
                      {requests.filter((request) => isWebsiteRequest(request) && request.status === "QUOTED").length}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-3 py-3">
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Website converted</div>
                    <div className="mt-1 text-2xl font-semibold text-cyan-200">
                      {requests.filter((request) => isWebsiteRequest(request) && request.status === "CONVERTED").length}
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyAdminView("WEBSITE")}
                    className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-fuchsia-100"
                  >
                    Open website queue
                  </button>
                  <button
                    type="button"
                    onClick={() => applyAdminView("WEBSITE_PENDING")}
                    className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-amber-100"
                  >
                    Pending website only
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-cyan-500/20 bg-[linear-gradient(180deg,rgba(8,47,73,0.32),rgba(15,23,42,0.9))] px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                  Conversion pulse
                </div>
                <div className="mt-1 text-lg font-semibold text-white">Quotation delivery health</div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {[
                    { label: "All activities", value: String(requestSummary.total), tone: "text-white" },
                    { label: "Needs action", value: String(requestSummary.pending), tone: "text-amber-200" },
                    { label: "Quoted", value: String(requestSummary.quoted), tone: "text-emerald-200" },
                    { label: "Converted", value: String(requestSummary.converted), tone: "text-cyan-200" },
                    { label: "Website quote rate", value: conversionAnalytics.websiteQuoteRate, tone: "text-fuchsia-200" },
                    { label: "Quote to conversion", value: conversionAnalytics.conversionRate, tone: "text-sky-200" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-3">
                      <div className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{item.label}</div>
                      <div className={`mt-1 text-xl font-semibold ${item.tone}`}>{item.value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/45 px-3 py-3 text-sm text-slate-300">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Delivery split</div>
                  <div className="mt-2 font-medium text-white">{conversionAnalytics.workloadSplit}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Manual desk quote rate: {conversionAnalytics.manualQuoteRate}
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-500/20 bg-[linear-gradient(180deg,rgba(6,78,59,0.22),rgba(15,23,42,0.9))] px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-200/80">
                      Bulk control
                    </div>
                    <div className="mt-1 text-lg font-semibold text-white">Mass routing and status tools</div>
                    <div className="mt-1 text-sm text-slate-300">
                      Apply fast presets, then run the update once on the selected records.
                    </div>
                  </div>
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-right">
                    <div className="text-[11px] uppercase tracking-[0.18em] text-emerald-200/80">Selected</div>
                    <div className="mt-1 text-3xl font-semibold text-white">{selectedRequestIds.length}</div>
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {[
                    { label: "Preset pending", status: "PENDING" as QuoteRequestStatus },
                    { label: "Preset follow-up", status: "FOLLOW_UP" as QuoteRequestStatus },
                    { label: "Preset quoted", status: "QUOTED" as QuoteRequestStatus },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyBulkPreset({ status: preset.status })}
                      className="rounded-full border border-white/10 bg-slate-900/60 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-200 transition hover:border-cyan-400 hover:text-white"
                    >
                      {preset.label}
                    </button>
                  ))}
                  {assigneeOptions.slice(0, 4).map((owner) => (
                    <button
                      key={owner.id}
                      type="button"
                      onClick={() => applyBulkPreset({ assigneeId: owner.id })}
                      className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400"
                    >
                      Assign {owner.name || owner.email || owner.id}
                    </button>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <select
                    value={bulkStatus}
                    onChange={(event) => setBulkStatus(event.target.value as QuoteRequestStatus | "")}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none"
                  >
                    <option value="">Leave status unchanged</option>
                    {QUOTE_REQUEST_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {formatStatus(status)}
                      </option>
                    ))}
                  </select>
                  <select
                    value={bulkAssigneeId}
                    onChange={(event) => setBulkAssigneeId(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none"
                  >
                    <option value="">Keep current owner</option>
                    {assigneeOptions.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name || owner.email || owner.id}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={!selectedRequestIds.length || bulkSaving}
                    onClick={() => void handleBulkApply()}
                    className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-cyan-200 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {bulkSaving ? "Applying..." : "Apply bulk update"}
                  </button>
                  <button
                    type="button"
                    disabled={!selectedRequestIds.length}
                    onClick={() => setSelectedRequestIds([])}
                    className="rounded-full border border-white/10 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Clear selection
                  </button>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-4">
              <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Activity lens
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    Focus the dashboard on a specific quotation workload stream.
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  Current view: <span className="font-semibold text-slate-200">{getAdminViewLabel(adminView)}</span>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {([
                  { view: "ALL", count: requestSummary.total },
                  { view: "WEBSITE", count: requestSummary.websiteRequests },
                  { view: "WEBSITE_PENDING", count: requestSummary.websitePending },
                  { view: "MANUAL", count: requestSummary.manualRequests },
                  { view: "PENDING", count: requestSummary.pending },
                  { view: "QUOTED", count: requestSummary.quoted },
                  { view: "CONVERTED", count: requestSummary.converted },
                ] as Array<{ view: AdminQuotationView; count: number }>).map((item) => (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => applyAdminView(item.view)}
                    className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                      adminView === item.view
                        ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                        : "border-white/10 bg-slate-950/60 text-slate-200 hover:border-cyan-400 hover:text-white"
                    }`}
                  >
                    {getAdminViewLabel(item.view)} ({item.count})
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {enableAdminFilters ? (
          <div className="mt-4 space-y-3">
            <div className="grid gap-3 lg:grid-cols-[220px_260px_minmax(0,1fr)]">
            <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
              Source
              <select
                value={sourceFilter}
                onChange={(event) => {
                  const nextSource = event.target.value as QuoteRequestSource | "ALL";
                  setSourceFilter(nextSource);
                  setAdminView(nextSource === "WEBSITE_REQUEST" ? "WEBSITE" : "ALL");
                  refreshRequests(statusFilter, query, nextSource, staffFilter).catch(() => undefined);
                }}
                className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none"
              >
                {SOURCE_OPTIONS.map((source) => (
                  <option key={source} value={source}>
                    {source === "ALL" ? "All sources" : formatSource(source)}
                  </option>
                ))}
              </select>
            </label>
            {assigneeOptions.length ? (
              <label className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                Staff owner
                <select
                  value={staffFilter}
                  onChange={(event) => {
                    const nextStaff = event.target.value;
                    setStaffFilter(nextStaff);
                    setAdminView("ALL");
                    refreshRequests(statusFilter, query, sourceFilter, nextStaff).catch(() => undefined);
                  }}
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-100 outline-none"
                >
                  <option value="ALL">All staff owners</option>
                  {assigneeOptions.map((owner) => (
                    <option key={owner.id} value={owner.id}>
                      {owner.name || owner.email || owner.id}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
              <div className="rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Queue controls
                </div>
                <div className="mt-2 text-sm text-slate-300">
                  Use source and owner filters to narrow the active admin workload view.
                </div>
              </div>
            </div>
          </div>
        ) : null}

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
        {enableCreate || allowTemplateManager ? (
          <div className="mt-4 flex flex-wrap justify-end gap-2">
            {allowTemplateManager ? (
              <button
                type="button"
                onClick={openTemplateBuilder}
                className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-400 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Template
              </button>
            ) : null}
            {allowTemplateManager ? (
              <button
                type="button"
                onClick={() => {
                  setShowTemplatesPanel((current) => !current);
                  setShowCreatePanel(false);
                  setEditingTemplateId(null);
                  setTemplateBuilderMode(false);
                }}
                className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                  showTemplatesPanel
                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                    : "border-white/15 text-slate-100 hover:border-cyan-400 hover:text-white"
                }`}
              >
                <LayoutTemplate className="h-3.5 w-3.5" />
                Saved Templates
              </button>
            ) : null}
            {enableCreate ? (
              <button
                type="button"
                onClick={() => openCreatePanel(expandedRequest)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Quotation
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
      ) : !createOnlyMode ? (
        <>
          {enableCreate || allowTemplateManager ? (
            <div className="flex flex-wrap justify-end gap-2">
              {allowTemplateManager ? (
                <button
                  type="button"
                  onClick={openTemplateBuilder}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-400 hover:text-white"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Template
                </button>
              ) : null}
              {allowTemplateManager ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowTemplatesPanel((current) => !current);
                    setShowCreatePanel(false);
                    setEditingTemplateId(null);
                    setTemplateBuilderMode(false);
                  }}
                  className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition ${
                    showTemplatesPanel
                      ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-200"
                      : "border-white/15 text-slate-100 hover:border-cyan-400 hover:text-white"
                  }`}
                >
                  <LayoutTemplate className="h-3.5 w-3.5" />
                  Saved Templates
                </button>
              ) : null}
              {enableCreate ? (
              <button
                type="button"
                onClick={() => openCreatePanel(expandedRequest)}
                className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Quotation
              </button>
              ) : null}
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
      ) : message ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
          {message}
        </div>
      ) : null}

        {showTemplatesPanel ? (
          <div className={`rounded-[28px] border border-cyan-500/20 bg-slate-950/60 ${compactMode ? "p-4" : "mt-5 p-5"}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                  Template Library
                </div>
                <div className="mt-2 text-lg font-semibold text-white">Saved templates</div>
                <div className="mt-1 text-sm text-slate-300">
                  Reuse your standard quotation setups here. You can edit, delete, download, or open any template into the quotation creator.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {templateOwnerOptions.length ? (
                  <select
                    value={createDraft.templateOwnerId}
                    onChange={(event) =>
                      setCreateDraft((current) => ({ ...current, templateOwnerId: event.target.value }))
                    }
                    className="rounded-full border border-white/10 bg-slate-950/70 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 outline-none"
                  >
                    <option value="">Shared admin template</option>
                    {templateOwnerOptions.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name || owner.email || owner.id}
                      </option>
                    ))}
                  </select>
                ) : null}
                <button
                  type="button"
                  onClick={handleDownloadTemplateFormat}
                  className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/20"
                >
                  Download Template Format
                </button>
                <button
                  type="button"
                  disabled={templateSaving}
                  onClick={() => templateUploadInputRef.current?.click()}
                  className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-200 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Upload Template File
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {templatesLoading ? (
                <div className="rounded-2xl border border-white/10 bg-slate-950/40 px-4 py-6 text-sm text-slate-300">
                  Loading saved templates...
                </div>
              ) : templates.length ? (
                templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-2xl border border-white/10 bg-slate-950/40 p-4"
                  >
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-white">{template.templateName}</div>
                        <div className="mt-1 text-sm text-slate-400">
                          {template.items.length} item{template.items.length === 1 ? "" : "s"} · Updated{" "}
                          {formatDateTime(template.updatedAt)}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          Owner: {template.ownerAttendantName || template.ownerAttendantEmail || "Shared admin template"}
                        </div>
                        <div className="mt-2 text-xs uppercase tracking-[0.16em] text-slate-500">
                          {template.systemSize || template.brand || template.category || "Reusable quotation template"}
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleUseTemplate(template)}
                          className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400"
                        >
                          Use
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEditTemplate(template)}
                          className="inline-flex items-center gap-2 rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-200 transition hover:border-cyan-400"
                        >
                          <FilePenLine className="h-3.5 w-3.5" />
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownloadTemplate(template)}
                          className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/20"
                        >
                          Download
                        </button>
                        <button
                          type="button"
                          disabled={templateDeletingId === template.id}
                          onClick={() => void handleDeleteTemplate(template)}
                          className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          {templateDeletingId === template.id ? "Deleting..." : "Delete"}
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/30 px-4 py-8 text-sm text-slate-400">
                  No saved templates yet. Create a quotation draft, then save it as a template for reuse.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {showCreatePanel ? (
          <div
            ref={createPanelRef}
            className={`rounded-[28px] border border-emerald-500/20 bg-slate-950/60 ${
              compactMode ? "p-3 sm:p-4" : "mt-5 p-4 sm:p-5"
            }`}
          >
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
                  Quotation Center
                </div>
                <div className="mt-2 text-lg font-semibold text-white">
                  {templateBuilderMode
                    ? editingTemplateId
                      ? "Edit template"
                      : "Add template"
                    : editingTemplateId
                      ? "Edit template"
                      : "Create quotation"}
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  {templateBuilderMode
                    ? "Paste a full BOQ or itemized quotation text, let the system break it into clean line items, then save it as a reusable template."
                    : editingTemplateId
                    ? "Update the saved template using only the fields staff actually maintain in day-to-day quotation work."
                    : "Start a quotation for walk-in, WhatsApp, phone, or template-based customers without waiting for the website form."}
                </div>
              </div>
              <div className="grid gap-2 sm:flex sm:flex-wrap">
                {([
                  ["manual", "Manual quotation"],
                  ...(allowTemplateSelection ? ([["template", "Use saved template"]] as Array<[CreateQuotationMode, string]>) : []),
                ] as Array<[CreateQuotationMode, string]>).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => {
                      setCreateMode(mode);
                      if (mode === "manual") {
                        setEditingTemplateId(null);
                      }
                    }}
                    className={`w-full rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-wide transition sm:w-auto ${
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
              {templateBuilderMode ? (
                <div className="lg:col-span-2 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 sm:p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-200">
                        Paste itemized quotation
                      </div>
                      <div className="mt-1 text-sm text-slate-300">
                        Paste the raw BOQ text exactly as shared on WhatsApp or email. The system will pull out items, quantities, prices, and discount automatically.
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={handleParseTemplatePaste}
                        className="rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-amber-100 transition hover:border-amber-400"
                      >
                        Parse pasted template
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplatePasteText("")}
                        className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/20"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <textarea
                    value={templatePasteText}
                    onChange={(event) => setTemplatePasteText(event.target.value)}
                    rows={14}
                    placeholder="Paste the full itemized quotation text here..."
                    className="mt-3 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm normal-case tracking-normal text-slate-100 outline-none"
                  />
                </div>
              ) : null}
              {!templateBuilderMode ? (
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Customer name
                <input
                  value={createDraft.customerName}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, customerName: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              ) : null}
              {!templateBuilderMode ? (
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Phone number
                <input
                  value={createDraft.customerPhone}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, customerPhone: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              ) : null}
              {!templateBuilderMode ? (
              <label className="text-xs uppercase tracking-wide text-slate-400">
                Email
                <input
                  value={createDraft.customerEmail}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, customerEmail: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              ) : null}
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
              {!templateBuilderMode ? (
              <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
                Location
                <input
                  value={createDraft.customerLocation}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, customerLocation: event.target.value }))}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              ) : null}
              {assigneeOptions.length && !templateBuilderMode ? (
                <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
                  {assigneeLabel}
                  <select
                    value={createDraft.assignedAttendantId}
                    onChange={(event) =>
                      setCreateDraft((current) => ({ ...current, assignedAttendantId: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                  >
                    <option value="">Select staff</option>
                    {assigneeOptions.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name || owner.email || owner.id}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
                {templateBuilderMode ? "Template name" : "Quotation Name"}
                <input
                  value={createDraft.quoteTitle}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, quoteTitle: event.target.value }))}
                  placeholder={templateBuilderMode ? "Reusable template name" : "Optional custom quotation name to print on the PDF"}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              {createMode === "template" ? (
                <div className="lg:col-span-2 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    Prepared quotation template
                    <select
                      value={createDraft.templateId}
                      onChange={(event) => {
                        const nextId = event.target.value;
                        const nextTemplate = templates.find((template) => template.id === nextId) ?? null;
                        setCreateDraft((current) => applyTemplateToCreateDraft(current, nextTemplate));
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
                </div>
              ) : null}
              {allowTemplateManager && templateOwnerOptions.length ? (
                <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
                  Template owner
                  <select
                    value={createDraft.templateOwnerId}
                    onChange={(event) =>
                      setCreateDraft((current) => ({ ...current, templateOwnerId: event.target.value }))
                    }
                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                  >
                    <option value="">Shared admin template</option>
                    {templateOwnerOptions.map((owner) => (
                      <option key={owner.id} value={owner.id}>
                        {owner.name || owner.email || owner.id}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              <input
                ref={templateUploadInputRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(event) => void handleTemplateFileSelected(event.target.files?.[0] ?? null)}
              />
              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-900/70 p-3 sm:p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Quotation items
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Build the quotation before saving it so the quotation is complete immediately.
                    </div>
                  </div>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    Installation
                    <select
                      value={createDraft.installationMode}
                      onChange={(event) =>
                        setCreateDraft((current) => ({ ...current, installationMode: event.target.value as QuoteFeeMode }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                    >
                      {QUOTE_FEE_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode === "CHARGED" ? "Enter fee" : formatStatus(mode)}
                        </option>
                      ))}
                    </select>
                    {createDraft.installationMode === "CHARGED" ? (
                      <input
                        value={createDraft.installationFee}
                        onChange={(event) =>
                          setCreateDraft((current) => ({ ...current, installationFee: event.target.value }))
                        }
                        placeholder="Installation fee amount"
                        className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
                      />
                    ) : null}
                  </label>
                  <label className="text-xs uppercase tracking-wide text-slate-400">
                    Transport / delivery
                    <select
                      value={createDraft.deliveryMode}
                      onChange={(event) =>
                        setCreateDraft((current) => ({ ...current, deliveryMode: event.target.value as QuoteFeeMode }))
                      }
                      className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                    >
                      {QUOTE_FEE_MODES.map((mode) => (
                        <option key={mode} value={mode}>
                          {mode === "CHARGED" ? "Enter fee" : formatStatus(mode)}
                        </option>
                      ))}
                    </select>
                    {createDraft.deliveryMode === "CHARGED" ? (
                      <input
                        value={createDraft.deliveryFee}
                        onChange={(event) =>
                          setCreateDraft((current) => ({ ...current, deliveryFee: event.target.value }))
                        }
                        placeholder="Transport fee amount"
                        className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
                      />
                    ) : null}
                  </label>
                </div>
                <div className="mt-2 text-xs text-slate-500">
                  Choose Included, Not included, or Enter fee for both installation and transport before saving.
                </div>

                <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 sm:p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                    Add from live catalog
                  </div>
                  <div className="mt-1 text-sm text-slate-300">
                    Start typing a product name to see live catalog suggestions, add it directly, or keep typing items manually below.
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative flex-1">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                      <input
                        value={createCatalogQuery}
                        onChange={(event) => setCreateCatalogQuery(event.target.value)}
                        placeholder="Search product, kit, panel, inverter, battery..."
                        className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none"
                      />
                    </div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      {createCatalogLoading
                        ? "Searching..."
                        : createCatalogQuery.trim().length >= CATALOG_SEARCH_MIN_CHARS
                          ? `${createCatalogResults.length} match${createCatalogResults.length === 1 ? "" : "es"}`
                          : `Type ${CATALOG_SEARCH_MIN_CHARS}+ letters`}
                    </div>
                  </div>
                  {createCatalogResults.length ? (
                    <div className="mt-3 space-y-2">
                      {createCatalogResults.map((product) => (
                        <div
                          key={`${product.productName}-${product.price}`}
                          className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3 lg:flex-row lg:items-center lg:justify-between"
                        >
                          <div className="min-w-0">
                            <div className="truncate text-sm font-semibold text-white">{product.productName}</div>
                            <div className="mt-1 text-xs text-slate-400">
                              {product.productCategory} · {formatQuoteCurrency(product.price)} · {product.availability}
                            </div>
                            {product.shortDescription ? (
                              <div className="mt-1 line-clamp-2 text-xs text-slate-500">{product.shortDescription}</div>
                            ) : null}
                          </div>
                          <div className="grid gap-2 sm:flex sm:flex-wrap">
                            <a
                              href={product.productUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/20 sm:w-auto"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                              View
                            </a>
                            <button
                              type="button"
                              onClick={() => addCreateCatalogItem(product)}
                              className="w-full rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400 sm:w-auto"
                            >
                              Add item
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {!createCatalogLoading &&
                  createCatalogQuery.trim().length >= CATALOG_SEARCH_MIN_CHARS &&
                  !createCatalogResults.length ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-3 py-3 text-xs text-slate-500">
                      No catalog suggestions found for that search yet.
                    </div>
                  ) : null}
                </div>

                <div className="mt-4 space-y-3">
                  {createDraft.quoteItems.map((item, index) => (
                    <div
                      key={`create-quote-item-${index}`}
                      ref={(node) => {
                        createItemRefs.current[index] = node;
                      }}
                      className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 sm:p-4"
                    >
                      <button
                        type="button"
                        onClick={() =>
                          setCreateItemAccordion((current) =>
                            current.map((isOpen, entryIndex) => (entryIndex === index ? !isOpen : isOpen)),
                          )
                        }
                        className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left sm:hidden"
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Item {index + 1}
                          </div>
                          <div className="truncate text-sm font-semibold text-white">
                            {item.itemName.trim() || "New quotation item"}
                          </div>
                        </div>
                        {createItemAccordion[index] ? (
                          <ChevronDown className="h-4 w-4 text-slate-300" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-300" />
                        )}
                      </button>
                      <div className={`${createItemAccordion[index] ? "block" : "hidden"} mt-3 sm:mt-0 sm:block`}>
                        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_140px_160px_auto]">
                          <label className="text-xs uppercase tracking-wide text-slate-400">
                            Item name
                            <textarea
                              rows={2}
                              value={item.itemName}
                              onChange={(event) =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, itemName: event.target.value } : entry,
                                  ),
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                            />
                          </label>
                          <label className="text-xs uppercase tracking-wide text-slate-400">
                            Quantity
                            <input
                              value={item.quantity}
                              onChange={(event) =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, quantity: event.target.value } : entry,
                                  ),
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                            />
                          </label>
                          <label className="text-xs uppercase tracking-wide text-slate-400">
                            Unit price
                            <input
                              value={item.unitPrice}
                              onChange={(event) =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, unitPrice: event.target.value } : entry,
                                  ),
                                }))
                              }
                              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                            />
                          </label>
                          <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-3 lg:border-0 lg:bg-transparent lg:p-0">
                            <div className="text-left lg:text-right">
                              <div className="text-xs uppercase tracking-wide text-slate-400">Line total</div>
                              <div className="mt-1 text-sm font-semibold text-white">
                                {formatQuoteCurrency(createQuoteItemsPreview[index]?.lineTotal || 0)}
                              </div>
                            </div>
                            <button
                              type="button"
                              disabled={createDraft.quoteItems.length <= 1}
                              onClick={() =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  quoteItems:
                                    current.quoteItems.length <= 1
                                      ? current.quoteItems
                                      : current.quoteItems.filter((_, entryIndex) => entryIndex !== index),
                                }))
                              }
                              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-rose-500/25 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-40 lg:w-auto"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.8fr)_minmax(190px,0.7fr)_140px]">
                          <label className="block">
                            <span className="sr-only">BOQ notes</span>
                            <textarea
                              rows={1}
                              value={item.description}
                              onChange={(event) =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                    entryIndex === index ? { ...entry, description: event.target.value } : entry,
                                  ),
                                }))
                              }
                              placeholder="Optional short BOQ notes"
                              className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none resize-none"
                            />
                          </label>
                          <label className="block">
                            <span className="sr-only">Warranty period</span>
                            <input
                              value={item.warrantyPeriod}
                              onChange={(event) =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? {
                                          ...entry,
                                          warrantyPeriod: event.target.value,
                                          warranty: event.target.value.trim() ? entry.warranty : "",
                                        }
                                      : entry,
                                  ),
                                }))
                              }
                              placeholder="Warranty period"
                              className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                            />
                          </label>
                          <label className="block">
                            <span className="sr-only">Warranty unit</span>
                            <select
                              value={item.warrantyUnit}
                              onChange={(event) =>
                                setCreateDraft((current) => ({
                                  ...current,
                                  quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                    entryIndex === index
                                      ? { ...entry, warrantyUnit: event.target.value as QuoteWarrantyUnit }
                                      : entry,
                                  ),
                                }))
                              }
                              className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                            >
                              <option value="YEARS">Years</option>
                              <option value="MONTHS">Months</option>
                            </select>
                          </label>
                        </div>
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => appendCreateQuoteItem()}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/20"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add item
                  </button>
                </div>

                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-3 sm:p-4">
                  <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <div>
                      <span className="font-semibold text-white">Subtotal:</span>{" "}
                      {formatQuoteCurrency(createQuoteTotalsPreview.subtotal)}
                    </div>
                    <div>
                      <span className="font-semibold text-white">Total quoted amount:</span>{" "}
                      {formatQuoteCurrency(createQuoteTotalsPreview.total)}
                    </div>
                    {createQuoteTotalsPreview.discountAmount > 0 ? (
                      <div>
                        <span className="font-semibold text-white">Discount:</span>{" "}
                        {formatQuoteCurrency(createQuoteTotalsPreview.discountAmount)}
                      </div>
                    ) : null}
                    {createDraft.paymentTerms === "DEPOSIT_AND_BALANCE" ? (
                      <>
                        <div>
                          <span className="font-semibold text-white">Deposit:</span>{" "}
                          {formatQuoteCurrency(parseMoneyInput(createDraft.depositAmount))}
                        </div>
                        <div>
                          <span className="font-semibold text-white">Balance:</span>{" "}
                          {formatQuoteCurrency(createQuoteBalancePreview || 0)}
                        </div>
                      </>
                    ) : null}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateMoreOptions((current) => !current)}
                  className="mt-4 inline-flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-left"
                >
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                      More options
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      Payment terms, discount, project link, and customer notes.
                    </div>
                  </div>
                  {showCreateMoreOptions ? (
                    <ChevronDown className="h-4 w-4 text-slate-300" />
                  ) : (
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  )}
                </button>
                {showCreateMoreOptions ? (
                  <>
                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        Payment terms
                        <select
                          value={createDraft.paymentTerms}
                          onChange={(event) =>
                            setCreateDraft((current) => ({
                              ...current,
                              paymentTerms: event.target.value as QuotePaymentTerms,
                            }))
                          }
                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                        >
                          {QUOTE_PAYMENT_TERMS.map((term) => (
                            <option key={term} value={term}>
                              {getQuotePaymentTermsLabel(term)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        Discount amount
                        <input
                          value={createDraft.discountAmount}
                          onChange={(event) =>
                            setCreateDraft((current) => ({ ...current, discountAmount: event.target.value }))
                          }
                          placeholder="0"
                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                        />
                      </label>
                      {createDraft.paymentTerms === "DEPOSIT_AND_BALANCE" ? (
                        <>
                          <label className="text-xs uppercase tracking-wide text-slate-400">
                            Deposit amount
                            <input
                              value={createDraft.depositAmount}
                              onChange={(event) =>
                                setCreateDraft((current) => ({ ...current, depositAmount: event.target.value }))
                              }
                              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                            />
                          </label>
                          <label className="text-xs uppercase tracking-wide text-slate-400">
                            Balance amount
                            <input
                              value={createDraft.balanceAmount}
                              onChange={(event) =>
                                setCreateDraft((current) => ({ ...current, balanceAmount: event.target.value }))
                              }
                              placeholder={createQuoteBalancePreview !== null ? String(createQuoteBalancePreview) : ""}
                              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                            />
                          </label>
                        </>
                      ) : null}
                    </div>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-3 sm:p-4">
                      <label className="text-xs uppercase tracking-wide text-slate-400">
                        TikTok project link (optional)
                        <input
                          value={createDraft.projectReferenceLinks}
                          onChange={(event) =>
                            setCreateDraft((current) => ({ ...current, projectReferenceLinks: event.target.value }))
                          }
                          placeholder="Paste TikTok project link to feature on the PDF"
                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
                        />
                      </label>
                    </div>
                    <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">
                      Notes to customer (optional)
                      <textarea
                        value={createDraft.quoteMessage}
                        onChange={(event) =>
                          setCreateDraft((current) => ({ ...current, quoteMessage: event.target.value }))
                        }
                        rows={4}
                        placeholder="Optional customer note to print in the quotation"
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                      />
                    </label>
                    <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400">
                      Internal follow-up notes
                      <textarea
                        value={createDraft.followUpNotes}
                        onChange={(event) =>
                          setCreateDraft((current) => ({ ...current, followUpNotes: event.target.value }))
                        }
                        rows={3}
                        className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                      />
                    </label>
                  </>
                ) : null}
              </div>
            </div>

            <div className="mt-4 hidden gap-2 sm:flex sm:flex-wrap">
              {allowTemplateManager ? (
                <>
                  <button
                    type="button"
                    disabled={templateSaving}
                    onClick={() => void handleSaveTemplateFromDraft()}
                    className="w-full rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-200 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                  >
                    {templateSaving
                      ? editingTemplateId
                        ? "Updating Template..."
                        : "Saving Template..."
                      : editingTemplateId
                        ? "Update Template"
                        : "Save As Template"}
                  </button>
                </>
              ) : null}
              {!templateBuilderMode ? (
                <button
                  type="button"
                  disabled={
                    createSaving ||
                    !createDraft.customerName.trim() ||
                    !createDraft.customerPhone.trim() ||
                    (requireAssigneeSelection && !createDraft.assignedAttendantId.trim()) ||
                    (createMode === "template" && !createDraft.templateId)
                  }
                  onClick={() => void handleCreateQuotation()}
                  className="w-full rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:py-2"
                >
                  {createSaving ? "Saving..." : createActionLabel}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setShowCreatePanel(createOnlyMode);
                  setShowCreateMoreOptions(false);
                  setEditingTemplateId(null);
                  setTemplateBuilderMode(false);
                  setTemplatePasteText("");
                  setCreateDraft(createDefaultQuotationDraft());
                  setCreateItemAccordion([true]);
                }}
                className="w-full rounded-full border border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/20 sm:w-auto sm:py-2"
              >
                Cancel
              </button>
            </div>
            <div className="sticky bottom-3 z-20 mt-4 rounded-2xl border border-white/10 bg-slate-950/95 p-3 shadow-[0_18px_40px_rgba(0,0,0,0.45)] backdrop-blur sm:hidden">
              <div className="grid gap-2">
                {allowTemplateManager ? (
                  <button
                    type="button"
                    disabled={templateSaving}
                    onClick={() => void handleSaveTemplateFromDraft()}
                    className="w-full rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-cyan-200 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {templateSaving
                      ? editingTemplateId
                        ? "Updating Template..."
                        : "Saving Template..."
                      : editingTemplateId
                        ? "Update Template"
                        : "Save As Template"}
                  </button>
                ) : null}
                {!templateBuilderMode ? (
                  <button
                    type="button"
                    disabled={
                      createSaving ||
                      !createDraft.customerName.trim() ||
                      !createDraft.customerPhone.trim() ||
                      (requireAssigneeSelection && !createDraft.assignedAttendantId.trim()) ||
                      (createMode === "template" && !createDraft.templateId)
                    }
                    onClick={() => void handleCreateQuotation()}
                    className="w-full rounded-full border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {createSaving ? "Saving..." : createActionLabel}
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => {
                    setShowCreatePanel(createOnlyMode);
                    setShowCreateMoreOptions(false);
                    setEditingTemplateId(null);
                    setTemplateBuilderMode(false);
                    setTemplatePasteText("");
                    setCreateDraft(createDefaultQuotationDraft());
                    setCreateItemAccordion([true]);
                  }}
                  className="w-full rounded-full border border-white/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/20"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {!createOnlyMode ? (
        <div className={compactMode ? "space-y-3" : "mt-5 space-y-4"}>
          {filteredRequests.length ? (
            filteredRequests.map((request) => {
              const expanded = request.id === expandedId;
              const storedProposal = parseStoredQuoteProposal(request.quotationData);
              const canOpenReceiptDraft = storedProposal.items.length > 0;
              const requestEvents = eventsByRequestId[request.id] ?? [];
              const conversionEvents = requestEvents.filter(isConversionEvent);
              const groupedRequestEvents = groupTimelineEvents(requestEvents);
              const isSelected = selectedRequestIds.includes(request.id);
              return (
                <div
                  key={request.id}
                  className={`rounded-[28px] border border-white/10 ${compactMode ? "bg-white/[0.03] p-4" : "bg-slate-950/60 p-5"}`}
                >
                  {compactMode ? (
                    <div className="grid gap-3 lg:grid-cols-[140px_1.3fr_1fr_160px_140px_150px] lg:items-center">
                      <div>
                        {enableAdminFilters ? (
                          <label className="mb-2 flex items-center gap-2 text-xs text-slate-400">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(event) =>
                                setSelectedRequestIds((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, request.id])]
                                    : current.filter((id) => id !== request.id),
                                )
                              }
                              className="h-4 w-4 rounded border-white/20 bg-slate-950/70"
                            />
                            Select
                          </label>
                        ) : null}
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
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100">
                            {formatSource(request.source)}
                          </span>
                          {request.templateName ? (
                            <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                              Template
                            </span>
                          ) : null}
                        </div>
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
                        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => {
                              const nextExpanded = expanded ? null : request.id;
                              setExpandedId(nextExpanded);
                              if (nextExpanded) {
                                void loadRequestEvents(request.id);
                                void loadProjectWorkflow(request);
                              }
                            }}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/25 hover:bg-white/[0.06]"
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {expanded ? "Close" : "View quotation"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCopyQuotation(request)}
                            className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-300/40 hover:bg-cyan-400/15"
                          >
                            <FilePenLine className="h-4 w-4" />
                            Copy quotation
                          </button>
                          {allowDelete ? (
                            <button
                              type="button"
                              onClick={() => void handleDeleteQuotation(request)}
                              disabled={deletingId === request.id}
                              className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-rose-100 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {deletingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                              Delete
                            </button>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <button
                        type="button"
                        onClick={() => {
                          const nextExpanded = expanded ? null : request.id;
                          setExpandedId(nextExpanded);
                          if (nextExpanded) {
                            void loadRequestEvents(request.id);
                            void loadProjectWorkflow(request);
                          }
                        }}
                        className="flex min-w-0 flex-1 items-start gap-3 text-left"
                      >
                        {enableAdminFilters ? (
                          <span
                            onClick={(event) => event.stopPropagation()}
                            className="mt-1"
                          >
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(event) =>
                                setSelectedRequestIds((current) =>
                                  event.target.checked
                                    ? [...new Set([...current, request.id])]
                                    : current.filter((id) => id !== request.id),
                                )
                              }
                              className="h-4 w-4 rounded border-white/20 bg-slate-950/70"
                            />
                          </span>
                        ) : null}
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
                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className="rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-fuchsia-100">
                              {formatSource(request.source)}
                            </span>
                            {request.assignedAttendant?.name || request.assignedAttendant?.email ? (
                              <span className="rounded-full border border-cyan-400/25 bg-cyan-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                                {request.assignedAttendant?.name || request.assignedAttendant?.email}
                              </span>
                            ) : null}
                            {getQuotationTopicLabel(request) ? (
                              <span className="rounded-full border border-white/15 bg-white/[0.03] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-200">
                                {getQuotationTopicLabel(request)}
                              </span>
                            ) : null}
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
                            <Link
                              href={`/admin/quotation-center/site-visits?quoteRef=${encodeURIComponent(request.quoteRef || "")}`}
                              className="inline-flex items-center gap-2 rounded-lg border border-sky-400/20 bg-sky-400/10 px-3 py-2 text-sm font-medium text-sky-100 transition hover:border-sky-300/30 hover:bg-sky-400/15"
                            >
                              Schedule site visit
                              <ExternalLink className="h-4 w-4" />
                            </Link>
                            <button
                              type="button"
                              disabled={!canOpenReceiptDraft || draftOpening === `${request.id}:quotation`}
                              onClick={() => void handleOpenReceiptDraft(request, "quotation")}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-400/20 bg-emerald-400/10 px-3 py-2 text-sm font-medium text-emerald-100 transition hover:border-emerald-300/30 hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {draftOpening === `${request.id}:quotation` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Open quotation print
                            </button>
                            <button
                              type="button"
                              disabled={!canOpenReceiptDraft || draftOpening === `${request.id}:receipt`}
                              onClick={() => void handleOpenReceiptDraft(request, "receipt")}
                              className="inline-flex items-center gap-2 rounded-lg border border-amber-400/20 bg-amber-400/10 px-3 py-2 text-sm font-medium text-amber-100 transition hover:border-amber-300/30 hover:bg-amber-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {draftOpening === `${request.id}:receipt` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Convert to receipt
                            </button>
                            <button
                              type="button"
                              disabled={!canOpenReceiptDraft || draftOpening === `${request.id}:project`}
                              onClick={() => void handleOpenReceiptDraft(request, "project")}
                              className="inline-flex items-center gap-2 rounded-lg border border-fuchsia-400/20 bg-fuchsia-400/10 px-3 py-2 text-sm font-medium text-fuchsia-100 transition hover:border-fuchsia-300/30 hover:bg-fuchsia-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {draftOpening === `${request.id}:project` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Convert to project workflow
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCopyQuotation(request)}
                              className="inline-flex items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-sm font-medium text-cyan-100 transition hover:border-cyan-300/30 hover:bg-cyan-400/15"
                            >
                              <FilePenLine className="h-4 w-4" />
                              Copy quotation
                            </button>
                            <button
                              type="button"
                              disabled={templateSaving}
                              onClick={() => void handleSaveRequestAsTemplate(request)}
                              className="inline-flex items-center gap-2 rounded-lg border border-violet-400/20 bg-violet-400/10 px-3 py-2 text-sm font-medium text-violet-100 transition hover:border-violet-300/30 hover:bg-violet-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <LayoutTemplate className="h-4 w-4" />
                              {templateSaving ? "Saving template..." : "Save as template"}
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
                            {allowTemplateSelection ? (
                              <label className="text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
                                Saved template
                                <select
                                  value={responseTemplateId}
                                  onChange={(event) => {
                                    const nextId = event.target.value;
                                    const nextTemplate = templates.find((template) => template.id === nextId) ?? null;
                                    setResponseTemplateId(nextId);
                                    setFormState((current) => applyTemplateToResponseForm(current, nextTemplate));
                                  }}
                                  className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
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
                              </div>
                              <div className="mt-3 grid gap-3 md:grid-cols-2">
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                  Installation
                                  <select
                                    value={formState.installationMode}
                                    onChange={(event) =>
                                      setFormState((current) => ({ ...current, installationMode: event.target.value as QuoteFeeMode }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                  >
                                    {QUOTE_FEE_MODES.map((mode) => (
                                      <option key={mode} value={mode}>
                                        {mode === "CHARGED" ? "Enter fee" : formatStatus(mode)}
                                      </option>
                                    ))}
                                  </select>
                                  {formState.installationMode === "CHARGED" ? (
                                    <input
                                      value={formState.installationFee}
                                      onChange={(event) =>
                                        setFormState((current) => ({ ...current, installationFee: event.target.value }))
                                      }
                                      placeholder="Installation fee amount"
                                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 focus:border-emerald-500 focus:outline-none"
                                    />
                                  ) : null}
                                </label>
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                  Transport / delivery
                                  <select
                                    value={formState.deliveryMode}
                                    onChange={(event) =>
                                      setFormState((current) => ({ ...current, deliveryMode: event.target.value as QuoteFeeMode }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                  >
                                    {QUOTE_FEE_MODES.map((mode) => (
                                      <option key={mode} value={mode}>
                                        {mode === "CHARGED" ? "Enter fee" : formatStatus(mode)}
                                      </option>
                                    ))}
                                  </select>
                                  {formState.deliveryMode === "CHARGED" ? (
                                    <input
                                      value={formState.deliveryFee}
                                      onChange={(event) =>
                                        setFormState((current) => ({ ...current, deliveryFee: event.target.value }))
                                      }
                                      placeholder="Transport fee amount"
                                      className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 focus:border-emerald-500 focus:outline-none"
                                    />
                                  ) : null}
                                </label>
                              </div>
                              <div className="mt-2 text-xs text-slate-500">
                                Choose Included, Not included, or Enter fee for both installation and transport before saving.
                              </div>

                              <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
                                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-200">
                                  Add from live catalog
                                </div>
                                <div className="mt-1 text-sm text-slate-300">
                                  Start typing to search the catalog, add the product into this quotation, or continue editing items manually.
                                </div>
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                  <div className="relative flex-1">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
                                    <input
                                      value={responseCatalogQuery}
                                      onChange={(event) => setResponseCatalogQuery(event.target.value)}
                                      placeholder="Search product, panel, kit, inverter, battery..."
                                      className="w-full rounded-xl border border-slate-800 bg-slate-950/70 py-2 pl-9 pr-3 text-sm text-slate-100 outline-none"
                                    />
                                  </div>
                                  <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                                    {responseCatalogLoading
                                      ? "Searching..."
                                      : responseCatalogQuery.trim().length >= CATALOG_SEARCH_MIN_CHARS
                                        ? `${responseCatalogResults.length} match${responseCatalogResults.length === 1 ? "" : "es"}`
                                        : `Type ${CATALOG_SEARCH_MIN_CHARS}+ letters`}
                                  </div>
                                </div>
                                {responseCatalogResults.length ? (
                                  <div className="mt-3 space-y-2">
                                    {responseCatalogResults.map((product) => (
                                      <div
                                        key={`${product.productName}-${product.price}`}
                                        className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-900/70 p-3 lg:flex-row lg:items-center lg:justify-between"
                                      >
                                        <div className="min-w-0">
                                          <div className="truncate text-sm font-semibold text-white">{product.productName}</div>
                                          <div className="mt-1 text-xs text-slate-400">
                                            {product.productCategory} · {formatQuoteCurrency(product.price)} · {product.availability}
                                          </div>
                                          {product.shortDescription ? (
                                            <div className="mt-1 line-clamp-2 text-xs text-slate-500">{product.shortDescription}</div>
                                          ) : null}
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          <a
                                            href={product.productUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/20"
                                          >
                                            <ExternalLink className="h-3.5 w-3.5" />
                                            View
                                          </a>
                                          <button
                                            type="button"
                                            onClick={() => addResponseCatalogItem(product)}
                                            className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
                                          >
                                            Add item
                                          </button>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                                {!responseCatalogLoading &&
                                responseCatalogQuery.trim().length >= CATALOG_SEARCH_MIN_CHARS &&
                                !responseCatalogResults.length ? (
                                  <div className="mt-3 rounded-2xl border border-dashed border-white/10 px-3 py-3 text-xs text-slate-500">
                                    No catalog suggestions found for that search yet.
                                  </div>
                                ) : null}
                              </div>

                              <div className="mt-4 space-y-3">
                                {formState.quoteItems.map((item, index) => (
                                  <div
                                    key={`quote-item-${index}`}
                                    ref={(node) => {
                                      responseItemRefs.current[index] = node;
                                    }}
                                    className="rounded-2xl border border-white/10 bg-slate-900/70 p-4"
                                  >
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
                                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1.8fr)_minmax(190px,0.7fr)_140px]">
                                      <label className="block">
                                        <span className="sr-only">BOQ notes</span>
                                        <textarea
                                          rows={1}
                                          value={item.description}
                                          onChange={(event) =>
                                            setFormState((current) => ({
                                              ...current,
                                              quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                                entryIndex === index ? { ...entry, description: event.target.value } : entry,
                                              ),
                                            }))
                                          }
                                          placeholder="Optional short BOQ notes"
                                          className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none resize-none"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="sr-only">Warranty period</span>
                                        <input
                                          value={item.warrantyPeriod}
                                          onChange={(event) =>
                                            setFormState((current) => ({
                                              ...current,
                                              quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                                entryIndex === index
                                                  ? {
                                                      ...entry,
                                                      warrantyPeriod: event.target.value,
                                                      warranty: event.target.value.trim() ? entry.warranty : "",
                                                    }
                                                  : entry,
                                              ),
                                            }))
                                          }
                                          placeholder="Warranty period"
                                          className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                        />
                                      </label>
                                      <label className="block">
                                        <span className="sr-only">Warranty unit</span>
                                        <select
                                          value={item.warrantyUnit}
                                          onChange={(event) =>
                                            setFormState((current) => ({
                                              ...current,
                                              quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                                entryIndex === index
                                                  ? { ...entry, warrantyUnit: event.target.value as QuoteWarrantyUnit }
                                                  : entry,
                                              ),
                                            }))
                                          }
                                          className="h-12 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                        >
                                          <option value="YEARS">Years</option>
                                          <option value="MONTHS">Months</option>
                                        </select>
                                      </label>
                                    </div>
                                  </div>
                                ))}
                                <button
                                  type="button"
                                  onClick={() => appendResponseQuoteItem()}
                                  className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/20"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                  Add item
                                </button>
                              </div>

                              <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                                <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                                  <div>
                                    <span className="font-semibold text-white">Subtotal:</span>{" "}
                                    {formatQuoteCurrency(quoteTotalsPreview.subtotal)}
                                  </div>
                                  <div>
                                    <span className="font-semibold text-white">Total quoted amount:</span>{" "}
                                    {formatQuoteCurrency(quoteTotalsPreview.total)}
                                  </div>
                                  {quoteTotalsPreview.discountAmount > 0 ? (
                                    <div>
                                      <span className="font-semibold text-white">Discount:</span>{" "}
                                      {formatQuoteCurrency(quoteTotalsPreview.discountAmount)}
                                    </div>
                                  ) : null}
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

                              <button
                                type="button"
                                onClick={() => setShowResponseMoreOptions((current) => !current)}
                                className="mt-4 inline-flex w-full items-center justify-between rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-left"
                              >
                                <div>
                                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">
                                    More options
                                  </div>
                                  <div className="mt-1 text-sm text-slate-500">
                                    Payment terms, discount, project link, and customer notes.
                                  </div>
                                </div>
                                {showResponseMoreOptions ? (
                                  <ChevronDown className="h-4 w-4 text-slate-300" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-300" />
                                )}
                              </button>

                              {showResponseMoreOptions ? (
                                <>
                                  <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                                    <label className="text-xs uppercase tracking-wide text-slate-400">
                                      Discount amount
                                      <input
                                        value={formState.discountAmount}
                                        onChange={(event) =>
                                          setFormState((current) => ({ ...current, discountAmount: event.target.value }))
                                        }
                                        placeholder="0"
                                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                      />
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

                                  <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/40 p-3 sm:p-4">
                                    <label className="text-xs uppercase tracking-wide text-slate-400">
                                      TikTok project link (optional)
                                      <input
                                        value={formState.projectReferenceLinks}
                                        onChange={(event) =>
                                          setFormState((current) => ({ ...current, projectReferenceLinks: event.target.value }))
                                        }
                                        placeholder="Paste TikTok project link to feature on the PDF"
                                        className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 focus:border-emerald-500 focus:outline-none"
                                      />
                                    </label>
                                  </div>

                                  <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
                                    Notes to customer (optional)
                                    <textarea
                                      rows={4}
                                      value={formState.quoteMessage}
                                      onChange={(event) =>
                                        setFormState((current) => ({ ...current, quoteMessage: event.target.value }))
                                      }
                                      placeholder="Optional customer note to print in the quotation"
                                      className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                    />
                                  </label>

                                  <label className="mt-4 block text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
                                    Internal follow-up notes
                                    <textarea
                                      rows={3}
                                      value={formState.followUpNotes}
                                      onChange={(event) =>
                                        setFormState((current) => ({ ...current, followUpNotes: event.target.value }))
                                      }
                                      className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                    />
                                  </label>
                                </>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Quotation actions
                          </div>
                          <div className="mt-3 space-y-2 text-sm text-slate-300">
                            <div>Email: {request.customerEmail || "No email saved"}</div>
                            <div>Phone: {request.customerPhone || "No phone saved"}</div>
                            <div>7-day follow-up: {request.followUpScheduledAt ? formatDateTime(request.followUpScheduledAt) : "Not scheduled"}</div>
                            <div>21-day follow-up: {request.secondFollowUpScheduledAt ? formatDateTime(request.secondFollowUpScheduledAt) : "Not scheduled"}</div>
                            <div>Last follow-up: {request.secondFollowUpSentAt || request.followUpSentAt ? formatDateTime(request.secondFollowUpSentAt || request.followUpSentAt) : "Not sent"}</div>
                          </div>
                          <div className="mt-5 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void handleRespond({ sendEmail: false, sendSms: false })}
                              disabled={saving === request.id}
                              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:opacity-70"
                            >
                              {saving === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                              Save quotation
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRespond({ sendEmail: true, sendSms: false })}
                              disabled={saving === request.id || !request.customerEmail}
                              className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Mail className="h-4 w-4" />
                              Send Email
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleRespond({ sendEmail: false, sendSms: true })}
                              disabled={saving === request.id || !request.customerPhone}
                              className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-100 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <MessageCircle className="h-4 w-4" />
                              Send SMS
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const href = buildQuoteWhatsAppHref(request);
                                if (!href) {
                                  setMessage("No customer phone number is saved for WhatsApp.");
                                  return;
                                }
                                window.open(href, "_blank", "noopener,noreferrer");
                              }}
                              disabled={!request.customerPhone}
                              className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-100 transition hover:border-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <MessageCircle className="h-4 w-4" />
                              WhatsApp
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleSendFollowUp(request)}
                              disabled={followUpSendingId === request.id}
                              className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:border-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {followUpSendingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
                              Send Follow-up
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleDownloadQuotation(request)}
                              disabled={downloadingId === request.id}
                              className="inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-white/20 disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              {downloadingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                              Download PDF
                            </button>
                            {allowDelete ? (
                              <button
                                type="button"
                                onClick={() => void handleDeleteQuotation(request)}
                                disabled={deletingId === request.id}
                                className="inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {deletingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                Delete quotation
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 text-sm text-slate-200">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200/80">
                                Project workflow
                              </div>
                              <div className="mt-1 text-sm text-slate-300">
                                Track receipt creation, project progress, payment position, and final POS posting.
                              </div>
                            </div>
                            {projectByRequestId[request.id] ? (
                              <span className="rounded-full border border-cyan-400/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-100">
                                {formatProjectStage(projectByRequestId[request.id]?.stage ?? "RECEIPT_CREATED")}
                              </span>
                            ) : null}
                          </div>

                          {!projectByRequestId[request.id] ? (
                            <div className="mt-4">
                              <div className="rounded-2xl border border-dashed border-white/10 bg-slate-950/40 px-4 py-4 text-sm text-slate-400">
                                No project workflow created yet for this quotation.
                              </div>
                              <div className="mt-3 flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={() => void handleOpenReceiptDraft(request, "project")}
                                  disabled={!canOpenReceiptDraft || draftOpening === `${request.id}:project`}
                                  className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-5 py-2 text-sm font-semibold text-fuchsia-100 transition hover:border-fuchsia-300/40 hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {draftOpening === `${request.id}:project` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  Open full project setup
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void createProjectWorkflow(request)}
                                  disabled={projectSavingId === request.id}
                                  className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                                >
                                  {projectSavingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  Create project workflow
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 space-y-4">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                  Stage
                                  <select
                                    value={projectDrafts[request.id]?.stage ?? "RECEIPT_CREATED"}
                                    onChange={(event) =>
                                      setProjectDrafts((current) => ({
                                        ...current,
                                        [request.id]: {
                                          ...(current[request.id] ?? createProjectDraft(projectByRequestId[request.id], parseStoredQuoteProposal(request.quotationData).total)),
                                          stage: event.target.value as QuoteProjectStage,
                                        },
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                                  >
                                    {PROJECT_STAGE_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {formatProjectStage(option)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                  Payment position
                                  <select
                                    value={projectDrafts[request.id]?.paymentTerm ?? "DEPOSIT_AND_BALANCE"}
                                    onChange={(event) =>
                                      setProjectDrafts((current) => ({
                                        ...current,
                                        [request.id]: {
                                          ...(current[request.id] ?? createProjectDraft(projectByRequestId[request.id], parseStoredQuoteProposal(request.quotationData).total)),
                                          paymentTerm: event.target.value as QuoteProjectPaymentTerm,
                                        },
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                                  >
                                    {PROJECT_PAYMENT_TERM_OPTIONS.map((option) => (
                                      <option key={option} value={option}>
                                        {formatProjectPaymentTerm(option)}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                  Total amount
                                  <input
                                    value={projectDrafts[request.id]?.totalAmount ?? ""}
                                    onChange={(event) =>
                                      setProjectDrafts((current) => ({
                                        ...current,
                                        [request.id]: {
                                          ...(current[request.id] ?? createProjectDraft(projectByRequestId[request.id], parseStoredQuoteProposal(request.quotationData).total)),
                                          totalAmount: event.target.value,
                                        },
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                                  />
                                </label>
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                  Scheduled date
                                  <input
                                    type="date"
                                    value={projectDrafts[request.id]?.scheduledDate ?? ""}
                                    onChange={(event) =>
                                      setProjectDrafts((current) => ({
                                        ...current,
                                        [request.id]: {
                                          ...(current[request.id] ?? createProjectDraft(projectByRequestId[request.id], parseStoredQuoteProposal(request.quotationData).total)),
                                          scheduledDate: event.target.value,
                                        },
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                                  />
                                </label>
                                {(projectDrafts[request.id]?.paymentTerm ?? "DEPOSIT_AND_BALANCE") === "DEPOSIT_AND_BALANCE" ? (
                                  <label className="text-xs uppercase tracking-wide text-slate-400">
                                    Deposit percent
                                    <input
                                      value={projectDrafts[request.id]?.depositPercent ?? "30"}
                                      onChange={(event) =>
                                        setProjectDrafts((current) => ({
                                          ...current,
                                          [request.id]: {
                                            ...(current[request.id] ?? createProjectDraft(projectByRequestId[request.id], parseStoredQuoteProposal(request.quotationData).total)),
                                            depositPercent: event.target.value,
                                          },
                                        }))
                                      }
                                      className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                                    />
                                  </label>
                                ) : null}
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                  Deposit paid
                                  <input
                                    value={projectDrafts[request.id]?.depositPaidAmount ?? "0"}
                                    onChange={(event) =>
                                      setProjectDrafts((current) => ({
                                        ...current,
                                        [request.id]: {
                                          ...(current[request.id] ?? createProjectDraft(projectByRequestId[request.id], parseStoredQuoteProposal(request.quotationData).total)),
                                          depositPaidAmount: event.target.value,
                                        },
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                                  />
                                </label>
                                <label className="text-xs uppercase tracking-wide text-slate-400">
                                  Total paid
                                  <input
                                    value={projectDrafts[request.id]?.amountPaidTotal ?? "0"}
                                    onChange={(event) =>
                                      setProjectDrafts((current) => ({
                                        ...current,
                                        [request.id]: {
                                          ...(current[request.id] ?? createProjectDraft(projectByRequestId[request.id], parseStoredQuoteProposal(request.quotationData).total)),
                                          amountPaidTotal: event.target.value,
                                        },
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                                  />
                                </label>
                                <label className="text-xs uppercase tracking-wide text-slate-400 sm:col-span-2">
                                  Posted POS receipt number
                                  <input
                                    value={projectDrafts[request.id]?.postedReceiptNumber ?? ""}
                                    onChange={(event) =>
                                      setProjectDrafts((current) => ({
                                        ...current,
                                        [request.id]: {
                                          ...(current[request.id] ?? createProjectDraft(projectByRequestId[request.id], parseStoredQuoteProposal(request.quotationData).total)),
                                          postedReceiptNumber: event.target.value,
                                        },
                                      }))
                                    }
                                    className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                                  />
                                </label>
                                <label className="text-xs uppercase tracking-wide text-slate-400 sm:col-span-2">
                                  Internal project notes
                                  <textarea
                                    rows={3}
                                    value={projectDrafts[request.id]?.internalNotes ?? ""}
                                    onChange={(event) =>
                                      setProjectDrafts((current) => ({
                                        ...current,
                                        [request.id]: {
                                          ...(current[request.id] ?? createProjectDraft(projectByRequestId[request.id], parseStoredQuoteProposal(request.quotationData).total)),
                                          internalNotes: event.target.value,
                                        },
                                      }))
                                    }
                                    className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 focus:border-cyan-400 focus:outline-none"
                                  />
                                </label>
                              </div>

                              <div className="grid gap-2 rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-xs text-slate-300">
                                <div>Payment status: {projectByRequestId[request.id]?.paymentStatus?.replace(/_/g, " ")}</div>
                                <div>Required deposit: {formatQuoteCurrency(projectByRequestId[request.id]?.depositRequiredAmount ?? 0)}</div>
                                <div>Balance due: {formatQuoteCurrency(projectByRequestId[request.id]?.balanceAmount ?? 0)}</div>
                                {projectByRequestId[request.id]?.postedToPosAt ? (
                                  <div>Posted to POS: {formatDateTime(projectByRequestId[request.id]?.postedToPosAt ?? null)}</div>
                                ) : null}
                              </div>

                              <div className="flex flex-wrap gap-3">
                                <button
                                  type="button"
                                  onClick={() => void handleOpenReceiptDraft(request, "project")}
                                  disabled={!canOpenReceiptDraft || draftOpening === `${request.id}:project`}
                                  className="inline-flex items-center gap-2 rounded-full border border-fuchsia-400/30 bg-fuchsia-400/10 px-5 py-2 text-sm font-semibold text-fuchsia-100 transition hover:border-fuchsia-300/40 hover:bg-fuchsia-400/20 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  {draftOpening === `${request.id}:project` ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  Open full project setup
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void saveProjectWorkflow(request)}
                                  disabled={projectSavingId === request.id}
                                  className="inline-flex items-center gap-2 rounded-full bg-cyan-400 px-5 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60"
                                >
                                  {projectSavingId === request.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                  Save project workflow
                                </button>
                              </div>

                              <div className="rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                                <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                                  Project timeline
                                </div>
                                <div className="mt-2 space-y-2">
                                  {projectLoadingId === request.id && !(projectEventsByRequestId[request.id] ?? []).length ? (
                                    <div className="text-slate-500">Loading project activity...</div>
                                  ) : (projectEventsByRequestId[request.id] ?? []).length ? (
                                    (projectEventsByRequestId[request.id] ?? []).slice(0, 4).map((event) => (
                                      <div key={event.id} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                                        <div className="font-semibold text-slate-100">{event.eventLabel}</div>
                                        <div className="mt-1 text-[11px] text-slate-400">
                                          {formatDateTime(event.createdAt)}
                                        </div>
                                        {event.eventDetail ? (
                                          <div className="mt-1 text-[11px] text-slate-300">{event.eventDetail}</div>
                                        ) : null}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-slate-500">No project activity recorded yet.</div>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-4 text-sm text-slate-300">
                          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                            Assignment
                          </div>
                          <div className="mt-3">
                            {request.assignedAttendant?.name || request.assignedAttendant?.email || "Unassigned"}
                          </div>
                          <div className="mt-3 grid gap-2 text-xs text-slate-400">
                            <div>Source: {formatSource(request.source)}</div>
                            <div>Created: {formatDateTime(request.createdAt)}</div>
                            <div>Updated: {formatDateTime(request.updatedAt)}</div>
                            {request.quotationDate ? <div>Quotation sent: {formatDateTime(request.quotationDate)}</div> : null}
                            {request.quotationLink ? <div>Quotation link saved</div> : null}
                            {request.quotationPdfLink ? <div>Quotation PDF link saved</div> : null}
                            {request.viewedAt ? <div>Viewed by customer: {formatDateTime(request.viewedAt)}</div> : null}
                            {request.customerActionAt ? (
                              <div>Customer action: {formatDateTime(request.customerActionAt)}</div>
                            ) : null}
                            {request.respondedAt ? (
                              <div>Last quoted / updated: {formatDateTime(request.respondedAt)}</div>
                            ) : null}
                            {request.templateName ? <div>Template used: {request.templateName}</div> : null}
                          </div>
                          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Conversion history
                            </div>
                            <div className="mt-2">
                              {canOpenReceiptDraft
                                ? "Open a quotation print view or convert this saved quotation into the receipts desk."
                                : "Quotation items are still empty. Build the quote first, then open the receipts desk."}
                            </div>
                            <div className="mt-3 space-y-2">
                              {eventsLoadingId === request.id && !requestEvents.length ? (
                                <div className="text-slate-500">Loading conversion activity...</div>
                              ) : conversionEvents.length ? (
                                conversionEvents.slice(0, 6).map((event) => (
                                  <div key={event.id} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                                    <div className="font-semibold text-slate-100">{event.eventLabel}</div>
                                    <div className="mt-1 text-[11px] text-slate-400">
                                      {formatDateTime(event.createdAt)}
                                      {event.actorName ? ` · ${event.actorName}` : ""}
                                    </div>
                                    {event.eventDetail ? (
                                      <div className="mt-1 text-[11px] text-slate-300">{event.eventDetail}</div>
                                    ) : null}
                                  </div>
                                ))
                              ) : (
                                <div className="text-slate-500">No conversion activity recorded yet.</div>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 rounded-2xl border border-white/10 bg-slate-950/50 p-3 text-xs text-slate-300">
                            <div className="font-semibold uppercase tracking-[0.16em] text-slate-400">
                              Latest activity timeline
                            </div>
                            <div className="mt-3 space-y-2">
                              {eventsLoadingId === request.id && !requestEvents.length ? (
                                <div className="text-slate-500">Loading timeline...</div>
                              ) : requestEvents.length ? (
                                ([
                                  { key: "workflow", label: "Workflow activity" },
                                  { key: "conversion", label: "Conversion activity" },
                                  { key: "customer", label: "Customer activity" },
                                ] as const).map((group) =>
                                  groupedRequestEvents[group.key].length ? (
                                    <div key={group.key} className="rounded-xl border border-white/10 bg-slate-900/50 px-3 py-3">
                                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                                        {group.label}
                                      </div>
                                      <div className="mt-2 space-y-2">
                                        {groupedRequestEvents[group.key].slice(0, 4).map((event) => (
                                          <div key={event.id} className="rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2">
                                            <div className="flex items-start justify-between gap-3">
                                              <div>
                                                <div className="font-semibold text-slate-100">{event.eventLabel}</div>
                                                <div className="mt-1 text-[11px] uppercase tracking-[0.14em] text-slate-500">
                                                  {formatEventTypeLabel(event.eventType)}
                                                </div>
                                              </div>
                                              <div className="text-right text-[11px] text-slate-400">
                                                <div>{formatDateTime(event.createdAt)}</div>
                                                <div>{event.actorName || "System"}</div>
                                              </div>
                                            </div>
                                            {event.eventDetail ? (
                                              <div className="mt-2 text-[11px] text-slate-300">{event.eventDetail}</div>
                                            ) : null}
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  ) : null,
                                )
                              ) : (
                                <div className="text-slate-500">No quotation timeline recorded yet.</div>
                              )}
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
        ) : null}
    </div>
  );
}
