import { z } from "zod";

export const QUOTE_PAYMENT_METHODS = [
  "MPESA_PAYBILL",
  "EQUITY_BANK",
  "ABSA_BANK",
] as const;

export type QuotePaymentMethod = (typeof QUOTE_PAYMENT_METHODS)[number];

export const QUOTE_PAYMENT_TERMS = [
  "FULL_PAYMENT",
  "DEPOSIT_AND_BALANCE",
  "APPROVED_AFTER_INSTALLATION",
] as const;

export type QuotePaymentTerms = (typeof QUOTE_PAYMENT_TERMS)[number];

export const QUOTE_WARRANTY_MODES = [
  "PER_ITEM",
  "FULL_SYSTEM",
  "CUSTOM",
] as const;

export type QuoteWarrantyMode = (typeof QUOTE_WARRANTY_MODES)[number];

export const QUOTE_WARRANTY_SOURCES = [
  "PRODUCT_DEFAULT",
  "TEMPLATE_DEFAULT",
  "FULL_SYSTEM",
  "CUSTOM",
  "AI_SUGGESTED",
] as const;

export type QuoteWarrantySource = (typeof QUOTE_WARRANTY_SOURCES)[number];

export const QUOTE_WARRANTY_UNITS = ["YEARS", "MONTHS"] as const;
export type QuoteWarrantyUnit = (typeof QUOTE_WARRANTY_UNITS)[number];

export const QUOTE_FEE_MODES = ["INCLUDED", "NOT_INCLUDED", "CHARGED"] as const;
export type QuoteFeeMode = (typeof QUOTE_FEE_MODES)[number];

export const QUOTE_PROPOSAL_SECTION_KEYS = [
  "projectOverview",
  "whatPriceIncludes",
  "whatItCanPower",
  "deliveryTimeline",
  "installationTimeline",
  "afterSalesSupport",
  "importantNotes",
  "scopeExclusions",
  "similarProjects",
  "termsAndConditions",
  "preparedByDetails",
  "companyLegalDetails",
  "projectReferenceLinks",
] as const;

export type QuoteProposalSectionKey = (typeof QUOTE_PROPOSAL_SECTION_KEYS)[number];

export const QUOTE_PROPOSAL_VISIBILITY_KEYS = [
  "projectOverview",
  "whatPriceIncludes",
  "whatItCanPower",
  "deliveryAndInstallation",
  "warranty",
  "afterSalesSupport",
  "scopeExclusions",
  "importantNotes",
  "similarProjects",
  "termsAndConditions",
] as const;

export type QuoteProposalVisibilityKey = (typeof QUOTE_PROPOSAL_VISIBILITY_KEYS)[number];

function parseMoneyInput(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const normalized = trimmed.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : value;
}

export const quoteLineItemSchema = z.object({
  itemName: z.string().trim().min(1).max(600),
  description: z.string().trim().max(4000).optional(),
  quantity: z.preprocess(parseMoneyInput, z.number().positive().max(100000)),
  unitPrice: z.preprocess(parseMoneyInput, z.number().nonnegative().max(1000000000)),
  defaultWarranty: z.string().trim().max(4000).optional(),
  warranty: z.string().trim().max(4000).optional(),
  warrantyPeriod: z.preprocess(parseMoneyInput, z.number().positive().max(1000).optional()),
  warrantyUnit: z.enum(QUOTE_WARRANTY_UNITS).optional(),
  warrantyNotes: z.string().trim().max(4000).optional(),
  warrantySource: z.enum(QUOTE_WARRANTY_SOURCES).optional(),
});

export type QuoteLineItemInput = z.infer<typeof quoteLineItemSchema>;

export type StoredQuoteLineItem = QuoteLineItemInput & {
  lineTotal: number;
};

export const quotePaymentMethodSchema = z.enum(QUOTE_PAYMENT_METHODS);
export const quotePaymentTermsSchema = z.enum(QUOTE_PAYMENT_TERMS);

export const PAYMENT_METHOD_DETAILS: Record<
  QuotePaymentMethod,
  {
    label: string;
    lines: string[];
  }
> = {
  MPESA_PAYBILL: {
    label: "M-Pesa Paybill",
    lines: ["Paybill Number: 516600", "Account Number: 0710098001"],
  },
  ABSA_BANK: {
    label: "Absa Bank Transfer / Deposit",
    lines: [
      "Bank Name: Absa Bank Kenya",
      "Account Name: Betech Solar Solution",
      "Account Number: 2047639940",
    ],
  },
  EQUITY_BANK: {
    label: "Equity Bank Transfer / Deposit",
    lines: [
      "Bank Name: Equity Bank",
      "Account Name: Betech Technologies Limited",
      "Branch: Moi Avenue",
      "Account Number: 0470265072030",
    ],
  },
};

