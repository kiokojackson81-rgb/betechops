"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Loader2,
  Mail,
  MessageCircle,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
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
  QUOTE_FEE_MODES,
  getQuotePaymentTermsLabel,
  parseStoredQuoteProposal,
  QUOTE_WARRANTY_MODES,
  QUOTE_PAYMENT_TERMS,
  type QuotePaymentMethod,
  type QuotePaymentTerms,
  type QuoteFeeMode,
  type QuoteWarrantyMode,
  type QuoteWarrantySource,
  type QuoteWarrantyUnit,
} from "@/lib/quoteProposal";
import {
  buildItemDrivenPowerSummary,
  buildWarrantyAiSummary,
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
  allowDelete?: boolean;
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

type QuoteDeskFormState = {
  status: QuoteRequestStatus;
  quoteTitle: string;
  quoteMessage: string;
  quoteItems: QuoteItemDraft[];
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
  quoteItems: QuoteItemDraft[];
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
    warrantyMode: "PER_ITEM",
    fullSystemWarranty: "",
    customWarranty: "",
    warrantyGeneralNotes:
      "Warranty applies under normal use, correct installation, and manufacturer operating conditions.",
    aiWarrantySummary: "",
    ...defaults,
    paymentMethod: "",
    paymentTerms: "DEPOSIT_AND_BALANCE",
    deliveryMode: "NOT_INCLUDED",
    installationMode: "NOT_INCLUDED",
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
    quoteItems: [],
    warrantyMode: "PER_ITEM",
    fullSystemWarranty: "",
    customWarranty: "",
    warrantyGeneralNotes:
      "Warranty applies under normal use, correct installation, and manufacturer operating conditions.",
    aiWarrantySummary: "",
    ...defaults,
    paymentMethod: "",
    paymentTerms: "DEPOSIT_AND_BALANCE",
    deliveryMode: "NOT_INCLUDED",
    installationMode: "NOT_INCLUDED",
    deliveryFee: "",
    installationFee: "",
    depositAmount: "",
    balanceAmount: "",
    followUpNotes: "",
  };
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
    return { ...current, templateId: "" };
  }

  const templateFeeState = nextTemplate.items?.length
    ? splitQuoteItemsAndFees(
        nextTemplate.items.map((item) => ({
          itemName: item.itemName,
          description: item.description || "",
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          defaultWarranty: item.defaultWarranty || nextTemplate.warranty || "",
          warranty: item.warranty || item.defaultWarranty || nextTemplate.warranty || "",
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
    quoteTitle: nextTemplate.templateName || generateQuoteTitleFromItems(templateItems, current.projectType),
    quoteMessage: nextTemplate.projectOverview || nextTemplate.scopeOfWork || current.quoteMessage,
    quoteItems: templateItems,
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
  let installationMode: QuoteFeeMode = "NOT_INCLUDED";
  let deliveryMode: QuoteFeeMode = "NOT_INCLUDED";
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
  return {
    warrantyPeriod: match[1],
    warrantyUnit: /month/i.test(match[2]) ? ("MONTHS" as QuoteWarrantyUnit) : ("YEARS" as QuoteWarrantyUnit),
  };
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
  return String(item.warranty || item.defaultWarranty || "").trim();
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
  const parsedWarranty =
    input.warrantyPeriod !== undefined && input.warrantyPeriod !== null
      ? {
          warrantyPeriod: String(input.warrantyPeriod),
          warrantyUnit: input.warrantyUnit ?? "YEARS",
        }
      : parseWarrantyPeriodText(input.warranty || input.defaultWarranty);
  return {
    itemName: input.itemName,
    description: input.description?.trim() || "",
    quantity: input.quantity ?? "1",
    unitPrice: input.unitPrice ?? "",
    defaultWarranty: input.defaultWarranty?.trim() || "",
    warranty: input.warranty?.trim() || "",
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

type ProposalEditorState = Pick<
  QuoteDeskFormState,
  | "warrantyMode"
  | "fullSystemWarranty"
  | "customWarranty"
  | "warrantyGeneralNotes"
  | "aiWarrantySummary"
  | "projectOverview"
  | "whatPriceIncludes"
  | "whatItCanPower"
  | "deliveryTimeline"
  | "installationTimeline"
  | "afterSalesSupport"
  | "importantNotes"
  | "scopeExclusions"
  | "similarProjects"
  | "termsAndConditions"
  | "preparedByDetails"
  | "companyLegalDetails"
  | "projectReferenceLinks"
  | "proposalVisibility"
> & {
  quoteItems: QuoteItemDraft[];
};

type ProposalEditorProps = {
  state: ProposalEditorState;
  onChange: (updater: (current: ProposalEditorState) => ProposalEditorState) => void;
};

function ProposalEditor({ state, onChange }: ProposalEditorProps) {
  const [showAdvancedBlocks, setShowAdvancedBlocks] = useState(false);
  const visibilityEntries = [
    ["projectOverview", "Project Overview"],
    ["whatPriceIncludes", "What Price Includes"],
    ["whatItCanPower", "What It Can Power"],
    ["deliveryAndInstallation", "Delivery & Installation"],
    ["warranty", "Warranty"],
    ["afterSalesSupport", "After-sales Support"],
    ["scopeExclusions", "Scope Exclusions"],
    ["importantNotes", "Important Notes"],
    ["similarProjects", "Similar Projects"],
    ["termsAndConditions", "Terms & Conditions"],
  ] as const;

  const applyAiWarranty = () => {
    onChange((current) => {
      const nextItems = current.quoteItems.map((item) => ({
        ...item,
        warrantySource: item.warrantySource === "CUSTOM" ? "AI_SUGGESTED" : item.warrantySource,
        warranty:
          item.warrantySource === "CUSTOM" || !item.warranty.trim()
            ? suggestWarrantyForItem(item.itemName)
            : item.warranty,
      }));
      return {
        ...current,
        quoteItems: nextItems,
        aiWarrantySummary: buildWarrantyAiSummary(
          nextItems.map((item) => ({
            itemName: item.itemName,
            description: item.description || undefined,
            quantity: parseMoneyInput(item.quantity),
            unitPrice: parseMoneyInput(item.unitPrice),
            defaultWarranty: item.defaultWarranty || undefined,
            warranty: item.warranty || undefined,
            warrantyNotes: item.warrantyNotes || undefined,
            warrantySource: item.warrantySource,
            lineTotal: parseMoneyInput(item.quantity) * parseMoneyInput(item.unitPrice),
          })),
          current.warrantyMode,
        ),
      };
    });
  };

  return (
    <div className="space-y-4 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Proposal Structure
          </div>
          <div className="mt-1 text-sm text-slate-300">
            Build a complete quotation proposal with fixed Betech blocks already loaded so staff only edit the customer-specific parts.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setShowAdvancedBlocks((current) => !current)}
            className="rounded-full border border-white/10 bg-slate-950/60 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-200 transition hover:border-white/20"
          >
            {showAdvancedBlocks ? "Hide standard blocks" : "Edit standard blocks"}
          </button>
          <button
            type="button"
            onClick={applyAiWarranty}
            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100 transition hover:border-cyan-400"
          >
            Check Warranty With AI
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-slate-300">
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-200">
          Auto-filled Betech blocks
        </div>
        <div className="mt-2 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {[
            "Company details and prepared-by contact",
            "Standard scope, exclusions, and support notes",
            "Default payment terms and payment methods",
            "Useful links and similar-project section",
          ].map((line) => (
            <div key={line} className="rounded-xl border border-white/10 bg-slate-950/40 px-3 py-2 text-xs text-slate-200">
              {line}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Warranty mode
          <select
            value={state.warrantyMode}
            onChange={(event) =>
              onChange((current) => ({
                ...current,
                warrantyMode: event.target.value as QuoteWarrantyMode,
              }))
            }
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
          >
            {QUOTE_WARRANTY_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {mode.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs uppercase tracking-wide text-slate-400 md:col-span-2">
          Full system warranty
          <input
            value={state.fullSystemWarranty}
            onChange={(event) =>
              onChange((current) => ({ ...current, fullSystemWarranty: event.target.value }))
            }
            placeholder="Equipment covered under manufacturer warranty. Installation workmanship covered for 12 months."
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-slate-400">
          AI warranty summary
          <textarea
            rows={4}
            value={state.aiWarrantySummary}
            onChange={(event) =>
              onChange((current) => ({ ...current, aiWarrantySummary: event.target.value }))
            }
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
          />
        </label>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Custom warranty
          <textarea
            rows={4}
            value={state.customWarranty}
            onChange={(event) =>
              onChange((current) => ({ ...current, customWarranty: event.target.value }))
            }
            placeholder="Battery warranty subject to correct usage, approved installation, and operation within manufacturer limits."
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
          />
        </label>
        <label className="text-xs uppercase tracking-wide text-slate-400">
          Warranty general notes
          <textarea
            rows={4}
            value={state.warrantyGeneralNotes}
            onChange={(event) =>
              onChange((current) => ({ ...current, warrantyGeneralNotes: event.target.value }))
            }
            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
          />
        </label>
      </div>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
        {visibilityEntries.map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-2 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={state.proposalVisibility[key]}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  proposalVisibility: {
                    ...current.proposalVisibility,
                    [key]: event.target.checked,
                  },
                }))
              }
              className="h-4 w-4 rounded border-white/20 bg-slate-900"
            />
            <span>{label}</span>
          </label>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {[
          ["projectOverview", "Project Overview", 4],
          ["whatPriceIncludes", "What Price Includes", 4],
          ["whatItCanPower", "What It Can Power", 4],
          ["importantNotes", "Important Notes", 4],
          ["similarProjects", "Similar Projects", 4],
          ["projectReferenceLinks", "Project Reference Links", 3],
        ].map(([key, label, rows]) => (
          <label key={key} className="text-xs uppercase tracking-wide text-slate-400">
            {label}
            <textarea
              rows={rows as number}
              value={state[key as keyof ProposalEditorState] as string}
              onChange={(event) =>
                onChange((current) => ({
                  ...current,
                  [key]: event.target.value,
                }))
              }
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
            />
          </label>
        ))}
      </div>

      {showAdvancedBlocks ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ["afterSalesSupport", "After-sales Support", 4],
            ["scopeExclusions", "Scope Exclusions", 4],
            ["termsAndConditions", "Terms & Conditions", 5],
            ["preparedByDetails", "Prepared By Details", 3],
            ["companyLegalDetails", "Company Legal Details", 4],
          ].map(([key, label, rows]) => (
            <label key={key} className="text-xs uppercase tracking-wide text-slate-400">
              {label}
              <textarea
                rows={rows as number}
                value={state[key as keyof ProposalEditorState] as string}
                onChange={(event) =>
                  onChange((current) => ({
                    ...current,
                    [key]: event.target.value,
                  }))
                }
                className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
              />
            </label>
          ))}
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Delivery timeline
            <textarea
              rows={3}
              value={state.deliveryTimeline}
              onChange={(event) =>
                onChange((current) => ({ ...current, deliveryTimeline: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
            />
          </label>
          <label className="text-xs uppercase tracking-wide text-slate-400">
            Installation timeline
            <textarea
              rows={3}
              value={state.installationTimeline}
              onChange={(event) =>
                onChange((current) => ({ ...current, installationTimeline: event.target.value }))
              }
              className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
            />
          </label>
        </div>
      ) : null}
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
  allowDelete = false,
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
  const [templateSaving, setTemplateSaving] = useState(false);
  const [draftOpening, setDraftOpening] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
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
    () =>
      quoteItemsPreview.reduce((sum, item) => sum + item.lineTotal, 0) +
      (formState.installationMode === "CHARGED" ? parseMoneyInput(formState.installationFee) : 0) +
      (formState.deliveryMode === "CHARGED" ? parseMoneyInput(formState.deliveryFee) : 0),
    [formState.deliveryFee, formState.deliveryMode, formState.installationFee, formState.installationMode, quoteItemsPreview],
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
      }).sort(
        (left, right) =>
          new Date(right.updatedAt || right.createdAt).getTime() -
            new Date(left.updatedAt || left.createdAt).getTime() ||
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      ),
    [end, query, requests, start],
  );

  const quoteBalancePreview = useMemo(() => {
    if (formState.paymentTerms !== "DEPOSIT_AND_BALANCE") return null;
    const depositAmount = parseMoneyInput(formState.depositAmount);
    const explicitBalance = formState.balanceAmount.trim() ? parseMoneyInput(formState.balanceAmount) : null;
    return explicitBalance ?? Math.max(0, quoteSubtotalPreview - depositAmount);
  }, [formState.balanceAmount, formState.depositAmount, formState.paymentTerms, quoteSubtotalPreview]);

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

  const createQuoteSubtotalPreview = useMemo(
    () =>
      createQuoteItemsPreview.reduce((sum, item) => sum + item.lineTotal, 0) +
      (createDraft.installationMode === "CHARGED" ? parseMoneyInput(createDraft.installationFee) : 0) +
      (createDraft.deliveryMode === "CHARGED" ? parseMoneyInput(createDraft.deliveryFee) : 0),
    [
      createDraft.deliveryFee,
      createDraft.deliveryMode,
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
    return explicitBalance ?? Math.max(0, createQuoteSubtotalPreview - depositAmount);
  }, [
    createDraft.balanceAmount,
    createDraft.depositAmount,
    createDraft.paymentTerms,
    createQuoteSubtotalPreview,
  ]);

  useEffect(() => {
    if (createDraft.paymentTerms !== "DEPOSIT_AND_BALANCE") {
      if (!createDraft.depositAmount && !createDraft.balanceAmount) return;
      setCreateDraft((current) => ({ ...current, depositAmount: "", balanceAmount: "" }));
      return;
    }
    const next = calculateDepositAndBalance(createQuoteSubtotalPreview);
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
    createQuoteSubtotalPreview,
  ]);

  useEffect(() => {
    if (formState.paymentTerms !== "DEPOSIT_AND_BALANCE") {
      if (!formState.depositAmount && !formState.balanceAmount) return;
      setFormState((current) => ({ ...current, depositAmount: "", balanceAmount: "" }));
      return;
    }
    const next = calculateDepositAndBalance(quoteSubtotalPreview);
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
    quoteSubtotalPreview,
  ]);

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
        setExpandedId(data.request.id);
      }
      setShowCreatePanel(false);
      setCreateDraft(createDefaultQuotationDraft());
      setCreateCatalogQuery("");
      setCreateCatalogResults([]);
      await refreshRequests("ALL", "");
      if (data.request?.id) {
        setExpandedId(data.request.id);
      }
      setMessage("Quotation saved successfully. You can now email, SMS, WhatsApp, or download it.");
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

      const response = await fetch(buildApiUrl(templateApiPath, apiQueryParams), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateName,
          projectOverview: createDraft.projectOverview.trim() || createDraft.quoteMessage.trim() || undefined,
          whatItCanPower: createDraft.whatItCanPower.trim() || undefined,
          scopeOfWork: createDraft.whatPriceIncludes.trim() || undefined,
          deliveryTimeline: createDraft.deliveryTimeline.trim() || undefined,
          installationTimeline: createDraft.installationTimeline.trim() || undefined,
          warranty:
            (createDraft.warrantyMode === "FULL_SYSTEM"
              ? createDraft.fullSystemWarranty
              : createDraft.customWarranty).trim() || undefined,
          afterSalesSupport: createDraft.afterSalesSupport.trim() || undefined,
          terms: createDraft.termsAndConditions.trim() || undefined,
          internalNotes: createDraft.followUpNotes.trim() || undefined,
          defaultPaymentMethod: createDraft.paymentMethod || undefined,
          defaultPaymentTerms: createDraft.paymentTerms,
          defaultDepositAmount:
            createDraft.paymentTerms === "DEPOSIT_AND_BALANCE" && createDraft.depositAmount.trim()
              ? parseMoneyInput(createDraft.depositAmount)
              : undefined,
          defaultBalanceAmount:
            createDraft.paymentTerms === "DEPOSIT_AND_BALANCE" && createDraft.balanceAmount.trim()
              ? parseMoneyInput(createDraft.balanceAmount)
              : undefined,
          items: quoteItems,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || "Failed to save quotation template.");
      }
      await refreshTemplates();
      if (data.template?.id) {
        setCreateMode("template");
        setCreateDraft((current) => ({ ...current, templateId: data.template.id }));
      }
      setMessage("Quotation template saved. You can now reuse it from prepared templates.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Failed to save quotation template.");
    } finally {
      setTemplateSaving(false);
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

function addCreateCatalogItem(product: CatalogQuoteProduct) {
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
          defaultWarranty: product.warranty || suggestWarrantyForItem(product.productName),
          warranty: product.warranty || suggestWarrantyForItem(product.productName),
          warrantySource: "PRODUCT_DEFAULT",
        }),
      ];
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
          defaultWarranty: product.warranty || suggestWarrantyForItem(product.productName),
          warranty: product.warranty || suggestWarrantyForItem(product.productName),
          warrantySource: "PRODUCT_DEFAULT",
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
      status: expandedRequest.status,
      quoteTitle: expandedRequest.quoteTitle || "",
      quoteMessage: expandedRequest.quoteMessage || "",
      quoteItems: feeState.quoteItems,
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
                  Create quotation
                </div>
                <div className="mt-1 text-sm text-slate-300">
                  Start a quotation for walk-in, WhatsApp, phone, or template-based customers without waiting for the website form.
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {([
                  ["manual", "Manual quotation"],
                  ["template", "Use saved template"],
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
              <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
                Quotation Name
                <input
                  value={createDraft.quoteTitle}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, quoteTitle: event.target.value }))}
                  placeholder="Optional custom quotation name to print on the PDF"
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
              {createMode === "template" ? (
                <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
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
              ) : null}
              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-900/70 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Quotation items
                    </div>
                    <div className="mt-1 text-sm text-slate-300">
                      Build the quotation before saving it so the quotation is complete immediately.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setCreateDraft((current) => ({
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

                <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
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
                              onClick={() => addCreateCatalogItem(product)}
                              className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-emerald-100 transition hover:border-emerald-400"
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
                    <div key={`create-quote-item-${index}`} className="rounded-2xl border border-white/10 bg-slate-950/50 p-4">
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
                          <textarea
                            rows={2}
                            value={item.description}
                            onChange={(event) =>
                              setCreateDraft((current) => ({
                                ...current,
                                quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, description: event.target.value } : entry,
                                ),
                              }))
                            }
                            placeholder="Optional short BOQ note"
                            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
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
                        <div className="flex items-end justify-between gap-3 lg:flex-col lg:items-end">
                          <div className="text-right">
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
                            className="inline-flex items-center gap-2 rounded-full border border-rose-500/25 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-rose-200 transition hover:border-rose-400 disabled:cursor-not-allowed disabled:opacity-40"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        </div>
                      </div>
                      <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                        <label className="text-xs uppercase tracking-wide text-slate-400">
                          Warranty period
                          <input
                            value={item.warrantyPeriod}
                            onChange={(event) =>
                              setCreateDraft((current) => ({
                                ...current,
                                quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                  entryIndex === index ? { ...entry, warrantyPeriod: event.target.value } : entry,
                                ),
                              }))
                            }
                            placeholder="10"
                            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 outline-none"
                          />
                        </label>
                        <label className="text-xs uppercase tracking-wide text-slate-400">
                          Unit
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
                            className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 outline-none"
                          >
                            <option value="YEARS">Years</option>
                            <option value="MONTHS">Months</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  ))}
                </div>

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

                <div className="mt-4 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div className="grid gap-2 text-sm text-slate-300 sm:grid-cols-2">
                    <div>
                      <span className="font-semibold text-white">Subtotal:</span>{" "}
                      {formatQuoteCurrency(createQuoteSubtotalPreview)}
                    </div>
                    <div>
                      <span className="font-semibold text-white">Total quoted amount:</span>{" "}
                      {formatQuoteCurrency(createQuoteSubtotalPreview)}
                    </div>
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
              </div>
              <div className="lg:col-span-2 rounded-2xl border border-white/10 bg-slate-950/40 p-4">
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
              <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
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
              <label className="text-xs uppercase tracking-wide text-slate-400 lg:col-span-2">
                Internal follow-up notes
                <textarea
                  value={createDraft.followUpNotes}
                  onChange={(event) => setCreateDraft((current) => ({ ...current, followUpNotes: event.target.value }))}
                  rows={3}
                  className="mt-1 w-full rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-slate-100 outline-none"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {allowTemplateManager ? (
                <button
                  type="button"
                  disabled={templateSaving}
                  onClick={() => void handleSaveTemplateFromDraft()}
                  className="rounded-full border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-200 transition hover:border-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {templateSaving ? "Saving Template..." : "Save As Template"}
                </button>
              ) : null}
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
                {createSaving ? "Saving..." : "Save Quotation"}
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
                        <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
                          <button
                            type="button"
                            onClick={() => setExpandedId(expanded ? null : request.id)}
                            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-100 transition hover:border-white/25 hover:bg-white/[0.06]"
                          >
                            {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            {expanded ? "Close" : "View quotation"}
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
                                    <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
                                      <label className="text-xs uppercase tracking-wide text-slate-400">
                                        Warranty period
                                        <input
                                          value={item.warrantyPeriod}
                                          onChange={(event) =>
                                            setFormState((current) => ({
                                              ...current,
                                              quoteItems: current.quoteItems.map((entry, entryIndex) =>
                                                entryIndex === index ? { ...entry, warrantyPeriod: event.target.value } : entry,
                                              ),
                                            }))
                                          }
                                          placeholder="10"
                                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm normal-case tracking-normal text-slate-100 focus:border-emerald-500 focus:outline-none"
                                        />
                                      </label>
                                      <label className="text-xs uppercase tracking-wide text-slate-400">
                                        Unit
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
                                          className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2 text-sm text-slate-100 focus:border-emerald-500 focus:outline-none"
                                        >
                                          <option value="YEARS">Years</option>
                                          <option value="MONTHS">Months</option>
                                        </select>
                                      </label>
                                    </div>
                                  </div>
                                ))}
                              </div>

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
                            <div className="md:col-span-2">
                              <ProposalEditor
                                state={formState}
                                onChange={(updater) =>
                                  setFormState((current) => {
                                    const next = updater(current);
                                    return { ...current, ...next };
                                  })
                                }
                              />
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
                            Quotation actions
                          </div>
                          <div className="mt-3 space-y-2 text-sm text-slate-300">
                            <div>Email: {request.customerEmail || "No email saved"}</div>
                            <div>Phone: {request.customerPhone || "No phone saved"}</div>
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
                                ? "Open a quotation print view or convert this saved quotation into the receipts desk."
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