export function roundCurrency(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function sanitizeQuoteLineItems(items: QuoteLineItemInput[]): StoredQuoteLineItem[] {
  return items
    .map((item) => ({
      itemName: item.itemName.trim(),
      description:
        typeof item.description === "string" && item.description.trim()
          ? item.description.trim()
          : undefined,
      quantity: roundCurrency(Number(item.quantity || 0)),
      unitPrice: roundCurrency(Number(item.unitPrice || 0)),
      defaultWarranty:
        typeof item.defaultWarranty === "string" && item.defaultWarranty.trim()
          ? item.defaultWarranty.trim()
          : undefined,
      warranty:
        typeof item.warranty === "string" && item.warranty.trim() ? item.warranty.trim() : undefined,
      warrantyPeriod:
        typeof item.warrantyPeriod === "number" && Number.isFinite(item.warrantyPeriod) && item.warrantyPeriod > 0
          ? roundCurrency(item.warrantyPeriod)
          : undefined,
      warrantyUnit: QUOTE_WARRANTY_UNITS.includes(String(item.warrantyUnit || "") as QuoteWarrantyUnit)
        ? (String(item.warrantyUnit) as QuoteWarrantyUnit)
        : undefined,
      warrantyNotes:
        typeof item.warrantyNotes === "string" && item.warrantyNotes.trim()
          ? item.warrantyNotes.trim()
          : undefined,
      warrantySource: QUOTE_WARRANTY_SOURCES.includes(
        String(item.warrantySource || "") as QuoteWarrantySource,
      )
        ? (String(item.warrantySource) as QuoteWarrantySource)
        : undefined,
    }))
    .filter((item) => item.itemName && item.quantity > 0)
    .map((item) => ({
      ...item,
      lineTotal: roundCurrency(item.quantity * item.unitPrice),
    }));
}

export function calculateQuoteTotal(items: StoredQuoteLineItem[]) {
  return roundCurrency(items.reduce((sum, item) => sum + item.lineTotal, 0));
}

export function normalizeQuotePaymentBreakdown(input: {
  total: number;
  paymentTerms?: QuotePaymentTerms | null;
  depositAmount?: number | null | undefined;
  balanceAmount?: number | null | undefined;
}) {
  const total = roundCurrency(input.total);
  if (input.paymentTerms !== "DEPOSIT_AND_BALANCE") {
    return {
      paymentTerms: (input.paymentTerms || "FULL_PAYMENT") as QuotePaymentTerms,
      depositAmount: null,
      balanceAmount: null,
      total,
    };
  }

  const depositAmount =
    typeof input.depositAmount === "number" && Number.isFinite(input.depositAmount)
      ? roundCurrency(Math.max(0, input.depositAmount))
      : null;
  const fallbackBalance =
    depositAmount !== null ? roundCurrency(Math.max(0, total - depositAmount)) : null;
  const balanceAmount =
    typeof input.balanceAmount === "number" && Number.isFinite(input.balanceAmount)
      ? roundCurrency(Math.max(0, input.balanceAmount))
      : fallbackBalance;

  return {
    paymentTerms: "DEPOSIT_AND_BALANCE" as QuotePaymentTerms,
    depositAmount,
    balanceAmount,
    total,
  };
}

export function formatQuoteCurrency(value: number | null | undefined) {
  const amount = typeof value === "number" && Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function parseStoredQuoteProposal(
  quotationData: Record<string, unknown> | null | undefined,
) {
  const items = Array.isArray(quotationData?.items)
    ? sanitizeQuoteLineItems(
        quotationData.items.reduce<QuoteLineItemInput[]>((accumulator, item) => {
          if (!item || typeof item !== "object") return accumulator;
          const record = item as Record<string, unknown>;
          accumulator.push({
            itemName: String(record.itemName ?? ""),
            description:
              typeof record.description === "string" ? String(record.description) : undefined,
            quantity: Number(record.quantity ?? 0),
            unitPrice: Number(record.unitPrice ?? 0),
            defaultWarranty:
              typeof record.defaultWarranty === "string" ? String(record.defaultWarranty) : undefined,
            warranty: typeof record.warranty === "string" ? String(record.warranty) : undefined,
            warrantyPeriod:
              typeof record.warrantyPeriod === "number" ? Number(record.warrantyPeriod) : undefined,
            warrantyUnit:
              typeof record.warrantyUnit === "string"
                ? (String(record.warrantyUnit) as QuoteWarrantyUnit)
                : undefined,
            warrantyNotes:
              typeof record.warrantyNotes === "string" ? String(record.warrantyNotes) : undefined,
            warrantySource:
              typeof record.warrantySource === "string"
                ? (String(record.warrantySource) as QuoteWarrantySource)
                : undefined,
          });
          return accumulator;
        }, []),
      )
    : [];

  const subtotal =
    typeof quotationData?.subtotal === "number" && Number.isFinite(quotationData.subtotal)
      ? roundCurrency(quotationData.subtotal)
      : calculateQuoteTotal(items);
  const total =
    typeof quotationData?.total === "number" && Number.isFinite(quotationData.total)
      ? roundCurrency(quotationData.total)
      : subtotal;
  const discountAmount =
    typeof quotationData?.discountAmount === "number" && Number.isFinite(quotationData.discountAmount)
      ? roundCurrency(quotationData.discountAmount)
      : 0;
  const paymentMethod = QUOTE_PAYMENT_METHODS.includes(
    String(quotationData?.paymentMethod || "") as QuotePaymentMethod,
  )
    ? (String(quotationData?.paymentMethod) as QuotePaymentMethod)
    : null;
  const paymentTerms = QUOTE_PAYMENT_TERMS.includes(
    String(quotationData?.paymentTerms || "") as QuotePaymentTerms,
  )
    ? (String(quotationData?.paymentTerms) as QuotePaymentTerms)
    : null;

  const depositAmount =
    typeof quotationData?.depositAmount === "number" && Number.isFinite(quotationData.depositAmount)
      ? roundCurrency(quotationData.depositAmount)
      : null;
  const balanceAmount =
    typeof quotationData?.balanceAmount === "number" && Number.isFinite(quotationData.balanceAmount)
      ? roundCurrency(quotationData.balanceAmount)
      : null;
  const warrantyMode = QUOTE_WARRANTY_MODES.includes(
    String(quotationData?.warrantyMode || "") as QuoteWarrantyMode,
  )
    ? (String(quotationData?.warrantyMode) as QuoteWarrantyMode)
    : "PER_ITEM";
  const fullSystemWarranty =
    typeof quotationData?.fullSystemWarranty === "string" && quotationData.fullSystemWarranty.trim()
      ? quotationData.fullSystemWarranty.trim()
      : null;
  const customWarranty =
    typeof quotationData?.customWarranty === "string" && quotationData.customWarranty.trim()
      ? quotationData.customWarranty.trim()
      : null;
  const warrantyGeneralNotes =
    typeof quotationData?.warrantyGeneralNotes === "string" &&
    quotationData.warrantyGeneralNotes.trim()
      ? quotationData.warrantyGeneralNotes.trim()
      : null;
  const aiWarrantySummary =
    typeof quotationData?.aiWarrantySummary === "string" && quotationData.aiWarrantySummary.trim()
      ? quotationData.aiWarrantySummary.trim()
      : null;
  const proposalSections = Object.fromEntries(
    QUOTE_PROPOSAL_SECTION_KEYS.map((key) => [
      key,
      typeof quotationData?.[key] === "string" && String(quotationData[key]).trim()
        ? String(quotationData[key]).trim()
        : null,
    ]),
  ) as Record<QuoteProposalSectionKey, string | null>;
  const rawVisibility =
    quotationData?.proposalVisibility &&
    typeof quotationData.proposalVisibility === "object" &&
    !Array.isArray(quotationData.proposalVisibility)
      ? (quotationData.proposalVisibility as Record<string, unknown>)
      : null;
  const proposalVisibility = Object.fromEntries(
    QUOTE_PROPOSAL_VISIBILITY_KEYS.map((key) => [key, rawVisibility?.[key] !== false]),
  ) as Record<QuoteProposalVisibilityKey, boolean>;

  const feeModeValue = (key: "deliveryMode" | "installationMode") =>
    QUOTE_FEE_MODES.includes(String(quotationData?.[key] || "") as QuoteFeeMode)
      ? (String(quotationData?.[key]) as QuoteFeeMode)
      : "NOT_INCLUDED";

  return {
    items,
    subtotal,
    total,
    discountAmount,
    paymentMethod,
    paymentTerms,
    depositAmount,
    balanceAmount,
    warrantyMode,
    fullSystemWarranty,
    customWarranty,
    warrantyGeneralNotes,
    aiWarrantySummary,
    proposalSections,
    proposalVisibility,
    deliveryMode: feeModeValue("deliveryMode"),
    installationMode: feeModeValue("installationMode"),
  };
}

export function getQuotePaymentMethodLabel(value: QuotePaymentMethod | null | undefined) {
  if (!value) return "Not selected";
  return PAYMENT_METHOD_DETAILS[value]?.label || value;
}

export function getQuotePaymentTermsLabel(value: QuotePaymentTerms | null | undefined) {
  if (value === "DEPOSIT_AND_BALANCE") return "Deposit and balance";
  if (value === "APPROVED_AFTER_INSTALLATION") return "Full payment after installation";
  if (value === "FULL_PAYMENT") return "Full payment";
  return "Not specified";
}
